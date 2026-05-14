import { DEFAULT_LATITUDE_DELTA } from "@/app/track-route/constants";
import UserMarkerMapbox from "@/components/map/user-marker-mapbox";
import { ThemedText } from "@/components/themed-text";
import { ActionModal, ConfirmModal, MapControls } from "@/components/track-route";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDimensions } from "@/hooks/use-dimensions";
import { useTrackRouteDeparture } from "@/hooks/use-track-route-departure";
import { useTrackRouteLocation } from "@/hooks/use-track-route-location";
import { useTrackRouteMapMapbox } from "@/hooks/use-track-route-map-mapbox";
import { locationTrackingService, socketService } from "@/services";
import { styles } from "@/styles/track-route";
import { performPreTrackingChecks, showPermissionGuide } from "@/utils/permission-helper";
import { logError } from "@/utils/logger";
import { bearingAlongPolylineNearPoint, calculateDistance, prependPointIfFarFromPolylineStart } from "@/utils/location";
import { getRouteCoordinates, getTripEndpointCoords, resolveTripForRouting } from "@/utils/route-calculator";
import { Camera, LineLayer, MapView, MarkerView, setAccessToken, ShapeSource } from "@rnmapbox/maps";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Image, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMapboxAccessToken } from "./constants";

/** Écart max. (m) entre le bus et le 1er point de la ligne : on préfixe la position GPS pour l’affichage. */
const ROUTE_POLYLINE_JOIN_GAP_M = 40;
/** Déplacement minimum (m) depuis l’origine du dernier tracé pour relancer Mapbox Directions. */
const ROUTE_ORIGIN_RECALC_METERS = 75;
/** Si l’origine était la station, recalcul dès que le bus est à ce délà (m) du point station. */
const ROUTE_LEAVE_STATION_METERS = 40;

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
    /** Évite de rappeler fitBounds à chaque rendu une fois l’itinéraire cadré. */
    const didFitRouteBoundsRef = useRef(false);
    /** Permet un second cadrage quand l’API Directions remplace une ligne provisoire (2 pts) par le tracé complet. */
    const lastFittedPointCountRef = useRef(0);
    /** Origine utilisée pour le dernier appel Directions (station ou GPS), mise à jour quand le bus s’éloigne assez. */
    const [routeFetchOrigin, setRouteFetchOrigin] = useState<[number, number] | null>(null);

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
            console.log('[TrackRoute] Vérification conditions de tracking:', {
                isRouteStarted: departure.isRouteStarted,
                hasDeparture: !!departure.departure,
                departureId: departure.departure?.id,
                departureStatus: departure.departure?.status,
                trackingInitialized: trackingInitializedRef.current,
            });

            // Vérifier si le tracking est déjà actif (retour sur l'écran)
            const isAlreadyTracking = locationTrackingService.tracking;
            console.log('[TrackRoute] État tracking service:', {
                isAlreadyTracking,
                activeBusId: locationTrackingService.activeBusId,
            });
            
            if (!departure.isRouteStarted || !departure.departure) {
                console.log('[TrackRoute] Conditions non remplies pour démarrer le tracking:', {
                    isRouteStarted: departure.isRouteStarted,
                    hasDeparture: !!departure.departure,
                    departureStatus: departure.departure?.status,
                    reason: !departure.isRouteStarted 
                        ? 'Route pas encore démarrée - Cliquez sur le bouton "Démarrer" pour commencer le tracking' 
                        : 'Pas de données de départ',
                });
                return;
            }

            console.log('[TrackRoute] Conditions remplies: isRouteStarted=true, démarrage du tracking...');
            
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
                        console.log('[TrackRoute] Initialisation du tracking pour le bus:', busId);
                        
                        // Vérification complète pré-tracking (GPS + permissions)
                        console.log('[TrackRoute] Vérification complète des prérequis...');
                        const preCheck = await performPreTrackingChecks();
                        
                        if (!preCheck.success) {
                            console.error('[TrackRoute] Vérification échouée:', preCheck.message);
                            Alert.alert(
                                'Configuration requise',
                                preCheck.message,
                                [
                                    { text: 'Annuler', style: 'cancel' },
                                    { text: 'Voir le guide', onPress: showPermissionGuide },
                                ]
                            );
                            return;
                        }
                        
                        // Afficher un avertissement si permission background manquante
                        if (preCheck.message) {
                            console.warn('[TrackRoute]', preCheck.message);
                        }
                        
                        console.log('[TrackRoute] Tous les prérequis sont remplis');

                        // Vérifier la connexion socket
                        console.log('[TrackRoute] Vérification connexion Socket.IO...');
                        if (!socketService.connected) {
                            console.log('[TrackRoute] Connexion socket avant tracking...');
                            try {
                                await socketService.connect();
                                console.log('[TrackRoute] Socket: Connecté');
                            } catch (err: unknown) {
                                console.error('[TrackRoute] Échec de connexion socket:', err);
                                Alert.alert(
                                    'Erreur de connexion',
                                    'Impossible de se connecter au serveur. Vérifiez votre connexion internet.'
                                );
                                return;
                            }
                        } else {
                            console.log('[TrackRoute] Socket: Déjà connecté');
                        }

                        // Démarrer le tracking
                        console.log('[TrackRoute] Démarrage du tracking GPS...');
                        const success = await locationTrackingService.startTracking({
                            busId: String(busId),
                            accuracy: Location.Accuracy.BestForNavigation,
                            distanceInterval: 10, // Envoyer tous les 10 mètres
                            timeInterval: 5000, // OU toutes les 5 secondes (même à l'arrêt)
                        });

                        if (success) {
                            trackingInitializedRef.current = true;
                            console.log('[TrackRoute] Tracking démarré avec succès pour le bus:', busId);
                            console.log('[TrackRoute] En attente des positions GPS...');
                        } else {
                            console.error('[TrackRoute] Échec du démarrage du tracking');
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

    useEffect(() => {
        didFitRouteBoundsRef.current = false;
        lastFittedPointCountRef.current = 0;
        setRouteFetchOrigin(null);
    }, [departure.departure?.id]);

    /** Trip utilisé pour le tracé (priorité au segment primaire dans `trips`). */
    const routingTrip = useMemo(() => resolveTripForRouting(departure.departure), [departure.departure]);

    const endpointCoords = useMemo(() => getTripEndpointCoords(routingTrip), [routingTrip]);
    const fromCoord = endpointCoords?.fromCoord ?? null;
    const toCoord = endpointCoords?.toCoord ?? null;

    /** GPS utilisable pour l’itinéraire (sans exiger d’être différent du point par défaut carte — évite l’itinéraire serveur figé sur simulateur). */
    const canUseGpsForRoute = useMemo(
        () => !isLoading && isValidCoords(location.latitude, location.longitude),
        [isLoading, isValidCoords, location.latitude, location.longitude]
    );

    /**
     * Met à jour l’origine du tracé : station si pas de GPS, sinon position actuelle du bus ; relance un recalcul si le bus s’est déplacé de ROUTE_ORIGIN_RECALC_METERS par rapport à l’origine du dernier tracé.
     */
    useEffect(() => {
        if (!fromCoord || !toCoord) return;

        if (!canUseGpsForRoute) {
            setRouteFetchOrigin(fromCoord);
            return;
        }

        const cur: [number, number] = [location.longitude, location.latitude];
        setRouteFetchOrigin((prev) => {
            if (!prev) return cur;
            const samePoint = (a: [number, number], b: [number, number]) =>
                Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
            if (samePoint(prev, fromCoord)) {
                const dStation = calculateDistance(fromCoord[1], fromCoord[0], cur[1], cur[0]);
                if (dStation >= ROUTE_LEAVE_STATION_METERS) return cur;
            }
            const d = calculateDistance(prev[1], prev[0], cur[1], cur[0]);
            if (d >= ROUTE_ORIGIN_RECALC_METERS) return cur;
            return prev;
        });
    }, [fromCoord, toCoord, canUseGpsForRoute, location.latitude, location.longitude]);

    /** Ligne affichée : toujours raccordée au bus si le 1er point Mapbox est trop loin. */
    const routeLineForMap = useMemo(() => {
        if (!routeCoordinates?.length) return null;
        if (!canUseGpsForRoute) return routeCoordinates;
        return prependPointIfFarFromPolylineStart(
            routeCoordinates,
            location.latitude,
            location.longitude,
            ROUTE_POLYLINE_JOIN_GAP_M
        );
    }, [routeCoordinates, canUseGpsForRoute, location.latitude, location.longitude]);

    useEffect(() => {
        if (!routeFetchOrigin || !toCoord) {
            setRouteCoordinates(null);
            return;
        }

        let cancelled = false;
        setRouteLoading(true);
        setRouteCoordinates(null);

        getRouteCoordinates(routingTrip, routeFetchOrigin, toCoord, { skipPrecalculatedRoute: true })
            .then((coordinates) => {
                if (!cancelled) {
                    setRouteCoordinates(coordinates);
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    logError("[TrackRoute] Erreur calcul itinéraire:", error);
                    setRouteCoordinates([routeFetchOrigin, toCoord]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setRouteLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [
        routeFetchOrigin?.[0],
        routeFetchOrigin?.[1],
        toCoord?.[0],
        toCoord?.[1],
        routingTrip,
    ]);

    /** Cap affiché : priorité au tangent de l’itinéraire (aligné route), sinon cap GPS si valide. */
    const displayHeading = useMemo(() => {
        if (
            routeLineForMap &&
            routeLineForMap.length >= 2 &&
            isValidCoords(location.latitude, location.longitude)
        ) {
            const along = bearingAlongPolylineNearPoint(
                routeLineForMap,
                location.longitude,
                location.latitude
            );
            if (along != null) return along;
        }
        const h = location.heading;
        if (h != null && Number.isFinite(h) && h >= 0 && h < 360 && h !== -1) return h;
        return 0;
    }, [routeLineForMap, location.latitude, location.longitude, location.heading, isValidCoords]);

    useEffect(() => {
        if (departure.isRouteStarted && location) {
            map.updateCameraPosition(location.latitude, location.longitude, displayHeading);
        }
    }, [departure.isRouteStarted, location, displayHeading, map.updateCameraPosition]);

    /**
     * Cadre la caméra sur l’itinéraire une fois les points chargés (carte prête ou peu après).
     */
    useEffect(() => {
        if (!routeLineForMap || routeLineForMap.length < 2) return;
        const n = routeLineForMap.length;
        if (didFitRouteBoundsRef.current && n <= lastFittedPointCountRef.current) return;

        let cancelled = false;
        let attempts = 0;

        const runFit = () => {
            if (cancelled) return;
            const cam = map.cameraRef.current;
            if (!cam) {
                if (attempts++ < 15) {
                    setTimeout(runFit, 200);
                }
                return;
            }
            const lngs = routeLineForMap.map((c) => c[0]);
            const lats = routeLineForMap.map((c) => c[1]);
            const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
            const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
            if (ne[0] === sw[0] && ne[1] === sw[1]) {
                didFitRouteBoundsRef.current = true;
                lastFittedPointCountRef.current = n;
                return;
            }
            try {
                cam.fitBounds(ne, sw, [100, 96, 120, 96], 1000);
                didFitRouteBoundsRef.current = true;
                lastFittedPointCountRef.current = n;
            } catch (e) {
                logError("[TrackRoute] fitBounds itinéraire:", e);
            }
        };

        const t = setTimeout(runFit, 150);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [routeLineForMap, map.cameraRef]);

    const centerCoord = map.toMapboxPosition(location.latitude, location.longitude);

    /** Tant que la polyline n’est pas prête, on garde un défaut caméra ; après chargement, fitBounds seul cadre l’itinéraire. */
    const routeReadyForCamera =
        routeLineForMap != null && routeLineForMap.length >= 2;

    const cameraDefaultSettings = useMemo(() => {
        if (routeReadyForCamera) return undefined;
        return {
            centerCoordinate: map.toMapboxPosition(location.latitude, location.longitude),
            zoomLevel: 12,
            heading: displayHeading,
        };
    }, [routeReadyForCamera, location.latitude, location.longitude, displayHeading, map.toMapboxPosition]);

    /**
     * Au chargement de la carte : ne pas forcer un zoom 15 sur le conducteur si un itinéraire va être cadré (écrase fitBounds).
     */
    const handleMapLoaded = useCallback(() => {
        if (routeFetchOrigin && toCoord) return;
        map.onMapLoaded();
    }, [routeFetchOrigin, toCoord, map.onMapLoaded]);

    const routeLineStyle = useMemo(
        () => ({
            lineColor: isDark ? "#6BB3F0" : "#1776BA",
            lineWidth: 5,
            lineCap: "round" as const,
            lineJoin: "round" as const,
            lineOpacity: 0.92,
        }),
        [isDark]
    );

    /** Ne contrôle la caméra par props qu’en mode suivi pour permettre le pan sinon */
    const routeShape = useMemo(() => {
        const coords = routeLineForMap && routeLineForMap.length >= 2
            ? routeLineForMap
            : routeFetchOrigin && toCoord
                ? [routeFetchOrigin, toCoord]
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
    }, [routeLineForMap, routeFetchOrigin, toCoord]);
    const cameraCenter = departure.departure && departure.isRouteStarted ? centerCoord : undefined;

    if (!departure.departure) return null;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: isDark ? "#000000" : "#F3F3F7" }]} edges={["bottom"]}>
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
                    onDidFinishLoadingMap={handleMapLoaded}
                    onCameraChanged={map.onCameraChanged}
                    rotateEnabled
                    pitchEnabled={false}
                    zoomEnabled
                    scrollEnabled
                >
                    <Camera
                        ref={map.cameraRef}
                        centerCoordinate={cameraCenter}
                        defaultSettings={cameraDefaultSettings}
                    />
                    {routeShape && (
                        <ShapeSource
                            id="route-source"
                            key={`route-${departure.departure?.id ?? "dep"}-${routeLineForMap?.length ?? routeCoordinates?.length ?? 0}`}
                            shape={routeShape}
                        >
                            <LineLayer id="route-line" style={routeLineStyle} />
                        </ShapeSource>
                    )}
                    {routeFetchOrigin && (
                        <MarkerView coordinate={routeFetchOrigin} anchor={{ x: 0.5, y: 1 }} allowOverlap>
                            <Image source={require("@/assets/images/flag-start.png")} style={routeMarkerStyles.flag} resizeMode="contain" />
                        </MarkerView>
                    )}
                    {toCoord && (
                        <MarkerView coordinate={toCoord} anchor={{ x: 0.5, y: 1 }} allowOverlap>
                            <Image source={require("@/assets/images/flag-end.png")} style={routeMarkerStyles.flag} resizeMode="contain" />
                        </MarkerView>
                    )}
                    <UserMarkerMapbox coordinate={centerCoord} heading={displayHeading} />
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
        </SafeAreaView>
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
