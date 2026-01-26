/**
 * Convertit un statut de bagage en libellé français
 */
export const getLuggageStatusLabel = (status?: string): string => {
    if (!status) return '--';
    const STATUS_MAPPING: Record<string, string> = {
        'REGISTERED': 'Enregistré', 'CHECKED_IN': 'Vérifié', 'LOADED': 'Chargé',
        'UNLOADED': 'Déchargé', 'DELIVERED': 'Livré', 'CANCELLED': 'Annulé', 'LOST': 'Perdu',
    };
    return STATUS_MAPPING[status.toUpperCase()] || status;
};

/**
 * Récupère la couleur associée à un statut de bagage
 */
export const getLuggageStatusColor = (status?: string, isDark: boolean = false): string => {
    if (!status) return isDark ? '#98989D' : '#8E8E93';
    const STATUS_COLOR_MAPPING: Record<string, { light: string; dark: string }> = {
        'REGISTERED': { light: '#1776BA', dark: '#1776BA' },
        'CHECKED_IN': { light: '#34C759', dark: '#30D158' },
        'LOADED': { light: '#5856D6', dark: '#5E5CE6' },
        'UNLOADED': { light: '#FF9500', dark: '#FF9F0A' },
        'DELIVERED': { light: '#34C759', dark: '#30D158' },
        'CANCELLED': { light: '#FF3B30', dark: '#FF453A' },
        'LOST': { light: '#FF3B30', dark: '#FF453A' },
    };
    const colorMapping = STATUS_COLOR_MAPPING[status.toUpperCase()];
    return colorMapping ? (isDark ? colorMapping.dark : colorMapping.light) : (isDark ? '#98989D' : '#8E8E93');
};

/**
 * Récupère l'icône associée à un statut
 */
export const getStatusIcon = (status?: string): string => {
    const statusUpper = status?.toUpperCase();
    const iconMap: Record<string, string> = {
        'REGISTERED': 'check-circle', 'CHECKED_IN': 'check-circle-outline', 'LOADED': 'inventory',
        'UNLOADED': 'unarchive', 'DELIVERED': 'done-all', 'CANCELLED': 'cancel', 'LOST': 'error',
    };
    return iconMap[statusUpper || ''] || 'info';
};

/**
 * Détermine si un statut indique que le bagage a été vérifié (check-in effectué)
 */
export const isCheckedInStatus = (status?: string): boolean => {
    if (!status) return false;
    return ['CHECKED_IN', 'LOADED', 'UNLOADED', 'DELIVERED'].includes(status.toUpperCase());
};

/**
 * Détermine si un statut indique que les frais sont payés
 */
export const isPaidStatus = (status?: string): boolean => {
    if (!status) return false;
    return ['LOADED', 'UNLOADED', 'DELIVERED'].includes(status.toUpperCase());
};

/**
 * Détermine si le check-in est possible pour un bagage
 */
export const canCheckIn = (status?: string): boolean => {
    if (!status) return true;
    return !['LOST', 'CANCELLED'].includes(status.toUpperCase());
};

/**
 * Formate un montant avec la devise
 */
export const formatAmount = (amount?: number, currency?: string): string => {
    if (!amount) return '--';
    return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || 'XOF'}`;
};
