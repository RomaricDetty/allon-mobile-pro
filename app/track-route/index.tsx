import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Écran de suivi de trajet
 * Affiche la position du conducteur en temps réel
 */
export default function TrackRouteScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ departure: string }>();

    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    // Parse les données du départ depuis les paramètres
    let departure: any = null;
    try {
        if (params.departure) {
            departure = JSON.parse(params.departure);
        }
    } catch (error) {
        console.error('Erreur lors du parsing des données du départ:', error);
    }

    /**
     * Demande les permissions de localisation et démarre le suivi
     */
    const requestLocationPermission = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            
            if (status !== 'granted') {
                Alert.alert(
                    'Permission refusée',
                    'L\'accès à la localisation est nécessaire pour suivre le trajet.',
                    [
                        {
                            text: 'OK',
                            onPress: () => router.back(),
                        },
                    ]
                );
                setHasPermission(false);
                setIsLoading(false);
                return;
            }

            setHasPermission(true);
            
            // Démarre le suivi de position en temps réel
            const subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 1000, // Mise à jour toutes les secondes
                    distanceInterval: 5, // Mise à jour tous les 5 mètres
                },
                (newLocation) => {
                    setLocation(newLocation);
                    setIsLoading(false);
                }
            );

            setLocationSubscription(subscription);
        } catch (error) {
            console.error('Erreur lors de la demande de permission:', error);
            Alert.alert(
                'Erreur',
                'Une erreur est survenue lors de l\'accès à la localisation.',
                [{ text: 'OK', onPress: () => router.back() }]
            );
            setIsLoading(false);
        }
    };

    /**
     * Arrête le suivi de position
     */
    const stopTracking = () => {
        if (locationSubscription) {
            locationSubscription.remove();
            setLocationSubscription(null);
        }
    };

    /**
     * Gère le retour à l'écran précédent
     */
    const handleBack = () => {
        stopTracking();
        router.back();
    };

    /**
     * Initialise le suivi de position au chargement de l'écran
     */
    useEffect(() => {
        requestLocationPermission();

        // Nettoie l'abonnement lors du démontage du composant
        return () => {
            stopTracking();
        };
    }, []);

    // Couleurs pour le mode clair et sombre
    const headerBackgroundColor = isDark ? '#1A1A1A' : '#1776BA';
    const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
    const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
    const borderColor = isDark ? '#3A3A3C' : '#E0E0E0';

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F3F3F7' }]}>
            {/* Barre de navigation / En-tête */}
            <View
                style={[
                    styles.header,
                    {
                        backgroundColor: headerBackgroundColor,
                        paddingTop: insets.top + 8,
                        paddingBottom: 16,
                    },
                ]}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={[styles.headerButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
                        onPress={handleBack}
                    >
                        <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>

                    <ThemedText style={[styles.headerTitle, { color: '#FFFFFF' }]}>
                        Suivi du trajet
                    </ThemedText>

                    <View style={styles.headerButton} />
                </View>
            </View>

            {/* Contenu principal */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}
                showsVerticalScrollIndicator={false}
            >
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#1776BA" />
                        <ThemedText style={[styles.loadingText, { color: primaryTextColor }]}>
                            Chargement de la position...
                        </ThemedText>
                    </View>
                ) : hasPermission === false ? (
                    <View style={styles.loadingContainer}>
                        <MaterialIcons name="location-off" size={48} color="#FF3B30" />
                        <ThemedText style={[styles.loadingText, { color: primaryTextColor }]}>
                            Permission de localisation refusée
                        </ThemedText>
                    </View>
                ) : location ? (
                    <View style={[styles.contentCard, { backgroundColor: cardBackgroundColor, borderColor: borderColor }]}>
                        <View style={styles.locationHeader}>
                            <MaterialIcons name="my-location" size={32} color="#1776BA" />
                            <ThemedText style={[styles.locationTitle, { color: primaryTextColor }]}>
                                Position en temps réel
                            </ThemedText>
                        </View>
                        
                        <View style={styles.locationInfo}>
                            <View style={styles.infoRow}>
                                <ThemedText style={[styles.infoLabel, { color: primaryTextColor }]}>
                                    Latitude :
                                </ThemedText>
                                <ThemedText style={[styles.infoValue, { color: primaryTextColor }]}>
                                    {location.coords.latitude.toFixed(6)}
                                </ThemedText>
                            </View>
                            
                            <View style={styles.infoRow}>
                                <ThemedText style={[styles.infoLabel, { color: primaryTextColor }]}>
                                    Longitude :
                                </ThemedText>
                                <ThemedText style={[styles.infoValue, { color: primaryTextColor }]}>
                                    {location.coords.longitude.toFixed(6)}
                                </ThemedText>
                            </View>
                            
                            {location.coords.accuracy && (
                                <View style={styles.infoRow}>
                                    <ThemedText style={[styles.infoLabel, { color: primaryTextColor }]}>
                                        Précision :
                                    </ThemedText>
                                    <ThemedText style={[styles.infoValue, { color: primaryTextColor }]}>
                                        ±{Math.round(location.coords.accuracy)}m
                                    </ThemedText>
                                </View>
                            )}
                            
                            {location.coords.altitude && (
                                <View style={styles.infoRow}>
                                    <ThemedText style={[styles.infoLabel, { color: primaryTextColor }]}>
                                        Altitude :
                                    </ThemedText>
                                    <ThemedText style={[styles.infoValue, { color: primaryTextColor }]}>
                                        {Math.round(location.coords.altitude)}m
                                    </ThemedText>
                                </View>
                            )}
                            
                            {location.coords.speed !== null && location.coords.speed !== undefined && (
                                <View style={styles.infoRow}>
                                    <ThemedText style={[styles.infoLabel, { color: primaryTextColor }]}>
                                        Vitesse :
                                    </ThemedText>
                                    <ThemedText style={[styles.infoValue, { color: primaryTextColor }]}>
                                        {Math.round(location.coords.speed * 3.6)} km/h
                                    </ThemedText>
                                </View>
                            )}
                        </View>
                    </View>
                ) : null}
            </ScrollView>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 15,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
        flex: 1,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        minHeight: 400,
    },
    loadingText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
    },
    contentCard: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        marginTop: 16,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
    },
    locationTitle: {
        fontSize: 20,
        fontFamily: 'Ubuntu_Bold',
    },
    locationInfo: {
        gap: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    },
    infoLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
    },
    infoValue: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
});
