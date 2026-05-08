import * as Location from 'expo-location';
import { socketService } from './socket.service';

// Constantes de configuration par défaut
const DEFAULT_MIN_DISTANCE_THRESHOLD = 10; // mètres
const DEFAULT_MIN_TIME_THRESHOLD = 5000; // millisecondes
const DEFAULT_ACCURACY = Location.Accuracy.BestForNavigation;
const DEFAULT_DISTANCE_INTERVAL = 10; // mètres
const DEFAULT_TIME_INTERVAL = 5000; // millisecondes
const EARTH_RADIUS = 6371e3; // Rayon de la Terre en mètres

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
    private lastSentPosition: { lat: number; lng: number; timestamp: number } | null = null;
    private minDistanceThreshold: number = DEFAULT_MIN_DISTANCE_THRESHOLD;
    private minTimeThreshold: number = DEFAULT_MIN_TIME_THRESHOLD;

    /**
     * Demander les permissions de localisation (foreground + background)
     */
    async requestPermissions(): Promise<boolean> {
        try {
            console.log('[LocationTracking] Demande des permissions de localisation...');

            const foregroundResult = await Location.requestForegroundPermissionsAsync();
            console.log('[LocationTracking] Permission foreground:', foregroundResult.status);

            if (foregroundResult.status !== 'granted') {
                console.error('[LocationTracking] Permission foreground refusée');
                return false;
            }

            console.log('[LocationTracking] Permission foreground accordée');

            const backgroundResult = await Location.requestBackgroundPermissionsAsync();
            console.log('[LocationTracking] Permission background:', backgroundResult.status);

            if (backgroundResult.status !== 'granted') {
                console.warn('[LocationTracking] Permission background refusée - Le tracking s\'arrêtera en arrière-plan');
            } else {
                console.log('[LocationTracking] Permission background accordée - Tracking continu activé');
            }

            const finalForeground = await Location.getForegroundPermissionsAsync();
            const finalBackground = await Location.getBackgroundPermissionsAsync();
            
            console.log('[LocationTracking] État final des permissions:', {
                foreground: finalForeground.status,
                background: finalBackground.status,
                canTrackInBackground: finalBackground.status === 'granted',
            });

            return true;
        } catch (error) {
            console.error('[LocationTracking] Erreur lors de la demande de permissions:', error);
            return false;
        }
    }

    /**
     * Vérifier si les permissions sont accordées (foreground + background)
     */
    async hasPermissions(): Promise<boolean> {
        try {
            const foreground = await Location.getForegroundPermissionsAsync();
            const background = await Location.getBackgroundPermissionsAsync();
            
            console.log('[LocationTracking] Vérification permissions:', {
                foreground: foreground.status,
                background: background.status,
            });
            
            const hasForeground = foreground.status === 'granted';
            const hasBackground = background.status === 'granted';
            
            if (hasForeground && !hasBackground) {
                console.warn('[LocationTracking] Permission background manquante - Tracking limité');
            }
            
            return hasForeground;
        } catch (error) {
            console.error('[LocationTracking] Erreur vérification permissions:', error);
            return false;
        }
    }

    /**
     * Démarrer le tracking de position avec configuration optimisée
     */
    async startTracking(config: TrackingConfig): Promise<boolean> {
        if (this.isTracking) {
            console.warn('[LocationTracking] Tracking déjà actif');
            return true;
        }

        const hasPermission = await this.hasPermissions();
        if (!hasPermission) {
            const granted = await this.requestPermissions();
            if (!granted) {
                return false;
            }
        }

        if (!socketService.connected) {
            console.error('[LocationTracking] Socket non connecté');
            return false;
        }

        try {
            this.currentBusId = config.busId;
            socketService.joinBusRoom(config.busId);

            const accuracy = config.accuracy || DEFAULT_ACCURACY;
            const distanceInterval = config.distanceInterval || DEFAULT_DISTANCE_INTERVAL;
            const timeInterval = config.timeInterval || DEFAULT_TIME_INTERVAL;

            console.log('[LocationTracking] Démarrage du suivi GPS avec config:', {
                busId: config.busId,
                accuracy: accuracy,
                distanceInterval: distanceInterval + 'm',
                timeInterval: timeInterval + 'ms',
                minDistanceThreshold: this.minDistanceThreshold + 'm',
                minTimeThreshold: (this.minTimeThreshold / 1000) + 's',
            });

            this.subscription = await Location.watchPositionAsync(
                {
                    accuracy,
                    distanceInterval,
                    timeInterval,
                    mayShowUserSettingsDialog: true,
                    // @ts-ignore
                    foregroundService: {
                        notificationTitle: 'Trajet en cours',
                        notificationBody: 'Votre position est partagée en temps réel',
                        notificationColor: '#1776BA',
                    },
                },
                (location) => this.handleLocationUpdate(location, config.busId)
            );

            this.isTracking = true;
            console.log('[LocationTracking] Tracking démarré avec succès pour le bus:', config.busId);
            return true;
        } catch (error) {
            console.error('[LocationTracking] Erreur lors du démarrage du tracking:', error);
            return false;
        }
    }

    /**
     * Vérifier si la position doit être envoyée selon les critères
     */
    private shouldSendPosition(location: Location.LocationObject): { send: boolean; reason: string } {
        if (!this.lastSentPosition) {
            return { send: true, reason: 'Première position' };
        }

        const distance = this.calculateDistance(
            this.lastSentPosition.lat,
            this.lastSentPosition.lng,
            location.coords.latitude,
            location.coords.longitude
        );

        const timeElapsed = location.timestamp - this.lastSentPosition.timestamp;

        console.log('[LocationTracking] Distance depuis dernière position:', distance.toFixed(2) + 'm (seuil: ' + this.minDistanceThreshold + 'm)');
        console.log('[LocationTracking] Temps écoulé depuis dernier envoi:', (timeElapsed / 1000).toFixed(1) + 's (seuil: ' + (this.minTimeThreshold / 1000) + 's)');

        if (distance >= this.minDistanceThreshold) {
            return { send: true, reason: `Déplacement de ${distance.toFixed(2)}m` };
        }

        if (timeElapsed >= this.minTimeThreshold) {
            return { send: true, reason: `Intervalle de temps (${(timeElapsed / 1000).toFixed(1)}s, distance: ${distance.toFixed(2)}m)` };
        }

        return { send: false, reason: 'Seuils non atteints' };
    }

    /**
     * Gérer une mise à jour de position et décider si elle doit être envoyée
     */
    private handleLocationUpdate(location: Location.LocationObject, busId: string): void {
        const { latitude, longitude, speed, heading, accuracy } = location.coords;

        console.log('[LocationTracking] Position GPS reçue:', {
            lat: latitude.toFixed(6),
            lng: longitude.toFixed(6),
            speed: speed ? (speed * 3.6).toFixed(1) + ' km/h' : '0.0 km/h',
            accuracy: accuracy ? accuracy.toFixed(1) + 'm' : 'N/A',
        });

        const { send, reason } = this.shouldSendPosition(location);

        if (!send) {
            console.log('[LocationTracking] Position ignorée (déplacement < ' + this.minDistanceThreshold + 'm ET temps < ' + (this.minTimeThreshold / 1000) + 's)');
            return;
        }

        console.log('[LocationTracking] Envoi de la position - Raison:', reason);

        const positionData = {
            busId,
            lat: latitude,
            lng: longitude,
            speed: speed || 0,
            heading: heading || 0,
            accuracy: accuracy || 0,
            timestamp: location.timestamp,
        };

        socketService.sendPosition(positionData);

        this.lastSentPosition = {
            lat: latitude,
            lng: longitude,
            timestamp: location.timestamp,
        };

        console.log('[LocationTracking] Position envoyée au Socket.IO:', {
            busId,
            coordinates: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            speed: speed ? (speed * 3.6).toFixed(1) + ' km/h' : '0.0 km/h',
            timestamp: new Date(location.timestamp).toLocaleTimeString('fr-FR'),
        });
    }

    /**
     * Calculer la distance entre deux points (formule de Haversine)
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        
        const φ1 = toRad(lat1);
        const φ2 = toRad(lat2);
        const Δφ = toRad(lat2 - lat1);
        const Δλ = toRad(lon2 - lon1);

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS * c;
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
            if (this.subscription) {
                this.subscription.remove();
                this.subscription = null;
            }

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
        console.log('[LocationTracking] Seuil de distance mis à jour:', meters + 'm');
    }

    /**
     * Définir le seuil de temps minimum pour envoyer une mise à jour
     */
    setMinTimeThreshold(milliseconds: number): void {
        this.minTimeThreshold = Math.max(1000, milliseconds);
        console.log('[LocationTracking] Seuil de temps mis à jour:', (milliseconds / 1000) + 's');
    }
}

export const locationTrackingService = new LocationTrackingService();
