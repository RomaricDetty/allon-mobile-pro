import { ThemedText } from "@/components/themed-text";
import { styles } from "@/styles/track-route";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Animated, Modal, TouchableOpacity, View } from "react-native";

interface ActionModalProps {
    visible: boolean;
    onClose: () => void;
    slideAnim: Animated.Value;
    canPerformBoarding: boolean;
    canStartRoute: boolean;
    onBoarding: () => void;
    onStartRoute: () => void;
    colors: { modalBg: string; modalText: string; closeButtonBg: string };
}

/** Modal de choix d'action (embarquement / démarrer le départ) */
export function ActionModal({
    visible,
    onClose,
    slideAnim,
    canPerformBoarding,
    canStartRoute,
    onBoarding,
    onStartRoute,
    colors,
}: ActionModalProps) {
    useEffect(() => {
        if (visible) Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
        else Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }, [visible, slideAnim]);

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <TouchableOpacity style={styles.bottomSheetOverlay} activeOpacity={1} onPress={onClose}>
                <Animated.View
                    style={[styles.bottomSheetContent, { backgroundColor: colors.modalBg }, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }], opacity: slideAnim }]}
                    onStartShouldSetResponder={() => true}
                >
                    <View style={styles.bottomSheetHandle} />
                    <ThemedText style={[styles.bottomSheetTitle, { color: colors.modalText }]}>Choisir une action</ThemedText>
                    {canPerformBoarding && (
                        <TouchableOpacity style={[styles.bottomSheetButton, { backgroundColor: "#1776BA" }]} onPress={onBoarding} activeOpacity={0.8}>
                            <MaterialIcons name="directions-bus" size={24} color="#FFFFFF" />
                            <ThemedText style={styles.bottomSheetButtonText}>Embarquement</ThemedText>
                        </TouchableOpacity>
                    )}
                    {canStartRoute && (
                        <TouchableOpacity style={[styles.bottomSheetButton, { backgroundColor: "#43b860" }]} onPress={onStartRoute} activeOpacity={0.8}>
                            <MaterialIcons name="play-arrow" size={24} color="#FFFFFF" />
                            <ThemedText style={styles.bottomSheetButtonText}>Démarrer le départ</ThemedText>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.bottomSheetCloseButton, { backgroundColor: colors.closeButtonBg }]} onPress={onClose} activeOpacity={0.8}>
                        <ThemedText style={[styles.bottomSheetCloseText, { color: colors.modalText }]}>Fermer</ThemedText>
                    </TouchableOpacity>
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
}
