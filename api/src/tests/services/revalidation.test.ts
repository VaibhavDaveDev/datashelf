import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RevalidationService } from '@/services/revalidation';
import type { Env } from '@/types/env';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('RevalidationService', () => {
  let service: RevalidationService;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SCRAPER_API_KEY: 'test-scraper-key',
      SCRAPER_SERVICE_URL: 'https://scraper.example.com',
      REVALIDATION_RATE_LIMIT_PER_MINUTE: '10',
      REVALIDATION_RATE_LIMIT_PER_HOUR: '100',
    };

    service = new RevalidationService(mockEnv);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('triggerRevalidation', () => {
    it('should successfully trigger revalidation job', async () => {
      // Mock scraper health check
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'healthy' }), { status: 200 }))
        // Mock job creation
        .mockResolvedValueOnce(new Response(JSON.stringify({ 
          success: true, 
          jobId: 'job-123',
          message: 'Job created successfully'
        }), { status: 201 }));

      const result = await service.triggerRevalidation({
        type: 'product',
        target_url: 'https://worldofbooks.com/product/123',
        priority: 5,
      });

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(result.message).toBe('Revalidation job triggered successfully');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle scraper service unavailable', async () => {
      // Mock scraper health check failure
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'unhealthy' }), { status: 503 }));

      const result = await service.triggerRevalidation({
        type: 'category',
        target_url: 'https://worldofbooks.com/category/fiction',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Scraper service unavailable');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle rate limiting', async () => {
      // Mock scraper health check
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: 'healthy' }), { status: 200 }));

      // Trigger multiple requests to hit rate limit
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(service.triggerRevalidation({
          type: 'product',
          target_url: `https://worldofbooks.com/product/${i}`,
        }));
      }

      const results = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimited = results.filter(r => r.message === 'Rate limit exceeded');
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should handle job creation failure', async () => {
      // Mock scraper health check
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'healthy' }), { status: 200 }))
        // Mock job creation failure
        .mockResolvedValueOnce(new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid job type'
        }), { status: 400 }));

      const result = await service.triggerRevalidation({
        type: 'product',
        target_url: 'https://worldofbooks.com/product/123',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid job type');
    });

    it('should handle network errors', async () => {
      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.triggerRevalidation({
        type: 'navigation',
        target_url: 'https://worldofbooks.com',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Scraper service unavailable');
    });

    it('should include metadata in job request', async () => {
      // Mock scraper health check
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'healthy' }), { status: 200 }))
        // Mock job creation
        .mockResolvedValueOnce(new Response(JSON.stringify({ 
          success: true, 
          jobId: 'job-456'
        }), { status: 201 }));

      const metadata = { category_id: 'cat-123', source: 'test' };
      
      await service.triggerRevalidation({
        type: 'category',
        target_url: 'https://worldofbooks.com/category/123',
        metadata,
      }, 'test-source');

      // Check that the job creation request includes metadata
      const jobCreationCall = mockFetch.mock.calls[1];
      const requestBody = JSON.parse(jobCreationCall[1].body);
      
      expect(requestBody.metadata).toMatchObject({
        ...metadata,
        triggered_by: 'revalidation',
        source: 'test-source',
      });
    });
  });

  describe('checkScraperHealth', () => {
    it('should return true for healthy scraper', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'healthy' }), { status: 200 }));

      const isHealthy = await service.checkScraperHealth();
      
      expect(isHealthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://scraper.example.com/health',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-scraper-key',
          }),
        })
      );
    });

    it('should return false for unhealthy scraper', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'unhealthy' }), { status: 503 }));

      const isHealthy = await service.checkScraperHealth();
      expect(isHealthy).toBe(false);
    });

    it('should return false for network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const isHealthy = await service.checkScraperHealth();
      expect(isHealthy).toBe(false);
    });

    it('should handle different health response formats', async () => {
      // Test with 'ok' status
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
      expect(await service.checkScraperHealth()).toBe(true);

      // Test with non-200 status
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'healthy' }), { status: 500 }));
      expect(await service.checkScraperHealth()).toBe(false);
    });
  });

  describe('triggerStaleRevalidation', () => {
    it('should trigger background revalidation without waiting', async () => {
      // Mock scraper health check and job creation
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'healthy' }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ 
          success: true, 
          jobId: 'bg-job-123'
        }), { status: 201 }));

      // This should not throw and should return immediately
      const promise = service.triggerStaleRevalidation(
        'cache-key-123',
        'product',
        'https://worldofbooks.com/product/123',
        { test: 'metadata' }
      );

      // Should resolve immediately (not wait for background job)
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('getMetrics', () => {
    it('should return initial metrics', () => {
      const metrics = service.getMetrics();
      
      expect(metrics).toMatchObject({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimitedRequests: 0,
        averageResponseTime: 0,
        scraperAvailable: true,
      });
    });

    it('should update metrics after requests', async () => {
      // Mock successful request
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'healthy' }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ 
          success: true, 
          jobId: 'job-123'
        }), { status: 201 }));

      await service.triggerRevalidation({
        type: 'product',
        target_url: 'https://worldofbooks.com/product/123',
      });

      const metrics = service.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return rate limit status', () => {
      const status = service.getRateLimitStatus('test-source');
      
      expect(status).toMatchObject({
        allowed: true,
        usage: { minute: 0, hour: 0 },
        limits: { minute: 10, hour: 100 },
      });
    });

    it('should track usage per source', async () => {
      // Mock successful request
      mockFetch
        .mockResolvedValue(new Response(JSON.stringify({ status: 'healthy' }), { status: 200 }))
        .mockResolvedValue(new Response(JSON.stringify({ 
          success: true, 
          jobId: 'job-123'
        }), { status: 201 }));

      // Make a request
      await service.triggerRevalidation({
        type: 'product',
        target_url: 'https://worldofbooks.com/product/123',
      }, 'test-source');

      const status = service.getRateLimitStatus('test-source');
      expect(status.usage.minute).toBe(1);
      expect(status.usage.hour).toBe(1);
    });
  });

  describe('Rate limiting behavior', () => {
    it('should enforce per-minute rate limits', async () => {
      // Mock scraper as healthy
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: 'healthy' }), { status: 200 }));

      const source = 'minute-test';
      const results = [];

      // Make requests up to the limit
      for (let i = 0; i < 12; i++) {
        const result = await service.triggerRevalidation({
          type: 'product',
          target_url: `https://worldofbooks.com/product/${i}`,
        }, source);
        results.push(result);
      }

      // First 10 should succeed, rest should be rate limited
      const successful = results.filter(r => r.success).length;
      const rateLimited = results.filter(r => r.message === 'Rate limit exceeded').length;

      expect(successful).toBeLessThanOrEqual(10);
      expect(rateLimited).toBeGreaterThan(0);
    });
  });
});