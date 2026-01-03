import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Interface pour les données de réservation
 */
interface ApiBooking {
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
    console.log('phone =>, ', phone);
    if (!phone) return '--';

    if (typeof phone === 'object' && phone.value) {
        return phone.value;
    }

    if (typeof phone === 'string') {
        return phone;
    }

    if (typeof phone === 'object') {
        return phone.digits || phone.phone || phone.toString() || '--';
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
        'EXPIRED': { light: '#FF3B30', dark: '#FF453A' },
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
 * Formate une date ISO en date et heure complètes
 * @param dateString - La date au format ISO
 * @returns La date et heure formatées
 */
const formatDateTime = (dateString?: string): string => {
    if (!dateString) return '--';

    try {
        const date = new Date(dateString);
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (error) {
        return dateString;
    }
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
 * Écran de détails d'une réservation
 * Affiche toutes les informations d'une réservation (sauf les IDs)
 */
export default function BookingDetailsScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ bookingData: string }>();

    // Parse les données de la réservation depuis les paramètres
    let booking: ApiBooking | null = null;
    try {
        if (params.bookingData) {
            const parsed = JSON.parse(params.bookingData);
            booking = parsed.booking || parsed;
        }
    } catch (error) {
        console.error('Erreur lors du parsing des données de réservation:', error);
    }

    // Si aucune donnée n'est disponible, retourner à l'écran précédent
    if (!booking) {
        router.back();
        return null;
    }

    // Détermine le type de voyage
    const tripType = (booking.tripType || booking.type || '').toUpperCase();
    const isRoundTrip = tripType === 'ROUND_TRIP';

    // Couleurs pour le mode clair et sombre
    const backgroundColor = isDark ? '#000000' : '#F3F3F7';
    const headerBackgroundColor = isDark ? '#000000' : '#F3F3F7';
    const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
    const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
    const secondaryTextColor = isDark ? '#9BA1A6' : '#666666';
    const labelTextColor = isDark ? '#9BA1A6' : '#999999';
    const borderColor = isDark ? '#3A3A3C' : '#E0E0E0';
    const separatorColor = isDark ? '#3A3A3C' : '#E5E5E5';

    /**
     * Rend une ligne de détail
     */
    const renderDetailRow = (label: string, value: string | React.ReactNode, showSeparator: boolean = false) => (
        <>
            <View style={[styles.detailRow, { justifyContent: 'space-around' }]}>
                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                    {label}
                </ThemedText>
                {typeof value === 'string' ? (
                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                        {value}
                    </ThemedText>
                ) : (
                    <>
                        <ThemedText type="defaultSemiBold" style={[{ color: primaryTextColor }]}>{value}</ThemedText>
                    </>
                )}
            </View>
            {showSeparator && <View style={[styles.separator, { backgroundColor: separatorColor }]} />}
        </>
    );

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
                        <ThemedText type="title" style={styles.title}>Détails de la réservation</ThemedText>
                    </View>
                    <View style={styles.backButton} />
                </View>
            </ThemedView>

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

                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                    {/* Section : Statut */}
                    {renderDetailRow(
                        'Statut',
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status, isDark) + '20' }]}>
                            <ThemedText style={[styles.statusText, { color: getStatusColor(booking.status, isDark), textAlign: 'right' }]}>
                                {getStatusLabel(booking.status)}
                            </ThemedText>
                        </View>
                    )}

                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                    {/* Section : Informations du trajet */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                            Informations du trajet
                        </ThemedText>

                        {renderDetailRow('Type de trajet', getTripTypeLabel(booking.tripType || booking.type))}
                        {renderDetailRow('Ville de départ', booking.trip?.stationFrom?.name || booking.departure?.trip?.stationFrom?.name || '--')}
                        {renderDetailRow('Ville d\'arrivée', booking.trip?.stationTo?.name || booking.departure?.trip?.stationTo?.name || '--')}
                        {booking.trip?.distance && renderDetailRow('Distance', booking.trip.distance + ' km')}
                        {booking.trip?.estimatedDuration && renderDetailRow('Durée estimée', booking.trip.estimatedDuration + ' min')}
                        {booking.trip?.label && renderDetailRow('Label du trajet', booking.trip.label)}
                    </View>

                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                    {/* Section : Dates et heures */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                            Dates et heures
                        </ThemedText>

                        {renderDetailRow('Date de départ', formatDate(booking.departureDateTime || booking.departure?.departureDateTime))}
                        {renderDetailRow('Heure de départ', booking.departureTime || formatTime(booking.departureDateTime || booking.departure?.departureDateTime))}
                        {booking.arrivalTime && renderDetailRow('Heure d\'arrivée', booking.arrivalTime)}
                        {booking.duration && renderDetailRow('Durée', booking.duration)}
                        {booking.departure?.departureDateTime && renderDetailRow('Date et heure complètes', formatDateTime(booking.departure.departureDateTime))}
                    </View>

                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                    {/* Section : Informations de paiement */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                            Informations de paiement
                        </ThemedText>

                        {renderDetailRow('Montant total', formatAmount(booking.totalAmount, booking.currency))}
                        {renderDetailRow('Méthode de paiement', getPaymentMethodLabel(booking.paymentMethod))}
                        {booking.paymentProvider && renderDetailRow('Opérateur de paiement', booking.paymentProvider)}
                        {renderDetailRow('Canal', getChannelLabel(booking.channel))}
                    </View>

                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                    {/* Section : Informations des bus */}
                    {(booking.bus || booking.returnBus) && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Informations des bus
                                </ThemedText>

                                {/* Bus aller - affiché pour tous les types de voyage si disponible */}
                                {booking.bus && (
                                    <>
                                        {isRoundTrip && (
                                            <ThemedText style={[styles.busSubtitle, { color: secondaryTextColor, marginTop: 8, marginBottom: 12 }]}>
                                                Bus aller
                                            </ThemedText>
                                        )}
                                        {renderDetailRow('Type de bus', booking?.bus?.busType?.toUpperCase() || '--')}
                                        {booking.bus.capacity && renderDetailRow('Capacité', String(booking.bus.capacity))}
                                        {renderDetailRow('Plaque d\'immatriculation', booking.bus.licencePlate || '--')}
                                    </>
                                )}

                                {/* Bus retour - affiché uniquement pour les aller-retour */}
                                {isRoundTrip && booking.returnBus && (
                                    <>
                                        {booking.bus && <View style={{ marginTop: 16 }} />}
                                        <ThemedText style={[styles.busSubtitle, { color: secondaryTextColor, marginTop: booking.bus ? 0 : 8, marginBottom: 12 }]}>
                                            Bus retour
                                        </ThemedText>
                                        {renderDetailRow('Type de bus', booking?.returnBus?.busType?.toUpperCase() || '--')}
                                        {booking.returnBus.capacity && renderDetailRow('Capacité', String(booking.returnBus.capacity))}
                                        {renderDetailRow('Plaque d\'immatriculation', booking.returnBus.licencePlate || '--')}
                                    </>
                                )}
                            </View>

                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                        </>
                    )}

                    {/* Section : Informations de la compagnie */}
                    {booking.companyName && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Compagnie
                                </ThemedText>

                                {renderDetailRow('Nom', booking.companyName)}
                                {booking.companyPhones && booking.companyPhones.length > 0 && (
                                    <View style={styles.detailRow}>
                                        <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                            Téléphones
                                        </ThemedText>
                                        <View style={styles.phoneList}>
                                            {booking.companyPhones.map((phone, index) => (
                                                <ThemedText key={index} style={[styles.detailValue, { color: primaryTextColor }]}>
                                                    {formatPhoneNumber(phone)} {phone.type ? `(${phone.type})` : ''}
                                                </ThemedText>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </View>

                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                        </>
                    )}

                    {/* Section : Contact */}
                    {booking.contact && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Contact
                                </ThemedText>

                                {booking.contact.firstName && renderDetailRow('Prénom', booking.contact.firstName)}
                                {booking.contact.lastName && renderDetailRow('Nom', booking.contact.lastName)}
                                {booking.contact.email && renderDetailRow('Email', booking.contact.email)}
                                {booking.contact.phone && renderDetailRow('Téléphone', formatPhoneNumber(booking.contact.phone))}
                                {booking.contact.relationship && renderDetailRow('Relation', booking.contact.relationship.toUpperCase())}
                            </View>

                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                        </>
                    )}

                    {/* Section : Résumé */}
                    {booking.summary && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Résumé
                                </ThemedText>

                                {renderDetailRow('Total des billets', String(booking.summary.totalItems || 0))}
                                {renderDetailRow('Billets payés', String(booking.summary.paidItems || 0))}
                                {renderDetailRow('Billets utilisés', String(booking.summary.usedItems || 0))}
                                {renderDetailRow(
                                    'Validation totale possible',
                                    <View style={[styles.statusBadge, { backgroundColor: (booking.summary.canValidateAll ? '#34C759' : '#FF9500') + '20' }]}>
                                        <ThemedText style={[styles.statusText, { color: booking.summary.canValidateAll ? '#34C759' : '#FF9500' }]}>
                                            {booking.summary.canValidateAll ? 'Oui' : 'Non'}
                                        </ThemedText>
                                    </View>
                                )}
                            </View>

                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                        </>
                    )}

                    {/* Section : Liste des passagers */}
                    {booking.passengers && booking.passengers.length > 0 && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Passagers ({booking.passengers.length})
                                </ThemedText>

                                {booking.passengers.map((passenger: any, index: number) => (
                                    <View key={index} style={[styles.passengerCard, { backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5', borderColor: borderColor }]}>
                                        <ThemedText style={[styles.passengerTitle, { color: primaryTextColor }]}>
                                            Passager #{index + 1}
                                        </ThemedText>
                                        {passenger.firstName && renderDetailRow('Prénom', passenger.firstName)}
                                        {passenger.lastName && renderDetailRow('Nom', passenger.lastName)}
                                        {passenger.passengerType && renderDetailRow('Type', getPassengerTypeLabel(passenger.passengerType))}
                                        {passenger.seatNumber && renderDetailRow('Siège', passenger.seatNumber)}
                                    </View>
                                ))}
                            </View>

                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                        </>
                    )}

                    {/* Section : Liste des items/billets */}
                    {booking.items && booking.items.length > 0 && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Billets ({booking.items.length})
                                </ThemedText>

                                {booking.items.map((item: any, index: number) => (
                                    <View key={index} style={[styles.itemCard, { backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5', borderColor: borderColor }]}>
                                        <View style={styles.itemHeader}>
                                            <ThemedText style={[styles.itemTitle, { color: primaryTextColor }]}>
                                                Billet #{index + 1}
                                            </ThemedText>
                                            {item.status && (
                                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status, isDark) + '20' }]}>
                                                    <ThemedText style={[styles.statusText, { color: getStatusColor(item.status, isDark) }]}>
                                                        {getStatusLabel(item.status)}
                                                    </ThemedText>
                                                </View>
                                            )}
                                        </View>
                                        {item.firstName && renderDetailRow('Prénom', item.firstName)}
                                        {item.lastName && renderDetailRow('Nom', item.lastName)}
                                        {item.passengerType && renderDetailRow('Type de passager', getPassengerTypeLabel(item.passengerType))}
                                        {item.seatNumber && renderDetailRow('Numéro de siège', item.seatNumber)}
                                        {item.leg && renderDetailRow('Type de trajet', getLegLabel(item.leg))}
                                        {item.canValidate !== undefined && renderDetailRow(
                                            'Peut être validé',
                                            <View style={[styles.statusBadge, { backgroundColor: (item.canValidate ? '#34C759' : '#FF9500') + '20' }]}>
                                                <ThemedText style={[styles.statusText, { color: item.canValidate ? '#34C759' : '#FF9500' }]}>
                                                    {item.canValidate ? 'Oui' : 'Non'}
                                                </ThemedText>
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>

                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                        </>
                    )}

                    {/* Section : Dates de création et modification */}
                    {(booking.createdAt || booking.updatedAt) && (
                        <View style={styles.section}>
                            <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                Dates
                            </ThemedText>

                            {booking.createdAt && renderDetailRow('Date de réservation', formatDateTime(booking.createdAt))}
                            {/* {booking.updatedAt && renderDetailRow('Dernière modification', formatDateTime(booking.updatedAt))} */}
                        </View>
                    )}

                    {/* Section : Statut du départ */}
                    {booking.departure?.status && (
                        <>
                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Statut du départ
                                </ThemedText>
                                {renderDetailRow(
                                    'Statut',
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.departure.status, isDark) + '20' }]}>
                                        <ThemedText style={[styles.statusText, { color: getStatusColor(booking.departure.status, isDark) }]}>
                                            {getStatusLabel(booking.departure.status)}
                                        </ThemedText>
                                    </View>
                                )}
                                {booking.departure.code && renderDetailRow('Code du départ', booking.departure.code)}
                            </View>
                        </>
                    )}
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
        fontSize: 20,
        fontFamily: 'Ubuntu_Bold',
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    card: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
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
    separator: {
        height: 1,
        width: '100%',
        marginVertical: 16,
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
        flex: 1,
    },
    detailValue: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
        flex: 1,
        textAlign: 'right',
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
    phoneList: {
        flex: 1,
        alignItems: 'flex-end',
    },
    passengerCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    passengerTitle: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 12,
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
        marginBottom: 12,
    },
    itemTitle: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    busSubtitle: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
    },
});

