import { logError } from "@/utils/logger";
import { useCallback, useEffect, useRef } from "react";
import type { Region } from "react-native-maps";
import MapView from "react-native-maps";
import { DEFAULT_LATITUDE_DELTA } from "@/app/track-route/constants";
import type { LocationData } from "@/app/track-route/constants";

const zoomFromDelta = (d: number) => Math.max(10, Math.min(20, Math.log2(360 / d)));

/**
 * Hook de gestion de la carte pour l'écran track-route
 * Caméra, zoom, région et centrage sur la position
 */
export function useTrackRouteMap(location: LocationData, defaultLongitudeDelta: number, isValidCoordinates: (lat: number, lng: number) => boolean) {
    const mapViewRef = useRef<MapView>(null);
    const zoomRef = useRef({ latitudeDelta: DEFAULT_LATITUDE_DELTA, longitudeDelta: defaultLongitudeDelta });
    const isInteractingRef = useRef(false);
    const lastCameraRef = useRef(0);
    const defaultLoc = { latitude: 5.320357, longitude: -4.016107 };

    useEffect(() => {
        zoomRef.current.longitudeDelta = defaultLongitudeDelta;
    }, [defaultLongitudeDelta]);

    const updateCamera = useCallback(
        (lat: number, lng: number, heading: number | null) => {
            if (isInteractingRef.current || !mapViewRef.current || !isValidCoordinates(lat, lng)) return;
            const now = Date.now();
            if (now - lastCameraRef.current < 500) return;
            lastCameraRef.current = now;
            try {
                const zoom = zoomFromDelta(zoomRef.current.latitudeDelta);
                if (heading != null && heading >= 0)
                    mapViewRef.current.animateCamera({ center: { latitude: lat, longitude: lng }, heading, zoom }, { duration: 500 });
                else mapViewRef.current.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: zoomRef.current.latitudeDelta, longitudeDelta: zoomRef.current.longitudeDelta }, 500);
            } catch (e) {
                logError("[MAP]", e);
            }
        },
        [isValidCoordinates]
    );

    const centerMap = useCallback(() => {
        if (!mapViewRef.current || !isValidCoordinates(location.latitude, location.longitude)) return;
        isInteractingRef.current = false;
        lastCameraRef.current = 0;
        try {
            mapViewRef.current.animateToRegion({ ...location, latitudeDelta: zoomRef.current.latitudeDelta, longitudeDelta: zoomRef.current.longitudeDelta }, 300);
        } catch (e) {
            logError("[MAP]", e);
        }
    }, [location.latitude, location.longitude, location, isValidCoordinates]);

    const handleZoom = useCallback(
        (factor: number) => {
            if (!mapViewRef.current || !isValidCoordinates(location.latitude, location.longitude)) return;
            isInteractingRef.current = true;
            const nLat = zoomRef.current.latitudeDelta * factor;
            const nLng = zoomRef.current.longitudeDelta * factor;
            zoomRef.current = { latitudeDelta: nLat, longitudeDelta: nLng };
            try {
                mapViewRef.current.animateToRegion({ ...location, latitudeDelta: nLat, longitudeDelta: nLng }, 200);
            } catch (e) {
                logError("[MAP]", e);
            }
            setTimeout(() => { isInteractingRef.current = false; }, 5000);
        },
        [location, isValidCoordinates]
    );

    const resetZoom = useCallback(() => {
        if (!mapViewRef.current || !isValidCoordinates(location.latitude, location.longitude)) return;
        isInteractingRef.current = false;
        lastCameraRef.current = 0;
        try {
            mapViewRef.current.animateCamera({ center: { latitude: location.latitude, longitude: location.longitude }, pitch: 0, heading: 0, altitude: 1000, zoom: 15 });
        } catch (e) {
            logError("[MAP]", e);
        }
    }, [location.latitude, location.longitude, isValidCoordinates]);

    const onRegionChange = useCallback((r: Region) => {
        zoomRef.current = { latitudeDelta: r.latitudeDelta, longitudeDelta: r.longitudeDelta };
    }, []);
    const onRegionChangeStart = useCallback(() => { isInteractingRef.current = true; }, []);
    const onRegionChangeComplete = useCallback((r: Region) => {
        zoomRef.current = { latitudeDelta: r.latitudeDelta, longitudeDelta: r.longitudeDelta };
        setTimeout(() => { isInteractingRef.current = false; }, 5000);
    }, []);

    const onMapLoaded = useCallback(() => {
        if (!mapViewRef.current || location.latitude === defaultLoc.latitude) return;
        if (!isValidCoordinates(location.latitude, location.longitude)) return;
        try {
            mapViewRef.current.animateCamera({ center: { latitude: location.latitude, longitude: location.longitude }, pitch: 0, heading: location.heading || 0, altitude: 1000, zoom: 15 });
        } catch (e) {
            logError("[MAP]", e);
        }
    }, [location, isValidCoordinates]);

    return {
        mapViewRef,
        zoomRef,
        isInteractingRef,
        lastCameraRef,
        getCurrentLocation: centerMap,
        zoomIn: () => handleZoom(0.5),
        zoomOut: () => handleZoom(1.5),
        resetZoom,
        updateCameraPosition: updateCamera,
        onRegionChange,
        onRegionChangeStart,
        onRegionChangeComplete,
        onMapLoaded,
    };
}
