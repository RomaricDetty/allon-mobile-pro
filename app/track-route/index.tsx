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
    const [locationStats, setLocationStats] = useState({
        totalUpdates: 0,
        rejectedUpdates: 0,
    });
    const [showActionModal, setShowActionModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<"boarding" | "startRoute" | "finishRoute" | null>(null);
    const [isBoardingLoading, setIsBoardingLoading] = useState(false);
    const [isStartRouteLoading, setIsStartRouteLoading] = useState(false);
    const [isFinishLoading, setIsFinishLoading] = useState(false);

    // Animation pour l'effet slide du modal de confirmation
    const slideAnim = useRef(new Animated.Value(0)).current;
    // Animation pour l'effet slide du modal d'actions
    const actionSlideAnim = useRef(new Animated.Value(0)).current;

    const iconCircleBackgroundColor = isDark ? "#2C2C2E" : "#F8F8F8";

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
     * Vérifie si le statut du départ est SCHEDULED
     */
    const isScheduled = useMemo(() => {
        return departure?.status?.toUpperCase() === "SCHEDULED";
    }, [departure?.status]);

    /**
     * Vérifie si le statut du départ est BOARDING
     */
    const isBoarding = useMemo(() => {
        return departure?.status?.toUpperCase() === "BOARDING";
    }, [departure?.status]);

    /**
     * Vérifie si le statut du départ est DEPARTED
     */
    const isDeparted = useMemo(() => {
        return departure?.status?.toUpperCase() === "DEPARTED";
    }, [departure?.status]);

    /**
     * Vérifie si le statut du départ est ARRIVED
     */
    const isArrived = useMemo(() => {
        return departure?.status?.toUpperCase() === "ARRIVED";
    }, [departure?.status]);

    /**
     * Vérifie si l'action d'embarquement peut être effectuée
     * L'embarquement n'est possible que si le statut est SCHEDULED
     */
    const canPerformBoarding = useMemo(() => {
        return isScheduled && !isBoarding && !isDeparted && !isArrived;
    }, [isScheduled, isBoarding, isDeparted, isArrived]);

    /**
     * Vérifie si le trajet peut être démarré
     * Le démarrage est possible si le statut est SCHEDULED ou BOARDING
     */
    const canStartRoute = useMemo(() => {
        return (isScheduled || isBoarding) && !isDeparted && !isArrived;
    }, [isScheduled, isBoarding, isDeparted, isArrived]);

    /**
     * Valide la qualité d'une position GPS
     */
    const isValidLocation = useCallback(
        (location: Location.LocationObject): boolean => {
            // Pendant le warm-up, accepter toutes les positions
            if (isWarmingUp && warmUpCountRef.current < WARMUP_UPDATES) {
                warmUpCountRef.current++;
                logWithTag(
                    "LOCATION",
                    `Warm-up ${warmUpCountRef.current}/${WARMUP_UPDATES} - position acceptée`
                );

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

                const timeDiff =
                    (location.timestamp - previousLocationRef.current.timestamp) / 1000;
                const calculatedSpeed = distance / timeDiff;

                if (distance < MIN_DISTANCE_THRESHOLD && !isWarmingUp) {
                    return false;
                }

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
     * Optimisé pour un suivi fluide et performant
     */
    const updateCameraPosition = useCallback(
        (latitude: number, longitude: number, heading: number | null) => {
            if (isUserInteractingRef.current || !mapViewRef.current) {
                return;
            }

            const now = Date.now();
            const timeSinceLastUpdate = now - lastCameraUpdateRef.current;

            // Réduire le throttling à 500ms pour un suivi plus fluide
            if (timeSinceLastUpdate < 500) {
                return;
            }

            lastCameraUpdateRef.current = now;

            // Vérifier que les valeurs sont valides
            if (isNaN(latitude) || isNaN(longitude) || !isFinite(latitude) || !isFinite(longitude)) {
                logWithTag("MAP", "Valeurs de position invalides, mise à jour ignorée");
                return;
            }

            // Calculer le zoom actuel à partir des deltas pour le préserver
            const currentZoom = calculateZoomFromDelta(zoomRef.current.latitudeDelta);

            try {
                if (heading !== null && heading >= 0 && !isNaN(heading) && isFinite(heading)) {
                    // Si on a un heading, utiliser animateCamera pour la rotation
                    // Préserver le zoom actuel
                    mapViewRef.current.animateCamera(
                        {
                            center: { latitude, longitude },
                            heading: heading,
                            zoom: currentZoom,
                        },
                        { duration: 500 } // Durée réduite pour plus de réactivité
                    );
                } else {
                    // Sinon, utiliser animateToRegion (plus performant)
                    mapViewRef.current.animateToRegion(
                        {
                            latitude,
                            longitude,
                            latitudeDelta: zoomRef.current.latitudeDelta,
                            longitudeDelta: zoomRef.current.longitudeDelta,
                        },
                        500
                    );
                }
            } catch (error) {
                logError("[MAP] Erreur lors de la mise à jour de la caméra:", error);
            }
        },
        [calculateZoomFromDelta]
    );

    /**
     * Gère les mises à jour de position
     */
    const handleLocationUpdate = useCallback(
        (location: Location.LocationObject) => {
            logWithTag("LOCATION", "Nouvelle position reçue:", {
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
                logWithTag("LOCATION", "Position rejetée");
                return;
            }

            const { latitude, longitude, heading, speed, accuracy } = location.coords;

            // Mettre à jour la position du marker (toujours, même si le trajet n'est pas démarré)
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
            // Le marker se met toujours à jour pour afficher la position en temps réel
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
                        timeout: 15000, // 15 secondes de timeout
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
                                timeout: 10000,
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

                // Vérifier que les coordonnées sont valides
                if (isNaN(latitude) || isNaN(longitude) || !isFinite(latitude) || !isFinite(longitude)) {
                    logError("[LOCATION] Coordonnées invalides:", { latitude, longitude });
                    if (isMounted) {
                        Alert.alert(
                            "Position invalide",
                            "Impossible d'obtenir une position valide. Veuillez réessayer.",
                            [{ text: "OK", onPress: () => router.back() }]
                        );
                        setIsLoading(false);
                    }
                    return;
                }

                logWithTag("LOCATION", "Position initiale obtenue:", {
                    latitude: latitude.toFixed(6),
                    longitude: longitude.toFixed(6),
                    accuracy: accuracy?.toFixed(2),
                });

                if (isMounted) {
                    setCurrentUserLocation((prev) => ({
                        ...prev,
                        latitude,
                        longitude,
                        heading: heading ?? null,
                        speed: speed ?? null,
                        accuracy: accuracy ?? null,
                    }));

                    previousLocationRef.current = {
                        latitude,
                        longitude,
                        timestamp: initialLocation.timestamp,
                    };

                    // Centrer la carte sur la position obtenue
                    setTimeout(() => {
                        if (mapViewRef.current && isMounted) {
                            // Vérifier que les valeurs sont valides
                            if (!isNaN(latitude) && !isNaN(longitude) && isFinite(latitude) && isFinite(longitude)) {
                                try {
                                    mapViewRef.current.animateToRegion(
                                        {
                                            latitude,
                                            longitude,
                                            latitudeDelta: DEFAULT_LATITUDE_DELTA,
                                            longitudeDelta: defaultLongitudeDelta,
                                        },
                                        500
                                    );
                                    logWithTag("MAP", "Carte centrée sur la position initiale");
                                } catch (error) {
                                    logError("[MAP] Erreur lors du centrage initial:", error);
                                }
                            }
                        }
                    }, 100);

                    // Masquer le loader dès qu'on a la position initiale
                    setIsLoading(false);
                    logWithTag("LOCATION", "Loader masqué");
                }

                logWithTag("LOCATION", "Démarrage du suivi en temps réel...");

                // Démarre le suivi de position en temps réel
                try {
                    const watcher = await Location.watchPositionAsync(
                        LOCATION_CONFIG,
                        (location) => {
                            if (!isMounted) return;
                            handleLocationUpdate(location);
                        }
                    );

                    if (isMounted) {
                        locationWatcherRef.current = watcher;
                        logWithTag("LOCATION", "Suivi de position démarré");
                    } else {
                        // Si le composant est démonté, arrêter le watcher
                        watcher.remove();
                    }
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
    }, [stopTracking, handleLocationUpdate, defaultLongitudeDelta]);

    /**
     * Centre la carte sur la position actuelle
     */
    const getCurrentLocation = useCallback(() => {
        if (!mapViewRef.current) return;
        
        isUserInteractingRef.current = false;
        lastCameraUpdateRef.current = 0;

        const { latitude, longitude } = currentUserLocation;
        
        // Vérifier que les valeurs sont valides
        if (isNaN(latitude) || isNaN(longitude) || !isFinite(latitude) || !isFinite(longitude)) {
            logWithTag("MAP", "Position invalide, centrage ignoré");
            return;
        }

        try {
            mapViewRef.current.animateToRegion(
                {
                    latitude,
                    longitude,
                    latitudeDelta: zoomRef.current.latitudeDelta,
                    longitudeDelta: zoomRef.current.longitudeDelta,
                },
                300
            );
        } catch (error) {
            logError("[MAP] Erreur lors du centrage:", error);
        }
    }, [currentUserLocation.latitude, currentUserLocation.longitude]);

    /**
     * Zoom avant
     */
    const zoomIn = useCallback(() => {
        if (!mapViewRef.current) return;
        
        isUserInteractingRef.current = true;

        const newLatDelta = zoomRef.current.latitudeDelta / 2;
        const newLngDelta = zoomRef.current.longitudeDelta / 2;

        zoomRef.current = {
            latitudeDelta: newLatDelta,
            longitudeDelta: newLngDelta,
        };

        const { latitude, longitude } = currentUserLocation;
        
        // Vérifier que les valeurs sont valides
        if (isNaN(latitude) || isNaN(longitude) || !isFinite(latitude) || !isFinite(longitude)) {
            return;
        }

        try {
            mapViewRef.current.animateToRegion(
                {
                    latitude,
                    longitude,
                    latitudeDelta: newLatDelta,
                    longitudeDelta: newLngDelta,
                },
                200
            );
        } catch (error) {
            logError("[MAP] Erreur lors du zoom avant:", error);
        }

        setTimeout(() => {
            isUserInteractingRef.current = false;
        }, 5000);
    }, [currentUserLocation.latitude, currentUserLocation.longitude]);

    /**
     * Zoom arrière
     */
    const zoomOut = useCallback(() => {
        if (!mapViewRef.current) return;
        
        isUserInteractingRef.current = true;

        const newLatDelta = zoomRef.current.latitudeDelta * 1.5;
        const newLngDelta = zoomRef.current.longitudeDelta * 1.5;

        zoomRef.current = {
            latitudeDelta: newLatDelta,
            longitudeDelta: newLngDelta,
        };

        const { latitude, longitude } = currentUserLocation;
        
        // Vérifier que les valeurs sont valides
        if (isNaN(latitude) || isNaN(longitude) || !isFinite(latitude) || !isFinite(longitude)) {
            return;
        }

        try {
            mapViewRef.current.animateToRegion(
                {
                    latitude,
                    longitude,
                    latitudeDelta: newLatDelta,
                    longitudeDelta: newLngDelta,
                },
                200
            );
        } catch (error) {
            logError("[MAP] Erreur lors du zoom arrière:", error);
        }

        setTimeout(() => {
            isUserInteractingRef.current = false;
        }, 5000);
    }, [currentUserLocation.latitude, currentUserLocation.longitude]);

    /**
     * Réinitialise le zoom
     */
    const resetZoom = useCallback(() => {
        if (!mapViewRef.current) return;
        
        isUserInteractingRef.current = false;
        lastCameraUpdateRef.current = 0;

        const { latitude, longitude } = currentUserLocation;
        
        // Vérifier que les valeurs sont valides
        if (isNaN(latitude) || isNaN(longitude) || !isFinite(latitude) || !isFinite(longitude)) {
            return;
        }

        try {
            mapViewRef.current.animateCamera({
                center: {
                    latitude,
                    longitude,
                },
                pitch: 0,
                heading: 0,
                altitude: 1000,
                zoom: 15,
            });
        } catch (error) {
            logError("[MAP] Erreur lors de la réinitialisation du zoom:", error);
        }
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
        logWithTag("MAP", "Carte chargée");
        
        if (!mapViewRef.current) return;
        
        // Ne centrer que si on a une position réelle (pas la position par défaut)
        const isDefaultLocation = 
            currentUserLocation.latitude === defaultLocation.latitude &&
            currentUserLocation.longitude === defaultLocation.longitude;
        
        if (!isDefaultLocation && !isLoading) {
            const { latitude, longitude, heading } = currentUserLocation;
            
            // Vérifier que les valeurs sont valides
            if (isNaN(latitude) || isNaN(longitude) || !isFinite(latitude) || !isFinite(longitude)) {
                return;
            }

            try {
                mapViewRef.current.animateCamera({
                    center: {
                        latitude,
                        longitude,
                    },
                    pitch: 0,
                    heading: heading || 0,
                    altitude: 1000,
                    zoom: 15,
                });
            } catch (error) {
                logError("[MAP] Erreur lors du chargement de la carte:", error);
            }
        }
    }, [currentUserLocation.latitude, currentUserLocation.longitude, currentUserLocation.heading, defaultLocation.latitude, defaultLocation.longitude, isLoading]);

    /**
     * Centre automatiquement la carte quand la position est obtenue
     */
    useEffect(() => {
        if (!isLoading && mapViewRef.current) {
            // Vérifier qu'on a une position réelle (pas la position par défaut)
            const isDefaultLocation = 
                currentUserLocation.latitude === defaultLocation.latitude &&
                currentUserLocation.longitude === defaultLocation.longitude;
            
            if (!isDefaultLocation) {
                const { latitude, longitude } = currentUserLocation;
                
                // Vérifier que les valeurs sont valides
                if (isNaN(latitude) || isNaN(longitude) || !isFinite(latitude) || !isFinite(longitude)) {
                    return;
                }

                // Attendre un peu pour s'assurer que la carte est prête
                const timer = setTimeout(() => {
                    if (mapViewRef.current) {
                        try {
                            mapViewRef.current.animateToRegion(
                                {
                                    latitude,
                                    longitude,
                                    latitudeDelta: DEFAULT_LATITUDE_DELTA,
                                    longitudeDelta: defaultLongitudeDelta,
                                },
                                500
                            );
                            logWithTag("MAP", "Carte centrée automatiquement sur la position");
                        } catch (error) {
                            logError("[MAP] Erreur lors du centrage automatique:", error);
                        }
                    }
                }, 300);

                return () => clearTimeout(timer);
            }
        }
    }, [isLoading, currentUserLocation.latitude, currentUserLocation.longitude, defaultLocation.latitude, defaultLocation.longitude, defaultLongitudeDelta]);

    /**
     * Active automatiquement le suivi de la caméra si le statut est DEPARTED
     * Cela garantit que la carte suit le marker même si l'utilisateur arrive sur l'écran
     * alors que le trajet est déjà en cours
     */
    useEffect(() => {
        if (isDeparted && !isRouteStarted) {
            logWithTag("ROUTE", "Trajet déjà en cours, activation du suivi automatique");
            setIsRouteStarted(true);
            isUserInteractingRef.current = false;
            lastCameraUpdateRef.current = 0;
            // Centrer la carte sur la position actuelle
            if (mapViewRef.current && currentUserLocation) {
                const { latitude, longitude } = currentUserLocation;
                // Vérifier que les valeurs sont valides avant de centrer
                if (!isNaN(latitude) && !isNaN(longitude) && isFinite(latitude) && isFinite(longitude)) {
                    setTimeout(() => {
                        getCurrentLocation();
                    }, 300);
                }
            }
        }
    }, [isDeparted, isRouteStarted, currentUserLocation, getCurrentLocation]);

    /**
     * Ferme automatiquement le modal d'actions si le statut n'est plus SCHEDULED
     */
    useEffect(() => {
        if (!isScheduled && showActionModal) {
            setShowActionModal(false);
        }
    }, [isScheduled, showActionModal]);

    /**
     * Anime l'effet slide du modal d'actions
     */
    useEffect(() => {
        if (showActionModal) {
            // Animation d'entrée : slide depuis le bas
            Animated.spring(actionSlideAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        } else {
            // Animation de sortie : slide vers le bas
            Animated.timing(actionSlideAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [showActionModal, actionSlideAnim]);

    /**
     * Anime l'effet slide du modal de confirmation
     */
    useEffect(() => {
        if (showConfirmModal) {
            // Animation d'entrée : slide depuis le bas
            Animated.spring(slideAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        } else {
            // Animation de sortie : slide vers le bas
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [showConfirmModal, slideAnim]);

    /**
     * Gère l'action d'embarquement
     * Affiche le modal de confirmation avant d'exécuter l'action
     * L'embarquement n'est possible que si le statut est SCHEDULED
     */
    const handleBoarding = useCallback(() => {
        if (!canPerformBoarding) {
            return;
        }
        logWithTag("ROUTE", "Action d'embarquement sélectionnée");
        setShowActionModal(false);
        setPendingAction("boarding");
        setIsBoardingLoading(false);
        setShowConfirmModal(true);
    }, [canPerformBoarding]);

    /**
     * Confirme et exécute l'action d'embarquement
     */
    const confirmBoarding = useCallback(async () => {
        logWithTag("ROUTE", "Embarquement confirmé");
        setIsBoardingLoading(true);
        
        try {
            const token = await AsyncStorage.getItem("token");
            if (!token) {
                throw new Error("Token non disponible");
            }
            if (!departure?.id) {
                throw new Error("ID du départ non disponible");
            }

            console.log("[TRACK-ROUTE] ID du départ:", departure?.id);
            console.log("[TRACK-ROUTE] Token:", token);
            
            const response = await markAsStatusDepartureApi(departure?.id, token, "boarding");
            console.log("[TRACK-ROUTE] Réponse de la mise à jour du statut du départ:", response.data);
            
            // Mettre à jour l'état local du départ
            const updatedDeparture = currentDeparture ? {
                ...currentDeparture,
                status: "BOARDING",
            } : null;
            
            if (updatedDeparture) {
                setCurrentDeparture(updatedDeparture);
                
                // Émettre un événement pour notifier les autres écrans
                departureEventEmitter.emitStatusUpdate({
                    departureId: departure.id,
                    newStatus: "BOARDING",
                    departure: updatedDeparture,
                });
            }
            
            // Vérifier que la réponse contient les données attendues
            if (response.data && response.data.trip) {
                // Afficher un message de succès avec les informations du trajet
                Alert.alert(
                    "Succès",
                    `Le statut du trajet a été mis à jour avec succès.\n\n${response.data.trip}`,
                    [{ text: "OK" }]
                );
            } else {
                // Afficher un message de succès générique si les données ne sont pas présentes
                Alert.alert(
                    "Succès",
                    "Le statut du trajet a été mis à jour avec succès.",
                    [{ text: "OK" }]
                );
            }
            
            // Fermer le modal après succès
            setShowConfirmModal(false);
            setPendingAction(null);
        } catch (error) {
            logError("[TRACK-ROUTE] Erreur lors de la mise à jour du statut du départ:", error);
            console.log("[TRACK-ROUTE] Error:", (error as any)?.response?.data?.message);
            Alert.alert(
                "Erreur",
                "Une erreur est survenue lors de la mise à jour du statut. Veuillez réessayer.",
                [{ text: "OK" }]
            );
        } finally {
            setIsBoardingLoading(false);
        }

    }, [departure?.id, currentDeparture]);

    /**
     * Gère le démarrage du trajet depuis le modal
     * Affiche le modal de confirmation avant d'exécuter l'action
     * Le démarrage est possible si le statut est SCHEDULED ou BOARDING
     */
    const handleStartRouteFromModal = useCallback(() => {
        if (!canStartRoute) {
            return;
        }
        logWithTag("ROUTE", "Démarrage du trajet depuis le modal");
        setShowActionModal(false);
        setPendingAction("startRoute");
        setIsStartRouteLoading(false);
        setShowConfirmModal(true);
    }, [canStartRoute]);

    /**
     * Confirme et exécute le démarrage du trajet
     */
    const confirmStartRoute = useCallback(async () => {
        logWithTag("ROUTE", "Démarrage du trajet confirmé");
        setIsStartRouteLoading(true);
        
        try {
            const token = await AsyncStorage.getItem("token");
            if (!token) {
                throw new Error("Token non disponible");
            }
            if (!departure?.id) {
                throw new Error("ID du départ non disponible");
            }

            console.log("[TRACK-ROUTE] ID du départ:", departure?.id);
            console.log("[TRACK-ROUTE] Token:", token);
            
            const response = await markAsStatusDepartureApi(departure?.id, token, "departed");
            console.log("[TRACK-ROUTE] Réponse de la mise à jour du statut du départ:", response.data);
            
            // Mettre à jour l'état local du départ
            const updatedDeparture = currentDeparture ? {
                ...currentDeparture,
                status: "DEPARTED",
            } : null;
            
            if (updatedDeparture) {
                setCurrentDeparture(updatedDeparture);
                
                // Émettre un événement pour notifier les autres écrans
                departureEventEmitter.emitStatusUpdate({
                    departureId: departure.id,
                    newStatus: "DEPARTED",
                    departure: updatedDeparture,
                });
            }
            
            // Vérifier que la réponse contient les données attendues
            if (response.data && response.data.trip) {
                // Afficher un message de succès avec les informations du trajet
                Alert.alert(
                    "Succès",
                    `Le trajet a été démarré avec succès.\n\n${response.data.trip}`,
                    [{ text: "OK" }]
                );
            } else {
                // Afficher un message de succès générique si les données ne sont pas présentes
                Alert.alert(
                    "Succès",
                    "Le trajet a été démarré avec succès.",
                    [{ text: "OK" }]
                );
            }
            
            // Fermer le modal après succès
            setShowConfirmModal(false);
            setPendingAction(null);
            setIsRouteStarted(true);
            isUserInteractingRef.current = false;
            lastCameraUpdateRef.current = 0;
            getCurrentLocation();
        } catch (error) {
            logError("[TRACK-ROUTE] Erreur lors de la mise à jour du statut du départ:", error);
            console.log("[TRACK-ROUTE] Error:", (error as any)?.response?.data?.message);
            Alert.alert(
                "Erreur",
                "Une erreur est survenue lors du démarrage du trajet. Veuillez réessayer.",
                [{ text: "OK" }]
            );
        } finally {
            setIsStartRouteLoading(false);
        }
    }, [departure?.id, currentDeparture, getCurrentLocation]);

    /**
     * Gère la fin du trajet pour le statut DEPARTED
     * Affiche le modal de confirmation avant d'exécuter l'action
     */
    const handleFinishRoute = useCallback(() => {
        if (isArrived || !isDeparted) {
            return;
        }
        logWithTag("ROUTE", "Action de fin de trajet sélectionnée");
        setPendingAction("finishRoute");
        setIsFinishLoading(false);
        setShowConfirmModal(true);
    }, [isArrived, isDeparted]);

    /**
     * Confirme et exécute la fin du trajet
     */
    const confirmFinishRoute = useCallback(async () => {
        logWithTag("ROUTE", "Fin de trajet confirmée");
        setIsFinishLoading(true);
        
        try {
            const token = await AsyncStorage.getItem("token");
            if (!token) {
                throw new Error("Token non disponible");
            }
            if (!departure?.id) {
                throw new Error("ID du départ non disponible");
            }

            console.log("[TRACK-ROUTE] ID du départ:", departure?.id);
            console.log("[TRACK-ROUTE] Token:", token);
            
            const response = await markAsStatusDepartureApi(departure?.id, token, "arrived");
            console.log("[TRACK-ROUTE] Réponse de la mise à jour du statut du départ:", response.data);
            
            // Mettre à jour l'état local du départ
            const updatedDeparture = currentDeparture ? {
                ...currentDeparture,
                status: "ARRIVED",
            } : null;
            
            if (updatedDeparture) {
                setCurrentDeparture(updatedDeparture);
                
                // Émettre un événement pour notifier les autres écrans
                departureEventEmitter.emitStatusUpdate({
                    departureId: departure.id,
                    newStatus: "ARRIVED",
                    departure: updatedDeparture,
                });
            }
            
            // Vérifier que la réponse contient les données attendues
            if (response.data && response.data.trip) {
                // Afficher un message de succès avec les informations du trajet
                Alert.alert(
                    "Succès",
                    `Le trajet a été marqué comme terminé avec succès.\n\n${response.data.trip}`,
                    [{ text: "OK", onPress: () => router.back() }]
                );
            } else {
                // Afficher un message de succès générique si les données ne sont pas présentes
                Alert.alert(
                    "Succès",
                    "Le trajet a été marqué comme terminé avec succès.",
                    [{ text: "OK", onPress: () => router.back() }]
                );
            }
            
            // Fermer le modal après succès
            setShowConfirmModal(false);
            setPendingAction(null);
        } catch (error) {
            logError("[TRACK-ROUTE] Erreur lors de la mise à jour du statut du départ:", error);
            console.log("[TRACK-ROUTE] Error:", (error as any)?.response?.data?.message);
            Alert.alert(
                "Erreur",
                "Une erreur est survenue lors de la mise à jour du statut. Veuillez réessayer.",
                [{ text: "OK" }]
            );
        } finally {
            setIsFinishLoading(false);
        }
    }, [departure?.id, currentDeparture]);

    /**
     * Gère le démarrage/arrêt du trajet (pour les autres statuts)
     */
    const handleStartRoute = useCallback(() => {
        // Bloquer si le trajet est déjà terminé
        if (isArrived) {
            return;
        }

        if (isRouteStarted) {
            logWithTag("ROUTE", "Arrêt du trajet");
            setIsRouteStarted(false);
            isUserInteractingRef.current = false;
        } else {
            // Si le statut est SCHEDULED, afficher le modal pour choisir entre embarquement ou démarrer
            if (isScheduled) {
                setShowActionModal(true);
            } 
            // Si le statut est BOARDING, on peut démarrer directement le trajet
            else if (isBoarding) {
                // Afficher le modal de confirmation pour démarrer
                setPendingAction("startRoute");
                setIsStartRouteLoading(false);
                setShowConfirmModal(true);
            } 
            // Si le statut n'est pas DEPARTED, on peut démarrer localement
            else if (!isDeparted) {
                logWithTag("ROUTE", "Démarrage du trajet");
                setIsRouteStarted(true);
                isUserInteractingRef.current = false;
                lastCameraUpdateRef.current = 0;
                getCurrentLocation();
            }
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
        if (isBoardingLoading || isStartRouteLoading || isFinishLoading) {
            return; // Empêcher la fermeture pendant le chargement
        }
        setShowConfirmModal(false);
        setPendingAction(null);
    }, [isBoardingLoading, isStartRouteLoading, isFinishLoading]);

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
                {!isArrived && (
                    <View style={styles.floatingButtonContainer}>
                        {/* Indicateur d'embarquement */}
                        {isBoarding && !isDeparted && (
                            <View style={styles.boardingIndicator}>
                                <MaterialIcons name="directions-bus" size={18} color="#FFFFFF" />
                                <ThemedText style={styles.boardingIndicatorText}>
                                    En embarquement
                                </ThemedText>
                            </View>
                        )}
                        
                        {isDeparted ? (
                            <TouchableOpacity
                                style={[
                                    styles.floatingButton,
                                    styles.floatingButtonActive,
                                ]}
                                onPress={handleFinishRoute}
                                activeOpacity={0.8}
                            >
                                <ThemedText style={styles.floatingButtonText}>
                                    Terminer le trajet
                                </ThemedText>
                            </TouchableOpacity>
                        ) : isBoarding ? (
                            <TouchableOpacity
                                style={[
                                    styles.floatingButton,
                                    isRouteStarted && styles.floatingButtonActive,
                                ]}
                                onPress={handleStartRoute}
                                activeOpacity={0.8}
                            >
                                <ThemedText style={styles.floatingButtonText}>
                                    {isRouteStarted
                                        ? "Terminer le trajet"
                                        : "Démarrer le trajet"}
                                </ThemedText>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[
                                    styles.floatingButton,
                                    isRouteStarted && styles.floatingButtonActive,
                                    !canStartRoute && { opacity: 0.6 },
                                ]}
                                onPress={handleStartRoute}
                                activeOpacity={0.8}
                                disabled={!canStartRoute}
                            >
                                <ThemedText style={styles.floatingButtonText}>
                                    {isRouteStarted
                                        ? "Terminer le trajet"
                                        : isScheduled
                                        ? "Choisir une action"
                                        : "Démarrer le trajet"}
                                </ThemedText>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
                {isArrived && (
                    <View style={styles.floatingButtonContainer}>
                        <View
                            style={[
                                styles.floatingButton,
                                { backgroundColor: "#34C759", opacity: 0.7 },
                            ]}
                        >
                            <ThemedText style={styles.floatingButtonText}>
                                Trajet terminé
                            </ThemedText>
                        </View>
                    </View>
                )}

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
                                { backgroundColor: isDark ? "#1A1A1A" : "#FFFFFF" },
                                {
                                    transform: [
                                        {
                                            translateY: actionSlideAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [500, 0],
                                            }),
                                        },
                                    ],
                                    opacity: actionSlideAnim,
                                },
                            ]}
                            onStartShouldSetResponder={() => true}
                        >
                            {/* Handle */}
                            <View style={styles.bottomSheetHandle} />

                            <ThemedText style={[styles.bottomSheetTitle, { color: isDark ? "#FFFFFF" : "#11181C" }]}>
                                Choisir une action
                            </ThemedText>

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

                            <TouchableOpacity
                                style={[
                                    styles.bottomSheetCloseButton,
                                    { backgroundColor: isDark ? "#2C2C2E" : "#F8F8F8" },
                                ]}
                                onPress={handleCloseActionModal}
                                activeOpacity={0.8}
                            >
                                <ThemedText style={[styles.bottomSheetCloseText, { color: isDark ? "#FFFFFF" : "#11181C" }]}>
                                    Fermer
                                </ThemedText>
                            </TouchableOpacity>
                        </Animated.View>
                    </TouchableOpacity>
                </Modal>

                {/* Bottom Sheet de confirmation pour les actions */}
                <Modal
                    visible={showConfirmModal}
                    transparent
                    animationType="none"
                    onRequestClose={isBoardingLoading || isStartRouteLoading || isFinishLoading ? undefined : handleCancelConfirm}
                >
                    <TouchableOpacity
                        style={styles.bottomSheetOverlay}
                        activeOpacity={1}
                        onPress={isBoardingLoading || isStartRouteLoading || isFinishLoading ? undefined : handleCancelConfirm}
                        disabled={isBoardingLoading || isStartRouteLoading || isFinishLoading}
                    >
                        <Animated.View
                            style={[
                                styles.bottomSheetContent,
                                { backgroundColor: isDark ? "#1A1A1A" : "#FFFFFF" },
                                {
                                    transform: [
                                        {
                                            translateY: slideAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [500, 0],
                                            }),
                                        },
                                    ],
                                    opacity: slideAnim,
                                },
                            ]}
                            onStartShouldSetResponder={() => true}
                        >
                            {/* Handle */}
                            <View style={styles.bottomSheetHandle} />

                            <ThemedText style={[styles.bottomSheetTitle, { color: isDark ? "#FFFFFF" : "#11181C" }]}>
                                Confirmer l'action
                            </ThemedText>

                            <ThemedText style={[styles.bottomSheetMessage, { color: isDark ? "#CCCCCC" : "#666666" }]}>
                                {pendingAction === "boarding"
                                    ? "Êtes-vous sûr de vouloir démarrer l'embarquement ?"
                                    : pendingAction === "finishRoute"
                                    ? "Êtes-vous sûr de vouloir terminer le trajet ?"
                                    : "Êtes-vous sûr de vouloir démarrer le trajet ?"}
                            </ThemedText>

                            <View style={styles.confirmButtonsContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.bottomSheetConfirmButton,
                                        {
                                            backgroundColor:
                                                pendingAction === "boarding" 
                                                    ? "#1776BA" 
                                                    : pendingAction === "finishRoute"
                                                    ? "#E74C3C"
                                                    : "#43b860",
                                            opacity: (isBoardingLoading || isStartRouteLoading || isFinishLoading) ? 0.6 : 1,
                                        },
                                    ]}
                                    onPress={
                                        pendingAction === "boarding"
                                            ? confirmBoarding
                                            : pendingAction === "finishRoute"
                                            ? confirmFinishRoute
                                            : confirmStartRoute
                                    }
                                    activeOpacity={0.8}
                                    disabled={isBoardingLoading || isStartRouteLoading || isFinishLoading}
                                >
                                    {(isBoardingLoading && pendingAction === "boarding") || 
                                     (isStartRouteLoading && pendingAction === "startRoute") ||
                                     (isFinishLoading && pendingAction === "finishRoute") ? (
                                        <View style={styles.loaderContainer}>
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                            <ThemedText style={[styles.bottomSheetConfirmButtonText, { marginLeft: 8 }]}>
                                                Traitement...
                                            </ThemedText>
                                        </View>
                                    ) : (
                                        <ThemedText style={styles.bottomSheetConfirmButtonText}>
                                            Confirmer
                                        </ThemedText>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.bottomSheetCloseButton,
                                        { 
                                            backgroundColor: isDark ? "#2C2C2E" : "#F8F8F8",
                                            opacity: (isBoardingLoading || isStartRouteLoading || isFinishLoading) ? 0.6 : 1,
                                        },
                                    ]}
                                    onPress={handleCancelConfirm}
                                    activeOpacity={0.8}
                                    disabled={isBoardingLoading || isStartRouteLoading || isFinishLoading}
                                >
                                    <ThemedText style={[styles.bottomSheetCloseText, { color: isDark ? "#FFFFFF" : "#11181C" }]}>
                                        Annuler
                                    </ThemedText>
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