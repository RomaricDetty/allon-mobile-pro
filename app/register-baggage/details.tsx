import { baseUrl } from '@/api/config';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { styles } from '@/styles/detailsLuggage';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canCheckIn, formatAmount, getLuggageStatusColor, getLuggageStatusLabel, getStatusIcon, isCheckedInStatus, isPaidStatus } from '@/utils/luggage-utils';
import { LuggageType, getLuggageTypeLabel } from './index';

interface LuggageDimensions {
    length: number;
    width: number;
    height: number;
    total: number;
}

interface LuggageDetails {
    id: string;
    type: LuggageType;
    status?: string;
    estimatedWeight: number;
    estimatedDimensions: LuggageDimensions;
    actualWeight?: number;
    actualDimensions?: LuggageDimensions;
    description: string;
    isFragile: boolean;
    tagNumber?: string;
    qrCode?: string;
    price?: number;
    basePrice?: number;
    excessWeightFee?: number;
    oversizedFee?: number;
    fragileFee?: number;
    currency?: string;
    registeredAt?: string;
    checkedInAt?: string;
    stationId?: string;
}

/**
 * Écran de détails d'un bagage
 */
export default function LuggageDetailsScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ luggageData: string; bookingItemId: string; departureId: string; bookingId: string }>();

    const [luggage, setLuggage] = useState<LuggageDetails | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showQrCode, setShowQrCode] = useState(false);
    const [checkInData, setCheckInData] = useState({ weight: '', length: '', width: '', height: '', description: '', isFragile: false });

    React.useEffect(() => {
        try {
            if (params.luggageData) {
                const parsed = JSON.parse(params.luggageData);
                setLuggage(parsed);
                setCheckInData({
                    weight: parsed.actualWeight?.toString() || parsed.estimatedWeight?.toString() || '',
                    length: parsed.actualDimensions?.length?.toString() || parsed.estimatedDimensions?.length?.toString() || '',
                    width: parsed.actualDimensions?.width?.toString() || parsed.estimatedDimensions?.width?.toString() || '',
                    height: parsed.actualDimensions?.height?.toString() || parsed.estimatedDimensions?.height?.toString() || '',
                    description: parsed.description || '',
                    isFragile: parsed.isFragile || false,
                });
            }
        } catch (error) {
            console.error('Erreur lors du parsing des données du bagage:', error);
            Alert.alert('Erreur', 'Impossible de charger les détails du bagage.', [{ text: 'OK', onPress: () => router.back() }]);
        }
    }, [params.luggageData]);

    if (!luggage) return null;

    const colors = {
        headerBg: isDark ? '#1A1A1A' : '#1776BA',
        cardBg: isDark ? '#1A1A1A' : '#FFFFFF',
        primaryText: isDark ? '#FFFFFF' : '#11181C',
        secondaryText: isDark ? '#9BA1A6' : '#666666',
        labelText: isDark ? '#9BA1A6' : '#999999',
        border: isDark ? '#3A3A3C' : '#E0E0E0',
        separator: isDark ? '#3A3A3C' : '#E5E5E5',
    };

    const isCheckedIn = isCheckedInStatus(luggage.status);
    const canPerformCheckIn = canCheckIn(luggage.status);
    const isPaid = isPaidStatus(luggage.status);
    const hasAnyAdditionalFee = (luggage.oversizedFee || 0) > 0 || (luggage.excessWeightFee || 0) > 0 || (luggage.fragileFee || 0) > 0;

    const renderDetailRow = (label: string, value: string | React.ReactNode) => (
        <View style={styles.detailRow}>
            <ThemedText style={[styles.detailLabel, { color: colors.labelText }]}>{label}</ThemedText>
            {typeof value === 'string' ? <ThemedText style={[styles.detailValue, { color: colors.primaryText }]}>{value}</ThemedText> : value}
        </View>
    );

    const validateCheckInData = (): boolean => {
        const fields = [
            { value: checkInData.weight, label: 'poids réel' },
            { value: checkInData.length, label: 'longueur' },
            { value: checkInData.width, label: 'largeur' },
            { value: checkInData.height, label: 'hauteur' },
        ];
        for (const field of fields) {
            if (!field.value || parseFloat(field.value) <= 0) {
                Alert.alert('Erreur', `Veuillez saisir un ${field.label} valide.`);
                return false;
            }
        }
        return true;
    };

    const handleCheckIn = async () => {
        if (!validateCheckInData()) return;

        const { weight, length, width, height } = checkInData;
        const w = parseFloat(weight), l = parseFloat(length), wi = parseFloat(width), h = parseFloat(height);

        Alert.alert('Confirmer le check-in', `Voulez-vous effectuer le check-in de ce bagage avec les données suivantes ?\n\nPoids: ${w} kg\nDimensions: ${l} x ${wi} x ${h} cm`, [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Confirmer',
                onPress: async () => {
                    setIsLoading(true);
                    try {
                        const token = await AsyncStorage.getItem('token');
                        if (!token) throw new Error('Token non disponible');

                        const response = await axios.post(`${baseUrl}/luggage/${luggage.id}/check-in`, {
                            actualWeight: w,
                            actualDimensions: { length: l, width: wi, height: h, total: l * wi * h },
                            stationId: luggage.stationId || '',
                            description: checkInData.description || '',
                            isFragile: checkInData.isFragile,
                        }, { headers: { Authorization: `Bearer ${token}` } });

                        if (response.data) {
                            setLuggage({ ...luggage, ...response.data, status: response.data.status });
                            Alert.alert(
                                response.data.oversizedFee > 0 ? 'Frais supplémentaires' : 'Succès',
                                response.data.oversizedFee > 0
                                    ? `Ce bagage nécessite le paiement de frais supplémentaires de ${response.data.oversizedFee} ${response.data.currency || 'XOF. Veuillez vous rendre à la caisse pour payer.'}.`
                                    : 'Le check-in a été effectué avec succès.',
                                [{ text: response.data.oversizedFee > 0 ? 'Fermer' : 'OK', style: response.data.oversizedFee > 0 ? 'cancel' : 'default' }]
                            );
                        }
                    } catch (error: any) {
                        console.error('Erreur lors du check-in:', error);
                        Alert.alert('Erreur', error.response?.data?.message || 'Une erreur est survenue lors du check-in.', [{ text: 'OK' }]);
                    } finally {
                        setIsLoading(false);
                    }
                },
            },
        ]);
    };

    const handlePrintReceipt = async () => {
        Alert.alert('Impression du reçu', 'Fonctionnalité d\'impression à implémenter. Le reçu sera généré avec les informations du bagage.', [{ text: 'OK' }]);
    };

    const renderFeeRow = (label: string, fee?: number) => {
        if (!fee || fee <= 0) return null;
        return renderDetailRow(label, (
            <View style={styles.feeRow}>
                <ThemedText style={[styles.detailValue, { color: colors.primaryText }]}>{formatAmount(fee, luggage.currency)}</ThemedText>
                {isPaid && (
                    <View style={[styles.paidBadge, { backgroundColor: '#34C75920' }]}>
                        <MaterialIcons name="check-circle" size={14} color="#34C759" />
                        <ThemedText style={[styles.paidText, { color: '#34C759' }]}>Payé</ThemedText>
                    </View>
                )}
            </View>
        ));
    };

    const inputStyle = { backgroundColor: isDark ? '#2C2C2E' : '#F5F5F5', borderColor: colors.border, color: colors.primaryText };
    const statusColor = luggage.status ? getLuggageStatusColor(luggage.status, isDark) : colors.secondaryText;
    const totalDimensions = checkInData.length && checkInData.width && checkInData.height
        ? parseFloat(checkInData.length) * parseFloat(checkInData.width) * parseFloat(checkInData.height)
        : 0;

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F3F3F7' }]}>
            <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + 8, paddingBottom: 16 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity style={[styles.headerButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]} onPress={() => router.back()}>
                        <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <ThemedText style={[styles.headerTitle, { color: '#FFFFFF' }]}>Détails du bagage</ThemedText>
                    <View style={styles.headerButton} />
                </View>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} showsVerticalScrollIndicator={false}>
                <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    <View style={styles.section}>
                        <View style={styles.typeStatusRow}>
                            <View style={[styles.typeBadge, { backgroundColor: '#1776BA20' }]}>
                                <ThemedText style={[styles.typeText, { color: '#1776BA' }]}>{getLuggageTypeLabel(luggage.type)}</ThemedText>
                            </View>
                            {luggage.status && (
                                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                                    <MaterialIcons name={getStatusIcon(luggage.status) as any} size={14} color={statusColor} style={{ marginRight: 4 }} />
                                    <ThemedText style={[styles.statusText, { color: statusColor }]}>{getLuggageStatusLabel(luggage.status)}</ThemedText>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Poids estimé</ThemedText>
                        {renderDetailRow('Poids', `${luggage.estimatedWeight} kg`)}
                    </View>

                    <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Dimensions estimées</ThemedText>
                        {renderDetailRow('Dimensions', `${luggage.estimatedDimensions.length} x ${luggage.estimatedDimensions.width} x ${luggage.estimatedDimensions.height} cm`)}
                        {renderDetailRow('Total', `${luggage.estimatedDimensions.total} cm³`)}
                    </View>

                    {!isCheckedIn && canPerformCheckIn && (
                        <>
                            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Informations de check-in</ThemedText>
                                <View style={styles.inputField}>
                                    <ThemedText style={[styles.inputLabel, { color: colors.labelText }]}>Poids réel (kg) *</ThemedText>
                                    <TextInput style={[styles.input, inputStyle]} value={checkInData.weight} onChangeText={(v) => setCheckInData({ ...checkInData, weight: v })} placeholder="Ex: 12" placeholderTextColor={colors.labelText} keyboardType="numeric" />
                                </View>
                                <ThemedText style={[styles.inputLabel, { color: colors.labelText, marginTop: 16 }]}>Dimensions réelles (cm) *</ThemedText>
                                <View style={styles.dimensionsRow}>
                                    {['length', 'width', 'height'].map((dim, i) => (
                                        <View key={dim} style={styles.dimensionInput}>
                                            <ThemedText style={[styles.dimensionLabel, { color: colors.labelText }]}>{['Longueur', 'Largeur', 'Hauteur'][i]}</ThemedText>
                                            <TextInput style={[styles.input, inputStyle]} value={checkInData[dim as keyof typeof checkInData] as string} onChangeText={(v) => setCheckInData({ ...checkInData, [dim]: v })} placeholder={['L', 'l', 'H'][i]} placeholderTextColor={colors.labelText} keyboardType="numeric" />
                                        </View>
                                    ))}
                                </View>
                                {totalDimensions > 0 && (
                                    <View style={styles.totalDimensionsContainer}>
                                        <ThemedText style={[styles.totalDimensionsText, { color: colors.secondaryText }]}>Total: {totalDimensions.toLocaleString('fr-FR')} cm³</ThemedText>
                                    </View>
                                )}
                                <View style={styles.inputField}>
                                    <ThemedText style={[styles.inputLabel, { color: colors.labelText }]}>Description</ThemedText>
                                    <TextInput style={[styles.textArea, inputStyle]} value={checkInData.description} onChangeText={(v) => setCheckInData({ ...checkInData, description: v })} placeholder="Description du bagage" placeholderTextColor={colors.labelText} multiline numberOfLines={3} />
                                </View>
                                <View style={styles.switchField}>
                                    <ThemedText style={[styles.inputLabel, { color: colors.labelText }]}>Bagage fragile</ThemedText>
                                    <Switch value={checkInData.isFragile} onValueChange={(v) => setCheckInData({ ...checkInData, isFragile: v })} trackColor={{ false: colors.separator, true: '#1776BA' }} thumbColor={checkInData.isFragile ? '#FFFFFF' : '#F4F3F4'} />
                                </View>
                            </View>
                        </>
                    )}

                    {isCheckedIn && luggage.actualDimensions && (
                        <>
                            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Dimensions réelles</ThemedText>
                                {renderDetailRow('Dimensions', `${luggage.actualDimensions.length} x ${luggage.actualDimensions.width} x ${luggage.actualDimensions.height} cm`)}
                                {renderDetailRow('Total', `${luggage.actualDimensions.total} cm³`)}
                            </View>
                        </>
                    )}

                    {isCheckedIn && luggage.actualWeight && (
                        <>
                            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Poids réel</ThemedText>
                                {renderDetailRow('Poids', `${luggage.actualWeight} kg`)}
                            </View>
                        </>
                    )}

                    {isCheckedIn && (
                        <>
                            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                            <View style={styles.section}>
                                {renderDetailRow('Description', luggage.description || '--')}
                                {renderDetailRow('Fragile', (
                                    <View style={[styles.fragileBadge, { backgroundColor: luggage.isFragile ? '#FF950020' : '#34C75920' }]}>
                                        <ThemedText style={[styles.fragileText, { color: luggage.isFragile ? '#FF9500' : '#34C759' }]}>{luggage.isFragile ? 'Oui' : 'Non'}</ThemedText>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    {(luggage.tagNumber || luggage.qrCode) && (
                        <>
                            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Informations de check-in</ThemedText>
                                {luggage.tagNumber && renderDetailRow('Numéro de tag', luggage.tagNumber)}
                                {luggage.qrCode && (
                                    <>
                                        {renderDetailRow('QR Code', luggage.qrCode)}
                                        <View style={styles.printSection}>
                                            <TouchableOpacity style={[styles.printButton, { backgroundColor: '#1776BA' }]} onPress={handlePrintReceipt}>
                                                <MaterialIcons name="print" size={20} color="#FFFFFF" />
                                                <ThemedText style={styles.printButtonText}>Imprimer le reçu du bagage</ThemedText>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                                {luggage.checkedInAt && renderDetailRow('Date de check-in', new Date(luggage.checkedInAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }))}
                            </View>
                        </>
                    )}

                    {(luggage.price !== undefined || luggage.basePrice !== undefined || hasAnyAdditionalFee) && (
                        <>
                            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: colors.primaryText }]}>Tarification</ThemedText>
                                {luggage.basePrice !== undefined && renderDetailRow('Prix de base', formatAmount(luggage.basePrice, luggage.currency))}
                                {renderFeeRow('Frais excès de poids', luggage.excessWeightFee)}
                                {renderFeeRow('Frais surdimensionné', luggage.oversizedFee)}
                                {renderFeeRow('Frais fragile', luggage.fragileFee)}
                                {luggage.price !== undefined && renderDetailRow('Prix total', <ThemedText style={[styles.totalPrice, { color: colors.primaryText }]}>{formatAmount(luggage.price, luggage.currency)}</ThemedText>)}
                                {hasAnyAdditionalFee && !isPaid && (
                                    <View style={[styles.paymentWarning, { backgroundColor: '#FF950020', borderColor: '#FF9500' }]}>
                                        <MaterialIcons name="info" size={16} color="#FF9500" />
                                        <ThemedText style={[styles.paymentWarningText, { color: '#FF9500' }]}>Veuillez vous rendre à la caisse pour payer les frais supplémentaires.</ThemedText>
                                    </View>
                                )}
                            </View>
                        </>
                    )}
                </View>

                {!isCheckedIn && canPerformCheckIn && (
                    <TouchableOpacity style={[styles.checkInButton, { backgroundColor: '#1776BA', opacity: isLoading ? 0.6 : 1 }]} onPress={handleCheckIn} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#FFFFFF" /> : (
                            <>
                                <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
                                <ThemedText style={styles.checkInButtonText}>Effectuer le check-in</ThemedText>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </ScrollView>

            <Modal visible={showQrCode} transparent animationType="fade" onRequestClose={() => setShowQrCode(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <ThemedText style={[styles.modalTitle, { color: colors.primaryText }]}>QR Code du bagage</ThemedText>
                            <TouchableOpacity onPress={() => setShowQrCode(false)}>
                                <MaterialIcons name="close" size={24} color={colors.primaryText} />
                            </TouchableOpacity>
                        </View>
                        {luggage.qrCode && (
                            <Image
                                source={{ uri: luggage.qrCode.startsWith('data:image') ? luggage.qrCode : luggage.qrCode.startsWith('http') ? luggage.qrCode : `data:image/png;base64,${luggage.qrCode}` }}
                                style={styles.qrCodeImage}
                                resizeMode="contain"
                                onError={(error) => console.error('Erreur lors du chargement du QR code:', error)}
                            />
                        )}
                        {luggage.tagNumber && <ThemedText style={[styles.tagNumber, { color: colors.secondaryText }]}>Tag: {luggage.tagNumber}</ThemedText>}
                    </View>
                </View>
            </Modal>
        </View>
    );
}
