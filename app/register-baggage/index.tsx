import { baseUrl } from '@/api/config';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Enum pour les types de bagages
 */
export enum LuggageType {
    CABIN = 'CABIN', // Bagage cabine
    CHECKED = 'CHECKED', // Bagage soute standard
    OVERSIZED = 'OVERSIZED', // Bagage surdimensionné
    FRAGILE = 'FRAGILE', // Bagage fragile
    SPORTS_EQUIPMENT = 'SPORTS_EQUIPMENT', // Équipement sportif
}

/**
 * Interface pour les dimensions d'un bagage
 */
interface LuggageDimensions {
    length: number;
    width: number;
    height: number;
    total: number;
}

/**
 * Interface pour un bagage
 */
interface LuggageItem {
    type: LuggageType;
    estimatedWeight: number;
    estimatedDimensions: LuggageDimensions;
    description: string;
    isFragile: boolean;
}

/**
 * Interface pour un bagage existant (avec ID et toutes les propriétés de l'API)
 */
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


/**
 * Convertit le type de bagage en libellé français
 * @param type - Le type de bagage
 * @returns Le libellé français
 */
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

/**
 * Convertit un statut de bagage en libellé français
 * @param status - Le statut technique (ex: "REGISTERED")
 * @returns Le libellé français correspondant
 */
const getLuggageStatusLabel = (status?: string): string => {
    if (!status) return '--';

    const STATUS_MAPPING: Record<string, string> = {
        'REGISTERED': 'Enregistré',
        'CHECKED_IN': 'Vérifié',
        'LOADED': 'Chargé',
        'UNLOADED': 'Déchargé',
        'DELIVERED': 'Livré',
        'CANCELLED': 'Annulé',
    };

    return STATUS_MAPPING[status.toUpperCase()] || status;
};

/**
 * Récupère la couleur associée à un statut de bagage
 * @param status - Le statut technique
 * @param isDark - Indique si le thème est sombre
 * @returns La couleur correspondante
 */
const getLuggageStatusColor = (status?: string, isDark: boolean = false): string => {
    if (!status) return isDark ? '#98989D' : '#8E8E93';

    const STATUS_COLOR_MAPPING: Record<string, { light: string; dark: string }> = {
        'REGISTERED': { light: '#1776BA', dark: '#1776BA' },
        'CHECKED_IN': { light: '#34C759', dark: '#30D158' },
        'LOADED': { light: '#5856D6', dark: '#5E5CE6' },
        'UNLOADED': { light: '#FF9500', dark: '#FF9F0A' },
        'DELIVERED': { light: '#34C759', dark: '#30D158' },
        'CANCELLED': { light: '#FF3B30', dark: '#FF453A' },
    };

    const colorMapping = STATUS_COLOR_MAPPING[status.toUpperCase()];
    return colorMapping
        ? (isDark ? colorMapping.dark : colorMapping.light)
        : (isDark ? '#98989D' : '#8E8E93');
};

/**
 * Écran de gestion des bagages
 * Affiche la liste des bagages enregistrés et permet d'en ajouter de nouveaux
 */
