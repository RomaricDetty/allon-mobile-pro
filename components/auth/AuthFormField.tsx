import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

interface AuthFormFieldProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    required?: boolean;
    keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
    errors?: string;
    touchedFields?: boolean;
}

/**
 * Composant pour un champ de formulaire d'authentification avec fond blanc
 */
export const AuthFormField = ({
    label,
    value,
    onChangeText,
    onBlur,
    placeholder,
    required = false,
    keyboardType = 'default',
    errors,
    touchedFields,
}: AuthFormFieldProps) => {
    const colorScheme = useColorScheme() ?? 'light';
    
    // Couleurs dynamiques basées sur le thème
    const textColor = useThemeColor({}, 'text');
    
    // Couleurs spécifiques pour le champ
    const inputBackgroundColor = colorScheme === 'dark' ? '#2C2C2E' : '#FFFFFF';
    const inputBorderColor = colorScheme === 'dark' ? '#3A3A3C' : '#E0E0E0';
    const placeholderColor = colorScheme === 'dark' ? '#9BA1A6' : '#A6A6AA';

    return (
        <View style={styles.formField}>
            <Text style={[styles.formLabel, { color: textColor }]}>
                {label} {required && <Text style={{ color: inputBorderColor }}>*</Text>}
            </Text>
            <TextInput
                style={[
                    styles.formInput,
                    // {
                    //     backgroundColor: inputBackgroundColor,
                    //     borderColor: inputBorderColor,
                    //     color: textColor
                    // }
                    {
                        backgroundColor: inputBackgroundColor,
                        color: textColor,
                        borderColor: errors && touchedFields 
                        ? '#FF0000' 
                        : inputBorderColor
                    }
                ]}
                value={value}
                onChangeText={onChangeText}
                onBlur={onBlur}
                placeholder={placeholder}
                placeholderTextColor={placeholderColor}
                keyboardType={keyboardType}
                autoCapitalize="none"
            />
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
    formInput: {
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        borderWidth: 1,
    },
});


