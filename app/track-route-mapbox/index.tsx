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
import { ActivityIndicator, Animated, Image, StyleSheet, View, Alert } from "react-native";
import { getMapboxAccessToken } from "./constants";
import { socketService, locationTrackingService } from "@/services";
import * as Location from "expo-location";

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
    const [socketConnected, setSocketConnected] = useState(false);
    const trackingInitializedRef = useRef(false);

    useEffect(() => {
        try {
            setAccessToken(getMapboxAccessToken());
        } catch {
            // Token déjà défini par le plugin natif
        }
    }, []);

    /**
     * Initialiser et maintenir la connexion Socket.IO
     * La connexion reste active même si on quitte l'écran
     */
    useEffect(() => {
        const initSocket = async () => {
            try {
                if (!socketService.connected) {
                    await socketService.connect();
                    setSocketConnected(true);
                    console.log('[TrackRoute] Socket connecté');
                } else {
                    // Socket déjà connecté (retour sur l'écran)
                    setSocketConnected(true);
                    console.log('[TrackRoute] Socket déjà connecté');
                }
            } catch (error) {
                console.error('[TrackRoute] Erreur connexion socket:', error);
                setSocketConnected(false);
            }
        };

        initSocket();

        // Écouter les événements de connexion
        const unsubscribeSuccess = socketService.on('connection:success', () => {
            setSocketConnected(true);
            console.log('[TrackRoute] Socket reconnecté');
        });

        const unsubscribeLost = socketService.on('connection:lost', () => {
            setSocketConnected(false);
            console.warn('[TrackRoute] Socket déconnecté');
            
            // Tenter une reconnexion après 2 secondes
            setTimeout(() => {
                if (!socketService.connected) {
                    console.log('[TrackRoute] Tentative de reconnexion...');
                    socketService.connect().catch((err: unknown) => {
                        console.error('[TrackRoute] Échec reconnexion:', err);
                    });
                }
            }, 2000);
        });

        const unsubscribeError = socketService.on('connection:error', (data: any) => {
            console.error('[TrackRoute] Erreur socket:', data.error);
        });

        return () => {
            unsubscribeSuccess();
            unsubscribeLost();
            unsubscribeError();
            // NE PAS déconnecter le socket ici pour maintenir le tracking
            // socketService.disconnect(); 
        };
    }, []);

    /**
     * Démarrer le tracking GPS et Socket.IO quand le trajet démarre
     * Le tracking continue même si on quitte l'écran
     */
    useEffect(() => {
        const startTracking = async () => {
            // Vérifier si le tracking est déjà actif (retour sur l'écran)
            const isAlreadyTracking = locationTrackingService.tracking;
            
            if (departure.isRouteStarted && departure.departure) {
                const busId = departure.departure.id;
                
                if (!busId) {
                    console.error('[TrackRoute] Bus ID manquant');
                    return;
                }

                // Si le tracking est déjà actif pour ce bus, ne rien faire
                if (isAlreadyTracking && locationTrackingService.activeBusId === String(busId)) {
                    console.log('[TrackRoute] Tracking déjà actif pour le bus:', busId);
                    trackingInitializedRef.current = true;
                    return;
                }

                // Si le tracking n'est pas encore initialisé
                if (!trackingInitializedRef.current) {
                    try {
                        // Vérifier les permissions
                        const hasPermission = await locationTrackingService.hasPermissions();
                        if (!hasPermission) {
                            const granted = await locationTrackingService.requestPermissions();
                            if (!granted) {
                                Alert.alert(
                                    'Permission requise',
                                    'L\'application a besoin d\'accéder à votre position pour partager votre trajet en temps réel.'
                                );
                                return;
                            }
                        }

                        // Vérifier la connexion socket
                        if (!socketService.connected) {
                            console.log('[TrackRoute] Connexion socket avant tracking...');
                            await socketService.connect();
                        }

                        // Démarrer le tracking
                        const success = await locationTrackingService.startTracking({
                            busId: String(busId),
                            accuracy: Location.Accuracy.BestForNavigation,
                            distanceInterval: 10, // Envoyer tous les 10 mètres
                            timeInterval: 5000, // Ou toutes les 5 secondes
                        });

                        if (success) {
                            trackingInitializedRef.current = true;
                            console.log('[TrackRoute] Tracking démarré pour le bus:', busId);
                        } else {
                            Alert.alert(
                                'Erreur',
                                'Impossible de démarrer le partage de position. Vérifiez vos paramètres de localisation.'
                            );
                        }
                    } catch (error) {
                        console.error('[TrackRoute] Erreur démarrage tracking:', error);
                        Alert.alert(
                            'Erreur',
                            'Une erreur est survenue lors du démarrage du tracking.'
                        );
                    }
                }
            }
        };

        startTracking();
    }, [departure.isRouteStarted, departure.departure]);

    /**
     * Arrêter le tracking UNIQUEMENT quand le trajet est terminé
     * NE PAS arrêter quand on quitte l'écran pour maintenir le tracking en arrière-plan
     */
    useEffect(() => {
        if (departure.status.isArrived && trackingInitializedRef.current) {
            locationTrackingService.stopTracking();
            trackingInitializedRef.current = false;
            console.log('[TrackRoute] Tracking arrêté (trajet terminé)');
            
            // Optionnel : déconnecter le socket après un délai
            setTimeout(() => {
                if (!locationTrackingService.tracking) {
                    socketService.disconnect();
                    console.log('[TrackRoute] Socket déconnecté (trajet terminé)');
                }
            }, 5000);
        }
    }, [departure.status.isArrived]);

    /**
     * Synchroniser l'état de l'indicateur avec le tracking réel
     */
    useEffect(() => {
        // Vérifier périodiquement l'état du tracking
        const interval = setInterval(() => {
            const isTracking = locationTrackingService.tracking;
            const isConnected = socketService.connected;
            
            if (isTracking !== trackingInitializedRef.current) {
                trackingInitializedRef.current = isTracking;
            }
            
            if (isConnected !== socketConnected) {
                setSocketConnected(isConnected);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [socketConnected]);

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
        // Arrêter uniquement le tracking GPS local de l'écran
        stopTracking();
        
        // NE PAS arrêter le tracking Socket.IO pour maintenir le partage de position
        // Le tracking continue en arrière-plan
        console.log('[TrackRoute] Retour - Tracking Socket.IO maintenu en arrière-plan');
        
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
        const from = trip?.stationFrom?.coordinate;
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
                {/* Indicateur de tracking actif */}
                {(trackingInitializedRef.current || locationTrackingService.tracking) && (
                    <View style={[trackingIndicatorStyles.container, { backgroundColor: colors.modalBg }]}>
                        <View style={[trackingIndicatorStyles.dot, { backgroundColor: socketConnected ? '#4CAF50' : '#FF9800' }]} />
                        <ThemedText style={[trackingIndicatorStyles.text, { color: colors.modalText }]}>
                            {socketConnected ? 'Position partagée en temps réel' : 'Reconnexion...'}
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

const trackingIndicatorStyles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
    },
    text: {
        fontSize: 14,
        fontWeight: '500',
    },
});
