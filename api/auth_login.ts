import axios, { AxiosResponse } from "axios"
import { baseUrl } from "./config"

/**
 * Register a new user
 * @param data - The user data
 * @param data.name - The user's name
 * @param data.email - The user's email
 * @param data.password - The user's password
 * @returns AxiosResponse<any>
 */
export const authLogin = async (data: any): Promise<AxiosResponse<any>> => {
    return await axios.post(`${baseUrl}/auth/register/customer`, data)
}