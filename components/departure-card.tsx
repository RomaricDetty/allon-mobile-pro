import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

/**
 * Interface pour les données d'un départ
 */
export interface Departure {
    id: string;
    company?: string;
    busType?: string;
    busLicensePlate?: string;
    classStatus?: string;
    departureStationCode?: string;
    departureStationName?: string;
    departureCity?: string;
    departureCityCountry?: string;
    departureTime?: string;
    arrivalStationCode?: string;
    arrivalStationName?: string;
    arrivalCity?: string;
    arrivalCityCountry?: string;
    arrivalTime?: string;
    date?: string;
    duration?: string;
    price?: string;
    // Propriétés optionnelles pour compatibilité
    line?: string;
    destination?: string;
    departureDate?: string;
    seatsAvailable?: number;
    seatsBooked?: number;
    status?: string;
}

/**
 * Props du composant DepartureCard
 */
interface DepartureCardProps {
    departure: Departure;
    onTicketPress?: () => void;
    onMapPress?: () => void;
}

/**
 * Génère une couleur pour le cercle de la compagnie basée sur le nom
 */
const getCompanyColor = (companyName?: string): string => {
    if (!companyName) return '#8B4513';
    const colors = ['#8B4513', '#1776BA', '#2E7D32', '#C62828', '#6A1B9A', '#F57C00'];
    const index = companyName.length % colors.length;
    return colors[index];
};

/**
 * Tableau de correspondance des statuts techniques vers des libellés français
 */
const STATUS_MAPPING: Record<string, string> = {
    'SCHEDULED': 'Programmé',
    'ON_TIME': 'À l\'heure',
    'DELAYED': 'Retardé',
    'CANCELLED': 'Annulé',
    'BOARDING': 'En embarquement',
    'DEPARTED': 'Parti',
    'ARRIVED': 'Arrivé',
    'IN_TRANSIT': 'En transit',
    'COMPLETED': 'Terminé',
    'PENDING': 'En attente',
    'CONFIRMED': 'Confirmé',
    'AVAILABLE': 'Disponible',
    'FULL': 'Complet',
    'CLOSED': 'Fermé',
};

/**
 * Tableau de correspondance des statuts techniques vers des couleurs
 */
const STATUS_COLOR_MAPPING: Record<string, { light: string; dark: string }> = {
    'SCHEDULED': { light: '#1776BA', dark: '#1776BA' }, // Bleu
    'ON_TIME': { light: '#34C759', dark: '#30D158' }, // Vert
    'DELAYED': { light: '#FF9500', dark: '#FF9F0A' }, // Orange
    'CANCELLED': { light: '#FF3B30', dark: '#FF453A' }, // Rouge
    'BOARDING': { light: '#5856D6', dark: '#5E5CE6' }, // Violet
    'DEPARTED': { light: '#1776BA', dark: '#1776BA' }, // Bleu
    'ARRIVED': { light: '#34C759', dark: '#30D158' }, // Vert
    'IN_TRANSIT': { light: '#FF9500', dark: '#FF9F0A' }, // Orange
    'COMPLETED': { light: '#34C759', dark: '#30D158' }, // Vert
    'PENDING': { light: '#FF9500', dark: '#FF9F0A' }, // Orange
    'CONFIRMED': { light: '#34C759', dark: '#30D158' }, // Vert
    'AVAILABLE': { light: '#34C759', dark: '#30D158' }, // Vert
    'FULL': { light: '#FF3B30', dark: '#FF453A' }, // Rouge
    'CLOSED': { light: '#8E8E93', dark: '#98989D' }, // Gris
};

/**
 * Convertit un statut technique en libellé français lisible
 * @param status - Le statut technique (ex: "SCHEDULED")
 * @returns Le libellé français correspondant ou le statut original si non trouvé
 */
const getStatusLabel = (status?: string): string => {
    if (!status) return '--';

    // Vérifie si le statut contient déjà un libellé formaté (ex: "Retard: 15min")
    if (status.includes('Retard:')) {
        return status;
    }

    // Convertit en majuscules pour la recherche insensible à la casse
    const upperStatus = status.toUpperCase();

    // Retourne le libellé correspondant ou le statut original
    return STATUS_MAPPING[upperStatus] || status;
};

