import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import UserMarker from '@/components/map/user-marker';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Dimensions } from 'react-native';
const { width, height } = Dimensions.get('window');
const SIZES = { width, height };
const ASPECT_RATIO = SIZES.width / SIZES.height;
let LATITUDE_DELTA = 0.0922;
let LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

/**
 * Écran de suivi de trajet
 * Affiche la position du conducteur en temps réel
 */
export default function TrackRouteScreen() {
    const mapView = useRef(null as MapView | null);
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ departure: string }>();

    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const iconCircleBackgroundColor = colorScheme === 'dark' ? '#2C2C2E' : '#F8F8F8';

    const [currentUserLocation, setCurrentUserLocation] = useState<{
        latitude: number; longitude: number; latitudeDelta?: number | undefined; longitudeDelta?: number | undefined;
    }>(
        {
            latitude: 5.320357, longitude: -4.016107,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA
        }
    );
    const [destination, setDestination] = useState(null);

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

    useEffect(() => {
        let isMounted = true;

        (async () => {
            // Check permissions
            let { status } = await Location.requestForegroundPermissionsAsync();

            if (status === 'granted' && isMounted) {
                const locationWatcher = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        timeInterval: 500,
                    },
                    loc => {
                        if (isMounted) {
                            const { latitude, longitude } = loc.coords;

                            const currentLocation = {
                                latitude: latitude,
                                longitude: longitude,
                                latitudeDelta: LATITUDE_DELTA,
                                longitudeDelta: LONGITUDE_DELTA,
                            };
                            console.log('======' + loc.coords);
                            setCurrentUserLocation(currentLocation);

                            // Call API to update user location on server

                        }
                        return () => {
                            isMounted = false;
                            locationWatcher.remove(); // Cleanup when component unmounts
                        };
                    })
            }
        })();
        return () => {
            isMounted = false; // Cleanup if component unmounts before async operations complete
        };
    }, []);

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

    const getCurrentLocation = () => {
        mapView?.current?.animateToRegion(
            {
                latitude: currentUserLocation?.latitude,
                longitude: currentUserLocation?.longitude,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
            },
            200,
        );
    };

    const zoomIn = () => {
        mapView?.current?.animateToRegion(
            {
                latitude: currentUserLocation?.latitude,
                longitude: currentUserLocation?.longitude,
                latitudeDelta: LATITUDE_DELTA / 2,
                longitudeDelta: LONGITUDE_DELTA / 2,
            },
            200,
        );
    };

    const zoomOut = () => {
        mapView?.current?.animateToRegion(
            {
                latitude: currentUserLocation?.latitude,
                longitude: currentUserLocation?.longitude,
                latitudeDelta: LATITUDE_DELTA * 1.5,
                longitudeDelta: LONGITUDE_DELTA * 1.5,
            },
            200,
        );
    };

    const resetZoom = () => {
        mapView?.current?.animateCamera({
            center: {
                latitude: currentUserLocation.latitude,
                longitude: currentUserLocation.longitude,
            },
            pitch: 0,
            heading: 0,
            altitude: 1000,
            zoom: 105,
        });
    }

    // Couleurs pour le mode clair et sombre
    const headerBackgroundColor = isDark ? '#1A1A1A' : '#1776BA';
    const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
    const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
    const borderColor = isDark ? '#3A3A3C' : '#E0E0E0';

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F3F3F7' }]}>
            <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                {/* Header */}
                <View
                    style={[
                        styles.header,
                    ]}
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            style={[styles.headerButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
                            onPress={handleBack}
                        >
                            <MaterialIcons name="arrow-back" size={24} color="#000" />
                        </TouchableOpacity>

                        <ThemedText style={[styles.headerTitle, { color: '#000' }]}>
                            Suivi du trajet
                        </ThemedText>

                        <View style={styles.headerButton} />
                    </View>
                </View>
                <MapView
                    ref={mapView}
                    style={{ flex: 1 }}
                    initialRegion={currentUserLocation as unknown as Region}
                    zoomTapEnabled
                    onMapLoaded={() => {
                        mapView?.current?.animateCamera({
                            center: {
                                latitude: currentUserLocation.latitude,
                                longitude: currentUserLocation.longitude,
                            },
                            pitch: 0,
                            heading: 0,
                            altitude: 1000,
                            zoom: 15,
                        });

                    }} onRegionChange={({ longitudeDelta, latitudeDelta }) => {
                        LONGITUDE_DELTA = longitudeDelta;
                        LATITUDE_DELTA = latitudeDelta;
                    }}
                    onRegionChangeComplete={({ longitudeDelta, latitudeDelta }) => {
                        LONGITUDE_DELTA = longitudeDelta;
                        LATITUDE_DELTA = latitudeDelta;
                    }}
                >
                    {/* User Location Marker  */}
                    <UserMarker region={currentUserLocation} key={"user"} />
                </MapView>


                <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }}>
                    {/* Boutons de contrôle au-dessus du panneau d'information */}
                    <View style={styles.controlButtonsContainer}>



                        <TouchableOpacity
                            style={[styles.controlButton, { backgroundColor: iconCircleBackgroundColor }]}
                            onPress={getCurrentLocation}
                        >
                            <Ionicons name="locate" size={20} color={primaryTextColor} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.controlButton, { backgroundColor: iconCircleBackgroundColor }]}
                            onPress={resetZoom}
                        >
                            <Ionicons name="expand-outline" size={20} color={primaryTextColor} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.controlButton, { backgroundColor: iconCircleBackgroundColor }]}
                            onPress={zoomIn}
                        >
                            <Ionicons name="add-outline" size={20} color={primaryTextColor} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.controlButton, { backgroundColor: iconCircleBackgroundColor }]}
                            onPress={zoomOut}
                        >
                            <Ionicons name="remove-outline" size={20} color={primaryTextColor} />
                        </TouchableOpacity>
                    </View>
                </View>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        position: 'absolute',
        paddingHorizontal: 15,
        top: 52,
        left: 0,
        right: 0,
        width: '100%',
        height: 60,
        zIndex: 10,
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
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
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

    controlButtonsContainer: {
        position: 'absolute',
        bottom: '46%',
        right: 20,
        flexDirection: 'column',
        gap: 12,
        zIndex: 10,
        // borderWidth: 1,
        // borderColor: 'red',
    },
    controlButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        // shadowColor: '#000',
        // shadowOffset: { width: 0, height: 2 },
        // shadowOpacity: 0.2,
        // shadowRadius: 4,
        // elevation: 4,
    },
});
