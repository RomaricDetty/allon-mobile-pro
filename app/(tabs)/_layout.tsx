// @ts-nocheck
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** Couleur onglet sélectionné (iOS) */
const TAB_SELECTED_IOS = '#1776BA';
/** Couleurs onglet sélectionné (Android) */
const TAB_SELECTED_BG = 'rgba(23, 118, 186, 1)';
const TAB_SELECTED_CONTENT = '#FFFFFF';

/** Ombre de la barre d'onglets (Android uniquement) */
const TAB_BAR_SHADOW_COLOR = 'rgba(0, 0, 0, 0.5)';
const TAB_BAR_ELEVATION = 8;

/** Taille des icônes Android pour affichage net */
const ANDROID_ICON_SIZE = 72;

/** Hook pour charger les icônes vectorielles sur Android avec une taille personnalisée */
function useAndroidVectorIcons() {
    const [icons, setIcons] = useState<any>(null);

    useEffect(() => {
        if (Platform.OS === 'android') {
            Promise.all([
                MaterialCommunityIcons.getImageSource('bus', ANDROID_ICON_SIZE, '#687076'),
                MaterialCommunityIcons.getImageSource('account', ANDROID_ICON_SIZE, '#687076'),
            ]).then(([busIcon, accountIcon]) => {
                setIcons({
                    bus: busIcon,
                    person: accountIcon,
                });
            });
        }
    }, []);

    return icons;
}

/** Icônes : SF Symbols sur iOS, images générées sur Android pour affichage net */
function getTabIcons(androidIcons: any) {
    return {
        bus:
            Platform.OS === 'ios'
                ? { sf: 'bus.fill' as const }
                : androidIcons?.bus ? { src: androidIcons.bus } : { sf: 'bus.fill' as const },
        person:
            Platform.OS === 'ios'
                ? { sf: 'person.fill' as const }
                : androidIcons?.person ? { src: androidIcons.person } : { sf: 'person.fill' as const },
    };
}

/** Retourne les props de style de la barre d'onglets pour Android (couleurs thème) */
function getAndroidTabBarStyle(scheme: 'light' | 'dark' | null) {
    if (Platform.OS !== 'android') return undefined;
    const resolvedScheme = scheme ?? 'light';
    const colors = Colors[resolvedScheme];
    return {
        backgroundColor: colors.background,
        iconColor: {
            default: colors.tabIconDefault,
            selected: TAB_SELECTED_CONTENT,
        },
        labelStyle: {
            default: { color: colors.tabIconDefault },
            selected: { color: colors.tabIconSelected },
        },
        indicatorColor: TAB_SELECTED_BG,
        shadowColor: TAB_BAR_SHADOW_COLOR,
        style: { elevation: TAB_BAR_ELEVATION },
    };
}

/** Retourne les props de style de la barre d'onglets pour iOS (onglet sélectionné #1776BA) */
function getIOSTabBarStyle(scheme: 'light' | 'dark' | null) {
    if (Platform.OS !== 'ios') return undefined;
    const resolvedScheme = scheme ?? 'light';
    const colors = Colors[resolvedScheme];
    return {
        iconColor: {
            default: colors.tabIconDefault,
            selected: TAB_SELECTED_IOS,
        },
        labelStyle: {
            default: { color: colors.tabIconDefault },
            selected: { color: TAB_SELECTED_IOS },
        },
        indicatorColor: TAB_SELECTED_IOS,
    };
}

export default function TabLayout() {
    const colorScheme = useColorScheme();
    const androidStyle = getAndroidTabBarStyle(colorScheme);
    const iosStyle = getIOSTabBarStyle(colorScheme);
    const androidIcons = useAndroidVectorIcons();
    const tabIcons = getTabIcons(androidIcons);

    return (
        <>
            <NativeTabs {...androidStyle} {...iosStyle}>
                <NativeTabs.Trigger name="index">
                    <Label>Mes trajets</Label>
                    <Icon {...tabIcons.bus} selectedColor={Platform.OS === 'ios' ? TAB_SELECTED_IOS : TAB_SELECTED_CONTENT} />
                </NativeTabs.Trigger>
                <NativeTabs.Trigger name="profile">
                    <Icon {...tabIcons.person} selectedColor={Platform.OS === 'ios' ? TAB_SELECTED_IOS : TAB_SELECTED_CONTENT} />
                    <Label>Mon compte</Label>
                </NativeTabs.Trigger>
            </NativeTabs>
        </>
    );
}