/**
 * Récupère la couleur associée à un statut selon le thème
 * @param status - Le statut technique (ex: "SCHEDULED")
 * @param isDark - Indique si le thème est sombre
 * @returns La couleur correspondante ou une couleur par défaut
 */
const getStatusColor = (status?: string, isDark: boolean = false): string => {
    if (!status) return isDark ? '#98989D' : '#8E8E93';

    // Pour les statuts avec formatage spécial (ex: "Retard: 15min")
    if (status.includes('Retard:')) {
        return isDark ? '#FF9F0A' : '#FF9500';
    }

    // Convertit en majuscules pour la recherche insensible à la casse
    const upperStatus = status.toUpperCase();
    const colorMapping = STATUS_COLOR_MAPPING[upperStatus];

    // Retourne la couleur correspondante ou une couleur par défaut
    return colorMapping
        ? (isDark ? colorMapping.dark : colorMapping.light)
        : (isDark ? '#98989D' : '#8E8E93');
};

/**
 * Composant de carte de départ selon le nouveau design
 * Affiche les informations d'un départ avec sections supérieure, médiane et inférieure
 */
export function DepartureCard({ departure, onTicketPress, onMapPress }: DepartureCardProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    // Couleurs pour le mode clair et sombre
    const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
    const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
    const secondaryTextColor = isDark ? '#9BA1A6' : '#666666';
    const busIconColor = '#1776BA';
    const iconColor = isDark ? '#9BA1A6' : '#999999';
    // const borderColor = isDark ? '#333333' : '#E5E5E5';
    const borderColor = colorScheme === 'dark' ? '#3A3A3C' : '#E0E0E0';
    const dottedLineColor = isDark ? '#666666' : '#CCCCCC';
    const shadowColor = isDark ? '#000000' : '#000000';

    console.log('departure', departure);

    const companyColor = getCompanyColor(departure.company);

    /**
     * Gère la navigation vers l'écran de détails
     */
    const handlePress = () => {
        router.push({
            pathname: '/departure-details',
            params: {
                departure: JSON.stringify(departure),
            },
        });
    };

    return (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
            <ThemedView
                style={[
                    styles.card,
                    {
                        backgroundColor: cardBackgroundColor,
                        borderColor: borderColor,
                    }
                ]}
            >
                {/* Section supérieure : Compagnie et type de bus */}
                <View style={styles.topSection}>
                    <View style={[styles.companyInfo]}>
                        <View style={[styles.companyLogoCircle, { borderColor: borderColor, borderWidth: 1, borderRadius: 100 }]}>
                            <MaterialIcons name="directions-bus-filled" size={24} color={busIconColor} />
                        </View>
                        <View style={styles.companyTextContainer}>
                            <ThemedText style={[styles.companyName, { color: primaryTextColor }]}>
                                {departure.company || 'Compagnie'}
                            </ThemedText>
                        </View>
                    </View>
                    <View style={[{ flexDirection: 'column', alignItems: 'flex-end', gap: 2 }]}>
                        {departure.busType && (
                            <ThemedText style={[styles.classStatus, { color: secondaryTextColor }]}>
                                {departure.busType?.charAt(0).toUpperCase() + (departure.busType?.slice(1) || '') || departure.line?.charAt(0).toUpperCase() + (departure.line?.slice(1) || '') || 'Bus'}
                            </ThemedText>
                        )}

                        {departure.busLicensePlate && (
                            <ThemedText style={[styles.classStatus, { color: secondaryTextColor }]}>
                                {departure.busLicensePlate}
                            </ThemedText>
                        )}
                    </View>
                </View>

                {/* Section médiane : Trajet avec icône de bus */}
                <View style={[styles.middleSection]}>
                    {/* Départ */}
                    <View style={[styles.stationContainer, {}]}>
                        <ThemedText style={[styles.label, { color: secondaryTextColor, alignSelf: 'flex-start' }]}>
                            DÉPART
                        </ThemedText>
                        <ThemedText style={[styles.stationCode, { color: primaryTextColor }]}>
                            {departure.departureCity?.slice(0, 3).toUpperCase()}
                        </ThemedText>
                        <ThemedText style={[styles.stationName, { color: primaryTextColor }]}>
                            {
                                departure.departureStationName?.length && departure.departureStationName?.length > 10 ? departure.departureStationName?.slice(0, 10) + '...' : departure.departureStationName || 'Gare'
                            }
                        </ThemedText>
                        {departure.departureCity && (
                            <ThemedText style={[styles.city, { color: primaryTextColor }]}>
                                {departure.departureCity}
                            </ThemedText>
                        )}
                        <ThemedText style={[styles.time, { color: primaryTextColor }]}>
                            {departure.departureTime || '--:--'}
                        </ThemedText>
                    </View>

                    {/* Icône de bus au centre */}
                    <View style={[styles.busIconContainer, { borderWidth: 1, borderColor: borderColor, padding: 8, borderRadius: 100 }]}>
                        <MaterialIcons name="arrow-forward" size={28} color={busIconColor} />
                    </View>

                    {/* Arrivée */}
                    <View style={[styles.stationContainer, styles.arrivalContainer, {}]}>
                        <ThemedText style={[styles.label, styles.textRight, { color: secondaryTextColor, alignSelf: 'flex-end' }]}>
                            ARRIVÉE
                        </ThemedText>
                        <ThemedText style={[styles.stationCode, styles.textRight, { color: primaryTextColor }]}>
                            {departure.arrivalCity?.slice(0, 3).toUpperCase()}
                            {/* {departure.arrivalStationName?.slice(0, 10).toUpperCase()} */}
                        </ThemedText>
                        <ThemedText style={[styles.stationName, styles.textRight, { color: primaryTextColor }]}>
                            {
                                departure.arrivalStationName?.length && departure.arrivalStationName?.length > 10 ? departure.arrivalStationName?.slice(0, 10) + '...' : departure.arrivalStationName || 'Gare'
                            }
                        </ThemedText>
                        {departure.arrivalCity && (
                            <ThemedText style={[styles.city, styles.textRight, { color: primaryTextColor }]}>
                                {departure.arrivalCity}
                            </ThemedText>
                        )}
                        <ThemedText style={[styles.time, styles.textRight, { color: primaryTextColor }]}>
                            {departure.arrivalTime || '--:--'}
                        </ThemedText>
                    </View>
                </View>

                {/* Section inférieure : Date, Durée et Prix */}
                <View style={[styles.bottomSection, { borderTopColor: borderColor }]}>
                    <View style={styles.infoItem}>
                        <MaterialIcons name="calendar-month" size={16} color={iconColor} />
                        <ThemedText style={[styles.infoText, { color: primaryTextColor }]}>
                            {departure.date || departure.departureDate || '--'}
                        </ThemedText>
                    </View>
                    <View style={styles.infoItem}>
                        <MaterialIcons name="timer" size={16} color={iconColor} />
                        <ThemedText style={[styles.infoText, { color: primaryTextColor }]}>
                            {departure.duration || '--'}
                        </ThemedText>
                    </View>
                    <ThemedText style={[styles.price, { color: getStatusColor(departure.status, isDark) }]}>
                        {getStatusLabel(departure.status)}
                    </ThemedText>
                </View>
            </ThemedView>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 20,
        marginBottom: 16,
        padding: 18,
        borderWidth: 1,
        // borderColor: '#E5E5E5',
    },
    // Section supérieure
    topSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    companyInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    companyLogoCircle: {
        width: 38,
        height: 38,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    companyLogoText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontFamily: 'Ubuntu_Medium',
    },
    companyTextContainer: {
        flex: 1,
    },
    companyName: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 4,
    },
    busType: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    classStatus: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
    },
    // Section médiane
    middleSection: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    stationContainer: {
        flex: 1,
    },
    arrivalContainer: {
        alignItems: 'flex-end',
    },
    label: {
        fontSize: 11,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    stationCode: {
        fontSize: 24,
        fontFamily: 'Ubuntu_Bold',
        lineHeight: 38,
        marginBottom: 4,
        paddingTop: 2,
    },
    stationName: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
    },
    city: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 8,
    },
    time: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    textRight: {
        textAlign: 'right',
    },
    busIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        // paddingHorizontal: 12,
        alignSelf: 'center',
    },
    dottedLineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        width: 20,
        height: 1,
    },
    dottedLineDot: {
        width: 3,
        height: 1,
        borderRadius: 0.5,
    },
    // Section inférieure
    bottomSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16,
        borderTopWidth: 1,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    price: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
    },
});
