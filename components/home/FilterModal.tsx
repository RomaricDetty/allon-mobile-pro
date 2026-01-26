import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { styles } from '@/styles/homeScreen';

/**
 * Type pour les options de filtre de date
 */
export type DateFilterType = 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'custom';

/**
 * Props du composant FilterModal
 */
interface FilterModalProps {
    visible: boolean;
    dateFilter: DateFilterType;
    filterOptions: { type: DateFilterType; label: string }[];
    onClose: () => void;
    onFilterChange: (filter: DateFilterType) => void;
    onReset: () => void;
}

/**
 * Composant modal pour la sélection du filtre de date
 */
export const FilterModal: React.FC<FilterModalProps> = ({
    visible,
    dateFilter,
    filterOptions,
    onClose,
    onFilterChange,
    onReset,
}) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
                    <View style={styles.modalHeader}>
                        <ThemedText type="title" style={styles.modalTitle}>Filtrer par date</ThemedText>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcons name="close" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.filterOptions}>
                        {filterOptions.map((option) => (
                            <TouchableOpacity
                                key={option.type}
                                style={[
                                    styles.filterOption,
                                    dateFilter === option.type && styles.filterOptionActive,
                                    {
                                        backgroundColor: dateFilter === option.type
                                            ? (isDark ? '#2C2C2E' : '#F3F3F7')
                                            : 'transparent'
                                    }
                                ]}
                                onPress={() => onFilterChange(option.type)}
                            >
                                <ThemedText
                                    style={[
                                        styles.filterOptionText,
                                        dateFilter === option.type && styles.filterOptionTextActive
                                    ]}
                                >
                                    {option.label}
                                </ThemedText>
                                {dateFilter === option.type && (
                                    <MaterialIcons
                                        name="check"
                                        size={20}
                                        color={isDark ? '#FFFFFF' : '#000000'}
                                    />
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            style={[styles.resetButton, { backgroundColor: isDark ? '#2C2C2E' : '#F3F3F7' }]}
                            onPress={onReset}
                        >
                            <ThemedText style={styles.resetButtonText}>Réinitialiser</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
