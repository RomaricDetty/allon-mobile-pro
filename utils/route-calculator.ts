import { getMapboxAccessToken } from '@/app/track-route-mapbox/constants';
import { calculateDistance } from '@/utils/location';

interface RouteResult {
    coordinates: [number, number][];
    distance?: number;
    duration?: number;
}

/**
 * Convertir un point de coordonnées en format Mapbox [lng, lat]
 */
function convertToMapboxCoord(point: any): [number, number] | null {
    const lng = point?.longitude ?? point?.lng ?? point?.[0];
    const lat = point?.latitude ?? point?.lat ?? point?.[1];

    if (typeof lng === 'number' && typeof lat === 'number' && !Number.isNaN(lng) && !Number.isNaN(lat)) {
        return [lng, lat];
    }

    const ln = Number(lng);
    const la = Number(lat);
    if (!Number.isNaN(ln) && !Number.isNaN(la)) {
        return [ln, la];
    }

    return null;
}

/**
 * Choisit l'objet trip à utiliser pour le tracé (API `trips[]` avec primaire, sinon `trip` racine).
 */
export function resolveTripForRouting(departure: { trip?: any; trips?: any[] } | null | undefined): any {
    if (!departure) return null;
    const list = departure.trips;
    if (Array.isArray(list) && list.length > 0) {
        const entry = list.find((t: any) => t?.isPrimary === true) ?? list[0];
        if (entry?.trip) return entry.trip;
    }
    return departure.trip ?? null;
}

/**
 * Extrait les coordonnées [lng, lat] des stations départ / arrivée du trip.
 */
export function getTripEndpointCoords(trip: any): { fromCoord: [number, number]; toCoord: [number, number] } | null {
    const fromCoord = coordFromStation(trip?.stationFrom);
    const toCoord = coordFromStation(trip?.stationTo);
    if (!fromCoord || !toCoord) return null;
    return { fromCoord, toCoord };
}

/**
 * Lit la coordonnée d'une station (champs API variables).
 */
function coordFromStation(station: any): [number, number] | null {
    if (!station) return null;
    const c = station.coordinate ?? station.coordinates ?? station.location ?? station.position;
    if (!c) return null;
    const lat = Number(c.latitude ?? c.lat);
    const lng = Number(c.longitude ?? c.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return [lng, lat];
}

/**
 * Extraire l'itinéraire pré-calculé depuis les données du trip
 */
export function extractPreCalculatedRoute(trip: any): [number, number][] | null {
    const geom = trip?.geometry;
    if (geom?.type === 'LineString' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
        const line = geom.coordinates as unknown[];
        const normalized: [number, number][] = [];
        for (const p of line) {
            if (!Array.isArray(p) || p.length < 2) continue;
            const lng = Number(p[0]);
            const lat = Number(p[1]);
            if (Number.isFinite(lng) && Number.isFinite(lat)) {
                normalized.push([lng, lat]);
            }
        }
        return normalized.length >= 2 ? normalized : null;
    }

    const tripRoute = trip?.route || trip?.coordinates || trip?.path;

    if (!Array.isArray(tripRoute) || tripRoute.length < 2) {
        return null;
    }

    const convertedCoords: [number, number][] = [];

    for (const point of tripRoute) {
        const coord = convertToMapboxCoord(point);
        if (coord) {
            convertedCoords.push(coord);
        }
    }

    return convertedCoords.length >= 2 ? convertedCoords : null;
}

/**
 * Retire les points consécutifs trop proches pour l’URL Mapbox Directions (évite doublons / erreurs API).
 */
function dedupeRouteWaypoints(points: [number, number][], minSeparationM = 4): [number, number][] {
    if (points.length < 2) return points;
    const out: [number, number][] = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const p = points[i];
        const prev = out[out.length - 1];
        const d = calculateDistance(prev[1], prev[0], p[1], p[0]);
        if (d < minSeparationM && i < points.length - 1) {
            continue;
        }
        out.push(p);
    }
    return out.length >= 2 ? out : [points[0], points[points.length - 1]];
}

/**
 * Calculer l’itinéraire routier Mapbox sur une chaîne de points [lng, lat] (2 points = segment, 3+ = via).
 */
export async function calculateMapboxRoutePath(path: [number, number][]): Promise<RouteResult> {
    const token = getMapboxAccessToken();
    if (path.length < 2) {
        return { coordinates: path.length === 1 ? [path[0], path[0]] : [] };
    }
    const coords = path.map((c) => `${c[0]},${c[1]}`).join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&steps=true&access_token=${token}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        const route = data.routes?.[0];
        const coordinates = route?.geometry?.coordinates;

        if (Array.isArray(coordinates) && coordinates.length >= 2) {
            return {
                coordinates,
                distance: route?.distance,
                duration: route?.duration,
            };
        }

        throw new Error('Aucun itinéraire trouvé');
    } catch (error) {
        console.error('[RouteCalculator] Erreur calcul itinéraire:', error);
        return {
            coordinates: path,
        };
    }
}

/**
 * Calculer l'itinéraire routier via l'API Mapbox Directions (deux points).
 */
export async function calculateMapboxRoute(
    fromCoord: [number, number],
    toCoord: [number, number]
): Promise<RouteResult> {
    return calculateMapboxRoutePath([fromCoord, toCoord]);
}

export type GetRouteCoordinatesOptions = {
    /** Si true, ignore la géométrie serveur et recalcule via Mapbox depuis fromCoord (ex. position conducteur). */
    skipPrecalculatedRoute?: boolean;
    /** Station départ (drapeau) : insérée entre l’origine du fetch et l’arrivée pour forcer le passage par ce point. */
    stationDepartCoord?: [number, number] | null;
};

/**
 * Obtenir l'itinéraire complet (pré-calculé ou via API)
 */
export async function getRouteCoordinates(
    trip: any,
    fromCoord: [number, number],
    toCoord: [number, number],
    options?: GetRouteCoordinatesOptions
): Promise<[number, number][]> {
    const preCalculated = options?.skipPrecalculatedRoute ? null : extractPreCalculatedRoute(trip);
    
    if (preCalculated) {
        console.log('[RouteCalculator] Utilisation de l\'itinéraire pré-calculé:', preCalculated.length, 'points');
        return preCalculated;
    }
    
    console.log('[RouteCalculator] Calcul de l\'itinéraire routier:', {
        from: trip?.stationFrom?.name,
        to: trip?.stationTo?.name,
    });

    const rawPath: [number, number][] = [fromCoord];
    if (options?.stationDepartCoord != null) {
        rawPath.push(options.stationDepartCoord);
    }
    rawPath.push(toCoord);
    const path = dedupeRouteWaypoints(rawPath);
    const result = await calculateMapboxRoutePath(path);
    
    if (result.distance && result.duration) {
        console.log('[RouteCalculator] Itinéraire routier calculé:', {
            points: result.coordinates.length,
            distance: (result.distance / 1000).toFixed(1) + ' km',
            duration: Math.round(result.duration / 60) + ' min',
        });
    } else {
        console.log('[RouteCalculator] Fallback: tracé direct entre les stations');
    }
    
    return result.coordinates;
}
