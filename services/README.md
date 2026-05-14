# Services de Tracking en Temps Réel

Ce dossier contient tous les services nécessaires pour le tracking de position en temps réel des bus.

## Structure

```
services/
├── socket.service.ts              # Service Socket.IO
├── location-tracking.service.ts   # Service de géolocalisation
├── tracking.config.ts             # Configuration et constantes
├── index.ts                       # Point d'entrée centralisé
└── __tests__/                     # Tests unitaires
    └── socket.service.test.ts
```

## Utilisation rapide

### Import simple

```typescript
import { socketService, locationTrackingService } from '@/services';
```

### Démarrer le tracking

```typescript
// 1. Connecter le socket
await socketService.connect();

// 2. Démarrer le tracking
await locationTrackingService.startTracking({
  busId: 'bus-123',
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 10,
  timeInterval: 5000,
});

// 3. Écouter les positions
socketService.onBusPosition('bus-123', (position) => {
  console.log('Position:', position);
});
```

### Arrêter le tracking

```typescript
await locationTrackingService.stopTracking();
socketService.disconnect();
```

## Services disponibles

### 1. SocketService (`socket.service.ts`)

Gère les connexions WebSocket avec Socket.IO.

**Méthodes principales :**
- `connect(config?)` - Se connecter au serveur
- `disconnect()` - Se déconnecter
- `joinBusRoom(busId)` - Rejoindre une room de bus
- `leaveBusRoom(busId)` - Quitter une room de bus
- `sendPosition(data)` - Envoyer une position
- `onBusPosition(busId, callback)` - Écouter les positions
- `on(event, callback)` - Écouter un événement

**Propriétés :**
- `connected` - État de la connexion
- `socketId` - ID du socket

**Exemple :**

```typescript
import { socketService } from '@/services';

// Connexion
await socketService.connect({
  url: 'https://dev-allon-backend.onrender.com',
  reconnectionAttempts: 5,
});

// Rejoindre une room
socketService.joinBusRoom('bus-123');

// Envoyer une position
socketService.sendPosition({
  busId: 'bus-123',
  lat: 48.8566,
  lng: 2.3522,
  timestamp: Date.now(),
});

// Écouter les positions
const unsubscribe = socketService.onBusPosition('bus-123', (position) => {
  console.log('Position reçue:', position);
});

// Nettoyer
unsubscribe();
socketService.disconnect();
```

### 2. LocationTrackingService (`location-tracking.service.ts`)

Gère le suivi GPS et l'envoi automatique des positions.

**Méthodes principales :**
- `requestPermissions()` - Demander les permissions
- `hasPermissions()` - Vérifier les permissions
- `startTracking(config)` - Démarrer le tracking
- `stopTracking()` - Arrêter le tracking
- `getCurrentPosition()` - Obtenir la position actuelle
- `setMinDistanceThreshold(meters)` - Définir le seuil de distance

**Propriétés :**
- `tracking` - État du tracking
- `activeBusId` - ID du bus actuellement tracké

**Exemple :**

```typescript
import { locationTrackingService } from '@/services';

// Vérifier les permissions
const hasPermission = await locationTrackingService.hasPermissions();
if (!hasPermission) {
  await locationTrackingService.requestPermissions();
}

// Démarrer le tracking
const success = await locationTrackingService.startTracking({
  busId: 'bus-123',
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 10, // mètres
  timeInterval: 5000, // ms
});

if (success) {
  console.log('Tracking démarré');
}

// Obtenir la position actuelle
const position = await locationTrackingService.getCurrentPosition();
console.log('Position actuelle:', position);

// Arrêter le tracking
await locationTrackingService.stopTracking();
```

### 3. Configuration (`tracking.config.ts`)

Contient toutes les constantes et configurations.

**Exports :**
- `TRACKING_CONFIG` - Configuration générale
- `TRACKING_PRESETS` - Presets de configuration
- `TRACKING_ERRORS` - Messages d'erreur
- `SOCKET_EVENTS` - Événements Socket.IO

**Exemple :**

