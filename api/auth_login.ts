import axios, { AxiosResponse } from "axios"
import { baseUrl } from "./config"

/**
 * Login a user
 * @param data - The user data
 * @param data.email - The user's email
 * @param data.password - The user's password
 * @returns AxiosResponse<any>
 */
export const authLogin = async (data: any): Promise<AxiosResponse<any>> => {
    
    const headersToSend = {
        "X-App-Audience": "backoffice_mobile",
    }
    return await axios.post(
        `${baseUrl}/auth/login`, data,
        {
            headers: headersToSend,
        }
    )
}

/**
 * Get user info
 * @param userId - The user's ID
 * @param token - The user's token
 * @returns AxiosResponse<any>
 */
export const authGetUserInfo = async (userId: string, token: string): Promise<AxiosResponse<any>> => {
    return await axios.get(`${baseUrl}/customers/${userId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
}

/**
 * Refresh token
 * @param token - The user's refresh token
 * @returns AxiosResponse<any>
 */
export const refreshTokenApi = async (token: string): Promise<AxiosResponse<any>> => {
    return await axios.post(`${baseUrl}/auth/refresh-token`, { refreshToken: token });
}

/**
 * Get profile infos
 * @param token - The user's token
 * @returns AxiosResponse<any>
 */
export const getProfileInfos = async (token: string): Promise<AxiosResponse<any>> => {
    return await axios.get(`${baseUrl}/auth/profile`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

/**
 * Forgot password
 * @param data - The user data
 * @param data.email - The user's email
 * @param data.username - The user's username
 * @param data.phone - The user's phone
 * @returns AxiosResponse<any>
 */
export const forgotPasswordApi = async (data: any): Promise<AxiosResponse<any>> => {
    return await axios.post(`${baseUrl}/auth/forgot-password/initiate`, data, {
        headers: {
            'Content-Type': 'application/json'
        },
    });
}

/**
 * Envoie le code de réinitialisation via la méthode choisie
 * @param data - Les données de la demande
 * @param data.userIdToken - Le token de l'utilisateur
 * @param data.method - La méthode choisie (email, sms, whatsapp)
 * @returns AxiosResponse<any>
 */
export const sendResetCodeApi = async (data: any): Promise<AxiosResponse<any>> => {
    return await axios.post(`${baseUrl}/auth/forgot-password/choose-method`, data, {
        headers: {
            'Content-Type': 'application/json'
        },
    });
}

/**
 * Vérifie le code de réinitialisation
 * @param data - Les données de vérification
 * @param data.userIdToken - Le token de l'utilisateur
 * @param data.code - Le code de vérification à 6 chiffres
 * @returns AxiosResponse<any>
 */
export const verifyResetCodeApi = async (data: any): Promise<AxiosResponse<any>> => {
    return await axios.post(`${baseUrl}/auth/forgot-password/verify-code`, data, {
        headers: {
            'Content-Type': 'application/json'
        },
    });
}

/**
 * Réinitialise le mot de passe
 * @param data - Les données de réinitialisation
 * @param data.userIdToken - Le token de l'utilisateur
 * @param data.newPassword - Le nouveau mot de passe
 * @param data.confirmPassword - La confirmation du nouveau mot de passe
 * @returns AxiosResponse<any>
 */
export const resetPasswordApi = async (data: any): Promise<AxiosResponse<any>> => {
    return await axios.post(`${baseUrl}/auth/forgot-password/reset`, data, {
        headers: {
            'Content-Type': 'application/json'
        },
    });
}