import { refreshTokenApi } from '@/api/auth_login';
import { getUserDeparturesApi } from '@/api/departures';
import { Departure, DepartureCard } from '@/components/departure-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDimensions } from '@/hooks/use-dimensions';
import { formatDateForApi, getDateRange } from '@/utils/date';
import { departureEventEmitter } from '@/utils/departure-events';
import { logError } from '@/utils/logger';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
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
 * Type pour les options de filtre de date
 */
type DateFilterType = 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'custom';


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
        // classStatus: 'Economy Class',
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
        busLicensePlate: apiDeparture.bus.licencePlate,
    };
};

/**
 * Écran d'accueil affichant la liste des départs avec pagination et filtrage par date
 */
export default function HomeScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const dimensions = useDimensions();

    const [departures, setDepartures] = useState<Departure[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 10;
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [isSessionValid, setIsSessionValid] = useState(false);

    // États pour le filtre de date
    const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showDatePickerFrom, setShowDatePickerFrom] = useState(false);
    const [showDatePickerTo, setShowDatePickerTo] = useState(false);
    const [customDateFrom, setCustomDateFrom] = useState<Date>(new Date());
    const [customDateTo, setCustomDateTo] = useState<Date>(new Date());
    const [showFilterModal, setShowFilterModal] = useState(false);
    // État pour suivre si les dates custom sont complètes
    const [customDatesReady, setCustomDatesReady] = useState(false);
    // État pour stocker la hauteur du header mesurée
    const [headerHeight, setHeaderHeight] = useState(0);

    /**
     * Nettoie les données d'authentification stockées
     */
    const clearAuthData = useCallback(async () => {
        await AsyncStorage.multiRemove([
            'token',
            'refresh_token',
            'expires_at',
            'expires_in',
            'token_type',
            'user_id',
            'company_id',
        ]);
    }, []);

    /**
     * Vérifie et gère la session utilisateur
     * - Vérifie si le token existe et est valide
     * - Rafraîchit le token si nécessaire
     * - Retourne true si la session est valide, false sinon
     */
    const checkUserSession = useCallback(async (): Promise<boolean> => {
        try {
            setIsCheckingSession(true);
            const [token, expiresAt, refreshToken, user_role] = await Promise.all([
                AsyncStorage.getItem('token'),
                AsyncStorage.getItem('expires_at'),
                AsyncStorage.getItem('refresh_token'),
                AsyncStorage.getItem('user_role'),
            ]);

            // Si aucun token n'existe, rediriger vers l'écran de connexion
            if (!token || !refreshToken || !user_role) {
                await clearAuthData();
                router.replace('/login');
                return false;
            }

            const currentDate = new Date();
            const expiresAtDate = expiresAt ? new Date(Number(expiresAt) * 1000) : null;

            // Vérifier si le token est expiré ou sur le point d'expirer (marge de 5 minutes)
            const isTokenExpired = !expiresAtDate || expiresAtDate < new Date(currentDate.getTime() + 5 * 60 * 1000);

            // Rafraîchir le token uniquement si nécessaire
            if (isTokenExpired) {
                try {
                    const response = await refreshTokenApi(refreshToken);

                    if (response.status === 200 && response.data?.access_token) {
                        // Calculer le timestamp d'expiration en ajoutant expires_in (en secondes) à la date actuelle
                        const expiresInSeconds = response.data.expires_in || 3600; // Par défaut 1 heure si non fourni
                        const expiresAtTimestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
                        
                        // Sauvegarder les nouveaux tokens
                        await Promise.all([
                            AsyncStorage.setItem('token', response.data.access_token),
                            AsyncStorage.setItem('expires_at', String(expiresAtTimestamp)),
                            AsyncStorage.setItem('token_type', response.data.token_type),
                        ]);

                        return true;
                    }
                } catch (refreshError) {
                    console.error('Erreur lors du rafraîchissement du token:', refreshError);
                    // Si le refresh échoue, nettoyer et rediriger vers l'écran de connexion
                    await clearAuthData();
                    router.replace('/login');
                    return false;
                }
            }

            // Si le token est encore valide
            if (token) {
                return true;
            }

            // Par défaut, rediriger vers l'écran de connexion
            await clearAuthData();
            router.replace('/login');
            return false;
        } catch (error) {
            console.error('Erreur lors de la vérification de la session:', error);
            await clearAuthData();
            router.replace('/login');
            return false;
        } finally {
            setIsCheckingSession(false);
        }
    }, [clearAuthData]);

    /**
     * Charge les départs depuis l'API avec filtrage par date
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
            const userRole = await AsyncStorage.getItem('user_role');

            if (!token || !userId || !userRole) {
                setError('Vous devez être connecté pour voir vos trajets');
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
                await clearAuthData();
                router.replace('/login');
                return;
            }

            // Si userRole = driver, alors roleId = driverId
            // Si userRole = supervisor, alors roleId = supervisorId
            // Etc...
            const roleId = `${userRole}Id`;

            // Construire les paramètres de requête
            let queryParams = `${roleId}=${userId}&pageSize=${pageSize}&page=${page}`;

            // Ajouter les paramètres de date si un filtre est sélectionné
            if (dateFilter !== 'all') {
                const { dateFrom, dateTo } = getDateRange(dateFilter, customDateFrom, customDateTo);
                if (dateFrom && dateTo) {
                    queryParams += `&dateFrom=${formatDateForApi(dateFrom)}&dateTo=${formatDateForApi(dateTo)}`;
                }
            }

            // NE VIDER LA LISTE QUE POUR LA PAGE 1 OU LORS D'UN REFRESH
            if (isRefresh || page === 1) {
                setDepartures([]);
            }

            const response = await getUserDeparturesApi(queryParams, token);
            const data: PaginatedResponse = response.data;

            if (data?.items && Array.isArray(data.items)) {

                const transformedDepartures = data.items.map(transformApiDepartureToDeparture);

                if (isRefresh || page === 1) {
                    // Remplacer la liste pour la première page ou lors du refresh
                    setDepartures(transformedDepartures);
                } else {
                    // Ajouter les nouveaux éléments à la liste existante SANS EFFACER LES PRÉCÉDENTS
                    setDepartures(prev => {
                        // Éviter les doublons en vérifiant les IDs
                        const existingIds = new Set(prev.map(d => d.id));
                        const newDepartures = transformedDepartures.filter(d => !existingIds.has(d.id));
                        return [...prev, ...newDepartures];
                    });
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
            logError('Erreur lors du chargement des trajets:', err);
            setError('Impossible de charger les trajets. Veuillez réessayer.');
            if (err.response?.status === 401) {
                // Session expirée, nettoyer et rediriger vers login
                await clearAuthData();
                router.replace('/login');
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, [pageSize, dateFilter, customDateFrom, customDateTo, clearAuthData]);

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
        // Vérifier qu'on peut charger plus et qu'on n'est pas déjà en train de charger
        if (loadingMore || !hasMore || loading || refreshing) {
            return;
        }

        const nextPage = currentPage + 1;
        if (nextPage <= totalPages) {
            loadDepartures(nextPage, false);
        }
    }, [currentPage, hasMore, loadingMore, loading, refreshing, loadDepartures, totalPages]);

    /**
     * Vérifie la session au chargement du composant
     */
    useEffect(() => {
        const verifySession = async () => {
            const isValid = await checkUserSession();
            setIsSessionValid(isValid);
        };
        verifySession();
    }, [checkUserSession]);

    /**
     * Charge les départs au montage du composant et quand le filtre change
     * Ne charge pas automatiquement pour le filtre 'custom'
     * Ne charge que si la session est valide
     */
    useEffect(() => {
        // Ne pas charger si la session n'est pas valide ou si on est en train de vérifier
        if (isCheckingSession || !isSessionValid) {
            return;
        }

        // Ne pas charger automatiquement pour le filtre custom
        // Le chargement sera déclenché manuellement après la sélection des deux dates
        if (dateFilter === 'custom' && !customDatesReady) {
            return;
        }

        setCurrentPage(1);
        setHasMore(true);
        loadDepartures(1, false);
    }, [loadDepartures, dateFilter, customDatesReady, isSessionValid, isCheckingSession]);

    /**
     * Écoute les événements de mise à jour de statut des départs
     * Met à jour la liste locale quand un départ est modifié
     */
    useEffect(() => {
        const unsubscribe = departureEventEmitter.onStatusUpdate((event) => {
            // Mettre à jour le départ dans la liste si présent
            setDepartures((prevDepartures) => {
                const departureIndex = prevDepartures.findIndex((d) => d.id === event.departureId);
                
                if (departureIndex !== -1) {
                    // Créer une nouvelle liste avec le départ mis à jour
                    const updatedDepartures = [...prevDepartures];
                    
                    if (event.departure) {
                        // Utiliser les données complètes si disponibles
                        updatedDepartures[departureIndex] = event.departure;
                    } else {
                        // Sinon, mettre à jour uniquement le statut
                        updatedDepartures[departureIndex] = {
                            ...updatedDepartures[departureIndex],
                            status: event.newStatus,
                        };
                    }
                    
                    return updatedDepartures;
                }
                
                return prevDepartures;
            });
        });

        return unsubscribe;
    }, []);

    /**
     * Gère le changement de filtre de date
     */
    const handleDateFilterChange = (filter: DateFilterType) => {
        setDateFilter(filter);
        setShowFilterModal(false);
        setCustomDatesReady(false); // Réinitialiser l'état des dates custom

        if (filter === 'custom') {
            // Initialiser les dates personnalisées si elles ne sont pas définies
            const today = new Date();
            setCustomDateFrom(today);
            setCustomDateTo(today);
            setShowDatePickerFrom(true);
            // Ne pas charger immédiatement, attendre la sélection des deux dates
        } else {
            // Pour les autres filtres, vider la liste et afficher le loader immédiatement
            setDepartures([]); // Vider la liste immédiatement
            setLoading(true);
            setError(null);
            setCurrentPage(1);
            setHasMore(true);
            // Le useEffect se chargera du chargement
        }
    };

    /**
     * Gère la sélection d'une date de début personnalisée
     */
    const handleCustomDateFromSelect = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePickerFrom(false);
        }
        if (selectedDate) {
            setCustomDateFrom(selectedDate);
            // Sur iOS, on attend la confirmation via le bouton
            if (Platform.OS === 'android') {
                // Ouvrir automatiquement le sélecteur de date de fin sur Android
                setTimeout(() => setShowDatePickerTo(true), 100);
            }
        }
    };

    /**
     * Gère la sélection d'une date de fin personnalisée
     * Déclenche le chargement une fois les deux dates sélectionnées
     */
    const handleCustomDateToSelect = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePickerTo(false);
        }
        if (selectedDate) {
            setCustomDateTo(selectedDate);
            // Marquer les dates comme prêtes et déclencher le chargement
            setCustomDatesReady(true);
        }
    };

    /**
     * Réinitialise le filtre
     */
    const handleResetFilter = () => {
        setDateFilter('all');
        setShowFilterModal(false);
    };

    /**
     * Obtient le label du filtre actif
     */
    const getFilterLabel = (): string => {
        switch (dateFilter) {
            case 'today':
                return "Aujourd'hui";
            case 'thisWeek':
                return 'Cette semaine';
            case 'thisMonth':
                return 'Ce mois';
            case 'thisYear':
                return 'Cette année';
            case 'custom':
                if (customDateFrom && customDateTo) {
                    const fromStr = customDateFrom.toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                    });
                    const toStr = customDateTo.toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                    });
                    // Si c'est la même date, afficher une seule date
                    if (customDateFrom.getTime() === customDateTo.getTime()) {
                        return customDateFrom.toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                        });
                    }
                    return `${fromStr} - ${toStr}`;
                }
                return 'Date spécifique';
            default:
                return 'Tous les trajets';
        }
    };

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
    const renderItem = useCallback(
        ({ item }: { item: Departure }) => (
            <DepartureCard
                departure={item}
                onTicketPress={() => handleTicketPress(item.id)}
                onMapPress={() => handleMapPress(item.id)}
            />
        ),
        []
    );

    /**
     * Extrait la clé unique pour chaque élément de la liste
     */
    const keyExtractor = useCallback((item: Departure) => item.id, []);

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
     * Rend le contenu vide, l'état de chargement ou l'état d'erreur
     */
    const renderEmpty = () => {
        // Afficher le loader uniquement si on charge et qu'on n'est pas en train de vérifier la session
        // (le chargement pendant la vérification de session est géré par le return early)
        if ((loading || refreshing) && !isCheckingSession) {
            // Calculer la hauteur disponible (hauteur de l'écran - header mesuré)
            const availableHeight = headerHeight > 0 ? dimensions.height - headerHeight : dimensions.height * 0.7;
            
            return (
                <View style={[styles.loadingContainer, { height: availableHeight }]}>
                    <ActivityIndicator size="large" color={isDark ? '#FFFFFF' : '#000000'} />
                    <ThemedText style={styles.loadingText}>Chargement de vos trajets...</ThemedText>
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

    /**
     * Options de filtre mémorisées
     */
    const filterOptions = useMemo<{ type: DateFilterType; label: string }[]>(
        () => [
            { type: 'all', label: 'Tous les trajets' },
            { type: 'today', label: "Aujourd'hui" },
            { type: 'thisWeek', label: 'Cette semaine' },
            { type: 'thisMonth', label: 'Ce mois' },
            { type: 'thisYear', label: 'Cette année' },
            { type: 'custom', label: 'Date spécifique' },
        ],
        []
    );

    /**
     * Rend le modal de sélection de filtre
     */
    const renderFilterModal = useCallback(() => {
        return (
            <Modal
                visible={showFilterModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowFilterModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
                        <View style={styles.modalHeader}>
                            <ThemedText type="title" style={styles.modalTitle}>Filtrer par date</ThemedText>
                            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                                <MaterialIcons name="close" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.filterOptions}>
                            {filterOptions.map((option) => (
                                <TouchableOpacity
                                    key={option.type}
                                    style={[
                                        styles.filterOption,
                                        dateFilter === option.type && styles.filterOptionActive,
                                        {
                                            backgroundColor: dateFilter === option.type
                                                ? (isDark ? '#2C2C2E' : '#F3F3F7')
                                                : 'transparent'
                                        }
                                    ]}
                                    onPress={() => handleDateFilterChange(option.type)}
                                >
                                    <ThemedText
                                        style={[
                                            styles.filterOptionText,
                                            dateFilter === option.type && styles.filterOptionTextActive
                                        ]}
                                    >
                                        {option.label}
                                    </ThemedText>
                                    {dateFilter === option.type && (
                                        <MaterialIcons
                                            name="check"
                                            size={20}
                                            color={isDark ? '#FFFFFF' : '#000000'}
                                        />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.resetButton, { backgroundColor: isDark ? '#2C2C2E' : '#F3F3F7' }]}
                                onPress={handleResetFilter}
                            >
                                <ThemedText style={styles.resetButtonText}>Réinitialiser</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }, [showFilterModal, isDark, filterOptions, dateFilter, handleDateFilterChange, handleResetFilter]);

    const backgroundColor = isDark ? '#000000' : '#F3F3F7';
    const headerBackgroundColor = isDark ? '#000000' : '#F3F3F7';

    

    // Si la session n'est pas valide, ne rien afficher (redirection en cours)
    if (!isSessionValid) {
        return <View style={[styles.container, { backgroundColor }]} />;
    }

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
                onLayout={(event) => {
                    const { height } = event.nativeEvent.layout;
                    setHeaderHeight(height);
                }}
            >
                <ThemedText type="title" style={styles.title}>Mes trajets</ThemedText>

                {/* Bouton de filtre */}
                <TouchableOpacity
                    style={[styles.filterButton, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
                    onPress={() => setShowFilterModal(true)}
                >
                    <MaterialIcons
                        name="filter-list"
                        size={20}
                        color={isDark ? '#FFFFFF' : '#000000'}
                    />
                    <ThemedText style={styles.filterButtonText}>{getFilterLabel()}</ThemedText>
                    {dateFilter !== 'all' && (
                        <View style={[styles.filterBadge, { backgroundColor: isDark ? '#1776BA' : '#1776BA' }]} />
                    )}
                </TouchableOpacity>
            </ThemedView>

            {/* Liste avec pagination et pull-to-refresh */}
            <FlatList
                data={departures}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                initialNumToRender={10}
                windowSize={10}
                contentContainerStyle={
                    (loading || refreshing) && departures.length === 0
                        ? styles.contentContainerLoading
                        : departures.length === 0
                        ? styles.emptyContainer
                        : styles.contentContainer
                }
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={isDark ? '#FFFFFF' : '#000000'}
                    />
                }
                onEndReached={loadMore}
                onEndReachedThreshold={0.2}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderFooter}
            />

            {/* Modal de filtre */}
            {renderFilterModal()}

            {/* DatePicker pour date personnalisée - Date de début */}
            {Platform.OS === 'ios' && showDatePickerFrom && (
                <Modal
                    visible={showDatePickerFrom}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowDatePickerFrom(false)}
                >
                    <View style={styles.datePickerOverlay}>
                        <View style={[styles.datePickerContainer, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
                            <View style={styles.datePickerHeader}>
                                <ThemedText type="title" style={styles.datePickerTitle}>Sélectionner la date de début</ThemedText>
                                <TouchableOpacity onPress={() => setShowDatePickerFrom(false)}>
                                    <MaterialIcons name="close" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.datePickerContent}>
                                <DateTimePicker
                                    value={customDateFrom}
                                    mode="date"
                                    display="spinner"
                                    onChange={handleCustomDateFromSelect}
                                    maximumDate={new Date()}
                                    textColor={isDark ? '#FFFFFF' : '#000000'}
                                    themeVariant={isDark ? 'dark' : 'light'}
                                />
                            </View>
                            <View style={styles.datePickerFooter}>
                                <TouchableOpacity
                                    style={[styles.datePickerButton, { backgroundColor: isDark ? '#2C2C2E' : '#F3F3F7' }]}
                                    onPress={() => setShowDatePickerFrom(false)}
                                >
                                    <ThemedText style={styles.datePickerButtonText}>Annuler</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.datePickerButton, styles.datePickerButtonPrimary, { backgroundColor: isDark ? '#0A84FF' : '#007AFF' }]}
                                    onPress={() => {
                                        setShowDatePickerFrom(false);
                                        setTimeout(() => setShowDatePickerTo(true), 100);
                                    }}
                                >
                                    <ThemedText style={[styles.datePickerButtonText, styles.datePickerButtonTextPrimary]}>Confirmer</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* DatePicker Android - Date de début (sans Modal) */}
            {Platform.OS === 'android' && showDatePickerFrom && (
                <DateTimePicker
                    value={customDateFrom}
                    mode="date"
                    display="default"
                    onChange={handleCustomDateFromSelect}
                    maximumDate={new Date()}
                />
            )}

            {/* DatePicker pour date personnalisée - Date de fin */}
            {Platform.OS === 'ios' && showDatePickerTo && (
                <Modal
                    visible={showDatePickerTo}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowDatePickerTo(false)}
                >
                    <View style={styles.datePickerOverlay}>
                        <View style={[styles.datePickerContainer, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
                            <View style={styles.datePickerHeader}>
                                <ThemedText type="title" style={styles.datePickerTitle}>Sélectionner la date de fin</ThemedText>
                                <TouchableOpacity onPress={() => setShowDatePickerTo(false)}>
                                    <MaterialIcons name="close" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.datePickerContent}>
                                <DateTimePicker
                                    value={customDateTo}
                                    mode="date"
                                    display="spinner"
                                    onChange={handleCustomDateToSelect}
                                    minimumDate={customDateFrom}
                                    maximumDate={new Date()}
                                    textColor={isDark ? '#FFFFFF' : '#000000'}
                                    themeVariant={isDark ? 'dark' : 'light'}
                                />
                            </View>
                            <View style={styles.datePickerFooter}>
                                <TouchableOpacity
                                    style={[styles.datePickerButton, { backgroundColor: isDark ? '#2C2C2E' : '#F3F3F7' }]}
                                    onPress={() => setShowDatePickerTo(false)}
                                >
                                    <ThemedText style={styles.datePickerButtonText}>Annuler</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.datePickerButton, styles.datePickerButtonPrimary, { backgroundColor: isDark ? '#0A84FF' : '#007AFF' }]}
                                    onPress={() => {
                                        setShowDatePickerTo(false);
                                        // Marquer les dates comme prêtes et déclencher le chargement
                                        setCustomDatesReady(true);
                                    }}
                                >
                                    <ThemedText style={[styles.datePickerButtonText, styles.datePickerButtonTextPrimary]}>Confirmer</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* DatePicker Android - Date de fin (sans Modal) */}
            {Platform.OS === 'android' && showDatePickerTo && (
                <DateTimePicker
                    value={customDateTo}
                    mode="date"
                    display="default"
                    onChange={handleCustomDateToSelect}
                    minimumDate={customDateFrom}
                    maximumDate={new Date()}
                />
            )}
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
        marginBottom: 12,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    filterButtonText: {
        marginLeft: 8,
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
    },
    filterBadge: {
        width: 10,
        height: 10,
        borderRadius: 100,
        marginLeft: 8,
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
        width: '100%',
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
        paddingBottom: 40,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    },
    modalTitle: {
        fontSize: 24,
        fontFamily: 'Ubuntu_Bold',
    },
    filterOptions: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    filterOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    filterOptionActive: {
        // Style déjà géré par backgroundColor dynamique
    },
    filterOptionText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
    },
    filterOptionTextActive: {
        fontFamily: 'Ubuntu_Medium',
    },
    modalFooter: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    resetButton: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    resetButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
    },
    datePickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    datePickerContainer: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        maxHeight: '80%',
    },
    datePickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    },
    datePickerTitle: {
        fontSize: 20,
        fontFamily: 'Ubuntu_Bold',
    },
    datePickerContent: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    datePickerFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        gap: 12,
    },
    datePickerButton: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    datePickerButtonPrimary: {
        // Style pour le bouton primaire
    },
    datePickerButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
    },
    datePickerButtonTextPrimary: {
        color: '#FFFFFF',
    },
});
