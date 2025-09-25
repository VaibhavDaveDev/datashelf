// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Cache configuration
export const CACHE_KEYS = {
  NAVIGATION: 'navigation',
  CATEGORIES: 'categories',
  PRODUCTS: 'products',
  PRODUCT_DETAIL: 'product-detail',
} as const;

// Route paths
export const ROUTES = {
  HOME: '/',
  CATEGORY: '/category/:categoryId',
  PRODUCT: '/product/:productId',
  NOT_FOUND: '/404',
} as const;