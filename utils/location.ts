/**
 * Utilitaires pour les calculs de localisation
 */

/**
 * Calcule la distance entre deux coordonnées (formule de Haversine)
 * @param lat1 Latitude du premier point
 * @param lon1 Longitude du premier point
 * @param lat2 Latitude du deuxième point
 * @param lon2 Longitude du deuxième point
 * @returns Distance en mètres
 */
export const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number => {
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
};

/**
 * Bearing géographique en degrés [0, 360) du point A vers B (latitude / longitude en degrés).
 */
export function bearingDegrees(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return ((θ * 180) / Math.PI + 360) % 360;
}

type SegmentProjection = {
    lat: number;
    lng: number;
    t: number;
    distM: number;
};

/**
 * Projette un point sur le segment [A,B] (coordonnées en degrés) et retourne la distance au segment.
 */
function projectPointOnSegment(
    lat: number,
    lng: number,
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): SegmentProjection {
    const cosLat = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
    const mx = (lng: number, la: number) => ({ x: lng * cosLat * 111320, y: la * 110540 });
    const A = mx(lng1, lat1);
    const B = mx(lng2, lat2);
    const P = mx(lng, lat);
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) {
        const px = P.x - A.x;
        const py = P.y - A.y;
        return { lat: lat1, lng: lng1, t: 0, distM: Math.sqrt(px * px + py * py) };
    }
    let t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = A.x + t * dx;
    const qy = A.y + t * dy;
    const rx = P.x - qx;
    const ry = P.y - qy;
    const distM = Math.sqrt(rx * rx + ry * ry);
    const latOut = lat1 + t * (lat2 - lat1);
    const lngOut = lng1 + t * (lng2 - lng1);
    return { lat: latOut, lng: lngOut, t, distM };
}

/**
 * Distance approximative (m) du point P au segment [A,B] en projection locale (segments courts).
 */
function distancePointToSegmentMeters(
    lat: number,
    lng: number,
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    return projectPointOnSegment(lat, lng, lat1, lng1, lat2, lng2).distM;
}

/**
 * Cap le long du segment de polyligne le plus proche du point (lng, lat), pour orienter un marqueur sur la route.
 */
export function bearingAlongPolylineNearPoint(
    coords: [number, number][],
    lng: number,
    lat: number
): number | null {
    const snap = snapPointToPolyline(coords, lng, lat);
    return snap?.bearing ?? null;
}

/**
 * Projette la position GPS sur le segment d’itinéraire le plus proche (snap route).
 */
export function snapPointToPolyline(
    coords: [number, number][],
    lng: number,
    lat: number
): { lng: number; lat: number; bearing: number } | null {
    if (!coords || coords.length < 2) return null;
    let bestI = 0;
    let bestProj: SegmentProjection | null = null;
    let bestD = Infinity;
    for (let i = 0; i < coords.length - 1; i++) {
        const [lng1, lat1] = coords[i];
        const [lng2, lat2] = coords[i + 1];
        const proj = projectPointOnSegment(lat, lng, lat1, lng1, lat2, lng2);
        if (proj.distM < bestD) {
            bestD = proj.distM;
            bestI = i;
            bestProj = proj;
        }
    }
    if (!bestProj) return null;
    const [lngA, latA] = coords[bestI];
    const [lngB, latB] = coords[bestI + 1];
    return {
        lng: bestProj.lng,
        lat: bestProj.lat,
        bearing: bearingDegrees(latA, lngA, latB, lngB),
    };
}

/**
 * Préfixe la position du bus au début de la polyligne si le premier point Mapbox est trop loin (snap route / ancienne origine).
 */
export function prependPointIfFarFromPolylineStart(
    coordinates: [number, number][],
    userLat: number,
    userLng: number,
    maxGapMeters: number
): [number, number][] {
    if (!coordinates.length) return coordinates;
    const [flng, flat] = coordinates[0];
    const d = calculateDistance(flat, flng, userLat, userLng);
    if (d > maxGapMeters) {
        return [[userLng, userLat], ...coordinates];
    }
    return coordinates;
}

