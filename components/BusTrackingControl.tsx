import { useBusTracking } from '@/hooks/use-bus-tracking';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BusTrackingControlProps {
  busId: string;
  departureId?: string;
  onTrackingStart?: () => void;
  onTrackingStop?: () => void;
  onPositionUpdate?: (position: { lat: number; lng: number }) => void;
}

/**
 * Composant de contrôle du tracking de position du bus
 * Affiche un bouton pour démarrer/arrêter le tracking et l'état de la connexion
 */
export function BusTrackingControl({
  busId,
  departureId,
  onTrackingStart,
  onTrackingStop,
  onPositionUpdate,
}: BusTrackingControlProps) {
  const {
    isTracking,
    isConnected,
    hasPermission,
    error,
    lastPosition,
    startTracking,
    stopTracking,
    listenToPosition,
    checkPermissions,
  } = useBusTracking(busId, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 10, // Envoyer une mise à jour tous les 10 mètres
    timeInterval: 5000, // Ou toutes les 5 secondes
    autoConnect: true,
  });

  const [isLoading, setIsLoading] = useState(false);

  /**
   * Gérer le démarrage du tracking
   */
  const handleStartTracking = async () => {
    // Vérifier les permissions
    if (!hasPermission) {
      Alert.alert(
        'Permission requise',
        'L\'application a besoin d\'accéder à votre position pour suivre le trajet du bus.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Autoriser',
            onPress: async () => {
              const granted = await checkPermissions();
              if (granted) {
                handleStartTracking();
              }
            },
          },
        ]
      );
      return;
    }

    setIsLoading(true);
    const success = await startTracking();
    setIsLoading(false);

    if (success) {
      onTrackingStart?.();
      Alert.alert('Tracking démarré', 'La position du bus est maintenant partagée en temps réel.');
    } else {
      Alert.alert(
        'Erreur',
        'Impossible de démarrer le tracking. Vérifiez vos paramètres de localisation.'
      );
    }
  };

  /**
   * Gérer l'arrêt du tracking
   */
  const handleStopTracking = async () => {
    Alert.alert(
      'Arrêter le tracking',
      'Êtes-vous sûr de vouloir arrêter le partage de position ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Arrêter',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            await stopTracking();
            setIsLoading(false);
            onTrackingStop?.();
          },
        },
      ]
    );
  };

  /**
   * Écouter les mises à jour de position
   */
  useEffect(() => {
    if (isTracking) {
      const unsubscribe = listenToPosition((position) => {
        onPositionUpdate?.(position);
      });

      return unsubscribe;
    }
  }, [isTracking, listenToPosition, onPositionUpdate]);

  /**
   * Afficher les erreurs
   */
  useEffect(() => {
    if (error) {
      Alert.alert('Erreur', error);
    }
  }, [error]);

  return (
    <View style={styles.container}>
      {/* Indicateur de connexion */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
        <Text style={styles.statusText}>
          {isConnected ? 'Connecté au serveur' : 'Déconnecté'}
        </Text>
      </View>

      {/* Bouton de contrôle */}
      <TouchableOpacity
        style={[
          styles.button,
          isTracking ? styles.buttonStop : styles.buttonStart,
          isLoading && styles.buttonDisabled,
        ]}
        onPress={isTracking ? handleStopTracking : handleStartTracking}
        disabled={isLoading || !isConnected}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            {isTracking ? 'Arrêter le tracking' : 'Démarrer le tracking'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Informations de position */}
      {isTracking && lastPosition && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Dernière position :</Text>
          <Text style={styles.infoText}>
            Lat: {lastPosition.lat.toFixed(6)}, Lng: {lastPosition.lng.toFixed(6)}
          </Text>
          {lastPosition.speed !== undefined && (
            <Text style={styles.infoText}>
              Vitesse: {(lastPosition.speed * 3.6).toFixed(1)} km/h
            </Text>
          )}
          <Text style={styles.infoText}>
            Mis à jour: {new Date(lastPosition.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      )}

      {/* Message de permission */}
      {!hasPermission && !isTracking && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            ⚠️ Permission de localisation requise
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonStart: {
    backgroundColor: '#1776BA',
  },
  buttonStop: {
    backgroundColor: '#F44336',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  warningContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningText: {
    fontSize: 13,
    color: '#E65100',
  },
});
