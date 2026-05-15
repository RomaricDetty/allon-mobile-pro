import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity } from "react-native";

type RecenterButtonProps = {
    onPress: () => void;
    visible?: boolean;
};

/**
 * Bouton flottant pour recentrer la carte sur le bus (style navigation).
 */
export function RecenterButton({ onPress, visible = true }: RecenterButtonProps) {
    if (!visible) return null;

    return (
        <TouchableOpacity
            style={styles.button}
            onPress={onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Recentrer sur le bus"
        >
            <Ionicons name="navigate" size={18} color="#FFFFFF" style={styles.icon} />
            <ThemedText style={styles.label}>Recentrer</ThemedText>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        position: "absolute",
        left: 16,
        bottom: 108,
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 24,
        backgroundColor: "rgba(45, 45, 48, 0.94)",
        zIndex: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.28,
        shadowRadius: 4,
        elevation: 12,
    },
    icon: {
        marginRight: 8,
    },
    label: {
        color: "#FFFFFF",
        fontSize: 15,
        fontFamily: "Ubuntu_Medium",
    },
});
