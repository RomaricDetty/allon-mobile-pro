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
 * Interface pour le payload d'enregistrement
 */
interface RegisterLuggagePayload {
    bookingItemId: string;
    bookingId: string;
    departureId: string;
    items: LuggageItem[];
}

/**
 * Écran d'ajout de bagages
 * Permet d'ajouter un ou plusieurs bagages avant de les enregistrer
 */
export default function AddBaggageScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        bookingItemId: string;
        departureId: string;
        bookingId: string;
    }>();

    const [luggageItems, setLuggageItems] = useState<LuggageItem[]>([]);
    const [currentFormIndex, setCurrentFormIndex] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showTypePicker, setShowTypePicker] = useState(false);
    const [pickingForIndex, setPickingForIndex] = useState<number | null>(null);

    // État du formulaire actuel
    const [formData, setFormData] = useState<LuggageItem>({
        type: LuggageType.CHECKED,
        estimatedWeight: 0,
        estimatedDimensions: {
            length: 0,
            width: 0,
            height: 0,
            total: 0,
        },
        description: '',
        isFragile: false,
    });

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
     * Calcule le total des dimensions (en cm³)
     */
    const calculateTotalDimensions = (length: number, width: number, height: number): number => {
        return length * width * height;
    };

    /**
     * Met à jour les dimensions et recalcule le total
     */
    const updateDimensions = (field: 'length' | 'width' | 'height', value: string) => {
        const numValue = parseFloat(value) || 0;
        const newDimensions = {
            ...formData.estimatedDimensions,
            [field]: numValue,
        };
        newDimensions.total = calculateTotalDimensions(
            newDimensions.length,
            newDimensions.width,
            newDimensions.height
        );

        setFormData({
            ...formData,
            estimatedDimensions: newDimensions,
        });
    };

    /**
     * Réinitialise le formulaire
     */
    const resetForm = () => {
        setFormData({
            type: LuggageType.CHECKED,
            estimatedWeight: 0,
            estimatedDimensions: {
                length: 0,
                width: 0,
                height: 0,
                total: 0,
            },
            description: '',
            isFragile: false,
        });
        setCurrentFormIndex(null);
    };

    /**
     * Valide le formulaire
     */
    const validateForm = (): boolean => {
        if (!formData.type) {
            Alert.alert('Erreur', 'Veuillez sélectionner un type de bagage.');
            return false;
        }
        if (formData.estimatedWeight <= 0) {
            Alert.alert('Erreur', 'Veuillez saisir un poids valide.');
            return false;
        }
        if (
            formData.estimatedDimensions.length <= 0 ||
            formData.estimatedDimensions.width <= 0 ||
            formData.estimatedDimensions.height <= 0
        ) {
            Alert.alert('Erreur', 'Veuillez saisir toutes les dimensions.');
            return false;
        }
        if (!formData.description.trim()) {
            Alert.alert('Erreur', 'Veuillez saisir une description.');
            return false;
        }
        return true;
    };

    /**
     * Ajoute un bagage à la liste ou met à jour un bagage existant
     */
    const handleAddToList = () => {
        if (!validateForm()) {
            return;
        }

        if (currentFormIndex !== null) {
            // Mise à jour d'un bagage existant
            const updatedItems = [...luggageItems];
            updatedItems[currentFormIndex] = { ...formData };
            setLuggageItems(updatedItems);
            setCurrentFormIndex(null);
        } else {
            // Ajout d'un nouveau bagage
            setLuggageItems([...luggageItems, { ...formData }]);
        }
        resetForm();
    };

    /**
     * Supprime un bagage de la liste
     */
    const handleRemoveFromList = (index: number) => {
        Alert.alert(
            'Supprimer le bagage',
            'Êtes-vous sûr de vouloir supprimer ce bagage de la liste ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => {
                        const updatedItems = luggageItems.filter((_, i) => i !== index);
                        setLuggageItems(updatedItems);
                        if (currentFormIndex === index) {
                            resetForm();
                        } else if (currentFormIndex !== null && currentFormIndex > index) {
                            setCurrentFormIndex(currentFormIndex - 1);
                        }
                    },
                },
            ]
        );
    };

    /**
     * Édite un bagage de la liste
     */
    const handleEditFromList = (index: number) => {
        setFormData({ ...luggageItems[index] });
        setCurrentFormIndex(index);
    };

    /**
     * Enregistre tous les bagages
     */
    const handleSubmitAll = async () => {
        if (luggageItems.length === 0) {
            Alert.alert('Erreur', 'Veuillez ajouter au moins un bagage avant d\'enregistrer.');
            return;
        }

        try {
            setIsSubmitting(true);
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                throw new Error('Token non disponible');
            }

            const payload: RegisterLuggagePayload = {
                bookingItemId: params.bookingItemId,
                bookingId: params.bookingId,
                departureId: params.departureId,
                items: luggageItems,
            };

            const response = await axios.post(`${baseUrl}/luggage`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.data) {
                Alert.alert('Succès', `${luggageItems.length} bagage(s) enregistré(s) avec succès.`, [
                    {
                        text: 'OK',
                        onPress: () => {
                            router.back();
                        },
                    },
                ]);
            }
        } catch (error: any) {
            console.error('Erreur lors de l\'enregistrement des bagages:', error);
            Alert.alert(
                'Erreur',
                error.response?.data?.message || 'Une erreur est survenue lors de l\'enregistrement des bagages.',
                [{ text: 'OK' }]
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Gère le retour à l'écran précédent
     */
    const handleBack = () => {
        if (luggageItems.length > 0 || currentFormIndex !== null) {
            Alert.alert(
                'Quitter',
                'Vous avez des bagages non enregistrés. Êtes-vous sûr de vouloir quitter ?',
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Quitter',
                        style: 'destructive',
                        onPress: () => router.back(),
                    },
                ]
            );
        } else {
            router.back();
        }
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
                        {currentFormIndex !== null ? 'Modifier le bagage' : 'Ajouter des bagages'}
                    </ThemedText>

                    <View style={styles.headerButton} />
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Liste des bagages ajoutés */}
                {luggageItems.length > 0 && (
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
                                Bagages à enregistrer ({luggageItems.length})
                            </ThemedText>

                            {luggageItems.map((luggage, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.luggageCard,
                                        {
                                            backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
                                            borderColor: borderColor,
                                        },
                                    ]}
                                >
                                    <View style={styles.luggageHeader}>
                                        <ThemedText style={[styles.luggageTitle, { color: primaryTextColor }]}>
                                            Bagage #{index + 1}
                                        </ThemedText>
                                        <View style={styles.luggageActions}>
                                            <TouchableOpacity
                                                style={styles.actionButton}
                                                onPress={() => handleEditFromList(index)}
                                            >
                                                <MaterialIcons name="edit" size={20} color="#1776BA" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.actionButton}
                                                onPress={() => handleRemoveFromList(index)}
                                            >
                                                <MaterialIcons name="delete" size={20} color="#FF3B30" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.luggageDetails}>
                                        <View style={styles.detailRow}>
                                            <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                                Type
                                            </ThemedText>
                                            <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                                {getLuggageTypeLabel(luggage.type)}
                                            </ThemedText>
                                        </View>
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
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Formulaire d'ajout */}
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
                            {currentFormIndex !== null ? 'Modifier le bagage' : 'Nouveau bagage'}
                        </ThemedText>

                        {/* Type de bagage */}
                        <View style={styles.formField}>
                            <ThemedText style={[styles.formLabel, { color: labelTextColor }]}>
                                Type de bagage *
                            </ThemedText>
                            <TouchableOpacity
                                style={[
                                    styles.pickerButton,
                                    {
                                        backgroundColor: inputBackgroundColor,
                                        borderColor: inputBorderColor,
                                    },
                                ]}
                                onPress={() => {
                                    setPickingForIndex(currentFormIndex);
                                    setShowTypePicker(true);
                                }}
                            >
                                <ThemedText style={[styles.pickerText, { color: primaryTextColor }]}>
                                    {getLuggageTypeLabel(formData.type)}
                                </ThemedText>
                                <MaterialIcons name="arrow-drop-down" size={24} color={primaryTextColor} />
                            </TouchableOpacity>
                        </View>

                        {/* Poids estimé */}
                        <View style={styles.formField}>
                            <ThemedText style={[styles.formLabel, { color: labelTextColor }]}>
                                Poids estimé (kg) *
                            </ThemedText>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: inputBackgroundColor,
                                        borderColor: inputBorderColor,
                                        color: primaryTextColor,
                                    },
                                ]}
                                value={formData.estimatedWeight > 0 ? `${formData.estimatedWeight}` : ''}
                                onChangeText={(text) => {
                                    const weight = parseFloat(text) || 0;
                                    setFormData({ ...formData, estimatedWeight: weight });
                                }}
                                placeholder="0"
                                placeholderTextColor={secondaryTextColor}
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Dimensions */}
                        <View style={styles.formField}>
                            <ThemedText style={[styles.formLabel, { color: labelTextColor }]}>
                                Dimensions (cm) *
                            </ThemedText>
                            <View style={styles.dimensionsRow}>
                                <View style={[styles.dimensionInput, { flex: 1 }]}>
                                    <ThemedText style={[styles.dimensionLabel, { color: labelTextColor }]}>
                                        Longueur
                                    </ThemedText>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor: inputBackgroundColor,
                                                borderColor: inputBorderColor,
                                                color: primaryTextColor,
                                            },
                                        ]}
                                        value={
                                            formData.estimatedDimensions.length > 0
                                                ? `${formData.estimatedDimensions.length}`
                                                : ''
                                        }
                                        onChangeText={(text) => updateDimensions('length', text)}
                                        placeholder="0"
                                        placeholderTextColor={secondaryTextColor}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={[styles.dimensionInput, { flex: 1 }]}>
                                    <ThemedText style={[styles.dimensionLabel, { color: labelTextColor }]}>
                                        Largeur
                                    </ThemedText>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor: inputBackgroundColor,
                                                borderColor: inputBorderColor,
                                                color: primaryTextColor,
                                            },
                                        ]}
                                        value={
                                            formData.estimatedDimensions.width > 0
                                                ? `${formData.estimatedDimensions.width}`
                                                : ''
                                        }
                                        onChangeText={(text) => updateDimensions('width', text)}
                                        placeholder="0"
                                        placeholderTextColor={secondaryTextColor}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={[styles.dimensionInput, { flex: 1 }]}>
                                    <ThemedText style={[styles.dimensionLabel, { color: labelTextColor }]}>
                                        Hauteur
                                    </ThemedText>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor: inputBackgroundColor,
                                                borderColor: inputBorderColor,
                                                color: primaryTextColor,
                                            },
                                        ]}
                                        value={
                                            formData.estimatedDimensions.height > 0
                                                ? `${formData.estimatedDimensions.height}`
                                                : ''
                                        }
                                        onChangeText={(text) => updateDimensions('height', text)}
                                        placeholder="0"
                                        placeholderTextColor={secondaryTextColor}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>
                            {formData.estimatedDimensions.total > 0 && (
                                <ThemedText
                                    style={[styles.totalDimensions, { color: secondaryTextColor }]}
                                >
                                    Total: {formData.estimatedDimensions.total} cm³
                                </ThemedText>
                            )}
                        </View>

                        {/* Description */}
                        <View style={styles.formField}>
                            <ThemedText style={[styles.formLabel, { color: labelTextColor }]}>
                                Description *
                            </ThemedText>
                            <TextInput
                                style={[
                                    styles.textArea,
                                    {
                                        backgroundColor: inputBackgroundColor,
                                        borderColor: inputBorderColor,
                                        color: primaryTextColor,
                                    },
                                ]}
                                value={formData.description}
                                onChangeText={(text) => setFormData({ ...formData, description: text })}
                                placeholder="Décrivez le bagage..."
                                placeholderTextColor={secondaryTextColor}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>

                        {/* Fragile */}
                        <View style={styles.formField}>
                            <View style={styles.switchRow}>
                                <ThemedText style={[styles.formLabel, { color: labelTextColor }]}>
                                    Bagage fragile
                                </ThemedText>
                                <Switch
                                    value={formData.isFragile}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, isFragile: value })
                                    }
                                    trackColor={{ false: '#767577', true: '#1776BA' }}
                                    thumbColor={formData.isFragile ? '#FFFFFF' : '#f4f3f4'}
                                />
                            </View>
                        </View>

                        {/* Bouton pour ajouter à la liste */}
                        <TouchableOpacity
                            style={[
                                styles.addToListButton,
                                { backgroundColor: '#1776BA', opacity: isSubmitting ? 0.6 : 1 },
                            ]}
                            onPress={handleAddToList}
                            disabled={isSubmitting}
                        >
                            <MaterialIcons
                                name={currentFormIndex !== null ? 'check' : 'add'}
                                size={24}
                                color="#FFFFFF"
                            />
                            <ThemedText style={styles.addToListButtonText}>
                                {currentFormIndex !== null ? 'Mettre à jour' : 'Ajouter à la liste'}
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Bouton pour enregistrer tous les bagages */}
                {luggageItems.length > 0 && (
                    <TouchableOpacity
                        style={[
                            styles.submitAllButton,
                            { backgroundColor: '#34C759', opacity: isSubmitting ? 0.6 : 1 },
                        ]}
                        onPress={handleSubmitAll}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <>
                                <MaterialIcons name="save" size={24} color="#FFFFFF" />
                                <ThemedText style={styles.submitAllButtonText}>
                                    Enregistrer {luggageItems.length} bagage(s)
                                </ThemedText>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Modal pour le sélecteur de type */}
            <Modal
                visible={showTypePicker}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowTypePicker(false)}
            >
                <View style={styles.pickerOverlay}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={() => setShowTypePicker(false)}
                    />
                    <View
                        style={[
                            styles.pickerContainer,
                            {
                                backgroundColor: cardBackgroundColor,
                                borderColor: borderColor,
                            },
                        ]}
                    >
                        {Object.values(LuggageType).map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.pickerOption,
                                    {
                                        backgroundColor:
                                            formData.type === type
                                                ? isDark
                                                    ? '#2A2A2A'
                                                    : '#F5F5F5'
                                                : 'transparent',
                                        borderBottomColor: borderColor,
                                    },
                                ]}
                                onPress={() => {
                                    setFormData({ ...formData, type });
                                    setShowTypePicker(false);
                                }}
                            >
                                <ThemedText style={[styles.pickerOptionText, { color: primaryTextColor }]}>
                                    {getLuggageTypeLabel(type)}
                                </ThemedText>
                                {formData.type === type && (
                                    <MaterialIcons name="check" size={20} color="#1776BA" />
                                )}
                            </TouchableOpacity>
                        ))}
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
    luggageCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    luggageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    luggageTitle: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    luggageActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 8,
    },
    luggageDetails: {
        gap: 8,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
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
    formField: {
        marginBottom: 20,
    },
    formLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
        marginBottom: 8,
    },
    pickerButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    pickerText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    input: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 44,
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    dimensionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    dimensionInput: {
        gap: 8,
    },
    dimensionLabel: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
    },
    totalDimensions: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
        marginTop: 8,
    },
    textArea: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 100,
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    addToListButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 8,
        marginTop: 8,
    },
    addToListButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    submitAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 8,
        marginTop: 8,
    },
    submitAllButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerContainer: {
        width: '80%',
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    pickerOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    pickerOptionText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
    },
});
