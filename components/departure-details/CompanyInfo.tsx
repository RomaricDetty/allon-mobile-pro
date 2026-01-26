import { Departure } from '@/components/departure-card';
import { ThemedText } from '@/components/themed-text';
import { styles } from '@/styles/departureDetails';
import React from 'react';
import { View } from 'react-native';

interface CompanyInfoProps {
    departure: Departure;
    primaryTextColor: string;
}

/**
 * Composant affichant les informations de la compagnie et du véhicule
 * @param departure - Les données du départ
 * @param primaryTextColor - La couleur du texte principal
 */
export const CompanyInfo: React.FC<CompanyInfoProps> = ({ departure, primaryTextColor }) => {
    return (
        <View style={styles.topSection}>
            <View style={styles.companyInfo}>
                <View style={styles.companyTextContainer}>
                    <ThemedText style={[styles.companyName, { color: primaryTextColor }]}>
                        {departure.company || 'Compagnie'}
                    </ThemedText>
                    <ThemedText style={[styles.busType, { color: primaryTextColor }]}>
                        {departure.busType?.charAt(0).toUpperCase() + (departure.busType?.slice(1) || '') || departure.line?.charAt(0).toUpperCase() + (departure.line?.slice(1) || '') || 'Bus'}
                    </ThemedText>
                    <ThemedText style={[styles.busLicensePlate, { color: primaryTextColor }]}>
                        {departure.busLicensePlate}
                    </ThemedText>
                </View>
            </View>
        </View>
    );
};
