/**
 * Génère une couleur pour le cercle de la compagnie basée sur le nom
 * @param companyName - Le nom de la compagnie
 * @returns La couleur hexadécimale correspondante
 */
export const getCompanyColor = (companyName?: string): string => {
    if (!companyName) return '#8B4513';
    const colors = ['#8B4513', '#1776BA', '#2E7D32', '#C62828', '#6A1B9A', '#F57C00'];
    const index = companyName.length % colors.length;
    return colors[index];
};

/**
 * Extrait les initiales d'une compagnie pour le logo
 * @param companyName - Le nom de la compagnie
 * @returns Les initiales en majuscules
 */
export const getCompanyInitials = (companyName?: string): string => {
    if (!companyName) return 'C';
    const words = companyName.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return companyName.substring(0, 2).toUpperCase();
};

/**
 * Tableau de correspondance des statuts techniques vers des libellés français
 */
export const STATUS_MAPPING: Record<string, string> = {
    'SCHEDULED': 'Programmé',
    'ON_TIME': 'À l\'heure',
    'DELAYED': 'Retardé',
    'CANCELLED': 'Annulé',
    'BOARDING': 'En embarquement',
    'DEPARTED': 'Parti',
    'ARRIVED': 'Arrivé',
    'IN_TRANSIT': 'En transit',
    'COMPLETED': 'Terminé',
    'PENDING': 'En attente',
    'CONFIRMED': 'Confirmé',
    'AVAILABLE': 'Disponible',
    'FULL': 'Complet',
    'CLOSED': 'Fermé',
};

/**
 * Tableau de correspondance des statuts techniques vers des couleurs
 */
export const STATUS_COLOR_MAPPING: Record<string, { light: string; dark: string }> = {
    'SCHEDULED': { light: '#1776BA', dark: '#1776BA' }, // Bleu
    'ON_TIME': { light: '#34C759', dark: '#30D158' }, // Vert
    'DELAYED': { light: '#FF9500', dark: '#FF9F0A' }, // Orange
    'CANCELLED': { light: '#FF3B30', dark: '#FF453A' }, // Rouge
    'BOARDING': { light: '#5856D6', dark: '#5E5CE6' }, // Violet
    'DEPARTED': { light: '#1776BA', dark: '#1776BA' }, // Bleu
    'ARRIVED': { light: '#34C759', dark: '#30D158' }, // Vert
    'IN_TRANSIT': { light: '#FF9500', dark: '#FF9F0A' }, // Orange
    'COMPLETED': { light: '#34C759', dark: '#30D158' }, // Vert
    'PENDING': { light: '#FF9500', dark: '#FF9F0A' }, // Orange
    'CONFIRMED': { light: '#34C759', dark: '#30D158' }, // Vert
    'AVAILABLE': { light: '#34C759', dark: '#30D158' }, // Vert
    'FULL': { light: '#FF3B30', dark: '#FF453A' }, // Rouge
    'CLOSED': { light: '#8E8E93', dark: '#98989D' }, // Gris
};

/**
 * Convertit un statut technique en libellé français lisible
 * @param status - Le statut technique (ex: "SCHEDULED")
 * @returns Le libellé français correspondant ou le statut original si non trouvé
 */
export const getStatusLabel = (status?: string): string => {
    if (!status) return '--';

    // Vérifie si le statut contient déjà un libellé formaté (ex: "Retard: 15min")
    if (status.includes('Retard:')) {
        return status;
    }

    // Convertit en majuscules pour la recherche insensible à la casse
    const upperStatus = status.toUpperCase();

    // Retourne le libellé correspondant ou le statut original
    return STATUS_MAPPING[upperStatus] || status;
};

/**
 * Récupère la couleur associée à un statut selon le thème
 * @param status - Le statut technique (ex: "SCHEDULED")
 * @param isDark - Indique si le thème est sombre
 * @returns La couleur correspondante ou une couleur par défaut
 */
