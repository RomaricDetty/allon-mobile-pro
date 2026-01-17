//@ts-nocheck
import { authLogin } from '@/api/auth_login';
import { AuthFormField } from '@/components/auth/AuthFormField';
import { PasswordField } from '@/components/auth/PasswordField';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Composant Logo optimisé - extrait pour éviter les re-créations
 */
const Logo = React.memo(({ logoScale, logoTranslateY }: { logoScale: Animated.Value; logoTranslateY: Animated.Value }) => (
    <Animated.View
        style={[
            styles.logoContainer,
            {
                transform: [
                    { scale: logoScale },
                    { translateY: logoTranslateY }
                ],
            }
        ]}
    >
        <View style={styles.logoFront}>
            <Image
                source={require('@/assets/images/allon-logo-transparent.png')}
                resizeMode="cover"
                style={{ width: 100, height: 100 }}
            />
        </View>
    </Animated.View>
));

Logo.displayName = 'Logo';

/**
 * Écran de connexion optimisé avec validation et améliorations visuelles
 */
const Login = () => {
    const colorScheme = useColorScheme() ?? 'light';

    // États du formulaire
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [emailTouched, setEmailTouched] = useState(false);
    const [passwordTouched, setPasswordTouched] = useState(false);

    // Animation pour le bouton
    const buttonOpacity = useMemo(() => new Animated.Value(1), []);

    // Valeurs animées pour réduire les éléments quand le clavier apparaît
    const logoScale = useRef(new Animated.Value(1)).current;
    const headerScale = useRef(new Animated.Value(1)).current;
    const logoTranslateY = useRef(new Animated.Value(0)).current;
    const headerTranslateY = useRef(new Animated.Value(0)).current;

    // Couleurs dynamiques basées sur le thème
    const textColor = useThemeColor({}, 'text');

    // Couleurs mémorisées pour éviter les recalculs
    const colors = useMemo(() => ({
        scrollBackground: colorScheme === 'dark' ? '#000000' : '#F3F3F7',
        secondaryText: colorScheme === 'dark' ? '#9BA1A6' : '#666666',
        cardBackground: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF',
        cardBorder: colorScheme === 'dark' ? '#3A3A3C' : '#E0E0E0',
        text: textColor,
    }), [colorScheme, textColor]);

    // Validation des champs
    const isValid = useMemo(() => {
        const emailValid = email.trim().length > 0;
        const passwordValid = password.trim().length >= 6;
        return emailValid && passwordValid && !emailError && !passwordError;
    }, [email, password, emailError, passwordError]);

    /**
     * Valide le champ email
     */
    const validateEmail = useCallback((value: string) => {
        const trimmed = value.trim();
        if (!trimmed) {
            setEmailError('L\'email ou nom d\'utilisateur est requis');
            return false;
        }
        setEmailError('');
        return true;
    }, []);

    /**
     * Valide le champ mot de passe
     */
    const validatePassword = useCallback((value: string) => {
        const trimmed = value.trim();
        if (!trimmed) {
            setPasswordError('Le mot de passe est requis');
            return false;
        }
        if (trimmed.length < 6) {
            setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
            return false;
        }
        setPasswordError('');
        return true;
    }, []);

    /**
     * Gère le changement de l'email avec validation
     */
    const handleEmailChange = useCallback((text: string) => {
        setEmail(text);
        if (emailTouched) {
            validateEmail(text);
        }
    }, [emailTouched, validateEmail]);

    /**
     * Gère le changement du mot de passe avec validation
     */
    const handlePasswordChange = useCallback((text: string) => {
        setPassword(text);
        if (passwordTouched) {
            validatePassword(text);
        }
    }, [passwordTouched, validatePassword]);

    /**
     * Gère le blur de l'email
     */
    const handleEmailBlur = useCallback(() => {
        setEmailTouched(true);
        validateEmail(email);
    }, [email, validateEmail]);

    /**
     * Gère le blur du mot de passe
     */
    const handlePasswordBlur = useCallback(() => {
        setPasswordTouched(true);
        validatePassword(password);
    }, [password, validatePassword]);

    /**
     * Sauvegarde les données utilisateur de manière optimisée
     */
    const saveUserData = useCallback(async (responseData: any) => {
        const expiresInSeconds = responseData.expires_in || 3600;
        const expiresAtTimestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;

        // Batch les opérations AsyncStorage pour améliorer les performances
        await AsyncStorage.multiSet([
            ['token', responseData.access_token],
            ['refresh_token', responseData.refresh_token],
            ['expires_at', String(expiresAtTimestamp)],
            ['token_type', responseData.token_type],
            ['user_id', responseData.user.id],
            ['user_role', responseData.user.role.code.toLowerCase()],
            ['company_id', responseData.user.company.id],
        ]);
    }, []);

    /**
     * Gère la connexion avec validation et gestion d'erreurs améliorée
     */
    const handleSignIn = useCallback(async () => {
        // Validation avant soumission
        const isEmailValid = validateEmail(email);
        const isPasswordValid = validatePassword(password);

        setEmailTouched(true);
        setPasswordTouched(true);

        if (!isEmailValid || !isPasswordValid) {
            Alert.alert('Attention !', 'Veuillez vérifier vos informations de connexion et réessayer.');
            Animated.timing(buttonOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
            return;
        }

        try {
            setIsLoading(true);

            // Animation du bouton
            Animated.timing(buttonOpacity, {
                toValue: 0.7,
                duration: 200,
                useNativeDriver: true,
            }).start();

            const response = await authLogin({
                emailOrUsername: email.trim().toLowerCase(),
                password: password.trim()
            });

            if (response.status === 200) {
                if (response.data?.user?.role && response.data?.user?.role instanceof Object) {
                    await saveUserData(response.data);
                    router.replace('/(tabs)');
                    return;
                }

                Alert.alert(
                    'Attention !',
                    'Vous n\'avez pas les permissions requises pour accéder à cette application.'
                );
                return;
            }

            Alert.alert('Attention !', response.data?.message || 'Une erreur est survenue lors de la connexion.');
        } catch (error: any) {
            console.error('Erreur lors de la connexion : ', error);

            const errorMessage = error.response?.data?.message
                || 'Une erreur est survenue lors de la connexion. Veuillez vérifier vos informations et réessayer.';

            Alert.alert('Attention !', errorMessage);
        } finally {
            setIsLoading(false);
            Animated.timing(buttonOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [email, password, validateEmail, validatePassword, saveUserData, buttonOpacity]);

    // Styles dynamiques mémorisés
    const dynamicStyles = useMemo(() => ({
        container: { backgroundColor: colors.scrollBackground },
        title: { color: colors.text },
        subtitle: { color: colors.secondaryText },
        sectionCard: {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder
        },
    }), [colors]);

    /**
     * Gère l'animation de réduction/agrandissement des éléments selon l'état du clavier
     */
    useEffect(() => {
        const keyboardWillShow = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => {
                Animated.parallel([
                    Animated.timing(logoScale, {
                        toValue: 0.75,
                        duration: 250,
                        useNativeDriver: true,
                    }),
                    Animated.timing(headerScale, {
                        toValue: 0.9,
                        duration: 250,
                        useNativeDriver: true,
                    }),
                    Animated.timing(logoTranslateY, {
                        toValue: -8,
                        duration: 250,
                        useNativeDriver: true,
                    }),
                    Animated.timing(headerTranslateY, {
                        toValue: -6,
                        duration: 250,
                        useNativeDriver: true,
                    }),
                ]).start();
            }
        );

        const keyboardWillHide = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                Animated.parallel([
                    Animated.timing(logoScale, {
                        toValue: 1,
                        duration: 250,
                        useNativeDriver: true,
                    }),
                    Animated.timing(headerScale, {
                        toValue: 1,
                        duration: 250,
                        useNativeDriver: true,
                    }),
                    Animated.timing(logoTranslateY, {
                        toValue: 0,
                        duration: 250,
                        useNativeDriver: true,
                    }),
                    Animated.timing(headerTranslateY, {
                        toValue: 0,
                        duration: 250,
                        useNativeDriver: true,
                    }),
                ]).start();
            }
        );

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, [logoScale, headerScale, logoTranslateY, headerTranslateY]);

    return (
        <KeyboardAvoidingView
            style={[styles.container, dynamicStyles.container]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Logo logoScale={logoScale} logoTranslateY={logoTranslateY} />

                <Animated.View
                    style={[
                        styles.header,
                        {
                            transform: [
                                { scale: headerScale },
                                { translateY: headerTranslateY }
                            ],
                        }
                    ]}
                >
                    <Text style={[styles.title, dynamicStyles.title]}>Bienvenue !</Text>
                    <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
                        Veuillez renseigner vos informations de connexion pour accéder à votre espace pro.
                    </Text>
                </Animated.View>

                <View style={[styles.sectionCard, dynamicStyles.sectionCard]}>
                    <View style={styles.form}>
                        
                        {/* Champ pour l'email ou le nom d'utilisateur */}
                        <AuthFormField
                            label="Adresse email ou nom d'utilisateur"
                            value={email}
                            onChangeText={handleEmailChange}
                            onBlur={handleEmailBlur}
                            placeholder=""
                            keyboardType="email-address"
                            errors={emailError}
                            touchedFields={emailTouched}
                        />

                        {/* Champ pour le mot de passe */}
                        <PasswordField
                            label="Mot de passe"
                            value={password}
                            onChangeText={handlePasswordChange}
                            onBlur={handlePasswordBlur}
                            placeholder=""
                            errors={passwordError}
                            touchedFields={passwordTouched}
                        />

                        {/* Bouton pour oublier le mot de passe */}
                        <View style={{ alignItems: 'flex-end' }}>
                            <Pressable onPress={() => router.push('/login/forgot-password')}>
                                <Text style={styles.forgotPassword}>Mot de passe oublié ?</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>

                <Animated.View style={{ opacity: buttonOpacity }}>
                    <Pressable
                        style={[
                            styles.primaryButton,
                            (isLoading) && styles.primaryButtonDisabled
                        ]}
                        onPress={handleSignIn}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Se connecter</Text>
                        )}
                    </Pressable>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
        paddingTop: 60,
    },
    logoContainer: {
        width: 100,
        height: 100,
        alignSelf: 'center',
        // marginBottom: 10,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoFront: {
        position: 'absolute',
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoImage: {
        width: 100,
        height: 100,
    },
    header: {
        marginBottom: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 4,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    form: {
        padding: 10,
    },
    primaryButton: {
        backgroundColor: '#1776BA',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        minHeight: 52,
    },
    primaryButtonDisabled: {
        opacity: 0.5,
    },
    primaryButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    sectionCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
    },
    forgotPassword: {
        fontSize: 15,
        fontFamily: 'Ubuntu_Medium',
        color: '#1776BA',
        textAlign: 'right',
        marginTop: 10,
    },
});


export default Login;
