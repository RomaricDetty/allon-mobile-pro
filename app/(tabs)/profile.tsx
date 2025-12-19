import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemePreference, useThemePreference } from '@/hooks/use-theme-preference';

/**
 * Écran de profil utilisateur
 * Permet de gérer les préférences (thème) et de se déconnecter
 */
export default function ProfileScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const { themePreference, setThemePreference, isLoading } = useThemePreference();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Couleurs dynamiques basées sur le thème
    const backgroundColor = isDark ? '#000000' : '#F3F3F7';
    const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
    const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
    const secondaryTextColor = isDark ? '#9BA1A6' : '#666666';
    const borderColor = isDark ? '#3A3A3C' : '#E0E0E0';
    const separatorColor = isDark ? '#3A3A3C' : '#E5E5E5';
    const selectedColor = '#1776BA';
    const buttonDangerColor = '#FF3B30';

    /**
     * Gère la déconnexion de l'utilisateur
     */
    const handleLogout = async () => {
        Alert.alert(
            'Déconnexion',
            'Êtes-vous sûr de vouloir vous déconnecter ?',
            [
                {
                    text: 'Annuler',
                    style: 'cancel',
                },
                {
                    text: 'Déconnexion',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsLoggingOut(true);
                            console.log('Déconnexion...');
                            // Supprimer toutes les données d'authentification
                            await AsyncStorage.multiRemove([
                                'token',
                                'refresh_token',
                                'expires_at',
                                'expires_in',
                                'token_type',
                                'user_id',
                            ]);
                            // Rediriger vers l'écran de connexion
                            router.replace('/login');
                        } catch (error) {
                            console.error('Erreur lors de la déconnexion:', error);
                            Alert.alert('Erreur', 'Une erreur est survenue lors de la déconnexion');
                        } finally {
                            setIsLoggingOut(false);
                        }
                    },
                },
            ]
        );
    };

    /**
     * Change la préférence de thème
     * @param preference - La nouvelle préférence de thème
     */
    const handleThemeChange = async (preference: ThemePreference) => {
        await setThemePreference(preference);
    };

    /**
     * Options de thème disponibles
     */
    const themeOptions: { value: ThemePreference; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
        { value: 'light', label: 'Clair', icon: 'wb-sunny' },
        { value: 'dark', label: 'Sombre', icon: 'brightness-2' },
        { value: 'system', label: 'Système', icon: 'brightness-4' },
    ];

    return (
        <View style={[styles.container, { backgroundColor }]}>
            {/* En-tête */}
            <View
                style={[
                    styles.header,
                    {
                        backgroundColor: isDark ? '#1A1A1A' : '#1776BA',
                        paddingTop: insets.top + 16,
                        paddingBottom: 16,
                    },
                ]}
            >
                <ThemedText style={[styles.headerTitle, { color: '#FFFFFF' }]}>
                    Mon compte
                </ThemedText>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Section Préférences */}
                <View
                    style={[
                        styles.section,
                        {
                            backgroundColor: cardBackgroundColor,
                            borderColor: borderColor,
                        },
                    ]}
                >
                    <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                        Apparence
                    </ThemedText>
                    <ThemedText style={[styles.sectionDescription, { color: secondaryTextColor }]}>
                        Choisissez votre thème préféré
                    </ThemedText>

                    <View style={styles.themeOptionsContainer}>
                        {themeOptions.map((option) => {
                            const isSelected = themePreference === option.value;
                            return (
                                <TouchableOpacity
                                    key={option.value}
                                    style={[
                                        styles.themeOption,
                                        {
                                            backgroundColor: isSelected
                                                ? selectedColor
                                                : isDark
                                                ? '#2A2A2A'
                                                : '#F5F5F5',
                                            borderColor: isSelected ? selectedColor : borderColor,
                                        },
                                    ]}
                                    onPress={() => handleThemeChange(option.value)}
                                    disabled={isLoading}
                                >
                                    <MaterialIcons
                                        name={option.icon}
                                        size={24}
                                        color={isSelected ? '#FFFFFF' : primaryTextColor}
                                    />
                                    <ThemedText
                                        style={[
                                            styles.themeOptionText,
                                            {
                                                color: isSelected ? '#FFFFFF' : primaryTextColor,
                                            },
                                        ]}
                                    >
                                        {option.label}
                                    </ThemedText>
                                    {isSelected && (
                                        <MaterialIcons
                                            name="check"
                                            size={20}
                                            color="#FFFFFF"
                                            style={styles.checkIcon}
                                        />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Section Compte */}
                <View
                    style={[
                        styles.section,
                        {
                            backgroundColor: cardBackgroundColor,
                            borderColor: borderColor,
                            marginTop: 16,
                        },
                    ]}
                >
                    <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                        Compte
                    </ThemedText>

                    <TouchableOpacity
                        style={[styles.logoutButton, { borderTopColor: separatorColor }]}
                        onPress={handleLogout}
                        disabled={isLoggingOut}
                    >
                        <View style={styles.logoutButtonContent}>
                            <MaterialIcons name="logout" size={24} color={buttonDangerColor} />
                            <ThemedText
                                style={[
                                    styles.logoutButtonText,
                                    { color: buttonDangerColor },
                                ]}
                            >
                                {isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}
                            </ThemedText>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontFamily: 'Ubuntu_Bold',
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    section: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
    },
    sectionTitle: {
        fontSize: 20,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 8,
    },
    sectionDescription: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 20,
    },
    themeOptionsContainer: {
        gap: 12,
    },
    themeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        gap: 12,
    },
    themeOptionText: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
    },
    checkIcon: {
        marginLeft: 'auto',
    },
    logoutButton: {
        paddingTop: 16,
        borderTopWidth: 1,
        marginTop: 8,
    },
    logoutButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    logoutButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
    },
});
