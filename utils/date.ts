/**
 * Utilitaires pour la manipulation des dates
 */

/**
 * Calcule les dates de début et de fin selon le type de filtre
 * Les dates sont configurées avec :
 * - dateFrom à 00:00:00.000
 * - dateTo à 23:59:59.999
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
            const todayFrom = new Date(today);
            todayFrom.setHours(0, 0, 0, 0);
            const todayTo = new Date(today);
            todayTo.setHours(23, 59, 59, 999);
            return {
                dateFrom: todayFrom,
                dateTo: todayTo,
            };

        case 'thisWeek':
            const dayOfWeek = now.getDay();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - dayOfWeek);
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            return {
                dateFrom: startOfWeek,
                dateTo: endOfWeek,
            };

        case 'thisMonth':
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            startOfMonth.setHours(0, 0, 0, 0);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999);
            return {
                dateFrom: startOfMonth,
                dateTo: endOfMonth,
            };

        case 'thisYear':
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            startOfYear.setHours(0, 0, 0, 0);
            const endOfYear = new Date(now.getFullYear(), 11, 31);
            endOfYear.setHours(23, 59, 59, 999);
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
 * Formate une date pour l'API au format ISO avec heure UTC
 * Exemple: 2026-01-23T00:00:00Z ou 2026-01-23T23:59:59Z
 */
export const formatDateForApi = (date: Date): string => {
    return date.toISOString();
};

