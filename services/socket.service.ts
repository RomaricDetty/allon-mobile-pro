import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';

interface BusPosition {
    busId: string;
    lat: number;
    lng: number;
    timestamp: number;
    speed?: number;
    heading?: number;
}

interface SocketConfig {
    url?: string;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
}

// Constantes de configuration
const DEFAULT_SOCKET_URL = 'https://dev-allon-backend.onrender.com';
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECTION_DELAY = 1000;
const RECONNECTION_DELAY_MAX = 5000;
const CONNECTION_TIMEOUT = 20000;
const HEARTBEAT_INTERVAL = 30000;
const RECONNECT_DELAY = 2000;

/**
 * Service de gestion des connexions Socket.IO pour le tracking en temps réel
 * Implémente un pattern singleton pour garantir une seule connexion active
 */
class SocketService {
    private socket: Socket | null = null;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private listeners: Map<string, Set<Function>> = new Map();
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    /**
     * Initialise et connecte le socket avec authentification
     * Attend que la connexion soit établie avant de résoudre la promesse
     */
    async connect(config?: SocketConfig): Promise<void> {
        if (this.socket?.connected) {
            console.log('[SocketService] Déjà connecté');
            return;
        }

        try {
            const token = await AsyncStorage.getItem('userToken');
            const socketUrl = config?.url || DEFAULT_SOCKET_URL;

            console.log('[SocketService] Connexion à:', socketUrl);

            this.socket = io(socketUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: config?.reconnectionAttempts || MAX_RECONNECT_ATTEMPTS,
                reconnectionDelay: config?.reconnectionDelay || RECONNECTION_DELAY,
                reconnectionDelayMax: RECONNECTION_DELAY_MAX,
                timeout: CONNECTION_TIMEOUT,
                autoConnect: true,
                forceNew: false,
                auth: { token: token || '' },
                query: {
                    platform: 'mobile-driver',
                    version: '1.0.0',
                },
            });

            this.setupEventHandlers();

            console.log('[SocketService] Attente de la connexion...');

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    console.error('[SocketService] Timeout de connexion (' + (CONNECTION_TIMEOUT / 1000) + 's)');
                    reject(new Error('Timeout de connexion Socket.IO'));
                }, CONNECTION_TIMEOUT);

                const onConnect = () => {
                    clearTimeout(timeout);
                    console.log('[SocketService] Connexion établie avec succès');
                    this.socket?.off('connect', onConnect);
                    this.socket?.off('connect_error', onError);
                    resolve();
                };

                const onError = (error: Error) => {
                    clearTimeout(timeout);
                    console.error('[SocketService] Erreur lors de la connexion:', error.message);
                    this.socket?.off('connect', onConnect);
                    this.socket?.off('connect_error', onError);
                    reject(error);
                };

                this.socket?.on('connect', onConnect);
                this.socket?.on('connect_error', onError);
            });
        } catch (error) {
            console.error('[SocketService] Erreur de connexion:', error);
            throw error;
        }
    }

    /**
     * Configure les gestionnaires d'événements du socket
     */
    private setupEventHandlers(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            console.log('[SocketService] Connecté - ID:', this.socket?.id);
            this.emit('connection:success', { socketId: this.socket?.id });
            this.startHeartbeat();
        });

        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            console.log('[SocketService] Déconnecté:', reason);
            this.emit('connection:lost', { reason });
            this.stopHeartbeat();
            
            if (reason === 'io server disconnect' || reason === 'transport close') {
                console.log('[SocketService] Reconnexion automatique dans ' + (RECONNECT_DELAY / 1000) + 's...');
                this.scheduleReconnect();
            }
        });

        this.socket.on('connect_error', (error) => {
            this.reconnectAttempts++;
            console.error('[SocketService] Erreur de connexion (tentative ' + this.reconnectAttempts + '):', error.message);
            this.emit('connection:error', { error: error.message, attempts: this.reconnectAttempts });
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('[SocketService] Reconnecté après ' + attemptNumber + ' tentatives');
            this.emit('connection:reconnected', { attempts: attemptNumber });
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('[SocketService] Tentative de reconnexion ' + attemptNumber + '/' + MAX_RECONNECT_ATTEMPTS);
        });

        this.socket.on('reconnect_failed', () => {
            console.error('[SocketService] Échec de reconnexion après ' + MAX_RECONNECT_ATTEMPTS + ' tentatives');
            this.emit('connection:failed', { maxAttempts: MAX_RECONNECT_ATTEMPTS });
        });

        this.socket.on('bus:position:received', (data) => {
            this.logPositionData('Confirmation serveur - Position reçue', data);
        });

        this.socket.on('bus:position:update', (data) => {
            this.logPositionData('Position reçue du socket', data);
            this.emit('position:received', data);
        });

        this.socket.on('error', (error) => {
            console.error('[SocketService] Erreur serveur:', error);
        });

        this.socket.on('pong', () => {
            console.log('[SocketService] Heartbeat OK');
        });
    }

    /**
     * Logger les données de position de manière formatée
     */
    private logPositionData(prefix: string, data: BusPosition): void {
        console.log(`[SocketService] ${prefix}:`, {
            busId: data.busId,
            lat: data.lat?.toFixed(6),
            lng: data.lng?.toFixed(6),
            speed: data.speed ? (data.speed * 3.6).toFixed(1) + ' km/h' : '0.0 km/h',
            timestamp: new Date(data.timestamp).toLocaleTimeString(),
        });
    }

    /**
     * Démarrer le heartbeat pour maintenir la connexion active
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.socket?.connected) {
                this.socket.emit('ping');
            }
        }, HEARTBEAT_INTERVAL);
        
        console.log('[SocketService] Heartbeat démarré (intervalle: ' + (HEARTBEAT_INTERVAL / 1000) + 's)');
    }

    /**
     * Arrêter le heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('[SocketService] Heartbeat arrêté');
        }
    }

    /**
     * Planifier une reconnexion automatique
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        this.reconnectTimer = setTimeout(() => {
            if (!this.socket?.connected) {
                console.log('[SocketService] Tentative de reconnexion...');
                this.socket?.connect();
            }
        }, RECONNECT_DELAY);
    }

    /**
     * Rejoindre une room de bus spécifique
     */
    joinBusRoom(busId: string): void {
        if (!this.socket?.connected) {
            console.warn('[SocketService] Socket non connecté, impossible de rejoindre la room');
            return;
        }

        this.socket.emit('bus:join', { busId });
        console.log('[SocketService] Rejoint la room du bus:', busId);
    }

    /**
     * Quitter une room de bus
     */
    leaveBusRoom(busId: string): void {
        if (!this.socket?.connected) return;

        this.socket.emit('bus:leave', { busId });
        console.log('[SocketService] Quitté la room du bus:', busId);
    }

    /**
     * Valider les données de position
     */
    private validatePosition(data: BusPosition): boolean {
        if (!this.socket?.connected) {
            console.error('[SocketService] Socket non connecté, position non envoyée');
            return false;
        }

        if (!data.busId || typeof data.lat !== 'number' || typeof data.lng !== 'number') {
            console.error('[SocketService] Données de position invalides:', data);
            return false;
        }

        if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) {
            console.error('[SocketService] Coordonnées hors limites:', { lat: data.lat, lng: data.lng });
            return false;
        }

        return true;
    }

    /**
     * Envoyer une mise à jour de position au serveur
     */
    sendPosition(data: BusPosition): void {
        if (!this.validatePosition(data)) {
            return;
        }

        const positionPayload = {
            ...data,
            timestamp: data.timestamp || Date.now(),
        };

        try {
            this.socket!.emit('bus:position:update', positionPayload);
            console.log('[SocketService] Position émise avec succès:', {
                busId: data.busId,
                coordinates: `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`,
                speed: data.speed ? `${(data.speed * 3.6).toFixed(1)} km/h` : 'N/A',
            });
        } catch (error) {
            console.error('[SocketService] Erreur lors de l\'émission de la position:', error);
        }
    }

    /**
     * Écouter les mises à jour de position d'un bus
     */
    onBusPosition(busId: string, callback: (data: BusPosition) => void): () => void {
        if (!this.socket) {
            console.warn('[SocketService] Socket non initialisé');
            return () => { };
        }

        const handler = (data: BusPosition) => {
            if (data.busId === busId) {
                callback(data);
            }
        };

        this.socket.on('bus:position:update', handler);

        return () => {
            this.socket?.off('bus:position:update', handler);
        };
    }

    /**
     * Écouter un événement personnalisé
     */
    on(event: string, callback: Function): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        this.listeners.get(event)?.add(callback);

        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }

    /**
     * Émettre un événement local
     */
    private emit(event: string, data: any): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }

    /**
     * Déconnecter le socket et nettoyer les ressources
     */
    disconnect(): void {
        console.log('[SocketService] Déconnexion...');
        
        this.stopHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.listeners.clear();
            console.log('[SocketService] Déconnecté et nettoyé');
        }
    }

    /**
     * Vérifier l'état de la connexion
     */
    get connected(): boolean {
        return this.isConnected && this.socket?.connected === true;
    }

    /**
     * Obtenir l'ID du socket
     */
    get socketId(): string | undefined {
        return this.socket?.id;
    }
}

export const socketService = new SocketService();
