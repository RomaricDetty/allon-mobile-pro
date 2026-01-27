import { Departure } from "@/components/departure-card";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDimensions } from "@/hooks/use-dimensions";
import { calculateDistance } from "@/utils/location";
import { logError, logWithTag } from "@/utils/logger";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Modal,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { type Region } from "react-native-maps";

import { markAsStatusDepartureApi } from "@/api/departures";
import UserMarker from "@/components/map/user-marker";
import { departureEventEmitter } from "@/utils/departure-events";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_LATITUDE_DELTA = 0.0922;

const LOCATION_CONFIG: Location.LocationOptions = {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 5,
};

// DEFAULT_LOCATION sera créé dynamiquement avec useMemo

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
 * Écran de suivi de trajet
 * Affiche la position du conducteur en temps réel
 */
export default function TrackRouteScreen() {
    const dimensions = useDimensions();
    const mapViewRef = useRef<MapView>(null);
    const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
    const params = useLocalSearchParams<{ departure: string }>();
    
    // Calculer les deltas en fonction des dimensions
    const aspectRatio = useMemo(() => dimensions.width / dimensions.height, [dimensions.width, dimensions.height]);
    const defaultLongitudeDelta = useMemo(() => DEFAULT_LATITUDE_DELTA * aspectRatio, [aspectRatio]);
    
    const zoomRef = useRef({
        latitudeDelta: DEFAULT_LATITUDE_DELTA,
        longitudeDelta: DEFAULT_LATITUDE_DELTA * (dimensions.width / dimensions.height),
    });
    
    // Mettre à jour zoomRef quand defaultLongitudeDelta est disponible
    useEffect(() => {
        zoomRef.current.longitudeDelta = defaultLongitudeDelta;
    }, [defaultLongitudeDelta]);

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

    const defaultLocation = useMemo(() => ({
        latitude: 5.320357,
        longitude: -4.016107,
        latitudeDelta: DEFAULT_LATITUDE_DELTA,
        longitudeDelta: defaultLongitudeDelta,
    }), [defaultLongitudeDelta]);

    const [currentUserLocation, setCurrentUserLocation] = useState<LocationData>({
        ...defaultLocation,
        heading: null,
        speed: null,
        accuracy: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isRouteStarted, setIsRouteStarted] = useState(false);
    const [isWarmingUp, setIsWarmingUp] = useState(true);
    const [showActionModal, setShowActionModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<"boarding" | "startRoute" | "finishRoute" | null>(null);
    const [loadingAction, setLoadingAction] = useState<"boarding" | "startRoute" | "finishRoute" | null>(null);

    // Animation pour l'effet slide du modal de confirmation
    const slideAnim = useRef(new Animated.Value(0)).current;
    // Animation pour l'effet slide du modal d'actions
    const actionSlideAnim = useRef(new Animated.Value(0)).current;

    const colors = useMemo(() => ({
        iconCircleBg: isDark ? "#2C2C2E" : "#F8F8F8",
        primaryText: isDark ? "#FFFFFF" : "#11181C",
        modalBg: isDark ? "#1A1A1A" : "#FFFFFF",
        modalText: isDark ? "#FFFFFF" : "#11181C",
        modalMessage: isDark ? "#CCCCCC" : "#666666",
        closeButtonBg: isDark ? "#2C2C2E" : "#F8F8F8",
    }), [isDark]);

    /**
     * Parse et mémorise les données du départ initiales
     */
    const initialDeparture = useMemo<Departure | null>(() => {
        try {
            if (params?.departure) {
                return JSON.parse(params.departure) as Departure;
            }
        } catch (error) {
            logError("[TRACK-ROUTE] Erreur lors du parsing du départ:", error);
        }
        return null;
    }, [params?.departure]);

    /**
     * État local pour le départ (mis à jour après chaque action)
     */
    const [currentDeparture, setCurrentDeparture] = useState<Departure | null>(initialDeparture);

    /**
     * Met à jour le départ local quand le départ initial change
     */
    useEffect(() => {
        setCurrentDeparture(initialDeparture);
    }, [initialDeparture]);

    const departure = currentDeparture;

    /**
     * Vérifie les statuts du départ
     */
    const status = useMemo(() => {
        const statusUpper = departure?.status?.toUpperCase() || "";
        return {
            isScheduled: statusUpper === "SCHEDULED",
            isBoarding: statusUpper === "BOARDING",
            isDeparted: statusUpper === "DEPARTED",
            isArrived: statusUpper === "ARRIVED",
        };
    }, [departure?.status]);

    const { isScheduled, isBoarding, isDeparted, isArrived } = status;

    /**
     * Vérifie si l'action d'embarquement peut être effectuée
     */
    const canPerformBoarding = isScheduled && !isBoarding && !isDeparted && !isArrived;

    /**
     * Vérifie si le trajet peut être démarré
     */
    const canStartRoute = (isScheduled || isBoarding) && !isDeparted && !isArrived;

    /**
     * Valide les coordonnées GPS
     */
    const isValidCoordinates = useCallback((lat: number, lng: number): boolean => {
        return !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng);
    }, []);

    /**
     * Valide la qualité d'une position GPS
     */
    const isValidLocation = useCallback(
        (location: Location.LocationObject): boolean => {
            if (isWarmingUp && warmUpCountRef.current < WARMUP_UPDATES) {
                warmUpCountRef.current++;
                logWithTag("LOCATION", `Warm-up ${warmUpCountRef.current}/${WARMUP_UPDATES} - position acceptée`);
                if (warmUpCountRef.current >= WARMUP_UPDATES) {
                    setIsWarmingUp(false);
                    logWithTag("LOCATION", "Warm-up terminé, filtrage activé");
                }
                return true;
            }

            const { accuracy, speed } = location.coords;
            if (accuracy && accuracy > MIN_ACCURACY) {
                logWithTag("LOCATION", "Position rejetée - précision insuffisante:", accuracy);
                return false;
            }
            if (speed && speed > MAX_SPEED) {
                logWithTag("LOCATION", "Position rejetée - vitesse anormale:", speed);
                return false;
            }

            if (previousLocationRef.current) {
                const distance = calculateDistance(
                    previousLocationRef.current.latitude,
                    previousLocationRef.current.longitude,
                    location.coords.latitude,
                    location.coords.longitude
                );
                const timeDiff = (location.timestamp - previousLocationRef.current.timestamp) / 1000;
                const calculatedSpeed = distance / timeDiff;

                if (distance < MIN_DISTANCE_THRESHOLD && !isWarmingUp) return false;
                if (calculatedSpeed > MAX_SPEED) {
                    logWithTag("LOCATION", "Position rejetée - vitesse calculée anormale:", calculatedSpeed);
                    return false;
                }
            }
            return true;
        },
        [isWarmingUp]
    );

    /**
     * Calcule le niveau de zoom à partir des deltas de région
     * Formule approximative : zoom ≈ log2(360 / latitudeDelta)
     */
    const calculateZoomFromDelta = useCallback((latitudeDelta: number): number => {
        // Approximation : zoom 15 ≈ 0.01 delta, zoom 10 ≈ 0.1 delta
        const zoom = Math.log2(360 / latitudeDelta);
        return Math.max(10, Math.min(20, zoom)); // Limiter entre 10 et 20
    }, []);

    /**
     * Met à jour la caméra de manière intelligente
     */
    const updateCameraPosition = useCallback(
        (latitude: number, longitude: number, heading: number | null) => {
            if (isUserInteractingRef.current || !mapViewRef.current || !isValidCoordinates(latitude, longitude)) {
                return;
            }

            const now = Date.now();
            if (now - lastCameraUpdateRef.current < 500) return;
            lastCameraUpdateRef.current = now;

            try {
                const currentZoom = calculateZoomFromDelta(zoomRef.current.latitudeDelta);
                if (heading !== null && heading >= 0 && isValidCoordinates(heading, heading)) {
                    mapViewRef.current.animateCamera({ center: { latitude, longitude }, heading, zoom: currentZoom }, { duration: 500 });
                } else {
                    mapViewRef.current.animateToRegion({ latitude, longitude, latitudeDelta: zoomRef.current.latitudeDelta, longitudeDelta: zoomRef.current.longitudeDelta }, 500);
                }
            } catch (error) {
                logError("[MAP] Erreur lors de la mise à jour de la caméra:", error);
            }
        },
        [calculateZoomFromDelta, isValidCoordinates]
    );

    /**
     * Gère les mises à jour de position
     */
    const handleLocationUpdate = useCallback(
        (location: Location.LocationObject) => {
            const isValid = isValidLocation(location);
            if (!isValid) {
                logWithTag("LOCATION", "Position rejetée");
                return;
            }

            const { latitude, longitude, heading, speed, accuracy } = location.coords;
            setCurrentUserLocation((prev) => ({ ...prev, latitude, longitude, heading, speed, accuracy }));
            if (isRouteStarted) updateCameraPosition(latitude, longitude, heading);
            previousLocationRef.current = { latitude, longitude, timestamp: location.timestamp };
        },
        [isValidLocation, updateCameraPosition, isRouteStarted]
    );

    /**
     * Arrête le suivi de position
     */
    const stopTracking = useCallback(() => {
        if (locationWatcherRef.current) {
            logWithTag("LOCATION", "Arrêt du suivi de position");
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
     * Gère les permissions et vérifie que les services de localisation sont activés
     */
    useEffect(() => {
        let isMounted = true;

        const startLocationTracking = async () => {
            try {
                // Vérifier d'abord si les permissions sont déjà accordées
                logWithTag("LOCATION", "Vérification des permissions...");
                let { status } = await Location.getForegroundPermissionsAsync();

                // Si les permissions ne sont pas accordées, les demander
                if (status !== "granted") {
                    logWithTag("LOCATION", "Demande de permission...");
                    const permissionResponse = await Location.requestForegroundPermissionsAsync();
                    status = permissionResponse.status;
                }

                if (status !== "granted") {
                    logWithTag("LOCATION", "Permission refusée:", status);
                    if (isMounted) {
                        Alert.alert(
                            "Permission refusée",
                            "L'accès à la localisation est nécessaire pour suivre le trajet. Veuillez activer la localisation dans les paramètres de l'application.",
                            [{ text: "OK", onPress: () => router.back() }]
                        );
                        setIsLoading(false);
                    }
                    return;
                }

                logWithTag("LOCATION", "Permission accordée");

                // Sur Android, vérifier que les services de localisation sont activés
                if (Platform.OS === "android") {
                    const servicesEnabled = await Location.hasServicesEnabledAsync();
                    if (!servicesEnabled) {
                        logWithTag("LOCATION", "Services de localisation désactivés");
                        if (isMounted) {
                            Alert.alert(
                                "Localisation désactivée",
                                "Veuillez activer les services de localisation (GPS) dans les paramètres de votre appareil.",
                                [{ text: "OK", onPress: () => router.back() }]
                            );
                            setIsLoading(false);
                        }
                        return;
                    }
                }

                logWithTag("LOCATION", "Récupération de la position initiale...");

                // Obtenir la position initiale avec un timeout pour éviter les blocages
                let initialLocation: Location.LocationObject | null = null;
                try {
                    // Utiliser Promise.race pour ajouter un timeout
                    const locationPromise = Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.BestForNavigation,
                    });

                    const timeoutPromise = new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error("Timeout")), 15000);
                    });

                    initialLocation = await Promise.race([locationPromise, timeoutPromise]);
                } catch (locationError: any) {
                    logError("[LOCATION] Erreur lors de la récupération de la position initiale:", locationError);
                    
                    // Si c'est un timeout, essayer avec une précision moindre
                    if (locationError?.message === "Timeout" || locationError?.code === "TIMEOUT") {
                        logWithTag("LOCATION", "Timeout, tentative avec précision réduite...");
                        try {
                            initialLocation = await Location.getCurrentPositionAsync({
                                accuracy: Location.Accuracy.Balanced,
                            });
                        } catch (retryError) {
                            logError("[LOCATION] Erreur lors de la deuxième tentative:", retryError);
                            if (isMounted) {
                                Alert.alert(
                                    "Impossible d'obtenir la position",
                                    "Vérifiez que votre GPS est activé et que vous êtes dans une zone avec une bonne réception.",
                                    [{ text: "OK", onPress: () => router.back() }]
                                );
                                setIsLoading(false);
                            }
                            return;
                        }
                    } else {
                        if (isMounted) {
                            Alert.alert(
                                "Erreur de localisation",
                                "Une erreur est survenue lors de l'accès à la localisation. Veuillez réessayer.",
                                [{ text: "OK", onPress: () => router.back() }]
                            );
                            setIsLoading(false);
                        }
                        return;
                    }
                }

                if (!initialLocation || !isMounted) {
                    if (isMounted) setIsLoading(false);
                    return;
                }

                const { latitude, longitude, heading, speed, accuracy } = initialLocation.coords;

                if (!isValidCoordinates(latitude, longitude)) {
                    logError("[LOCATION] Coordonnées invalides:", { latitude, longitude });
                    if (isMounted) {
                        Alert.alert("Position invalide", "Impossible d'obtenir une position valide. Veuillez réessayer.", [{ text: "OK", onPress: () => router.back() }]);
                        setIsLoading(false);
                    }
                    return;
                }

                if (isMounted) {
                    setCurrentUserLocation((prev) => ({ ...prev, latitude, longitude, heading: heading ?? null, speed: speed ?? null, accuracy: accuracy ?? null }));
                    previousLocationRef.current = { latitude, longitude, timestamp: initialLocation.timestamp };

                    // Centrer la carte sur la position obtenue
                    setTimeout(() => {
                        if (mapViewRef.current && isMounted && isValidCoordinates(latitude, longitude)) {
                            try {
                                mapViewRef.current.animateToRegion({ latitude, longitude, latitudeDelta: DEFAULT_LATITUDE_DELTA, longitudeDelta: defaultLongitudeDelta }, 500);
                                logWithTag("MAP", "Carte centrée sur la position initiale");
                            } catch (error) {
                                logError("[MAP] Erreur lors du centrage initial:", error);
                            }
                        }
                    }, 100);

                    setIsLoading(false);
                }

                // Démarre le suivi de position en temps réel
                try {
                    const watcher = await Location.watchPositionAsync(
                        LOCATION_CONFIG,
                        (location) => {
                            if (!isMounted) return;
                            handleLocationUpdate(location);
                        }
                    );

                    if (isMounted) locationWatcherRef.current = watcher;
                    else watcher.remove();
                } catch (watchError) {
                    logError("[LOCATION] Erreur lors du démarrage du suivi:", watchError);
                    if (isMounted) {
                        Alert.alert(
                            "Erreur",
                            "Impossible de démarrer le suivi de position. Veuillez réessayer.",
                            [{ text: "OK" }]
                        );
                        setIsLoading(false);
                    }
                }
            } catch (error) {
                logError("[LOCATION] Erreur lors de l'initialisation:", error);
                if (isMounted) {
                    Alert.alert(
                        "Erreur",
                        "Une erreur est survenue lors de l'accès à la localisation. Veuillez réessayer.",
                        [{ text: "OK", onPress: () => router.back() }]
                    );
                    setIsLoading(false);
                }
            }
        };

        startLocationTracking();

        return () => {
            isMounted = false;
            stopTracking();
        };
    }, [stopTracking, handleLocationUpdate, defaultLongitudeDelta, isValidCoordinates]);

    /**
     * Centre la carte sur la position actuelle
     */
    const getCurrentLocation = useCallback(() => {
        if (!mapViewRef.current) return;
        const { latitude, longitude } = currentUserLocation;
        if (!isValidCoordinates(latitude, longitude)) return;

        isUserInteractingRef.current = false;
        lastCameraUpdateRef.current = 0;
        try {
            mapViewRef.current.animateToRegion({ latitude, longitude, latitudeDelta: zoomRef.current.latitudeDelta, longitudeDelta: zoomRef.current.longitudeDelta }, 300);
        } catch (error) {
            logError("[MAP] Erreur lors du centrage:", error);
        }
    }, [currentUserLocation.latitude, currentUserLocation.longitude, isValidCoordinates]);

    /**
     * Gère le zoom (avant ou arrière)
     */
    const handleZoom = useCallback((factor: number) => {
        if (!mapViewRef.current) return;
        const { latitude, longitude } = currentUserLocation;
        if (!isValidCoordinates(latitude, longitude)) return;

        isUserInteractingRef.current = true;
        const newLatDelta = zoomRef.current.latitudeDelta * factor;
        const newLngDelta = zoomRef.current.longitudeDelta * factor;
        zoomRef.current = { latitudeDelta: newLatDelta, longitudeDelta: newLngDelta };

        try {
            mapViewRef.current.animateToRegion({ latitude, longitude, latitudeDelta: newLatDelta, longitudeDelta: newLngDelta }, 200);
        } catch (error) {
            logError("[MAP] Erreur lors du zoom:", error);
        }
        setTimeout(() => { isUserInteractingRef.current = false; }, 5000);
    }, [currentUserLocation.latitude, currentUserLocation.longitude, isValidCoordinates]);

    const zoomIn = useCallback(() => handleZoom(0.5), [handleZoom]);
    const zoomOut = useCallback(() => handleZoom(1.5), [handleZoom]);

    /**
     * Réinitialise le zoom
     */
    const resetZoom = useCallback(() => {
        if (!mapViewRef.current) return;
        const { latitude, longitude } = currentUserLocation;
        if (!isValidCoordinates(latitude, longitude)) return;

        isUserInteractingRef.current = false;
        lastCameraUpdateRef.current = 0;
        try {
            mapViewRef.current.animateCamera({ center: { latitude, longitude }, pitch: 0, heading: 0, altitude: 1000, zoom: 15 });
        } catch (error) {
            logError("[MAP] Erreur lors de la réinitialisation du zoom:", error);
        }
    }, [currentUserLocation.latitude, currentUserLocation.longitude, isValidCoordinates]);

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
        if (!mapViewRef.current) return;
        const isDefaultLocation = currentUserLocation.latitude === defaultLocation.latitude && currentUserLocation.longitude === defaultLocation.longitude;
        if (isDefaultLocation || isLoading) return;

        const { latitude, longitude, heading } = currentUserLocation;
        if (!isValidCoordinates(latitude, longitude)) return;

        try {
            mapViewRef.current.animateCamera({ center: { latitude, longitude }, pitch: 0, heading: heading || 0, altitude: 1000, zoom: 15 });
        } catch (error) {
            logError("[MAP] Erreur lors du chargement de la carte:", error);
        }
    }, [currentUserLocation, defaultLocation, isLoading, isValidCoordinates]);

    /**
     * Centre automatiquement la carte quand la position est obtenue
     */
    useEffect(() => {
        if (isLoading || !mapViewRef.current) return;
        const isDefaultLocation = currentUserLocation.latitude === defaultLocation.latitude && currentUserLocation.longitude === defaultLocation.longitude;
        if (isDefaultLocation) return;

        const { latitude, longitude } = currentUserLocation;
        if (!isValidCoordinates(latitude, longitude)) return;

        const timer = setTimeout(() => {
            if (mapViewRef.current) {
                try {
                    mapViewRef.current.animateToRegion({ latitude, longitude, latitudeDelta: DEFAULT_LATITUDE_DELTA, longitudeDelta: defaultLongitudeDelta }, 500);
                    logWithTag("MAP", "Carte centrée automatiquement sur la position");
                } catch (error) {
                    logError("[MAP] Erreur lors du centrage automatique:", error);
                }
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [isLoading, currentUserLocation.latitude, currentUserLocation.longitude, defaultLocation, defaultLongitudeDelta, isValidCoordinates]);

    /**
     * Active automatiquement le suivi de la caméra si le statut est DEPARTED
     */
    useEffect(() => {
        if (isDeparted && !isRouteStarted) {
            setIsRouteStarted(true);
            isUserInteractingRef.current = false;
            lastCameraUpdateRef.current = 0;
            if (mapViewRef.current && isValidCoordinates(currentUserLocation.latitude, currentUserLocation.longitude)) {
                setTimeout(() => getCurrentLocation(), 300);
            }
        }
    }, [isDeparted, isRouteStarted, currentUserLocation, getCurrentLocation, isValidCoordinates]);

    useEffect(() => { if (!isScheduled && showActionModal) setShowActionModal(false); }, [isScheduled, showActionModal]);

    /**
     * Anime l'effet slide d'un modal
     */
    const animateModal = useCallback((anim: Animated.Value, visible: boolean) => {
        if (visible) {
            Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
        } else {
            Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        }
    }, []);

    useEffect(() => { animateModal(actionSlideAnim, showActionModal); }, [showActionModal, actionSlideAnim, animateModal]);
    useEffect(() => { animateModal(slideAnim, showConfirmModal); }, [showConfirmModal, slideAnim, animateModal]);

    /**
     * Gère l'action d'embarquement
     */
    const handleBoarding = useCallback(() => {
        if (!canPerformBoarding) return;
        logWithTag("ROUTE", "Action d'embarquement sélectionnée");
        setShowActionModal(false);
        setPendingAction("boarding");
        setLoadingAction(null);
        setShowConfirmModal(true);
    }, [canPerformBoarding]);

    /**
     * Met à jour le statut du départ de manière générique
     */
    const updateDepartureStatus = useCallback(async (status: "boarding" | "departed" | "arrived") => {
        const actionMap = { boarding: "boarding", departed: "startRoute", arrived: "finishRoute" } as const;
        const action = actionMap[status];
        setLoadingAction(action);

        try {
            const token = await AsyncStorage.getItem("token");
            if (!token) throw new Error("Token non disponible");
            if (!departure?.id) throw new Error("ID du départ non disponible");

            const response = await markAsStatusDepartureApi(departure.id, token, status);
            const statusUpper = status.toUpperCase() as "BOARDING" | "DEPARTED" | "ARRIVED";
            const updatedDeparture = currentDeparture ? { ...currentDeparture, status: statusUpper } : null;

            if (updatedDeparture) {
                setCurrentDeparture(updatedDeparture);
                departureEventEmitter.emitStatusUpdate({ departureId: departure.id, newStatus: statusUpper, departure: updatedDeparture });
            }

            const successMessage = response.data?.trip ? `Le trajet a été mis à jour avec succès.\n\n${response.data.trip}` : "Le trajet a été mis à jour avec succès.";
            Alert.alert("Succès", successMessage, status === "arrived" ? [{ text: "OK", onPress: () => router.back() }] : [{ text: "OK" }]);

            setShowConfirmModal(false);
            setPendingAction(null);

            if (status === "departed") {
                setIsRouteStarted(true);
                isUserInteractingRef.current = false;
                lastCameraUpdateRef.current = 0;
                getCurrentLocation();
            }
        } catch (error) {
            logError("[TRACK-ROUTE] Erreur lors de la mise à jour du statut:", error);
            Alert.alert("Erreur", "Une erreur est survenue lors de la mise à jour du statut. Veuillez réessayer.", [{ text: "OK" }]);
        } finally {
            setLoadingAction(null);
        }
    }, [departure?.id, currentDeparture, getCurrentLocation]);

    const confirmBoarding = useCallback(() => updateDepartureStatus("boarding"), [updateDepartureStatus]);
    const confirmStartRoute = useCallback(() => updateDepartureStatus("departed"), [updateDepartureStatus]);
    const confirmFinishRoute = useCallback(() => updateDepartureStatus("arrived"), [updateDepartureStatus]);

    /**
     * Gère le démarrage du trajet depuis le modal
     */
    const handleStartRouteFromModal = useCallback(() => {
        if (!canStartRoute) return;
        logWithTag("ROUTE", "Démarrage du trajet depuis le modal");
        setShowActionModal(false);
        setPendingAction("startRoute");
        setLoadingAction(null);
        setShowConfirmModal(true);
    }, [canStartRoute]);

    /**
     * Gère la fin du trajet
     */
    const handleFinishRoute = useCallback(() => {
        if (isArrived || !isDeparted) return;
        logWithTag("ROUTE", "Action de fin de trajet sélectionnée");
        setPendingAction("finishRoute");
        setLoadingAction(null);
        setShowConfirmModal(true);
    }, [isArrived, isDeparted]);

    /**
     * Gère le démarrage/arrêt du trajet
     */
    const handleStartRoute = useCallback(() => {
        if (isArrived) return;
        if (isRouteStarted) {
            setIsRouteStarted(false);
            isUserInteractingRef.current = false;
            return;
        }
        if (isScheduled) setShowActionModal(true);
        else if (isBoarding) {
            setPendingAction("startRoute");
            setLoadingAction(null);
            setShowConfirmModal(true);
        } else if (!isDeparted) {
            setIsRouteStarted(true);
            isUserInteractingRef.current = false;
            lastCameraUpdateRef.current = 0;
            getCurrentLocation();
        }
    }, [isRouteStarted, isScheduled, isBoarding, isDeparted, isArrived, getCurrentLocation]);

    /**
     * Ferme le modal d'actions
     */
    const handleCloseActionModal = useCallback(() => {
        setShowActionModal(false);
    }, []);

    /**
     * Annule la confirmation et ferme le modal de confirmation
     */
    const handleCancelConfirm = useCallback(() => {
        if (loadingAction) return;
        setShowConfirmModal(false);
        setPendingAction(null);
    }, [loadingAction]);

    /**
     * Messages de confirmation selon l'action
     */
    const confirmationMessages = useMemo(() => ({
        boarding: "Êtes-vous sûr de vouloir démarrer l'embarquement ?",
        finishRoute: "Êtes-vous sûr de vouloir terminer le trajet ?",
        startRoute: "Êtes-vous sûr de vouloir démarrer le trajet ?",
    }), []);

    /**
     * Couleurs des boutons selon l'action
     */
    const actionColors = useMemo(() => ({
        boarding: "#1776BA",
        finishRoute: "#E74C3C",
        startRoute: "#43b860",
    }), []);

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
                        <TouchableOpacity style={[styles.headerButton, { backgroundColor: "rgba(255, 255, 255, 0.9)" }]} onPress={handleBack}>
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
                    initialRegion={{
                        latitude: currentUserLocation.latitude,
                        longitude: currentUserLocation.longitude,
                        latitudeDelta: currentUserLocation.latitudeDelta || DEFAULT_LATITUDE_DELTA,
                        longitudeDelta: currentUserLocation.longitudeDelta || defaultLongitudeDelta,
                    }}
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
                    // Propriétés spécifiques Android pour éviter les crashes
                    loadingEnabled={Platform.OS === "android"}
                    mapType={Platform.OS === "android" ? "standard" : undefined}
                >
                    <UserMarker
                        region={currentUserLocation}
                        heading={currentUserLocation.heading}
                    />
                </MapView>

                {/* Boutons de contrôle */}
                <View style={styles.controlButtonsContainer}>
                    {[
                        { icon: "locate", onPress: getCurrentLocation },
                        { icon: "expand-outline", onPress: resetZoom },
                        { icon: "add-outline", onPress: zoomIn },
                        { icon: "remove-outline", onPress: zoomOut },
                    ].map(({ icon, onPress }, idx) => (
                        <TouchableOpacity key={idx} style={[styles.controlButton, { backgroundColor: colors.iconCircleBg }]} onPress={onPress}>
                            <Ionicons name={icon as any} size={20} color={colors.primaryText} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Bouton démarrer/terminer le trajet */}
                <View style={styles.floatingButtonContainer}>
                    {isBoarding && !isDeparted && (
                        <View style={styles.boardingIndicator}>
                            <MaterialIcons name="directions-bus" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.boardingIndicatorText}>En embarquement</ThemedText>
                        </View>
                    )}
                    {isArrived ? (
                        <View style={[styles.floatingButton, { backgroundColor: "#34C759", opacity: 0.7 }]}>
                            <ThemedText style={styles.floatingButtonText}>Trajet terminé</ThemedText>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[
                                styles.floatingButton,
                                isDeparted && styles.floatingButtonActive,
                                isRouteStarted && !isDeparted && styles.floatingButtonActive,
                                !canStartRoute && !isDeparted && { opacity: 0.6 },
                            ]}
                            onPress={isDeparted ? handleFinishRoute : handleStartRoute}
                            activeOpacity={0.8}
                            disabled={!canStartRoute && !isDeparted}
                        >
                            <ThemedText style={styles.floatingButtonText}>
                                {isDeparted ? "Terminer le trajet" : isRouteStarted ? "Terminer le trajet" : isScheduled ? "Choisir une action" : "Démarrer le trajet"}
                            </ThemedText>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bottom Sheet d'actions pour le statut SCHEDULED */}
                <Modal
                    visible={showActionModal && isScheduled}
                    transparent
                    animationType="none"
                    onRequestClose={handleCloseActionModal}
                >
                    <TouchableOpacity
                        style={styles.bottomSheetOverlay}
                        activeOpacity={1}
                        onPress={handleCloseActionModal}
                    >
                        <Animated.View
                            style={[
                                styles.bottomSheetContent,
                                { backgroundColor: colors.modalBg },
                                {
                                    transform: [{ translateY: actionSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }],
                                    opacity: actionSlideAnim,
                                },
                            ]}
                            onStartShouldSetResponder={() => true}
                        >
                            <View style={styles.bottomSheetHandle} />
                            <ThemedText style={[styles.bottomSheetTitle, { color: colors.modalText }]}>Choisir une action</ThemedText>

                            {/* Option d'embarquement - seulement si SCHEDULED */}
                            {canPerformBoarding && (
                                <TouchableOpacity
                                    style={[
                                        styles.bottomSheetButton,
                                        { backgroundColor: "#1776BA" },
                                    ]}
                                    onPress={handleBoarding}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons name="directions-bus" size={24} color="#FFFFFF" />
                                    <ThemedText style={styles.bottomSheetButtonText}>
                                        Embarquement
                                    </ThemedText>
                                </TouchableOpacity>
                            )}

                            {/* Option de démarrage - si SCHEDULED ou BOARDING */}
                            {canStartRoute && (
                                <TouchableOpacity
                                    style={[
                                        styles.bottomSheetButton,
                                        { backgroundColor: "#43b860" },
                                    ]}
                                    onPress={handleStartRouteFromModal}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons name="play-arrow" size={24} color="#FFFFFF" />
                                    <ThemedText style={styles.bottomSheetButtonText}>
                                        Démarrer le trajet
                                    </ThemedText>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={[styles.bottomSheetCloseButton, { backgroundColor: colors.closeButtonBg }]} onPress={handleCloseActionModal} activeOpacity={0.8}>
                                <ThemedText style={[styles.bottomSheetCloseText, { color: colors.modalText }]}>Fermer</ThemedText>
                            </TouchableOpacity>
                        </Animated.View>
                    </TouchableOpacity>
                </Modal>

                {/* Bottom Sheet de confirmation pour les actions */}
                <Modal
                    visible={showConfirmModal}
                    transparent
                    animationType="none"
                    onRequestClose={loadingAction ? undefined : handleCancelConfirm}
                >
                    <TouchableOpacity
                        style={styles.bottomSheetOverlay}
                        activeOpacity={1}
                        onPress={loadingAction ? undefined : handleCancelConfirm}
                        disabled={!!loadingAction}
                    >
                        <Animated.View
                            style={[
                                styles.bottomSheetContent,
                                { backgroundColor: colors.modalBg },
                                {
                                    transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }],
                                    opacity: slideAnim,
                                },
                            ]}
                            onStartShouldSetResponder={() => true}
                        >
                            <View style={styles.bottomSheetHandle} />
                            <ThemedText style={[styles.bottomSheetTitle, { color: colors.modalText }]}>Confirmer l'action</ThemedText>
                            <ThemedText style={[styles.bottomSheetMessage, { color: colors.modalMessage }]}>
                                {pendingAction ? confirmationMessages[pendingAction] : ""}
                            </ThemedText>

                            <View style={styles.confirmButtonsContainer}>
                                <TouchableOpacity
                                    style={[styles.bottomSheetConfirmButton, { backgroundColor: pendingAction ? actionColors[pendingAction] : "#43b860", opacity: loadingAction ? 0.6 : 1 }]}
                                    onPress={pendingAction === "boarding" ? confirmBoarding : pendingAction === "finishRoute" ? confirmFinishRoute : confirmStartRoute}
                                    activeOpacity={0.8}
                                    disabled={!!loadingAction}
                                >
                                    {loadingAction === pendingAction ? (
                                        <View style={styles.loaderContainer}>
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                            <ThemedText style={[styles.bottomSheetConfirmButtonText, { marginLeft: 8 }]}>Traitement...</ThemedText>
                                        </View>
                                    ) : (
                                        <ThemedText style={styles.bottomSheetConfirmButtonText}>Confirmer</ThemedText>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.bottomSheetCloseButton, { backgroundColor: colors.closeButtonBg, opacity: loadingAction ? 0.6 : 1 }]}
                                    onPress={handleCancelConfirm}
                                    activeOpacity={0.8}
                                    disabled={!!loadingAction}
                                >
                                    <ThemedText style={[styles.bottomSheetCloseText, { color: colors.modalText }]}>Annuler</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </TouchableOpacity>
                </Modal>
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
    boardingIndicator: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#5856D6",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        marginBottom: 12,
        gap: 8,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    boardingIndicatorText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontFamily: "Ubuntu_Medium",
    },
    bottomSheetOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    bottomSheetContent: {
        width: "100%",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 12,
        paddingBottom: 34,
        paddingHorizontal: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    bottomSheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: "#C7C7CC",
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: 24,
    },
    bottomSheetTitle: {
        fontSize: 20,
        fontFamily: "Ubuntu_Bold",
        marginBottom: 16,
        textAlign: "center",
    },
    bottomSheetMessage: {
        fontSize: 16,
        fontFamily: "Ubuntu_Regular",
        marginBottom: 24,
        textAlign: "center",
        lineHeight: 22,
    },
    bottomSheetButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginBottom: 12,
        gap: 12,
    },
    bottomSheetButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontFamily: "Ubuntu_Medium",
    },
    bottomSheetCloseButton: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginTop: 8,
        alignItems: "center",
    },
    bottomSheetCloseText: {
        fontSize: 16,
        fontFamily: "Ubuntu_Medium",
    },
    confirmButtonsContainer: {
        gap: 12,
    },
    bottomSheetConfirmButton: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    bottomSheetConfirmButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontFamily: "Ubuntu_Medium",
    },
    loaderContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
});