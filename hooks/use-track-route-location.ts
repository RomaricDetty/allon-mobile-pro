import { calculateDistance } from "@/utils/location";
import { logError, logWithTag } from "@/utils/logger";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { router } from "expo-router";
import {
    DEFAULT_LATITUDE_DELTA,
    LOCATION_CONFIG,
    MAX_SPEED,
    MIN_ACCURACY,
    MIN_DISTANCE_THRESHOLD,
    WARMUP_UPDATES,
    type LocationData,
} from "@/app/track-route/constants";

const isValidCoords = (lat: number, lng: number) => !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng);

/**
 * Hook de suivi de position GPS pour l'écran track-route
 * Gère permissions, position initiale, watch et filtrage des positions
 */
export function useTrackRouteLocation(defaultLongitudeDelta: number) {
    const watcherRef = useRef<Location.LocationSubscription | null>(null);
    const prevRef = useRef<{ latitude: number; longitude: number; timestamp: number } | null>(null);
    const warmUpRef = useRef(0);
    const [isWarmingUp, setIsWarmingUp] = useState(true);

    const defaultLocation = useMemo<LocationData>(
        () => ({
            ...{ latitude: 5.320357, longitude: -4.016107, latitudeDelta: DEFAULT_LATITUDE_DELTA, longitudeDelta: defaultLongitudeDelta },
            heading: null,
            speed: null,
            accuracy: null,
        }),
        [defaultLongitudeDelta]
    );

    const [location, setLocation] = useState<LocationData>(defaultLocation);
    const [isLoading, setIsLoading] = useState(true);

    const isValidLocation = useCallback(
        (loc: Location.LocationObject): boolean => {
            if (isWarmingUp && warmUpRef.current < WARMUP_UPDATES) {
                warmUpRef.current++;
                if (warmUpRef.current >= WARMUP_UPDATES) setIsWarmingUp(false);
                return true;
            }
            const { accuracy, speed } = loc.coords;
            if (accuracy != null && accuracy > MIN_ACCURACY) return false;
            if (speed != null && speed > MAX_SPEED) return false;
            if (prevRef.current) {
                const dist = calculateDistance(prevRef.current.latitude, prevRef.current.longitude, loc.coords.latitude, loc.coords.longitude);
                const timeDiff = (loc.timestamp - prevRef.current.timestamp) / 1000;
                if (dist < MIN_DISTANCE_THRESHOLD && !isWarmingUp) return false;
                if (dist / timeDiff > MAX_SPEED) return false;
            }
            return true;
        },
        [isWarmingUp]
    );

    const handleUpdate = useCallback(
        (loc: Location.LocationObject) => {
            if (!isValidLocation(loc)) return;
            const { latitude, longitude, heading, speed, accuracy } = loc.coords;
            setLocation((p) => ({ ...p, latitude, longitude, heading: heading ?? null, speed: speed ?? null, accuracy: accuracy ?? null }));
            prevRef.current = { latitude, longitude, timestamp: loc.timestamp };
        },
        [isValidLocation]
    );

    const stopTracking = useCallback(() => {
        if (watcherRef.current) {
            watcherRef.current.remove();
            watcherRef.current = null;
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                let { status } = await Location.getForegroundPermissionsAsync();
                if (status !== "granted") status = (await Location.requestForegroundPermissionsAsync()).status;
                if (status !== "granted") {
                    if (mounted) {
                        Alert.alert("Permission refusée", "L'accès à la localisation est nécessaire pour suivre le trajet.", [{ text: "OK", onPress: () => router.back() }]);
                        setIsLoading(false);
                    }
                    return;
                }
                if (Platform.OS === "android" && !(await Location.hasServicesEnabledAsync())) {
                    if (mounted) {
                        Alert.alert("Localisation désactivée", "Veuillez activer les services de localisation (GPS).", [{ text: "OK", onPress: () => router.back() }]);
                        setIsLoading(false);
                    }
                    return;
                }
                let initial: Location.LocationObject | null = null;
                try {
                    initial = await Promise.race([
                        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }),
                        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Timeout")), 15000)),
                    ]);
                } catch (e: any) {
                    if (e?.message === "Timeout" || e?.code === "TIMEOUT") {
                        try {
                            initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                        } catch {
                            if (mounted) Alert.alert("Impossible d'obtenir la position", "Vérifiez le GPS.", [{ text: "OK", onPress: () => router.back() }]);
                        }
                    } else if (mounted) Alert.alert("Erreur de localisation", "Une erreur est survenue.", [{ text: "OK", onPress: () => router.back() }]);
                    if (mounted) setIsLoading(false);
                    return;
                }
                if (!initial || !mounted) {
                    if (mounted) setIsLoading(false);
                    return;
                }
                const { latitude, longitude, heading, speed, accuracy } = initial.coords;
                if (!isValidCoords(latitude, longitude)) {
                    if (mounted) Alert.alert("Position invalide", "Impossible d'obtenir une position valide.", [{ text: "OK", onPress: () => router.back() }]);
                    if (mounted) setIsLoading(false);
                    return;
                }
                if (mounted) {
                    setLocation((p) => ({ ...p, latitude, longitude, heading: heading ?? null, speed: speed ?? null, accuracy: accuracy ?? null }));
                    prevRef.current = { latitude, longitude, timestamp: initial.timestamp };
                    setIsLoading(false);
                }
                const watcher = await Location.watchPositionAsync(LOCATION_CONFIG, (l) => mounted && handleUpdate(l));
                if (mounted) watcherRef.current = watcher;
                else watcher.remove();
            } catch (err) {
                logError("[LOCATION]", err);
                if (mounted) Alert.alert("Erreur", "Une erreur est survenue lors de l'accès à la localisation.", [{ text: "OK", onPress: () => router.back() }]);
                if (mounted) setIsLoading(false);
            }
        })();
        return () => {
            mounted = false;
            stopTracking();
        };
    }, [defaultLongitudeDelta, stopTracking, handleUpdate]);

    return { location, setLocation, isLoading, defaultLocation, stopTracking, isValidCoords };
}
