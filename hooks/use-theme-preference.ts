import { useThemeContext } from '@/contexts/ThemeContext';

export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Hook pour gérer la préférence de thème de l'utilisateur
 * Utilise le contexte de thème pour accéder aux préférences
 * @returns Un objet contenant le thème actuel, la préférence, et une fonction pour la changer
 */
export function useThemePreference() {
    return useThemeContext();
}
