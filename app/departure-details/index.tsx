import { processScanApi } from '@/api/departures';
import { Departure } from '@/components/departure-card';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { departureEventEmitter } from '@/utils/departure-events';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Génère une couleur pour le cercle de la compagnie basée sur le nom
 */
const getCompanyColor = (companyName?: string): string => {
    if (!companyName) return '#8B4513';
    const colors = ['#8B4513', '#1776BA', '#2E7D32', '#C62828', '#6A1B9A', '#F57C00'];
    const index = companyName.length % colors.length;
    return colors[index];
};

/**
 * Extrait les initiales d'une compagnie pour le logo
 */
const getCompanyInitials = (companyName?: string): string => {
    if (!companyName) return 'C';
    const words = companyName.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return companyName.substring(0, 2).toUpperCase();
};

/**
 * Nettoie le nom d'une station en supprimant "Gare" et "GAR"
 */
const cleanStationName = (stationName?: string): string => {
    if (!stationName) return '';
    return stationName
        .replace(/Gare\s*/gi, '')
        .replace(/GAR\s*/gi, '')
        .trim().toUpperCase();
};

/**
 * Écran de détails d'un trajet
 * Affiche toutes les informations d'un départ dans un format de carte d'embarquement
 */
export default function DepartureDetailsScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ departure: string }>();

    // Parse les données du départ initiales depuis les paramètres
    const initialDeparture = useMemo<Departure | null>(() => {
        try {
            if (params.departure) {
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
    const headerBackgroundColor = isDark ? '#1A1A1A' : '#1776BA';
    const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
    const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
    const secondaryTextColor = isDark ? '#9BA1A6' : '#666666';
    const labelTextColor = isDark ? '#9BA1A6' : '#999999';
    const borderColor = isDark ? '#3A3A3C' : '#E0E0E0';
    const separatorColor = isDark ? '#3A3A3C' : '#E5E5E5';
    const buttonBackgroundColor = '#1776BA';
    const busIconColor = '#1776BA';
    const companyColor = getCompanyColor(departure.company);
    const companyInitials = getCompanyInitials(departure.company);

    // TCK-1767027042482

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
            
            if (userRole?.toUpperCase() !== 'DRIVER' && userRole?.toUpperCase() !== 'SUPERVISOR') {
                Alert.alert('Erreur', 'Vous n\'avez pas les permissions requises pour démarrer le trajet.');
                return;
            }

            // Redirige vers l'écran de suivi de trajet
            router.push({
                pathname: '/track-route',
                params: {
                    departure: JSON.stringify(departure),
                },
            });
        } catch (error) {
            console.error('Erreur lors du démarrage du trajet:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors du démarrage du trajet. Veuillez réessayer.');
        }
    };

    /**
     * Gère l'action du bouton d'options
    */
    const handleOptions = () => {
        // TODO: Implémenter le menu d'options
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
     * Tableau de correspondance des statuts techniques vers des libellés français
    */
    const STATUS_MAPPING: Record<string, string> = {
        'SCHEDULED': 'Programmé',
        'ON_TIME': 'À l\'heure',
        'DELAYED': 'Retardé',
        'CANCELLED': 'Annulé',
        'BOARDING': 'En embarquement',
        'DEPARTED': 'Parti',
        'ARRIVED': 'Arrivé',
        'IN_TRANSIT': 'En transit',
        'COMPLETED': 'Terminé',
        'PENDING': 'En attente',
        'CONFIRMED': 'Confirmé',
        'AVAILABLE': 'Disponible',
        'FULL': 'Complet',
        'CLOSED': 'Fermé',
    };

    /**
     * Tableau de correspondance des statuts techniques vers des couleurs
    */
    const STATUS_COLOR_MAPPING: Record<string, { light: string; dark: string }> = {
        'SCHEDULED': { light: '#1776BA', dark: '#1776BA' }, // Bleu
        'ON_TIME': { light: '#34C759', dark: '#30D158' }, // Vert
        'DELAYED': { light: '#FF9500', dark: '#FF9F0A' }, // Orange
        'CANCELLED': { light: '#FF3B30', dark: '#FF453A' }, // Rouge
        'BOARDING': { light: '#5856D6', dark: '#5E5CE6' }, // Violet
        'DEPARTED': { light: '#1776BA', dark: '#1776BA' }, // Bleu
        'ARRIVED': { light: '#34C759', dark: '#30D158' }, // Vert
        'IN_TRANSIT': { light: '#FF9500', dark: '#FF9F0A' }, // Orange
        'COMPLETED': { light: '#34C759', dark: '#30D158' }, // Vert
        'PENDING': { light: '#FF9500', dark: '#FF9F0A' }, // Orange
        'CONFIRMED': { light: '#34C759', dark: '#30D158' }, // Vert
        'AVAILABLE': { light: '#34C759', dark: '#30D158' }, // Vert
        'FULL': { light: '#FF3B30', dark: '#FF453A' }, // Rouge
        'CLOSED': { light: '#8E8E93', dark: '#98989D' }, // Gris
    };

    /**
     * Convertit un statut technique en libellé français lisible
     * @param status - Le statut technique (ex: "SCHEDULED")
     * @returns Le libellé français correspondant ou le statut original si non trouvé
    */
    const getStatusLabel = (status?: string): string => {
        if (!status) return '--';

        // Vérifie si le statut contient déjà un libellé formaté (ex: "Retard: 15min")
        if (status.includes('Retard:')) {
            return status;
        }

        // Convertit en majuscules pour la recherche insensible à la casse
        const upperStatus = status.toUpperCase();

        // Retourne le libellé correspondant ou le statut original
        return STATUS_MAPPING[upperStatus] || status;
    };

    /**
     * Récupère la couleur associée à un statut selon le thème
     * @param status - Le statut technique (ex: "SCHEDULED")
     * @param isDark - Indique si le thème est sombre
     * @returns La couleur correspondante ou une couleur par défaut
    */
    const getStatusColor = (status?: string, isDark: boolean = false): string => {
        if (!status) return isDark ? '#98989D' : '#8E8E93';

        // Pour les statuts avec formatage spécial (ex: "Retard: 15min")
        if (status.includes('Retard:')) {
            return isDark ? '#FF9F0A' : '#FF9500';
        }

        // Convertit en majuscules pour la recherche insensible à la casse
        const upperStatus = status.toUpperCase();
        const colorMapping = STATUS_COLOR_MAPPING[upperStatus];

        // Retourne la couleur correspondante ou une couleur par défaut
        return colorMapping
            ? (isDark ? colorMapping.dark : colorMapping.light)
            : (isDark ? '#98989D' : '#8E8E93');
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
            },
        });
    };

    // Détermine si on doit afficher le bouton de démarrage du trajet
    const showStartTrajectButton = userRole?.toUpperCase() === 'DRIVER' || userRole?.toUpperCase() === 'SUPERVISOR';

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F3F3F7' }]}>
            {/* Barre de navigation / En-tête */}
            <View
                style={[
                    styles.header,
                    {
                        backgroundColor: headerBackgroundColor,
                        paddingTop: insets.top + 8,
                        paddingBottom: 16,
                    },
                ]}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={[styles.headerButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
                        onPress={handleBack}
                    >
                        <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>

                    <ThemedText style={[styles.headerTitle, { color: '#FFFFFF' }]}>
                        Détails du trajet
                    </ThemedText>

                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Carte principale */}
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: cardBackgroundColor,
                            borderColor: borderColor,
                        },
                    ]}
                >
                    {/* Section supérieure : Compagnie et type de véhicule */}
                    <View style={styles.topSection}>
                        <View style={styles.companyInfo}>
                            <View style={styles.companyTextContainer}>
                                <ThemedText style={[styles.companyName, { color: primaryTextColor }]}>
                                    {departure.company || 'Compagnie'}
                                </ThemedText>
                                <ThemedText style={[styles.busType, { color: primaryTextColor }]}>
                                    {departure.busType?.charAt(0).toUpperCase() + (departure.busType?.slice(1) || '') || departure.line?.charAt(0).toUpperCase() + (departure.line?.slice(1) || '') || 'Bus'}
                                </ThemedText>
                                <ThemedText style={[styles.busLicensePlate, { color: primaryTextColor }]}>{departure.busLicensePlate}</ThemedText>
                            </View>
                        </View>
                    </View>

                    {/* Section médiane : Détails du trajet */}
                    <View style={[styles.middleSection]}>
                        {/* Conteneur de l'itinéraire */}
                        <View style={styles.routeVisualization}>
                            {/* Point de départ - en haut centré */}
                            <View style={[
                                {
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'row',
                                    gap: 10,
                                    // width: '100%',
                                }
                            ]}>
                                <View style={[styles.routePointCircle, { backgroundColor: 'green', borderColor: borderColor }]}>
                                    <MaterialIcons name="location-on" size={16} color="#FFFFFF" />
                                </View>
                                <View style={[styles.routePointContentCenter, { alignItems: 'flex-start' }]}>
                                    <ThemedText style={[styles.cityNameCenter, { color: primaryTextColor }]}>
                                        {departure.departureCity?.toUpperCase() || 'Ville'}
                                    </ThemedText>
                                    {departure.departureStationName && (
                                        <ThemedText style={[styles.stationDetailsCenter, { color: secondaryTextColor }]}>
                                            {departure.departureStationName}
                                        </ThemedText>
                                    )}
                                    <ThemedText style={[styles.timeCenter, { color: primaryTextColor }]}>
                                        {departure.departureTime || '--:--'}
                                    </ThemedText>
                                </View>
                            </View>

                            {/* Point central - Bus et durée - au milieu */}
                            <View style={styles.routePointCenter}>
                                <View style={[styles.busIconContainer, { borderColor: borderColor, backgroundColor: cardBackgroundColor }]}>
                                    <MaterialIcons name="arrow-downward" size={28} color={'#1776BA'} />
                                </View>
                                <View style={styles.routePointContent}>
                                    <ThemedText style={[styles.duration, { color: secondaryTextColor }]}>
                                        {departure.duration || '--'}
                                    </ThemedText>
                                </View>
                            </View>

                            {/* Point d'arrivée - en bas centré */}
                            <View style={styles.routePointArrival}>
                                <View style={[styles.routePointCircle, { backgroundColor: '#b81414', borderColor: borderColor }]}>
                                    <MaterialIcons name="location-on" size={16} color="#FFFFFF" />
                                </View>
                                <View style={[styles.routePointContentCenter, { alignItems: 'flex-start' }]}>
                                    <ThemedText style={[styles.cityNameCenter, { color: primaryTextColor }]}>
                                        {departure.arrivalCity?.toUpperCase() || 'Ville'}
                                    </ThemedText>
                                    {departure.arrivalStationName && (
                                        <ThemedText style={[styles.stationDetailsCenter, { color: secondaryTextColor }]}>
                                            {departure.arrivalStationName}
                                        </ThemedText>
                                    )}
                                    <ThemedText style={[styles.timeCenter, { color: primaryTextColor }]}>
                                        {departure.arrivalTime || '--:--'}
                                    </ThemedText>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Section inférieure : Détails du passager et du billet */}
                    <View style={[styles.bottomSection, { borderTopColor: separatorColor }]}>

                        {/* Date */}
                        <View style={styles.detailRow}>
                            <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                Date
                            </ThemedText>
                            <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                {departure.date || departure.departureDate || '--'}
                            </ThemedText>
                        </View>

                        {/* Séparateur */}
                        <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                        {/* Classe et Terminal */}
                        <View style={styles.detailRowTwoColumns}>
                            <View style={styles.detailColumn}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                    Classe
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                    {departure.busType?.split(' ')[0]?.toUpperCase() || departure.line?.split(' ')[0]?.toUpperCase() || 'BUS'}
                                </ThemedText>
                            </View>
                            <View style={[styles.detailColumn, { alignItems: 'flex-end' }]}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor, textAlign: 'center' }]}>
                                    Vehicule
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor, textAlign: 'center' }]}>
                                    {departure.busType?.split(' ')[1]?.toUpperCase() || departure.line?.split(' ')[1]?.toUpperCase() || 'BUS'}
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor, textAlign: 'center' }]}>
                                    {departure.busLicensePlate || 'N/A'}
                                </ThemedText>
                            </View>
                        </View>

                        {/* Séparateur */}
                        <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                        {/* Siège et Porte */}
                        <View style={styles.detailRowTwoColumns}>
                            <View style={styles.detailColumn}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                    Siège
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                    {departure.seatsAvailable !== undefined ? `${departure.seatsAvailable} disponibles` : 'N/A'}
                                </ThemedText>
                            </View>
                            <View style={[styles.detailColumn, { alignItems: 'flex-end' }]}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor, textAlign: 'center' }]}>
                                    Statut
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: getStatusColor(departure.status) }]}>
                                    {getStatusLabel(departure.status) || 'N/A'}
                                </ThemedText>
                            </View>
                        </View>

                        {/* Prix si disponible */}
                        {departure.price && (
                            <>
                                <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                                <View style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                        Prix
                                    </ThemedText>
                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                        {departure.price}
                                    </ThemedText>
                                </View>
                            </>
                        )}

                        {/* Informations supplémentaires */}
                        {departure.seatsBooked !== undefined && (
                            <>
                                <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                                <View style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                        Sièges réservés
                                    </ThemedText>
                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                        {departure.seatsBooked}
                                    </ThemedText>
                                </View>
                            </>
                        )}

                        {/* Gare de départ */}
                        {departure.departureStationName && (
                            <>
                                <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                                <View style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                        Gare de départ
                                    </ThemedText>
                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                        {departure.departureStationName}
                                    </ThemedText>
                                </View>
                            </>
                        )}

                        {/* Gare d'arrivée */}
                        {departure.arrivalStationName && (
                            <>
                                <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                                <View style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                        Gare d'arrivée
                                    </ThemedText>
                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                        {departure.arrivalStationName}
                                    </ThemedText>
                                </View>
                            </>
                        )}

                        {/* Voir la liste des réservations */}
                        <>
                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                            <View style={styles.detailRow}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                    La liste des réservations
                                </ThemedText>
                                <Pressable
                                    disabled={departure.seatsBooked === 0}
                                    style={{
                                        backgroundColor: departure.seatsBooked === 0 ? (isDark ? '#3A3A3C' : '#CCCCCC') : buttonBackgroundColor,
                                        paddingHorizontal: 10,
                                        paddingVertical: 5,
                                        borderRadius: 10,
                                        opacity: departure.seatsBooked === 0 ? 0.5 : 1
                                    }}
                                    onPress={() => handleShowListReservations(departure)}
                                >
                                    <ThemedText style={[styles.detailValue, { color: departure.seatsBooked === 0 ? (isDark ? '#666666' : '#999999') : "#FFFFFF", fontSize: 13 }]}>
                                        Voir la liste
                                    </ThemedText>
                                </Pressable>
                            </View>
                        </>
                    </View>
                </View>
            </ScrollView>

            {/* Boutons d'action - affichés uniquement si le statut est SCHEDULED */}
            {
                (
                    departure.status?.toUpperCase() === 'SCHEDULED' ||
                    departure.status?.toUpperCase() === 'BOARDING' ||
                    departure.status?.toUpperCase() === 'DEPARTED' ||
                    departure.status?.includes('Retard')
                )
                && (
                    <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 16 }]}>
                        <View style={styles.buttonsRow}>
                            <TouchableOpacity
                                style={[styles.scanButton, { backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF', borderColor: borderColor }]}
                                onPress={handleScanQR}
                            >
                                <MaterialIcons name="check-circle" size={24} color={primaryTextColor} />
                                <ThemedText style={[styles.scanButtonText, { color: primaryTextColor }]}>Validation</ThemedText>
                            </TouchableOpacity>
                            {showStartTrajectButton && (
                                <TouchableOpacity
                                    style={[styles.downloadButton, { backgroundColor: "#1776BA" }]}
                                    onPress={handleStartTraject}
                                >
                                    <MaterialIcons name="directions-bus-filled" size={24} color="#FFFFFF" />
                                    <ThemedText style={[styles.downloadButtonText, {}]}>Démarrer</ThemedText>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

            {/* Modal de recherche par référence */}
            <Modal
                visible={showSearchModal}
                transparent={true}
                animationType="slide"
                onRequestClose={handleCloseSearchModal}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={handleCloseSearchModal}
                    >
                        <Pressable
                            style={styles.modalContentWrapper}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <View style={[styles.modalContent, { backgroundColor: cardBackgroundColor }]}>
                                {/* En-tête du modal */}
                                <View style={styles.modalHeader}>
                                    <ThemedText style={[styles.modalTitle, { color: primaryTextColor }]}>
                                        Rechercher par référence
                                    </ThemedText>
                                    <TouchableOpacity
                                        onPress={handleCloseSearchModal}
                                        disabled={isSearching}
                                        style={styles.modalCloseButton}
                                    >
                                        <MaterialIcons name="close" size={24} color={primaryTextColor} />
                                    </TouchableOpacity>
                                </View>

                                {/* Contenu du modal avec ScrollView */}
                                <ScrollView
                                    style={styles.modalScrollView}
                                    contentContainerStyle={styles.modalScrollContent}
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={false}
                                >
                                    <View style={styles.modalBody}>
                                        <ThemedText style={[styles.modalLabel, { color: labelTextColor }]}>
                                            Référence du ticket
                                        </ThemedText>
                                        <View style={styles.inputContainer}>
                                            <TextInput
                                                style={[
                                                    styles.modalInput,
                                                    {
                                                        backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
                                                        borderColor: borderColor,
                                                        color: primaryTextColor,
                                                        paddingRight: ticketReference ? 45 : 16,
                                                    },
                                                ]}
                                                placeholder="Entrez la référence du ticket"
                                                placeholderTextColor={secondaryTextColor}
                                                value={ticketReference}
                                                onChangeText={setTicketReference}
                                                autoCapitalize="characters"
                                                autoCorrect={false}
                                                editable={!isSearching}
                                                returnKeyType="search"
                                                onSubmitEditing={handleSearchByReference}
                                            />
                                            {ticketReference.length > 0 && (
                                                <TouchableOpacity
                                                    style={[styles.clearButton,
                                                    {
                                                        backgroundColor: isDark ? '#3A3A3C' : '#CCCCCC',
                                                        width: 25, height: 25, borderRadius: 100,
                                                        borderWidth: 1, borderColor: borderColor,
                                                        justifyContent: 'center', alignItems: 'center',
                                                        top: '45%',
                                                    }]}
                                                    onPress={() => setTicketReference('')}
                                                    disabled={isSearching}
                                                >
                                                    <MaterialIcons name="close" size={14} color={secondaryTextColor} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        <ThemedText style={[styles.modalHint, { color: secondaryTextColor }]}>
                                            Saisissez le code de référence du ticket (ex: TCK-123456)
                                        </ThemedText>
                                    </View>
                                </ScrollView>

                                {/* Boutons du modal */}
                                <View style={styles.modalFooter}>
                                    <TouchableOpacity
                                        style={[styles.modalCancelButton, { borderColor: borderColor }]}
                                        onPress={handleCloseSearchModal}
                                        disabled={isSearching}
                                    >
                                        <ThemedText style={[styles.modalCancelButtonText, { color: primaryTextColor }]}>
                                            Annuler
                                        </ThemedText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.modalSearchButton,
                                            {
                                                backgroundColor: buttonBackgroundColor,
                                                opacity: isSearching ? 0.6 : 1,
                                            },
                                        ]}
                                        onPress={handleSearchByReference}
                                        disabled={isSearching || !ticketReference.trim()}
                                    >
                                        {isSearching ? (
                                            <ActivityIndicator color="#FFFFFF" />
                                        ) : (
                                            <>
                                                <MaterialIcons name="search" size={20} color="#FFFFFF" />
                                                <ThemedText style={styles.modalSearchButtonText}>Rechercher</ThemedText>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 15,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
        flex: 1,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 10,
    },
    card: {
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
    },
    // Section supérieure
    topSection: {
        marginBottom: 24,
    },
    companyInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    companyLogoCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    companyLogoText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
    },
    companyTextContainer: {
        flex: 1,
    },
    companyName: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
    },
    busType: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
    },
    busLicensePlate: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
    },
    // Section médiane
    middleSection: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        paddingVertical: 8,
    },
    /**
     * Conteneur de visualisation de l'itinéraire
     */
    routeVisualization: {
        // width: '100%',
        // height: 350,
        position: 'relative',
        // paddingHorizontal: 16,
        // paddingVertical: 20,
    },
    /**
     * Point de départ - positionné en haut centré
     */
    routePointDeparture: {
        alignItems: 'center',
        flexDirection: 'column',
        width: 200,
    },
    /**
     * Point central - Bus - positionné au milieu centré
     */
    routePointCenter: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    /**
     * Point d'arrivée - positionné en bas centré
     */
    routePointArrival: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
    },
    /**
     * Contenu du point centré
     */
    routePointContentCenter: {
        alignItems: 'center',
        justifyContent: 'center',
        // marginLeft: 10,
        // marginRight: 10,
        // flex: 1,
    },
    /**
     * Nom de la ville - centré
     */
    cityNameCenter: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 2,
        lineHeight: 22,
        textAlign: 'center',
    },
    /**
     * Détails de la station - centré
     */
    stationDetailsCenter: {
        fontSize: 11,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
        lineHeight: 15,
        textAlign: 'center',
    },
    /**
     * Heure - centré
     */
    timeCenter: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Bold',
        textAlign: 'center',
    },
    /**
     * Contenu du point de l'itinéraire
     */
    routePointContent: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    /**
     * Conteneur de connexion en escalier (départ vers bus)
     */
    routeConnectionStaircase: {
        position: 'absolute',
        top: 70,
        left: '45%',
        width: '20%',
        height: 70,
        zIndex: 5,
    },
    /**
     * Segment horizontal de la ligne en escalier
     */
    routeLineHorizontal: {
        position: 'absolute',
        top: 25,
        left: 0,
        width: '55%',
        height: 2,
        backgroundColor: '#666666',
    },
    /**
     * Segment vertical de la ligne en escalier
     */
    routeLineVertical: {
        position: 'absolute',
        top: 25,
        left: '55%',
        width: 2,
        height: 45,
        backgroundColor: '#666666',
    },
    /**
     * Conteneur de la flèche en escalier
     */
    routeArrowContainerStaircase: {
        position: 'absolute',
        bottom: 0,
        left: '55%',
        transform: [{ translateX: -7 }],
        alignItems: 'center',
        justifyContent: 'center',
    },
    /**
     * Conteneur de connexion en escalier (bus vers arrivée)
     */
    routeConnectionStaircaseRight: {
        position: 'absolute',
        bottom: 70,
        right: '45%',
        width: '20%',
        height: 70,
        zIndex: 5,
    },
    /**
     * Segment horizontal de la ligne en escalier vers l'arrivée
     */
    routeLineHorizontalRight: {
        position: 'absolute',
        bottom: 25,
        right: 0,
        width: '55%',
        height: 2,
        backgroundColor: '#666666',
    },
    /**
     * Segment vertical de la ligne en escalier vers l'arrivée
     */
    routeLineVerticalRight: {
        position: 'absolute',
        bottom: 25,
        right: '55%',
        width: 2,
        height: 45,
        backgroundColor: '#666666',
    },
    /**
     * Conteneur de la flèche en escalier vers l'arrivée
     */
    routeArrowContainerStaircaseRight: {
        position: 'absolute',
        top: 0,
        right: '55%',
        transform: [{ translateX: 7 }],
        alignItems: 'center',
        justifyContent: 'center',
    },
    /**
     * Cercle pour les points de départ et d'arrivée
     */
    routePointCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    /**
     * Nom de la ville - aligné à gauche
     */
    cityNameLeft: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 2,
        lineHeight: 22,
        textAlign: 'left',
    },
    /**
     * Nom de la ville - aligné à droite
     */
    cityNameRight: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 2,
        lineHeight: 22,
        textAlign: 'right',
    },
    /**
     * Détails de la station - aligné à gauche
     */
    stationDetailsLeft: {
        fontSize: 11,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
        lineHeight: 15,
        textAlign: 'left',
    },
    /**
     * Détails de la station - aligné à droite
     */
    stationDetailsRight: {
        fontSize: 11,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
        lineHeight: 15,
        textAlign: 'right',
    },
    /**
     * Heure - aligné à gauche
     */
    timeLeft: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Bold',
        textAlign: 'left',
    },
    /**
     * Heure - aligné à droite
     */
    timeRight: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Bold',
        textAlign: 'right',
    },
    stationContainer: {
        width: '100%',
        paddingHorizontal: 4,
    },
    stationContainerCentered: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrivalContainer: {
        alignItems: 'flex-end',
    },
    directionIconContainer: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    directionIconRight: {
        alignSelf: 'flex-end',
    },
    textRight: {
        textAlign: 'right',
    },
    pathContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    busIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    duration: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Regular',
        textAlign: 'center',
    },
    dottedLineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        width: '100%',
        marginTop: 4,
    },
    dottedLineDot: {
        width: 3,
        height: 1,
        borderRadius: 0.5,
    },
    // Section inférieure
    bottomSection: {
        paddingTop: 24,
        borderTopWidth: 1,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    detailRowTwoColumns: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        // borderWidth: 1,
        // borderColor: 'red',
    },
    detailColumn: {
        flex: 1,
        // borderWidth: 1,
        // borderColor: 'blue',
        // alignItems: 'center',
        justifyContent: 'space-between',
    },
    detailLabel: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    separator: {
        height: 1,
        width: '100%',
    },
    // Bouton d'action
    buttonContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    buttonsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    scanButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
        borderWidth: 1,
    },
    scanButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    downloadButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
    },
    downloadButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },

    // Styles pour le modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContentWrapper: {
        width: '100%',
        maxHeight: '90%',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: 'Ubuntu_Bold',
        flex: 1,
    },
    modalCloseButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalScrollView: {
        flexGrow: 0,
    },
    modalScrollContent: {
        flexGrow: 0,
    },
    modalBody: {
        marginBottom: 24,
    },
    modalLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
        marginBottom: 8,
    },
    inputContainer: {
        position: 'relative',
        marginBottom: 8,
    },
    modalInput: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
    },
    clearButton: {
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: [{ translateY: -10 }],
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalHint: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    modalCancelButton: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    modalSearchButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        paddingVertical: 14,
        gap: 8,
    },
    modalSearchButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
});
