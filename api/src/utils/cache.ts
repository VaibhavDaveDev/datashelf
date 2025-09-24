import type { Env, CacheConfig } from '@/types/env';

/**
 * Cache entry with metadata for stale-while-revalidate
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  staleAt: number; // When the data becomes stale
}

/**
 * Cache metrics for monitoring
 */
interface CacheMetrics {
  hits: number;
  misses: number;
  staleHits: number;
  errors: number;
}

/**
 * Generate cache key URL for Workers Cache API
 */
export function generateCacheKey(prefix: string, params: Record<string, any> = {}): string {
  const sortedParams = Object.keys(params)
    .sort()
    .filter(key => params[key] !== undefined && params[key] !== null)
    .map(key => `${key}=${encodeURIComponent(String(params[key]))}`)
    .join('&');
  
  const keyString = sortedParams ? `${prefix}:${sortedParams}` : prefix;
  
  // For Cache API, we need to create a URL-based cache key
  return `https://cache.datashelf.internal/${keyString}`;
}

/**
 * Create Request object for Cache API from cache key
 */
export function createCacheRequest(cacheKey: string): Request {
  return new Request(cacheKey, {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Get cache TTL configuration from environment with updated defaults
 */
export function getCacheConfig(env: Env): CacheConfig {
  const parseWithDefault = (value: string | undefined, defaultValue: number): number => {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  return {
    navigation: parseWithDefault(env.CACHE_TTL_NAVIGATION, 3600), // 1 hour
    categories: parseWithDefault(env.CACHE_TTL_CATEGORIES, 1800), // 30 minutes
    products: parseWithDefault(env.CACHE_TTL_PRODUCTS, 300), // 5 minutes
    productDetail: parseWithDefault(env.CACHE_TTL_PRODUCT_DETAIL, 120), // 2 minutes
  };
}

/**
 * Get dynamic TTL based on endpoint type
 */
export function getDynamicTTL(endpoint: string): number {
  if (endpoint.includes('/navigation')) return 3600; // 1 hour
  if (endpoint.includes('/categories')) return 1800; // 30 minutes
  if (endpoint.includes('/products/')) return 120;   // 2 minutes (product detail)
  if (endpoint.includes('/products')) return 300;    // 5 minutes (product list)
  return 60; // 1 minute default
}

/**
 * Enhanced cache operations with stale-while-revalidate support using Workers Cache API
 */
export class CacheManager {
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    staleHits: 0,
    errors: 0,
  };

  private cache: Cache;

  constructor() {
    this.cache = caches.default;
  }

  /**
   * Get cached data with metadata using Cache API
   */
  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const cacheRequest = createCacheRequest(key);
      const cached = await this.cache.match(cacheRequest);
      
      if (!cached) {
        this.metrics.misses++;
        return null;
      }

      const responseText = await cached.clone().text();
      const entry: CacheEntry<T> = JSON.parse(responseText);
      const now = Date.now();

      // Check if data is expired (beyond stale period)
      if (now > entry.staleAt + (entry.ttl * 2000)) { // Allow 2x TTL for stale period
        this.metrics.misses++;
        await this.delete(key); // Clean up expired data
        return null;
      }

      // Data is available (fresh or stale)
      if (now > entry.staleAt) {
        this.metrics.staleHits++;
      } else {
        this.metrics.hits++;
      }

      return entry;
    } catch (error) {
      console.error('Cache get error:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Set cached data with TTL and stale-while-revalidate metadata using Cache API
   */
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const now = Date.now();
      const entry: CacheEntry<T> = {
        data,
        timestamp: now,
        ttl,
        staleAt: now + (ttl * 1000), // Convert seconds to milliseconds
      };

      const cacheRequest = createCacheRequest(key);
      const response = new Response(JSON.stringify(entry), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttl * 2}`, // 2x TTL for stale serving
          'CDN-Cache-Control': `public, max-age=${ttl * 2}`,
          'Expires': new Date(now + (ttl * 2000)).toUTCString(),
        },
      });

      await this.cache.put(cacheRequest, response);
    } catch (error) {
      console.error('Cache set error:', error);
      this.metrics.errors++;
    }
  }

  /**
   * Delete cached data using Cache API
   */
  async delete(key: string): Promise<void> {
    try {
      const cacheRequest = createCacheRequest(key);
      await this.cache.delete(cacheRequest);
    } catch (error) {
      console.error('Cache delete error:', error);
      this.metrics.errors++;
    }
  }

  /**
   * Check if cached data is stale
   */
  isStale<T>(entry: CacheEntry<T>): boolean {
    return Date.now() > entry.staleAt;
  }

  /**
   * Get data with stale-while-revalidate pattern
   */
  async getWithSWR<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    revalidateInBackground = true,
    revalidationTrigger?: (cacheKey: string) => Promise<void>
  ): Promise<{ data: T; cached: boolean; stale: boolean }> {
    const cached = await this.get<T>(key);
    
    if (cached) {
      const isStale = this.isStale(cached);
      
      if (isStale && revalidateInBackground) {
        // Try revalidation trigger first, fallback to direct fetch
        if (revalidationTrigger) {
          revalidationTrigger(key).catch(error => {
            console.error('Revalidation trigger failed, falling back to direct fetch:', error);
            // Fallback to direct revalidation
            this.revalidateInBackground(key, fetcher, ttl).catch(fallbackError => {
              console.error('Background revalidation fallback failed:', fallbackError);
            });
          });
        } else {
          // Trigger background revalidation without awaiting
          this.revalidateInBackground(key, fetcher, ttl).catch(error => {
            console.error('Background revalidation failed:', error);
          });
        }
      }
      
      return { 
        data: cached.data, 
        cached: true, 
        stale: isStale 
      };
    }

    // No cached data, fetch fresh
    const fresh = await fetcher();
    await this.set(key, fresh, ttl);
    
    return { 
      data: fresh, 
      cached: false, 
      stale: false 
    };
  }

  /**
   * Background revalidation for stale-while-revalidate
   */
  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<void> {
    try {
      const fresh = await fetcher();
      await this.set(key, fresh, ttl);
    } catch (error) {
      console.error('Background revalidation error:', error);
      // Don't throw - background revalidation should be silent
    }
  }

  /**
   * Invalidate cache by pattern - simplified for Cache API
   * Note: Cache API doesn't support pattern-based deletion, so we track keys in memory
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    try {
      // For Cache API, we need to track keys differently
      // This is a simplified implementation - in production, consider using Durable Objects for key tracking
      console.log(`Cache invalidation requested for prefix: ${prefix}`);
      
      // Since Cache API doesn't support pattern deletion, we'll rely on TTL expiration
      // and manual deletion of known keys. This is a limitation we accept for the simplicity
      // of not needing KV storage.
      
      // For now, we'll just log the invalidation request
      // In a production system, you might want to implement a more sophisticated tracking mechanism
    } catch (error) {
      console.error('Cache invalidation error:', error);
      this.metrics.errors++;
    }
  }

  /**
   * Add key to tracking (simplified for Cache API)
   */
  async addToIndex(prefix: string, key: string): Promise<void> {
    // With Cache API, we don't need complex indexing since we rely on TTL
    // This method is kept for compatibility but doesn't need to do anything
    console.log(`Cache key tracked: ${prefix} -> ${key}`);
  }

  /**
   * Get cache metrics for monitoring
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      staleHits: 0,
      errors: 0,
    };
  }

  /**
   * Warm cache with data
   */
  async warmCache<T>(key: string, data: T, ttl: number): Promise<void> {
    await this.set(key, data, ttl);
    
    // Add to tracking (simplified for Cache API)
    const prefix = key.split('://cache.datashelf.internal/')[1]?.split(':')[0] || 'unknown';
    await this.addToIndex(prefix, key);
  }
}