//@ts-nocheck
import { refreshTokenApi } from '@/api/auth_login';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

/**
 * Écran de redirection qui vérifie la session utilisateur
 * - Redirige vers /(tabs) si l'utilisateur est connecté
 * - Redirige vers /login si l'utilisateur n'est pas connecté
 */
const Index = () => {
    const colorScheme = useColorScheme() ?? 'light';
    const [isCheckingSession, setIsCheckingSession] = useState(true);

    /**
     * Nettoie les données d'authentification stockées
     */
    const clearAuthData = async () => {
        await AsyncStorage.multiRemove([
            'token',
            'refresh_token',
            'expires_at',
            'expires_in',
            'token_type',
            'user_id',
        ]);
    };

    /**
     * Vérifie et gère la session utilisateur
     * - Vérifie si le token existe et est valide
     * - Rafraîchit le token si nécessaire
     * - Redirige vers l'écran approprié
     */
    const checkUserSession = useCallback(async () => {
        try {
            setIsCheckingSession(true);
            const [token, expiresAt, refreshToken] = await Promise.all([
                AsyncStorage.getItem('token'),
                AsyncStorage.getItem('expires_at'),
                AsyncStorage.getItem('refresh_token'),
            ]);

            // Si aucun token n'existe, rediriger vers l'écran de connexion
            if (!token || !refreshToken) {
                await clearAuthData();
                router.replace('/login');
                return;
            }

            const currentDate = new Date();
            const expiresAtDate = expiresAt ? new Date(Number(expiresAt) * 1000) : null;

            // Vérifier si le token est expiré ou sur le point d'expirer (marge de 5 minutes)
            const isTokenExpired = !expiresAtDate || expiresAtDate < new Date(currentDate.getTime() + 5 * 60 * 1000);

            // Rafraîchir le token uniquement si nécessaire
            if (isTokenExpired) {
                try {
                    const response = await refreshTokenApi(refreshToken);
                    
                    if (response.status === 200 && response.data?.access_token) {
                        // Sauvegarder les nouveaux tokens
                        await Promise.all([
                            AsyncStorage.setItem('token', response.data.access_token),
                            AsyncStorage.setItem('expires_at', String(response.data.expires_in)),
                            AsyncStorage.setItem('token_type', response.data.token_type),
                        ]);

                        // Rediriger vers l'écran principal
                        router.replace('/(tabs)');
                        return;
                    }
                } catch (refreshError) {
                    console.error('Erreur lors du rafraîchissement du token:', refreshError);
                    // Si le refresh échoue, nettoyer et rediriger vers l'écran de connexion
                    await clearAuthData();
                    router.replace('/login');
                    return;
                }
            }

            // Si le token est encore valide, rediriger vers l'écran principal
            if (token) {
                router.replace('/(tabs)');
                return;
            }

            // Par défaut, rediriger vers l'écran de connexion
            router.replace('/login');
        } catch (error) {
            console.error('Erreur lors de la vérification de la session:', error);
            await clearAuthData();
            router.replace('/login');
        } finally {
            setIsCheckingSession(false);
        }
    }, []);

    /**
     * Vérifie l'authentification au chargement de l'écran
     */
    useEffect(() => {
        checkUserSession();
    }, [checkUserSession]);

    // Toujours afficher un fond pour éviter l'écran blanc lors de la navigation
    const backgroundColor = colorScheme === 'dark' ? '#000000' : '#F3F3F7';
    
    // Afficher le splash screen personnalisé pendant la vérification de la session
    if (isCheckingSession) {
        const textColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
        const logoSource = colorScheme === 'dark' 
            ? require('@/assets/images/onboarding/logo-allon-blanc.png')
            : require('@/assets/images/allon-logo-transparent.png');
        const proTextColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
        return (
            <View style={[styles.container, { backgroundColor }]}>
                <View style={styles.logoContainer}>
                    <Image 
                        source={logoSource} 
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text style={[styles.proText, { color: textColor }]}>PRO</Text>
                </View>
            </View>
        );
    }

    // Retourner un View vide avec fond pour éviter l'écran blanc pendant la transition
    return <View style={[styles.container, { backgroundColor }]} />;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        width: 200,
        height: 200,
    },
    proText: {
        fontSize: 24,
        fontFamily: 'Ubuntu_Bold',
        marginTop: 8,
        letterSpacing: 2,
    },
});

export default Index;
