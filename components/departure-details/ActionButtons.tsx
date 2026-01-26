import { ThemedText } from '@/components/themed-text';
import { styles } from '@/styles/departureDetails';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ActionButtonsProps {
    showStartTrajectButton: boolean;
    isDark: boolean;
    borderColor: string;
    primaryTextColor: string;
    onScanQR: () => void;
    onStartTraject: () => void;
}

/**
 * Composant affichant les boutons d'action (Validation et Démarrer)
 * @param showStartTrajectButton - Indique si le bouton de démarrage doit être affiché
 * @param isDark - Indique si le thème est sombre
 * @param borderColor - La couleur des bordures
 * @param primaryTextColor - La couleur du texte principal
 * @param onScanQR - Fonction appelée lors du clic sur le bouton de validation
 * @param onStartTraject - Fonction appelée lors du clic sur le bouton de démarrage
 */
export const ActionButtons: React.FC<ActionButtonsProps> = ({
    showStartTrajectButton,
    isDark,
    borderColor,
    primaryTextColor,
    onScanQR,
    onStartTraject,
}) => {
    const insets = useSafeAreaInsets();

    if (!showStartTrajectButton) {
        return null;
    }

    return (
        <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.buttonsRow}>
                <TouchableOpacity
                    style={[styles.scanButton, { backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF', borderColor: borderColor }]}
                    onPress={onScanQR}
                >
                    <MaterialIcons name="check-circle" size={24} color={primaryTextColor} />
                    <ThemedText style={[styles.scanButtonText, { color: primaryTextColor }]}>Validation</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.downloadButton, { backgroundColor: "#1776BA" }]}
                    onPress={onStartTraject}
                >
                    <MaterialIcons name="directions-bus-filled" size={24} color="#FFFFFF" />
                    <ThemedText style={[styles.downloadButtonText, {}]}>Démarrer</ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
};
