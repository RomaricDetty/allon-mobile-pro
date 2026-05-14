import { locationTrackingService } from '@/services/location-tracking.service';
import { socketService } from '@/services/socket.service';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface BusPosition {
  busId: string;
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

interface TrackingOptions {
  accuracy?: Location.Accuracy;
  distanceInterval?: number;
  timeInterval?: number;
  autoConnect?: boolean;
}

interface TrackingState {
  isTracking: boolean;
  isConnected: boolean;
  hasPermission: boolean;
  error: string | null;
  lastPosition: BusPosition | null;
}

/**
 * Hook personnalisé pour gérer le tracking de position d'un bus en temps réel
 * 
 * @param busId - ID du bus à tracker
 * @param options - Options de configuration du tracking
 * 
 * @example
 * ```tsx
 * const { startTracking, stopTracking, isTracking, lastPosition } = useBusTracking('bus-123');
 * 
 * // Démarrer le tracking
 * await startTracking();
 * 
 * // Arrêter le tracking
 * await stopTracking();
 * ```
 */
export function useBusTracking(busId: string, options: TrackingOptions = {}) {
  const [state, setState] = useState<TrackingState>({
    isTracking: false,
    isConnected: false,
    hasPermission: false,
    error: null,
    lastPosition: null,
  });

  const appState = useRef(AppState.currentState);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ref pour éviter les closures obsolètes (reconnexion, AppState, événements socket). */
  const isTrackingRef = useRef(false);

  /**
   * Initialiser la connexion Socket.IO
   */
  const initializeSocket = useCallback(async () => {
    try {
      if (!socketService.connected) {
        await socketService.connect();
      }
      setState(prev => ({ ...prev, isConnected: true, error: null }));
    } catch (error) {
      console.error('[useBusTracking] Erreur de connexion socket:', error);
      setState(prev => ({ 
        ...prev, 
        isConnected: false, 
        error: 'Erreur de connexion au serveur' 
      }));
    }
  }, []);

  /**
   * Vérifier les permissions de localisation
   */
  const checkPermissions = useCallback(async () => {
    const hasPermission = await locationTrackingService.hasPermissions();
    setState(prev => ({ ...prev, hasPermission }));
    return hasPermission;
  }, []);

  /**
   * Démarrer le tracking de position
   */
  const startTracking = useCallback(async (): Promise<boolean> => {
    try {
      // Vérifier et initialiser la connexion socket
      if (!socketService.connected) {
        await initializeSocket();
      }

      // Démarrer le tracking de localisation
      const success = await locationTrackingService.startTracking({
        busId,
        accuracy: options.accuracy || Location.Accuracy.BestForNavigation,
        distanceInterval: options.distanceInterval || 10,
        timeInterval: options.timeInterval || 5000,
      });

      if (success) {
        isTrackingRef.current = true;
        setState(prev => ({ 
          ...prev, 
          isTracking: true, 
          hasPermission: true,
          error: null 
        }));
        console.log('[useBusTracking] Tracking démarré avec succès');
        return true;
      } else {
        setState(prev => ({ 
          ...prev, 
          error: 'Impossible de démarrer le tracking' 
        }));
        return false;
      }
    } catch (error) {
      console.error('[useBusTracking] Erreur lors du démarrage:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Erreur lors du démarrage du tracking' 
      }));
      return false;
    }
  }, [busId, options, initializeSocket]);

  /**
   * Arrêter le tracking de position
   */
  const stopTracking = useCallback(async () => {
    try {
      await locationTrackingService.stopTracking();
      isTrackingRef.current = false;
      setState(prev => ({ 
        ...prev, 
        isTracking: false,
        lastPosition: null 
      }));
      console.log('[useBusTracking] Tracking arrêté');
    } catch (error) {
      console.error('[useBusTracking] Erreur lors de l\'arrêt:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Erreur lors de l\'arrêt du tracking' 
      }));
    }
  }, []);

  /**
   * Écouter les mises à jour de position du bus
   */
  const listenToPosition = useCallback((callback: (position: BusPosition) => void) => {
    const unsubscribe = socketService.onBusPosition(busId, (data) => {
      setState(prev => ({ ...prev, lastPosition: data }));
      callback(data);
    });

    return unsubscribe;
  }, [busId]);

  /**
   * Gérer les changements d'état de l'application
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // Si l'app passe en arrière-plan
      if (appState.current.match(/active/) && nextAppState === 'background') {
        console.log('[useBusTracking] App en arrière-plan');
        // Le tracking continue en arrière-plan si les permissions sont accordées
      }

      // Si l'app revient au premier plan
      if (appState.current.match(/background/) && nextAppState === 'active') {
        console.log('[useBusTracking] App au premier plan');
        
        // Vérifier la connexion socket et reconnecter si nécessaire
        if (isTrackingRef.current && !socketService.connected) {
          console.log('[useBusTracking] Reconnexion socket...');
          initializeSocket();
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [initializeSocket]);

  /**
   * Gérer les événements de connexion socket
   */
  useEffect(() => {
    const unsubscribeConnectionLost = socketService.on('connection:lost', () => {
      setState(prev => ({ ...prev, isConnected: false }));
      
      // Tenter une reconnexion après 3 secondes
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isTrackingRef.current) {
          console.log('[useBusTracking] Tentative de reconnexion...');
          initializeSocket();
        }
      }, 3000);
    });

    const unsubscribeConnectionSuccess = socketService.on('connection:success', () => {
      setState(prev => ({ ...prev, isConnected: true, error: null }));
      
      // Rejoindre la room si le tracking est actif
      if (isTrackingRef.current) {
        socketService.joinBusRoom(busId);
      }
    });

    return () => {
      unsubscribeConnectionLost();
      unsubscribeConnectionSuccess();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [busId, initializeSocket]);

  /**
   * Auto-connexion au montage du composant
   */
  useEffect(() => {
    if (options.autoConnect) {
      initializeSocket();
      checkPermissions();
    }

    return () => {
      if (isTrackingRef.current) {
        void locationTrackingService.stopTracking();
        isTrackingRef.current = false;
      }
    };
  }, [options.autoConnect, initializeSocket, checkPermissions]);

  return {
    // État
    isTracking: state.isTracking,
    isConnected: state.isConnected,
    hasPermission: state.hasPermission,
    error: state.error,
    lastPosition: state.lastPosition,
    
    // Actions
    startTracking,
    stopTracking,
    listenToPosition,
    checkPermissions,
    
    // Utilitaires
    socketId: socketService.socketId,
  };
}
