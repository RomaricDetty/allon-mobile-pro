import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
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
 * Écran de résultat du scan QR
 * Affiche les détails de la réservation validée
 */
export default function ScanResultScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ bookingData: string }>();

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

    /**
     * Gère le retour à l'écran précédent
     */
    const handleBack = () => {
        router.back();
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
                    {/* Section de succès */}
                    <View style={styles.successSection}>
                        <View style={[styles.successIconContainer, { backgroundColor: successColor + '20' }]}>
                            <MaterialIcons name="check-circle" size={48} color={successColor} />
                        </View>
                        <ThemedText style={[styles.successTitle, { color: primaryTextColor }]}>
                            Scan validé avec succès
                        </ThemedText>
                        <ThemedText style={[styles.successSubtitle, { color: secondaryTextColor }]}>
                            La réservation a été vérifiée
                        </ThemedText>
                    </View>

                    {/* Séparateur */}
                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />

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
                            <ThemedText style={[styles.statusLabel, { color: labelTextColor }]}>
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
                                    Total d'articles
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                    {booking.summary.totalItems || 0}
                                </ThemedText>
                            </View>

                            <View style={styles.detailRow}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                    Articles payés
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                    {booking.summary.paidItems || 0}
                                </ThemedText>
                            </View>

                            <View style={styles.detailRow}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                    Articles utilisés
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                    {booking.summary.usedItems || 0}
                                </ThemedText>
                            </View>

                            <View style={styles.detailRow}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                    Validation complète
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
});

