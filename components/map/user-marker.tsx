import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Image, Platform, StyleSheet, View } from "react-native";

import { Marker } from "react-native-maps";

interface UserMarkerProps {
    region: {
        latitude: number;
        longitude: number;
        latitudeDelta?: number;
        longitudeDelta?: number;
    };
}

/**
 * Composant de marqueur pour afficher la position de l'utilisateur sur la carte
 * Affiche une icône MaterialIcons sur Android et une image sur iOS
 */
const UserMarker: React.FC<UserMarkerProps> = ({ region }) => {
    return (
        <Marker
            coordinate={region}
            tracksViewChanges={true}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={false}
        >
            {Platform.OS === 'android' ? (
                <View style={styles.markerContainer}>
                    <MaterialIcons name="directions-bus-filled" size={35} color="#ffffff" />
                </View>
            ) : (
                <View style={styles.markerContainer}>
                    <Image
                        source={require("@/assets/images/bus.png")}
                        resizeMode="contain"
                        style={styles.markerImage}
                    />
                </View>
            )}
        </Marker>
    );
};

const styles = StyleSheet.create({
    markerContainer: {
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerImage: {
        width: 50,
        height: 50,
    },
});

export default React.memo(UserMarker);
