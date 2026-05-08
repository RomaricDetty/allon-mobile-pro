import { getBookingsByDepartureIdApi } from '@/api/departures';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Interface pour les données de réservation de l'API
 */
interface ApiBooking {
    id?: string;
    code: string;
    status: string;
    type?: string;
    tripType?: string;
    arrivalTime?: string;
    departureTime?: string;
    departureDateTime?: string;
    duration?: string;
    totalAmount?: string;
    currency?: string;
    channel?: string;
    paymentMethod?: string;
    paymentProvider?: string;
    createdAt?: string;
    updatedAt?: string;
    bus?: {
        busType?: string;
        capacity?: number;
        licencePlate?: string;
    };
    returnBus?: {
        busType?: string;
        capacity?: number;
        licencePlate?: string;
    };
    companyName?: string;
    companyPhones?: Array<{ value?: string; type?: string }>;
    contact?: {
        email?: string;
        firstName?: string;
        lastName?: string;
        phone?: { value?: string; type?: string };
        relationship?: string;
    };
    trip?: {
        distance?: string;
        estimatedDuration?: number;
        label?: string;
        stationFrom?: { name?: string };
        stationTo?: { name?: string };
    };
    passengers?: any[];
    stops?: any[];
    departure?: {
        id?: string;
        code?: string;
        departureDateTime?: string;
        status?: string;
        trip?: any;
    };
    summary?: {
        canValidateAll?: boolean;
        paidItems?: number;
        totalItems?: number;
        usedItems?: number;
    };
    items?: any[];
}

/**
 * Interface pour la réponse paginée de l'API
 */
interface PaginatedResponse {
    items: ApiBooking[];
    total: string;
    page: string;
    pageSize: string;
}

/**
 * Convertit un statut technique en libellé français lisible
 * @param status - Le statut technique (ex: "PAID")
 * @returns Le libellé français correspondant
 */
const getStatusLabel = (status?: string): string => {
    if (!status) return '--';
    
    const STATUS_MAPPING: Record<string, string> = {
        'PAID': 'Payé',
        'PENDING': 'En attente',
        'CANCELLED': 'Annulé',
        'REFUNDED': 'Remboursé',
        'PARTIAL': 'Partiel',
        'ARRIVED': 'Arrivé',
        'DEPARTED': 'Parti',
        'SCHEDULED': 'Programmé',
        'VALIDATED': 'Validé',
        'USED': 'Utilisé',
        'EXPIRED': 'Expiré',
    };
    
    return STATUS_MAPPING[status.toUpperCase()] || status;
};

/**
 * Convertit un type de trajet en libellé français lisible
 * @param tripType - Le type de trajet (ex: "ONE_WAY")
 * @returns Le libellé français correspondant
 */
const getTripTypeLabel = (tripType?: string): string => {
    if (!tripType) return '--';
    
    const TRIP_TYPE_MAPPING: Record<string, string> = {
        'ONE_WAY': 'Aller simple',
        'ROUND_TRIP': 'Aller-retour',
        'MULTI_CITY': 'Multi-ville',
    };
    
    return TRIP_TYPE_MAPPING[tripType.toUpperCase()] || tripType;
};

/**
 * Formate un montant avec la devise
 * @param amount - Le montant à formater
 * @param currency - La devise (ex: "XOF")
 * @returns Le montant formaté
 */
