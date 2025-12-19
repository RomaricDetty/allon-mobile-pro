import { useThemeContext } from '@/contexts/ThemeContext';

/**
 * Hook pour obtenir le schéma de couleurs actuel
 * Utilise la préférence de thème de l'utilisateur si disponible
 * @returns 'light' | 'dark' | null
 */
export function useColorScheme() {
    const { theme } = useThemeContext();
    return theme;
}
