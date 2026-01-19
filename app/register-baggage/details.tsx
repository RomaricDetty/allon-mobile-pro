import { baseUrl } from '@/api/config';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LuggageType, getLuggageTypeLabel } from './index';

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
 * Interface pour un bagage complet
 */
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
 * Affiche les détails complets et permet de faire le check-in
 */
export default function LuggageDetailsScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        luggageData: string;
        bookingItemId: string;
        departureId: string;
        bookingId: string;
    }>();

    const [luggage, setLuggage] = useState<LuggageDetails | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showQrCode, setShowQrCode] = useState(false);
    
    // États pour les champs de saisie du check-in
    const [actualWeight, setActualWeight] = useState<string>('');
    const [actualLength, setActualLength] = useState<string>('');
    const [actualWidth, setActualWidth] = useState<string>('');
    const [actualHeight, setActualHeight] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [isFragile, setIsFragile] = useState<boolean>(false);

    // Parse les données du bagage
    React.useEffect(() => {
        try {
            if (params.luggageData) {
                const parsed = JSON.parse(params.luggageData);
                setLuggage(parsed);
                // Initialiser les champs avec les valeurs existantes ou estimées
                setActualWeight(parsed.actualWeight?.toString() || parsed.estimatedWeight?.toString() || '');
                setActualLength(parsed.actualDimensions?.length?.toString() || parsed.estimatedDimensions?.length?.toString() || '');
                setActualWidth(parsed.actualDimensions?.width?.toString() || parsed.estimatedDimensions?.width?.toString() || '');
                setActualHeight(parsed.actualDimensions?.height?.toString() || parsed.estimatedDimensions?.height?.toString() || '');
                setDescription(parsed.description || '');
                setIsFragile(parsed.isFragile || false);
            }
        } catch (error) {
            console.error('Erreur lors du parsing des données du bagage:', error);
            Alert.alert('Erreur', 'Impossible de charger les détails du bagage.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        }
    }, [params.luggageData]);

    // Si aucune donnée n'est disponible, retourner à l'écran précédent
    if (!luggage) {
        return null;
    }

    // Couleurs pour le mode clair et sombre
    const headerBackgroundColor = isDark ? '#1A1A1A' : '#1776BA';
    const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
    const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
    const secondaryTextColor = isDark ? '#9BA1A6' : '#666666';
    const labelTextColor = isDark ? '#9BA1A6' : '#999999';
    const borderColor = isDark ? '#3A3A3C' : '#E0E0E0';
    const separatorColor = isDark ? '#3A3A3C' : '#E5E5E5';

    const isCheckedIn = luggage.status?.toUpperCase() === 'CHECKED_IN' ||
                       luggage.status?.toUpperCase() === 'LOADED' ||
                       luggage.status?.toUpperCase() === 'UNLOADED' ||
                       luggage.status?.toUpperCase() === 'DELIVERED';
    const hasOversizedFee = (luggage.oversizedFee || 0) > 0;
    const hasExcessWeightFee = (luggage.excessWeightFee || 0) > 0;
    const hasFragileFee = (luggage.fragileFee || 0) > 0;
    const hasAnyAdditionalFee = hasOversizedFee || hasExcessWeightFee || hasFragileFee;
    // On considère que les frais sont payés si le bagage a un statut avancé (LOADED, UNLOADED, DELIVERED)
    // car ces statuts indiquent que le bagage a progressé dans le processus, ce qui nécessite le paiement
    const isPaid = luggage.status?.toUpperCase() === 'LOADED' ||
                   luggage.status?.toUpperCase() === 'UNLOADED' ||
                   luggage.status?.toUpperCase() === 'DELIVERED';

    /**
     * Rend une ligne de détail
     */
    const renderDetailRow = (label: string, value: string | React.ReactNode) => (
        <View style={styles.detailRow}>
            <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                {label}
            </ThemedText>
            {typeof value === 'string' ? (
                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                    {value}
                </ThemedText>
            ) : (
                value
            )}
        </View>
    );

    /**
     * Valide les données saisies pour le check-in
     */
    const validateCheckInData = (): boolean => {
        if (!actualWeight || parseFloat(actualWeight) <= 0) {
            Alert.alert('Erreur', 'Veuillez saisir un poids réel valide.');
            return false;
        }
        if (!actualLength || parseFloat(actualLength) <= 0) {
            Alert.alert('Erreur', 'Veuillez saisir une longueur valide.');
            return false;
        }
        if (!actualWidth || parseFloat(actualWidth) <= 0) {
            Alert.alert('Erreur', 'Veuillez saisir une largeur valide.');
            return false;
        }
        if (!actualHeight || parseFloat(actualHeight) <= 0) {
            Alert.alert('Erreur', 'Veuillez saisir une hauteur valide.');
            return false;
        }
        return true;
    };

    /**
     * Effectue le check-in du bagage
     */
    const handleCheckIn = async () => {
        // Valider les données avant de continuer
        if (!validateCheckInData()) {
            return;
        }

        const weight = parseFloat(actualWeight);
        const length = parseFloat(actualLength);
        const width = parseFloat(actualWidth);
        const height = parseFloat(actualHeight);
        const total = length * width * height;

        Alert.alert(
            'Confirmer le check-in',
            `Voulez-vous effectuer le check-in de ce bagage avec les données suivantes ?\n\nPoids: ${weight} kg\nDimensions: ${length} x ${width} x ${height} cm`,
            [
                {
                    text: 'Annuler',
                    style: 'cancel',
                },
                {
                    text: 'Confirmer',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const token = await AsyncStorage.getItem('token');
                            if (!token) {
                                throw new Error('Token non disponible');
                            }

                            // Utiliser les données saisies
                            const payload = {
                                actualWeight: weight,
                                actualDimensions: {
                                    length: length,
                                    width: width,
                                    height: height,
                                    total: total,
                                },
                                stationId: luggage.stationId || '',
                                description: description || '',
                                isFragile: isFragile,
                            };

                            const response = await axios.post(
                                `${baseUrl}/luggage/${luggage.id}/check-in`,
                                payload,
                                {
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                    },
                                }
                            );

                            if (response.data) {
                                // Mettre à jour le bagage avec les nouvelles données
                                setLuggage({
                                    ...luggage,
                                    ...response.data,
                                    status: response.data.status,
                                });

                                // Si oversizedFee > 0, proposer le paiement
                                if (response.data.oversizedFee > 0) {
                                    Alert.alert(
                                        'Frais supplémentaires',
                                        `Ce bagage nécessite le paiement de frais supplémentaires de ${response.data.oversizedFee} ${response.data.currency || 'XOF. Veuillez vous rendre à la caisse pour payer.'}.`,
                                        [
                                            
                                            {
                                                text: 'Fermer',
                                                style: 'cancel',
                                            },
                                        ]
                                    );
                                } else {
                                    Alert.alert('Succès', 'Le check-in a été effectué avec succès.', [
                                        { text: 'OK' },
                                    ]);
                                }
                            }
                        } catch (error: any) {
                            console.error('Erreur lors du check-in:', error);
                            Alert.alert(
                                'Erreur',
                                error.response?.data?.message || 'Une erreur est survenue lors du check-in.',
                                [{ text: 'OK' }]
                            );
                        } finally {
                            setIsLoading(false);
                        }
                    },
                },
            ]
        );
    };

    /**
     * Gère le paiement des frais supplémentaires
     */
    const handlePayOversizedFee = async (amount: number, currency: string) => {
        Alert.alert(
            'Paiement des frais supplémentaires',
            `Montant à payer : ${amount} ${currency}`,
            [
                {
                    text: 'Annuler',
                    style: 'cancel',
                },
                {
                    text: 'Payer',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const token = await AsyncStorage.getItem('token');
                            if (!token) {
                                throw new Error('Token non disponible');
                            }

                            const response = await axios.post(
                                `${baseUrl}/luggage/${luggage.id}/pay`,
                                {
                                    amount: amount,
                                    note: 'Paiement des frais supplémentaires du bagage',
                                },
                                {
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                    },
                                }
                            );

                            if (response.data) {
                                Alert.alert('Succès', 'Le paiement a été effectué avec succès.', [
                                    { text: 'OK' },
                                ]);
                            }
                        } catch (error: any) {
                            console.error('Erreur lors du paiement:', error);
                            Alert.alert(
                                'Erreur',
                                error.response?.data?.message || 'Une erreur est survenue lors du paiement.',
                                [{ text: 'OK' }]
                            );
                        } finally {
                            setIsLoading(false);
                        }
                    },
                },
            ]
        );
    };

    /**
     * Formate un montant avec la devise
     */
    const formatAmount = (amount?: number, currency?: string): string => {
        if (!amount) return '--';
        const formatted = amount.toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return `${formatted} ${currency || 'XOF'}`;
    };

    /**
     * Gère l'impression du reçu du bagage
     */
    const handlePrintReceipt = async () => {
        try {
            // TODO: Implémenter la logique d'impression du reçu
            // Cette fonction pourra utiliser une bibliothèque comme expo-print
            // ou react-native-print pour générer et imprimer le reçu
            
            Alert.alert(
                'Impression du reçu',
                'Fonctionnalité d\'impression à implémenter. Le reçu sera généré avec les informations du bagage.',
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Erreur lors de l\'impression:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors de l\'impression du reçu.', [
                { text: 'OK' },
            ]);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F3F3F7' }]}>
            {/* Header */}
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
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>

                    <ThemedText style={[styles.headerTitle, { color: '#FFFFFF' }]}>
                        Détails du bagage
                    </ThemedText>

                    <View style={styles.headerButton} />
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
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
                    {/* Type et statut */}
                    <View style={styles.section}>
                        <View style={styles.typeStatusRow}>
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
                            {luggage.status && (
                                <View
                                    style={[
                                        styles.statusBadge,
                                        {
                                            backgroundColor:
                                                isCheckedIn ? '#34C75920' : '#1776BA20',
                                        },
                                    ]}
                                >
                                    <ThemedText
                                        style={[
                                            styles.statusText,
                                            {
                                                color: isCheckedIn ? '#34C759' : '#1776BA',
                                            },
                                        ]}
                                    >
                                        {luggage.status === 'REGISTERED'
                                            ? 'Enregistré'
                                            : luggage.status === 'CHECKED_IN'
                                            ? 'Vérifié'
                                            : luggage.status}
                                    </ThemedText>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                    {/* Poids estimé */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                            Poids estimé
                        </ThemedText>
                        {renderDetailRow('Poids', `${luggage.estimatedWeight} kg`)}
                    </View>

                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                    {/* Dimensions estimées */}
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                            Dimensions estimées
                        </ThemedText>
                        {renderDetailRow(
                            'Dimensions',
                            `${luggage.estimatedDimensions.length} x ${luggage.estimatedDimensions.width} x ${luggage.estimatedDimensions.height} cm`
                        )}
                        {renderDetailRow('Total', `${luggage.estimatedDimensions.total} cm³`)}
                    </View>

                    {/* Section de saisie pour le check-in */}
                    {!isCheckedIn && (
                        <>
                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Informations de check-in
                                </ThemedText>
                                
                                {/* Poids réel */}
                                <View style={styles.inputField}>
                                    <ThemedText style={[styles.inputLabel, { color: labelTextColor }]}>
                                        Poids réel (kg) *
                                    </ThemedText>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor: isDark ? '#2C2C2E' : '#F5F5F5',
                                                borderColor: borderColor,
                                                color: primaryTextColor,
                                            },
                                        ]}
                                        value={actualWeight}
                                        onChangeText={setActualWeight}
                                        placeholder="Ex: 12"
                                        placeholderTextColor={labelTextColor}
                                        keyboardType="numeric"
                                    />
                                </View>

                                {/* Dimensions réelles */}
                                <ThemedText style={[styles.inputLabel, { color: labelTextColor, marginTop: 16 }]}>
                                    Dimensions réelles (cm) *
                                </ThemedText>
                                <View style={styles.dimensionsRow}>
                                    <View style={styles.dimensionInput}>
                                        <ThemedText style={[styles.dimensionLabel, { color: labelTextColor }]}>
                                            Longueur
                                        </ThemedText>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                {
                                                    backgroundColor: isDark ? '#2C2C2E' : '#F5F5F5',
                                                    borderColor: borderColor,
                                                    color: primaryTextColor,
                                                },
                                            ]}
                                            value={actualLength}
                                            onChangeText={setActualLength}
                                            placeholder="L"
                                            placeholderTextColor={labelTextColor}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={styles.dimensionInput}>
                                        <ThemedText style={[styles.dimensionLabel, { color: labelTextColor }]}>
                                            Largeur
                                        </ThemedText>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                {
                                                    backgroundColor: isDark ? '#2C2C2E' : '#F5F5F5',
                                                    borderColor: borderColor,
                                                    color: primaryTextColor,
                                                },
                                            ]}
                                            value={actualWidth}
                                            onChangeText={setActualWidth}
                                            placeholder="l"
                                            placeholderTextColor={labelTextColor}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={styles.dimensionInput}>
                                        <ThemedText style={[styles.dimensionLabel, { color: labelTextColor }]}>
                                            Hauteur
                                        </ThemedText>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                {
                                                    backgroundColor: isDark ? '#2C2C2E' : '#F5F5F5',
                                                    borderColor: borderColor,
                                                    color: primaryTextColor,
                                                },
                                            ]}
                                            value={actualHeight}
                                            onChangeText={setActualHeight}
                                            placeholder="H"
                                            placeholderTextColor={labelTextColor}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>
                                {/* Affichage du total calculé */}
                                {actualLength && actualWidth && actualHeight && 
                                 parseFloat(actualLength) > 0 && parseFloat(actualWidth) > 0 && parseFloat(actualHeight) > 0 && (
                                    <View style={styles.totalDimensionsContainer}>
                                        <ThemedText style={[styles.totalDimensionsText, { color: secondaryTextColor }]}>
                                            Total: {(
                                                parseFloat(actualLength) * 
                                                parseFloat(actualWidth) * 
                                                parseFloat(actualHeight)
                                            ).toLocaleString('fr-FR')} cm³
                                        </ThemedText>
                                    </View>
                                )}

                                {/* Description */}
                                <View style={styles.inputField}>
                                    <ThemedText style={[styles.inputLabel, { color: labelTextColor }]}>
                                        Description
                                    </ThemedText>
                                    <TextInput
                                        style={[
                                            styles.textArea,
                                            {
                                                backgroundColor: isDark ? '#2C2C2E' : '#F5F5F5',
                                                borderColor: borderColor,
                                                color: primaryTextColor,
                                            },
                                        ]}
                                        value={description}
                                        onChangeText={setDescription}
                                        placeholder="Description du bagage"
                                        placeholderTextColor={labelTextColor}
                                        multiline
                                        numberOfLines={3}
                                    />
                                </View>

                                {/* Fragile */}
                                <View style={styles.switchField}>
                                    <ThemedText style={[styles.inputLabel, { color: labelTextColor }]}>
                                        Bagage fragile
                                    </ThemedText>
                                    <Switch
                                        value={isFragile}
                                        onValueChange={setIsFragile}
                                        trackColor={{ false: separatorColor, true: '#1776BA' }}
                                        thumbColor={isFragile ? '#FFFFFF' : '#F4F3F4'}
                                    />
                                </View>
                            </View>
                        </>
                    )}

                    {/* Affichage des dimensions réelles après check-in */}
                    {isCheckedIn && luggage.actualDimensions && (
                        <>
                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Dimensions réelles
                                </ThemedText>
                                {renderDetailRow(
                                    'Dimensions',
                                    `${luggage.actualDimensions.length} x ${luggage.actualDimensions.width} x ${luggage.actualDimensions.height} cm`
                                )}
                                {renderDetailRow('Total', `${luggage.actualDimensions.total} cm³`)}
                            </View>
                        </>
                    )}

                    {/* Affichage du poids réel après check-in */}
                    {isCheckedIn && luggage.actualWeight && (
                        <>
                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Poids réel
                                </ThemedText>
                                {renderDetailRow('Poids', `${luggage.actualWeight} kg`)}
                            </View>
                        </>
                    )}

                    {/* Description et fragile après check-in */}
                    {isCheckedIn && (
                        <>
                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                            <View style={styles.section}>
                                {renderDetailRow('Description', luggage.description || '--')}
                                {renderDetailRow(
                                    'Fragile',
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
                                )}
                            </View>
                        </>
                    )}

                    {/* Tag et QR Code - affiché pour tous les statuts si disponible */}
                    {(luggage.tagNumber || luggage.qrCode) && (
                        <>
                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Informations de check-in
                                </ThemedText>
                                {luggage.tagNumber && renderDetailRow('Numéro de tag', luggage.tagNumber)}
                                {luggage.qrCode && (
                                    <>
                                        {renderDetailRow('QR Code', luggage.qrCode)}
                                        <View style={styles.printSection}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.printButton,
                                                    { backgroundColor: '#1776BA' },
                                                ]}
                                                onPress={handlePrintReceipt}
                                            >
                                                <MaterialIcons name="print" size={20} color="#FFFFFF" />
                                                <ThemedText style={styles.printButtonText}>
                                                    Imprimer le reçu du bagage
                                                </ThemedText>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                                {luggage.checkedInAt &&
                                    renderDetailRow(
                                        'Date de check-in',
                                        new Date(luggage.checkedInAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
                                    )}
                            </View>
                        </>
                    )}

                    {/* Prix */}
                    {(luggage.price !== undefined || luggage.basePrice !== undefined || hasAnyAdditionalFee) && (
                        <>
                            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                            <View style={styles.section}>
                                <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                                    Tarification
                                </ThemedText>
                                {luggage.basePrice !== undefined &&
                                    renderDetailRow('Prix de base', formatAmount(luggage.basePrice, luggage.currency))}
                                {luggage.excessWeightFee !== undefined &&
                                    luggage.excessWeightFee > 0 &&
                                    renderDetailRow(
                                        'Frais excès de poids',
                                        <View style={styles.feeRow}>
                                            <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                                {formatAmount(luggage.excessWeightFee, luggage.currency)}
                                            </ThemedText>
                                            {isPaid && (
                                                <View style={[styles.paidBadge, { backgroundColor: '#34C75920' }]}>
                                                    <MaterialIcons name="check-circle" size={14} color="#34C759" />
                                                    <ThemedText style={[styles.paidText, { color: '#34C759' }]}>
                                                        Payé
                                                    </ThemedText>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                {luggage.oversizedFee !== undefined &&
                                    luggage.oversizedFee > 0 &&
                                    renderDetailRow(
                                        'Frais surdimensionné',
                                        <View style={styles.feeRow}>
                                            <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                                {formatAmount(luggage.oversizedFee, luggage.currency)}
                                            </ThemedText>
                                            {isPaid && (
                                                <View style={[styles.paidBadge, { backgroundColor: '#34C75920' }]}>
                                                    <MaterialIcons name="check-circle" size={14} color="#34C759" />
                                                    <ThemedText style={[styles.paidText, { color: '#34C759' }]}>
                                                        Payé
                                                    </ThemedText>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                {luggage.fragileFee !== undefined &&
                                    luggage.fragileFee > 0 &&
                                    renderDetailRow(
                                        'Frais fragile',
                                        <View style={styles.feeRow}>
                                            <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                                {formatAmount(luggage.fragileFee, luggage.currency)}
                                            </ThemedText>
                                            {isPaid && (
                                                <View style={[styles.paidBadge, { backgroundColor: '#34C75920' }]}>
                                                    <MaterialIcons name="check-circle" size={14} color="#34C759" />
                                                    <ThemedText style={[styles.paidText, { color: '#34C759' }]}>
                                                        Payé
                                                    </ThemedText>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                {luggage.price !== undefined && renderDetailRow(
                                    'Prix total',
                                    <ThemedText
                                        style={[
                                            styles.totalPrice,
                                            { color: primaryTextColor },
                                        ]}
                                    >
                                        {formatAmount(luggage.price, luggage.currency)}
                                    </ThemedText>
                                )}
                                {hasAnyAdditionalFee && !isPaid && (
                                    <View style={[styles.paymentWarning, { backgroundColor: '#FF950020', borderColor: '#FF9500' }]}>
                                        <MaterialIcons name="info" size={16} color="#FF9500" />
                                        <ThemedText style={[styles.paymentWarningText, { color: '#FF9500' }]}>
                                            Veuillez vous rendre à la caisse pour payer les frais supplémentaires.
                                        </ThemedText>
                                    </View>
                                )}
                            </View>
                        </>
                    )}
                </View>

                {/* Bouton check-in */}
                {!isCheckedIn && (
                    <TouchableOpacity
                        style={[
                            styles.checkInButton,
                            {
                                backgroundColor: '#1776BA',
                                opacity: isLoading ? 0.6 : 1,
                            },
                        ]}
                        onPress={handleCheckIn}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <>
                                <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
                                <ThemedText style={styles.checkInButtonText}>
                                    Effectuer le check-in
                                </ThemedText>
                            </>
                        )}
                    </TouchableOpacity>
                )}

            </ScrollView>

            {/* Modal QR Code */}
            <Modal
                visible={showQrCode}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowQrCode(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: cardBackgroundColor }]}>
                        <View style={styles.modalHeader}>
                            <ThemedText style={[styles.modalTitle, { color: primaryTextColor }]}>
                                QR Code du bagage
                            </ThemedText>
                            <TouchableOpacity onPress={() => setShowQrCode(false)}>
                                <MaterialIcons name="close" size={24} color={primaryTextColor} />
                            </TouchableOpacity>
                        </View>
                        {luggage.qrCode && (
                            <Image
                                source={{ 
                                    uri: luggage.qrCode.startsWith('data:image') 
                                        ? luggage.qrCode 
                                        : luggage.qrCode.startsWith('http://') || luggage.qrCode.startsWith('https://')
                                        ? luggage.qrCode
                                        : `data:image/png;base64,${luggage.qrCode}` 
                                }}
                                style={styles.qrCodeImage}
                                resizeMode="contain"
                                onError={(error) => {
                                    console.error('Erreur lors du chargement du QR code:', error);
                                }}
                            />
                        )}
                        {luggage.tagNumber && (
                            <ThemedText style={[styles.tagNumber, { color: secondaryTextColor }]}>
                                Tag: {luggage.tagNumber}
                            </ThemedText>
                        )}
                    </View>
                </View>
            </Modal>
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
        padding: 16,
    },
    card: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    section: {
        marginVertical: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 12,
    },
    typeStatusRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
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
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Medium',
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
    qrCodeSection: {
        marginTop: 12,
    },
    qrCodeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    qrCodeButtonText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    printSection: {
        marginTop: 12,
    },
    printButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    printButtonText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    totalPrice: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    checkInButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 8,
        marginBottom: 16,
    },
    checkInButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    payButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 8,
        marginBottom: 16,
    },
    payButtonText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        borderRadius: 20,
        padding: 24,
        width: '90%',
        maxWidth: 400,
        alignItems: 'center',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
    },
    qrCodeImage: {
        width: 250,
        height: 250,
        marginBottom: 16,
    },
    tagNumber: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
    },
    inputField: {
        marginTop: 12,
    },
    inputLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
        marginBottom: 8,
    },
    input: {
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        borderWidth: 1,
    },
    textArea: {
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        borderWidth: 1,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    dimensionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    dimensionInput: {
        flex: 1,
    },
    dimensionLabel: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 6,
    },
    switchField: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingVertical: 8,
    },
    totalDimensionsContainer: {
        marginTop: 8,
        paddingVertical: 8,
    },
    totalDimensionsText: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Medium',
        fontStyle: 'italic',
    },
    feeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        justifyContent: 'flex-end',
    },
    paidBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    paidText: {
        fontSize: 11,
        fontFamily: 'Ubuntu_Medium',
    },
    paymentWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 8,
        marginTop: 12,
        borderWidth: 1,
    },
    paymentWarningText: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Medium',
        flex: 1,
    },
});
