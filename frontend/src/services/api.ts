import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { useAuth } from '../hooks/useAuth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class ApiClient {
  private client: AxiosInstance
  private getToken: () => string | null

  constructor(getToken: () => string | null) {
    this.getToken = getToken
    this.client = axios.create({
      baseURL: `${API_URL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getToken()
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          const refreshed = await useAuth.getState().updateToken()
          if (refreshed) {
            const newToken = useAuth.getState().keycloak?.token
            if (newToken && error.config) {
              error.config.headers.Authorization = `Bearer ${newToken}`
              return this.client.request(error.config)
            }
          }
          // If refresh failed, logout
          useAuth.getState().logout()
        }
        return Promise.reject(error)
      }
    )
  }

  get = this.client.get.bind(this.client)
  post = this.client.post.bind(this.client)
  put = this.client.put.bind(this.client)
  patch = this.client.patch.bind(this.client)
  delete = this.client.delete.bind(this.client)
}

// Create a singleton instance
let apiInstance: ApiClient | null = null

export const getApiClient = (): ApiClient => {
  if (!apiInstance) {
    apiInstance = new ApiClient(() => useAuth.getState().keycloak?.token || null)
  }
  return apiInstance
}

// Export for convenience
export const api = getApiClient()
