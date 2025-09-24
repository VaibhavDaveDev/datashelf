import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheManager, generateCacheKey, getCacheConfig } from '@/utils/cache';
import type { Env } from '@/types/env';

// Mock Cache API
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// Mock global caches
global.caches = {
  default: mockCache as any,
} as any;

const mockEnv: Env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-key',
  SCRAPER_API_KEY: 'test-scraper-key',
  SCRAPER_SERVICE_URL: 'https://scraper.test.com',
  CACHE_TTL_NAVIGATION: '3600',
  CACHE_TTL_CATEGORIES: '1800',
  CACHE_TTL_PRODUCTS: '300',
  CACHE_TTL_PRODUCT_DETAIL: '120',
};

describe('Cache System - Simple Tests', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheManager = new CacheManager();
  });

  describe('Cache Key Generation', () => {
    it('should generate simple cache key', () => {
      const key = generateCacheKey('navigation');
      expect(key).toBe('https://cache.datashelf.internal/navigation');
    });

    it('should generate cache key with parameters', () => {
      const key = generateCacheKey('products', { categoryId: '123', limit: 20 });
      expect(key).toBe('https://cache.datashelf.internal/products:categoryId=123&limit=20');
    });
  });

  describe('Cache Configuration', () => {
    it('should return correct TTL values', () => {
      const config = getCacheConfig(mockEnv);
      expect(config.navigation).toBe(3600);
      expect(config.categories).toBe(1800);
      expect(config.products).toBe(300);
      expect(config.productDetail).toBe(120);
    });
  });

  describe('Basic Cache Operations', () => {
    it('should handle cache miss', async () => {
      mockCache.match.mockResolvedValue(null);
      
      const result = await cacheManager.get('https://cache.datashelf.internal/test-key');
      expect(result).toBeNull();
    });

    it('should store data in cache', async () => {
      const data = { test: 'value' };
      
      await cacheManager.set('https://cache.datashelf.internal/test-key', data, 300);
      
      expect(mockCache.put).toHaveBeenCalledWith(
        expect.any(Request),
        expect.any(Response)
      );
    });

    it('should delete cache entry', async () => {
      await cacheManager.delete('https://cache.datashelf.internal/test-key');
      expect(mockCache.delete).toHaveBeenCalled();
    });
  });

  describe('Stale-While-Revalidate', () => {
    it('should fetch fresh data on cache miss', async () => {
      mockCache.match.mockResolvedValue(null);
      const fetcher = vi.fn().mockResolvedValue({ fresh: 'data' });
      
      const result = await cacheManager.getWithSWR('https://cache.datashelf.internal/test-key', fetcher, 300);
      
      expect(result.cached).toBe(false);
      expect(result.stale).toBe(false);
      expect(result.data).toEqual({ fresh: 'data' });
      expect(fetcher).toHaveBeenCalled();
    });

    it('should return cached data when available', async () => {
      const cachedEntry = {
        data: { cached: 'data' },
        timestamp: Date.now(),
        ttl: 300,
        staleAt: Date.now() + 300000,
      };
      const mockResponse = new Response(JSON.stringify(cachedEntry));
      mockCache.match.mockResolvedValue(mockResponse);
      const fetcher = vi.fn();
      
      const result = await cacheManager.getWithSWR('https://cache.datashelf.internal/test-key', fetcher, 300);
      
      expect(result.cached).toBe(true);
      expect(result.stale).toBe(false);
      expect(result.data).toEqual({ cached: 'data' });
      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  describe('Cache Metrics', () => {
    it('should track basic metrics', () => {
      const metrics = cacheManager.getMetrics();
      expect(metrics).toHaveProperty('hits');
      expect(metrics).toHaveProperty('misses');
      expect(metrics).toHaveProperty('staleHits');
      expect(metrics).toHaveProperty('errors');
    });

    it('should reset metrics', () => {
      cacheManager.resetMetrics();
      const metrics = cacheManager.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
    });
  });
});