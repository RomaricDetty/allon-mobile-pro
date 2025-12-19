import { getUserDeparturesApi } from '@/api/departures';
import { Departure, DepartureCard } from '@/components/departure-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Interface pour les données de départ de l'API
 */
interface ApiDeparture {
    id: string;
    departureDateTime: string;
    arrivalEta: string;
    trip: {
        label: string;
        stationFrom: { name: string };
        stationTo: { name: string };
    };
    bus: {
        busType: string;
        licencePlate: string;
        mark: string;
        model: string;
    };
    company: {
        name: string;
    };
    priceSnapshot: string;
    seatsAvailable: number;
    seatsBooked: number;
    status: string;
    delayMinutes?: number | null;
    delayReason?: string | null;
}

/**
 * Interface pour la réponse paginée de l'API
 */
interface PaginatedResponse {
    items: ApiDeparture[];
    total: string;
    page: string;
    pageSize: string;
}

/**
 * Extrait un code de station (3 lettres) depuis un nom de station
 */
const extractStationCode = (stationName: string): string => {
    if (!stationName) return '---';
    // Prendre les 3 premières lettres en majuscules
    const words = stationName.trim().split(/\s+/);
    if (words.length >= 1) {
        const firstWord = words[0].toUpperCase();
        if (firstWord.length >= 3) {
            return firstWord.substring(0, 3);
        }
        // Si le premier mot fait moins de 3 lettres, combiner avec le suivant
        if (words.length > 1 && firstWord.length < 3) {
            const secondWord = words[1].toUpperCase();
            return (firstWord + secondWord).substring(0, 3);
        }
        return firstWord.padEnd(3, 'X');
    }
    return '---';
};

/**
 * Extrait la ville depuis un nom de gare
 * Exemples: "Gare Adjame" -> "Abidjan", "Gare Man" -> "Man"
 */
const extractCityFromStation = (stationName: string): string | undefined => {
    if (!stationName) return undefined;
    
    // Mapping des gares connues vers leurs villes
    const stationToCity: Record<string, string> = {
        'adjame': 'Abidjan',
        'man': 'Man',
        'bouake': 'Bouaké',
        'yakro': 'Yamoussoukro',
        'divo': 'Divo',
        'basilique': 'Yamoussoukro',
    };
    
    const lowerName = stationName.toLowerCase();
    
    // Chercher une correspondance dans le mapping
    for (const [key, city] of Object.entries(stationToCity)) {
        if (lowerName.includes(key)) {
            return city;
        }
    }
    
    // Si pas de correspondance, essayer d'extraire le deuxième mot
    const words = stationName.trim().split(/\s+/);
    if (words.length > 1) {
        // Si le premier mot est "Gare", prendre le suivant
        if (words[0].toLowerCase() === 'gare' && words.length > 1) {
            return words[1].charAt(0).toUpperCase() + words[1].slice(1).toLowerCase();
        }
    }
    
    return undefined;
};

/**
 * Transforme les données de l'API en format compatible avec DepartureCard
 */
