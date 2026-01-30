import { Departure } from '@/components/departure-card';
import { ThemedText } from '@/components/themed-text';
import { styles } from '@/styles/departureDetails';
import { getStatusColor, getStatusLabel } from '@/utils/departure-utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

interface DepartureDetailsSectionProps {
    departure: Departure;
    separatorColor: string;
    labelTextColor: string;
    primaryTextColor: string;
    buttonBackgroundColor: string;
    isDark: boolean;
    onShowListReservations: (departure: Departure) => void;
}

/**
 * Composant affichant la section des détails du départ
 * @param departure - Les données du départ
 * @param separatorColor - La couleur des séparateurs
 * @param labelTextColor - La couleur des labels
 * @param primaryTextColor - La couleur du texte principal
 * @param buttonBackgroundColor - La couleur de fond des boutons
 * @param isDark - Indique si le thème est sombre
 * @param onShowListReservations - Fonction appelée pour afficher la liste des réservations
 */
export const DepartureDetailsSection: React.FC<DepartureDetailsSectionProps> = ({
    departure,
    separatorColor,
    labelTextColor,
    primaryTextColor,
    buttonBackgroundColor,
    isDark,
    onShowListReservations,
}) => {

    const [userRole, setUserRole] = useState<string | undefined>(undefined);

    useEffect(() => {
        const loadRole = async () => {
            const role = await AsyncStorage.getItem('user_role');
            setUserRole(role?.toUpperCase());
        };
        loadRole();
    }, []);

    const showBaggageButton = userRole?.toUpperCase() === 'PORTER';

    return (
        <View style={[styles.bottomSection, { borderTopColor: separatorColor }]}>
            {/* Date */}
            <View style={styles.detailRow}>
                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                    Date
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                    {departure.date || departure.departureDate || '--'}
                </ThemedText>
            </View>

            <View style={[styles.separator, { backgroundColor: separatorColor }]} />

            {/* Classe et Terminal */}
            <View style={styles.detailRowTwoColumns}>
                <View style={styles.detailColumn}>
                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                        Classe
                    </ThemedText>
                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                        {departure.busType?.split(' ')[0]?.toUpperCase() || departure.line?.split(' ')[0]?.toUpperCase() || 'BUS'}
                    </ThemedText>
                </View>
                <View style={[styles.detailColumn, { alignItems: 'flex-end' }]}>
                    <ThemedText style={[styles.detailLabel, { color: labelTextColor, textAlign: 'center' }]}>
                        Vehicule
                    </ThemedText>
                    <ThemedText style={[styles.detailValue, { color: primaryTextColor, textAlign: 'center' }]}>
                        {departure.busType?.split(' ')[1]?.toUpperCase() || departure.line?.split(' ')[1]?.toUpperCase() || 'BUS'}
                    </ThemedText>
                    <ThemedText style={[styles.detailValue, { color: primaryTextColor, textAlign: 'center' }]}>
                        {departure.busLicensePlate || 'N/A'}
                    </ThemedText>
                </View>
            </View>

            <View style={[styles.separator, { backgroundColor: separatorColor }]} />

            {/* Siège et Statut */}
            <View style={styles.detailRowTwoColumns}>
                <View style={styles.detailColumn}>
                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                        Siège
                    </ThemedText>
                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                        {departure.seatsAvailable !== undefined ? `${departure.seatsAvailable} disponibles` : 'N/A'}
                    </ThemedText>
                </View>
                <View style={[styles.detailColumn, { alignItems: 'flex-end' }]}>
                    <ThemedText style={[styles.detailLabel, { color: labelTextColor, textAlign: 'center' }]}>
                        Statut
                    </ThemedText>
                    <ThemedText style={[styles.detailValue, { color: getStatusColor(departure.status, isDark) }]}>
                        {getStatusLabel(departure.status) || 'N/A'}
                    </ThemedText>
                </View>
            </View>

            {/* Prix si disponible */}
            {departure.price && (
                <>
                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                    <View style={styles.detailRow}>
                        <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                            Prix
                        </ThemedText>
                        <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                            {departure.price}
                        </ThemedText>
                    </View>
                </>
            )}

            {/* Sièges */}
            {departure.seatsBooked !== undefined && (
                <>
                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                    <View style={styles.detailRow}>
                        <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                            Sièges réservés
                        </ThemedText>
                        <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                            {departure.seatsBooked}
                        </ThemedText>
                    </View>
                </>
            )}

            <View style={[styles.separator, { backgroundColor: separatorColor }]} />

            {/* Scanner un QR code de bagage */}
            {showBaggageButton && (
                <>
                    <View style={styles.detailRow}>
                        <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                            Scanner un QR code de bagage
                        </ThemedText>
                        <Pressable
                            style={{
                                backgroundColor: departure.seatsBooked === 0 ? (isDark ? '#3A3A3C' : '#CCCCCC') : buttonBackgroundColor,
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 15,
                                opacity: departure.seatsBooked === 0 ? 0.5 : 1
                            }}
                            onPress={() => router.push({
                                pathname: '/scan-bagage',
                                params: {
                                    departure: JSON.stringify(departure),
                                },
                            })}
                        >
                            <ThemedText style={[styles.detailValue, { color: "#FFFFFF", fontSize: 13 }]}>
                                Scanner QR
                            </ThemedText>
                        </Pressable>
                    </View>
                </>
            )}

            {/* Gare de départ */}
            {departure.departureStationName && (
                <>
                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                    <View style={styles.detailRow}>
                        <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                            Gare de départ
                        </ThemedText>
                        <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                            {departure.departureStationName}
                        </ThemedText>
                    </View>
                </>
            )}

            {/* Gare d'arrivée */}
            {departure.arrivalStationName && (
                <>
                    <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                    <View style={styles.detailRow}>
                        <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                            Gare d'arrivée
                        </ThemedText>
                        <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                            {departure.arrivalStationName}
                        </ThemedText>
                    </View>
                </>
            )}

            {/* Voir la liste des réservations */}
            <>
                <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                <View style={styles.detailRow}>
                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                        La liste des réservations
                    </ThemedText>
                    <Pressable
                        disabled={departure.seatsBooked === 0}
                        style={{
                            backgroundColor: departure.seatsBooked === 0 ? (isDark ? '#3A3A3C' : '#CCCCCC') : buttonBackgroundColor,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 15,
                            opacity: departure.seatsBooked === 0 ? 0.5 : 1
                        }}
                        onPress={() => onShowListReservations(departure)}
                    >
                        <ThemedText style={[styles.detailValue, { color: departure.seatsBooked === 0 ? (isDark ? '#666666' : '#999999') : "#FFFFFF", fontSize: 13 }]}>
                            Voir la liste
                        </ThemedText>
                    </Pressable>
                </View>
            </>

        </View>
    );
};
