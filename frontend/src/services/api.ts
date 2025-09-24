import axios, { AxiosResponse, AxiosError } from 'axios';
import { API_BASE_URL } from '@/utils/constants';
import type { 
  NavigationItem, 
  Category, 
  Product, 
  ProductDetail, 
  PaginatedResponse,
  SortOption 
} from '@/types';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // Increased timeout for better reliability
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and request enhancement
api.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching issues
    if (config.params) {
      config.params._t = Date.now();
    } else {
      config.params = { _t: Date.now() };
    }

    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    console.error('API Response Error:', error.response?.data || error.message);
    
    // Enhanced error handling
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please check your connection and try again.');
    }
    
    if (error.code === 'ERR_NETWORK') {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    if (!navigator.onLine) {
      throw new Error('You are currently offline. Please check your internet connection.');
    }
    
    // Handle specific HTTP status codes
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;
      
      switch (status) {
        case 400:
          throw new Error(data?.message || 'Invalid request. Please check your input.');
        case 401:
          throw new Error('Authentication required. Please refresh the page.');
        case 403:
          throw new Error('Access denied. You don\'t have permission to access this resource.');
        case 404:
          throw new Error(data?.message || 'The requested resource was not found.');
        case 429:
          throw new Error('Too many requests. Please wait a moment and try again.');
        case 500:
          throw new Error('Server error. Please try again in a few moments.');
        case 502:
        case 503:
        case 504:
          throw new Error('Service temporarily unavailable. Please try again later.');
        default:
          throw new Error(data?.message || `Request failed with status ${status}`);
      }
    }
    
    return Promise.reject(error);
  }
);

// API service functions
export const apiService = {
  // Navigation endpoints
  async getNavigation(): Promise<NavigationItem[]> {
    const response: AxiosResponse<NavigationItem[]> = await api.get('/api/navigation');
    return response.data;
  },

  // Category endpoints
  async getCategories(params?: {
    navId?: string;
    parentId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Category>> {
    const response: AxiosResponse<PaginatedResponse<Category>> = await api.get('/api/categories', {
      params,
    });
    return response.data;
  },

  // Product endpoints
  async getProducts(params?: {
    categoryId?: string;
    limit?: number;
    offset?: number;
    sort?: SortOption;
  }): Promise<PaginatedResponse<Product>> {
    const response: AxiosResponse<PaginatedResponse<Product>> = await api.get('/api/products', {
      params,
    });
    return response.data;
  },

  async getProductDetail(productId: string): Promise<ProductDetail> {
    const response: AxiosResponse<ProductDetail> = await api.get(`/api/products/${productId}`);
    return response.data;
  },
};

export default apiService;