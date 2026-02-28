import { deliverLuggageApi, loadLuggageApi, unLoadLuggageApi } from '@/api/departures';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { styles } from '@/styles/scan-luggage-result';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Résumé réservation associée au bagage */
interface BaggageBooking {
    id: string;
    code: string;
    trip: string;
    bookingDateTime: string;
}

/** Dimensions (total, width, height, length en cm) */
interface BaggageDimensions {
    total: number;
    width: number;
    height: number;
    length: number;
}

/** Réponse API vérification QR code bagage */
interface BaggageFromQR {
    id: string;
    bookingItemId: string;
    booking: BaggageBooking;
    type: string;
    status: string;
    estimatedWeight: number;
    actualWeight: number;
    estimatedDimensions: BaggageDimensions;
    actualDimensions: BaggageDimensions;
    price: number;
    basePrice: number;
    excessWeightFee: number;
    oversizedFee: number;
    fragileFee: number;
    currency: string;
    tagNumber: string;
    description?: string;
    isFragile: boolean;
    vehicleCompartment?: string | null;
    position?: string | null;
    stationId?: string;
    registeredAt: string;
    checkedInAt: string | null;
    loadedAt: string | null;
    [key: string]: unknown;
}

const BAGGAGE_TYPE_LABELS: Record<string, string> = { CABIN: 'Cabine', HOLD: 'Soute' };
const STATUS_LABELS: Record<string, string> = {
    CHECKED_IN: 'Enregistré',
    LOADED: 'Chargé',
    UNLOADED: 'Déchargé',
    DELIVERED: 'Livré',
    CANCELLED: 'Annulé',
};

function getBaggageTypeLabel(type: string): string {
    return BAGGAGE_TYPE_LABELS[type] ?? type;
}

function getStatusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
}

