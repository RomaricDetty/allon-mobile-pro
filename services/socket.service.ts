import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

/**
 * Service de gestion des connexions Socket.IO pour le tracking en temps réel
 * Implémente un pattern singleton pour garantir une seule connexion active
 */
class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Initialise et connecte le socket avec authentification
   */
  async connect(config?: SocketConfig): Promise<void> {
    if (this.socket?.connected) {
      console.log('[SocketService] Déjà connecté');
      return;
    }

    try {
      // Récupérer le token d'authentification
      const token = await AsyncStorage.getItem('userToken');
      
      const socketUrl = config?.url || 'https://dev-allon-backend.onrender.com';
      
      this.socket = io(socketUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: config?.reconnectionAttempts || this.maxReconnectAttempts,
        reconnectionDelay: config?.reconnectionDelay || 1000,
        auth: {
          token: token || '',
        },
        query: {
          platform: 'mobile-driver',
        },
      });

      this.setupEventHandlers();
      
      console.log('[SocketService] Connexion initiée');
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
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('[SocketService] Déconnecté:', reason);
      this.emit('connection:lost', { reason });
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.error('[SocketService] Erreur de connexion:', error.message);
      this.emit('connection:error', { error: error.message, attempts: this.reconnectAttempts });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[SocketService] Reconnecté après', attemptNumber, 'tentatives');
      this.emit('connection:reconnected', { attempts: attemptNumber });
    });
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
   * Envoyer une mise à jour de position
   */
  sendPosition(data: BusPosition): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Socket non connecté, position non envoyée');
      return;
    }

    // Validation des données
    if (!data.busId || typeof data.lat !== 'number' || typeof data.lng !== 'number') {
      console.error('[SocketService] Données de position invalides:', data);
      return;
    }

    // Vérifier que les coordonnées sont valides
    if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) {
      console.error('[SocketService] Coordonnées hors limites:', data);
      return;
    }

    this.socket.emit('bus:position:update', {
      ...data,
      timestamp: data.timestamp || Date.now(),
    });
  }

  /**
   * Écouter les mises à jour de position d'un bus
   */
  onBusPosition(busId: string, callback: (data: BusPosition) => void): () => void {
    if (!this.socket) {
      console.warn('[SocketService] Socket non initialisé');
      return () => {};
    }

    const handler = (data: BusPosition) => {
      if (data.busId === busId) {
        callback(data);
      }
    };

    this.socket.on('bus:position:update', handler);

    // Retourner une fonction de nettoyage
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

    // Retourner une fonction de nettoyage
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
   * Déconnecter le socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
      console.log('[SocketService] Déconnecté manuellement');
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

// Export d'une instance unique (singleton)
export const socketService = new SocketService();
