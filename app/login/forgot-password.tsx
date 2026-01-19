//@ts-nocheck
import { forgotPasswordApi, resetPasswordApi, sendResetCodeApi, verifyResetCodeApi } from '@/api/auth_login';
import { AuthFormField } from '@/components/auth/AuthFormField';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

/**
 * Composant Stepper pour afficher la progression
 */
const Stepper = ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const activeColor = '#1776BA';
    const inactiveColor = colorScheme === 'dark' ? '#3A3A3C' : '#E0E0E0';
    const activeTextColor = '#FFFFFF';
    const inactiveTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#666666';

    return (
        <View style={styles.stepperContainer}>
            {Array.from({ length: totalSteps }, (_, index) => {
                const stepNumber = index + 1;
                const isCompleted = stepNumber < currentStep;
                const isActive = stepNumber === currentStep;
                
                return (
                    <React.Fragment key={stepNumber}>
                        <View style={styles.stepperStep}>
                            <View
                                style={[
                                    styles.stepperCircle,
                                    {
                                        backgroundColor: isCompleted || isActive ? activeColor : inactiveColor,
                                    },
                                ]}
                            >
                                {isCompleted ? (
                                    <Ionicons name="checkmark" size={16} color={activeTextColor} />
                                ) : (
                                    <Text
                                        style={[
                                            styles.stepperNumber,
                                            {
                                                color: isActive ? activeTextColor : inactiveTextColor,
                                            },
                                        ]}
                                    >
                                        {stepNumber}
                                    </Text>
                                )}
                            </View>
                        </View>
                        {stepNumber < totalSteps && (
                            <View
                                style={[
                                    styles.stepperLine,
                                    {
                                        backgroundColor: isCompleted ? activeColor : inactiveColor,
                                    },
                                ]}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
};

/**
 * Écran de réinitialisation de mot de passe avec stepper
 */
export default function ForgotPasswordScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const textColor = useThemeColor({}, 'text');
    const secondaryTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#666666';
    const cardBackgroundColor = colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF';
    const cardBorderColor = colorScheme === 'dark' ? '#3A3A3C' : '#E0E0E0';
    const scrollBackgroundColor = colorScheme === 'dark' ? '#000000' : '#F3F3F7';
    const inputBackgroundColor = colorScheme === 'dark' ? '#2C2C2E' : '#F5F5F5';

    // États pour la navigation entre les étapes
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 4;

    // Étape 1 : Recherche de compte
    const [accountIdentifier, setAccountIdentifier] = useState('');
    const [accountData, setAccountData] = useState<any>(null);

    // Étape 2 : Sélection de la méthode
    const [selectedMethod, setSelectedMethod] = useState<'email' | 'sms' | 'whatsapp' | null>(null);

    // Étape 3 : Vérification du code
    const [verificationCode, setVerificationCode] = useState('');

    // Étape 4 : Nouveau mot de passe
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [resetToken, setResetToken] = useState('');
    const [verificationToken, setVerificationToken] = useState('');

    // États de chargement
    const [isLoading, setIsLoading] = useState(false);

    // Valeurs animées pour réduire les éléments quand le clavier apparaît
    const logoScale = useRef(new Animated.Value(1)).current;
    const headerScale = useRef(new Animated.Value(1)).current;
    const logoTranslateY = useRef(new Animated.Value(0)).current;
    const headerTranslateY = useRef(new Animated.Value(0)).current;

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

    /**
     * Sélectionne automatiquement SMS si disponible quand on arrive à l'étape 2
     */
    useEffect(() => {
        if (currentStep === 2 && accountData?.options) {
            const { options } = accountData;
            if (options.sms?.available && !selectedMethod) {
                setSelectedMethod('sms');
            }
        }
    }, [currentStep, accountData]);

    /**
     * Détermine le type de clavier à afficher selon le format de l'entrée
     */
    const getKeyboardType = () => {
        const trimmed = accountIdentifier.trim();
        if (trimmed.includes('@')) {
            return 'email-address';
        }
        if (trimmed.startsWith('+') || /^\d+$/.test(trimmed)) {
            return 'phone-pad';
        }
        return 'default';
    };

    /**
     * Étape 1 : Recherche de compte
     */
    const handleSearchAccount = async () => {
        if (accountIdentifier.trim() === '') {
            Alert.alert('Attention !', 'Veuillez renseigner votre E-mail, Username ou Téléphone');
            return;
        }

        setIsLoading(true);

        try {
            const response = await forgotPasswordApi({ emailOrPhone: accountIdentifier.trim() });
            console.log('Réponse de la demande de réinitialisation : ', response);
            
            if (response && response.status === 200 && response.data) {
                if (response.data.accountFound && response.data.options) {
                    setAccountData(response.data);
                    setCurrentStep(2);
                } else {
                    Alert.alert('Attention !', 'Aucun compte trouvé avec ces informations.');
                }
            } else {
                Alert.alert('Attention !', 'Une erreur est survenue lors de la recherche. Veuillez réessayer.');
            }
        } catch (error: any) {
            console.error('Erreur lors de la recherche de compte : ', error);
            
            let errorMessage = 'Une erreur est survenue lors de la recherche. Veuillez réessayer.';
            
            if (error?.response) {
                if (error.response.data?.message) {
                    errorMessage = error.response.data.message;
                }
            } else if (error?.message) {
                errorMessage = error.message;
            }
            
            Alert.alert('Attention !', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Étape 2 : Envoi du code via la méthode sélectionnée
     */
    const handleSendCode = async () => {
        if (!selectedMethod) {
            Alert.alert('Attention !', 'Veuillez sélectionner une méthode de réception du code');
            return;
        }

        setIsLoading(true);

        try {
            const response = await sendResetCodeApi({
                userIdOrToken: accountData.userIdToken,
                method: selectedMethod.toUpperCase()
            });

            console.log("Response envoie de code ==>, ", response?.data)

            if (response && response.status === 200) {
                setResetToken(response.data.resetToken);
                setCurrentStep(3);
            } else {
                Alert.alert('Attention !', 'Une erreur est survenue lors de l\'envoi du code. Veuillez réessayer.');
            }
        } catch (error: any) {
            console.error('Erreur lors de l\'envoi du code : ', error);
            
            let errorMessage = 'Une erreur est survenue lors de l\'envoi du code. Veuillez réessayer.';
            
            if (error?.response?.data?.message) {
                errorMessage = error.response.data.message;
            }
            
            Alert.alert('Attention !', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Étape 3 : Vérification du code
     */
    const handleVerifyCode = async () => {
        if (verificationCode.trim().length !== 6) {
            Alert.alert('Attention !', 'Veuillez entrer un code à 6 chiffres');
            return;
        }

        setIsLoading(true);

        try {
            const response = await verifyResetCodeApi({
                resetToken: resetToken,
                code: verificationCode.trim(),
            });

            if (response && response.status === 200 && response.data?.verified) {
                // Sauvegarder le verificationToken pour l'étape suivante
                if (response.data?.verificationToken) {
                    setVerificationToken(response.data.verificationToken);
                }
                setCurrentStep(4);
            } else {
                // Alert.alert('Attention !', response.data?.message || 'Le code de vérification est incorrect. Veuillez réessayer.' + ' ' + response.data?.remainingAttempts + ' tentatives restantes.');
                if (response.data?.remainingAttempts === 0 && response.data?.verified === false) {
                    Alert.alert('Attention !', 'Vous avez atteint le nombre maximum de tentatives. Veuillez réessayer svp.');
                    router.back();
                } else {
                    Alert.alert('Attention !', response.data?.message || 'Le code de vérification est incorrect. Veuillez réessayer.' + ' ' + response.data?.remainingAttempts + ' tentatives restantes.');
                    setCurrentStep(3);
                }
            }
        } catch (error: any) {
            console.error('Erreur lors de la vérification du code : ', error);
            
            let errorMessage = 'Le code de vérification est incorrect. Veuillez réessayer.';
            
            if (error?.response?.data?.message) {
                errorMessage = error.response.data.message;
            }
            
            Alert.alert('Attention !', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Renvoie le code de vérification
     */
    const handleResendCode = async () => {
        if (!selectedMethod) return;

        setIsLoading(true);

        try {
            const response = await sendResetCodeApiAgain({
                resetToken: resetToken,
                method: selectedMethod.toUpperCase()
            });
            console.log("Response envoie de code ==>, ", response?.data)

            if (response && response.status === 200) {
                setResetToken(response.data.resetToken);
                Alert.alert('Succès !', 'Un nouveau code a été envoyé.');
            } 
        } catch (error: any) {
            console.error('Erreur lors du renvoi du code : ', error);
            Alert.alert('Attention !', 'Une erreur est survenue lors du renvoi du code.');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Étape 4 : Réinitialisation du mot de passe
     */
    const handleResetPassword = async () => {
        if (newPassword.trim() === '') {
            Alert.alert('Attention !', 'Veuillez entrer un nouveau mot de passe');
            return;
        }

        if (newPassword.trim().length < 6) {
            Alert.alert('Attention !', 'Le mot de passe doit contenir au moins 6 caractères');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Attention !', 'Les mots de passe ne correspondent pas');
            return;
        }

        setIsLoading(true);

        try {
            const response = await resetPasswordApi({
                verificationToken: verificationToken,
                newPassword: newPassword.trim(),
                confirmPassword: confirmPassword.trim(),
            });
            console.log("Response réinitialisation de mot de passe ==>, ", response?.data)
            
            if (response && response.status === 200 && response.data) {
                if (response.data.success === true) {
                    Alert.alert(
                        'Succès !',
                        response.data.message || 'Votre mot de passe a été réinitialisé avec succès.',
                        [
                            {
                                text: 'OK',
                                onPress: () => router.back(),
                            },
                        ]
                    );
                } else {
                    Alert.alert(
                        'Attention !',
                        response.data.message || 'Une erreur est survenue lors de la réinitialisation. Veuillez réessayer.'
                    );
                }
            } else {
                Alert.alert('Attention !', 'Une erreur est survenue lors de la réinitialisation. Veuillez réessayer.');
            }
        } catch (error: any) {
            console.error('Erreur lors de la réinitialisation : ', error);
            
            let errorMessage = 'Une erreur est survenue lors de la réinitialisation. Veuillez réessayer.';
            
            if (error?.response?.data?.message) {
                errorMessage = error.response.data.message;
            }
            
            Alert.alert('Attention !', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Retourne à l'étape précédente
     */
    const handleCancel = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        } else {
            router.back();
        }
    };

    /**
     * Obtient le titre de l'étape actuelle
     */
    const getStepTitle = () => {
        switch (currentStep) {
            case 1:
                return 'Mot de passe oublié';
            case 2:
                return 'Réinitialiser votre mot de passe';
            case 3:
                return 'Vérification du code';
            case 4:
                return 'Nouveau mot de passe';
            default:
                return '';
        }
    };

    /**
     * Obtient le message d'instruction pour l'étape 3
     */
    const getVerificationInstruction = () => {
        if (!selectedMethod) return '';
        
        switch (selectedMethod) {
            case 'email':
                return 'Entrez le code à 6 chiffres que vous avez reçu par e-mail.';
            case 'sms':
                return 'Entrez le code à 6 chiffres que vous avez reçu par SMS.';
            case 'whatsapp':
                return 'Entrez le code à 6 chiffres que vous avez reçu par WhatsApp.';
            default:
                return 'Entrez le code à 6 chiffres que vous avez reçu.';
        }
    };

    /**
     * Composant logo
     */
    const Logo = () => (
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
    );

    /**
     * Rendu de l'étape 1 : Recherche de compte
     */
    const renderStep1 = () => (
        <>
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
                <Text style={[styles.title, { color: textColor }]}>Mot de passe oublié</Text>
                <Text style={[styles.subtitle, { color: secondaryTextColor }]}>
                    Entrez votre E-mail, Username ou Téléphone pour recevoir les instructions de réinitialisation.
                </Text>
            </Animated.View>

            <View style={[styles.sectionCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
                <View style={styles.form}>
                    <AuthFormField
                        label="E-mail, Username ou Téléphone"
                        value={accountIdentifier}
                        onChangeText={setAccountIdentifier}
                        placeholder=""
                        keyboardType={getKeyboardType()}
                    />
                </View>
            </View>

            <Pressable
                style={styles.primaryButton}
                onPress={handleSearchAccount}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <Text style={styles.primaryButtonText}>Rechercher</Text>
                )}
            </Pressable>
        </>
    );

    /**
     * Rendu de l'étape 2 : Sélection de la méthode
     */
    const renderStep2 = () => {
        if (!accountData?.options) return null;

        const { options } = accountData;

        // Vérifier si au moins une option est disponible
        const hasAvailableOption = 
            options.email?.available || 
            options.sms?.available || 
            options.whatsapp?.available;

        if (!hasAvailableOption) {
            return (
                <>
                    <View style={styles.header}>
                        <Text style={[styles.stepTitle, { color: textColor }]}>Réinitialiser votre mot de passe</Text>
                    </View>

                    <View style={[styles.sectionCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
                        <View style={styles.errorContainer}>
                            <Ionicons name="alert-circle" size={24} color="#FF3B30" style={{ marginBottom: 12 }} />
                            <Text style={[styles.errorText, { color: textColor }]}>
                                Aucune option disponible pour réinitialiser le mot de passe de ce compte.
                            </Text>
                            <Text style={[styles.errorSubtext, { color: secondaryTextColor }]}>
                                Veuillez contacter le support pour obtenir de l'aide.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.actionButtons}>
                        <Pressable style={styles.cancelButton} onPress={handleCancel}>
                            <Text style={[styles.cancelButtonText, { color: '#1776BA' }]}>Retour</Text>
                        </Pressable>
                    </View>
                </>
            );
        }

        return (
            <>
                <View style={styles.header}>
                    <Text style={[styles.stepTitle, { color: textColor }]}>Réinitialiser votre mot de passe</Text>
                    <Text style={[styles.stepInstruction, { color: secondaryTextColor }]}>
                        Comment voulez-vous recevoir votre code de réinitialisation du mot de passe ?
                    </Text>
                </View>

                <View style={[styles.sectionCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
                    {options.email?.available && (
                        <Pressable
                            style={[
                                styles.methodOption,
                                {
                                    backgroundColor: cardBackgroundColor,
                                    borderColor: selectedMethod === 'email' ? '#1776BA' : cardBorderColor,
                                },
                            ]}
                            onPress={() => setSelectedMethod('email')}
                        >
                            <View style={styles.methodOptionContent}>
                                <View style={styles.methodOptionLeft}>
                                    <Text style={[styles.methodOptionText, { color: textColor }]}>
                                        Envoyer le code par e-mail
                                    </Text>
                                    <Text style={[styles.methodOptionValue, { color: secondaryTextColor }]}>
                                        {options.email.value}
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.radioButton,
                                        {
                                            borderColor: selectedMethod === 'email' ? '#1776BA' : cardBorderColor,
                                        },
                                    ]}
                                >
                                    {selectedMethod === 'email' && (
                                        <View style={styles.radioButtonInner} />
                                    )}
                                </View>
                            </View>
                        </Pressable>
                    )}

                    {options.sms?.available && (
                        <Pressable
                            style={[
                                styles.methodOption,
                                {
                                    backgroundColor: cardBackgroundColor,
                                    borderColor: selectedMethod === 'sms' ? '#1776BA' : cardBorderColor,
                                },
                            ]}
                            onPress={() => setSelectedMethod('sms')}
                        >
                            <View style={styles.methodOptionContent}>
                                <View style={styles.methodOptionLeft}>
                                    <Text style={[styles.methodOptionText, { color: textColor }]}>
                                        Envoyer le code par SMS
                                    </Text>
                                    <Text style={[styles.methodOptionValue, { color: secondaryTextColor }]}>
                                        {options.sms.value}
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.radioButton,
                                        {
                                            borderColor: selectedMethod === 'sms' ? '#1776BA' : cardBorderColor,
                                        },
                                    ]}
                                >
                                    {selectedMethod === 'sms' && (
                                        <View style={styles.radioButtonInner} />
                                    )}
                                </View>
                            </View>
                        </Pressable>
                    )}

                    {options.whatsapp?.available && (
                        <Pressable
                            style={[
                                styles.methodOption,
                                {
                                    backgroundColor: cardBackgroundColor,
                                    borderColor: selectedMethod === 'whatsapp' ? '#1776BA' : cardBorderColor,
                                },
                            ]}
                            onPress={() => setSelectedMethod('whatsapp')}
                        >
                            <View style={styles.methodOptionContent}>
                                <View style={styles.methodOptionLeft}>
                                    <Text style={[styles.methodOptionText, { color: textColor }]}>
                                        Envoyer le code par WhatsApp
                                    </Text>
                                    <Text style={[styles.methodOptionValue, { color: secondaryTextColor }]}>
                                        {options.whatsapp.value}
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.radioButton,
                                        {
                                            borderColor: selectedMethod === 'whatsapp' ? '#1776BA' : cardBorderColor,
                                        },
                                    ]}
                                >
                                    {selectedMethod === 'whatsapp' && (
                                        <View style={styles.radioButtonInner} />
                                    )}
                                </View>
                            </View>
                        </Pressable>
                    )}
                </View>

                <View style={styles.actionButtons}>
                    <Pressable style={styles.cancelButton} onPress={handleCancel}>
                        <Text style={[styles.cancelButtonText, { color: '#1776BA' }]}>Annuler</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.primaryButton, styles.continueButton]}
                        onPress={handleSendCode}
                        disabled={isLoading || !selectedMethod}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Text style={styles.primaryButtonText}>Continuer</Text>
                                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </Pressable>
                </View>
            </>
        );
    };

    /**
     * Rendu de l'étape 3 : Vérification du code
     */
    const renderStep3 = () => (
        <>
            <View style={styles.header}>
                <Text style={[styles.stepTitle, { color: textColor }]}>Vérification du code</Text>
                <Text style={[styles.stepInstruction, { color: secondaryTextColor }]}>
                    {getVerificationInstruction()}
                </Text>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
                <View style={styles.form}>
                    <Text style={[styles.formLabel, { color: textColor }]}>Code de vérification</Text>
                    <TextInput
                        style={[
                            styles.codeInput,
                            {
                                backgroundColor: inputBackgroundColor,
                                color: textColor,
                            },
                        ]}
                        value={verificationCode}
                        onChangeText={(text) => {
                            // Limiter à 6 chiffres
                            const numericText = text.replace(/[^0-9]/g, '').slice(0, 6);
                            setVerificationCode(numericText);
                        }}
                        placeholder="123456"
                        placeholderTextColor={secondaryTextColor}
                        keyboardType="number-pad"
                        maxLength={6}
                    />
                </View>
            </View>

            <View style={styles.actionButtons}>
                <Pressable style={styles.resendButton} onPress={handleResendCode} disabled={isLoading}>
                    <Ionicons name="refresh" size={16} color="#1776BA" style={{ marginRight: 4 }} />
                    <Text style={[styles.resendButtonText, { color: '#1776BA' }]}>Renvoyer le code</Text>
                </Pressable>
            </View>

            <View style={styles.actionButtons}>
                <Pressable style={styles.cancelButton} onPress={handleCancel}>
                    <Text style={[styles.cancelButtonText, { color: '#1776BA' }]}>Annuler</Text>
                </Pressable>
                <Pressable
                    style={[styles.primaryButton, styles.verifyButton]}
                    onPress={handleVerifyCode}
                    disabled={isLoading || verificationCode.length !== 6}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Ionicons name="checkmark" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                            <Text style={styles.primaryButtonText}>Vérifier</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </>
    );

    /**
     * Rendu de l'étape 4 : Nouveau mot de passe
     */
    const renderStep4 = () => (
        <>
            <View style={styles.header}>
                <Text style={[styles.stepTitle, { color: textColor }]}>Nouveau mot de passe</Text>
                <Text style={[styles.stepInstruction, { color: secondaryTextColor }]}>
                    Entrez votre nouveau mot de passe. Il doit contenir au moins 6 caractères.
                </Text>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
                <View style={styles.form}>
                    <Text style={[styles.formLabel, { color: textColor }]}>Nouveau mot de passe</Text>
                    <View style={styles.passwordInputContainer}>
                        <TextInput
                            style={[
                                styles.passwordInput,
                                {
                                    backgroundColor: inputBackgroundColor,
                                    color: textColor,
                                },
                            ]}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder=""
                            placeholderTextColor={secondaryTextColor}
                            secureTextEntry={!showPassword}
                        />
                        <Pressable
                            style={styles.eyeIcon}
                            onPress={() => setShowPassword(!showPassword)}
                        >
                            <Ionicons
                                name={showPassword ? 'eye-off' : 'eye'}
                                size={20}
                                color={secondaryTextColor}
                            />
                        </Pressable>
                    </View>

                    <Text style={[styles.formLabel, { color: textColor, marginTop: 16 }]}>Confirmer le mot de passe</Text>
                    <View style={styles.passwordInputContainer}>
                        <TextInput
                            style={[
                                styles.passwordInput,
                                {
                                    backgroundColor: inputBackgroundColor,
                                    color: textColor,
                                },
                            ]}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder=""
                            placeholderTextColor={secondaryTextColor}
                            secureTextEntry={!showConfirmPassword}
                        />
                        <Pressable
                            style={styles.eyeIcon}
                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                            <Ionicons
                                name={showConfirmPassword ? 'eye-off' : 'eye'}
                                size={20}
                                color={secondaryTextColor}
                            />
                        </Pressable>
                    </View>
                </View>
            </View>

            <View style={styles.actionButtons}>
                <Pressable style={styles.cancelButton} onPress={handleCancel}>
                    <Text style={[styles.cancelButtonText, { color: '#1776BA' }]}>Annuler</Text>
                </Pressable>
                <Pressable
                    style={[styles.primaryButton, styles.resetButton]}
                    onPress={handleResetPassword}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Ionicons name="checkmark" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                            <Text style={styles.primaryButtonText}>Réinitialiser</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </>
    );

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: scrollBackgroundColor }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Logo />
                
                {/* En-tête avec titre et stepper */}
                <View style={styles.headerWithStepper}>
                    {/* <View style={styles.headerTitleRow}>
                        <Ionicons name="key" size={20} color={textColor} style={{ marginRight: 8 }} />
                        <Text style={[styles.headerTitle, { color: textColor }]}>{getStepTitle()}</Text>
                    </View> */}
                    <Stepper currentStep={currentStep} totalSteps={totalSteps} />
                </View>

                {/* Contenu de l'étape actuelle */}
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
                {currentStep === 4 && renderStep4()}

                {/* Footer pour l'étape 1 uniquement */}
                {currentStep === 1 && (
                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: secondaryTextColor }]}>
                            Vous vous souvenez de votre mot de passe ?{' '}
                        </Text>
                        <Pressable onPress={() => router.back()}>
                            <Text style={[styles.footerLink, { color: '#1776BA' }]}>Se connecter</Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

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
        width: 60,
        height: 60,
        alignSelf: 'center',
        marginBottom: 15,
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
    headerWithStepper: {
        marginBottom: 24,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    stepperStep: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperNumber: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
    },
    stepperLine: {
        height: 2,
        width: 40,
        marginHorizontal: 4,
    },
    header: {
        marginBottom: 20,
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
    stepTitle: {
        fontSize: 22,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    stepInstruction: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        textAlign: 'center',
    },
    form: {
        padding: 10,
    },
    formLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
        marginBottom: 8,
    },
    sectionCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
    },
    primaryButton: {
        backgroundColor: '#1776BA',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    primaryButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    continueButton: {
        flex: 1,
        marginLeft: 12,
    },
    verifyButton: {
        flex: 1,
        marginLeft: 12,
    },
    resetButton: {
        flex: 1,
        marginLeft: 12,
    },
    cancelButton: {
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    cancelButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    resendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginBottom: 16,
    },
    resendButtonText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
    },
    methodOption: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    methodOptionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    methodOptionLeft: {
        flex: 1,
    },
    methodOptionText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
        marginBottom: 4,
    },
    methodOptionValue: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    radioButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },
    radioButtonInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#1776BA',
    },
    codeInput: {
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
        textAlign: 'center',
        letterSpacing: 8,
    },
    passwordInputContainer: {
        position: 'relative',
    },
    passwordInput: {
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        paddingRight: 48,
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
    },
    eyeIcon: {
        position: 'absolute',
        right: 16,
        top: 14,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: 16,
    },
    footerText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    footerLink: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
    },
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
        textAlign: 'center',
        marginBottom: 8,
    },
    errorSubtext: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        textAlign: 'center',
    },
});
