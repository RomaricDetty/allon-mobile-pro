/**
 * Point d'entrée centralisé pour tous les services de tracking
 * 
 * @example
 * ```typescript
 * import { socketService, locationTrackingService, TRACKING_CONFIG } from '@/services';
 * ```
 */

// Services
export { socketService } from './socket.service';
export { locationTrackingService } from './location-tracking.service';

// Configuration
export { 
  TRACKING_CONFIG, 
  TRACKING_PRESETS, 
  TRACKING_ERRORS,
  SOCKET_EVENTS 
} from './tracking.config';

// Types
export type {
  BusPosition,
  TrackingConfig,
  TrackingOptions,
  TrackingState,
  SocketConfig,
  LocationUpdate,
  ConnectionEvent,
  SocketEvents,
  PositionCallback,
  ConnectionCallback,
  TrackingResult,
  TrackingStats,
  BatteryOptions,
  TrackingPreset,
  BusTrackingControlProps,
  DepartureInfo,
  PermissionStatus,
  PermissionInfo,
} from '@/types/tracking.types';

export { TrackingError } from '@/types/tracking.types';
