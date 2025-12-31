import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { type Region } from "react-native-maps";

import UserMarker from "@/components/map/user-marker";

const { width, height } = Dimensions.get("window");
const ASPECT_RATIO = width / height;
const DEFAULT_LATITUDE_DELTA = 0.0922;
const DEFAULT_LONGITUDE_DELTA = DEFAULT_LATITUDE_DELTA * ASPECT_RATIO;

const LOCATION_CONFIG: Location.LocationOptions = {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 5,
};

const DEFAULT_LOCATION = {
    latitude: 5.320357,
    longitude: -4.016107,
    latitudeDelta: DEFAULT_LATITUDE_DELTA,
    longitudeDelta: DEFAULT_LONGITUDE_DELTA,
};

// Seuils de filtrage (plus permissifs pour éviter de bloquer le démarrage)
const MIN_ACCURACY = 100;
const MIN_DISTANCE_THRESHOLD = 0;
const MAX_SPEED = 50;
const WARMUP_UPDATES = 3; // Nombre de mises à jour avant d'activer le filtrage strict

interface LocationData {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
    heading: number | null;
    speed: number | null;
    accuracy: number | null;
}

/**
 * Calcule la distance entre deux coordonnées (formule de Haversine)
 */
const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

/**
 * Écran de suivi de trajet
 * Affiche la position du conducteur en temps réel
 */