```typescript
import { TRACKING_CONFIG, TRACKING_PRESETS } from '@/services';

// Utiliser la configuration par défaut
const { ACCURACY, DISTANCE_INTERVAL } = TRACKING_CONFIG;

// Utiliser un preset
const { accuracy, distanceInterval, timeInterval } = TRACKING_PRESETS.NORMAL;

// Utiliser un preset d'économie de batterie
const config = TRACKING_PRESETS.BATTERY_SAVER;
```

## Configuration

### Modifier l'URL du serveur

Dans `tracking.config.ts` :

```typescript
export const TRACKING_CONFIG = {
  SOCKET: {
    URL: 'https://votre-serveur.com',
    // ...
  },
};
```

### Ajuster les intervalles de tracking

```typescript
export const TRACKING_CONFIG = {
  DISTANCE_INTERVAL: 10, // mètres
  TIME_INTERVAL: 5000, // ms
  MIN_DISTANCE_THRESHOLD: 10, // mètres
};
```

### Créer un preset personnalisé

```typescript
export const TRACKING_PRESETS = {
  // ...
  CUSTOM: {
    accuracy: Location.Accuracy.High,
    distanceInterval: 15,
    timeInterval: 7000,
  },
};
```

## Sécurité

### Authentification

Le service inclut automatiquement le token d'authentification dans les connexions Socket.IO :

```typescript
const token = await AsyncStorage.getItem('token');

this.socket = io(socketUrl, {
  auth: {
    token: token || '',
  },
});
```

### Validation des données

Toutes les positions sont validées avant envoi :

```typescript
// Vérification du busId
if (!data.busId) return;

// Vérification des coordonnées
if (data.lat < -90 || data.lat > 90) return;
if (data.lng < -180 || data.lng > 180) return;
```

## Événements

### Événements Socket.IO

| Événement | Direction | Description |
|-----------|-----------|-------------|
| `bus:join` | Client → Serveur | Rejoindre une room |
| `bus:leave` | Client → Serveur | Quitter une room |
| `bus:position:update` | Client ↔ Serveur | Mise à jour de position |
| `connect` | Serveur → Client | Connexion établie |
| `disconnect` | Serveur → Client | Déconnexion |
| `connect_error` | Serveur → Client | Erreur de connexion |

### Événements locaux

| Événement | Description |
|-----------|-------------|
| `connection:success` | Connexion réussie |
| `connection:lost` | Connexion perdue |
| `connection:error` | Erreur de connexion |
| `connection:reconnected` | Reconnexion réussie |

**Exemple :**

```typescript
socketService.on('connection:lost', (data) => {
  console.log('Connexion perdue:', data.reason);
});

socketService.on('connection:success', (data) => {
  console.log('Connecté avec l\'ID:', data.socketId);
});
```

## Tests

Pour exécuter les tests :

```bash
npm test services/__tests__/socket.service.test.ts
```

## Documentation complète

Pour plus d'informations, consultez :
- [Guide complet](../docs/TRACKING_GUIDE.md)
- [Exemples d'utilisation](../examples/TrackingExample.tsx)
- [Types TypeScript](../types/tracking.types.ts)

## Dépannage

### Le service ne se connecte pas

```typescript
// Vérifier l'état de la connexion
console.log('Connecté:', socketService.connected);
console.log('Socket ID:', socketService.socketId);

// Forcer une reconnexion
socketService.disconnect();
await socketService.connect();
```

### Le tracking ne démarre pas

```typescript
// Vérifier les permissions
const hasPermission = await locationTrackingService.hasPermissions();
console.log('Permission:', hasPermission);

// Vérifier l'état du tracking
console.log('Tracking actif:', locationTrackingService.tracking);
console.log('Bus ID:', locationTrackingService.activeBusId);
```

### Les positions ne sont pas envoyées

```typescript
// Réduire le seuil de distance
locationTrackingService.setMinDistanceThreshold(5);

// Vérifier la connexion socket
if (!socketService.connected) {
  await socketService.connect();
}
```

## Liens utiles

- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [Socket.IO Client](https://socket.io/docs/v4/client-api/)
- [React Native Geolocation](https://reactnative.dev/docs/geolocation)
