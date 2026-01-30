import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Platform, StyleSheet, View } from "react-native";
import { MarkerView } from "@rnmapbox/maps";

type Position = [number, number];

interface UserMarkerMapboxProps {
    /** Position Mapbox [longitude, latitude] */
    coordinate: Position;
    /** Cap en degrés (0–360) pour orienter l’icône */
    heading?: number | null;
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
        if (heading !== null && heading !== undefined && heading >= 0) {
            const previousHeading = previousHeadingRef.current;
            let targetHeading = heading;
            const diff = targetHeading - previousHeading;
            if (diff > 180) targetHeading = targetHeading - 360;
            else if (diff < -180) targetHeading = targetHeading + 360;

            if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
            setIsAnimating(true);

            Animated.timing(rotationRef.current, {
                toValue: targetHeading,
                duration: 300,
                useNativeDriver: true,
            }).start(() => {
                previousHeadingRef.current = heading;
                rotationRef.current.setValue(heading);
                animationTimeoutRef.current = setTimeout(
                    () => setIsAnimating(false),
                    Platform.OS === "android" ? 200 : 100
                );
            });
        }
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
