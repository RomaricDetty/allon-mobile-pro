import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import React from 'react';
import { Platform } from 'react-native';

/** Couleurs fixes de l'onglet sélectionné (light et dark) */
const TAB_SELECTED_BG = 'rgba(23, 118, 186, 1)';
const TAB_SELECTED_CONTENT = '#FFFFFF';

/** Ombre de la barre d'onglets (Android uniquement) */
const TAB_BAR_SHADOW_COLOR = 'rgba(0, 0, 0, 0.5)';
const TAB_BAR_ELEVATION = 8;

/** Icônes des onglets : images (require) sur Android, SF Symbols sur iOS */
const tabIcons = {
    bus: Platform.OS === 'android'
        ? { src: require('@/assets/images/bus-tabs.png') }
        : { sf: 'bus.fill' as const },
    person: Platform.OS === 'android'
        ? { src: require('@/assets/images/user.png') }
        : { sf: 'person.fill' as const },
};

/** Retourne les props de style de la barre d’onglets pour Android (couleurs thème) */
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

export default function TabLayout() {
    const colorScheme = useColorScheme();
    const androidStyle = getAndroidTabBarStyle(colorScheme);

    return (
        <>
            <NativeTabs {...androidStyle}>
                <NativeTabs.Trigger name="index">
                    <Label>Mes trajets</Label>
                    <Icon {...tabIcons.bus} />
                </NativeTabs.Trigger>
                <NativeTabs.Trigger name="profile">
                    <Icon {...tabIcons.person} />
                    <Label>Mon compte</Label>
                </NativeTabs.Trigger>
            </NativeTabs>
        </>
    );
}