export default function TrackRouteScreen() {
    const mapViewRef = useRef<MapView>(null);
    const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
    const zoomRef = useRef({
        latitudeDelta: DEFAULT_LATITUDE_DELTA,
        longitudeDelta: DEFAULT_LONGITUDE_DELTA,
    });

    const previousLocationRef = useRef<{
        latitude: number;
        longitude: number;
        timestamp: number;
    } | null>(null);

    const isUserInteractingRef = useRef(false);
    const lastCameraUpdateRef = useRef(0);
    const warmUpCountRef = useRef(0);

    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const [currentUserLocation, setCurrentUserLocation] = useState<LocationData>({
        ...DEFAULT_LOCATION,
        heading: null,
        speed: null,
        accuracy: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isRouteStarted, setIsRouteStarted] = useState(false);
    const [isWarmingUp, setIsWarmingUp] = useState(true);
    const [locationStats, setLocationStats] = useState({
        totalUpdates: 0,
        rejectedUpdates: 0,
    });

    const iconCircleBackgroundColor = isDark ? "#2C2C2E" : "#F8F8F8";

    /**
     * Valide la qualité d'une position GPS
     */
    const isValidLocation = useCallback(
        (location: Location.LocationObject): boolean => {
            // Pendant le warm-up, accepter toutes les positions
            if (isWarmingUp && warmUpCountRef.current < WARMUP_UPDATES) {
                warmUpCountRef.current++;
                console.log(
                    `[LOCATION] Warm-up ${warmUpCountRef.current}/${WARMUP_UPDATES} - position acceptée`
                );

                if (warmUpCountRef.current >= WARMUP_UPDATES) {
                    setIsWarmingUp(false);
                    console.log("[LOCATION] Warm-up terminé, filtrage activé");
                }
                return true;
            }

            const { accuracy, speed } = location.coords;

            if (accuracy && accuracy > MIN_ACCURACY) {
                console.log(
                    "[LOCATION] Position rejetée - précision insuffisante:",
                    accuracy
                );
                return false;
            }

            if (speed && speed > MAX_SPEED) {
                console.log("[LOCATION] Position rejetée - vitesse anormale:", speed);
                return false;
            }

            if (previousLocationRef.current) {
                const distance = calculateDistance(
                    previousLocationRef.current.latitude,
                    previousLocationRef.current.longitude,
                    location.coords.latitude,
                    location.coords.longitude
                );

                const timeDiff =
                    (location.timestamp - previousLocationRef.current.timestamp) / 1000;
                const calculatedSpeed = distance / timeDiff;

                if (distance < MIN_DISTANCE_THRESHOLD && !isWarmingUp) {
                    return false;
                }

                if (calculatedSpeed > MAX_SPEED) {
                    console.log(
                        "[LOCATION] Position rejetée - vitesse calculée anormale:",
                        calculatedSpeed
                    );
                    return false;
                }
            }

            return true;
        },
        [isWarmingUp]
    );

    /**
     * Met à jour la caméra de manière intelligente
     */
    const updateCameraPosition = useCallback(
        (latitude: number, longitude: number, heading: number | null) => {
            if (isUserInteractingRef.current) {
                return;
            }

            const now = Date.now();
            const timeSinceLastUpdate = now - lastCameraUpdateRef.current;

            if (timeSinceLastUpdate < 2000) {
                return;
            }

            lastCameraUpdateRef.current = now;

            if (heading !== null && heading >= 0) {
                mapViewRef.current?.animateCamera(
                    {
                        center: { latitude, longitude },
                        heading: heading,
                    },
                    { duration: 1000 }
                );
            } else {
                mapViewRef.current?.animateCamera(
                    {
                        center: { latitude, longitude },
                    },
                    { duration: 1000 }
                );
            }
        },
        []
    );

    /**
     * Gère les mises à jour de position
     */
    const handleLocationUpdate = useCallback(
        (location: Location.LocationObject) => {
            console.log("[LOCATION] Nouvelle position reçue:", {
                latitude: location.coords.latitude.toFixed(6),
                longitude: location.coords.longitude.toFixed(6),
                accuracy: location.coords.accuracy?.toFixed(2),
                speed: location.coords.speed?.toFixed(2),
                heading: location.coords.heading?.toFixed(2),
            });

            setLocationStats((prev) => ({
                ...prev,
                totalUpdates: prev.totalUpdates + 1,
            }));

            // Valider la position
            const isValid = isValidLocation(location);

            if (!isValid) {
                setLocationStats((prev) => ({
                    ...prev,
                    rejectedUpdates: prev.rejectedUpdates + 1,
                }));
                console.log("[LOCATION] Position rejetée");
                return;
            }

            const { latitude, longitude, heading, speed, accuracy } = location.coords;

            // Mettre à jour la position
            setCurrentUserLocation((prev) => ({
                latitude,
                longitude,
                latitudeDelta: prev.latitudeDelta,
                longitudeDelta: prev.longitudeDelta,
                heading,
                speed,
                accuracy,
            }));

            // Mettre à jour la caméra si le trajet est démarré
            if (isRouteStarted) {
                updateCameraPosition(latitude, longitude, heading);
            }

            // Sauvegarder la position pour la prochaine validation
            previousLocationRef.current = {
                latitude,
                longitude,
                timestamp: location.timestamp,
            };
        },
        [isValidLocation, updateCameraPosition, isRouteStarted]
    );

    /**
     * Arrête le suivi de position
     */
    const stopTracking = useCallback(() => {
        if (locationWatcherRef.current) {
            console.log("[LOCATION] Arrêt du suivi de position");
            locationWatcherRef.current.remove();
            locationWatcherRef.current = null;
        }
    }, []);

    /**
     * Gère le retour à l'écran précédent
     */
    const handleBack = useCallback(() => {
        stopTracking();
        router.back();
    }, [stopTracking]);

    /**
     * Initialise le suivi de position
     */
    useEffect(() => {
        let isMounted = true;

        const startLocationTracking = async () => {
            try {
                console.log("[LOCATION] Demande de permission...");
                const { status } = await Location.requestForegroundPermissionsAsync();

                if (status !== "granted") {
                    Alert.alert(
                        "Permission refusée",
                        "L'accès à la localisation est nécessaire pour suivre le trajet.",
                        [{ text: "OK", onPress: () => router.back() }]
                    );
                    if (isMounted) setIsLoading(false);
                    return;
                }

                console.log("[LOCATION] Permission accordée, récupération de la position...");

                // Obtenir la position initiale
                const initialLocation = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.BestForNavigation,
                });

                if (isMounted) {
                    const { latitude, longitude, heading, speed, accuracy } =
                        initialLocation.coords;

                    console.log("[LOCATION] Position initiale obtenue:", {
                        latitude: latitude.toFixed(6),
                        longitude: longitude.toFixed(6),
                        accuracy: accuracy?.toFixed(2),
                    });

                    setCurrentUserLocation((prev) => ({
                        ...prev,
                        latitude,
                        longitude,
                        heading,
                        speed,
                        accuracy,
                    }));

                    previousLocationRef.current = {
                        latitude,
                        longitude,
                        timestamp: initialLocation.timestamp,
                    };

                    // Masquer le loader dès qu'on a la position initiale
                    setIsLoading(false);
                    console.log("[LOCATION] Loader masqué");
                }

                console.log("[LOCATION] Démarrage du suivi en temps réel...");

                // Démarre le suivi de position en temps réel
                const watcher = await Location.watchPositionAsync(
                    LOCATION_CONFIG,
                    (location) => {
                        if (!isMounted) return;
                        handleLocationUpdate(location);
                    }
                );

                locationWatcherRef.current = watcher;
                console.log("[LOCATION] Suivi de position démarré");
            } catch (error) {
                console.error("[LOCATION] Erreur lors de l'initialisation:", error);
                Alert.alert(
                    "Erreur",
                    "Une erreur est survenue lors de l'accès à la localisation.",
                    [{ text: "OK", onPress: () => router.back() }]
                );
                if (isMounted) setIsLoading(false);
            }
        };

        startLocationTracking();

        return () => {
            isMounted = false;
            stopTracking();
        };
    }, [stopTracking, handleLocationUpdate]);

    /**
     * Centre la carte sur la position actuelle
     */
    const getCurrentLocation = useCallback(() => {
        isUserInteractingRef.current = false;
        lastCameraUpdateRef.current = 0;

        mapViewRef.current?.animateToRegion(
            {
                latitude: currentUserLocation.latitude,
                longitude: currentUserLocation.longitude,
                latitudeDelta: zoomRef.current.latitudeDelta,
                longitudeDelta: zoomRef.current.longitudeDelta,
            },
            300
        );
    }, [currentUserLocation.latitude, currentUserLocation.longitude]);

    /**
     * Zoom avant
     */
    const zoomIn = useCallback(() => {
        isUserInteractingRef.current = true;

        const newLatDelta = zoomRef.current.latitudeDelta / 2;
        const newLngDelta = zoomRef.current.longitudeDelta / 2;

        zoomRef.current = {
            latitudeDelta: newLatDelta,
            longitudeDelta: newLngDelta,
        };

        mapViewRef.current?.animateToRegion(
            {
                latitude: currentUserLocation.latitude,
                longitude: currentUserLocation.longitude,
                latitudeDelta: newLatDelta,
                longitudeDelta: newLngDelta,
            },
            200
        );

        setTimeout(() => {
            isUserInteractingRef.current = false;
        }, 5000);
    }, [currentUserLocation.latitude, currentUserLocation.longitude]);

    /**
     * Zoom arrière
     */
    const zoomOut = useCallback(() => {
        isUserInteractingRef.current = true;

        const newLatDelta = zoomRef.current.latitudeDelta * 1.5;
        const newLngDelta = zoomRef.current.longitudeDelta * 1.5;

        zoomRef.current = {
            latitudeDelta: newLatDelta,
            longitudeDelta: newLngDelta,
        };

        mapViewRef.current?.animateToRegion(
            {
                latitude: currentUserLocation.latitude,
                longitude: currentUserLocation.longitude,
                latitudeDelta: newLatDelta,
                longitudeDelta: newLngDelta,
            },
            200
        );

        setTimeout(() => {
            isUserInteractingRef.current = false;
        }, 5000);
    }, [currentUserLocation.latitude, currentUserLocation.longitude]);

    /**
     * Réinitialise le zoom
     */
    const resetZoom = useCallback(() => {
        isUserInteractingRef.current = false;
        lastCameraUpdateRef.current = 0;

        mapViewRef.current?.animateCamera({
            center: {
                latitude: currentUserLocation.latitude,
                longitude: currentUserLocation.longitude,
            },
            pitch: 0,
            heading: 0,
            altitude: 1000,
            zoom: 15,
        });
    }, [currentUserLocation.latitude, currentUserLocation.longitude]);

    /**
     * Gère le changement de région (zoom)
     */
    const handleRegionChange = useCallback((region: Region) => {
        zoomRef.current = {
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta,
        };
    }, []);

    /**
     * Détecte quand l'utilisateur interagit avec la carte
     */
    const handleRegionChangeStart = useCallback(() => {
        isUserInteractingRef.current = true;
    }, []);

    /**
     * Détecte quand l'utilisateur arrête d'interagir
     */
    const handleRegionChangeComplete = useCallback((region: Region) => {
        zoomRef.current = {
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta,
        };

        setTimeout(() => {
            isUserInteractingRef.current = false;
        }, 5000);
    }, []);

    /**
     * Callback au chargement de la carte
     */
    const handleMapLoaded = useCallback(() => {
        console.log("[MAP] Carte chargée");
        mapViewRef.current?.animateCamera({
            center: {
                latitude: currentUserLocation.latitude,
                longitude: currentUserLocation.longitude,
            },
            pitch: 0,
            heading: 0,
            altitude: 1000,
            zoom: 15,
        });
    }, [currentUserLocation.latitude, currentUserLocation.longitude]);

    /**
     * Gère le démarrage/arrêt du trajet
     */
    const handleStartRoute = useCallback(() => {
        if (isRouteStarted) {
            console.log("[ROUTE] Arrêt du trajet");
            setIsRouteStarted(false);
            isUserInteractingRef.current = false;
        } else {
            console.log("[ROUTE] Démarrage du trajet");
            setIsRouteStarted(true);
            isUserInteractingRef.current = false;
            lastCameraUpdateRef.current = 0;

            getCurrentLocation();
        }
    }, [isRouteStarted, getCurrentLocation]);

    const primaryTextColor = isDark ? "#FFFFFF" : "#11181C";

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: isDark ? "#000000" : "#F3F3F7" },
            ]}
        >
            <View style={styles.mapContainer}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            style={[
                                styles.headerButton,
                                { backgroundColor: "rgba(255, 255, 255, 0.9)" },
                            ]}
                            onPress={handleBack}
                        >
                            <MaterialIcons name="arrow-back" size={24} color="#000" />
                        </TouchableOpacity>

                        <View style={styles.headerButton} />
                    </View>
                </View>

                {/* Indicateur de chargement */}
                {isLoading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#1776BA" />
                        <ThemedText style={styles.loadingText}>
                            Récupération de la position...
                        </ThemedText>
                    </View>
                )}


                <MapView
                    ref={mapViewRef}
                    style={styles.map}
                    initialRegion={currentUserLocation}
                    showsUserLocation={false}
                    showsMyLocationButton={false}
                    showsCompass={false}
                    rotateEnabled={true}
                    pitchEnabled={false}
                    zoomTapEnabled
                    onMapLoaded={handleMapLoaded}
                    onRegionChange={handleRegionChange}
                    onRegionChangeStart={handleRegionChangeStart}
                    onRegionChangeComplete={handleRegionChangeComplete}
                >
                    <UserMarker
                        region={currentUserLocation}
                        heading={currentUserLocation.heading}
                    />
                </MapView>

                {/* Boutons de contrôle */}
                <View style={styles.controlButtonsContainer}>
                    <TouchableOpacity
                        style={[
                            styles.controlButton,
                            { backgroundColor: iconCircleBackgroundColor },
                        ]}
                        onPress={getCurrentLocation}
                    >
                        <Ionicons name="locate" size={20} color={primaryTextColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.controlButton,
                            { backgroundColor: iconCircleBackgroundColor },
                        ]}
                        onPress={resetZoom}
                    >
                        <Ionicons
                            name="expand-outline"
                            size={20}
                            color={primaryTextColor}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.controlButton,
                            { backgroundColor: iconCircleBackgroundColor },
                        ]}
                        onPress={zoomIn}
                    >
                        <Ionicons name="add-outline" size={20} color={primaryTextColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.controlButton,
                            { backgroundColor: iconCircleBackgroundColor },
                        ]}
                        onPress={zoomOut}
                    >
                        <Ionicons
                            name="remove-outline"
                            size={20}
                            color={primaryTextColor}
                        />
                    </TouchableOpacity>
                </View>

                {/* Bouton démarrer/terminer le trajet */}
                <View style={styles.floatingButtonContainer}>
                    <TouchableOpacity
                        style={[
                            styles.floatingButton,
                            isRouteStarted && styles.floatingButtonActive,
                        ]}
                        onPress={handleStartRoute}
                        activeOpacity={0.8}
                    >
                        <ThemedText style={styles.floatingButtonText}>
                            {isRouteStarted ? "Terminer le trajet" : "Démarrer le trajet"}
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    mapContainer: {
        flex: 1,
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
    },
    map: {
        flex: 1,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 20,
        gap: 12,
    },
    loadingText: {
        fontSize: 16,
        fontFamily: "Ubuntu_Regular",
    },
    debugContainer: {
        position: "absolute",
        top: 120,
        left: 10,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        padding: 8,
        borderRadius: 8,
        zIndex: 10,
    },
    debugText: {
        fontSize: 10,
        color: "#FFF",
        fontFamily: "Ubuntu_Regular",
    },
    header: {
        position: "absolute",
        paddingHorizontal: 15,
        top: 52,
        left: 0,
        right: 0,
        width: "100%",
        height: 60,
        zIndex: 10,
    },
    headerContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    controlButtonsContainer: {
        position: "absolute",
        bottom: 120,
        right: 20,
        flexDirection: "column",
        gap: 12,
        zIndex: 15,
    },
    controlButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    floatingButtonContainer: {
        position: "absolute",
        bottom: 20,
        left: 20,
        right: 20,
        alignItems: "center",
        zIndex: 5,
    },
    floatingButton: {
        backgroundColor: "#1776BA",
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        minWidth: 200,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    floatingButtonActive: {
        backgroundColor: "#E74C3C",
    },
    floatingButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontFamily: "Ubuntu_Bold",
    },
});