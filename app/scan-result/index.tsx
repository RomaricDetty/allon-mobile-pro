import { baseUrl } from '@/api/config';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
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

    // Parse les données de la réservation depuis les paramètres
    let bookingData: BookingData | null = null;
    try {
        if (params.bookingData) {
            bookingData = JSON.parse(params.bookingData) as BookingData;
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

    // Couleurs pour le mode clair et sombre
    const headerBackgroundColor = isDark ? '#1A1A1A' : '#1776BA';
    const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
    const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
    const secondaryTextColor = isDark ? '#9BA1A6' : '#666666';
    const labelTextColor = isDark ? '#9BA1A6' : '#999999';
    const borderColor = isDark ? '#3A3A3C' : '#E0E0E0';
    const separatorColor = isDark ? '#3A3A3C' : '#E5E5E5';
    const successColor = '#34C759';
    const warningColor = '#FF9500'; // Nouvelle couleur pour les avertissements

    /**
     * Gère le retour à l'écran précédent
     */
    const handleBack = () => {
        router.back();
    };

    /**
     * Bascule la sélection d'un billet
     * @param itemId - L'ID du billet à sélectionner/désélectionner
     */
    const toggleItemSelection = (itemId: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
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
     * Vérifie si tous les billets de la réservation ont le statut USED
     * @returns true si tous les billets ont le statut USED
     */
    const areAllItemsUsed = (): boolean => {
        if (!booking.items || booking.items.length === 0) {
            return false;
        }

        // Vérifie si tous les éléments ont le statut USED
        return booking.items.every((item: any) => {
            const status = item.status?.toUpperCase();
            return status === 'USED';
        });
    };

    /**
     * Calcule le nombre de billets qui n'ont pas encore le statut USED
     * @returns Le nombre de billets restants à valider
     */
    const getRemainingItemsCount = (): number => {
        if (!booking.items || booking.items.length === 0) {
            return 0;
        }

        const unusedItems = booking.items.filter((item: any) => {
            const status = item.status?.toUpperCase();
            return status !== 'USED';
        });

        return unusedItems.length;
    };

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
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: cardBackgroundColor,
                            borderColor: borderColor,
                        },
                    ]}
                >
                    {/* Section de succès - Tous les billets validés */}
                    {areAllItemsUsed() && (
                        <>
                            <View style={styles.successSection}>
                                <View style={[styles.successIconContainer, { backgroundColor: successColor + '20' }]}>
                                    <MaterialIcons name="check-circle" size={48} color={successColor} />
                                </View>
                                <ThemedText style={[styles.successTitle, { color: primaryTextColor }]}>
                                    Scan validé avec succès
                                </ThemedText>
                                <ThemedText style={[styles.successSubtitle, { color: secondaryTextColor }]}>
                                    Tous les billets de la réservation ont été validés
                                </ThemedText>
                            </View>
                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                        </>
                    )}

                    {/* Section d'information - Billets non encore tous validés */}
                    {!areAllItemsUsed() && (
                        <>
                            <View style={styles.infoSection}>
                                <View style={[styles.infoIconContainer, { backgroundColor: warningColor + '20' }]}>
                                    <MaterialIcons name="info" size={48} color={warningColor} />
                                </View>
                                <ThemedText style={[styles.infoTitle, { color: primaryTextColor }]}>
                                    Réservation à valider
                                </ThemedText>
                                <ThemedText style={[styles.infoSubtitle, { color: secondaryTextColor }]}>
                                    {getRemainingItemsCount() > 0 
                                        ? `${getRemainingItemsCount()} billet${getRemainingItemsCount() > 1 ? 's' : ''} restant${getRemainingItemsCount() > 1 ? 's' : ''} à valider`
                                        : 'En attente de validation'
                                    }
                                </ThemedText>
                            </View>
                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                        </>
                    )}

                    {/* Section : Code de réservation */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                            Code de réservation
                        </ThemedText>
                        <View style={[styles.codeContainer, { backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5', borderColor: borderColor }]}>
                            <ThemedText style={[styles.codeText, { color: primaryTextColor }]}>
                                {booking.code || '--'}
                            </ThemedText>
                        </View>
                    </View>

                    {/* Séparateur */}
                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                    {/* Section : Statut de la réservation */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                            Statut de la réservation
                        </ThemedText>
                        <View style={styles.statusRow}>
                            <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                Statut
                            </ThemedText>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status, isDark) + '20' }]}>
                                <ThemedText style={[styles.statusText, { color: getStatusColor(booking.status, isDark) }]}>
                                    {getStatusLabel(booking.status)}
                                </ThemedText>
                            </View>
                        </View>
                    </View>

                    {/* Séparateur */}
                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                    {/* Section : Détails du départ */}
                    {booking.departure && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Détails du départ
                                </ThemedText>
                                
                                <View style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                        Date
                                    </ThemedText>
                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                        {formatDate(booking.departure.departureDateTime)}
                                    </ThemedText>
                                </View>

                                <View style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                        Heure
                                    </ThemedText>
                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                        {formatTime(booking.departure.departureDateTime)}
                                    </ThemedText>
                                </View>

                                <View style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                        Statut du départ
                                    </ThemedText>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.departure.status, isDark) + '20' }]}>
                                        <ThemedText style={[styles.statusText, { color: getStatusColor(booking.departure.status, isDark) }]}>
                                            {getStatusLabel(booking.departure.status)}
                                        </ThemedText>
                                    </View>
                                </View>
                            </View>

                            {/* Séparateur */}
                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                        </>
                    )}

                    {/* Section : Résumé */}
                    {booking.summary && (
                        <View style={styles.section}>
                            <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                Résumé
                            </ThemedText>
                            
                            <View style={styles.detailRow}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                    Total des billets
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                    {booking.summary.totalItems || 0}
                                </ThemedText>
                            </View>

                            <View style={styles.detailRow}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                    Billets payés
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                    {booking.summary.paidItems || 0}
                                </ThemedText>
                            </View>

                            <View style={styles.detailRow}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                    Billets utilisés
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                    {booking.summary.usedItems || 0}
                                </ThemedText>
                            </View>

                            <View style={styles.detailRow}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                    Validation total des billets
                                </ThemedText>
                                <View style={[styles.statusBadge, { backgroundColor: (booking.summary.canValidateAll ? successColor : '#FF9500') + '20' }]}>
                                    <ThemedText style={[styles.statusText, { color: booking.summary.canValidateAll ? successColor : '#FF9500' }]}>
                                        {booking.summary.canValidateAll ? 'Oui' : 'Non'}
                                    </ThemedText>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Séparateur */}
                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                    {/* Section : Liste des billets */}
                    {booking.items && booking.items.length > 0 && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Liste des billets ({booking.items.length})
                                </ThemedText>
                                
                                {booking.items.map((item: any, index: number) => {
                                    const isSelected = selectedItems.has(item.id);
                                    const canSelect = item.canValidate === true;

                                    return (
                                        <TouchableOpacity
                                            key={item.id || index}
                                            activeOpacity={canSelect ? 0.7 : 1}
                                            onPress={() => canSelect && toggleItemSelection(item.id)}
                                            disabled={!canSelect}
                                            style={[
                                                styles.itemCard,
                                                {
                                                    backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
                                                    borderColor: isSelected && canSelect 
                                                        ? '#1776BA' 
                                                        : borderColor,
                                                    borderWidth: isSelected && canSelect ? 1 : 0.5,
                                                    opacity: canSelect ? 1 : 0.6,
                                                },
                                            ]}
                                        >
                                            {/* En-tête du billet */}
                                            <View style={styles.itemHeader}>
                                                <View style={styles.itemHeaderLeft}>
                                                    {canSelect && (
                                                        <View
                                                            style={[
                                                                styles.selectionCheckbox,
                                                                {
                                                                    backgroundColor: isSelected 
                                                                        ? '#1776BA' 
                                                                        : 'transparent',
                                                                    borderColor: isSelected 
                                                                        ? '#1776BA' 
                                                                        : borderColor,
                                                                },
                                                            ]}
                                                        >
                                                            {isSelected && (
                                                                <MaterialIcons name="check" size={18} color="#FFFFFF" />
                                                            )}
                                                        </View>
                                                    )}
                                                    <ThemedText style={[styles.itemTitle, { color: primaryTextColor }]}>
                                                        Billet #{index + 1}
                                                    </ThemedText>
                                                </View>
                                                {item.status && (
                                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status, isDark) + '20' }]}>
                                                        <ThemedText style={[styles.statusText, { color: getStatusColor(item.status, isDark) }]}>
                                                            {getStatusLabel(item.status)}
                                                        </ThemedText>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Informations du passager */}
                                            <View style={styles.itemContent}>
                                                <View style={styles.detailRow}>
                                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                                        Passager
                                                    </ThemedText>
                                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                                        {item.firstName && item.lastName 
                                                            ? `${item.firstName} ${item.lastName}`
                                                            : '--'
                                                        }
                                                    </ThemedText>
                                                </View>

                                                <View style={styles.detailRow}>
                                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                                        Numéro de siège
                                                    </ThemedText>
                                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                                        {item.seatNumber || '--'}
                                                    </ThemedText>
                                                </View>

                                                <View style={styles.detailRow}>
                                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                                        Type de passager
                                                    </ThemedText>
                                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                                        {getPassengerTypeLabel(item.passengerType)}
                                                    </ThemedText>
                                                </View>

                                                <View style={styles.detailRow}>
                                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                                        Type de trajet
                                                    </ThemedText>
                                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                                        {getLegLabel(item.leg)}
                                                    </ThemedText>
                                                </View>

                                                {/* Checkbox pour la validation */}
                                                <View style={styles.detailRow}>
                                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                                        Peut être validé
                                                    </ThemedText>
                                                    <View style={styles.checkboxContainer}>
                                                        <View
                                                            style={[
                                                                styles.checkbox,
                                                                {
                                                                    backgroundColor: item.canValidate ? '#1776BA' : (isDark ? '#3A3A3C' : '#E0E0E0'),
                                                                    borderColor: item.canValidate ? '#1776BA' : borderColor,
                                                                },
                                                            ]}
                                                        >
                                                            {item.canValidate && (
                                                                <MaterialIcons name="check" size={18} color="#FFFFFF" />
                                                            )}
                                                        </View>
                                                        <ThemedText style={[styles.checkboxLabel, { color: primaryTextColor }]}>
                                                            {item.canValidate ? 'Oui' : 'Non'}
                                                        </ThemedText>
                                                    </View>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Séparateur */}
                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                        </>
                    )}

                    {/* Section : Type de trajet */}
                    <View style={styles.section}>
                        <View style={styles.detailRow}>
                            <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                Type de trajet
                            </ThemedText>
                            <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                {getTripTypeLabel(booking.tripType)}
                            </ThemedText>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Bouton de validation fixe en bas */}
            {selectedItems.size > 0 && (
                <View
                    style={[
                        styles.validationButtonContainer,
                        {
                            backgroundColor: cardBackgroundColor,
                            borderTopColor: borderColor,
                            paddingBottom: insets.bottom + 16,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.validationButton,
                            {
                                backgroundColor: '#1776BA',
                                opacity: isValidating ? 0.6 : 1,
                            },
                        ]}
                        onPress={handleValidateItems}
                        disabled={isValidating}
                    >
                        {isValidating ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <>
                                <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
                                <ThemedText style={styles.validationButtonText}>
                                    Valider {selectedItems.size} billet{selectedItems.size > 1 ? 's' : ''}
                                </ThemedText>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
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
    successSection: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    successIconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    successTitle: {
        fontSize: 22,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    successSubtitle: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        textAlign: 'center',
    },
    infoSection: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    infoIconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    infoTitle: {
        fontSize: 22,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    infoSubtitle: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        textAlign: 'center',
    },
    separator: {
        height: 1,
        width: '100%',
        marginVertical: 16,
    },
    section: {
        marginVertical: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 16,
    },
    codeContainer: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    codeText: {
        fontSize: 20,
        fontFamily: 'Ubuntu_Bold',
        letterSpacing: 2,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    detailLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    detailValue: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    itemCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    itemTitle: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    itemContent: {
        gap: 8,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
    },
    itemHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    selectionCheckbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    validationButtonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        // shadowColor: '#000',
        // shadowOffset: {
        //     width: 0,
        //     height: -2,
        // },
        // shadowOpacity: 0.1,
        // shadowRadius: 4,
        // elevation: 5,
    },
    validationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 8,
    },
    validationButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
});

