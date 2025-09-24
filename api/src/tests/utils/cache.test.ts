import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCacheKey, getCacheConfig, CacheManager } from '@/utils/cache';
import type { Env } from '@/types/env';

// Mock Cache API for testing
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// Setup global caches mock
global.caches = {
  default: mockCache as any,
};

describe('Cache Utils', () => {
  describe('generateCacheKey', () => {
    it('should generate cache key with prefix only', () => {
      const key = generateCacheKey('test');
      expect(key).toBe('https://cache.datashelf.internal/test');
    });

    it('should generate cache key with parameters', () => {
      const params = { id: '123', type: 'product' };
      const key = generateCacheKey('test', params);
      expect(key).toBe('https://cache.datashelf.internal/test:id=123&type=product');
    });

    it('should sort parameters consistently', () => {
      const params1 = { b: '2', a: '1' };
      const params2 = { a: '1', b: '2' };
      const key1 = generateCacheKey('test', params1);
      const key2 = generateCacheKey('test', params2);
      expect(key1).toBe(key2);
      expect(key1).toBe('https://cache.datashelf.internal/test:a=1&b=2');
    });

    it('should handle empty parameters', () => {
      const key = generateCacheKey('test', {});
      expect(key).toBe('https://cache.datashelf.internal/test');
    });
  });

  describe('getCacheConfig', () => {
    it('should return default cache configuration', () => {
      const env = {} as Env;
      const config = getCacheConfig(env);
      
      expect(config.navigation).toBe(3600); // 1 hour
      expect(config.categories).toBe(1800); // 30 minutes
      expect(config.products).toBe(300); // 5 minutes
      expect(config.productDetail).toBe(120); // 2 minutes
    });

    it('should use environment variables when provided', () => {
      const env = {
        CACHE_TTL_NAVIGATION: '1800',
        CACHE_TTL_CATEGORIES: '600',
        CACHE_TTL_PRODUCTS: '450',
        CACHE_TTL_PRODUCT_DETAIL: '1200',
      } as Env;
      
      const config = getCacheConfig(env);
      
      expect(config.navigation).toBe(1800);
      expect(config.categories).toBe(600);
      expect(config.products).toBe(450);
      expect(config.productDetail).toBe(1200);
    });

    it('should handle invalid environment variables', () => {
      const env = {
        CACHE_TTL_NAVIGATION: 'invalid',
        CACHE_TTL_CATEGORIES: '',
      } as Env;
      
      const config = getCacheConfig(env);
      
      expect(config.navigation).toBe(3600); // falls back to default (1 hour)
      expect(config.categories).toBe(1800); // falls back to default (30 minutes)
      expect(config.products).toBe(300); // default value (5 minutes)
      expect(config.productDetail).toBe(120); // default value (2 minutes)
    });
  });

  describe('CacheManager', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
      vi.clearAllMocks();
      cacheManager = new CacheManager();
    });

    describe('get', () => {
      it('should retrieve cached data', async () => {
        const testData = { id: '1', name: 'test' };
        const cacheEntry = {
          data: testData,
          timestamp: Date.now(),
          ttl: 300,
          staleAt: Date.now() + 300000,
        };
        const mockResponse = new Response(JSON.stringify(cacheEntry));
        mockCache.match.mockResolvedValue(mockResponse);

        const cacheKey = generateCacheKey('test');
        const result = await cacheManager.get(cacheKey);
        
        expect(mockCache.match).toHaveBeenCalled();
        expect(result?.data).toEqual(testData);
      });

      it('should return null when cache miss', async () => {
        mockCache.match.mockResolvedValue(null);

        const cacheKey = generateCacheKey('test');
        const result = await cacheManager.get(cacheKey);
        
        expect(result).toBeNull();
      });

      it('should handle cache errors gracefully', async () => {
        mockCache.match.mockRejectedValue(new Error('Cache error'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const cacheKey = generateCacheKey('test');
        const result = await cacheManager.get(cacheKey);
        
        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith('Cache get error:', expect.any(Error));
        
        consoleSpy.mockRestore();
      });
    });

    describe('set', () => {
      it('should store data in cache with TTL', async () => {
        const testData = { id: '1', name: 'test' };
        mockCache.put.mockResolvedValue(undefined);

        const cacheKey = generateCacheKey('test');
        await cacheManager.set(cacheKey, testData, 300);
        
        expect(mockCache.put).toHaveBeenCalled();
        const [request, response] = mockCache.put.mock.calls[0];
        expect(request.url).toContain('test');
        expect(response.headers.get('Cache-Control')).toContain('max-age=600'); // 2x TTL
      });

      it('should handle cache set errors gracefully', async () => {
        mockCache.put.mockRejectedValue(new Error('Cache error'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const cacheKey = generateCacheKey('test');
        await cacheManager.set(cacheKey, { test: 'data' }, 300);
        
        expect(consoleSpy).toHaveBeenCalledWith('Cache set error:', expect.any(Error));
        
        consoleSpy.mockRestore();
      });
    });

    describe('delete', () => {
      it('should delete cached data', async () => {
        mockCache.delete.mockResolvedValue(true);

        const cacheKey = generateCacheKey('test');
        await cacheManager.delete(cacheKey);
        
        expect(mockCache.delete).toHaveBeenCalled();
      });

      it('should handle cache delete errors gracefully', async () => {
        mockCache.delete.mockRejectedValue(new Error('Cache error'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const cacheKey = generateCacheKey('test');
        await cacheManager.delete(cacheKey);
        
        expect(consoleSpy).toHaveBeenCalledWith('Cache delete error:', expect.any(Error));
        
        consoleSpy.mockRestore();
      });
    });

    describe('getWithSWR', () => {
      it('should return cached data when available', async () => {
        const cachedData = { id: '1', name: 'cached' };
        const cacheEntry = {
          data: cachedData,
          timestamp: Date.now(),
          ttl: 300,
          staleAt: Date.now() + 300000, // Fresh data
        };
        const mockResponse = new Response(JSON.stringify(cacheEntry));
        mockCache.match.mockResolvedValue(mockResponse);

        const fetcher = vi.fn().mockResolvedValue({ id: '1', name: 'fresh' });
        const cacheKey = generateCacheKey('test');
        const result = await cacheManager.getWithSWR(cacheKey, fetcher, 300);
        
        expect(result.data).toEqual(cachedData);
        expect(result.cached).toBe(true);
        expect(fetcher).not.toHaveBeenCalled();
      });

      it('should fetch and cache fresh data when cache miss', async () => {
        const freshData = { id: '1', name: 'fresh' };
        mockCache.match.mockResolvedValue(null);
        mockCache.put.mockResolvedValue(undefined);

        const fetcher = vi.fn().mockResolvedValue(freshData);
        const cacheKey = generateCacheKey('test');
        const result = await cacheManager.getWithSWR(cacheKey, fetcher, 300);
        
        expect(result.data).toEqual(freshData);
        expect(result.cached).toBe(false);
        expect(fetcher).toHaveBeenCalled();
        expect(mockCache.put).toHaveBeenCalled();
      });
    });
  });
});