const formatAmount = (amount?: string, currency?: string): string => {
    if (!amount) return '--';
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return amount;
    const formatted = numAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted} ${currency || 'XOF'}`;
};

/**
 * Convertit un canal en libellé français
 * @param channel - Le canal (ex: "WEB_APP")
 * @returns Le libellé français correspondant
 */
const getChannelLabel = (channel?: string): string => {
    if (!channel) return '--';
    
    const CHANNEL_MAPPING: Record<string, string> = {
        'WEB_APP': 'Application Web',
        'MOBILE_APP': 'Application Mobile',
        'AGENCY': 'Agence',
        'PHONE': 'Téléphone',
    };
    
    return CHANNEL_MAPPING[channel.toUpperCase()] || channel;
};

/**
 * Convertit une méthode de paiement en libellé français
 * @param method - La méthode de paiement (ex: "MOBILE_MONEY")
 * @returns Le libellé français correspondant
 */
const getPaymentMethodLabel = (method?: string): string => {
    if (!method) return '--';
    
    const PAYMENT_METHOD_MAPPING: Record<string, string> = {
        'MOBILE_MONEY': 'Mobile Money',
        'CARD': 'Carte bancaire',
        'CASH': 'Espèces',
        'BANK_TRANSFER': 'Virement bancaire',
    };
    
    return PAYMENT_METHOD_MAPPING[method.toUpperCase()] || method;
};

/**
 * Formate un numéro de téléphone pour l'affichage
 * @param phone - Le numéro de téléphone (peut être un objet ou une string)
 * @returns Le numéro formaté
 */
const formatPhoneNumber = (phone: any): string => {
    if (!phone) return '--';
    
    // Si c'est un objet avec une propriété value
    if (typeof phone === 'object' && phone.value) {
        return phone.value;
    }
    
    // Si c'est une string
    if (typeof phone === 'string') {
        return phone;
    }
    
    // Si c'est un objet mais sans value, essayer de trouver une valeur
    if (typeof phone === 'object') {
        return phone.number || phone.phone || phone.toString() || '--';
    }
    
    return String(phone);
};

/**
 * Récupère la couleur associée à un statut
 * @param status - Le statut technique
 * @param isDark - Indique si le thème est sombre
 * @returns La couleur correspondante
 */
const getStatusColor = (status?: string, isDark: boolean = false): string => {
    if (!status) return isDark ? '#98989D' : '#8E8E93';
    
    const STATUS_COLOR_MAPPING: Record<string, { light: string; dark: string }> = {
        'PAID': { light: '#34C759', dark: '#30D158' },
        'PENDING': { light: '#FF9500', dark: '#FF9F0A' },
        'CANCELLED': { light: '#FF3B30', dark: '#FF453A' },
        'REFUNDED': { light: '#5856D6', dark: '#5E5CE6' },
        'PARTIAL': { light: '#FF9500', dark: '#FF9F0A' },
        'ARRIVED': { light: '#34C759', dark: '#30D158' },
        'DEPARTED': { light: '#1776BA', dark: '#1776BA' },
        'SCHEDULED': { light: '#1776BA', dark: '#1776BA' },
        'VALIDATED': { light: '#34C759', dark: '#30D158' },
        'USED': { light: '#34C759', dark: '#30D158' },
    };
    
    const colorMapping = STATUS_COLOR_MAPPING[status.toUpperCase()];
    return colorMapping
        ? (isDark ? colorMapping.dark : colorMapping.light)
        : (isDark ? '#98989D' : '#8E8E93');
};

/**
 * Formate une date ISO en format lisible
 * @param dateString - La date au format ISO
 * @returns La date formatée
 */
const formatDate = (dateString?: string): string => {
    if (!dateString) return '--';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch (error) {
        return dateString;
    }
};

/**
 * Formate une date ISO en heure lisible
 * @param dateString - La date au format ISO
 * @returns L'heure formatée
 */
const formatTime = (dateString?: string): string => {
    if (!dateString) return '--:--';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (error) {
        return '--:--';
    }
};

/**
 * Écran de liste des réservations pour un départ
 * Affiche toutes les réservations liées à un départ spécifique
 */
export default function BookingsScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ departureId: string; departureTrips: string }>();

    const departureTrips = useMemo<any[] | null>(() => {
        try {
            if (params.departureTrips) {
                return JSON.parse(params.departureTrips) as any[];
            }
        } catch (error) {
            console.error('Erreur lors du parsing des données des trajets du départ:', error);
        }
        return null;
    }, [params.departureTrips]);

    console.log('departureTrips ===> ', departureTrips);

    const [bookings, setBookings] = useState<ApiBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 10;
    const [departureCity, setDepartureCity] = useState<string>('');
    const [arrivalCity, setArrivalCity] = useState<string>('');

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
        ]);
    }, []);

    /**
     * Charge les réservations depuis l'API pour un départ spécifique
     * @param page - Numéro de la page à charger
     * @param isRefresh - Indique si c'est un refresh (réinitialise la liste)
     */
    const loadBookings = useCallback(async (page: number = 1, isRefresh: boolean = false) => {
        try {
            // Vérifier que departureId est disponible
            if (!params.departureId) {
                setError('ID du départ manquant');
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
                return;
            }

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
                setError('Vous devez être connecté pour voir les réservations');
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
                await clearAuthData();
                router.replace('/login');
                return;
            }

            const roleId = `${userRole}Id`;

            // Construire les paramètres de requête avec departureId
            const queryParams = `departureId=${params.departureId}&${roleId}=${userId}&pageSize=${pageSize}&page=${page}`;

            // NE VIDER LA LISTE QUE POUR LA PAGE 1 OU LORS D'UN REFRESH
            if (isRefresh || page === 1) {
                setBookings([]);
            }

            const response = await getBookingsByDepartureIdApi(queryParams, token);
            console.log('response loading bookings ===> ', response.data);
            const data: PaginatedResponse = response.data;

            if (data?.items && Array.isArray(data.items)) {
                if (isRefresh || page === 1) {
                    // Remplacer la liste pour la première page ou lors du refresh
                    setBookings(data.items);
                    
                    // Extraire les villes de départ et d'arrivée depuis la première réservation
                    if (data.items.length > 0) {
                        const firstBooking = data.items[0];
                        const trip = firstBooking.trip || firstBooking.departure?.trip;
                        if (trip) {
                            setDepartureCity(trip.stationFrom?.name || '');
                            setArrivalCity(trip.stationTo?.name || '');
                        }
                    }
                } else {
                    // Ajouter les nouveaux éléments à la liste existante SANS EFFACER LES PRÉCÉDENTS
                    setBookings(prev => {
                        // Éviter les doublons en vérifiant les IDs ou codes
                        const existingKeys = new Set(prev.map(b => b.id || b.code));
                        const newBookings = data.items.filter(b => {
                            const key = b.id || b.code;
                            return key && !existingKeys.has(key);
                        });
                        return [...prev, ...newBookings];
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
                    setBookings([]);
                }
                setHasMore(false);
            }
        } catch (err: any) {
            console.error('Erreur lors du chargement des réservations:', err);
            setError('Impossible de charger les réservations. Veuillez réessayer.');
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
    }, [pageSize, params.departureId, clearAuthData]);

    /**
     * Gère le pull-to-refresh
     */
    const onRefresh = useCallback(() => {
        setCurrentPage(1);
        setHasMore(true);
        loadBookings(1, true);
    }, [loadBookings]);

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
            loadBookings(nextPage, false);
        }
    }, [currentPage, hasMore, loadingMore, loading, refreshing, loadBookings, totalPages]);

    /**
     * Charge les réservations au montage du composant
     */
    useEffect(() => {
        setCurrentPage(1);
        setHasMore(true);
        loadBookings(1, false);
    }, [loadBookings]);

    /**
     * Gère le clic sur une réservation
     */
    const handleBookingPress = useCallback((booking: ApiBooking) => {
        // Formater les données pour correspondre au format attendu par booking-details
        const bookingData = {
            booking: booking,
        };

        router.push({
            pathname: '/booking-details',
            params: {
                bookingData: JSON.stringify(bookingData),
                departureTrips: JSON.stringify(departureTrips),
            },
        });
    }, []);

    /**
     * Rend un élément de la liste
     */
    const renderItem = useCallback(({ item }: { item: ApiBooking }) => {
        const statusColor = getStatusColor(item.status, isDark);
        const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
        const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
        const secondaryTextColor = isDark ? '#9BA1A6' : '#666666';
        const labelTextColor = isDark ? '#9BA1A6' : '#999999';
        const borderColor = isDark ? '#3A3A3C' : '#E0E0E0';
        const separatorColor = isDark ? '#3A3A3C' : '#E5E5E5';
        

        return (
            <TouchableOpacity
                style={[
                    styles.bookingCard,
                    {
                        backgroundColor: cardBackgroundColor,
                        borderColor: borderColor,
                    },
                ]}
                onPress={() => handleBookingPress(item)}
                activeOpacity={0.7}
            >
                {/* En-tête de la carte */}
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                        <ThemedText style={[styles.bookingCode, { color: primaryTextColor }]}>
                            {item.code || '--'}
                        </ThemedText>
                        <ThemedText style={[styles.bookingType, { color: secondaryTextColor }]}>
                            {getTripTypeLabel(item.type || item.tripType)}
                        </ThemedText>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status, isDark) + '20' }]}>
                        <ThemedText style={[styles.statusText, { color: getStatusColor(item.status, isDark) }]}>
                            {getStatusLabel(item.status)}
                        </ThemedText>
                    </View>
                </View>

                {/* Séparateur */}
                <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                {/* Informations essentielles */}
                <View style={styles.departureInfo}>
                    {/* Date et heure de départ */}
                    {(item.departureDateTime || item.departure?.departureDateTime) && (
                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: labelTextColor }]}>
                                Départ
                            </Text>
                            <Text style={[styles.infoValue, { color: primaryTextColor }]}>
                                {formatDate(item.departureDateTime || item.departure?.departureDateTime)}
                                {' à '}
                                {item.departureTime || formatTime(item.departureDateTime || item.departure?.departureDateTime)}
                            </Text>
                        </View>
                    )}

                    {/* Montant total */}
                    {item.totalAmount && (
                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: labelTextColor }]}>
                                Montant
                            </Text>
                            <Text style={[styles.infoValue, { color: primaryTextColor }]}>
                                {formatAmount(item.totalAmount, item.currency)}
                            </Text>
                        </View>
                    )}

                    {/* Nombre de passagers/items */}
                    {((item.passengers && item.passengers.length > 0) || (item.items && item.items.length > 0) || item.summary?.totalItems) && (
                        <View style={styles.infoRow}>
                            <ThemedText style={[styles.infoLabel, { color: labelTextColor }]}>
                                Passagers
                            </ThemedText>
                            <ThemedText style={[styles.infoValue, { color: primaryTextColor }]}>
                                {item.passengers?.length || item.items?.length || item.summary?.totalItems || 0}
                            </ThemedText>
                        </View>
                    )}
                </View>

            </TouchableOpacity>
        );
    }, [isDark, handleBookingPress]);

    /**
     * Extrait la clé unique pour chaque élément de la liste
     */
    const keyExtractor = useCallback((item: ApiBooking, index: number) => {
        return item.id || item.code || `booking-${index}`;
    }, []);

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
        if (loading || refreshing) {
            return (
                <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F3F3F7' }]}>
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Chargement des réservations...</Text>
                    </View>
                </View>
            );
        }

        if (error) {
            return (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            );
        }

        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Aucune réservation disponible</Text>
            </View>
        );
    };

    const backgroundColor = isDark ? '#000000' : '#F3F3F7';
    const headerBackgroundColor = isDark ? '#000000' : '#F3F3F7';
    const secondaryTextColor = isDark ? '#9BA1A6' : '#666666';

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
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>Réservations</Text>
                        {(departureCity || arrivalCity) && (
                            <Text style={[styles.routeInfo, { color: secondaryTextColor }]}>
                                {departureCity || '--'} → {arrivalCity || '--'}
                            </Text>
                        )}
                    </View>
                    <View style={styles.backButton} />
                </View>
            </ThemedView>

            {/* Liste avec pagination et pull-to-refresh */}
            <FlatList
                data={bookings}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                initialNumToRender={10}
                windowSize={10}
                contentContainerStyle={[
                    bookings.length === 0 && !loading && !refreshing
                        ? styles.emptyContainer
                        : styles.contentContainer,
                    (loading || refreshing) && bookings.length === 0 && styles.contentContainerLoading
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
                onEndReachedThreshold={0.2}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderFooter}
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
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontFamily: 'Ubuntu_Bold',
        textAlign: 'center',
    },
    routeInfo: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
        marginTop: 4,
        textAlign: 'center',
    },
    contentContainer: {
        padding: 16,
        paddingTop: 8,
    },
    contentContainerLoading: {
        flexGrow: 1,
        minHeight: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        flex: 1,
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
        flexDirection: 'row',
    },
    footerLoaderText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        marginLeft: 8,
    },
    bookingCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardHeaderLeft: {
        flex: 1,
        paddingVertical: 8,
    },
    bookingCode: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 4,
    },
    bookingType: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Bold',
    },
    separator: {
        height: 1,
        width: '100%',
        marginVertical: 12,
    },
    departureInfo: {
        marginBottom: 8,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    infoLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    infoValue: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
    },
    summaryInfo: {
        marginBottom: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 8,
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    cardFooter: {
        alignItems: 'flex-end',
        marginTop: 8,
    },
    inlineStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    inlineStatusText: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Bold',
    },
    itemsInfo: {
        marginTop: 8,
    },
    itemsTitle: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 8,
    },
    itemRow: {
        marginBottom: 4,
    },
    itemText: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Regular',
    },
    itemMore: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
        fontStyle: 'italic',
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 8,
    },
});

