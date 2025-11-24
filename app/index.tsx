//@ts-nocheck
import { AuthFormField } from '@/components/auth/AuthFormField';
import { PasswordField } from '@/components/auth/PasswordField';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Écran de connexion avec formulaire et options de connexion sociale
 */
const Index = () => {
    
    const colorScheme = useColorScheme() ?? 'light';
    
    // Couleurs dynamiques basées sur le thème
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const tintColor = useThemeColor({}, 'tint');
    
    // Couleurs spécifiques pour l'écran
    const scrollBackgroundColor = colorScheme === 'dark' ? '#000000' : '#F3F3F7';
    const secondaryTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#666';
    const separatorLineColor = colorScheme === 'dark' ? '#3A3A3C' : '#E0E0E0';
    const linkColor = tintColor === '#fff' ? '#1776BA' : tintColor;

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Handle the sign in action
     */
    const handleSignIn = async () => {
        setIsLoading(true);
        router.replace('/scan-qr');
        return;
        
    };



    return (
        <ScrollView
            style={[styles.container, { backgroundColor: scrollBackgroundColor }]}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <Text style={[styles.title, { color: textColor }]}>Se connecter</Text>
                <Text style={[styles.subtitle, { color: secondaryTextColor }]}>Connectez-vous pour accéder à votre compte</Text>
            </View>

            <View style={styles.form}>
                <AuthFormField
                    label="Adresse email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Entrez votre email"
                    keyboardType="email-address"
                />
                <PasswordField
                    label="Mot de passe"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Entrez votre mot de passe"
                />

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
        paddingTop: 40,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
    },
    form: {
        marginBottom: 24,
    },
    primaryButton: {
        backgroundColor: '#1776BA',
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    primaryButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    separator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    separatorLine: {
        flex: 1,
        height: 1,
    },
    separatorText: {
        marginHorizontal: 16,
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
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
});


export default Index;
