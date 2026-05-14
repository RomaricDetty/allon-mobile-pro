import { DepartureStatusApiError, markAsStatusDepartureApi } from "@/api/departures";
import { departureEventEmitter } from "@/utils/departure-events";
import { logError } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import type { Departure } from "@/components/departure-card";
import { CONFIRM_MESSAGES, ACTION_COLORS, type RouteAction } from "@/app/track-route/constants";

type ModalAction = "boarding" | "startRoute" | "finishRoute";

/** Messages par défaut si l’API ne renvoie pas de `message` (status ≠ 2xx). */
const DEFAULT_DEPARTURE_STATUS_MESSAGE: Record<"boarding" | "departed" | "arrived", string> = {
    boarding: "Impossible d'enregistrer l'embarquement.",
    departed: "Impossible de démarrer le départ.",
    arrived: "Impossible de terminer le départ.",
};

/**
 * Hook de gestion du départ et des actions (embarquement, départ, arrivée)
 * Gère l'état du départ, les modals et les appels API
 */
export function useTrackRouteDeparture(
    getCurrentLocation: () => void,
    isInteractingRef: React.MutableRefObject<boolean>,
    lastCameraRef: React.MutableRefObject<number>
) {
    const params = useLocalSearchParams<{ departure: string }>();
    const initialDeparture = useMemo<Departure | null>(() => {
        try {
            if (params?.departure) return JSON.parse(params.departure) as Departure;
        } catch (e) {
            logError("[TRACK-ROUTE] Parse départ:", e);
        }
        return null;
    }, [params?.departure]);

    const [departure, setDeparture] = useState<Departure | null>(initialDeparture);
    const [showActionModal, setShowActionModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<ModalAction | null>(null);
    const [loadingAction, setLoadingAction] = useState<ModalAction | null>(null);
    // Initialiser isRouteStarted à true si le départ est déjà en statut DEPARTED
    const [isRouteStarted, setIsRouteStarted] = useState(
        initialDeparture?.status?.toUpperCase() === "DEPARTED"
    );

    useEffect(() => {
        setDeparture(initialDeparture);
        // Mettre à jour isRouteStarted si le statut est DEPARTED
        if (initialDeparture?.status?.toUpperCase() === "DEPARTED") {
            setIsRouteStarted(true);
            console.log('[useTrackRouteDeparture] Trajet déjà démarré (statut DEPARTED)');
        }
    }, [initialDeparture]);

    const status = useMemo(() => {
        const s = departure?.status?.toUpperCase() || "";
        return {
            isScheduled: s === "SCHEDULED",
            isBoarding: s === "BOARDING",
            isDeparted: s === "DEPARTED",
            isArrived: s === "ARRIVED",
        };
    }, [departure?.status]);

    const canPerformBoarding = status.isScheduled && !status.isBoarding && !status.isDeparted && !status.isArrived;
    const canStartRoute = (status.isScheduled || status.isBoarding) && !status.isDeparted && !status.isArrived;

    const updateStatus = useCallback(
        async (apiStatus: "boarding" | "departed" | "arrived") => {
            const action: ModalAction = apiStatus === "boarding" ? "boarding" : apiStatus === "departed" ? "startRoute" : "finishRoute";
            setLoadingAction(action);
            try {
                const token = await AsyncStorage.getItem("token");
                if (!token || !departure?.id) throw new Error("Token ou ID manquant");
                await markAsStatusDepartureApi(departure.id, token, apiStatus);
                const statusUpper = apiStatus.toUpperCase() as "BOARDING" | "DEPARTED" | "ARRIVED";
                const updated = departure ? { ...departure, status: statusUpper } : null;
                if (updated) {
                    setDeparture(updated);
                    departureEventEmitter.emitStatusUpdate({ departureId: departure.id, newStatus: statusUpper, departure: updated });
                }
                Alert.alert("Succès", "Le trajet a été mis à jour.", apiStatus === "arrived" ? [{ text: "OK", onPress: () => router.back() }] : [{ text: "OK" }]);
                setShowConfirmModal(false);
                setPendingAction(null);
                if (apiStatus === "departed") {
                    setIsRouteStarted(true);
                    isInteractingRef.current = false;
                    lastCameraRef.current = 0;
                    getCurrentLocation();
                }
            } catch (e) {
                logError("[TRACK-ROUTE]", e);
                const fallback = DEFAULT_DEPARTURE_STATUS_MESSAGE[apiStatus];
                const alertMessage =
                    e instanceof DepartureStatusApiError
                        ? e.resolveDisplayMessage(fallback)
                        : e instanceof Error && e.message?.trim()
                          ? e.message.trim()
                          : fallback;
                Alert.alert("Erreur", alertMessage);
            } finally {
                setLoadingAction(null);
            }
        },
        [departure, getCurrentLocation, isInteractingRef, lastCameraRef]
    );

    const openConfirm = useCallback((action: ModalAction) => {
        setShowActionModal(false);
        setPendingAction(action);
        setShowConfirmModal(true);
    }, []);

    const handleBoarding = useCallback(() => canPerformBoarding && openConfirm("boarding"), [canPerformBoarding, openConfirm]);
    const handleStartFromModal = useCallback(() => canStartRoute && openConfirm("startRoute"), [canStartRoute, openConfirm]);
    const handleFinishRoute = useCallback(() => {
        if (!status.isArrived && status.isDeparted) openConfirm("finishRoute");
    }, [status.isArrived, status.isDeparted, openConfirm]);

    const handleStartRoute = useCallback(() => {
        if (status.isArrived) return;
        if (isRouteStarted) {
            setIsRouteStarted(false);
            return;
        }
        if (status.isScheduled) setShowActionModal(true);
        else if (status.isBoarding) openConfirm("startRoute");
        else if (!status.isDeparted) {
            setIsRouteStarted(true);
            getCurrentLocation();
        }
    }, [isRouteStarted, status, openConfirm, getCurrentLocation]);

    const confirmAction = useCallback(() => {
        if (pendingAction === "boarding") updateStatus("boarding");
        else if (pendingAction === "finishRoute") updateStatus("arrived");
        else if (pendingAction === "startRoute") updateStatus("departed");
    }, [pendingAction, updateStatus]);

    useEffect(() => {
        if (!status.isScheduled && showActionModal) setShowActionModal(false);
    }, [status.isScheduled, showActionModal]);

    // Synchroniser isRouteStarted avec le statut DEPARTED
    useEffect(() => {
        if (status.isDeparted && !isRouteStarted) {
            console.log('[useTrackRouteDeparture] Synchronisation: Statut DEPARTED détecté, activation de isRouteStarted');
            setIsRouteStarted(true);
        } else if (status.isArrived && isRouteStarted) {
            console.log('[useTrackRouteDeparture] Synchronisation: Statut ARRIVED détecté, désactivation de isRouteStarted');
            setIsRouteStarted(false);
        }
    }, [status.isDeparted, status.isArrived, isRouteStarted]);

    return {
        departure,
        status,
        canPerformBoarding,
        canStartRoute,
        isRouteStarted,
        showActionModal,
        setShowActionModal,
        showConfirmModal,
        pendingAction,
        loadingAction,
        setShowConfirmModal,
        setPendingAction,
        handleBoarding,
        handleStartFromModal,
        handleFinishRoute,
        handleStartRoute,
        handleCloseActionModal: () => setShowActionModal(false),
        handleCancelConfirm: useCallback(() => {
            if (!loadingAction) {
                setShowConfirmModal(false);
                setPendingAction(null);
            }
        }, [loadingAction]),
        confirmAction,
        confirmationMessages: CONFIRM_MESSAGES,
        actionColors: ACTION_COLORS,
    };
}
