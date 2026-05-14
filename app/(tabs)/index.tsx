import { refreshTokenApi } from '@/api/auth_login';
import { getUserDeparturesApi } from '@/api/departures';
import { Departure, DepartureCard } from '@/components/departure-card';
import { CustomDatePicker, FilterModal, HomeHeader, type DateFilterType } from '@/components/home';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDimensions } from '@/hooks/use-dimensions';
import { socketService } from '@/services';
import { styles } from '@/styles/homeScreen';
import { formatDateForApi, getDateRange } from '@/utils/date';
import { departureEventEmitter } from '@/utils/departure-events';
import { transformApiDepartureToDeparture, type ApiDeparture } from '@/utils/departure-utils';
import { logError } from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    RefreshControl,
    View
} from 'react-native';

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
 * Écran d'accueil affichant la liste des départs avec pagination et filtrage par date
 */
export default function HomeScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
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

            console.log('token ===> ', token);
            console.log('refreshToken ===> ', refreshToken);
            console.log('user_role ===> ', user_role);

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

            console.log('isTokenExpired ===> ', isTokenExpired);
            // Rafraîchir le token uniquement si nécessaire
            if (isTokenExpired) {
                try {
                    const response = await refreshTokenApi(refreshToken);
                    console.log('response refresh token ===> ', response);

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

                        try {
                            await socketService.refreshAuthSocketConnection();
                        } catch (socketErr) {
                            logError('[Home] Reconnexion socket après refresh token:', socketErr);
                        }

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
                console.log('token is valid ===> ');
                console.log('user_role ===> ', user_role);
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
            console.log('loadDepartures ===> ');
            console.log('page ===> ', page);
            console.log('isRefresh ===> ', isRefresh);
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

            console.log('token ===> ', token);
            console.log('userId ===> ', userId);
            console.log('userRole ===> ', userRole);

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

            console.log('queryParams ===> ', queryParams);

            const response = await getUserDeparturesApi(queryParams, token);
            console.log('response loading departures trips ===> ', JSON.stringify(response.data.items[0]?.trips));
            const data: PaginatedResponse = response.data;

            console.log('data received ==>', data);
            console.log('data.items ===> ', data.items[0].bus);

            if (data?.items && Array.isArray(data.items)) {
                const transformedDepartures = data.items.map(transformApiDepartureToDeparture) as Departure[];

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
     * Vérifie la session au chargement, puis charge les départs uniquement si la session est valide.
     * Garantit l'ordre : checkUserSession terminé → ensuite loadDepartures.
     */
    useEffect(() => {
        const verifySession = async () => {
            const isValid = await checkUserSession();
            console.log('isValid ===> ', isValid);
            setIsSessionValid(isValid);
            if (isValid) {
                setCurrentPage(1);
                setHasMore(true);
                loadDepartures(1, false);
            }
        };
        verifySession();
    }, [checkUserSession]);

    /**
     * Recharge les départs quand le filtre de date ou les dates custom changent (session déjà valide).
     * isSessionValid / isCheckingSession volontairement exclus des deps pour éviter un double chargement au montage.
     */
    useEffect(() => {
        if (isCheckingSession || !isSessionValid) return;
        if (dateFilter === 'custom' && !customDatesReady) return;

        setCurrentPage(1);
        setHasMore(true);
        loadDepartures(1, false);
    }, [dateFilter, customDatesReady, loadDepartures]);

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
        if (selectedDate) {
            setCustomDateFrom(selectedDate);
            // Sur Android, ouvrir automatiquement le sélecteur de date de fin
            if (Platform.OS === 'android') {
                setTimeout(() => setShowDatePickerTo(true), 100);
            }
        }
    };

    /**
     * Gère la confirmation de la date de début sur iOS
     */
    const handleCustomDateFromConfirm = (date: Date) => {
        setCustomDateFrom(date);
        setTimeout(() => setShowDatePickerTo(true), 100);
    };

    /**
     * Gère la sélection d'une date de fin personnalisée
     * Déclenche le chargement une fois les deux dates sélectionnées
     */
    const handleCustomDateToSelect = (event: any, selectedDate?: Date) => {
        if (selectedDate) {
            setCustomDateTo(selectedDate);
            // Marquer les dates comme prêtes et déclencher le chargement
            setCustomDatesReady(true);
        }
    };

    /**
     * Gère la confirmation de la date de fin sur iOS
     */
    const handleCustomDateToConfirm = (date: Date) => {
        setCustomDateTo(date);
        // Marquer les dates comme prêtes et déclencher le chargement
        setCustomDatesReady(true);
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
                return 'Tous les départs';
        }
    };

    /**
     * Gère le clic sur le bouton ticket
     */
    const handleTicketPress = useCallback((departureId: string) => {
        Alert.alert('Ticket', `Voir le ticket pour le trajet ${departureId}`);
    }, []);

    /**
     * Gère le clic sur l'icône de carte
     */
    const handleMapPress = useCallback((departureId: string) => {
        Alert.alert('Carte', `Voir la carte pour le trajet ${departureId}`);
    }, []);

    /**
     * Rend un élément de la liste
     */
    const renderItem = useCallback(
        ({ item }: { item: Departure }) => (
            console.log('item departure render card ===> ', item),
            <DepartureCard
                departure={item}
                onTicketPress={() => handleTicketPress(item.id)}
                onMapPress={() => handleMapPress(item.id)}
            />
        ),
        [handleTicketPress, handleMapPress]
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
                    <ThemedText style={styles.loadingText}>Chargement de vos départs...</ThemedText>
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
                <ThemedText style={styles.emptyText}>Aucun départ disponible</ThemedText>
            </View>
        );
    };

    /**
     * Options de filtre mémorisées
     */
    const filterOptions = useMemo<{ type: DateFilterType; label: string }[]>(
        () => [
            { type: 'all', label: 'Tous les départs' },
            { type: 'today', label: "Aujourd'hui" },
            { type: 'thisWeek', label: 'Cette semaine' },
            { type: 'thisMonth', label: 'Ce mois' },
            { type: 'thisYear', label: 'Cette année' },
            { type: 'custom', label: 'Date spécifique' },
        ],
        []
    );


    const backgroundColor = isDark ? '#000000' : '#F3F3F7';

    // Si la session n'est pas valide, ne rien afficher (redirection en cours)
    if (!isSessionValid) {
        return <View style={[styles.container, { backgroundColor }]} />;
    }

    return (
        <View style={[styles.container, { backgroundColor }]}>
            {/* Header fixe */}
            <HomeHeader
                filterLabel={getFilterLabel()}
                hasActiveFilter={dateFilter !== 'all'}
                onFilterPress={() => setShowFilterModal(true)}
                onLayout={setHeaderHeight}
            />

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
                style={{ flex: 1, paddingBottom: 100 }}
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
            <FilterModal
                visible={showFilterModal}
                dateFilter={dateFilter}
                filterOptions={filterOptions}
                onClose={() => setShowFilterModal(false)}
                onFilterChange={handleDateFilterChange}
                onReset={handleResetFilter}
            />

            {/* DatePicker pour date personnalisée - Date de début */}
            <CustomDatePicker
                visible={showDatePickerFrom}
                value={customDateFrom}
                mode="from"
                maximumDate={new Date()}
                title="Sélectionner la date de début"
                onClose={() => setShowDatePickerFrom(false)}
                onConfirm={handleCustomDateFromConfirm}
                onDateChange={handleCustomDateFromSelect}
            />

            {/* DatePicker pour date personnalisée - Date de fin */}
            <CustomDatePicker
                visible={showDatePickerTo}
                value={customDateTo}
                mode="to"
                minimumDate={customDateFrom}
                maximumDate={new Date()}
                title="Sélectionner la date de fin"
                onClose={() => setShowDatePickerTo(false)}
                onConfirm={handleCustomDateToConfirm}
                onDateChange={handleCustomDateToSelect}
            />
        </View>
    );
}
