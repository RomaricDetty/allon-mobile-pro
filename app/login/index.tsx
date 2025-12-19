//@ts-nocheck
import { authLogin } from '@/api/auth_login';
import { AuthFormField } from '@/components/auth/AuthFormField';
import { PasswordField } from '@/components/auth/PasswordField';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
/**
 * Écran de connexion avec formulaire et options de connexion sociale
 */
const Login = () => {

    const colorScheme = useColorScheme() ?? 'light';

    // Couleurs dynamiques basées sur le thème
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const tintColor = useThemeColor({}, 'tint');

    // Couleurs spécifiques pour l'écran - style moderne avec fond blanc
    const scrollBackgroundColor = colorScheme === 'dark' ? '#000000' : '#F3F3F7';
    const secondaryTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#666666';
    const separatorLineColor = colorScheme === 'dark' ? '#3A3A3C' : '#E0E0E0';
    const linkColor = '#000000';
    const cardBackgroundColor = colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF';
    const cardBorderColor = colorScheme === 'dark' ? '#3A3A3C' : '#E0E0E0';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);


    /**
     * Handle the sign in action
     */
    const handleSignIn = async () => {

        try {

            setIsLoading(true);

            const response = await authLogin({ emailOrUsername: email.trim().toLowerCase(), password: password.trim() })
            console.log('Réponse de la connexion : ', response);
            console.log('response.data ==>, ', response.data)
            console.log('response.data.customerProfile ==>, ', response.data?.customerProfile)
            if (response.status === 200) {

                if (response.data?.user?.role && response.data?.user?.role instanceof Object) {
                    AsyncStorage.setItem('token', response.data.access_token);
                    AsyncStorage.setItem('refresh_token', response.data.refresh_token);
                    AsyncStorage.setItem('expires_at', String(response.data.expires_in));
                    AsyncStorage.setItem('token_type', response.data.token_type);
                    AsyncStorage.setItem('user_id', response.data.user.id);
                    console.log('user_id : ', response.data.user.id);
                    router.replace('/(tabs)');

                    return;
                }

                Alert.alert('Attention !', 'Vous n\'avez pas les permissions requises pour accéder à cette application.');
                return;
            }

            Alert.alert('Attention !', response.data.message);
            console.log('Erreur lors de la connexion : ', response.data);
            return;

        } catch (error) {
            console.error('Erreur lors de la connexion : ', error);
            Alert.alert('Attention !', 'Une erreur est survenue lors de la connexion, veuillez vérifier vos informations et réessayer.');
            return;
        } finally {
            setIsLoading(false);
        }

    };

    /**
     * Composant logo simple avec deux formes en 'C' stylisées
     */
    const Logo = () => (
        <View style={styles.logoContainer}>

            {/* Forme avant (plus foncée) */}
            <View style={styles.logoFront}>
                <Image
                    source={require('@/assets/images/allon-logo-transparent.png')}
                    resizeMode="cover"
                    style={{ width: 100, height: 100 }}
                />
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: scrollBackgroundColor }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Logo />

                <View style={styles.header}>
                    <Text style={[styles.title, { color: textColor }]}>Bienvenue !</Text>
                    <Text style={[styles.subtitle, { color: secondaryTextColor }]}>
                        Veuillez renseigner vos informations de connexion pour accéder à votre espace pro.
                    </Text>
                </View>

                <View style={[styles.sectionCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
                    <View style={styles.form}>
                        <AuthFormField
                            label="Adresse email ou nom d'utilisateur"
                            value={email}
                            onChangeText={setEmail}
                            placeholder=""
                            keyboardType="email-address"
                        />
                        <PasswordField
                            label="Mot de passe"
                            value={password}
                            onChangeText={setPassword}
                            placeholder=""
                        />

                        {/* <View style={[styles.optionsRow, { alignSelf: 'flex-end' }]}>
                            <Pressable onPress={onForgotPassword}>
                                <Text style={[styles.forgotPassword, { color: "#1776BA" }]}>Mot de passe oublié ?</Text>
                            </Pressable>
                        </View> */}
                    </View>
                </View>

                <Pressable
                    style={styles.primaryButton}
                    onPress={handleSignIn}
                    disabled={isLoading}
                >
                    {isLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                        <Text style={styles.primaryButtonText}>Se connecter</Text>
                    )}
                </Pressable>


            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
        paddingTop: 60,
    },
    logoContainer: {
        width: 60,
        height: 60,
        alignSelf: 'center',
        marginBottom: 40,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoFront: {
        position: 'absolute',
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ translateX: 3 }, { translateY: 3 }],
    },
    header: {
        marginBottom: 32,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
        textAlign: 'center',
    },
    form: {
        // marginBottom: 24,
        padding: 10,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        // marginBottom: 8,
    },
    forgotPassword: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    primaryButton: {
        backgroundColor: '#1776BA',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    primaryButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    googleButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        marginBottom: 24,
        gap: 8,
    },
    googleButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
        color: '#1776BA',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    footerLink: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
    },
    sectionCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
    },
});


export default Login;
