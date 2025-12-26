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
    console.log('queryParams ==>, ', queryParams)
    console.log('url ==>, ', `${baseUrl}/departures?${queryParams}`)
    return await axios.get(`${baseUrl}/departures?${queryParams}`, {
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
 * Traite le scan du QR code
 * @param hash - Le hash du QR code
 * @param token - Le token d'authentification
 * @returns AxiosResponse<any>
 */
export const processScanApi = async (objetToValidate: Object, token: string): Promise<AxiosResponse<any>> => {
    return await axios.post(`${baseUrl}/bookings/scan`, {
        qrCodeData:objetToValidate,
    }, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}