import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { trackApiCall } from './analytics';

// Extend AxiosRequestConfig to include metadata
declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
  }
}

/**
 * API client configuration
 */
interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
}

/**
 * Simple API client
 */
class ApiClient {
  private client: AxiosInstance;

  constructor(config: ApiClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request/response interceptors for analytics
    this.setupInterceptors();
  }

  /**
   * Setup request/response interceptors for analytics
   */
  private setupInterceptors(): void {
    // Request interceptor to track start time
    this.client.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to track performance
    this.client.interceptors.response.use(
      (response) => {
        const startTime = response.config.metadata?.startTime;
        if (startTime) {
          const duration = Date.now() - startTime;
          const cached = response.headers['cf-cache-status'] === 'HIT' || 
                        response.headers['x-cache'] === 'HIT';
          
          trackApiCall(
            response.config.url || 'unknown',
            response.config.method?.toUpperCase() || 'GET',
            duration,
            response.status,
            cached
          );
        }
        return response;
      },
      (error) => {
        const startTime = error.config?.metadata?.startTime;
        if (startTime) {
          const duration = Date.now() - startTime;
          trackApiCall(
            error.config?.url || 'unknown',
            error.config?.method?.toUpperCase() || 'GET',
            duration,
            error.response?.status || 0,
            false
          );
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Make a GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  /**
   * Make a POST request
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  /**
   * Make a PUT request
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  /**
   * Get the underlying axios instance
   */
  getInstance(): AxiosInstance {
    return this.client;
  }
}

// Create default API client instance
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

export const apiClient = new ApiClient({
  baseURL,
  timeout: 10000,
});

export { ApiClient };
export type { ApiClientConfig };