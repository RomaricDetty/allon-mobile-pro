/**
 * Types TypeScript pour le système de tracking
 */

import * as Location from 'expo-location';

/**
 * Position d'un bus avec métadonnées
 */
export interface BusPosition {
  busId: string;
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

/**
 * Configuration du tracking
 */
export interface TrackingConfig {
  busId: string;
  accuracy?: Location.Accuracy;
  distanceInterval?: number;
  timeInterval?: number;
}

/**
 * Options du hook useBusTracking
 */
export interface TrackingOptions {
  accuracy?: Location.Accuracy;
  distanceInterval?: number;
  timeInterval?: number;
  autoConnect?: boolean;
}

/**
 * État du tracking
 */
export interface TrackingState {
  isTracking: boolean;
  isConnected: boolean;
  hasPermission: boolean;
  error: string | null;
  lastPosition: BusPosition | null;
}

/**
 * Configuration Socket.IO
 */
export interface SocketConfig {
  url?: string;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  timeout?: number;
}

/**
 * Mise à jour de position locale
 */
export interface LocationUpdate {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  timestamp: number;
}

/**
 * Événements de connexion
 */
export type ConnectionEvent = 
  | 'connection:success'
  | 'connection:lost'
  | 'connection:error'
  | 'connection:reconnected';

/**
 * Événements Socket.IO
 */
export interface SocketEvents {
  // Événements client -> serveur
  'bus:join': { busId: string };
  'bus:leave': { busId: string };
  'bus:position:update': BusPosition;
  
  // Événements serveur -> client
  'bus:position:received': BusPosition;
  'bus:status': { busId: string; status: string };
  'error': { message: string; code?: string };
}

/**
 * Callback de position
 */
export type PositionCallback = (position: BusPosition) => void;

/**
 * Callback de connexion
 */
export type ConnectionCallback = (data: { socketId?: string; reason?: string; error?: string; attempts?: number }) => void;

/**
 * Résultat d'une opération de tracking
 */
export interface TrackingResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Statistiques de tracking
 */
export interface TrackingStats {
  totalPositionsSent: number;
  totalDistance: number;
  averageSpeed: number;
  duration: number;
  startTime: number;
  endTime?: number;
}

/**
 * Options de batterie
 */
export interface BatteryOptions {
  lowBatteryThreshold: number;
  lowBatteryTimeInterval: number;
  lowBatteryDistanceInterval: number;
}

/**
 * Preset de configuration
 */
export interface TrackingPreset {
  accuracy: Location.Accuracy;
  distanceInterval: number;
  timeInterval: number;
}

/**
 * Props du composant BusTrackingControl
 */
export interface BusTrackingControlProps {
  busId: string;
  departureId?: string;
  onTrackingStart?: () => void;
  onTrackingStop?: () => void;
  onPositionUpdate?: (position: BusPosition) => void;
  onError?: (error: string) => void;
  customStyles?: {
    container?: any;
    button?: any;
    buttonText?: any;
  };
}

/**
 * Informations de départ
 */
export interface DepartureInfo {
  id: string;
  busId: string;
  routeId: string;
  driverId: string;
  startTime: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

/**
 * Erreurs de tracking
 */
export enum TrackingError {
  NO_PERMISSION = 'NO_PERMISSION',
  SOCKET_DISCONNECTED = 'SOCKET_DISCONNECTED',
  LOCATION_UNAVAILABLE = 'LOCATION_UNAVAILABLE',
  INVALID_BUS_ID = 'INVALID_BUS_ID',
  ALREADY_TRACKING = 'ALREADY_TRACKING',
  NOT_TRACKING = 'NOT_TRACKING',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * État de la permission
 */
export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * Informations de permission
 */
export interface PermissionInfo {
  foreground: PermissionStatus;
  background: PermissionStatus;
  canRequestBackground: boolean;
}
