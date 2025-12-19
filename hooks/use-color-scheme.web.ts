import { useThemeContext } from '@/contexts/ThemeContext';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 * Utilise la préférence de thème de l'utilisateur si disponible
 */
export function useColorScheme() {
  const { theme } = useThemeContext();
  return theme;
}
