/**
 * Utilitaires pour la manipulation des dates
 */

/**
 * Calcule les dates de début et de fin selon le type de filtre
 */
export const getDateRange = (
    filterType: 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'custom',
    customDateFrom?: Date,
    customDateTo?: Date
): { dateFrom: Date | null; dateTo: Date | null } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (filterType) {
        case 'today':
            return {
                dateFrom: today,
                dateTo: today,
            };

        case 'thisWeek':
            const dayOfWeek = now.getDay();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - dayOfWeek);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            return {
                dateFrom: startOfWeek,
                dateTo: endOfWeek,
            };

        case 'thisMonth':
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return {
                dateFrom: startOfMonth,
                dateTo: endOfMonth,
            };

        case 'thisYear':
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const endOfYear = new Date(now.getFullYear(), 11, 31);
            return {
                dateFrom: startOfYear,
                dateTo: endOfYear,
            };

        case 'custom':
            if (customDateFrom && customDateTo) {
                const from = new Date(customDateFrom);
                from.setHours(0, 0, 0, 0);
                const to = new Date(customDateTo);
                to.setHours(23, 59, 59, 999);
                return {
                    dateFrom: from,
                    dateTo: to,
                };
            }
            return { dateFrom: null, dateTo: null };

        default:
            return { dateFrom: null, dateTo: null };
    }
};

/**
 * Formate une date pour l'API (format ISO)
 */
export const formatDateForApi = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

