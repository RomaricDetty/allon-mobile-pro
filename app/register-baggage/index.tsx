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
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    const params = useLocalSearchParams<{ bookingItemId: string; departureId: string; bookingId: string }>();
    const [luggageList, setLuggageList] = useState<ExistingLuggage[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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

    /** Navigue vers l'écran d'ajout de bagages */
    const handleNavigateToAdd = () => router.push({
        pathname: '/register-baggage/add',
        params: { bookingItemId: params.bookingItemId, bookingId: params.bookingId, departureId: params.departureId },
    });

    /** Navigue vers l'écran de détails d'un bagage */
    const handleLuggagePress = (luggage: ExistingLuggage) => router.push({
        pathname: '/register-baggage/details',
        params: { luggageData: JSON.stringify(luggage), bookingItemId: params.bookingItemId, departureId: params.departureId, bookingId: params.bookingId },
    });

    useEffect(() => { if (params.bookingItemId) loadLuggageList(); }, [params.bookingItemId]);
    useFocusEffect(useCallback(() => { if (params.bookingItemId) loadLuggageList(); }, [params.bookingItemId]));

    const statusUpper = (s?: string) => s?.toUpperCase();

    return (
        <View style={[styles.container, { backgroundColor: colors.containerBg }]}>
            <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + 8, paddingBottom: 16 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity style={[styles.headerButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]} onPress={() => router.back()}>
                        <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <ThemedText style={[styles.headerTitle, { color: '#FFFFFF' }]}>Gestion des bagages</ThemedText>
                    <View style={styles.headerButton} />
                </View>
            </View>
            <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} showsVerticalScrollIndicator={false}>
                <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Bagages enregistrés ({luggageList.length})</ThemedText>
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
                    <TouchableOpacity style={[styles.addButton, { backgroundColor: '#1776BA' }]} onPress={handleNavigateToAdd}>
                        <MaterialIcons name="add" size={28} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}