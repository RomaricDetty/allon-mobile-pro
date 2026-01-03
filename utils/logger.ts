/**
 * Utilitaire de logging qui désactive les logs en production
 * Améliore les performances en évitant les logs inutiles
 */

const isDevelopment = __DEV__;

/**
 * Log un message uniquement en développement
 */
export const log = (...args: any[]) => {
    if (isDevelopment) {
        console.log(...args);
    }
};

/**
 * Log une erreur (toujours affichée, même en production)
 */
export const logError = (...args: any[]) => {
    console.error(...args);
};

/**
 * Log un avertissement uniquement en développement
 */
export const logWarn = (...args: any[]) => {
    if (isDevelopment) {
        console.warn(...args);
    }
};

/**
 * Log avec un tag pour faciliter le débogage
 */
export const logWithTag = (tag: string, ...args: any[]) => {
    if (isDevelopment) {
        console.log(`[${tag}]`, ...args);
    }
};

