import { useTrackRouteLocation } from "@/hooks/use-track-route-location";
import { useTrackRouteMapMapbox } from "@/hooks/use-track-route-map-mapbox";
import { useTrackRouteDeparture } from "@/hooks/use-track-route-departure";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDimensions } from "@/hooks/use-dimensions";
import { ActionModal, ConfirmModal, MapControls } from "@/components/track-route";
import UserMarkerMapbox from "@/components/map/user-marker-mapbox";
import { styles } from "@/styles/track-route";
import { DEFAULT_LATITUDE_DELTA } from "@/app/track-route/constants";
import { getMapboxAccessToken } from "./constants";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Animated, View } from "react-native";
import { MapView, Camera, setAccessToken } from "@rnmapbox/maps";
import { ThemedText } from "@/components/themed-text";

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

    if (!departure.departure) return null;

    const centerCoord = map.toMapboxPosition(location.latitude, location.longitude);

    /** Ne contrôle la caméra par props qu’en mode suivi pour permettre le pan sinon */
    const cameraCenter = departure.isRouteStarted ? centerCoord : undefined;

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
