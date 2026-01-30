import { ThemedText } from "@/components/themed-text";
import React, { useEffect } from "react";
import { ActivityIndicator, Animated, Modal, TouchableOpacity, View } from "react-native";
import { styles } from "@/styles/track-route";
import type { RouteAction } from "@/app/track-route/constants";

interface ConfirmModalProps {
    visible: boolean;
    pendingAction: RouteAction | null;
    loadingAction: RouteAction | null;
    messages: Record<RouteAction, string>;
    actionColors: Record<RouteAction, string>;
    onConfirm: () => void;
    onCancel: () => void;
    slideAnim: Animated.Value;
    colors: { modalBg: string; modalText: string; modalMessage: string; closeButtonBg: string };
}

/** Modal de confirmation d'action (embarquement / départ / arrivée) */
export function ConfirmModal({ visible, pendingAction, loadingAction, messages, actionColors, onConfirm, onCancel, slideAnim, colors }: ConfirmModalProps) {
    useEffect(() => {
        if (visible) Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
        else Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }, [visible, slideAnim]);

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={loadingAction ? undefined : onCancel}>
            <TouchableOpacity style={styles.bottomSheetOverlay} activeOpacity={1} onPress={loadingAction ? undefined : onCancel} disabled={!!loadingAction}>
                <Animated.View
                    style={[styles.bottomSheetContent, { backgroundColor: colors.modalBg }, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }], opacity: slideAnim }]}
                    onStartShouldSetResponder={() => true}
                >
                    <View style={styles.bottomSheetHandle} />
                    <ThemedText style={[styles.bottomSheetTitle, { color: colors.modalText }]}>Confirmer l'action</ThemedText>
                    <ThemedText style={[styles.bottomSheetMessage, { color: colors.modalMessage }]}>{pendingAction ? messages[pendingAction] : ""}</ThemedText>
                    <View style={styles.confirmButtonsContainer}>
                        <TouchableOpacity
                            style={[styles.bottomSheetConfirmButton, { backgroundColor: pendingAction ? actionColors[pendingAction] : "#43b860", opacity: loadingAction ? 0.6 : 1 }]}
                            onPress={onConfirm}
                            activeOpacity={0.8}
                            disabled={!!loadingAction}
                        >
                            {loadingAction === pendingAction ? (
                                <View style={styles.loaderContainer}>
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                    <ThemedText style={[styles.bottomSheetConfirmButtonText, { marginLeft: 8 }]}>Traitement...</ThemedText>
                                </View>
                            ) : (
                                <ThemedText style={styles.bottomSheetConfirmButtonText}>Confirmer</ThemedText>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.bottomSheetCloseButton, { backgroundColor: colors.closeButtonBg, opacity: loadingAction ? 0.6 : 1 }]} onPress={onCancel} activeOpacity={0.8} disabled={!!loadingAction}>
                            <ThemedText style={[styles.bottomSheetCloseText, { color: colors.modalText }]}>Annuler</ThemedText>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
}
