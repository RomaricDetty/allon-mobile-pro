//@ts-nocheck
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface CheckboxProps {
    label: string;
    checked: boolean;
    onToggle: () => void;
}

/**
 * Composant checkbox personnalisé
 */
export const Checkbox = ({ label, checked, onToggle }: CheckboxProps) => {
    const colorScheme = useColorScheme() ?? 'light';
    
    // Couleurs dynamiques basées sur le thème
    const textColor = useThemeColor({}, 'text');
    const tintColor = useThemeColor({}, 'tint');
    
    // Couleurs spécifiques pour la checkbox
    const checkboxBackgroundColor = colorScheme === 'dark' ? '#2C2C2E' : '#FFFFFF';
    const checkboxBorderColor = colorScheme === 'dark' ? '#3A3A3C' : '#E0E0E0';
    const checkboxCheckedColor = tintColor === '#fff' ? '#1776BA' : tintColor;

    return (
        <Pressable style={styles.container} onPress={onToggle}>
            <View
                style={[
                    styles.checkbox,
                    {
                        backgroundColor: checked ? checkboxCheckedColor : checkboxBackgroundColor,
                        borderColor: checked ? checkboxCheckedColor : checkboxBorderColor
                    }
                ]}
            >
                {checked && (
                    <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                )}
            </View>
            <Text style={[styles.label, { color: textColor, width: '80%' }]}>{label}</Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
});



