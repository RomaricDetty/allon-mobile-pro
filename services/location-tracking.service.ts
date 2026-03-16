import * as Location from 'expo-location';
import { socketService } from './socket.service';

interface TrackingConfig {
  busId: string;
  accuracy?: Location.Accuracy;
  distanceInterval?: number;
  timeInterval?: number;
}

interface LocationUpdate {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  timestamp: number;
}

/**
 * Service de tracking de géolocalisation en temps réel
 * Gère le suivi de position en arrière-plan et l'envoi via Socket.IO
 */
class LocationTrackingService {
  private subscription: Location.LocationSubscription | null = null;
  private isTracking: boolean = false;
  private currentBusId: string | null = null;
  private lastSentPosition: { lat: number; lng: number } | null = null;
  private minDistanceThreshold: number = 10; // mètres

  /**
   * Demander les permissions de localisation
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // Demander la permission de localisation en premier plan
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.error('[LocationTracking] Permission de localisation refusée');
        return false;
      }

      // Demander la permission de localisation en arrière-plan
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== 'granted') {
        console.warn('[LocationTracking] Permission de localisation en arrière-plan refusée');
        // On peut continuer sans l'arrière-plan, mais avec limitations
      }

      console.log('[LocationTracking] Permissions accordées');
      return true;
    } catch (error) {
      console.error('[LocationTracking] Erreur lors de la demande de permissions:', error);
      return false;
    }
  }

  /**
   * Vérifier si les permissions sont accordées
   */
  async hasPermissions(): Promise<boolean> {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Démarrer le tracking de position
   */
  async startTracking(config: TrackingConfig): Promise<boolean> {
    if (this.isTracking) {
      console.warn('[LocationTracking] Tracking déjà actif');
      return true;
    }

    // Vérifier les permissions
    const hasPermission = await this.hasPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        return false;
      }
    }

    // Vérifier la connexion socket
    if (!socketService.connected) {
      console.error('[LocationTracking] Socket non connecté');
      return false;
    }

    try {
      this.currentBusId = config.busId;

      // Rejoindre la room du bus
      socketService.joinBusRoom(config.busId);

      // Configuration du tracking
      const accuracy = config.accuracy || Location.Accuracy.BestForNavigation;
      const distanceInterval = config.distanceInterval || 10; // mètres
      const timeInterval = config.timeInterval || 5000; // 5 secondes

      // Démarrer le suivi de position
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy,
          distanceInterval,
          timeInterval,
        },
        (location) => this.handleLocationUpdate(location, config.busId)
      );

      this.isTracking = true;
      console.log('[LocationTracking] Tracking démarré pour le bus:', config.busId);
      return true;
    } catch (error) {
      console.error('[LocationTracking] Erreur lors du démarrage du tracking:', error);
      return false;
    }
  }

  /**
   * Gérer une mise à jour de position
   */
  private handleLocationUpdate(location: Location.LocationObject, busId: string): void {
    const { latitude, longitude, speed, heading, accuracy } = location.coords;

    // Vérifier si la position a suffisamment changé
    if (this.lastSentPosition) {
      const distance = this.calculateDistance(
        this.lastSentPosition.lat,
        this.lastSentPosition.lng,
        latitude,
        longitude
      );

      // Ne pas envoyer si le déplacement est trop faible
      if (distance < this.minDistanceThreshold) {
        return;
      }
    }

    // Préparer les données de position
    const positionData = {
      busId,
      lat: latitude,
      lng: longitude,
      speed: speed || 0,
      heading: heading || 0,
      accuracy: accuracy || 0,
      timestamp: location.timestamp,
    };

    // Envoyer la position via Socket.IO
    socketService.sendPosition(positionData);

    // Mettre à jour la dernière position envoyée
    this.lastSentPosition = { lat: latitude, lng: longitude };

    console.log('[LocationTracking] Position envoyée:', {
      lat: latitude.toFixed(6),
      lng: longitude.toFixed(6),
      speed: speed?.toFixed(2),
    });
  }

  /**
   * Calculer la distance entre deux points (formule de Haversine)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance en mètres
  }

  /**
   * Arrêter le tracking de position
   */
  async stopTracking(): Promise<void> {
    if (!this.isTracking) {
      console.warn('[LocationTracking] Tracking non actif');
      return;
    }

    try {
      // Arrêter le suivi de position
      if (this.subscription) {
        this.subscription.remove();
        this.subscription = null;
      }

      // Quitter la room du bus
      if (this.currentBusId) {
        socketService.leaveBusRoom(this.currentBusId);
      }

      this.isTracking = false;
      this.currentBusId = null;
      this.lastSentPosition = null;

      console.log('[LocationTracking] Tracking arrêté');
    } catch (error) {
      console.error('[LocationTracking] Erreur lors de l\'arrêt du tracking:', error);
    }
  }

  /**
   * Obtenir la position actuelle une seule fois
   */
  async getCurrentPosition(): Promise<LocationUpdate | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        speed: location.coords.speed,
        heading: location.coords.heading,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('[LocationTracking] Erreur lors de la récupération de la position:', error);
      return null;
    }
  }

  /**
   * Vérifier si le tracking est actif
   */
  get tracking(): boolean {
    return this.isTracking;
  }

  /**
   * Obtenir l'ID du bus actuellement tracké
   */
  get activeBusId(): string | null {
    return this.currentBusId;
  }

  /**
   * Définir le seuil de distance minimum pour envoyer une mise à jour
   */
  setMinDistanceThreshold(meters: number): void {
    this.minDistanceThreshold = Math.max(0, meters);
  }
}

// Export d'une instance unique (singleton)
export const locationTrackingService = new LocationTrackingService();
