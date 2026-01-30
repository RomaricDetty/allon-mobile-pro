import { getProfileInfos } from '@/api/auth_login';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemePreference, useThemePreference } from '@/hooks/use-theme-preference';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Interface pour les informations du profil utilisateur
 */
interface ProfileInfo {
    firstName: string;
    lastName: string;
    email: string;
    civility: string;
    dateOfBirth?: string;
    phones?: Array<{ digits: string; type: string }>;
    role?: {
        name: string;
        code: string;
        description: string;
    };
    company?: {
        fullName: string;
        abbreviation: string;
        email: string;
    };
    station?: {
        name: string;
        address: string;
    };
}

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
    const [profileInfos, setProfileInfos] = useState<ProfileInfo | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    // Couleurs dynamiques basées sur le thème
    const backgroundColor = isDark ? '#000000' : '#F3F3F7';
    const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
    const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
    const secondaryTextColor = isDark ? '#9BA1A6' : '#666666';
    const borderColor = isDark ? '#3A3A3C' : '#E0E0E0';
    const separatorColor = isDark ? '#3A3A3C' : '#E5E5E5';
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
     * Bascule entre le mode clair et sombre
     * @param value - true pour dark, false pour light
     */
    const handleThemeToggle = async (value: boolean) => {
        const newPreference: ThemePreference = value ? 'dark' : 'light';
        await setThemePreference(newPreference);
    };

    /**
     * Récupère les infos du profil de l'utilisateur
     */
    const getInfosProfile = async () => {
        try {
            setIsLoadingProfile(true);
            const token = await AsyncStorage.getItem('token');
            if (token) {
                const response = await getProfileInfos(token);
                console.log('Réponse des infos de profil : ', response.data);
                setProfileInfos(response.data);
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des infos de profil : ', error);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    useEffect(() => {
        getInfosProfile();
    }, []);

    /**
     * Détermine si le switch doit être activé
     * Si la préférence est 'system', on se base sur le thème actuel
     */
    const isDarkModeEnabled = themePreference === 'dark' || (themePreference === 'system' && isDark);

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
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingBottom: Platform.OS === 'ios' ? 100 : 120,
                    }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Section Informations du profil */}
                <View
                    style={[
                        styles.section,
                        {
                            backgroundColor: cardBackgroundColor,
                            borderColor: borderColor,
                        },
                    ]}
                >
                    {/* Avatar utilisateur */}
                    <View style={styles.avatarContainer}>
                        <View
                            style={[
                                styles.avatarCircle,
                                {
                                    backgroundColor: isDark ? '#2C2C2E' : '#E5E5E5',
                                    borderColor: isDark ? '#3A3A3C' : '#E0E0E0',
                                },
                            ]}
                        >
                            <MaterialIcons
                                name="account-circle"
                                size={60}
                                color={isDark ? '#9BA1A6' : '#666666'}
                            />
                        </View>
                    </View>

                    <ThemedText style={[styles.sectionTitle, { color: primaryTextColor }]}>
                        Informations personnelles
                    </ThemedText>

                    {isLoadingProfile ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#1776BA" />
                            <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
                                Chargement des informations...
                            </ThemedText>
                        </View>
                    ) : profileInfos ? (
                        <>

                            {/* Nom complet */}
                            <View style={[styles.infoRow, { borderTopColor: separatorColor }]}>
                                <View style={styles.infoLabelContainer}>
                                    <MaterialIcons name="person" size={20} color={secondaryTextColor} />
                                    <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                                        Nom & Prénom(s)
                                    </ThemedText>
                                </View>
                                <ThemedText style={[styles.infoValue, { color: primaryTextColor }]}>
                                    {profileInfos.civility === 'MR' ? 'M.' : profileInfos.civility === 'MRS' ? 'Mme' : ''}{' '}
                                    {profileInfos.firstName} {profileInfos.lastName}
                                </ThemedText>
                            </View>

                            {/* Email */}
                            <View style={[styles.infoRow, { borderTopColor: separatorColor }]}>
                                <View style={styles.infoLabelContainer}>
                                    <MaterialIcons name="email" size={20} color={secondaryTextColor} />
                                    <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                                        Email
                                    </ThemedText>
                                </View>
                                <ThemedText style={[styles.infoValue, { color: primaryTextColor }]}>
                                    {profileInfos.email}
                                </ThemedText>
                            </View>

                            {/* Téléphone */}
                            {profileInfos.phones && profileInfos.phones.length > 0 && (
                                <View style={[styles.infoRow, { borderTopColor: separatorColor }]}>
                                    <View style={styles.infoLabelContainer}>
                                        <MaterialIcons name="phone" size={20} color={secondaryTextColor} />
                                        <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                                            Téléphone
                                        </ThemedText>
                                    </View>
                                    <ThemedText style={[styles.infoValue, { color: primaryTextColor }]}>
                                        {profileInfos.phones[0].digits}
                                    </ThemedText>
                                </View>
                            )}

                            {/* Rôle */}
                            {profileInfos.role && (
                                <View style={[styles.infoRow, { borderTopColor: separatorColor }]}>
                                    <View style={styles.infoLabelContainer}>
                                        <MaterialIcons name="badge" size={20} color={secondaryTextColor} />
                                        <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                                            Rôle
                                        </ThemedText>
                                    </View>
                                    <ThemedText style={[styles.infoValue, { color: primaryTextColor }]}>
                                        {profileInfos.role.name}
                                    </ThemedText>
                                </View>
                            )}

                            {/* Entreprise */}
                            {profileInfos.company && (
                                <View style={[styles.infoRow, { borderTopColor: separatorColor }]}>
                                    <View style={styles.infoLabelContainer}>
                                        <MaterialIcons name="business" size={20} color={secondaryTextColor} />
                                        <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                                            Compagnie
                                        </ThemedText>
                                    </View>
                                    <ThemedText style={[styles.infoValue, { color: primaryTextColor }]}>
                                        {profileInfos.company.fullName}
                                    </ThemedText>
                                </View>
                            )}

                            {/* Station */}
                            {profileInfos.station && (
                                <View style={[styles.infoRow, { borderTopColor: separatorColor }]}>
                                    <View style={styles.infoLabelContainer}>
                                        <MaterialIcons name="location-on" size={20} color={secondaryTextColor} />
                                        <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                                            Gare
                                        </ThemedText>
                                    </View>
                                    <View style={styles.infoValueContainer}>
                                        <ThemedText style={[styles.infoValue, { color: primaryTextColor, marginLeft: 0 }]}>
                                            {profileInfos.station.name}
                                        </ThemedText>
                                        {profileInfos.station.address && (
                                            <ThemedText style={[styles.infoSubValue, { color: secondaryTextColor }]}>
                                                {profileInfos.station.address}
                                            </ThemedText>
                                        )}
                                    </View>
                                </View>
                            )}
                        </>
                    ) : null}
                </View>

                {/* Section Préférences */}
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
                        Apparence
                    </ThemedText>
                    <ThemedText style={[styles.sectionDescription, { color: secondaryTextColor }]}>
                        Configurer l'apparence de l'application
                    </ThemedText>

                    <View style={[styles.switchContainer, { borderTopColor: separatorColor }]}>
                        <View style={styles.switchContent}>
                            <View style={styles.switchLabelContainer}>
                                <MaterialCommunityIcons
                                    name={isDarkModeEnabled ? "weather-night" : "weather-sunny"}
                                    size={24}
                                    color={isDarkModeEnabled ? "#FFA726" : "#FFC107"}
                                />
                                <View style={styles.themeToggleTextContainer}>
                                    <ThemedText style={[styles.themeToggleLabel, { color: primaryTextColor }]}>Mode sombre</ThemedText>
                                    <ThemedText style={[styles.themeToggleDescription, { color: secondaryTextColor }]}>
                                        {isDarkModeEnabled ? 'Activé' : 'Désactivé'}
                                    </ThemedText>
                                </View>
                            </View>
                            <Switch
                                value={isDarkModeEnabled}
                                onValueChange={handleThemeToggle}
                                disabled={isLoading}
                                trackColor={{ false: '#E0E0E0', true: '#1776BA' }}
                                thumbColor={isDarkModeEnabled ? '#FFFFFF' : '#F4F3F4'}
                                ios_backgroundColor="#E0E0E0"
                            />
                        </View>
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
        flex: 1
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
    switchContainer: {
        paddingTop: 16,
        borderTopWidth: 1,
        marginTop: 8,
    },
    switchContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    switchLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    switchLabel: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
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

    themeToggleCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    themeToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    themeToggleTextContainer: {
        flex: 1,
    },
    themeToggleLabel: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
        marginBottom: 4,
    },
    themeToggleDescription: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
    },
    infoRow: {
        paddingTop: 16,
        borderTopWidth: 1,
        marginTop: 8,
    },
    infoLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
    },
    infoValue: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
        marginLeft: 28,
    },
    infoValueContainer: {
        marginLeft: 28,
    },
    infoSubValue: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
        marginTop: 4,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarCircle: {
        width: 80,
        height: 80,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        // borderColor: '#1776BA',
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 16,
        minHeight: 200,
    },
    loadingText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
});
