import axios, { type AxiosInstance, type AxiosError, type AxiosRequestConfig } from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const legacyApiBaseUrl = (import.meta.env as Record<string, string | undefined>).REACT_APP_API_ENDPOINT;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || legacyApiBaseUrl || '';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        if (!API_BASE_URL) {
          return Promise.reject(
            new Error('VITE_API_BASE_URL is not configured. Configure the frontend environment before using the app.')
          );
        }

        try {
          const session = await fetchAuthSession();
          const token = session.tokens?.idToken?.toString();

          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('Error fetching auth session:', error);
          }
        }

        return config;
      },
      (error) => {
        if (import.meta.env.DEV) {
          console.error('Request interceptor error:', error);
        }
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Never log the full AxiosError: error.config.headers includes the
        // Authorization bearer token, and error.config can include request
        // bodies. Only log a minimal, safe summary, and only in development.
        if (import.meta.env.DEV) {
          console.error('API response error:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            data: error.response?.data,
          });
        }

        if (error.response) {
          const status = error.response.status;

          if (status === 401) {
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  public getClient(): AxiosInstance {
    return this.client;
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  public async post<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  public async put<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  public async patch<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
