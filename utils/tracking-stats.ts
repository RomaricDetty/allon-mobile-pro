/**
 * Utilitaires pour calculer les statistiques de tracking
 */

interface Position {
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
}

/**
 * Calculer la distance entre deux points GPS (formule de Haversine)
 * @param lat1 Latitude du point 1
 * @param lon1 Longitude du point 1
 * @param lat2 Latitude du point 2
 * @param lon2 Longitude du point 2
 * @returns Distance en mètres
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculer la distance totale parcourue à partir d'un tableau de positions
 * @param positions Tableau de positions
 * @returns Distance totale en mètres
 */
export function calculateTotalDistance(positions: Position[]): number {
  if (positions.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];
    totalDistance += calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
  }

  return totalDistance;
}

/**
 * Calculer la vitesse moyenne à partir d'un tableau de positions
 * @param positions Tableau de positions
 * @returns Vitesse moyenne en m/s
 */
export function calculateAverageSpeed(positions: Position[]): number {
  if (positions.length < 2) return 0;

  const totalDistance = calculateTotalDistance(positions);
  const totalTime = (positions[positions.length - 1].timestamp - positions[0].timestamp) / 1000;

  if (totalTime === 0) return 0;

  return totalDistance / totalTime;
}

/**
 * Calculer la durée totale du trajet
 * @param positions Tableau de positions
 * @returns Durée en millisecondes
 */
export function calculateDuration(positions: Position[]): number {
  if (positions.length < 2) return 0;
  return positions[positions.length - 1].timestamp - positions[0].timestamp;
}

/**
 * Formater une distance en texte lisible
 * @param meters Distance en mètres
 * @returns Texte formaté (ex: "1.5 km" ou "150 m")
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Formater une vitesse en texte lisible
 * @param metersPerSecond Vitesse en m/s
 * @returns Texte formaté (ex: "50 km/h")
 */
export function formatSpeed(metersPerSecond: number): string {
  const kmh = metersPerSecond * 3.6;
  return `${Math.round(kmh)} km/h`;
}

/**
 * Formater une durée en texte lisible
 * @param milliseconds Durée en millisecondes
 * @returns Texte formaté (ex: "1h 30min" ou "45min")
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  }

  if (minutes > 0) {
    return `${minutes}min`;
  }

  return `${seconds}s`;
}

/**
 * Calculer le bearing (direction) entre deux points
 * @param lat1 Latitude du point 1
 * @param lon1 Longitude du point 1
 * @param lat2 Latitude du point 2
 * @param lon2 Longitude du point 2
 * @returns Bearing en degrés (0-360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * Convertir un bearing en direction cardinale
 * @param bearing Bearing en degrés
 * @returns Direction cardinale (ex: "N", "NE", "E", etc.)
 */
export function bearingToCardinal(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

/**
 * Vérifier si un point est dans un rayon donné d'un autre point
 * @param lat1 Latitude du point 1
 * @param lon1 Longitude du point 1
 * @param lat2 Latitude du point 2
 * @param lon2 Longitude du point 2
 * @param radius Rayon en mètres
 * @returns true si le point est dans le rayon
 */
export function isWithinRadius(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radius: number
): boolean {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance <= radius;
}

/**
 * Calculer les statistiques complètes d'un trajet
 * @param positions Tableau de positions
 * @returns Objet contenant toutes les statistiques
 */
export function calculateTrackingStats(positions: Position[]) {
  if (positions.length === 0) {
    return {
      totalDistance: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      duration: 0,
      positionsCount: 0,
      startTime: null,
      endTime: null,
    };
  }

  const totalDistance = calculateTotalDistance(positions);
  const averageSpeed = calculateAverageSpeed(positions);
  const maxSpeed = Math.max(...positions.map(p => p.speed || 0));
  const duration = calculateDuration(positions);

  return {
    totalDistance,
    averageSpeed,
    maxSpeed,
    duration,
    positionsCount: positions.length,
    startTime: positions[0].timestamp,
    endTime: positions[positions.length - 1].timestamp,
  };
}

/**
 * Simplifier un tableau de positions (algorithme de Douglas-Peucker simplifié)
 * Utile pour réduire le nombre de points à afficher sur une carte
 * @param positions Tableau de positions
 * @param tolerance Tolérance en mètres
 * @returns Tableau de positions simplifié
 */
export function simplifyPositions(
  positions: Position[],
  tolerance: number = 10
): Position[] {
  if (positions.length <= 2) return positions;

  const simplified: Position[] = [positions[0]];

  for (let i = 1; i < positions.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = positions[i];
    const distance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);

    if (distance >= tolerance) {
      simplified.push(curr);
    }
  }

  simplified.push(positions[positions.length - 1]);

  return simplified;
}

/**
 * Interpoler une position entre deux points
 * @param pos1 Position 1
 * @param pos2 Position 2
 * @param fraction Fraction entre 0 et 1
 * @returns Position interpolée
 */
export function interpolatePosition(
  pos1: Position,
  pos2: Position,
  fraction: number
): Position {
  return {
    lat: pos1.lat + (pos2.lat - pos1.lat) * fraction,
    lng: pos1.lng + (pos2.lng - pos1.lng) * fraction,
    timestamp: pos1.timestamp + (pos2.timestamp - pos1.timestamp) * fraction,
    speed: pos1.speed && pos2.speed 
      ? pos1.speed + (pos2.speed - pos1.speed) * fraction 
      : undefined,
  };
}

/**
 * Détecter si le véhicule est à l'arrêt
 * @param positions Dernières positions (au moins 3)
 * @param speedThreshold Seuil de vitesse en m/s (par défaut 0.5 m/s = 1.8 km/h)
 * @returns true si le véhicule est à l'arrêt
 */
export function isVehicleStopped(
  positions: Position[],
  speedThreshold: number = 0.5
): boolean {
  if (positions.length < 3) return false;

  const recentPositions = positions.slice(-3);
  const speeds = recentPositions.map(p => p.speed || 0);
  const averageSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

  return averageSpeed < speedThreshold;
}