const transformApiDepartureToDeparture = (apiDeparture: ApiDeparture): Departure => {
    const departureDate = new Date(apiDeparture.departureDateTime);
    const arrivalDate = new Date(apiDeparture.arrivalEta);
    const durationMs = arrivalDate.getTime() - departureDate.getTime();
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Format de durée (ex: "21h 35m")
    let durationText = '';
    if (durationHours > 0) {
        durationText = `${durationHours}h${durationMinutes > 0 ? ` ${durationMinutes}m` : ''}`;
    } else {
        durationText = `${durationMinutes}min`;
    }

    // Format de la date en français (ex: "2 nov. 2025")
    const formattedDate = departureDate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    // Format de l'heure en français (ex: "09:45" ou "21:30")
    const formattedDepartureTime = departureDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const formattedArrivalTime = arrivalDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    // Extraction des codes de stations
    const departureStationCode = extractStationCode(apiDeparture.trip.stationFrom.name);
    const arrivalStationCode = extractStationCode(apiDeparture.trip.stationTo.name);
    
    // Extraction des villes
    const departureCity = extractCityFromStation(apiDeparture.trip.stationFrom.name);
    const arrivalCity = extractCityFromStation(apiDeparture.trip.stationTo.name);

    // Format du prix (ex: "6 000 XOF")
    const priceValue = parseFloat(apiDeparture.priceSnapshot);
    const formattedPrice = `${priceValue.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XOF`;

    // Statut avec retard si applicable
    let statusText = apiDeparture.status;
    if (apiDeparture.delayMinutes && apiDeparture.delayMinutes > 0) {
        statusText = `Retard: ${apiDeparture.delayMinutes}min`;
    }

    return {
        id: apiDeparture.id,
        // Nouvelles propriétés pour le nouveau design
        company: apiDeparture.company.name,
        busType: `${apiDeparture.bus.busType} ${apiDeparture.bus.mark}`,
        classStatus: 'Economy Class',
        departureStationCode: departureStationCode,
        departureStationName: apiDeparture.trip.stationFrom.name,
        departureCity: departureCity,
        departureCityCountry: apiDeparture.trip.stationFrom.name,
        departureTime: formattedDepartureTime,
        arrivalStationCode: arrivalStationCode,
        arrivalStationName: apiDeparture.trip.stationTo.name,
        arrivalCity: arrivalCity,
        arrivalCityCountry: apiDeparture.trip.stationTo.name,
        arrivalTime: formattedArrivalTime,
        date: formattedDate,
        duration: durationText,
        price: formattedPrice,
        // Propriétés de compatibilité
        line: `${apiDeparture.bus.busType} - ${apiDeparture.bus.mark}`,
        destination: apiDeparture.trip.label,
        departureDate: formattedDate,
        seatsAvailable: apiDeparture.seatsAvailable,
        seatsBooked: apiDeparture.seatsBooked,
        status: statusText,
    };
};

/**
 * Écran d'accueil affichant la liste des départs avec pagination
 */
