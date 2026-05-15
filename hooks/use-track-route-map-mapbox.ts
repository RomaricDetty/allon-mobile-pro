import { logError } from "@/utils/logger";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LocationData } from "@/app/track-route/constants";
import type { CameraRef } from "@rnmapbox/maps";

/** Convertit (lat, lng) en Position Mapbox [lng, lat] */
export function toMapboxPosition(lat: number, lng: number): [number, number] {
    return [lng, lat];
}

const DEFAULT_ZOOM = 15;
/** Zoom utilisé en mode navigation (recentrage bus + cap itinéraire). */
const NAVIGATION_ZOOM = 16.5;
const MIN_ZOOM = 10;
const MAX_ZOOM = 20;

/**
 * Hook de gestion de la carte Mapbox pour l'écran track-route-mapbox
 * Utilise Camera ref, centerCoordinate [lng, lat], zoomLevel, heading
 */
export function useTrackRouteMapMapbox(
    location: LocationData,
    isValidCoordinates: (lat: number, lng: number) => boolean
) {
    const cameraRef = useRef<CameraRef>(null);
    const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
    const isInteractingRef = useRef(false);
    const lastCameraRef = useRef(0);
    const defaultLoc = { latitude: 5.320357, longitude: -4.016107 };

    const updateCamera = useCallback(
        (lat: number, lng: number, heading: number | null) => {
            if (isInteractingRef.current || !cameraRef.current || !isValidCoordinates(lat, lng)) return;
            const now = Date.now();
            if (now - lastCameraRef.current < 500) return;
            lastCameraRef.current = now;
            try {
                cameraRef.current.setCamera({
                    centerCoordinate: toMapboxPosition(lat, lng),
                    heading: heading ?? 0,
                    animationDuration: 500,
                });
            } catch (e) {
                logError("[MAPBOX]", e);
            }
        },
        [isValidCoordinates]
    );

    const centerMap = useCallback(() => {
        if (!cameraRef.current || !isValidCoordinates(location.latitude, location.longitude)) return;
        isInteractingRef.current = false;
        lastCameraRef.current = 0;
        try {
            cameraRef.current.moveTo(toMapboxPosition(location.latitude, location.longitude), 300);
        } catch (e) {
            logError("[MAPBOX]", e);
        }
    }, [location.latitude, location.longitude, isValidCoordinates]);

    const handleZoom = useCallback(
        (delta: number) => {
            if (!cameraRef.current || !isValidCoordinates(location.latitude, location.longitude)) return;
            isInteractingRef.current = true;
            const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
            setZoomLevel(next);
            try {
                cameraRef.current.zoomTo(next, 200);
            } catch (e) {
                logError("[MAPBOX]", e);
            }
            setTimeout(() => { isInteractingRef.current = false; }, 5000);
        },
        [location.latitude, location.longitude, zoomLevel, isValidCoordinates]
    );

    const resetZoom = useCallback(() => {
        if (!cameraRef.current || !isValidCoordinates(location.latitude, location.longitude)) return;
        isInteractingRef.current = false;
        lastCameraRef.current = 0;
        setZoomLevel(DEFAULT_ZOOM);
        try {
            cameraRef.current.setCamera({
                centerCoordinate: toMapboxPosition(location.latitude, location.longitude),
                zoomLevel: DEFAULT_ZOOM,
                heading: location.heading ?? 0,
                animationDuration: 300,
            });
        } catch (e) {
            logError("[MAPBOX]", e);
        }
    }, [location, isValidCoordinates]);

    /**
     * Recentre la carte sur le bus, aligne le cap sur l’itinéraire et reprend le suivi automatique.
     */
    const recenterOnBus = useCallback(
        (lat: number, lng: number, heading: number) => {
            if (!cameraRef.current || !isValidCoordinates(lat, lng)) return;
            isInteractingRef.current = false;
            lastCameraRef.current = 0;
            setZoomLevel(NAVIGATION_ZOOM);
            try {
                cameraRef.current.setCamera({
                    centerCoordinate: toMapboxPosition(lat, lng),
                    zoomLevel: NAVIGATION_ZOOM,
                    heading,
                    animationDuration: 400,
                });
            } catch (e) {
                logError("[MAPBOX]", e);
            }
        },
        [isValidCoordinates]
    );

    const onCameraChanged = useCallback((state: { properties: { zoom: number } }) => {
        setZoomLevel(state.properties.zoom);
    }, []);

    const onRegionChangeStart = useCallback(() => { isInteractingRef.current = true; }, []);

    /** Détecte un déplacement manuel de la carte (pan / pinch / rotation). */
    const onRegionWillChange = useCallback(
        (feature: { properties?: { isUserInteraction?: boolean } }) => {
            if (feature.properties?.isUserInteraction) {
                isInteractingRef.current = true;
            }
        },
        []
    );

    const onRegionChangeComplete = useCallback(() => {
        setTimeout(() => { isInteractingRef.current = false; }, 5000);
    }, []);

    const onMapLoaded = useCallback(() => {
        if (!cameraRef.current || location.latitude === defaultLoc.latitude) return;
        if (!isValidCoordinates(location.latitude, location.longitude)) return;
        try {
            cameraRef.current.setCamera({
                centerCoordinate: toMapboxPosition(location.latitude, location.longitude),
                zoomLevel: DEFAULT_ZOOM,
                heading: location.heading ?? 0,
            });
        } catch (e) {
            logError("[MAPBOX]", e);
        }
    }, [location, isValidCoordinates]);

    return {
        cameraRef,
        zoomLevel,
        isInteractingRef,
        lastCameraRef,
        getCurrentLocation: centerMap,
        zoomIn: () => handleZoom(1),
        zoomOut: () => handleZoom(-1),
        resetZoom,
        recenterOnBus,
        updateCameraPosition: updateCamera,
        onCameraChanged,
        onRegionChangeStart,
        onRegionWillChange,
        onRegionChangeComplete,
        onMapLoaded,
        toMapboxPosition,
    };
}
