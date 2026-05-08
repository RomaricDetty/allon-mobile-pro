import { processScanApi } from '@/api/departures';
import { Departure } from '@/components/departure-card';
import { ActionButtons } from '@/components/departure-details/ActionButtons';
import { CompanyInfo } from '@/components/departure-details/CompanyInfo';
import { DepartureDetailsSection } from '@/components/departure-details/DepartureDetailsSection';
import { DepartureHeader } from '@/components/departure-details/DepartureHeader';
import { RouteVisualization } from '@/components/departure-details/RouteVisualization';
import { SearchModal } from '@/components/departure-details/SearchModal';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { styles } from '@/styles/departureDetails';
import { departureEventEmitter } from '@/utils/departure-events';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';


export default function DepartureDetailsScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const params = useLocalSearchParams<{ departure: string }>();

    // Parse les données du départ initiales depuis les paramètres
    const initialDeparture = useMemo<Departure | null>(() => {
        try {
            if (params.departure) {
                console.log('params.departure ===> ', params.departure);
                return JSON.parse(params.departure) as Departure;
            }
        } catch (error) {
            console.error('Erreur lors du parsing des données du départ:', error);
        }
        return null;
    }, [params.departure]);

    // État local pour le départ (mis à jour via les événements)
    const [departure, setDeparture] = useState<Departure | null>(initialDeparture);

    // Mettre à jour l'état local quand le départ initial change
    useEffect(() => {
        setDeparture(initialDeparture);
        const checkUserRole = async () => {
            const userRole = await AsyncStorage.getItem('user_role');
            setUserRole(userRole?.toUpperCase());
            console.log('userRole ===>, ', userRole);
        };
        checkUserRole();
    }, [initialDeparture]);

    // Écouter les événements de mise à jour de statut
    useEffect(() => {
        if (!departure?.id) return;

        const unsubscribe = departureEventEmitter.onStatusUpdate((event) => {
            // Mettre à jour si c'est le même départ
            if (event.departureId === departure.id) {
                if (event.departure) {
                    // Utiliser les données complètes si disponibles
                    setDeparture(event.departure);
                } else {
                    // Sinon, mettre à jour uniquement le statut
                    setDeparture((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            status: event.newStatus,
                        };
                    });
                }
            }
        });

        return unsubscribe;
    }, [departure?.id]);

    // Si aucune donnée n'est disponible, retourner à l'écran précédent
    if (!departure) {
        router.back();
        return null;
    }

    // Couleurs pour le mode clair et sombre
    const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
    const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
    const secondaryTextColor = isDark ? '#9BA1A6' : '#666666';
    const labelTextColor = isDark ? '#9BA1A6' : '#999999';
    const borderColor = isDark ? '#3A3A3C' : '#E0E0E0';
    const separatorColor = isDark ? '#3A3A3C' : '#E5E5E5';
    const buttonBackgroundColor = '#1776BA';
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [ticketReference, setTicketReference] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [userRole, setUserRole] = useState<string | undefined>(undefined);

    /**
     * Nettoie les données d'authentification stockées
     */
    const clearAuthData = useCallback(async () => {
        await AsyncStorage.multiRemove([
            'token',
            'refresh_token',
            'expires_at',
            'token_type',
            'user_id',
            'user_role',
            'company_id',
        ]);
    }, []);

    /**
     * Gère le retour à l'écran précédent
     */
    const handleBack = () => {
        router.back();
    };

    /**
     * Gère l'action du bouton de démarrage du trajet
     * Redirige directement vers l'écran de suivi de trajet après vérification des permissions
     */
    const handleStartTraject = async () => {
        try {
            const userRole = await AsyncStorage.getItem('user_role');
            console.log('userRole ===>, ', userRole);

            if (userRole?.toUpperCase() !== 'DRIVER' && userRole?.toUpperCase() !== 'DEPARTURE_SUPERVISOR') {
                Alert.alert('Erreur', 'Vous n\'avez pas les permissions requises pour démarrer le départ.');
                return;
            }

            // Redirige vers l'écran de suivi de trajet
            // Route track-route-mapbox : pathname forcé car typed routes peut ne pas l’inclure encore
            router.push({
                pathname: '/track-route-mapbox' as '/track-route',
                params: {
                    departure: JSON.stringify(departure),
                },
            });
        } catch (error) {
            console.error('Erreur lors du démarrage du trajet:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors du démarrage du départ. Veuillez réessayer.');
        }
    };

    /**
     * Gère l'action du bouton de scan QR - affiche un menu avec deux options
     */
    const handleScanQR = () => {
        Alert.alert(
            'Validation de réservation',
            'Choisissez une méthode de validation pour ce trajet.',
            [
                {
                    text: 'Scanner un QR Code',
                    onPress: () => {
                        router.push({
                            pathname: '/scan-qr',
                            params: {
                                departure: JSON.stringify(departure),
                            },
                        });
                    },
                },
                {
                    text: 'Rechercher par référence',
                    onPress: () => {
                        setShowSearchModal(true);
                    },
                },
                {
                    text: 'Annuler',
                    style: 'cancel',
                },
            ],
            { cancelable: true }
        );
    };

    /**
     * Recherche un ticket par référence manuellement
     */
    const handleSearchByReference = async () => {
        if (!ticketReference.trim()) {
            Alert.alert('Erreur', 'Veuillez saisir une référence de ticket.');
            return;
        }

        setIsSearching(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const companyId = await AsyncStorage.getItem('company_id');
            if (!token || !companyId) {
                Alert.alert('Erreur', 'Session expirée. Veuillez vous reconnecter.');
                await clearAuthData();
                router.replace('/login');
                return;
            }

            let departure: any = null;
            try {
                if (params.departure) {
                    departure = JSON.parse(params.departure);
                }
            } catch (error) {
                console.error('[PROCESS] Erreur lors du parsing du départ:', error);
            }

            // Récupération de l'ID du départ depuis la réponse
            const departureId = departure?.id;

            const qrCodeData = {
                t: "b",
                c: ticketReference.trim(),
                cid: companyId,
                did: departureId
            }

            const response = await processScanApi(qrCodeData, token);
            setShowSearchModal(false);
            setTicketReference('');

            router.push({
                pathname: '/scan-result',
                params: {
                    bookingData: JSON.stringify(response.data),
                },
            });

        } catch (error: any) {
            console.error('Erreur lors de la recherche par référence : ', error.response?.data);
            Alert.alert(
                'Erreur',
                error.response?.data?.message || 'Impossible de trouver la réservation. Vérifiez la référence saisie.'
            );
        } finally {
            setIsSearching(false);
        }
    };

    /**
     * Ferme le modal de recherche
     */
    const handleCloseSearchModal = () => {
        if (!isSearching) {
            setShowSearchModal(false);
            setTicketReference('');
        }
    };

    /**
     * Affiche la liste des réservations pour un départ
     * @param departure - Les données du départ
     */
    const handleShowListReservations = async (departure: Departure) => {
        if (!departure?.id) {
            Alert.alert('Erreur', 'ID du départ manquant.');
            return;
        }

        router.push({
            pathname: '/bookings',
            params: {
                departureId: departure.id,
                departureTrips: JSON.stringify(departure.trips),
            },
        });
    };

    // Détermine si on doit afficher le bouton de démarrage du trajet
    const showStartTrajectButton = userRole?.toUpperCase() === 'DRIVER' || userRole?.toUpperCase() === 'DEPARTURE_SUPERVISOR';

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F3F3F7' }]}>
            <DepartureHeader onBack={handleBack} isDark={isDark} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: cardBackgroundColor,
                            borderColor: borderColor,
                        },
                    ]}
                >
                    <CompanyInfo departure={departure} primaryTextColor={primaryTextColor} />

                    <RouteVisualization
                        departure={departure}
                        borderColor={borderColor}
                        cardBackgroundColor={cardBackgroundColor}
                        primaryTextColor={primaryTextColor}
                        secondaryTextColor={secondaryTextColor}
                    />

                    <DepartureDetailsSection
                        departure={departure}
                        separatorColor={separatorColor}
                        labelTextColor={labelTextColor}
                        primaryTextColor={primaryTextColor}
                        buttonBackgroundColor={buttonBackgroundColor}
                        isDark={isDark}
                        onShowListReservations={handleShowListReservations}
                    />

                </View>
            </ScrollView>

            {(departure.status?.toUpperCase() === 'SCHEDULED' ||
                departure.status?.toUpperCase() === 'BOARDING' ||
                departure.status?.toUpperCase() === 'DEPARTED' ||
                departure.status?.includes('Retard')) && (
                <ActionButtons
                    showStartTrajectButton={showStartTrajectButton}
                    isDark={isDark}
                    borderColor={borderColor}
                    primaryTextColor={primaryTextColor}
                    onScanQR={handleScanQR}
                    onStartTraject={handleStartTraject}
                />
            )}

            <SearchModal
                visible={showSearchModal}
                ticketReference={ticketReference}
                isSearching={isSearching}
                isDark={isDark}
                cardBackgroundColor={cardBackgroundColor}
                borderColor={borderColor}
                primaryTextColor={primaryTextColor}
                secondaryTextColor={secondaryTextColor}
                labelTextColor={labelTextColor}
                buttonBackgroundColor={buttonBackgroundColor}
                onClose={handleCloseSearchModal}
                onSearch={handleSearchByReference}
                onReferenceChange={setTicketReference}
            />
        </View>
    );
}