export default function HomeScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();

    const [departures, setDepartures] = useState<Departure[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 10;

    /**
     * Charge les départs depuis l'API
     * @param page - Numéro de la page à charger
     * @param isRefresh - Indique si c'est un refresh (réinitialise la liste)
     */
    const loadDepartures = useCallback(async (page: number = 1, isRefresh: boolean = false) => {
        try {
            // Afficher le loader approprié
            if (isRefresh) {
                setRefreshing(true);
            } else if (page === 1) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }
            setError(null);

            const token = await AsyncStorage.getItem('token');
            const userId = await AsyncStorage.getItem('user_id');

            if (!token || !userId) {
                setError('Vous devez être connecté pour voir vos trajets');
                setLoading(false);
                setRefreshing(false);
                return;
            }

            const queryParams = `driverId=${userId}&pageSize=${pageSize}&page=${page}`;
            const response = await getUserDeparturesApi(queryParams, token);
            const data: PaginatedResponse = response.data;

            if (data?.items && Array.isArray(data.items)) {
                const transformedDepartures = data.items.map(transformApiDepartureToDeparture);
                
                if (isRefresh || page === 1) {
                    // Remplacer la liste pour la première page ou lors du refresh
                    setDepartures(transformedDepartures);
                } else {
                    // Ajouter les nouveaux éléments à la liste existante
                    setDepartures(prev => [...prev, ...transformedDepartures]);
                }

                // Calculer le nombre total de pages
                const total = parseInt(data.total || '0', 10);
                const calculatedTotalPages = Math.ceil(total / pageSize);
                setTotalPages(calculatedTotalPages);
                setCurrentPage(page);
                
                // Vérifier s'il y a encore des pages à charger
                setHasMore(page < calculatedTotalPages);
            } else {
                if (isRefresh || page === 1) {
                    setDepartures([]);
                }
                setHasMore(false);
            }
        } catch (err: any) {
            console.error('Erreur lors du chargement des trajets:', err);
            setError('Impossible de charger les trajets. Veuillez réessayer.');
            if (err.response?.status === 401) {
                Alert.alert('Session expirée', 'Votre session a expiré, veuillez vous reconnecter');
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, [pageSize]);

    /**
     * Gère le pull-to-refresh
     */
    const onRefresh = useCallback(() => {
        setCurrentPage(1);
        setHasMore(true);
        loadDepartures(1, true);
    }, [loadDepartures]);

    /**
     * Charge la page suivante lors du scroll
     */
    const loadMore = useCallback(() => {
        if (!loadingMore && hasMore && !loading && !refreshing) {
            const nextPage = currentPage + 1;
            loadDepartures(nextPage, false);
        }
    }, [currentPage, hasMore, loadingMore, loading, refreshing, loadDepartures]);

    /**
     * Charge les départs au montage du composant
     */
    useEffect(() => {
        loadDepartures(1, false);
    }, [loadDepartures]);

    /**
     * Gère le clic sur le bouton ticket
     */
    const handleTicketPress = (departureId: string) => {
        Alert.alert('Ticket', `Voir le ticket pour le trajet ${departureId}`);
    };

    /**
     * Gère le clic sur l'icône de carte
     */
    const handleMapPress = (departureId: string) => {
        Alert.alert('Carte', `Voir la carte pour le trajet ${departureId}`);
    };

    /**
     * Rend un élément de la liste
     */
    const renderItem = ({ item }: { item: Departure }) => (
        <DepartureCard
            departure={item}
            onTicketPress={() => handleTicketPress(item.id)}
            onMapPress={() => handleMapPress(item.id)}
        />
    );

    /**
     * Rend le footer avec l'indicateur de chargement
     */
    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#000000'} />
                <ThemedText style={styles.footerLoaderText}>Chargement...</ThemedText>
            </View>
        );
    };

    /**
     * Rend le contenu vide ou l'état de chargement
     */
    const renderEmpty = () => {
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={isDark ? '#FFFFFF' : '#000000'} />
                    <ThemedText style={styles.loadingText}>Chargement des trajets...</ThemedText>
                </View>
            );
        }

        if (error) {
            return (
                <View style={styles.errorContainer}>
                    <ThemedText style={styles.errorText}>{error}</ThemedText>
                </View>
            );
        }

        return (
            <View style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>Aucun trajet disponible</ThemedText>
            </View>
        );
    };

    const backgroundColor = isDark ? '#000000' : '#F3F3F7';
    const headerBackgroundColor = isDark ? '#000000' : '#F3F3F7';

    return (
        <View style={[styles.container, { backgroundColor }]}>
            {/* Header fixe */}
            <ThemedView 
                style={[
                    styles.header, 
                    { 
                        backgroundColor: headerBackgroundColor,
                        paddingTop: insets.top + 16,
                    }
                ]}
            >
                <ThemedText type="title" style={styles.title}>Mes trajets</ThemedText>
            </ThemedView>

            {/* Liste avec pagination et pull-to-refresh */}
            <FlatList
                data={departures}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[
                    loading ? styles.contentContainerLoading : styles.contentContainer,
                    departures.length === 0 && !loading && styles.emptyContainer
                ]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={isDark ? '#FFFFFF' : '#000000'}
                    />
                }
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderFooter}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        zIndex: 10,
    },
    title: {
        fontSize: 32,
        fontFamily: 'Ubuntu_Bold',
    },
    contentContainer: {
        padding: 16,
        paddingTop: 8,
    },
    contentContainerLoading: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    errorText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
        color: '#FF3B30',
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
        textAlign: 'center',
    },
    footerLoader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    footerLoaderText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        marginLeft: 8,
    },
});
