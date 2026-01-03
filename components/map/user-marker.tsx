import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Platform, StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";

interface UserMarkerProps {
    region: {
        latitude: number;
        longitude: number;
        latitudeDelta?: number;
        longitudeDelta?: number;
    };
    heading?: number | null;
}

/**
 * Composant de marqueur pour afficher la position de l'utilisateur sur la carte
 * Compatible iOS et Android avec rotation selon le heading
 * Optimisé pour la performance et la fluidité
 */
const UserMarker: React.FC<UserMarkerProps> = ({ region, heading }) => {
    const rotationRef = useRef(new Animated.Value(0));
    const previousHeadingRef = useRef<number>(0);
    const [isAnimating, setIsAnimating] = useState(Platform.OS === "android");
    const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isInitialMountRef = useRef(true);

    /**
     * Assure l'affichage initial du marker sur Android
     */
    useEffect(() => {
        if (Platform.OS === "android" && isInitialMountRef.current) {
            isInitialMountRef.current = false;
            // Désactiver le tracking après le premier rendu sur Android
            animationTimeoutRef.current = setTimeout(() => {
                setIsAnimating(false);
            }, 500);
        }

        return () => {
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
        };
    }, []);

    /**
     * Anime la rotation du marker selon le heading
     */
    useEffect(() => {
        if (heading !== null && heading !== undefined && heading >= 0) {
            const previousHeading = previousHeadingRef.current;
            let targetHeading = heading;

            // Gérer le passage de 359° à 0° pour choisir le sens de rotation optimal
            const diff = targetHeading - previousHeading;

            if (diff > 180) {
                targetHeading = targetHeading - 360;
            } else if (diff < -180) {
                targetHeading = targetHeading + 360;
            }

            // Nettoyer le timeout précédent si existant
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }

            // Activer le tracking pendant l'animation pour Android
            setIsAnimating(true);

            Animated.timing(rotationRef.current, {
                toValue: targetHeading,
                duration: 300, // Durée réduite pour plus de fluidité
                useNativeDriver: true,
            }).start(() => {
                previousHeadingRef.current = heading;
                rotationRef.current.setValue(heading);
                // Désactiver le tracking après l'animation pour optimiser les performances
                // Sur Android, on garde un peu plus longtemps pour s'assurer que le rendu est correct
                animationTimeoutRef.current = setTimeout(() => {
                    setIsAnimating(false);
                }, Platform.OS === "android" ? 200 : 100);
            });
        }

        return () => {
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
        };
    }, [heading]);

    const rotateInterpolate = rotationRef.current.interpolate({
        inputRange: [0, 360],
        outputRange: ["0deg", "360deg"],
    });

    // Précharger l'image une seule fois
    const markerImage = useMemo(() => require("@/assets/images/bus.png"), []);

    // Rendu unifié pour iOS et Android avec rotation
    const markerContent = useMemo(() => {
        return (
            <Animated.View
                style={[
                    styles.markerContainer,
                    {
                        transform: [{ rotate: rotateInterpolate }],
                    },
                ]}
            >
                <View style={styles.markerShadow}>
                    <Image
                        source={markerImage}
                        style={styles.markerImage}
                        resizeMode="contain"
                    />
                </View>
            </Animated.View>
        );
    }, [rotateInterpolate, markerImage]);

    return (
        <Marker
            coordinate={{
                latitude: region.latitude,
                longitude: region.longitude,
            }}
            tracksViewChanges={isAnimating}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            zIndex={999}
        >
            {markerContent}
        </Marker>
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
        shadowOffset: {
            width: 0,
            height: 2,
        },
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

export default React.memo(
    UserMarker,
    (prevProps, nextProps) => {
        // Re-render si les coordonnées ou le heading changent
        // Seuil de coordonnées optimisé pour un suivi fluide (environ 5-10 mètres)
        const coordsChanged =
            Math.abs(prevProps.region.latitude - nextProps.region.latitude) >
            0.00005 ||
            Math.abs(prevProps.region.longitude - nextProps.region.longitude) >
            0.00005;

        // Seuil de heading réduit pour une rotation plus fluide (1 degré)
        const headingChanged =
            prevProps.heading !== nextProps.heading &&
            (prevProps.heading === null || nextProps.heading === null ||
            Math.abs((prevProps.heading || 0) - (nextProps.heading || 0)) > 1);

        return !coordsChanged && !headingChanged;
    }
);