export default function RegisterBaggageScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        bookingItemId: string;
        departureId: string;
        bookingId: string;
    }>();

    const [luggageList, setLuggageList] = useState<ExistingLuggage[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Couleurs pour le mode clair et sombre
    const headerBackgroundColor = isDark ? '#1A1A1A' : '#1776BA';
    const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
    const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
    const secondaryTextColor = isDark ? '#9BA1A6' : '#666666';
    const labelTextColor = isDark ? '#9BA1A6' : '#999999';
    const borderColor = isDark ? '#3A3A3C' : '#E0E0E0';
    const separatorColor = isDark ? '#3A3A3C' : '#E5E5E5';
    const inputBackgroundColor = isDark ? '#2C2C2E' : '#FFFFFF';
    const inputBorderColor = isDark ? '#3A3A3C' : '#E0E0E0';

    /**
     * Charge la liste des bagages du passager
     */
    const loadLuggageList = async () => {
        try {
            setIsLoading(true);
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                throw new Error('Token non disponible');
            }

            const response = await axios.get(
                `${baseUrl}/luggage/booking-item/${params.bookingItemId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.data) {
                console.log('response.data Luggage ===>, ', JSON.stringify(response.data));
                setLuggageList(response.data || []);
            }
        } catch (error: any) {
            console.error('Erreur lors du chargement des bagages:', error);
            // Ne pas afficher d'erreur si c'est juste qu'il n'y a pas de bagages
            if (error.response?.status !== 404) {
                Alert.alert(
                    'Erreur',
                    error.response?.data?.message || 'Une erreur est survenue lors du chargement des bagages.',
                    [{ text: 'OK' }]
                );
            }
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Navigue vers l'écran d'ajout de bagages
     */
    const handleNavigateToAdd = () => {
        router.push({
            pathname: '/register-baggage/add',
            params: {
                bookingItemId: params.bookingItemId,
                bookingId: params.bookingId,
                departureId: params.departureId,
            },
        });
    };

    /**
     * Gère le retour à l'écran précédent
     */
    const handleBack = () => {
        router.back();
    };

    /**
     * Navigue vers l'écran de détails d'un bagage
     * @param luggage - Le bagage à afficher
     */
    const handleLuggagePress = (luggage: ExistingLuggage) => {
        router.push({
            pathname: '/register-baggage/details',
            params: {
                luggageData: JSON.stringify(luggage),
                bookingItemId: params.bookingItemId,
                departureId: params.departureId,
                bookingId: params.bookingId,
            },
        });
    };

    useEffect(() => {
        if (params.bookingItemId) {
            loadLuggageList();
        }
    }, [params.bookingItemId]);

    /**
     * Recharge la liste des bagages quand l'écran est focus
     */
    useFocusEffect(
        useCallback(() => {
            if (params.bookingItemId) {
                loadLuggageList();
            }
        }, [params.bookingItemId])
    );

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
                        Gestion des bagages
                    </ThemedText>

                    <View style={styles.headerButton} />
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Liste des bagages existants */}
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: cardBackgroundColor,
                            borderColor: borderColor,
                        },
                    ]}
                >
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                            Bagages enregistrés ({luggageList.length})
                        </ThemedText>

                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#1776BA" />
                            </View>
                        ) : luggageList.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <MaterialIcons
                                    name="luggage"
                                    size={48}
                                    color={secondaryTextColor}
                                />
                                <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                                    Aucun bagage enregistré
                                </ThemedText>
                            </View>
                        ) : (
                            luggageList.map((luggage, index) => {
                                const statusColor = getLuggageStatusColor(luggage.status, isDark);
                                const isCheckedIn = luggage.status?.toUpperCase() === 'CHECKED_IN' || 
                                                   luggage.status?.toUpperCase() === 'LOADED' ||
                                                   luggage.status?.toUpperCase() === 'UNLOADED' ||
                                                   luggage.status?.toUpperCase() === 'DELIVERED';

                                return (
                                    <TouchableOpacity
                                        key={luggage.id || index}
                                        style={[
                                            styles.luggageCard,
                                            {
                                                backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
                                                borderColor: borderColor,
                                            },
                                        ]}
                                        onPress={() => handleLuggagePress(luggage)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.luggageHeader}>
                                            <View style={[styles.luggageHeaderLeft, { justifyContent: 'space-between' }]}>
                                                <ThemedText style={[styles.luggageTitle, { color: primaryTextColor }]}>
                                                    Bagage #{index + 1}
                                                </ThemedText>
                                                <View
                                                    style={[
                                                        styles.typeBadge,
                                                        { backgroundColor: '#1776BA20' },
                                                    ]}
                                                >
                                                    <ThemedText style={[styles.typeText, { color: '#1776BA' }]}>
                                                        {getLuggageTypeLabel(luggage.type)}
                                                    </ThemedText>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Statut du bagage */}
                                        {luggage.status && (
                                            <View style={styles.statusSection}>
                                                <View
                                                    style={[
                                                        styles.statusBadgeLarge,
                                                        { backgroundColor: statusColor + '20' },
                                                    ]}
                                                >
                                                    <MaterialIcons 
                                                        name={
                                                            luggage.status.toUpperCase() === 'REGISTERED' ? 'check-circle' :
                                                            luggage.status.toUpperCase() === 'CHECKED_IN' ? 'check-circle-outline' :
                                                            luggage.status.toUpperCase() === 'LOADED' ? 'inventory' :
                                                            luggage.status.toUpperCase() === 'DELIVERED' ? 'done-all' :
                                                            luggage.status.toUpperCase() === 'CANCELLED' ? 'cancel' :
                                                            'info'
                                                        } 
                                                        size={16} 
                                                        color={statusColor} 
                                                    />
                                                    <ThemedText style={[styles.statusTextLarge, { color: statusColor }]}>
                                                        {getLuggageStatusLabel(luggage.status)}
                                                    </ThemedText>
                                                </View>
                                            </View>
                                        )}

                                    <View style={styles.luggageDetails}>
                                        <View style={styles.detailRow}>
                                            <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                                Poids
                                            </ThemedText>
                                            <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                                {luggage.estimatedWeight} kg
                                            </ThemedText>
                                        </View>

                                        <View style={styles.detailRow}>
                                            <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                                Dimensions
                                            </ThemedText>
                                            <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                                {luggage.estimatedDimensions.length} x{' '}
                                                {luggage.estimatedDimensions.width} x{' '}
                                                {luggage.estimatedDimensions.height} cm
                                            </ThemedText>
                                        </View>

                                        <View style={styles.detailRow}>
                                            <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                                Total
                                            </ThemedText>
                                            <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                                {luggage.estimatedDimensions.total} cm³
                                            </ThemedText>
                                        </View>

                                        <View style={styles.detailRow}>
                                            <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                                Description
                                            </ThemedText>
                                            <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                                {luggage.description || '--'}
                                            </ThemedText>
                                        </View>

                                        <View style={styles.detailRow}>
                                            <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                                Fragile
                                            </ThemedText>
                                            <View
                                                style={[
                                                    styles.fragileBadge,
                                                    {
                                                        backgroundColor: luggage.isFragile
                                                            ? '#FF950020'
                                                            : '#34C75920',
                                                    },
                                                ]}
                                            >
                                                <ThemedText
                                                    style={[
                                                        styles.fragileText,
                                                        {
                                                            color: luggage.isFragile ? '#FF9500' : '#34C759',
                                                        },
                                                    ]}
                                                >
                                                    {luggage.isFragile ? 'Oui' : 'Non'}
                                                </ThemedText>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={[styles.tapHint, { borderTopColor: separatorColor, justifyContent: 'center' }]}>
                                        <ThemedText style={[styles.tapHintText, { color: statusColor }]}>
                                            {luggage.status?.toUpperCase() === 'REGISTERED' 
                                                ? 'Voir les détails et faire le check-in'
                                                : isCheckedIn
                                                ? 'Voir les détails, QR code et suppléments'
                                                : 'Voir les détails'}
                                        </ThemedText>
                                    </View>
                                </TouchableOpacity>
                            );
                            })
                        )}
                    </View>
                </View>

                {/* Bouton pour ajouter un bagage */}
                <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: '#1776BA' }]}
                    onPress={handleNavigateToAdd}
                >
                    <MaterialIcons name="add" size={24} color="#FFFFFF" />
                    <ThemedText style={styles.addButtonText}>Ajouter des bagages</ThemedText>
                </TouchableOpacity>
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
        marginBottom: 16,
    },
    section: {
        marginVertical: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 16,
    },
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        marginTop: 12,
    },
    luggageCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    luggageHeader: {
        marginBottom: 12,
    },
    luggageHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
    },
    luggageTitle: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    typeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    typeText: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Medium',
    },
    luggageDetails: {
        gap: 8,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    detailLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    detailValue: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
        flex: 1,
        textAlign: 'right',
    },
    fragileBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    fragileText: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Medium',
    },
    headerBadges: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    statusSection: {
        marginBottom: 12,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Medium',
    },
    statusBadgeLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 8,
        alignSelf: 'flex-start',
    },
    statusTextLarge: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
    },
    tapHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
    },
    tapHintText: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 8,
    },
    addButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
});
