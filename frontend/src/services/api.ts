import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// Prova a usare sia le variabili VITE_ che REACT_APP_
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
                    import.meta.env.REACT_APP_API_ENDPOINT || 
                    'https://api.example.com';

console.log('Using API_BASE_URL:', API_BASE_URL);

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
        try {
          console.log('Fetching auth session...');
          const session = await fetchAuthSession();
          const token = session.tokens?.idToken?.toString();

          if (token) {
            console.log('Auth token found, adding to request');
            config.headers.Authorization = `Bearer ${token}`;
          } else {
            console.log('No auth token available');
          }
        } catch (error) {
          console.error('Error fetching auth session:', error);
          // User not authenticated, continue without token
        }

        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('API response error:', error);
        
        if (error.response) {
          // Server responded with error status
          const status = error.response.status;

          if (status === 401) {
            console.log('Unauthorized - redirecting to login');
            // Unauthorized - redirect to login
            window.location.href = '/login';
          } else if (status === 403) {
            // Forbidden - access denied
            console.error('Access denied');
          } else if (status === 404) {
            // Not found
            console.error('Resource not found');
          } else if (status >= 500) {
            // Server error
            console.error('Server error occurred');
          }
        } else if (error.request) {
          // Request made but no response
          console.error('Network error - no response received');
        } else {
          // Error setting up request
          console.error('Request setup error:', error.message);
        }

        return Promise.reject(error);
      }
    );
  }

  public getClient(): AxiosInstance {
    return this.client;
  }

  public async get<T>(url: string, config?: any): Promise<T> {
    console.log(`GET request to: ${url}`);
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  public async post<T>(url: string, data?: any, config?: any): Promise<T> {
    console.log(`POST request to: ${url}`, data);
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  public async put<T>(url: string, data?: any, config?: any): Promise<T> {
    console.log(`PUT request to: ${url}`, data);
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  public async patch<T>(url: string, data?: any, config?: any): Promise<T> {
    console.log(`PATCH request to: ${url}`, data);
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: any): Promise<T> {
    console.log(`DELETE request to: ${url}`);
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;