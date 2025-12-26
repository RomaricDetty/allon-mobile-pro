import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ThemeProvider } from '@/contexts/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect } from 'react';

export const unstable_settings = {
    anchor: '(tabs)',
};
// Empêche le SplashScreen par défaut de se cacher automatiquement
SplashScreen.preventAutoHideAsync();

/**
 * Composant interne qui utilise le contexte de thème
 * Doit être rendu à l'intérieur du ThemeProvider
 */
function AppContent() {
    const colorScheme = useColorScheme();

    return (
        <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ animation: 'slide_from_right' }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="login/index" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="scan-qr/index" options={{ headerShown: false }} />
                <Stack.Screen name="scan-result/index" options={{ headerShown: false }} />
                <Stack.Screen name="departure-details/index" options={{ headerShown: false }} />
                <Stack.Screen name="track-route/index" options={{ headerShown: false }} />
                <Stack.Screen name="profile/index" options={{ headerShown: false }} />
                {/* <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} /> */}
            </Stack>
            <StatusBar
                style={colorScheme === 'dark' ? 'light' : 'dark'}
                backgroundColor={colorScheme === 'dark' ? '#121212' : '#ffffff'}
            />
        </NavigationThemeProvider>
    );
}

export default function RootLayout() {
    // Charge toutes les fonts Ubuntu nécessaires
    const [fontsLoaded, fontsError] = useFonts({
        Ubuntu_Bold: require("@/assets/fonts/Ubuntu-Bold.ttf"),
        Ubuntu_BoldItalic: require("@/assets/fonts/Ubuntu-BoldItalic.ttf"),
        Ubuntu_Italic: require("@/assets/fonts/Ubuntu-Italic.ttf"),
        Ubuntu_Light: require("@/assets/fonts/Ubuntu-Light.ttf"),
        Ubuntu_LightItalic: require("@/assets/fonts/Ubuntu-LightItalic.ttf"),
        Ubuntu_Medium: require("@/assets/fonts/Ubuntu-Medium.ttf"),
        Ubuntu_MediumItalic: require("@/assets/fonts/Ubuntu-MediumItalic.ttf"),
        Ubuntu_Regular: require("@/assets/fonts/Ubuntu-Regular.ttf"),
    });

    /**
     * Cache le splash screen une fois les fonts chargées
     */
    useEffect(() => {
        const hideSplash = async () => {
            if (!fontsLoaded && !fontsError) {
                return;
            }

            try {
                await SplashScreen.hideAsync();
            } catch (error) {
                console.warn('Splash déjà caché:', error);
            }
        };

        hideSplash();
    }, [fontsLoaded, fontsError]);

    if (!fontsLoaded && !fontsError) {
        return null;
    }

    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    );
}
