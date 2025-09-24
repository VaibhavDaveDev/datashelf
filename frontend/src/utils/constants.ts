// API Configuration
export const API_BASE_URL = 'https://api.datashelf.workers.dev';

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