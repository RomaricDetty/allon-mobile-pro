import { Departure } from '@/components/departure-card';
import { ThemedText } from '@/components/themed-text';
import { styles } from '@/styles/departureDetails';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

interface RouteVisualizationProps {
    departure: Departure;
    borderColor: string;
    cardBackgroundColor: string;
    primaryTextColor: string;
    secondaryTextColor: string;
}

/**
 * Composant visualisant l'itinéraire du trajet (départ, durée, arrivée)
 * @param departure - Les données du départ
 * @param borderColor - La couleur des bordures
 * @param cardBackgroundColor - La couleur de fond de la carte
 * @param primaryTextColor - La couleur du texte principal
 * @param secondaryTextColor - La couleur du texte secondaire
 */
export const RouteVisualization: React.FC<RouteVisualizationProps> = ({
    departure,
    borderColor,
    cardBackgroundColor,
    primaryTextColor,
    secondaryTextColor,
}) => {
    return (
        <View style={[styles.middleSection]}>
            <View style={styles.routeVisualization}>
                {/* Point de départ - en haut centré */}
                <View style={[
                    {
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 10,
                    }
                ]}>
                    <View style={[styles.routePointCircle, { backgroundColor: 'green', borderColor: borderColor }]}>
                        <MaterialIcons name="location-on" size={16} color="#FFFFFF" />
                    </View>
                    <View style={[styles.routePointContentCenter, { alignItems: 'flex-start' }]}>
                        <ThemedText style={[styles.cityNameCenter, { color: primaryTextColor }]}>
                            {departure.departureCity?.toUpperCase() || 'Ville'}
                        </ThemedText>
                        {departure.departureStationName && (
                            <ThemedText style={[styles.stationDetailsCenter, { color: secondaryTextColor }]}>
                                {departure.departureStationName}
                            </ThemedText>
                        )}
                        <ThemedText style={[styles.timeCenter, { color: primaryTextColor }]}>
                            {departure.departureTime || '--:--'}
                        </ThemedText>
                    </View>
                </View>

                {/* Point central - Bus et durée - au milieu */}
                <View style={styles.routePointCenter}>
                    <View style={[styles.busIconContainer, { borderColor: borderColor, backgroundColor: cardBackgroundColor }]}>
                        <MaterialIcons name="arrow-downward" size={28} color={'#1776BA'} />
                    </View>
                    <View style={styles.routePointContent}>
                        <ThemedText style={[styles.duration, { color: secondaryTextColor }]}>
                            {departure.duration || '--'}
                        </ThemedText>
                    </View>
                </View>

                {/* Point d'arrivée - en bas centré */}
                <View style={styles.routePointArrival}>
                    <View style={[styles.routePointCircle, { backgroundColor: '#b81414', borderColor: borderColor }]}>
                        <MaterialIcons name="location-on" size={16} color="#FFFFFF" />
                    </View>
                    <View style={[styles.routePointContentCenter, { alignItems: 'flex-start' }]}>
                        <ThemedText style={[styles.cityNameCenter, { color: primaryTextColor }]}>
                            {departure.arrivalCity?.toUpperCase() || 'Ville'}
                        </ThemedText>
                        {departure.arrivalStationName && (
                            <ThemedText style={[styles.stationDetailsCenter, { color: secondaryTextColor }]}>
                                {departure.arrivalStationName}
                            </ThemedText>
                        )}
                        <ThemedText style={[styles.timeCenter, { color: primaryTextColor }]}>
                            {departure.arrivalTime || '--:--'}
                        </ThemedText>
                    </View>
                </View>
            </View>
        </View>
    );
};
