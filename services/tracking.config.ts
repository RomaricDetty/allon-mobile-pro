import * as Location from 'expo-location';

/**
 * Configuration du tracking de position
 */
export const TRACKING_CONFIG = {
  // Précision de la localisation
  ACCURACY: Location.Accuracy.BestForNavigation,
  
  // Distance minimale (en mètres) avant d'envoyer une mise à jour
  DISTANCE_INTERVAL: 10,
  
  // Intervalle de temps (en ms) entre les mises à jour
  TIME_INTERVAL: 5000, // 5 secondes
  
  // Distance minimale (en mètres) pour considérer un déplacement significatif
  MIN_DISTANCE_THRESHOLD: 10,
  
  // Configuration Socket.IO
  SOCKET: {
    URL: 'https://dev-allon-backend.onrender.com',
    RECONNECTION_ATTEMPTS: 5,
    RECONNECTION_DELAY: 1000, // 1 seconde
    TIMEOUT: 10000, // 10 secondes
  },
  
  // Optimisation de la batterie
  BATTERY_OPTIMIZATION: {
    // Réduire la fréquence des mises à jour si la batterie est faible
    LOW_BATTERY_THRESHOLD: 20, // %
    LOW_BATTERY_TIME_INTERVAL: 10000, // 10 secondes
    LOW_BATTERY_DISTANCE_INTERVAL: 20, // 20 mètres
  },
};

/**
 * Configuration pour différents scénarios
 */
export const TRACKING_PRESETS = {
  // Haute précision - Consomme plus de batterie
  HIGH_ACCURACY: {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5,
    timeInterval: 3000,
  },
  
  // Précision normale - Équilibre entre précision et batterie
  NORMAL: {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,
    timeInterval: 5000,
  },
  
  // Économie de batterie - Moins précis mais économe
  BATTERY_SAVER: {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 20,
    timeInterval: 10000,
  },
};

/**
 * Messages d'erreur localisés
 */
export const TRACKING_ERRORS = {
  NO_PERMISSION: 'Permission de localisation refusée',
  SOCKET_DISCONNECTED: 'Connexion au serveur perdue',
  LOCATION_UNAVAILABLE: 'Impossible d\'obtenir la position',
  INVALID_BUS_ID: 'ID de bus invalide',
  ALREADY_TRACKING: 'Le tracking est déjà actif',
  NOT_TRACKING: 'Le tracking n\'est pas actif',
};

/**
 * Événements Socket.IO
 */
export const SOCKET_EVENTS = {
  // Événements émis par le client
  BUS_JOIN: 'bus:join',
  BUS_LEAVE: 'bus:leave',
  POSITION_UPDATE: 'bus:position:update',
  
  // Événements reçus du serveur
  POSITION_RECEIVED: 'bus:position:update',
  BUS_STATUS: 'bus:status',
  ERROR: 'error',
  
  // Événements de connexion
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  RECONNECT: 'reconnect',
};
