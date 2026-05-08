import { ThemedText } from "@/components/themed-text";
import { styles } from "@/styles/track-route";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { TouchableOpacity, View } from "react-native";

const CONTROL_BUTTONS = [
    { icon: "locate" as const, key: "locate" },
    { icon: "expand-outline" as const, key: "expand" },
    { icon: "add-outline" as const, key: "zoomIn" },
    { icon: "remove-outline" as const, key: "zoomOut" },
] as const;

interface MapControlsProps {
    onLocate: () => void;
    onResetZoom: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onBack: () => void;
    iconBg: string;
    textColor: string;
    isBoarding: boolean;
    isDeparted: boolean;
    isArrived: boolean;
    isRouteStarted: boolean;
    isScheduled: boolean;
    canStartRoute: boolean;
    onMainAction: () => void;
    onFinishRoute: () => void;
}

/** Boutons de contrôle carte + bouton principal démarrer/terminer */
export function MapControls({
    onLocate,
    onResetZoom,
    onZoomIn,
    onZoomOut,
    onBack,
    iconBg,
    textColor,
    isBoarding,
    isDeparted,
    isArrived,
    isRouteStarted,
    isScheduled,
    canStartRoute,
    onMainAction,
    onFinishRoute,
}: MapControlsProps) {
    const handlers = [onLocate, onResetZoom, onZoomIn, onZoomOut];

    return (
        <>
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity style={[styles.headerButton, { backgroundColor: "rgba(255, 255, 255, 0.9)" }]} onPress={onBack}>
                        <MaterialIcons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <View style={styles.headerButton} />
                </View>
            </View>
            <View style={styles.controlButtonsContainer}>
                {CONTROL_BUTTONS.map(({ icon, key }, idx) => (
                    <TouchableOpacity key={key} style={[styles.controlButton, { backgroundColor: iconBg }]} onPress={handlers[idx]}>
                        <Ionicons name={icon} size={20} color={textColor} />
                    </TouchableOpacity>
                ))}
            </View>
            <View style={styles.floatingButtonContainer}>
                {isBoarding && !isDeparted && (
                    <View style={styles.boardingIndicator}>
                        <MaterialIcons name="directions-bus" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.boardingIndicatorText}>En embarquement</ThemedText>
                    </View>
                )}
                {isArrived ? (
                    <View style={[styles.floatingButton, { backgroundColor: "#34C759", opacity: 0.7 }]}>
                        <ThemedText style={styles.floatingButtonText}>Départ terminé</ThemedText>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.floatingButton, (isDeparted || (isRouteStarted && !isDeparted)) && styles.floatingButtonActive, !canStartRoute && !isDeparted && { opacity: 0.6 }]}
                        onPress={isDeparted ? onFinishRoute : onMainAction}
                        activeOpacity={0.8}
                        disabled={!canStartRoute && !isDeparted}
                    >
                        <ThemedText style={styles.floatingButtonText}>
                            {isDeparted ? "Terminer le départ" : isRouteStarted ? "Terminer le départ" : isScheduled ? "Choisir une action" : "Démarrer le départ"}
                        </ThemedText>
                    </TouchableOpacity>
                )}
            </View>
        </>
    );
}
