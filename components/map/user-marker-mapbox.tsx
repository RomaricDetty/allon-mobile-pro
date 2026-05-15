import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Platform, StyleSheet, View } from "react-native";
import { MarkerView } from "@rnmapbox/maps";

type Position = [number, number];

interface UserMarkerMapboxProps {
    /** Position Mapbox [longitude, latitude] */
    coordinate: Position;
    /** Cap en degrés (0–360, nord = 0°) pour orienter l’icône */
    heading?: number | null;
}

/** Même convention que user-marker (react-native-maps) : le PNG pointe vers le haut = nord géographique. */
const ICON_HEADING_OFFSET_DEG = 0;

/**
 * Normalise un angle en degrés dans [0, 360).
 */
function normalizeHeadingDeg(deg: number): number {
    return ((deg % 360) + 360) % 360;
}

/**
 * Marqueur utilisateur pour Mapbox (bus + rotation selon le cap).
 * Utilise MarkerView pour permettre l’animation de rotation.
 */
const UserMarkerMapbox: React.FC<UserMarkerMapboxProps> = ({ coordinate, heading }) => {
    const rotationRef = useRef(new Animated.Value(0));
    const previousHeadingRef = useRef<number>(0);
    const [isAnimating, setIsAnimating] = useState(Platform.OS === "android");
    const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isInitialMountRef = useRef(true);

    useEffect(() => {
        if (Platform.OS === "android" && isInitialMountRef.current) {
            isInitialMountRef.current = false;
            animationTimeoutRef.current = setTimeout(() => setIsAnimating(false), 500);
        }
        return () => {
            if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (heading === null || heading === undefined || !Number.isFinite(heading)) return;

        const adjusted = normalizeHeadingDeg(heading + ICON_HEADING_OFFSET_DEG);

        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
        setIsAnimating(true);

        Animated.timing(rotationRef.current, {
            toValue: adjusted,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            previousHeadingRef.current = adjusted;
            rotationRef.current.setValue(adjusted);
            animationTimeoutRef.current = setTimeout(
                () => setIsAnimating(false),
                Platform.OS === "android" ? 200 : 100
            );
        });
        return () => {
            if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
        };
    }, [heading]);

    const rotateInterpolate = rotationRef.current.interpolate({
        inputRange: [0, 360],
        outputRange: ["0deg", "360deg"],
    });

    const markerImage = useMemo(() => require("@/assets/images/bus.png"), []);

    const markerContent = useMemo(
        () => (
            <Animated.View style={[styles.markerContainer, { transform: [{ rotate: rotateInterpolate }] }]}>
                <View style={styles.markerShadow}>
                    <Image source={markerImage} style={styles.markerImage} resizeMode="contain" />
                </View>
            </Animated.View>
        ),
        [rotateInterpolate, markerImage]
    );

    return (
        <MarkerView
            coordinate={coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
            allowOverlapWithPuck={false}
            isSelected={false}
        >
            {markerContent}
        </MarkerView>
    );
};

const styles = StyleSheet.create({
    markerContainer: {
        alignItems: "center",
        justifyContent: "center",
        width: 50,
        height: 50,
    },
    markerShadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        backgroundColor: "transparent",
        width: 50,
        height: 50,
        alignItems: "center",
        justifyContent: "center",
    },
    markerImage: {
        width: 50,
        height: 50,
    },
});

export default React.memo(UserMarkerMapbox);
