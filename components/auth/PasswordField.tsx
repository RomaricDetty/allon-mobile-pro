//@ts-nocheck
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface PasswordFieldProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    required?: boolean;
    errors?: string;
    touchedFields?: boolean;
}

/**
 * Composant pour un champ de mot de passe avec affichage/masquage
 */
export const PasswordField = ({
    label,
    value,
    onChangeText,
    onBlur,
    placeholder,
    required = false,
    errors,
    touchedFields,
}: PasswordFieldProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const colorScheme = useColorScheme() ?? 'light';
    
    // Couleurs dynamiques basées sur le thème
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    
    // Couleurs spécifiques pour le champ
    const inputBackgroundColor = colorScheme === 'dark' ? '#2C2C2E' : '#FFFFFF';
    const inputBorderColor = colorScheme === 'dark' ? '#3A3A3C' : '#E0E0E0';
    const placeholderColor = colorScheme === 'dark' ? '#9BA1A6' : '#A6A6AA';

    return (
        <View style={styles.formField}>
            <Text style={[styles.formLabel, { color: textColor }]}>
                {label} {required && <Text style={{ color: inputBorderColor }}>*</Text>}
            </Text>
            <View style={[
                styles.inputContainer,
                {
                    backgroundColor: inputBackgroundColor,
                    borderColor: errors && touchedFields 
                    ? '#FF0000' 
                    : inputBorderColor
                }
            ]}>
                <TextInput
                    style={[styles.formInput, { color: textColor }]}
                    value={value}
                    onChangeText={onChangeText}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    placeholderTextColor={placeholderColor}
                    secureTextEntry={!isVisible}
                />
                <Pressable
                    style={styles.eyeButton}
                    onPress={() => setIsVisible(!isVisible)}
                >
                    <MaterialCommunityIcons
                        name={isVisible ? 'eye-off' : 'eye'}
                        size={20}
                        color={placeholderColor}
                    />
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    formField: {
        marginBottom: 16,
    },
    formLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
        marginBottom: 8,
    },
    required: {
        color: '#FF0000',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
    },
    formInput: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    eyeButton: {
        padding: 12,
    },
});



