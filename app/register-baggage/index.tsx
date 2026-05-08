import { baseUrl } from '@/api/config';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { styles } from '@/styles/registerLuggageList';
import { getLuggageStatusColor, getLuggageStatusLabel, getStatusIcon, isCheckedInStatus } from '@/utils/luggage-utils';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/** Enum pour les types de bagages */
export enum LuggageType {
    CABIN = 'CABIN',
    CHECKED = 'CHECKED',
    OVERSIZED = 'OVERSIZED',
    FRAGILE = 'FRAGILE',
    SPORTS_EQUIPMENT = 'SPORTS_EQUIPMENT',
}

/** Interface pour les dimensions d'un bagage */
interface LuggageDimensions {
    length: number;
    width: number;
    height: number;
    total: number;
}

/** Interface pour un trajet de départ utilisé pour l'enregistrement bagage */
interface DepartureTrip {
    departureTripId: string;
    trip?: {
        label?: string;
        calculatedPrice?: string;
        stationFrom?: { name?: string };
        stationTo?: { name?: string };
    };
}

/** Interface pour un bagage */
interface LuggageItem {
    type: LuggageType;
    estimatedWeight: number;
    estimatedDimensions: LuggageDimensions;
    description: string;
    isFragile: boolean;
}

/** Interface pour un bagage existant (avec ID et toutes les propriétés de l'API) */
interface ExistingLuggage extends LuggageItem {
    id: string;
    status?: string;
    tagNumber?: string;
    qrCode?: string;
    price?: number;
    basePrice?: number;
    excessWeightFee?: number;
    oversizedFee?: number;
    fragileFee?: number;
    currency?: string;
    actualWeight?: number;
    actualDimensions?: LuggageDimensions;
    registeredAt?: string;
    checkedInAt?: string;
    loadedAt?: string;
    unloadedAt?: string;
    deliveredAt?: string;
    cancelledAt?: string;
    stationId?: string;
    createdAt?: string;
    updatedAt?: string;
}

/** Convertit le type de bagage en libellé français */
export const getLuggageTypeLabel = (type: LuggageType): string => {
    const TYPE_MAPPING: Record<LuggageType, string> = {
        [LuggageType.CABIN]: 'Bagage cabine',
        [LuggageType.CHECKED]: 'Bagage soute',
        [LuggageType.OVERSIZED]: 'Bagage surdimensionné',
        [LuggageType.FRAGILE]: 'Bagage fragile',
        [LuggageType.SPORTS_EQUIPMENT]: 'Équipement sportif',
    };
    return TYPE_MAPPING[type] || type;
};


