import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { type Region } from "react-native-maps";

import UserMarker from "@/components/map/user-marker";

// Constantes calculées une seule fois
const { width, height } = Dimensions.get("window");
const ASPECT_RATIO = width / height;
const DEFAULT_LATITUDE_DELTA = 0.0922;
const DEFAULT_LONGITUDE_DELTA = DEFAULT_LATITUDE_DELTA * ASPECT_RATIO;

// Configuration du watcher de position
const LOCATION_CONFIG: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 1000, // Mise à jour toutes les secondes
  distanceInterval: 1, // Mise à jour tous les 1 mètre
};

// Position par défaut (Abidjan)
const DEFAULT_LOCATION = {
  latitude: 5.320357,
  longitude: -4.016107,
  latitudeDelta: DEFAULT_LATITUDE_DELTA,
  longitudeDelta: DEFAULT_LONGITUDE_DELTA,
};

interface UserLocation {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Écran de suivi de trajet
 * Affiche la position du conducteur en temps réel
 */
export default function TrackRouteScreen() {
  const mapViewRef = useRef<MapView>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const zoomRef = useRef({
    latitudeDelta: DEFAULT_LATITUDE_DELTA,
    longitudeDelta: DEFAULT_LONGITUDE_DELTA,
  });

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [currentUserLocation, setCurrentUserLocation] =
    useState<UserLocation>(DEFAULT_LOCATION);
  const [isLoading, setIsLoading] = useState(true);

  const iconCircleBackgroundColor = isDark ? "#2C2C2E" : "#F8F8F8";

  /**
   * Arrête le suivi de position
   */
  const stopTracking = useCallback(() => {
    if (locationWatcherRef.current) {
      locationWatcherRef.current.remove();
      locationWatcherRef.current = null;
    }
  }, []);

  /**
   * Gère le retour à l'écran précédent
   */
  const handleBack = useCallback(() => {
    stopTracking();
    router.back();
  }, [stopTracking]);

  /**
   * Initialise le suivi de position
   */
  useEffect(() => {
    let isMounted = true;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          Alert.alert(
            "Permission refusée",
            "L'accès à la localisation est nécessaire pour suivre le trajet.",
            [{ text: "OK", onPress: () => router.back() }]
          );
          if (isMounted) setIsLoading(false);
          return;
        }

        // Démarre le suivi de position en temps réel
        const watcher = await Location.watchPositionAsync(
          LOCATION_CONFIG,
          (location) => {
            if (!isMounted) return;

            const {
              latitude,
              longitude,
              heading: newHeading,
            } = location.coords;
            setCurrentUserLocation((prev) => ({
              latitude,
              longitude,
              latitudeDelta: prev.latitudeDelta,
              longitudeDelta: prev.longitudeDelta,
            }));

            // Oriente la carte selon la direction de l'utilisateur
            if (newHeading !== null && newHeading >= 0) {
              mapViewRef.current?.animateCamera(
                {
                  center: { latitude, longitude },
                  heading: newHeading,
                },
                { duration: 300 }
              );
            }

            setIsLoading(false);
          }
        );

        locationWatcherRef.current = watcher;
      } catch (error) {
        console.error("Erreur lors de la demande de permission:", error);
        Alert.alert(
          "Erreur",
          "Une erreur est survenue lors de l'accès à la localisation.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        if (isMounted) setIsLoading(false);
      }
    };

    startLocationTracking();

    // Cleanup au démontage
    return () => {
      isMounted = false;
      stopTracking();
    };
  }, [stopTracking]);

  /**
   * Centre la carte sur la position actuelle
   */
  const getCurrentLocation = useCallback(() => {
    mapViewRef.current?.animateToRegion(
      {
        latitude: currentUserLocation.latitude,
        longitude: currentUserLocation.longitude,
        latitudeDelta: zoomRef.current.latitudeDelta,
        longitudeDelta: zoomRef.current.longitudeDelta,
      },
      200
    );
  }, [currentUserLocation.latitude, currentUserLocation.longitude]);

  /**
   * Zoom avant
   */
  const zoomIn = useCallback(() => {
    const newLatDelta = zoomRef.current.latitudeDelta / 2;
    const newLngDelta = zoomRef.current.longitudeDelta / 2;

    mapViewRef.current?.animateToRegion(
      {
        latitude: currentUserLocation.latitude,
        longitude: currentUserLocation.longitude,
        latitudeDelta: newLatDelta,
        longitudeDelta: newLngDelta,
      },
      200
    );
  }, [currentUserLocation.latitude, currentUserLocation.longitude]);

  /**
   * Zoom arrière
   */
  const zoomOut = useCallback(() => {
    const newLatDelta = zoomRef.current.latitudeDelta * 1.5;
    const newLngDelta = zoomRef.current.longitudeDelta * 1.5;

    mapViewRef.current?.animateToRegion(
      {
        latitude: currentUserLocation.latitude,
        longitude: currentUserLocation.longitude,
        latitudeDelta: newLatDelta,
        longitudeDelta: newLngDelta,
      },
      200
    );
  }, [currentUserLocation.latitude, currentUserLocation.longitude]);

  /**
   * Réinitialise le zoom
   */
  const resetZoom = useCallback(() => {
    mapViewRef.current?.animateCamera({
      center: {
        latitude: currentUserLocation.latitude,
        longitude: currentUserLocation.longitude,
      },
      pitch: 0,
      heading: 0,
      altitude: 1000,
      zoom: 15,
    });
  }, [currentUserLocation.latitude, currentUserLocation.longitude]);

  /**
   * Gère le changement de région (zoom)
   */
  const handleRegionChange = useCallback((region: Region) => {
    zoomRef.current = {
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    };
  }, []);

  /**
   * Callback au chargement de la carte
   */
  const handleMapLoaded = useCallback(() => {
    mapViewRef.current?.animateCamera({
      center: {
        latitude: currentUserLocation.latitude,
        longitude: currentUserLocation.longitude,
      },
      pitch: 0,
      heading: 0,
      altitude: 1000,
      zoom: 15,
    });
  }, [currentUserLocation.latitude, currentUserLocation.longitude]);

  // Couleurs pour le mode clair et sombre
  const primaryTextColor = isDark ? "#FFFFFF" : "#11181C";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#000000" : "#F3F3F7" },
      ]}
    >
      <View style={styles.mapContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={[
                styles.headerButton,
                { backgroundColor: "rgba(255, 255, 255, 0.2)" },
              ]}
              onPress={handleBack}
            >
              <MaterialIcons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>

            <ThemedText style={[styles.headerTitle, { color: "#000" }]}>
              Suivi du trajet
            </ThemedText>

            <View style={styles.headerButton} />
          </View>
        </View>

        {/* Indicateur de chargement */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#1776BA" />
            <ThemedText style={styles.loadingText}>
              Récupération de la position...
            </ThemedText>
          </View>
        )}

        <MapView
          ref={mapViewRef}
          style={styles.map}
          initialRegion={currentUserLocation}
          zoomTapEnabled
          onMapLoaded={handleMapLoaded}
          onRegionChange={handleRegionChange}
          onRegionChangeComplete={handleRegionChange}
        >
          <UserMarker region={currentUserLocation} />
        </MapView>

        <View
          style={{
            position: "absolute",
            bottom: 20,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          {/* Boutons de contrôle au-dessus du panneau d'information */}
          <View style={styles.controlButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: iconCircleBackgroundColor },
              ]}
              onPress={getCurrentLocation}
            >
              <Ionicons name="locate" size={20} color={primaryTextColor} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: iconCircleBackgroundColor },
              ]}
              onPress={resetZoom}
            >
              <Ionicons
                name="expand-outline"
                size={20}
                color={primaryTextColor}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: iconCircleBackgroundColor },
              ]}
              onPress={zoomIn}
            >
              <Ionicons name="add-outline" size={20} color={primaryTextColor} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: iconCircleBackgroundColor },
              ]}
              onPress={zoomOut}
            >
              <Ionicons
                name="remove-outline"
                size={20}
                color={primaryTextColor}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Ubuntu_Regular",
  },
  header: {
    position: "absolute",
    paddingHorizontal: 15,
    top: 52,
    left: 0,
    right: 0,
    width: "100%",
    height: 60,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Ubuntu_Bold",
    flex: 1,
    textAlign: "center",
  },
  controlButtonsOverlay: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  controlButtonsContainer: {
    position: "absolute",
    bottom: "46%",
    right: 20,
    flexDirection: "column",
    gap: 12,
    zIndex: 10,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
});
