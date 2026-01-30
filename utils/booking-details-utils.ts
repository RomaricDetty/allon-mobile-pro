/**
 * Utilitaires pour l'écran de détails de réservation : libellés, formats, couleurs.
 */

const STATUS_MAPPING: Record<string, string> = {
    PAID: 'Payé',
    PENDING: 'En attente',
    CANCELLED: 'Annulé',
    REFUNDED: 'Remboursé',
    PARTIAL: 'Partiel',
    ARRIVED: 'Arrivé',
    DEPARTED: 'Parti',
    SCHEDULED: 'Programmé',
    VALIDATED: 'Validé',
    USED: 'Utilisé',
    EXPIRED: 'Expiré',
};

const TRIP_TYPE_MAPPING: Record<string, string> = {
    ONE_WAY: 'Aller simple',
    ROUND_TRIP: 'Aller-retour',
    MULTI_CITY: 'Multi-ville',
};

const CHANNEL_MAPPING: Record<string, string> = {
    WEB_APP: 'Application Web',
    MOBILE_APP: 'Application Mobile',
    AGENCY: 'Agence',
    PHONE: 'Téléphone',
};

const PAYMENT_METHOD_MAPPING: Record<string, string> = {
    MOBILE_MONEY: 'Mobile Money',
    CARD: 'Carte bancaire',
    CASH: 'Espèces',
    BANK_TRANSFER: 'Virement bancaire',
};

const STATUS_COLOR_MAPPING: Record<string, { light: string; dark: string }> = {
    PAID: { light: '#34C759', dark: '#30D158' },
    PENDING: { light: '#FF9500', dark: '#FF9F0A' },
    CANCELLED: { light: '#FF3B30', dark: '#FF453A' },
    REFUNDED: { light: '#5856D6', dark: '#5E5CE6' },
    PARTIAL: { light: '#FF9500', dark: '#FF9F0A' },
    ARRIVED: { light: '#34C759', dark: '#30D158' },
    DEPARTED: { light: '#1776BA', dark: '#1776BA' },
    SCHEDULED: { light: '#1776BA', dark: '#1776BA' },
    VALIDATED: { light: '#34C759', dark: '#30D158' },
    USED: { light: '#34C759', dark: '#30D158' },
    EXPIRED: { light: '#FF3B30', dark: '#FF453A' },
};

const PASSENGER_TYPE_MAPPING: Record<string, string> = {
    adult: 'Adulte',
    child: 'Enfant',
    senior: 'Senior',
    student: 'Étudiant',
    infant: 'Bébé',
};

const LEG_MAPPING: Record<string, string> = {
    OUTBOUND: 'Aller',
    INBOUND: 'Retour',
};

/** Libellé français d'un statut */
export const getStatusLabel = (status?: string): string =>
    status ? (STATUS_MAPPING[status.toUpperCase()] ?? status) : '--';

/** Libellé français d'un type de trajet */
export const getTripTypeLabel = (tripType?: string): string =>
    tripType ? (TRIP_TYPE_MAPPING[tripType.toUpperCase()] ?? tripType) : '--';

/** Montant formaté avec devise */
export const formatAmount = (amount?: string, currency?: string): string => {
    if (!amount) return '--';
    const num = parseFloat(amount);
    if (Number.isNaN(num)) return amount;
    return `${num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || 'XOF'}`;
};

/** Libellé français d'un canal */
export const getChannelLabel = (channel?: string): string =>
    channel ? (CHANNEL_MAPPING[channel.toUpperCase()] ?? channel) : '--';

/** Libellé français d'une méthode de paiement */
export const getPaymentMethodLabel = (method?: string): string =>
    method ? (PAYMENT_METHOD_MAPPING[method.toUpperCase()] ?? method.replaceAll('_', ' ').toUpperCase()) : '--';

/** Téléphone formaté (objet ou string) */
export const formatPhoneNumber = (phone: unknown): string => {
    if (!phone) return '--';
    if (typeof phone === 'object' && phone !== null && 'value' in phone && (phone as { value?: string }).value)
        return (phone as { value: string }).value;
    if (typeof phone === 'string') return phone;
    if (typeof phone === 'object' && phone !== null) {
        const o = phone as Record<string, unknown>;
        return String(o.digits ?? o.phone ?? '--');
    }
    return String(phone);
};

/** Couleur associée à un statut (thème clair/sombre) */
export const getStatusColor = (status?: string, isDark = false): string => {
    if (!status) return isDark ? '#98989D' : '#8E8E93';
    const mapping = STATUS_COLOR_MAPPING[status.toUpperCase()];
    return mapping ? (isDark ? mapping.dark : mapping.light) : isDark ? '#98989D' : '#8E8E93';
};

/** Date ISO → format date fr */
export const formatDate = (dateString?: string): string => {
    if (!dateString) return '--';
    try {
        return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
        return dateString;
    }
};

/** Date ISO → heure fr */
export const formatTime = (dateString?: string): string => {
    if (!dateString) return '--:--';
    try {
        return new Date(dateString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '--:--';
    }
};

/** Date ISO → date et heure fr */
export const formatDateTime = (dateString?: string): string => {
    if (!dateString) return '--';
    try {
        return new Date(dateString).toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateString;
    }
};

/** Libellé français du type de passager */
export const getPassengerTypeLabel = (passengerType?: string): string =>
    passengerType ? (PASSENGER_TYPE_MAPPING[passengerType.toLowerCase()] ?? passengerType) : '--';

/** Libellé français d'un leg (aller/retour) */
export const getLegLabel = (leg?: string): string =>
    leg ? (LEG_MAPPING[leg.toUpperCase()] ?? leg) : '--';
