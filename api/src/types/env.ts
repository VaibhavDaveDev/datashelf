/**
 * Environment variables and bindings for Cloudflare Workers
 */
export interface Env {
  // Supabase configuration
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;

  // Scraper service configuration
  SCRAPER_API_KEY: string;
  SCRAPER_SERVICE_URL: string;

  // Cache configuration
  CACHE_TTL_NAVIGATION?: string;
  CACHE_TTL_CATEGORIES?: string;
  CACHE_TTL_PRODUCTS?: string;
  CACHE_TTL_PRODUCT_DETAIL?: string;

  // API configuration
  API_VERSION?: string;
  CORS_ORIGINS?: string;
  RATE_LIMIT_REQUESTS_PER_MINUTE?: string;

  // Revalidation configuration
  REVALIDATION_RATE_LIMIT_PER_MINUTE?: string;
  REVALIDATION_RATE_LIMIT_PER_HOUR?: string;
  REVALIDATION_ENABLED?: string;

  // Turnstile configuration
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_ENABLED?: string;

  // Environment
  ENVIRONMENT?: string;

  // KV namespace for rate limiting (optional)
  CACHE?: KVNamespace;

  // Add index signature for Hono compatibility
  [key: string]: any;
}

/**
 * Cache TTL configuration with defaults
 */
export interface CacheConfig {
  navigation: number;
  categories: number;
  products: number;
  productDetail: number;
}

/**
 * API response metadata
 */
export interface ResponseMetadata {
  timestamp: string;
  cached: boolean;
  ttl?: number;
}