export const getStatusColor = (status?: string, isDark: boolean = false): string => {
    if (!status) return isDark ? '#98989D' : '#8E8E93';

    // Pour les statuts avec formatage spécial (ex: "Retard: 15min")
    if (status.includes('Retard:')) {
        return isDark ? '#FF9F0A' : '#FF9500';
    }

    // Convertit en majuscules pour la recherche insensible à la casse
    const upperStatus = status.toUpperCase();
    const colorMapping = STATUS_COLOR_MAPPING[upperStatus];

    // Retourne la couleur correspondante ou une couleur par défaut
    return colorMapping
        ? (isDark ? colorMapping.dark : colorMapping.light)
        : (isDark ? '#98989D' : '#8E8E93');
};

/**
 * Coordonnées géographiques (API trip)
 */
export interface TripCoordinate {
    latitude: number;
    longitude: number;
}

/**
 * Station d'un trajet (API trip)
 */
export interface TripStation {
    id: string;
    name: string;
    address?: string;
    city?: string;
    coordinate?: TripCoordinate;
}

/**
 * Données d'un trajet (trip) renvoyées par l'API
 */
export interface Trip {
    id: string;
    label: string;
    basePrice?: string;
    calculatedPrice?: string;
    distanceKm?: string;
    durationMinutes?: number;
    stationFrom: TripStation;
    stationTo: TripStation;
}

/**
 * Interface pour les données de départ de l'API
 */
export interface ApiDeparture {
    id: string;
    departureDateTime: string;
    arrivalEta: string;
    trip: Trip | {
        label: string;
        stationFrom: { name: string };
        stationTo: { name: string };
    };
    bus: {
        busType: string;
        licencePlate: string;
        mark: string;
        model: string;
    };
    company: {
        name: string;
    };
    priceSnapshot: string;
    seatsAvailable: number;
    seatsBooked: number;
    status: string;
    delayMinutes?: number | null;
    delayReason?: string | null;
}

/**
 * Extrait un code de station (3 lettres) depuis un nom de station
 * @param stationName - Le nom de la station
 * @returns Le code de 3 lettres
 */
export const extractStationCode = (stationName: string): string => {
    if (!stationName) return '---';
    // Prendre les 3 premières lettres en majuscules
    const words = stationName.trim().split(/\s+/);
    if (words.length >= 1) {
        const firstWord = words[0].toUpperCase();
        if (firstWord.length >= 3) {
            return firstWord.substring(0, 3);
        }
        // Si le premier mot fait moins de 3 lettres, combiner avec le suivant
        if (words.length > 1 && firstWord.length < 3) {
            const secondWord = words[1].toUpperCase();
            return (firstWord + secondWord).substring(0, 3);
        }
        return firstWord.padEnd(3, 'X');
    }
    return '---';
};

/**
 * Extrait la ville depuis un nom de gare
 * @param stationName - Le nom de la gare
 * @returns Le nom de la ville ou undefined
 * Exemples: "Gare Adjame" -> "Abidjan", "Gare Man" -> "Man"
 */
export const extractCityFromStation = (stationName: string): string | undefined => {
    if (!stationName) return undefined;

    // Mapping des gares connues vers leurs villes
    const stationToCity: Record<string, string> = {
        'adjame': 'Abidjan',
        'man': 'Man',
        'bouake': 'Bouaké',
        'yakro': 'Yamoussoukro',
        'divo': 'Divo',
        'basilique': 'Yamoussoukro',
    };

    const lowerName = stationName.toLowerCase();

    // Chercher une correspondance dans le mapping
    for (const [key, city] of Object.entries(stationToCity)) {
        if (lowerName.includes(key)) {
            return city;
        }
    }

    // Si pas de correspondance, essayer d'extraire le deuxième mot
    const words = stationName.trim().split(/\s+/);
    if (words.length > 1) {
        // Si le premier mot est "Gare", prendre le suivant
        if (words[0].toLowerCase() === 'gare' && words.length > 1) {
            return words[1].charAt(0).toUpperCase() + words[1].slice(1).toLowerCase();
        }
    }

    return undefined;
};

