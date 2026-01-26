import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React from 'react';
import { Modal, Platform, TouchableOpacity, View } from 'react-native';
import { styles } from '@/styles/homeScreen';

/**
 * Props du composant CustomDatePicker
 */
interface CustomDatePickerProps {
    visible: boolean;
    value: Date;
    mode: 'from' | 'to';
    minimumDate?: Date;
    maximumDate?: Date;
    title: string;
    onClose: () => void;
    onConfirm: (date: Date) => void;
    onDateChange?: (event: any, selectedDate?: Date) => void;
}

/**
 * Composant de sélection de date personnalisée pour iOS et Android
 */
export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
    visible,
    value,
    mode,
    minimumDate,
    maximumDate,
    title,
    onClose,
    onConfirm,
    onDateChange,
}) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    /**
     * Gère la sélection de date sur Android
     */
    const handleAndroidDateChange = (event: any, selectedDate?: Date) => {
        if (onDateChange) {
            onDateChange(event, selectedDate);
        }
        if (Platform.OS === 'android') {
            onClose();
        }
    };

    /**
     * Gère la confirmation sur iOS
     */
    const handleConfirm = () => {
        onConfirm(value);
        onClose();
    };

    // Sur Android, afficher directement le picker natif
    if (Platform.OS === 'android' && visible) {
        return (
            <DateTimePicker
                value={value}
                mode="date"
                display="default"
                onChange={handleAndroidDateChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
            />
        );
    }

    // Sur iOS, afficher dans un modal
    if (Platform.OS === 'ios' && visible) {
        return (
            <Modal
                visible={visible}
                transparent={true}
                animationType="slide"
                onRequestClose={onClose}
            >
                <View style={styles.datePickerOverlay}>
                    <View style={[styles.datePickerContainer, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
                        <View style={styles.datePickerHeader}>
                            <ThemedText type="title" style={styles.datePickerTitle}>{title}</ThemedText>
                            <TouchableOpacity onPress={onClose}>
                                <MaterialIcons name="close" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.datePickerContent}>
                            <DateTimePicker
                                value={value}
                                mode="date"
                                display="spinner"
                                onChange={onDateChange}
                                minimumDate={minimumDate}
                                maximumDate={maximumDate}
                                textColor={isDark ? '#FFFFFF' : '#000000'}
                                themeVariant={isDark ? 'dark' : 'light'}
                            />
                        </View>
                        <View style={styles.datePickerFooter}>
                            <TouchableOpacity
                                style={[styles.datePickerButton, { backgroundColor: isDark ? '#2C2C2E' : '#F3F3F7' }]}
                                onPress={onClose}
                            >
                                <ThemedText style={styles.datePickerButtonText}>Annuler</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.datePickerButton, styles.datePickerButtonPrimary, { backgroundColor: isDark ? '#0A84FF' : '#007AFF' }]}
                                onPress={handleConfirm}
                            >
                                <ThemedText style={[styles.datePickerButtonText, styles.datePickerButtonTextPrimary]}>Confirmer</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    return null;
};
