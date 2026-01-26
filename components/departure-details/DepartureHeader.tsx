import { ThemedText } from '@/components/themed-text';
import { styles } from '@/styles/departureDetails';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DepartureHeaderProps {
    onBack: () => void;
    isDark: boolean;
}

/**
 * Composant d'en-tête pour l'écran de détails du départ
 * @param onBack - Fonction appelée lors du clic sur le bouton retour
 * @param isDark - Indique si le thème est sombre
 */
export const DepartureHeader: React.FC<DepartureHeaderProps> = ({ onBack, isDark }) => {
    const insets = useSafeAreaInsets();
    const headerBackgroundColor = isDark ? '#1A1A1A' : '#1776BA';

    return (
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
                    onPress={onBack}
                >
                    <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                <ThemedText style={[styles.headerTitle, { color: '#FFFFFF' }]}>
                    Détails du trajet
                </ThemedText>
            </View>
        </View>
    );
};