/** Écran de gestion des bagages - Affiche la liste des bagages enregistrés et permet d'en ajouter de nouveaux */
export default function RegisterBaggageScreen() {
    const isDark = useColorScheme() === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ bookingItemId: string; departureId: string; bookingId: string; departureTrips: string }>();
    const [luggageList, setLuggageList] = useState<ExistingLuggage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showTripPickerSheet, setShowTripPickerSheet] = useState(false);
    const [showCheckInChoiceSheet, setShowCheckInChoiceSheet] = useState(false);
    const [showPriceSheet, setShowPriceSheet] = useState(false);
    const [selectedLuggage, setSelectedLuggage] = useState<ExistingLuggage | null>(null);
    const [manualPriceInput, setManualPriceInput] = useState('');
    const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);

    const colors = {
        headerBg: isDark ? '#1A1A1A' : '#1776BA',
        cardBg: isDark ? '#1A1A1A' : '#FFFFFF',
        primaryText: isDark ? '#FFFFFF' : '#11181C',
        secondaryText: isDark ? '#9BA1A6' : '#666666',
        labelText: isDark ? '#9BA1A6' : '#999999',
        border: isDark ? '#3A3A3C' : '#E0E0E0',
        separator: isDark ? '#3A3A3C' : '#E5E5E5',
        containerBg: isDark ? '#000000' : '#F3F3F7',
        luggageCardBg: isDark ? '#2A2A2A' : '#F5F5F5',
    };

    /**
     * Récupère les trajets du départ
     */
    const departureTrips = useMemo<DepartureTrip[] | null>(() => {
        try {
            if (params.departureTrips) {
                return JSON.parse(params.departureTrips) as DepartureTrip[];
            }
        } catch (error) {
            console.error('Erreur lors du parsing des données des trajets du départ:', error);
        }
        return null;
    }, [params.departureTrips]);

    console.log('departureTrips register baggage ===> ', departureTrips);

    /** Charge la liste des bagages du passager */
    const loadLuggageList = async () => {
        try {
            setIsLoading(true);
            const token = await AsyncStorage.getItem('token');
            if (!token) throw new Error('Token non disponible');
            const response = await axios.get(`${baseUrl}/luggage/booking-item/${params.bookingItemId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data) {
                console.log('response.data Luggage ===>, ', JSON.stringify(response.data));
                setLuggageList(response.data || []);
            }
        } catch (error: any) {
            console.error('Erreur lors du chargement des bagages:', error);
            if (error.response?.status !== 404) {
                Alert.alert('Erreur', error.response?.data?.message || 'Une erreur est survenue lors du chargement des bagages.', [{ text: 'OK' }]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Ouvre le sélecteur de trajet avant l'enregistrement d'un bagage.
     */
    const handleOpenTripPicker = () => {
        if (!departureTrips?.length) {
            Alert.alert('Information', 'Aucun trajet disponible pour ce départ.');
            return;
        }
        setShowTripPickerSheet(true);
    };

    /**
     * Navigue vers l'écran d'ajout de bagages avec le trajet choisi.
     */
    const handleSelectTrip = (departureTripId: string) => {
        setShowTripPickerSheet(false);
        router.push({
            pathname: '/register-baggage/add',
            params: {
                bookingItemId: params.bookingItemId,
                bookingId: params.bookingId,
                departureId: params.departureId,
                departureTripId,
            },
        });
    };


    /** Navigue vers l'écran de détails d'un bagage */
    const navigateToLuggageDetails = (luggage: ExistingLuggage) => router.push({
        pathname: '/register-baggage/details',
        params: { luggageData: JSON.stringify(luggage), bookingItemId: params.bookingItemId, departureId: params.departureId, bookingId: params.bookingId },
    });

    /**
     * Gère le clic sur un bagage de la liste.
     */
    const handleLuggagePress = (luggage: ExistingLuggage) => {
        if (luggage.status?.toUpperCase() === 'REGISTERED') {
            setSelectedLuggage(luggage);
            setShowCheckInChoiceSheet(true);
            return;
        }
        setShowCheckInChoiceSheet(false);
        setSelectedLuggage(null);
        navigateToLuggageDetails(luggage);
    };

    /**
     * Lance le parcours check-in avec les informations détaillées.
     */
    const handleSelectDetailedCheckIn = () => {
        if (!selectedLuggage) return;
        setShowCheckInChoiceSheet(false);
        navigateToLuggageDetails(selectedLuggage);
    };

    /**
     * Ouvre la saisie du prix direct pour check-in.
     */
    const handleSelectManualPrice = () => {
        setShowCheckInChoiceSheet(false);
        setShowPriceSheet(true);
    };

    /**
     * Valide et envoie un check-in avec prix direct.
     */
    const handleSubmitManualPriceCheckIn = async () => {
        if (!selectedLuggage) return;
        const price = Number.parseFloat(manualPriceInput.replace(',', '.'));
        if (!Number.isFinite(price) || price <= 0) {
            Alert.alert('Erreur', 'Veuillez saisir un montant valide.');
            return;
        }
        try {
            setIsSubmittingCheckIn(true);
            const token = await AsyncStorage.getItem('token');
            if (!token) throw new Error('Token non disponible');

            const payload = { price };

            await axios.post(`${baseUrl}/luggage/${selectedLuggage.id}/check-in`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setShowPriceSheet(false);
            setManualPriceInput('');
            setSelectedLuggage(null);
            await loadLuggageList();
            Alert.alert('Succès', 'Le check-in avec montant estimé a été effectué.');
        } catch (error: any) {
            Alert.alert('Erreur', error.response?.data?.message || 'Une erreur est survenue lors du check-in.');
        } finally {
            setIsSubmittingCheckIn(false);
        }
    };

    useEffect(() => { if (params.bookingItemId) loadLuggageList(); }, [params.bookingItemId]);
    useFocusEffect(useCallback(() => { if (params.bookingItemId) loadLuggageList(); }, [params.bookingItemId]));

    const statusUpper = (s?: string) => s?.toUpperCase();

    /**
     * Formate le montant calculé d'un trajet pour l'affichage.
     */
    const formatTripAmount = (amount?: string): string => {
        const value = Number.parseFloat(amount || '0');
        if (!Number.isFinite(value) || value <= 0) return '--';
        return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XOF`;
    };

    return (
        <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.containerBg }]}>
            <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + 8, paddingBottom: 16 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity style={[styles.headerButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]} onPress={() => router.back()}>
                        <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>Gestion des bagages</Text>
                    <View style={styles.headerButton} />
                </View>
            </View>
            <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} showsVerticalScrollIndicator={false}>
                <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Bagages enregistrés ({luggageList.length})</Text>
                        {isLoading ? (
                            <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1776BA" /></View>
                        ) : luggageList.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <MaterialIcons name="luggage" size={48} color={colors.secondaryText} />
                                <ThemedText style={[styles.emptyText, { color: colors.secondaryText }]}>Aucun bagage enregistré</ThemedText>
                            </View>
                        ) : (
                            luggageList.map((luggage, index) => {
                                const statusColor = getLuggageStatusColor(luggage.status, isDark);
                                const checkedIn = isCheckedInStatus(luggage.status);
                                const hintText = statusUpper(luggage.status) === 'REGISTERED' 
                                    ? 'Voir les détails et faire le check-in'
                                    : checkedIn ? 'Voir les détails, QR code et suppléments' : 'Voir les détails';
                                return (
                                    <TouchableOpacity key={luggage.id || index} style={[styles.luggageCard, { backgroundColor: colors.luggageCardBg, borderColor: colors.border }]} onPress={() => handleLuggagePress(luggage)} activeOpacity={0.7}>
                                        <View style={styles.luggageHeader}>
                                            <View style={[styles.luggageHeaderLeft, { justifyContent: 'space-between' }]}>
                                                <ThemedText style={[styles.luggageTitle, { color: colors.primaryText }]}>Bagage #{index + 1}</ThemedText>
                                                <View style={[styles.typeBadge, { backgroundColor: '#1776BA20' }]}>
                                                    <ThemedText style={[styles.typeText, { color: '#1776BA' }]}>{getLuggageTypeLabel(luggage.type)}</ThemedText>
                                                </View>
                                            </View>
                                        </View>
                                        {luggage.status && (
                                            <View style={styles.statusSection}>
                                                <View style={[styles.statusBadgeLarge, { backgroundColor: statusColor + '20' }]}>
                                                    <MaterialIcons name={getStatusIcon(luggage.status) as any} size={16} color={statusColor} />
                                                    <ThemedText style={[styles.statusTextLarge, { color: statusColor }]}>{getLuggageStatusLabel(luggage.status)}</ThemedText>
                                                </View>
                                            </View>
                                        )}
                                        <View style={styles.luggageDetails}>
                                            <View style={styles.detailRow}>
                                                <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>Poids</ThemedText>
                                                <ThemedText style={[styles.detailValue, { color: colors.primaryText }]}>{luggage.estimatedWeight} kg</ThemedText>
                                            </View>
                                            <View style={styles.detailRow}>
                                                <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>Dimensions</ThemedText>
                                                <ThemedText style={[styles.detailValue, { color: colors.primaryText }]}>{luggage.estimatedDimensions.length} x {luggage.estimatedDimensions.width} x {luggage.estimatedDimensions.height} cm</ThemedText>
                                            </View>
                                            <View style={styles.detailRow}>
                                                <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>Total</ThemedText>
                                                <ThemedText style={[styles.detailValue, { color: colors.primaryText }]}>{luggage.estimatedDimensions.total} cm³</ThemedText>
                                            </View>
                                            <View style={styles.detailRow}>
                                                <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>Description</ThemedText>
                                                <ThemedText style={[styles.detailValue, { color: colors.primaryText }]}>{luggage.description || '--'}</ThemedText>
                                            </View>
                                            <View style={styles.detailRow}>
                                                <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>Fragile</ThemedText>
                                                <View style={[styles.fragileBadge, { backgroundColor: luggage.isFragile ? '#FF950020' : '#34C75920' }]}>
                                                    <ThemedText style={[styles.fragileText, { color: luggage.isFragile ? '#FF9500' : '#34C759' }]}>{luggage.isFragile ? 'Oui' : 'Non'}</ThemedText>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={[styles.tapHint, { borderTopColor: colors.separator, justifyContent: 'center' }]}>
                                            <ThemedText style={[styles.tapHintText, { color: statusColor }]}>{hintText}</ThemedText>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                </View>
                <View style={styles.addButtonContainer}>
                    <TouchableOpacity style={[styles.addButton, { backgroundColor: '#1776BA' }]} onPress={handleOpenTripPicker}>
                        <MaterialIcons name="add" size={28} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </ScrollView>
            <Modal visible={showTripPickerSheet} animationType="slide" transparent onRequestClose={() => setShowTripPickerSheet(false)}>
                <View style={styles.sheetOverlay}>
                    <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowTripPickerSheet(false)} />
                    <View style={[styles.sheetContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                        <View style={[styles.sheetHandle, { backgroundColor: colors.separator }]} />
                        <ThemedText style={[styles.sheetTitle, { color: colors.primaryText }]}>Choisir un trajet</ThemedText>
                        <ThemedText style={[styles.sheetSubtitle, { color: colors.secondaryText }]}>Sélectionnez le trajet pour lequel vous voulez enregistrer le bagage</ThemedText>
                        {(departureTrips || []).map((trip, index) => {
                            const from = trip.trip?.stationFrom?.name || '--';
                            const to = trip.trip?.stationTo?.name || '--';
                            const title = trip.trip?.label || `Trajet ${index + 1}`;
                            const calculatedAmount = formatTripAmount(trip.trip?.calculatedPrice);
                            return (
                                <TouchableOpacity key={trip.departureTripId || `${title}-${index}`} style={[styles.sheetOptionButton, { borderColor: colors.border }]} onPress={() => handleSelectTrip(trip.departureTripId)}>
                                    <MaterialIcons name="alt-route" size={20} color="#1776BA" />
                                    <View style={styles.sheetOptionContent}>
                                        <ThemedText style={[styles.sheetOptionTitle, { color: colors.primaryText }]}>{title}</ThemedText>
                                        <ThemedText style={[styles.sheetOptionDescription, { color: colors.secondaryText }]}>{from}{' -> '}{to}</ThemedText>
                                        <ThemedText style={[styles.sheetOptionDescription, { color: colors.secondaryText }]}>Montant: {calculatedAmount}</ThemedText>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </Modal>
            <Modal visible={showCheckInChoiceSheet && selectedLuggage?.status?.toUpperCase() === 'REGISTERED'} animationType="slide" transparent onRequestClose={() => setShowCheckInChoiceSheet(false)}>
                <View style={styles.sheetOverlay}>
                    <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowCheckInChoiceSheet(false)} />
                    <View style={[styles.sheetContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                        <View style={[styles.sheetHandle, { backgroundColor: colors.separator }]} />
                        <ThemedText style={[styles.sheetTitle, { color: colors.primaryText }]}>Effectuer le check-in</ThemedText>
                        <ThemedText style={[styles.sheetSubtitle, { color: colors.secondaryText }]}>Choisissez une option</ThemedText>
                        <TouchableOpacity style={[styles.sheetOptionButton, { borderColor: colors.border }]} onPress={handleSelectManualPrice}>
                            <MaterialIcons name="payments" size={20} color="#1776BA" />
                            <View style={styles.sheetOptionContent}>
                                <ThemedText style={[styles.sheetOptionTitle, { color: colors.primaryText }]}>Renseigner le prix du bagage</ThemedText>
                                <ThemedText style={[styles.sheetOptionDescription, { color: colors.secondaryText }]}>Saisir directement le montant estimé</ThemedText>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.sheetOptionButton, { borderColor: colors.border }]} onPress={handleSelectDetailedCheckIn}>
                            <MaterialIcons name="edit-note" size={20} color="#1776BA" />
                            <View style={styles.sheetOptionContent}>
                                <ThemedText style={[styles.sheetOptionTitle, { color: colors.primaryText }]}>Faire le check-in des infos de base</ThemedText>
                                <ThemedText style={[styles.sheetOptionDescription, { color: colors.secondaryText }]}>Renseigner poids et dimensions</ThemedText>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <Modal visible={showPriceSheet} animationType="slide" transparent onRequestClose={() => setShowPriceSheet(false)}>
                <View style={styles.sheetOverlay}>
                    <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowPriceSheet(false)} />
                    <View style={[styles.sheetContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                        <View style={[styles.sheetHandle, { backgroundColor: colors.separator }]} />
                        <ThemedText style={[styles.sheetTitle, { color: colors.primaryText }]}>Montant estimé</ThemedText>
                        <TextInput
                            style={[styles.priceInput, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.containerBg }]}
                            value={manualPriceInput}
                            onChangeText={setManualPriceInput}
                            keyboardType="decimal-pad"
                            placeholder="Ex: 5000"
                            placeholderTextColor={colors.secondaryText}
                        />
                        <TouchableOpacity style={[styles.sheetSubmitButton, { opacity: isSubmittingCheckIn ? 0.6 : 1 }]} onPress={handleSubmitManualPriceCheckIn} disabled={isSubmittingCheckIn}>
                            {isSubmittingCheckIn ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.sheetSubmitButtonText}>Valider</ThemedText>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}