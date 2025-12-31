import React, { useEffect, useMemo, useRef } from "react";
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
 */
const UserMarker: React.FC<UserMarkerProps> = ({ region, heading }) => {
    const rotationRef = useRef(new Animated.Value(0));
    const previousHeadingRef = useRef<number>(0);

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

            Animated.timing(rotationRef.current, {
                toValue: targetHeading,
                duration: 500,
                useNativeDriver: true,
            }).start(() => {
                previousHeadingRef.current = heading;
                rotationRef.current.setValue(heading);
            });
        }
    }, [heading]);

    const rotateInterpolate = rotationRef.current.interpolate({
        inputRange: [0, 360],
        outputRange: ["0deg", "360deg"],
    });

    // Précharger l'image pour Android
    const markerImage = useMemo(() => require("@/assets/images/bus.png"), []);

    // Rendu optimisé selon la plateforme
    const renderMarkerContent = () => {
        if (Platform.OS === "android") {
            // Sur Android, utiliser un composant simple sans trop d'imbrication
            return (
                <View style={styles.markerContainer}>
                    {/* <MaterialIcons name="directions-bus-filled" size={50} color="#FFFFFF" /> */}
                    <Image
                        source={markerImage}
                        style={styles.markerImage}
                        resizeMode="contain"
                    />
                </View>
            );
        }

        // Sur iOS, on peut utiliser plus d'effets
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
    };

    return (
        <Marker
            coordinate={{
                latitude: region.latitude,
                longitude: region.longitude,
            }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            zIndex={999}
        >
            {renderMarkerContent()}
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
        // Re-render uniquement si les coordonnées ou le heading changent significativement
        const coordsChanged =
            Math.abs(prevProps.region.latitude - nextProps.region.latitude) >
            0.00001 ||
            Math.abs(prevProps.region.longitude - nextProps.region.longitude) >
            0.00001;

        const headingChanged =
            prevProps.heading !== nextProps.heading &&
            Math.abs((prevProps.heading || 0) - (nextProps.heading || 0)) > 5;

        return !coordsChanged && !headingChanged;
    }
);