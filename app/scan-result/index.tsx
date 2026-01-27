import { baseUrl } from '@/api/config';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { styles } from '@/styles/scan-result';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
/**
 * Interface pour les données de réservation
 */
interface BookingData {
    booking: {
        code: string;
        departure: {
            code: string;
            departureDateTime: string;
            id: string;
            status: string;
            trip: any;
        };
        id: string;
        items: any[];
        status: string;
        summary: {
            canValidateAll: boolean;
            paidItems: number;
            totalItems: number;
            usedItems: number;
        };
        tripType: string;
    };
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
            month: 'long',
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
 * Convertit le type de trajet en libellé français
 * @param tripType - Le type de trajet (ex: "ONE_WAY")
 * @returns Le libellé français
 */
const getTripTypeLabel = (tripType?: string): string => {
    if (!tripType) return '--';
    
    const TRIP_TYPE_MAPPING: Record<string, string> = {
        'ONE_WAY': 'Aller simple',
        'ROUND_TRIP': 'Aller-retour',
    };
    
    return TRIP_TYPE_MAPPING[tripType] || tripType;
};

/**
 * Convertit le type de leg en libellé français
 * @param leg - Le type de leg (ex: "OUTBOUND")
 * @returns Le libellé français
 */
const getLegLabel = (leg?: string): string => {
    if (!leg) return '--';
    
    const LEG_MAPPING: Record<string, string> = {
        'OUTBOUND': 'Aller',
        'INBOUND': 'Retour',
    };
    
    return LEG_MAPPING[leg.toUpperCase()] || leg;
};

/**
 * Convertit le type de passager en libellé français
 * @param passengerType - Le type de passager (ex: "adult")
 * @returns Le libellé français
 */
const getPassengerTypeLabel = (passengerType?: string): string => {
    if (!passengerType) return '--';
    
    const PASSENGER_TYPE_MAPPING: Record<string, string> = {
        'adult': 'Adulte',
        'child': 'Enfant',
        'senior': 'Senior',
        'student': 'Étudiant',
        'infant': 'Bébé',
    };
    
    return PASSENGER_TYPE_MAPPING[passengerType.toLowerCase()] || passengerType;
};

/**
 * Écran de résultat du scan QR
 * Affiche les détails de la réservation validée
 */
export default function ScanResultScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ bookingData: string }>();

    // État pour gérer les billets sélectionnés
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isValidating, setIsValidating] = useState(false);
    const [userRole, setUserRole] = useState<string | undefined>(undefined);

    // Parse les données de la réservation depuis les paramètres
    let bookingData: BookingData | null = null;
    try {
        if (params.bookingData) {
            bookingData = JSON.parse(params.bookingData) as BookingData;
            console.log('bookingData ===>, ', JSON.stringify(bookingData));
        }
    } catch (error) {
        console.error('Erreur lors du parsing des données de réservation:', error);
    }

    // Si aucune donnée n'est disponible, retourner à l'écran précédent
    if (!bookingData || !bookingData.booking) {
        router.back();
        return null;
    }

    const { booking } = bookingData;

    /**
     * Couleurs pour le mode clair et sombre
     */
    const colors = React.useMemo(() => ({
        headerBg: isDark ? '#1A1A1A' : '#1776BA',
        cardBg: isDark ? '#1A1A1A' : '#FFFFFF',
        primaryText: isDark ? '#FFFFFF' : '#11181C',
        secondaryText: isDark ? '#9BA1A6' : '#666666',
        labelText: isDark ? '#9BA1A6' : '#999999',
        border: isDark ? '#3A3A3C' : '#E0E0E0',
        separator: isDark ? '#3A3A3C' : '#E5E5E5',
        success: '#34C759',
        warning: '#FF9500',
        itemCardBg: isDark ? '#2A2A2A' : '#F5F5F5',
        codeContainerBg: isDark ? '#2A2A2A' : '#F5F5F5',
    }), [isDark]);

    /**
     * Gère le retour à l'écran précédent
     */
    const handleBack = () => {
        router.back();
    };

    /**
     * Bascule la sélection d'un billet
     */
    const toggleItemSelection = (itemId: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            newSet.has(itemId) ? newSet.delete(itemId) : newSet.add(itemId);
            return newSet;
        });
    };

    /**
     * Valide les billets sélectionnés
     */
    const handleValidateItems = async () => {
        if (selectedItems.size === 0) {
            Alert.alert('Aucun billet sélectionné', 'Veuillez sélectionner au moins un billet à valider.');
            return;
        }

        Alert.alert(
            'Confirmer la validation',
            `Êtes-vous sûr de vouloir valider ${selectedItems.size} billet(s) ?`,
            [
                {
                    text: 'Annuler',
                    style: 'cancel',
                },
                {
                    text: 'Valider',
                    onPress: async () => {
                        setIsValidating(true);
                        try {
                            const token = await AsyncStorage.getItem('token');
                            if (!token) {
                                throw new Error('Token non disponible');
                            }

                            // Récupération du departureId
                            const departureId = booking.departure?.id;
                            if (!departureId) {
                                throw new Error('ID du départ non disponible');
                            }

                            // Calcul du nombre total d'items validables
                            const validatableItems = booking.items.filter((item: any) => item.canValidate === true);
                            const totalValidatableCount = validatableItems.length;
                            const selectedCount = selectedItems.size;

                            // Formatage du body selon les règles
                            let requestBody: {
                                departureId: string;
                                itemIds?: string[];
                                validateAll?: boolean;
                            } = {
                                departureId,
                            };

                            // Cas 1 : Un seul élément sélectionné OU tous les éléments validables sont sélectionnés
                            if (selectedCount === 1 || selectedCount === totalValidatableCount) {
                                requestBody.validateAll = true;
                            } else {
                                // Cas 2 : Plusieurs éléments sélectionnés mais pas tous
                                requestBody.itemIds = Array.from(selectedItems);
                            }

                            const response = await axios.post(
                                `${baseUrl}/bookings/${booking.id}/validate-items`,
                                requestBody,
                                {
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                    },
                                }
                            );

                            console.log('response dans le handleValidateItems: ', JSON.stringify(response.data));

                            if (response.data) {
                                Alert.alert(
                                    'Succès',
                                    `${selectedItems.size} billet(s) validé(s) avec succès.`,
                                    [
                                        {
                                            text: 'OK',
                                            onPress: () => {
                                                // Recharger les données ou retourner en arrière
                                                router.back();
                                            },
                                        },
                                    ]
                                );
                            }
                        } catch (error: any) {
                            console.error('Erreur lors de la validation:', error);
                            Alert.alert(
                                'Erreur',
                                error.response?.data?.message || 'Une erreur est survenue lors de la validation des billets.',
                                [{ text: 'OK' }]
                            );
                        } finally {
                            setIsValidating(false);
                        }
                    },
                },
            ]
        );
    };

    /**
     * Vérifie si tous les billets ont le statut USED
     */
    const areAllItemsUsed = React.useMemo(() => 
        booking.items?.every((item: any) => item.status?.toUpperCase() === 'USED') ?? false,
        [booking.items]
    );

    /**
     * Calcule le nombre de billets restants à valider
     */
    const remainingItemsCount = React.useMemo(() => 
        booking.items?.filter((item: any) => item.status?.toUpperCase() !== 'USED').length ?? 0,
        [booking.items]
    );

    useEffect(() => {
        const checkUserRole = async () => {
            const userRole = await AsyncStorage.getItem('user_role');
            setUserRole(userRole?.toUpperCase());
            console.log('userRole ===>, ', userRole);
        };
        checkUserRole();
    }, []);

    // Détermine si l'utilisateur peut valider les billets
    const canValidateTickets = userRole === 'DRIVER' || userRole === 'DEPARTURE_SUPERVISOR';
    
    // Détermine si on doit afficher le bouton bagages
    const showBaggageButton = userRole === 'PORTER';

    /**
     * Gère l'enregistrement des bagages pour un passager
     * Navigue vers l'écran de gestion des bagages avec les paramètres nécessaires
     * @param itemId - L'ID du billet/passager (bookingItemId)
     */
    const handleRegisterBaggage = async (itemId: string) => {
        const departureId = booking.departure?.id;
        const bookingId = booking.id;

        if (!departureId || !bookingId) {
            Alert.alert(
                'Erreur',
                'Les informations nécessaires ne sont pas disponibles.',
                [{ text: 'OK' }]
            );
            return;
        }

        router.push({
            pathname: '/register-baggage',
            params: {
                bookingItemId: itemId,
                departureId: departureId,
                bookingId: bookingId,
            },
        });
    };

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F3F3F7' }]}>
            {/* Barre de navigation / En-tête */}
            <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + 8, paddingBottom: 16 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={[styles.headerButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
                        onPress={handleBack}
                    >
                        <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>

                    <ThemedText style={[styles.headerTitle, { color: '#FFFFFF' }]}>
                        Résultat du scan
                    </ThemedText>

                    <View style={styles.headerButton} />
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: selectedItems.size > 0 ? 100 : 10 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Carte principale */}
                <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    {/* Section de succès/information */}
                    {areAllItemsUsed ? (
                        <>
                            <View style={styles.successSection}>
                                <View style={[styles.successIconContainer, { backgroundColor: colors.success + '20' }]}>
                                    <MaterialIcons name="check-circle" size={48} color={colors.success} />
                                </View>
                                <ThemedText style={[styles.successTitle, { color: colors.primaryText }]}>Scan validé avec succès</ThemedText>
                                <ThemedText style={[styles.successSubtitle, { color: colors.secondaryText }]}>Tous les billets de la réservation ont été validés</ThemedText>
                            </View>
                            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                        </>
                    ) : (
                        <>
                            <View style={styles.infoSection}>
                                <View style={[styles.infoIconContainer, { backgroundColor: colors.warning + '20' }]}>
                                    <MaterialIcons name="info" size={48} color={colors.warning} />
                                </View>
                                <ThemedText style={[styles.infoTitle, { color: colors.primaryText }]}>Réservation à valider</ThemedText>
                                <ThemedText style={[styles.infoSubtitle, { color: colors.secondaryText }]}>
                                    {remainingItemsCount > 0 ? `${remainingItemsCount} billet${remainingItemsCount > 1 ? 's' : ''} restant${remainingItemsCount > 1 ? 's' : ''} à valider` : 'En attente de validation'}
                                </ThemedText>
                            </View>
                            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                        </>
                    )}

                    {/* Section : Code de réservation */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Code de réservation</ThemedText>
                        <View style={[styles.codeContainer, { backgroundColor: colors.codeContainerBg, borderColor: colors.border }]}>
                            <ThemedText style={[styles.codeText, { color: colors.primaryText }]}>{booking.code || '--'}</ThemedText>
                        </View>
                    </View>
                    <View style={[styles.separator, { backgroundColor: colors.separator }]} />

                    {/* Section : Statut de la réservation */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Statut de la réservation</ThemedText>
                        <View style={styles.statusRow}>
                            <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>Statut</ThemedText>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status, isDark) + '20' }]}>
                                <ThemedText style={[styles.statusText, { color: getStatusColor(booking.status, isDark) }]}>{getStatusLabel(booking.status)}</ThemedText>
                            </View>
                        </View>
                    </View>
                    <View style={[styles.separator, { backgroundColor: colors.separator }]} />

                    {/* Section : Détails du départ */}
                    {booking.departure && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Détails du départ</ThemedText>
                                {[
                                    { label: 'Date', value: formatDate(booking.departure.departureDateTime) },
                                    { label: 'Heure', value: formatTime(booking.departure.departureDateTime) },
                                ].map(({ label, value }) => (
                                    <View key={label} style={styles.detailRow}>
                                        <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>{label}</ThemedText>
                                        <ThemedText style={[styles.detailValue, { color: colors.primaryText }]}>{value}</ThemedText>
                                    </View>
                                ))}
                                <View style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>Statut du départ</ThemedText>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.departure.status, isDark) + '20' }]}>
                                        <ThemedText style={[styles.statusText, { color: getStatusColor(booking.departure.status, isDark) }]}>{getStatusLabel(booking.departure.status)}</ThemedText>
                                    </View>
                                </View>
                            </View>
                            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                        </>
                    )}

                    {/* Section : Résumé */}
                    {booking.summary && (
                        <View style={styles.section}>
                            <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Résumé</ThemedText>
                            {[
                                { label: 'Total des billets', value: booking.summary.totalItems || 0 },
                                { label: 'Billets payés', value: booking.summary.paidItems || 0 },
                                { label: 'Billets utilisés', value: booking.summary.usedItems || 0 },
                            ].map(({ label, value }) => (
                                <View key={label} style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>{label}</ThemedText>
                                    <ThemedText style={[styles.detailValue, { color: colors.primaryText }]}>{value}</ThemedText>
                                </View>
                            ))}
                            <View style={styles.detailRow}>
                                <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>Validation total des billets</ThemedText>
                                <View style={[styles.statusBadge, { backgroundColor: (booking.summary.canValidateAll ? colors.success : colors.warning) + '20' }]}>
                                    <ThemedText style={[styles.statusText, { color: booking.summary.canValidateAll ? colors.success : colors.warning }]}>{booking.summary.canValidateAll ? 'Oui' : 'Non'}</ThemedText>
                                </View>
                            </View>
                        </View>
                    )}
                    <View style={[styles.separator, { backgroundColor: colors.separator }]} />

                    {/* Section : Liste des billets */}
                    {booking.items?.length > 0 && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Liste des billets ({booking.items.length})</ThemedText>
                                
                                {booking.items.map((item: any, index: number) => {
                                    const isSelected = selectedItems.has(item.id);
                                    const canSelect = item.canValidate === true && canValidateTickets;

                                    return (
                                        <View
                                            key={item.id || index}
                                            style={[
                                                styles.itemCard,
                                                {
                                                    backgroundColor: colors.itemCardBg,
                                                    borderColor: isSelected && canSelect ? '#1776BA' : colors.border,
                                                    borderWidth: isSelected && canSelect ? 1 : 0.5,
                                                    opacity: canSelect ? 1 : 0.6,
                                                },
                                            ]}
                                        >
                                            {/* En-tête du billet */}
                                            <TouchableOpacity
                                                activeOpacity={canSelect ? 0.7 : 1}
                                                onPress={() => canSelect && toggleItemSelection(item.id)}
                                                disabled={!canSelect}
                                                style={styles.itemHeader}
                                            >
                                                <View style={styles.itemHeaderLeft}>
                                                    {canSelect && (
                                                        <View
                                                            style={[
                                                                styles.selectionCheckbox,
                                                                {
                                                                    backgroundColor: isSelected 
                                                                        ? '#1776BA' 
                                                                        : 'transparent',
                                                                    borderColor: isSelected ? '#1776BA' : colors.border,
                                                                },
                                                            ]}
                                                        >
                                                            {isSelected && (
                                                                <MaterialIcons name="check" size={18} color="#FFFFFF" />
                                                            )}
                                                        </View>
                                                    )}
                                                    <ThemedText style={[styles.itemTitle, { color: colors.primaryText }]}>Billet #{index + 1}</ThemedText>
                                                </View>
                                                {item.status && (
                                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status, isDark) + '20' }]}>
                                                        <ThemedText style={[styles.statusText, { color: getStatusColor(item.status, isDark) }]}>{getStatusLabel(item.status)}</ThemedText>
                                                    </View>
                                                )}
                                            </TouchableOpacity>

                                            {/* Informations du passager */}
                                            <View style={styles.itemContent}>
                                                {[
                                                    { label: 'Passager', value: item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : '--' },
                                                    { label: 'Numéro de siège', value: item.seatNumber || '--' },
                                                    { label: 'Type de passager', value: getPassengerTypeLabel(item.passengerType) },
                                                    { label: 'Type de trajet', value: getLegLabel(item.leg) },
                                                ].map(({ label, value }) => (
                                                    <View key={label} style={styles.detailRow}>
                                                        <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>{label}</ThemedText>
                                                        <ThemedText style={[styles.detailValue, { color: colors.primaryText }]}>{value}</ThemedText>
                                                    </View>
                                                ))}
                                                <View style={styles.detailRow}>
                                                    <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>Peut être validé ?</ThemedText>
                                                    <View style={styles.checkboxContainer}>
                                                        <ThemedText style={[styles.checkboxLabel, { color: colors.primaryText }]}>{item.canValidate ? 'Oui' : 'Non'}</ThemedText>
                                                    </View>
                                                </View>

                                                {showBaggageButton && (
                                                    <View style={[styles.baggageButtonContainer, { borderTopColor: colors.separator }]}>
                                                        <TouchableOpacity style={[styles.baggageButton, { backgroundColor: '#1776BA' }]} onPress={() => handleRegisterBaggage(item.id)}>
                                                            <MaterialIcons name="luggage" size={20} color="#FFFFFF" />
                                                            <ThemedText style={styles.baggageButtonText}>Enregistrer bagages</ThemedText>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                        </>
                    )}

                    {/* Section : Type de trajet */}
                    <View style={styles.section}>
                        <View style={styles.detailRow}>
                            <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>Type de trajet</ThemedText>
                            <ThemedText style={[styles.detailValue, { color: colors.primaryText }]}>{getTripTypeLabel(booking.tripType)}</ThemedText>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Bouton de validation fixe en bas */}
            {selectedItems.size > 0 && canValidateTickets && (
                <View style={[styles.validationButtonContainer, { backgroundColor: colors.cardBg, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
                    <TouchableOpacity style={[styles.validationButton, { backgroundColor: '#1776BA', opacity: isValidating ? 0.6 : 1 }]} onPress={handleValidateItems} disabled={isValidating}>
                        {isValidating ? <ActivityIndicator color="#FFFFFF" /> : (
                            <>
                                <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
                                <ThemedText style={styles.validationButtonText}>Valider {selectedItems.size} billet{selectedItems.size > 1 ? 's' : ''}</ThemedText>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}