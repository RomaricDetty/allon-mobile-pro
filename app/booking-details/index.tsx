import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { styles } from '@/styles/booking-details';
import {
    formatAmount,
    formatDate,
    formatDateTime,
    formatPhoneNumber,
    formatTime,
    getChannelLabel,
    getLegLabel,
    getPassengerTypeLabel,
    getPaymentMethodLabel,
    getStatusColor,
    getStatusLabel,
    getTripTypeLabel,
} from '@/utils/booking-details-utils';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Données de réservation renvoyées par l’API */
interface ApiBooking {
    id?: string;
    departureId?: string;
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
    bus?: { busType?: string; capacity?: number; licencePlate?: string };
    returnBus?: { busType?: string; capacity?: number; licencePlate?: string };
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
    departure?: { code?: string; departureDateTime?: string; status?: string; trip?: any; id?: string };
    summary?: { canValidateAll?: boolean; paidItems?: number; totalItems?: number; usedItems?: number };
    items?: any[];
}

/**
 * Écran de détails d'une réservation.
 * Affiche les informations de la réservation ; bouton bagages visible pour le rôle PORTER sauf si statut CANCELLED.
 */
export default function BookingDetailsScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ bookingData: string }>();
    const [userRole, setUserRole] = useState<string | undefined>(undefined);

    const booking = useMemo<ApiBooking | null>(() => {
        try {
            if (params.bookingData) {
                const parsed = JSON.parse(params.bookingData);
                return parsed.booking ?? parsed;
            }
        } catch {
            // ignore
        }
        return null;
    }, [params.bookingData]);

    useEffect(() => {
        const loadRole = async () => {
            const role = await AsyncStorage.getItem('user_role');
            setUserRole(role?.toUpperCase());
        };
        loadRole();
    }, []);

    const themeColors = useMemo(
        () => ({
            backgroundColor: isDark ? '#000000' : '#F3F3F7',
            headerBackgroundColor: isDark ? '#000000' : '#F3F3F7',
            cardBackgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
            primaryTextColor: isDark ? '#FFFFFF' : '#11181C',
            secondaryTextColor: isDark ? '#9BA1A6' : '#666666',
            labelTextColor: isDark ? '#9BA1A6' : '#999999',
            borderColor: isDark ? '#3A3A3C' : '#E0E0E0',
            separatorColor: isDark ? '#3A3A3C' : '#E5E5E5',
        }),
        [isDark]
    );

    const tripType = (booking?.tripType || booking?.type || '').toUpperCase();
    const isRoundTrip = tripType === 'ROUND_TRIP';

    /** Bouton bagages : visible pour PORTER uniquement si la réservation n’est pas annulée */
    const showBaggageButton =
        userRole === 'PORTER' && booking?.status?.toUpperCase() !== 'CANCELLED';

    const findItemForPassenger = useCallback(
        (passenger: any, index: number): any => {
            if (!booking?.items?.length) return null;
            const match = booking.items.find((item: any) => {
                const fn = item.firstName && passenger.firstName && item.firstName.toLowerCase() === passenger.firstName.toLowerCase();
                const ln = item.lastName && passenger.lastName && item.lastName.toLowerCase() === passenger.lastName.toLowerCase();
                const seat = item.seatNumber && passenger.seatNumber && item.seatNumber === passenger.seatNumber;
                return (fn && ln) || (seat && (fn || ln));
            });
            return match ?? booking.items[index] ?? null;
        },
        [booking]
    );

    const handleRegisterBaggage = useCallback(
        (passengerOrItem: any) => {
            if (!passengerOrItem) {
                Alert.alert('Erreur', 'L\'ID du billet n\'est pas disponible.', [{ text: 'OK' }]);
                return;
            }
            const departureId = booking?.departureId ?? booking?.departure?.id;
            const bookingId = booking?.id;
            if (!departureId || !bookingId) {
                Alert.alert(
                    'Erreur',
                    'Les informations nécessaires pour enregistrer les bagages ne sont pas disponibles.',
                    [{ text: 'OK' }]
                );
                return;
            }
            router.push({
                pathname: '/register-baggage',
                params: {
                    bookingItemId: passengerOrItem?.id,
                    departureId,
                    bookingId,
                },
            });
        },
        [booking]
    );

    const renderDetailRow = useCallback(
        (label: string, value: string | React.ReactNode, showSeparator = false) => (
            <>
                <View style={[styles.detailRow, { justifyContent: 'space-around' }]}>
                    <ThemedText style={[styles.detailLabel, { color: themeColors.labelTextColor }]}>{label}</ThemedText>
                    {typeof value === 'string' ? (
                        <ThemedText style={[styles.detailValue, { color: themeColors.primaryTextColor }]}>{value}</ThemedText>
                    ) : (
                        <ThemedText type="defaultSemiBold" style={{ color: themeColors.primaryTextColor }}>{value}</ThemedText>
                    )}
                </View>
                {showSeparator && <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />}
            </>
        ),
        [themeColors]
    );

    if (!booking) {
        router.back();
        return null;
    }

    return (
        <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
            <ThemedView
                style={[
                    styles.header,
                    { backgroundColor: themeColors.headerBackgroundColor, paddingTop: insets.top + 16 },
                ]}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
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

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={[styles.card, { backgroundColor: themeColors.cardBackgroundColor, borderColor: themeColors.borderColor }]}>
                    {/* Code de réservation */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: themeColors.primaryTextColor }]}>Code de réservation</ThemedText>
                        <View style={[styles.codeContainer, { backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5', borderColor: themeColors.borderColor }]}>
                            <ThemedText style={[styles.codeText, { color: themeColors.primaryTextColor }]}>{booking.code || '--'}</ThemedText>
                        </View>
                    </View>
                    <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />

                    {renderDetailRow(
                        'Statut',
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status, isDark) + '20' }]}>
                            <ThemedText style={[styles.statusText, { color: getStatusColor(booking.status, isDark), textAlign: 'right' }]}>
                                {getStatusLabel(booking.status)}
                            </ThemedText>
                        </View>
                    )}
                    <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />

                    {/* Informations du trajet */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: themeColors.primaryTextColor }]}>Informations du trajet</ThemedText>
                        {renderDetailRow('Type de trajet', getTripTypeLabel(booking.tripType || booking.type))}
                        {renderDetailRow('Ville de départ', booking.trip?.stationFrom?.name || booking.departure?.trip?.stationFrom?.name || '--')}
                        {renderDetailRow('Ville d\'arrivée', booking.trip?.stationTo?.name || booking.departure?.trip?.stationTo?.name || '--')}
                        {booking.trip?.distance && renderDetailRow('Distance', booking.trip.distance + ' km')}
                        {booking.trip?.estimatedDuration && renderDetailRow('Durée estimée', booking.trip.estimatedDuration + ' min')}
                        {booking.trip?.label && renderDetailRow('Label du trajet', booking.trip.label)}
                    </View>
                    <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />

                    {/* Dates et heures */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: themeColors.primaryTextColor }]}>Dates et heures</ThemedText>
                        {renderDetailRow('Date de départ', formatDate(booking.departureDateTime || booking.departure?.departureDateTime))}
                        {renderDetailRow('Heure de départ', booking.departureTime || formatTime(booking.departureDateTime || booking.departure?.departureDateTime))}
                        {booking.arrivalTime && renderDetailRow('Heure d\'arrivée', booking.arrivalTime)}
                        {booking.duration && renderDetailRow('Durée', booking.duration)}
                        {booking.departure?.departureDateTime && renderDetailRow('Date et heure complètes', formatDateTime(booking.departure.departureDateTime))}
                    </View>
                    <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />

                    {/* Paiement */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: themeColors.primaryTextColor }]}>Informations de paiement</ThemedText>
                        {renderDetailRow('Montant total', formatAmount(booking.totalAmount, booking.currency))}
                        {renderDetailRow('Méthode de paiement', getPaymentMethodLabel(booking.paymentMethod))}
                        {booking.paymentProvider && renderDetailRow('Opérateur de paiement', booking.paymentProvider.replaceAll('_', ' ').toUpperCase())}
                        {renderDetailRow('Canal', getChannelLabel(booking.channel))}
                    </View>
                    <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />

                    {/* Bus */}
                    {(booking.bus || booking.returnBus) && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: themeColors.primaryTextColor }]}>Informations des bus</ThemedText>
                                {booking.bus && (
                                    <>
                                        {isRoundTrip && (
                                            <ThemedText style={[styles.busSubtitle, { color: themeColors.secondaryTextColor, marginTop: 8, marginBottom: 12 }]}>Bus aller</ThemedText>
                                        )}
                                        {renderDetailRow('Type de bus', booking.bus?.busType?.toUpperCase() || '--')}
                                        {booking.bus.capacity && renderDetailRow('Capacité', String(booking.bus.capacity))}
                                        {renderDetailRow('Plaque d\'immatriculation', booking.bus.licencePlate || '--')}
                                    </>
                                )}
                                {isRoundTrip && booking.returnBus && (
                                    <>
                                        {booking.bus && <View style={{ marginTop: 16 }} />}
                                        <ThemedText style={[styles.busSubtitle, { color: themeColors.secondaryTextColor, marginTop: booking.bus ? 0 : 8, marginBottom: 12 }]}>Bus retour</ThemedText>
                                        {renderDetailRow('Type de bus', booking.returnBus?.busType?.toUpperCase() || '--')}
                                        {booking.returnBus.capacity && renderDetailRow('Capacité', String(booking.returnBus.capacity))}
                                        {renderDetailRow('Plaque d\'immatriculation', booking.returnBus.licencePlate || '--')}
                                    </>
                                )}
                            </View>
                            <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />
                        </>
                    )}

                    {/* Compagnie */}
                    {booking.companyName && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: themeColors.primaryTextColor }]}>Compagnie</ThemedText>
                                {renderDetailRow('Nom', booking.companyName)}
                                {booking.companyPhones?.length ? (
                                    <View style={styles.detailRow}>
                                        <ThemedText style={[styles.detailLabel, { color: themeColors.labelTextColor }]}>Téléphones</ThemedText>
                                        <View style={styles.phoneList}>
                                            {booking.companyPhones.map((phone, i) => (
                                                <ThemedText key={i} style={[styles.detailValue, { color: themeColors.primaryTextColor }]}>
                                                    {formatPhoneNumber(phone)} {phone.type ? `(${phone.type})` : ''}
                                                </ThemedText>
                                            ))}
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                            <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />
                        </>
                    )}

                    {/* Contact */}
                    {booking.contact && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: themeColors.primaryTextColor }]}>Contact</ThemedText>
                                {booking.contact.firstName && renderDetailRow('Prénom', booking.contact.firstName)}
                                {booking.contact.lastName && renderDetailRow('Nom', booking.contact.lastName)}
                                {booking.contact.email && renderDetailRow('Email', booking.contact.email)}
                                {booking.contact.phone && renderDetailRow('Téléphone', formatPhoneNumber(booking.contact.phone))}
                                {booking.contact.relationship && renderDetailRow('Relation', booking.contact.relationship.toUpperCase())}
                            </View>
                            <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />
                        </>
                    )}

                    {/* Résumé */}
                    {booking.summary && (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: themeColors.primaryTextColor }]}>Résumé</ThemedText>
                                {renderDetailRow('Total des billets', String(booking.summary.totalItems ?? 0))}
                                {renderDetailRow('Billets payés', String(booking.summary.paidItems ?? 0))}
                                {renderDetailRow('Billets utilisés', String(booking.summary.usedItems ?? 0))}
                                {renderDetailRow(
                                    'Validation totale possible',
                                    <View style={[styles.statusBadge, { backgroundColor: (booking.summary.canValidateAll ? '#34C759' : '#FF9500') + '20' }]}>
                                        <ThemedText style={[styles.statusText, { color: booking.summary.canValidateAll ? '#34C759' : '#FF9500' }]}>
                                            {booking.summary.canValidateAll ? 'Oui' : 'Non'}
                                        </ThemedText>
                                    </View>
                                )}
                            </View>
                            <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />
                        </>
                    )}

                    {/* Passagers + bouton bagages (PORTER, sauf si CANCELLED) */}
                    {booking.passengers?.length ? (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: themeColors.primaryTextColor }]}>Passagers ({booking.passengers.length})</ThemedText>
                                {booking.passengers.map((passenger: any, index: number) => {
                                    const item = findItemForPassenger(passenger, index);
                                    const targetForBaggage = item ?? passenger;
                                    return (
                                        <View key={index} style={[styles.passengerCard, { backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5', borderColor: themeColors.borderColor }]}>
                                            <ThemedText style={[styles.passengerTitle, { color: themeColors.primaryTextColor }]}>Passager #{index + 1}</ThemedText>
                                            {passenger.firstName && renderDetailRow('Prénom', passenger.firstName)}
                                            {passenger.lastName && renderDetailRow('Nom', passenger.lastName)}
                                            {passenger.passengerType && renderDetailRow('Type passager', getPassengerTypeLabel(passenger.passengerType))}
                                            {passenger.seatNumber && renderDetailRow('Siège', 'Nº'+ passenger.seatNumber)}
                                            {showBaggageButton && (
                                                <View style={[styles.baggageButtonContainer, { borderTopColor: themeColors.separatorColor }]}>
                                                    <TouchableOpacity
                                                        style={[styles.baggageButton, { backgroundColor: '#1776BA' }]}
                                                        onPress={() => handleRegisterBaggage(targetForBaggage)}
                                                    >
                                                        <MaterialIcons name="luggage" size={20} color="#FFFFFF" />
                                                        <ThemedText style={styles.baggageButtonText}>Enregistrer bagages</ThemedText>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                            <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />
                        </>
                    ) : null}

                    {/* Billets */}
                    {booking.items?.length ? (
                        <>
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: themeColors.primaryTextColor }]}>Billets ({booking.items.length})</ThemedText>
                                {booking.items.map((item: any, index: number) => (
                                    <View key={index} style={[styles.itemCard, { backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5', borderColor: themeColors.borderColor }]}>
                                        <View style={styles.itemHeader}>
                                            <ThemedText style={[styles.itemTitle, { color: themeColors.primaryTextColor }]}>Billet #{index + 1}</ThemedText>
                                            {item.status && (
                                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status, isDark) + '20' }]}>
                                                    <ThemedText style={[styles.statusText, { color: getStatusColor(item.status, isDark) }]}>{getStatusLabel(item.status)}</ThemedText>
                                                </View>
                                            )}
                                        </View>
                                        {item.firstName && renderDetailRow('Prénom', item.firstName)}
                                        {item.lastName && renderDetailRow('Nom', item.lastName)}
                                        {item.passengerType && renderDetailRow('Type de passager', getPassengerTypeLabel(item.passengerType))}
                                        {item.seatNumber && renderDetailRow('Numéro de siège', item.seatNumber)}
                                        {item.leg && renderDetailRow('Type de trajet', getLegLabel(item.leg))}
                                        {item.canValidate !== undefined &&
                                            renderDetailRow(
                                                'Peut être validé',
                                                <View style={[styles.statusBadge, { backgroundColor: (item.canValidate ? '#34C759' : '#FF9500') + '20' }]}>
                                                    <ThemedText style={[styles.statusText, { color: item.canValidate ? '#34C759' : '#FF9500' }]}>{item.canValidate ? 'Oui' : 'Non'}</ThemedText>
                                                </View>
                                            )}
                                    </View>
                                ))}
                            </View>
                            <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />
                        </>
                    ) : null}

                    {/* Dates */}
                    {(booking.createdAt || booking.updatedAt) && (
                        <View style={styles.section}>
                            <ThemedText style={[styles.sectionTitle, { color: themeColors.primaryTextColor }]}>Dates</ThemedText>
                            {booking.createdAt && renderDetailRow('Date de réservation', formatDateTime(booking.createdAt))}
                        </View>
                    )}

                    {/* Statut du départ */}
                    {booking.departure?.status && (
                        <>
                            <View style={[styles.separator, { backgroundColor: themeColors.separatorColor }]} />
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: themeColors.primaryTextColor }]}>Statut du départ</ThemedText>
                                {renderDetailRow(
                                    'Statut',
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.departure!.status, isDark) + '20' }]}>
                                        <ThemedText style={[styles.statusText, { color: getStatusColor(booking.departure!.status, isDark) }]}>
                                            {getStatusLabel(booking.departure!.status)}
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
