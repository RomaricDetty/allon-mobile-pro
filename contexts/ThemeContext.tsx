import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: 'light' | 'dark';
    themePreference: ThemePreference;
    setThemePreference: (preference: ThemePreference) => Promise<void>;
    isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_PREFERENCE_KEY = 'theme_preference';

/**
 * Provider pour le contexte de thème
 * Gère la préférence de thème et force les re-renders quand elle change
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemColorScheme = useRNColorScheme();
    const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
    const [isLoading, setIsLoading] = useState(true);

    /**
     * Charge la préférence de thème depuis AsyncStorage
     */
    useEffect(() => {
        const loadThemePreference = async () => {
            try {
                const savedPreference = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
                if (savedPreference && (savedPreference === 'light' || savedPreference === 'dark' || savedPreference === 'system')) {
                    setThemePreferenceState(savedPreference as ThemePreference);
                }
            } catch (error) {
                console.error('Erreur lors du chargement de la préférence de thème:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadThemePreference();
    }, []);

    /**
     * Change la préférence de thème et la sauvegarde
     * @param preference - La nouvelle préférence de thème
     */
    const setThemePreference = async (preference: ThemePreference) => {
        try {
            await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
            setThemePreferenceState(preference);
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de la préférence de thème:', error);
        }
    };

    /**
     * Calcule le thème effectif basé sur la préférence
     */
    const effectiveTheme = themePreference === 'system' 
        ? (systemColorScheme ?? 'light')
        : themePreference;

    const value: ThemeContextType = {
        theme: effectiveTheme as 'light' | 'dark',
        themePreference,
        setThemePreference,
        isLoading,
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook pour utiliser le contexte de thème
 * @returns Le contexte de thème
 */
export function useThemeContext() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useThemeContext doit être utilisé dans un ThemeProvider');
    }
    return context;
}
