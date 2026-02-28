import axios, { AxiosResponse } from "axios";
import { baseUrl } from "./config";

/**
 * Récupère la liste des départs de l'utilisateur connecté
 * @param userId - L'ID de l'utilisateur
 * @param token - Le token d'authentification
 * @returns AxiosResponse<any>
 */
export const getUserDepartures = async (userId: string, token: string): Promise<AxiosResponse<any>> => {
    return await axios.get(`${baseUrl}/customers/${userId}/departures`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}


/**
 * Récupère la liste des départs de l'utilisateur connecté
 * @param queryParams - Les paramètres de la requête
 * @param token - Le token d'authentification
 * @returns AxiosResponse<any>
 */
export const getUserDeparturesApi = async (queryParams: string, token: string): Promise<AxiosResponse<any>> => {
    const url = `${baseUrl}/departures?${queryParams}`;
    const headers = { Authorization: `Bearer ${token}` };
    // Log requête complète pour copier-coller dans Postman
    console.log('[POSTMAN] GET', url);
    console.log('[POSTMAN] Header: Authorization = Bearer ' + token);
    return await axios.get(url, { headers });
}

/**
 * Vérifie si le QR code est valide
 * @param qrCode - Le QR code à vérifier
 * @param token - Le token d'authentification
 * @returns AxiosResponse<any>
 */
export const verifyQRCode = async (qrCode: string, token: string): Promise<AxiosResponse<any>> => {
    return await axios.post(`${baseUrl}/bookings/decrypt-qrcode`, {
        hash: qrCode,
    }, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

/**
 * Vérifie si le QR code est valide
 * @param qrCode - Le QR code à vérifier
 * @param token - Le token d'authentification
 * @returns AxiosResponse<any>
 */
export const verifyLuggageQRCode = async (qrCode: string, token: string): Promise<AxiosResponse<any>> => {
    console.log("[SCAN] Vérification du QR code:", qrCode);
    console.log("[SCAN] URL:", `${baseUrl}/luggage/tag/${qrCode}`);
    console.log("[SCAN] Token:", token);
    console.log("[SCAN] Headers:", {
        Authorization: `Bearer ${token}`
    });
    return await axios.get(`${baseUrl}/luggage/tag/${qrCode}`, {
        headers: {
            Authorization: `Bearer ${token}`
        },
    });
}

/**
 * Marque un bagage comme chargé
 * @param payload - Les données du bagage
 * @param id - L'ID du bagage
 * @param token - Le token d'authentification
 * @returns AxiosResponse<any>
 */
export const loadLuggageApi = async (payload: any, id: string, token: string): Promise<AxiosResponse<any>> => {
    return await axios.post(`${baseUrl}/luggage/${id}/load`, payload, {
        headers: {
            Authorization: `Bearer ${token}`
        },
    });
}

/**
 * Marque un bagage comme déchargé
 * @param payload - Les données du bagage
 * @param id - L'ID du bagage
 * @param token - Le token d'authentification
 * @returns AxiosResponse<any>
 */
export const unLoadLuggageApi = async (payload: any, id: string, token: string): Promise<AxiosResponse<any>> => {
    return await axios.post(`${baseUrl}/luggage/${id}/unload`, payload, {
        headers: {
            Authorization: `Bearer ${token}`
        },
    });
}

/**
 * Marque un bagage comme livré
 * @param payload - Les données du bagage
 * @param id - L'ID du bagage
 * @param token - Le token d'authentification
 * @returns AxiosResponse<any>
 */
export const deliverLuggageApi = async (payload: any, id: string, token: string): Promise<AxiosResponse<any>> => {
    return await axios.post(`${baseUrl}/luggage/${id}/deliver`, payload, {
        headers: {
            Authorization: `Bearer ${token}`
        },
    });
}

/**
 * Traite le scan du QR code
 * @param objetToValidate - L'objet à valider
 * @param token - Le token d'authentification
 * @returns AxiosResponse<any>
 */
export const processScanApi = async (objetToValidate: Object, token: string): Promise<AxiosResponse<any>> => {
    return await axios.post(`${baseUrl}/bookings/scan`, {
        qrCodeData : objetToValidate,
    }, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
}

/**
 * Récupère la liste des réservations pour un départ spécifique
 * @param queryParams - Les paramètres de la requête (incluant departureId)
 * @param token - Le token d'authentification
 * @returns AxiosResponse<any>
 */
export const getBookingsByDepartureIdApi = async (queryParams: string, token: string): Promise<AxiosResponse<any>> => {
    console.log("[BOOKINGS] Récupère la liste des réservations pour un départ spécifique:", {
        queryParams,
        token,
    });

    console.log("[BOOKINGS] URL:", `${baseUrl}/bookings?${queryParams}`);
    return await axios.get(`${baseUrl}/bookings?${queryParams}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

/**
 * Marque un départ comme boarded, departed or arrived
 * @param departureId - L'ID du départ
 * @param token - Le token d'authentification
 * @returns AxiosResponse<any>
 */
export const markAsStatusDepartureApi = async (departureId: string, token: string, status: string): Promise<AxiosResponse<any>> => {
    
    // Nettoyer le token (enlever les espaces avant/après)
    const cleanToken = token?.trim();
    
    console.log("[DEPARTURES] Marque un départ comme boarded, departed or arrived:", {
        departureId,
        tokenLength: cleanToken?.length,
        tokenPreview: cleanToken ? `${cleanToken.substring(0, 20)}...` : 'undefined',
        status,
    });
    console.log("[DEPARTURES] URL:", `${baseUrl}/departures/${departureId}/${status}`);
    
    const url = `${baseUrl}/departures/${departureId}/${status}`;
    const authHeader = `Bearer ${cleanToken}`;
    
    console.log("[DEPARTURES] Headers Authorization:", authHeader.substring(0, 30) + "...");
    
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
        },
    });
    
    console.log("[DEPARTURES] Status de la réponse:", response.status);
    console.log("[DEPARTURES] StatusText:", response.statusText);
    
    // Convertir les headers en objet
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
        headers[key] = value;
    });
    
    // Vérifier si la réponse est OK avant de parser le JSON
    let data: any;
    if (response.ok) {
        try {
            data = await response.json();
        } catch (error) {
            // Si la réponse est vide ou n'est pas du JSON valide
            data = {};
        }
    } else {
        // Si la réponse n'est pas OK, essayer de parser le message d'erreur
        try {
            data = await response.json();
        } catch (error) {
            // Si on ne peut pas parser le JSON, créer un objet d'erreur
            data = {
                error: response.statusText || 'Erreur inconnue',
                message: `Erreur ${response.status}: ${response.statusText}`,
            };
        }
        // Lancer une erreur pour que le catch dans le code appelant puisse la gérer
        throw new Error(`Erreur ${response.status}: ${data.message || data.error || response.statusText}`);
    }
    
    return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers,
        config: {},
    } as unknown as AxiosResponse<any>;
}