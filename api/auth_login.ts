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
    console.log("data ==>, ", data)
    console.log("baseUrl ==>, ", baseUrl)
    console.log("url ==>, ", `${baseUrl}/auth/login`)
    return await axios.post(`${baseUrl}/auth/login`, data)
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