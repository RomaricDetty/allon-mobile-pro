import { getMapboxAccessToken } from '@/app/track-route-mapbox/constants';

interface RoutePoint {
    lng: number;
    lat: number;
}

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
    const lat = point?.latitude ?? point?.[1];
    
    if (typeof lng === 'number' && typeof lat === 'number') {
        return [lng, lat];
    }
    
    return null;
}

/**
 * Extraire l'itinéraire pré-calculé depuis les données du trip
 */
export function extractPreCalculatedRoute(trip: any): [number, number][] | null {
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
 * Calculer l'itinéraire routier via l'API Mapbox Directions
 */
export async function calculateMapboxRoute(
    fromCoord: [number, number],
    toCoord: [number, number]
): Promise<RouteResult> {
    const token = getMapboxAccessToken();
    const coords = `${fromCoord[0]},${fromCoord[1]};${toCoord[0]},${toCoord[1]}`;
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
            coordinates: [fromCoord, toCoord],
        };
    }
}

/**
 * Obtenir l'itinéraire complet (pré-calculé ou via API)
 */
export async function getRouteCoordinates(
    trip: any,
    fromCoord: [number, number],
    toCoord: [number, number]
): Promise<[number, number][]> {
    const preCalculated = extractPreCalculatedRoute(trip);
    
    if (preCalculated) {
        console.log('[RouteCalculator] Utilisation de l\'itinéraire pré-calculé:', preCalculated.length, 'points');
        return preCalculated;
    }
    
    console.log('[RouteCalculator] Calcul de l\'itinéraire routier:', {
        from: trip?.stationFrom?.name,
        to: trip?.stationTo?.name,
    });
    
    const result = await calculateMapboxRoute(fromCoord, toCoord);
    
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