/**
 * Transforme les données de l'API en format compatible avec DepartureCard
 * @param apiDeparture - Les données de départ de l'API
 * @returns Les données transformées au format Departure
 */
export const transformApiDepartureToDeparture = (apiDeparture: ApiDeparture): any => {
    const departureDate = new Date(apiDeparture.departureDateTime);
    const arrivalDate = new Date(apiDeparture.arrivalEta);
    const durationMs = arrivalDate.getTime() - departureDate.getTime();
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    // Format de durée (ex: "21h 35m")
    let durationText = '';
    if (durationHours > 0) {
        durationText = `${durationHours}h${durationMinutes > 0 ? ` ${durationMinutes}m` : ''}`;
    } else {
        durationText = `${durationMinutes}min`;
    }

    // Format de la date en français (ex: "2 nov. 2025")
    const formattedDate = departureDate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    // Format de l'heure en français (ex: "09:45" ou "21:30")
    const formattedDepartureTime = departureDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        second: '2-digit',
    });

    const formattedArrivalTime = arrivalDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        second: '2-digit',
    });

    // Extraction des codes de stations
    const departureStationCode = extractStationCode(apiDeparture.trip.stationFrom.name);
    const arrivalStationCode = extractStationCode(apiDeparture.trip.stationTo.name);

    // Extraction des villes
    const departureCity = extractCityFromStation(apiDeparture.trip.stationFrom.name);
    const arrivalCity = extractCityFromStation(apiDeparture.trip.stationTo.name);

    // Format du prix (ex: "6 000 XOF")
    const priceValue = parseFloat(apiDeparture.priceSnapshot);
    const formattedPrice = `${priceValue.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XOF`;

    // Statut avec retard si applicable
    let statusText = apiDeparture.status;
    if (apiDeparture.delayMinutes && apiDeparture.delayMinutes > 0) {
        statusText = `Retard: ${apiDeparture.delayMinutes}min`;
    }

    const t = apiDeparture.trip;
    const tripForDeparture = {
        label: t.label,
        stationFrom: t.stationFrom,
        stationTo: t.stationTo,
        ...('distanceKm' in t && { distance: (t as Trip).distanceKm }),
        ...('durationMinutes' in t && { estimatedDuration: (t as Trip).durationMinutes }),
        ...('id' in t && { id: (t as Trip).id }),
        ...('basePrice' in t && { basePrice: (t as Trip).basePrice }),
        ...('calculatedPrice' in t && { calculatedPrice: (t as Trip).calculatedPrice }),
    };

    return {
        id: apiDeparture.id,
        company: apiDeparture.company.name,
        busType: `${apiDeparture.bus.busType} ${apiDeparture.bus.mark}`,
        departureStationCode: departureStationCode,
        departureStationName: apiDeparture.trip.stationFrom.name,
        departureCity: departureCity,
        departureCityCountry: apiDeparture.trip.stationFrom.name,
        departureTime: formattedDepartureTime,
        arrivalStationCode: arrivalStationCode,
        arrivalStationName: apiDeparture.trip.stationTo.name,
        arrivalCity: arrivalCity,
        arrivalCityCountry: apiDeparture.trip.stationTo.name,
        arrivalTime: formattedArrivalTime,
        date: formattedDate,
        duration: durationText,
        price: formattedPrice,
        line: `${apiDeparture.bus.busType} - ${apiDeparture.bus.mark}`,
        destination: apiDeparture.trip.label,
        departureDate: formattedDate,
        seatsAvailable: apiDeparture.seatsAvailable,
        seatsBooked: apiDeparture.seatsBooked,
        status: statusText,
        busLicensePlate: apiDeparture.bus.licencePlate,
        trip: tripForDeparture,
    };
};
