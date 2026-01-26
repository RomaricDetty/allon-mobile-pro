import { ThemedText } from '@/components/themed-text';
import { styles } from '@/styles/departureDetails';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';

interface SearchModalProps {
    visible: boolean;
    ticketReference: string;
    isSearching: boolean;
    isDark: boolean;
    cardBackgroundColor: string;
    borderColor: string;
    primaryTextColor: string;
    secondaryTextColor: string;
    labelTextColor: string;
    buttonBackgroundColor: string;
    onClose: () => void;
    onSearch: () => void;
    onReferenceChange: (text: string) => void;
}

/**
 * Composant modal pour la recherche de ticket par référence
 * @param visible - Indique si le modal est visible
 * @param ticketReference - La référence du ticket saisie
 * @param isSearching - Indique si une recherche est en cours
 * @param isDark - Indique si le thème est sombre
 * @param cardBackgroundColor - La couleur de fond de la carte
 * @param borderColor - La couleur des bordures
 * @param primaryTextColor - La couleur du texte principal
 * @param secondaryTextColor - La couleur du texte secondaire
 * @param labelTextColor - La couleur des labels
 * @param buttonBackgroundColor - La couleur de fond des boutons
 * @param onClose - Fonction appelée pour fermer le modal
 * @param onSearch - Fonction appelée pour lancer la recherche
 * @param onReferenceChange - Fonction appelée lors du changement de la référence
 */
export const SearchModal: React.FC<SearchModalProps> = ({
    visible,
    ticketReference,
    isSearching,
    isDark,
    cardBackgroundColor,
    borderColor,
    primaryTextColor,
    secondaryTextColor,
    labelTextColor,
    buttonBackgroundColor,
    onClose,
    onSearch,
    onReferenceChange,
}) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.modalOverlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={onClose}
                >
                    <Pressable
                        style={styles.modalContentWrapper}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={[styles.modalContent, { backgroundColor: cardBackgroundColor }]}>
                            {/* En-tête du modal */}
                            <View style={styles.modalHeader}>
                                <ThemedText style={[styles.modalTitle, { color: primaryTextColor }]}>
                                    Rechercher par référence
                                </ThemedText>
                                <TouchableOpacity
                                    onPress={onClose}
                                    disabled={isSearching}
                                    style={styles.modalCloseButton}
                                >
                                    <MaterialIcons name="close" size={24} color={primaryTextColor} />
                                </TouchableOpacity>
                            </View>

                            {/* Contenu du modal avec ScrollView */}
                            <ScrollView
                                style={styles.modalScrollView}
                                contentContainerStyle={styles.modalScrollContent}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.modalBody}>
                                    <ThemedText style={[styles.modalLabel, { color: labelTextColor }]}>
                                        Référence du ticket
                                    </ThemedText>
                                    <View style={styles.inputContainer}>
                                        <TextInput
                                            style={[
                                                styles.modalInput,
                                                {
                                                    backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
                                                    borderColor: borderColor,
                                                    color: primaryTextColor,
                                                    paddingRight: ticketReference ? 45 : 16,
                                                },
                                            ]}
                                            placeholder="Entrez la référence du ticket"
                                            placeholderTextColor={secondaryTextColor}
                                            value={ticketReference}
                                            onChangeText={onReferenceChange}
                                            autoCapitalize="characters"
                                            autoCorrect={false}
                                            editable={!isSearching}
                                            returnKeyType="search"
                                            onSubmitEditing={onSearch}
                                        />
                                        {ticketReference.length > 0 && (
                                            <TouchableOpacity
                                                style={[styles.clearButton,
                                                {
                                                    backgroundColor: isDark ? '#3A3A3C' : '#CCCCCC',
                                                    width: 25, height: 25, borderRadius: 100,
                                                    borderWidth: 1, borderColor: borderColor,
                                                    justifyContent: 'center', alignItems: 'center',
                                                    top: '45%',
                                                }]}
                                                onPress={() => onReferenceChange('')}
                                                disabled={isSearching}
                                            >
                                                <MaterialIcons name="close" size={14} color={secondaryTextColor} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <ThemedText style={[styles.modalHint, { color: secondaryTextColor }]}>
                                        Saisissez le code de référence du ticket (ex: TCK-123456)
                                    </ThemedText>
                                </View>
                            </ScrollView>

                            {/* Boutons du modal */}
                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={[styles.modalCancelButton, { borderColor: borderColor }]}
                                    onPress={onClose}
                                    disabled={isSearching}
                                >
                                    <ThemedText style={[styles.modalCancelButtonText, { color: primaryTextColor }]}>
                                        Annuler
                                    </ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.modalSearchButton,
                                        {
                                            backgroundColor: buttonBackgroundColor,
                                            opacity: isSearching ? 0.6 : 1,
                                        },
                                    ]}
                                    onPress={onSearch}
                                    disabled={isSearching || !ticketReference.trim()}
                                >
                                    {isSearching ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <MaterialIcons name="search" size={20} color="#FFFFFF" />
                                            <ThemedText style={styles.modalSearchButtonText}>Rechercher</ThemedText>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
};
