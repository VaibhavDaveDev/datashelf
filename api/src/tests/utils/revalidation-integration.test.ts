import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  extractRevalidationDetails, 
  createRevalidationTrigger,
  RevalidationUtils 
} from '@/utils/revalidation-integration';
import type { Env } from '@/types/env';

// Mock the RevalidationService
vi.mock('@/services/revalidation', () => ({
  RevalidationService: vi.fn().mockImplementation(() => ({
    triggerStaleRevalidation: vi.fn().mockResolvedValue(undefined),
    triggerRevalidation: vi.fn().mockResolvedValue({
      success: true,
      jobId: 'test-job-123',
      message: 'Job triggered successfully',
      timestamp: new Date().toISOString(),
    }),
    getMetrics: vi.fn().mockReturnValue({
      totalRequests: 5,
      successfulRequests: 4,
      failedRequests: 1,
      rateLimitedRequests: 0,
      averageResponseTime: 150,
      scraperAvailable: true,
    }),
    getRateLimitStatus: vi.fn().mockReturnValue({
      allowed: true,
      usage: { minute: 2, hour: 15 },
      limits: { minute: 10, hour: 100 },
    }),
    checkScraperHealth: vi.fn().mockResolvedValue(true),
  })),
}));

describe('Revalidation Integration Utilities', () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SCRAPER_API_KEY: 'test-scraper-key',
      SCRAPER_SERVICE_URL: 'https://scraper.example.com',
      REVALIDATION_ENABLED: 'true',
    };
  });

  describe('extractRevalidationDetails', () => {
    it('should extract navigation details', () => {
      const cacheKey = 'https://cache.datashelf.internal/navigation';
      const details = extractRevalidationDetails(cacheKey);

      expect(details).toEqual({
        dataType: 'navigation',
        targetUrl: 'https://www.worldofbooks.com',
        metadata: {
          cache_prefix: 'navigation',
        },
      });
    });

    it('should extract categories details with navId', () => {
      const cacheKey = 'https://cache.datashelf.internal/categories:navId=nav-123&limit=20';
      const details = extractRevalidationDetails(cacheKey);

      expect(details).toEqual({
        dataType: 'category',
        targetUrl: 'https://www.worldofbooks.com/category/nav-123',
        metadata: {
          cache_prefix: 'categories',
          nav_id: 'nav-123',
          parent_id: null,
        },
      });
    });

    it('should extract categories details without navId', () => {
      const cacheKey = 'https://cache.datashelf.internal/categories:limit=20&offset=0';
      const details = extractRevalidationDetails(cacheKey);

      expect(details).toEqual({
        dataType: 'category',
        targetUrl: 'https://www.worldofbooks.com/categories',
        metadata: {
          cache_prefix: 'categories',
          nav_id: null,
          parent_id: null,
        },
      });
    });

    it('should extract products details with categoryId', () => {
      const cacheKey = 'https://cache.datashelf.internal/products:categoryId=cat-456&limit=20&sort=price_asc';
      const details = extractRevalidationDetails(cacheKey);

      expect(details).toEqual({
        dataType: 'product',
        targetUrl: 'https://www.worldofbooks.com/category/cat-456/products',
        metadata: {
          cache_prefix: 'products',
          category_id: 'cat-456',
        },
      });
    });

    it('should extract products details without categoryId', () => {
      const cacheKey = 'https://cache.datashelf.internal/products:limit=20';
      const details = extractRevalidationDetails(cacheKey);

      expect(details).toEqual({
        dataType: 'product',
        targetUrl: 'https://www.worldofbooks.com/products',
        metadata: {
          cache_prefix: 'products',
          category_id: null,
        },
      });
    });

    it('should extract product detail with productId', () => {
      const cacheKey = 'https://cache.datashelf.internal/product_detail:id=prod-789';
      const details = extractRevalidationDetails(cacheKey);

      expect(details).toEqual({
        dataType: 'product',
        targetUrl: 'https://www.worldofbooks.com/product/prod-789',
        metadata: {
          cache_prefix: 'product_detail',
          product_id: 'prod-789',
        },
      });
    });

    it('should return null for product detail without id', () => {
      const cacheKey = 'https://cache.datashelf.internal/product_detail';
      const details = extractRevalidationDetails(cacheKey);

      expect(details).toBeNull();
    });

    it('should return null for unknown cache key format', () => {
      const cacheKey = 'https://cache.datashelf.internal/unknown:param=value';
      const details = extractRevalidationDetails(cacheKey);

      expect(details).toBeNull();
    });

    it('should handle malformed cache keys gracefully', () => {
      const malformedKeys = [
        'invalid-url',
        'https://cache.datashelf.internal/',
        'https://other-domain.com/cache',
      ];

      malformedKeys.forEach(key => {
        const details = extractRevalidationDetails(key);
        expect(details).toBeNull();
      });
    });
  });

  describe('createRevalidationTrigger', () => {
    it('should create a working revalidation trigger', async () => {
      const trigger = createRevalidationTrigger(mockEnv);
      const cacheKey = 'https://cache.datashelf.internal/products:categoryId=cat-123';

      // Should not throw
      await expect(trigger(cacheKey)).resolves.toBeUndefined();
    });

    it('should skip revalidation when disabled', async () => {
      const disabledEnv = { ...mockEnv, REVALIDATION_ENABLED: 'false' };
      const trigger = createRevalidationTrigger(disabledEnv);
      const cacheKey = 'https://cache.datashelf.internal/navigation';

      // Should log and return without error
      await expect(trigger(cacheKey)).resolves.toBeUndefined();
    });

    it('should handle invalid cache keys gracefully', async () => {
      const trigger = createRevalidationTrigger(mockEnv);
      const invalidCacheKey = 'invalid-cache-key';

      // Should not throw
      await expect(trigger(invalidCacheKey)).resolves.toBeUndefined();
    });
  });

  describe('RevalidationUtils', () => {
    let utils: RevalidationUtils;

    beforeEach(() => {
      utils = new RevalidationUtils(mockEnv);
    });

    describe('triggerManualRevalidation', () => {
      it('should trigger manual revalidation with correct parameters', async () => {
        const result = await utils.triggerManualRevalidation(
          'product',
          'https://worldofbooks.com/product/123',
          8,
          { source: 'manual-test' }
        );

        expect(result).toEqual({
          success: true,
          jobId: 'test-job-123',
          message: 'Job triggered successfully',
          timestamp: expect.any(String),
        });
      });

      it('should use default priority when not specified', async () => {
        const result = await utils.triggerManualRevalidation(
          'navigation',
          'https://worldofbooks.com'
        );

        expect(result.success).toBe(true);
      });
    });

    describe('getMetrics', () => {
      it('should return revalidation metrics', () => {
        const metrics = utils.getMetrics();

        expect(metrics).toEqual({
          totalRequests: 5,
          successfulRequests: 4,
          failedRequests: 1,
          rateLimitedRequests: 0,
          averageResponseTime: 150,
          scraperAvailable: true,
        });
      });
    });

    describe('getRateLimitStatus', () => {
      it('should return rate limit status', () => {
        const status = utils.getRateLimitStatus('test-source');

        expect(status).toEqual({
          allowed: true,
          usage: { minute: 2, hour: 15 },
          limits: { minute: 10, hour: 100 },
        });
      });

      it('should use default source when not specified', () => {
        const status = utils.getRateLimitStatus();
        expect(status).toBeDefined();
      });
    });

    describe('checkScraperHealth', () => {
      it('should return scraper health status', async () => {
        const isHealthy = await utils.checkScraperHealth();
        expect(isHealthy).toBe(true);
      });
    });
  });

  describe('Cache key parsing edge cases', () => {
    it('should handle categories with parentId', () => {
      const cacheKey = 'https://cache.datashelf.internal/categories:parentId=parent-123&limit=10';
      const details = extractRevalidationDetails(cacheKey);

      expect(details?.metadata?.parent_id).toBe('parent-123');
    });

    it('should handle products with multiple query parameters', () => {
      const cacheKey = 'https://cache.datashelf.internal/products:categoryId=cat-123&limit=20&offset=40&sort=price_desc';
      const details = extractRevalidationDetails(cacheKey);

      expect(details?.dataType).toBe('product');
      expect(details?.metadata?.category_id).toBe('cat-123');
    });

    it('should handle URL encoding in parameters', () => {
      const cacheKey = 'https://cache.datashelf.internal/products:categoryId=cat%2D123';
      const details = extractRevalidationDetails(cacheKey);

      expect(details?.metadata?.category_id).toBe('cat-123');
    });

    it('should handle empty parameter values', () => {
      const cacheKey = 'https://cache.datashelf.internal/categories:navId=&limit=20';
      const details = extractRevalidationDetails(cacheKey);

      expect(details?.metadata?.nav_id).toBe('');
    });
  });
});