function formatDateTime(iso?: string | null): string {
    if (!iso) return '--';
    try {
        return new Date(iso).toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

type LoadingAction = 'load' | 'unload' | 'deliver' | null;

/**
 * Écran résultat du scan QR bagage : infos du bagage + actions Charger / Décharger / Livrer.
 */
export default function ScanLuggageResultScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ luggageData: string }>();
    const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
    const [stationId, setStationId] = useState<string | null>(null);

    const luggage = useMemo((): BaggageFromQR | null => {
        try {
            if (params.luggageData) return JSON.parse(params.luggageData) as BaggageFromQR;
        } catch (e) {
            console.error('[scan-luggage-result] Parse luggageData:', e);
        }
        return null;
    }, [params.luggageData]);

    const effectiveStationId = stationId ?? luggage?.stationId ?? null;

    const colors = useMemo(
        () => ({
            bg: isDark ? '#000000' : '#F3F3F7',
            cardBg: isDark ? '#1A1A1A' : '#FFFFFF',
            border: isDark ? '#3A3A3C' : '#E0E0E0',
            primary: isDark ? '#FFFFFF' : '#11181C',
            secondary: isDark ? '#9BA1A6' : '#666666',
            headerBg: isDark ? '#1A1A1A' : '#1776BA',
            success: '#34C759',
        }),
        [isDark]
    );

    const getToken = useCallback(async () => {
        const token = await AsyncStorage.getItem('token');
        if (!token) throw new Error('Token non disponible');
        return token;
    }, []);

    const showError = useCallback((message: string) => {
        Alert.alert('Erreur', message);
    }, []);

    const showSuccess = useCallback((message: string) => {
        Alert.alert('Succès', message);
    }, []);

    /**
     * Confirmation puis exécution d’une action (load / unload / deliver).
     */
    const confirmThenRun = useCallback(
        (title: string, message: string, action: LoadingAction, run: () => Promise<void>) => {
            if (loadingAction) return;
            Alert.alert(title, message, [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Confirmer', onPress: async () => {
                    setLoadingAction(action);
                    try {
                        await run();
                    } finally {
                        setLoadingAction(null);
                    }
                } },
            ]);
        },
        [loadingAction]
    );

    const loadLuggageInBus = useCallback(async () => {
        if (!luggage) return;
        try {
            const token = await getToken();
            if (!luggage.vehicleCompartment || !luggage.position) {
                showError('Compartiment et position du bagage non disponibles.');
                return;
            }
            const response = await loadLuggageApi(
                { vehicleCompartment: luggage.vehicleCompartment, position: luggage.position },
                luggage.id,
                token
            );
            if (response.data?.stationId) setStationId(response.data.stationId);
            response.data ? showSuccess('Bagage marqué comme chargé.') : showError('Erreur lors du chargement.');
        } catch (e: any) {
            showError(e.response?.data?.message ?? 'Une erreur est survenue lors du chargement du bagage.');
        }
    }, [luggage, getToken, showError, showSuccess]);

    const unloadLuggageFromBus = useCallback(async () => {
        if (!luggage || !effectiveStationId) {
            showError('Station ID non disponible.');
            return;
        }
        try {
            const token = await getToken();
            const response = await unLoadLuggageApi({ stationId: effectiveStationId }, luggage.id, token);
            response.data ? showSuccess('Bagage marqué comme déchargé/perdu.') : showError('Erreur lors du déchargement.');
        } catch (e: any) {
            showError(e.response?.data?.message ?? 'Une erreur est survenue lors du déchargement du bagage.');
        }
    }, [luggage, effectiveStationId, getToken, showError, showSuccess]);

    const deliverLuggageToPassenger = useCallback(async () => {
        if (!luggage || !effectiveStationId) {
            showError('Station ID non disponible.');
            return;
        }
        try {
            const token = await getToken();
            const response = await deliverLuggageApi({ stationId: effectiveStationId }, luggage.id, token);
            response.data ? showSuccess('Bagage marqué comme livré au passager.') : showError('Erreur lors de la livraison.');
        } catch (e: any) {
            showError(e.response?.data?.message ?? 'Une erreur est survenue lors de la livraison du bagage.');
        }
    }, [luggage, effectiveStationId, getToken, showError, showSuccess]);

    const handleLoadInBus = useCallback(() => {
        confirmThenRun(
            'Charger dans le bus',
            `Confirmer le chargement du bagage ${luggage?.tagNumber} dans le bus ?`,
            'load',
            loadLuggageInBus
        );
    }, [luggage?.tagNumber, loadingAction, confirmThenRun, loadLuggageInBus]);

    const handleUnloadFromBus = useCallback(() => {
        confirmThenRun(
            'Décharger / Marquer comme perdu',
            `Confirmer le déchargement du bagage ${luggage?.tagNumber} ou le marquer comme perdu ?`,
            'unload',
            unloadLuggageFromBus
        );
    }, [luggage?.tagNumber, loadingAction, confirmThenRun, unloadLuggageFromBus]);

    const handleDeliverLuggage = useCallback(() => {
        confirmThenRun(
            'Livrer le bagage',
            `Confirmer la livraison du bagage ${luggage?.tagNumber} au passager ?`,
            'deliver',
            deliverLuggageToPassenger
        );
    }, [luggage?.tagNumber, loadingAction, confirmThenRun, deliverLuggageToPassenger]);

    if (!luggage) {
        router.back();
        return null;
    }

    const dims = luggage.actualDimensions ?? luggage.estimatedDimensions;
    const weight = luggage.actualWeight ?? luggage.estimatedWeight;
    const currency = luggage.currency ?? 'XOF';
    const detailRows: { label: string; value: string }[] = [
        { label: 'Type de bagage', value: getBaggageTypeLabel(luggage.type) },
        { label: 'Trajet', value: luggage.booking?.trip ?? '--' },
        { label: 'Réservation', value: luggage.booking?.code ?? '--' },
        { label: 'Date réservation', value: formatDateTime(luggage.booking?.bookingDateTime) },
        { label: 'Date création', value: formatDateTime(luggage.registeredAt) },
        { label: 'Date enregistrement', value: formatDateTime(luggage.checkedInAt) },
        { label: 'Poids', value: `${weight} kg` },
        { label: 'Dimensions', value: dims ? `${dims.width} × ${dims.height} × ${dims.length} cm` : '--' },
        { label: 'Prix total', value: `${luggage.price ?? 0} ${currency}` },
        { label: 'Prix de base', value: `${luggage.basePrice ?? 0} ${currency}` },
        { label: 'Frais excédent poids', value: `${luggage.excessWeightFee ?? 0} ${currency}` },
        { label: 'Frais surdimension', value: `${luggage.oversizedFee ?? 0} ${currency}` },
        { label: 'Frais fragilité', value: `${luggage.fragileFee ?? 0} ${currency}` },
    ];

    const isLoadLoading = loadingAction === 'load';
    const isUnloadLoading = loadingAction === 'unload';
    const isDeliverLoading = loadingAction === 'deliver';

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, { color: '#FFFFFF' }]}>Résultat scan bagage</ThemedText>
                <View style={styles.headerButton} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    <View style={[styles.successBadge, { backgroundColor: colors.success }]}>
                        <ThemedText style={styles.successBadgeText}>{getStatusLabel(luggage.status)}</ThemedText>
                    </View>
                    <ThemedText style={[styles.tagNumber, { color: colors.primary }]}>{luggage.tagNumber}</ThemedText>

                    {detailRows.map((row, index) => (
                        <View
                            key={row.label}
                            style={[
                                styles.detailRow,
                                { borderColor: colors.border },
                                index === detailRows.length - 1 && styles.detailRowLast,
                            ]}
                        >
                            <ThemedText style={[styles.detailLabel, { color: colors.secondary }]}>{row.label}</ThemedText>
                            <ThemedText style={[styles.detailValue, { color: colors.primary }]} numberOfLines={2}>
                                {row.value}
                            </ThemedText>
                        </View>
                    ))}

                    {luggage.description ? (
                        <View style={[styles.descriptionBlock, { borderColor: colors.border }]}>
                            <ThemedText style={[styles.descriptionLabel, { color: colors.secondary }]}>Description</ThemedText>
                            <ThemedText style={[styles.descriptionText, { color: colors.primary }]}>{luggage.description}</ThemedText>
                        </View>
                    ) : null}
                </View>
            </ScrollView>

            {luggage.status === 'CHECKED_IN' && (
                <View style={[styles.loadButtonContainer, { paddingBottom: insets.bottom + 16, backgroundColor: colors.bg }]}>
                    <TouchableOpacity
                        style={styles.loadButton}
                        onPress={handleLoadInBus}
                        activeOpacity={0.8}
                        disabled={!!loadingAction}
                    >
                        {isLoadLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <MaterialIcons name="local-shipping" size={22} color="#FFFFFF" />
                        )}
                        <ThemedText style={styles.loadButtonText}>Charger dans le bus</ThemedText>
                    </TouchableOpacity>
                </View>
            )}

            {luggage.status === 'LOADED' && (
                <View style={[styles.unloadButtonContainer, { paddingBottom: insets.bottom + 16, backgroundColor: colors.bg }]}>
                    <TouchableOpacity
                        style={[styles.unloadButton, styles.deliverButton]}
                        onPress={handleDeliverLuggage}
                        activeOpacity={0.8}
                        disabled={!!loadingAction}
                    >
                        {isDeliverLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                        <ThemedText style={styles.unloadButtonText}>Livrer</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.unloadButton, styles.lostButton]}
                        onPress={handleUnloadFromBus}
                        activeOpacity={0.8}
                        disabled={!!loadingAction}
                    >
                        {isUnloadLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                        <ThemedText style={styles.unloadButtonText}>Perdu</ThemedText>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
