import { DEFAULT_LATITUDE_DELTA } from "@/app/track-route/constants";
import UserMarkerMapbox from "@/components/map/user-marker-mapbox";
import { ThemedText } from "@/components/themed-text";
import { ActionModal, ConfirmModal, MapControls } from "@/components/track-route";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDimensions } from "@/hooks/use-dimensions";
import { useTrackRouteDeparture } from "@/hooks/use-track-route-departure";
import { useTrackRouteLocation } from "@/hooks/use-track-route-location";
import { useTrackRouteMapMapbox } from "@/hooks/use-track-route-map-mapbox";
import { styles } from "@/styles/track-route";
import { Camera, LineLayer, MapView, MarkerView, setAccessToken, ShapeSource } from "@rnmapbox/maps";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, StyleSheet, View } from "react-native";
import { getMapboxAccessToken } from "./constants";

/** Écran de suivi de trajet avec Mapbox – position du conducteur en temps réel */
export default function TrackRouteMapboxScreen() {
    const isDark = useColorScheme() === "dark";
    const dimensions = useDimensions();
    const defaultLongitudeDelta = useMemo(
        () => DEFAULT_LATITUDE_DELTA * (dimensions.width / dimensions.height),
        [dimensions.width, dimensions.height]
    );

    const { location, isLoading, defaultLocation, stopTracking, isValidCoords } =
        useTrackRouteLocation(defaultLongitudeDelta);
    const map = useTrackRouteMapMapbox(location, isValidCoords);
    const departure = useTrackRouteDeparture(
        map.getCurrentLocation,
        map.isInteractingRef,
        map.lastCameraRef
    );

    const slideAnim = useRef(new Animated.Value(0)).current;
    const actionSlideAnim = useRef(new Animated.Value(0)).current;
    const [routeCoordinates, setRouteCoordinates] = useState<[number, number][] | null>(null);
    const [routeLoading, setRouteLoading] = useState(false);

    useEffect(() => {
        try {
            setAccessToken(getMapboxAccessToken());
        } catch {
            // Token déjà défini par le plugin natif
        }
    }, []);

    const colors = useMemo(
        () => ({
            iconCircleBg: isDark ? "#2C2C2E" : "#F8F8F8",
            primaryText: isDark ? "#FFFFFF" : "#11181C",
            modalBg: isDark ? "#1A1A1A" : "#FFFFFF",
            modalText: isDark ? "#FFFFFF" : "#11181C",
            modalMessage: isDark ? "#CCCCCC" : "#666666",
            closeButtonBg: isDark ? "#2C2C2E" : "#F8F8F8",
        }),
        [isDark]
    );

    const handleBack = useCallback(() => {
        stopTracking();
        router.back();
    }, [stopTracking]);

    useEffect(() => {
        if (departure.isRouteStarted && location)
            map.updateCameraPosition(location.latitude, location.longitude, location.heading);
    }, [departure.isRouteStarted, location.latitude, location.longitude, location.heading, map.updateCameraPosition]);

    useEffect(() => {
        if (!isLoading && location.latitude !== defaultLocation.latitude)
            setTimeout(() => map.getCurrentLocation(), 100);
    }, [isLoading, location.latitude, defaultLocation.latitude, map.getCurrentLocation]);

    useEffect(() => {
        if (departure.status.isDeparted && !departure.isRouteStarted)
            setTimeout(() => map.getCurrentLocation(), 300);
    }, [departure.status.isDeparted, departure.isRouteStarted]);

    useEffect(() => {
        if (!departure.departure) router.back();
    }, [departure.departure]);

    /** Récupère l'itinéraire routier (routes praticables) via l'API Mapbox Directions */
    const trip = departure.departure?.trip;
    const fromCoord = useMemo((): [number, number] | null => {
        const from = trip?.coordinate;
        if (!from) return null;
        const lat = typeof from.latitude === "number" ? from.latitude : Number(from.latitude);
        const lng = typeof from.longitude === "number" ? from.longitude : Number(from.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
        return [lng, lat];
    }, [trip?.stationFrom?.coordinate]);
    const toCoord = useMemo((): [number, number] | null => {
        const to = trip?.stationTo?.coordinate;
        if (!to) return null;
        const lat = typeof to.latitude === "number" ? to.latitude : Number(to.latitude);
        const lng = typeof to.longitude === "number" ? to.longitude : Number(to.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
        return [lng, lat];
    }, [trip?.stationTo?.coordinate]);

    useEffect(() => {
        if (!fromCoord || !toCoord) {
            setRouteCoordinates(null);
            return;
        }
        let cancelled = false;
        setRouteLoading(true);
        setRouteCoordinates(null);
        const token = getMapboxAccessToken();
        const coords = `${fromCoord[0]},${fromCoord[1]};${toCoord[0]},${toCoord[1]}`;
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${token}`;
        fetch(url)
            .then((res) => res.json())
            .then((data: { routes?: { geometry?: { coordinates?: [number, number][] } }[] }) => {
                if (cancelled) return;
                const coordsRoute = data.routes?.[0]?.geometry?.coordinates;
                if (Array.isArray(coordsRoute) && coordsRoute.length >= 2) {
                    setRouteCoordinates(coordsRoute);
                }
            })
            .catch(() => {
                if (!cancelled) setRouteCoordinates(null);
            })
            .finally(() => {
                if (!cancelled) setRouteLoading(false);
            });
        return () => { cancelled = true; };
    }, [fromCoord?.[0], fromCoord?.[1], toCoord?.[0], toCoord?.[1]]);

    const centerCoord = map.toMapboxPosition(location.latitude, location.longitude);

    /** Ne contrôle la caméra par props qu’en mode suivi pour permettre le pan sinon */
    const routeShape = useMemo(() => {
        const coords = routeCoordinates && routeCoordinates.length >= 2
            ? routeCoordinates
            : fromCoord && toCoord
                ? [fromCoord, toCoord]
                : null;
        if (!coords) return null;
        return {
            type: "FeatureCollection" as const,
            features: [{
                type: "Feature" as const,
                properties: {},
                geometry: {
                    type: "LineString" as const,
                    coordinates: coords,
                },
            }],
        };
    }, [routeCoordinates, fromCoord, toCoord]);
    const cameraCenter = departure.departure && departure.isRouteStarted ? centerCoord : undefined;

    if (!departure.departure) return null;

    return (
        <View style={[styles.container, { backgroundColor: isDark ? "#000000" : "#F3F3F7" }]}>
            <View style={styles.mapContainer}>
                <MapControls
                    onLocate={map.getCurrentLocation}
                    onResetZoom={map.resetZoom}
                    onZoomIn={map.zoomIn}
                    onZoomOut={map.zoomOut}
                    onBack={handleBack}
                    iconBg={colors.iconCircleBg}
                    textColor={colors.primaryText}
                    isBoarding={departure.status.isBoarding}
                    isDeparted={departure.status.isDeparted}
                    isArrived={departure.status.isArrived}
                    isRouteStarted={departure.isRouteStarted}
                    isScheduled={departure.status.isScheduled}
                    canStartRoute={departure.canStartRoute}
                    onMainAction={departure.handleStartRoute}
                    onFinishRoute={departure.handleFinishRoute}
                />
                {isLoading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#1776BA" />
                        <ThemedText style={styles.loadingText}>
                            Récupération de la position...
                        </ThemedText>
                    </View>
                )}
                <MapView
                    style={styles.map}
                    styleURL={undefined}
                    onDidFinishLoadingMap={map.onMapLoaded}
                    onCameraChanged={map.onCameraChanged}
                    onRegionWillChange={map.onRegionChangeStart}
                    onRegionDidChange={map.onRegionChangeComplete}
                    rotateEnabled
                    pitchEnabled={false}
                    zoomEnabled
                    scrollEnabled
                >
                    <Camera
                        ref={map.cameraRef}
                        centerCoordinate={cameraCenter}
                        zoomLevel={map.zoomLevel}
                        defaultSettings={{
                            centerCoordinate: centerCoord,
                            zoomLevel: 15,
                            heading: location.heading ?? 0,
                        }}
                    />
                    {routeShape && (
                        <ShapeSource id="route-source" shape={routeShape}>
                            <LineLayer
                                id="route-line"
                                style={{
                                    lineColor: "#1776BA",
                                    lineWidth: 4,
                                    lineCap: "round",
                                    lineJoin: "round",
                                }}
                            />
                        </ShapeSource>
                    )}
                    {fromCoord && (
                        <MarkerView coordinate={fromCoord} anchor={{ x: 0.5, y: 1 }} allowOverlap>
                            <Image source={require("@/assets/images/flag-start.png")} style={routeMarkerStyles.flag} resizeMode="contain" />
                        </MarkerView>
                    )}
                    {toCoord && (
                        <MarkerView coordinate={toCoord} anchor={{ x: 0.5, y: 1 }} allowOverlap>
                            <Image source={require("@/assets/images/flag-end.png")} style={routeMarkerStyles.flag} resizeMode="contain" />
                        </MarkerView>
                    )}
                    <UserMarkerMapbox coordinate={centerCoord} heading={location.heading} />
                </MapView>
                <ActionModal
                    visible={departure.showActionModal && departure.status.isScheduled}
                    onClose={departure.handleCloseActionModal}
                    slideAnim={actionSlideAnim}
                    canPerformBoarding={departure.canPerformBoarding}
                    canStartRoute={departure.canStartRoute}
                    onBoarding={departure.handleBoarding}
                    onStartRoute={departure.handleStartFromModal}
                    colors={colors}
                />
                <ConfirmModal
                    visible={departure.showConfirmModal}
                    pendingAction={departure.pendingAction}
                    loadingAction={departure.loadingAction}
                    messages={departure.confirmationMessages}
                    actionColors={departure.actionColors}
                    onConfirm={departure.confirmAction}
                    onCancel={departure.handleCancelConfirm}
                    slideAnim={slideAnim}
                    colors={colors}
                />
            </View>
        </View>
    );
}

const routeMarkerStyles = StyleSheet.create({
    flag: { width: 36, height: 36 },
});
