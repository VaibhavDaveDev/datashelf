import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheManager, generateCacheKey, createCacheRequest, getDynamicTTL } from '@/utils/cache';

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

describe('Cache API Migration Tests', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheManager = new CacheManager();
  });

  describe('Cache Key Generation for Cache API', () => {
    it('should generate URL-based cache keys', () => {
      const key = generateCacheKey('navigation');
      expect(key).toBe('https://cache.datashelf.internal/navigation');
      expect(key).toMatch(/^https:\/\//);
    });

    it('should create proper Request objects', () => {
      const cacheKey = 'https://cache.datashelf.internal/products:categoryId=123';
      const request = createCacheRequest(cacheKey);
      
      expect(request).toBeInstanceOf(Request);
      expect(request.url).toBe(cacheKey);
      expect(request.method).toBe('GET');
      expect(request.headers.get('Cache-Control')).toBe('no-cache');
    });
  });

  describe('Dynamic TTL Management', () => {
    it('should return correct TTL for navigation endpoints', () => {
      expect(getDynamicTTL('/api/navigation')).toBe(3600); // 1 hour
    });

    it('should return correct TTL for category endpoints', () => {
      expect(getDynamicTTL('/api/categories')).toBe(1800); // 30 minutes
    });

    it('should return correct TTL for product detail endpoints', () => {
      expect(getDynamicTTL('/api/products/123')).toBe(120); // 2 minutes
    });

    it('should return correct TTL for product list endpoints', () => {
      expect(getDynamicTTL('/api/products')).toBe(300); // 5 minutes
    });

    it('should return default TTL for unknown endpoints', () => {
      expect(getDynamicTTL('/api/unknown')).toBe(60); // 1 minute
    });
  });

  describe('Cache API Operations', () => {
    it('should use Cache API for storing responses', async () => {
      const data = { test: 'value' };
      const ttl = 300;
      
      await cacheManager.set('https://cache.datashelf.internal/test', data, ttl);
      
      expect(mockCache.put).toHaveBeenCalledWith(
        expect.any(Request),
        expect.any(Response)
      );

      const [request, response] = mockCache.put.mock.calls[0];
      expect(request.url).toBe('https://cache.datashelf.internal/test');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=600');
      expect(response.headers.get('CDN-Cache-Control')).toBe('public, max-age=600');
    });

    it('should use Cache API for retrieving responses', async () => {
      const cachedData = {
        data: { test: 'value' },
        timestamp: Date.now(),
        ttl: 300,
        staleAt: Date.now() + 300000,
      };
      
      const mockResponse = new Response(JSON.stringify(cachedData));
      mockCache.match.mockResolvedValue(mockResponse);
      
      const result = await cacheManager.get('https://cache.datashelf.internal/test');
      
      expect(mockCache.match).toHaveBeenCalledWith(expect.any(Request));
      expect(result).toEqual(cachedData);
    });

    it('should use Cache API for deleting entries', async () => {
      await cacheManager.delete('https://cache.datashelf.internal/test');
      
      expect(mockCache.delete).toHaveBeenCalledWith(expect.any(Request));
    });
  });

  describe('Cache-First Strategy', () => {
    it('should implement cache-first with automatic edge distribution', async () => {
      // Cache miss scenario
      mockCache.match.mockResolvedValue(null);
      const fetcher = vi.fn().mockResolvedValue({ fresh: 'data' });
      
      const result = await cacheManager.getWithSWR(
        'https://cache.datashelf.internal/test',
        fetcher,
        300
      );
      
      expect(result.cached).toBe(false);
      expect(result.data).toEqual({ fresh: 'data' });
      expect(mockCache.put).toHaveBeenCalled(); // Should store in cache
    });

    it('should serve from cache when available', async () => {
      const cachedData = {
        data: { cached: 'data' },
        timestamp: Date.now(),
        ttl: 300,
        staleAt: Date.now() + 300000,
      };
      
      const mockResponse = new Response(JSON.stringify(cachedData));
      mockCache.match.mockResolvedValue(mockResponse);
      const fetcher = vi.fn();
      
      const result = await cacheManager.getWithSWR(
        'https://cache.datashelf.internal/test',
        fetcher,
        300
      );
      
      expect(result.cached).toBe(true);
      expect(result.data).toEqual({ cached: 'data' });
      expect(fetcher).not.toHaveBeenCalled(); // Should not fetch from origin
    });
  });

  describe('Stale-While-Revalidate with Cache API', () => {
    it('should serve stale data and trigger background revalidation', async () => {
      const staleData = {
        data: { stale: 'data' },
        timestamp: Date.now() - 400000,
        ttl: 300,
        staleAt: Date.now() - 100000, // Stale
      };
      
      const mockResponse = new Response(JSON.stringify(staleData));
      mockCache.match.mockResolvedValue(mockResponse);
      const fetcher = vi.fn().mockResolvedValue({ fresh: 'data' });
      
      const result = await cacheManager.getWithSWR(
        'https://cache.datashelf.internal/test',
        fetcher,
        300,
        true // Enable background revalidation
      );
      
      expect(result.cached).toBe(true);
      expect(result.stale).toBe(true);
      expect(result.data).toEqual({ stale: 'data' });
      
      // Allow background revalidation to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(fetcher).toHaveBeenCalled();
    });
  });

  describe('TTL and Expiration Handling', () => {
    it('should set proper TTL headers for Cache API', async () => {
      const data = { test: 'value' };
      const ttl = 300;
      
      await cacheManager.set('https://cache.datashelf.internal/test', data, ttl);
      
      const [, response] = mockCache.put.mock.calls[0];
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=600'); // 2x TTL
      expect(response.headers.get('Expires')).toBeTruthy();
    });

    it('should handle expired entries by cleaning them up', async () => {
      const expiredData = {
        data: { test: 'value' },
        timestamp: Date.now() - 1000000,
        ttl: 300,
        staleAt: Date.now() - 700000, // Expired beyond 2x TTL
      };
      
      const mockResponse = new Response(JSON.stringify(expiredData));
      mockCache.match.mockResolvedValue(mockResponse);
      
      const result = await cacheManager.get('https://cache.datashelf.internal/test');
      
      expect(result).toBeNull();
      expect(mockCache.delete).toHaveBeenCalled(); // Should clean up expired entry
    });
  });

  describe('Cache Metrics with Cache API', () => {
    it('should track hits, misses, and stale hits', async () => {
      // Reset metrics
      cacheManager.resetMetrics();
      
      // Cache miss
      mockCache.match.mockResolvedValue(null);
      await cacheManager.get('https://cache.datashelf.internal/miss');
      
      // Cache hit
      const freshData = {
        data: { test: 'value' },
        timestamp: Date.now(),
        ttl: 300,
        staleAt: Date.now() + 300000,
      };
      mockCache.match.mockResolvedValue(new Response(JSON.stringify(freshData)));
      await cacheManager.get('https://cache.datashelf.internal/hit');
      
      // Stale hit
      const staleData = {
        data: { test: 'value' },
        timestamp: Date.now() - 400000,
        ttl: 300,
        staleAt: Date.now() - 100000,
      };
      mockCache.match.mockResolvedValue(new Response(JSON.stringify(staleData)));
      await cacheManager.get('https://cache.datashelf.internal/stale');
      
      const metrics = cacheManager.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.staleHits).toBe(1);
    });
  });
});