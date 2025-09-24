import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { revalidationRoutes } from '@/handlers/revalidation';
import type { Env } from '@/types/env';

// Mock the RevalidationUtils
vi.mock('@/utils/revalidation-integration', () => ({
  RevalidationUtils: vi.fn().mockImplementation(() => ({
    getMetrics: vi.fn().mockReturnValue({
      totalRequests: 10,
      successfulRequests: 8,
      failedRequests: 1,
      rateLimitedRequests: 1,
      averageResponseTime: 250,
      lastRequestTime: '2024-01-01T12:00:00Z',
      scraperAvailable: true,
    }),
    getRateLimitStatus: vi.fn().mockReturnValue({
      allowed: true,
      usage: { minute: 3, hour: 25 },
      limits: { minute: 10, hour: 100 },
    }),
    checkScraperHealth: vi.fn().mockResolvedValue(true),
    triggerManualRevalidation: vi.fn().mockResolvedValue({
      success: true,
      jobId: 'manual-job-456',
      message: 'Manual revalidation triggered successfully',
      timestamp: '2024-01-01T12:00:00Z',
    }),
  })),
}));

describe('Revalidation API Handlers', () => {
  let app: Hono;
  let mockEnv: Env;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/revalidation', revalidationRoutes);

    mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SCRAPER_API_KEY: 'test-scraper-key',
      SCRAPER_SERVICE_URL: 'https://scraper.example.com',
      REVALIDATION_ENABLED: 'true',
    };

    vi.clearAllMocks();
  });

  describe('GET /api/revalidation/metrics', () => {
    it('should return revalidation metrics', async () => {
      const res = await app.request('/api/revalidation/metrics', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data).toMatchObject({
        revalidation: {
          totalRequests: 10,
          successfulRequests: 8,
          failedRequests: 1,
          rateLimitedRequests: 1,
          averageResponseTime: 250,
          lastRequestTime: '2024-01-01T12:00:00Z',
          scraperAvailable: true,
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock error in RevalidationUtils
      const { RevalidationUtils } = await import('@/utils/revalidation-integration');
      vi.mocked(RevalidationUtils).mockImplementationOnce(() => {
        throw new Error('Service unavailable');
      });

      const res = await app.request('/api/revalidation/metrics', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(500);
      
      const data = await res.json();
      expect(data).toMatchObject({
        error: 'Internal Server Error',
        message: 'Failed to fetch revalidation metrics',
      });
    });
  });

  describe('GET /api/revalidation/status', () => {
    it('should return comprehensive revalidation status', async () => {
      const res = await app.request('/api/revalidation/status', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data).toMatchObject({
        enabled: true,
        scraper_available: true,
        rate_limits: {
          allowed: true,
          usage: { minute: 3, hour: 25 },
          limits: { minute: 10, hour: 100 },
        },
        metrics: {
          total_requests: 10,
          success_rate: 80, // 8/10 * 100
          average_response_time: 250,
          last_request: '2024-01-01T12:00:00Z',
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle disabled revalidation', async () => {
      const disabledEnv = { ...mockEnv, REVALIDATION_ENABLED: 'false' };
      
      const res = await app.request('/api/revalidation/status', {
        method: 'GET',
      }, disabledEnv);

      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.enabled).toBe(false);
    });

    it('should calculate success rate correctly with zero requests', async () => {
      // Mock zero requests
      const { RevalidationUtils } = await import('@/utils/revalidation-integration');
      vi.mocked(RevalidationUtils).mockImplementationOnce(() => ({
        getMetrics: vi.fn().mockReturnValue({
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          rateLimitedRequests: 0,
          averageResponseTime: 0,
          scraperAvailable: true,
        }),
        getRateLimitStatus: vi.fn().mockReturnValue({
          allowed: true,
          usage: { minute: 0, hour: 0 },
          limits: { minute: 10, hour: 100 },
        }),
        checkScraperHealth: vi.fn().mockResolvedValue(true),
      }));

      const res = await app.request('/api/revalidation/status', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.metrics.success_rate).toBe(0);
    });
  });

  describe('POST /api/revalidation/trigger', () => {
    it('should trigger manual revalidation successfully', async () => {
      const requestBody = {
        type: 'product',
        target_url: 'https://worldofbooks.com/product/123',
        priority: 8,
        metadata: { source: 'manual-test' },
      };

      const res = await app.request('/api/revalidation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }, mockEnv);

      expect(res.status).toBe(201);
      
      const data = await res.json();
      expect(data).toMatchObject({
        success: true,
        job_id: 'manual-job-456',
        message: 'Manual revalidation triggered successfully',
        timestamp: '2024-01-01T12:00:00Z',
      });
    });

    it('should validate required fields', async () => {
      const invalidBodies = [
        {}, // Missing both fields
        { type: 'product' }, // Missing target_url
        { target_url: 'https://example.com' }, // Missing type
      ];

      for (const body of invalidBodies) {
        const res = await app.request('/api/revalidation/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }, mockEnv);

        expect(res.status).toBe(400);
        
        const data = await res.json();
        expect(data.error).toBe('Validation Error');
        expect(data.message).toBe('type and target_url are required');
      }
    });

    it('should validate job type', async () => {
      const requestBody = {
        type: 'invalid-type',
        target_url: 'https://worldofbooks.com/product/123',
      };

      const res = await app.request('/api/revalidation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }, mockEnv);

      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error).toBe('Validation Error');
      expect(data.message).toBe('type must be one of: navigation, category, product');
    });

    it('should validate URL format', async () => {
      const requestBody = {
        type: 'product',
        target_url: 'invalid-url',
      };

      const res = await app.request('/api/revalidation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }, mockEnv);

      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error).toBe('Validation Error');
      expect(data.message).toBe('target_url must be a valid URL');
    });

    it('should handle revalidation failure', async () => {
      // Mock revalidation failure
      const { RevalidationUtils } = await import('@/utils/revalidation-integration');
      vi.mocked(RevalidationUtils).mockImplementationOnce(() => ({
        triggerManualRevalidation: vi.fn().mockResolvedValue({
          success: false,
          message: 'Scraper service unavailable',
          timestamp: '2024-01-01T12:00:00Z',
        }),
      }));

      const requestBody = {
        type: 'navigation',
        target_url: 'https://worldofbooks.com',
      };

      const res = await app.request('/api/revalidation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }, mockEnv);

      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error).toBe('Revalidation Failed');
      expect(data.message).toBe('Scraper service unavailable');
    });

    it('should use default priority when not specified', async () => {
      const requestBody = {
        type: 'category',
        target_url: 'https://worldofbooks.com/category/fiction',
      };

      const res = await app.request('/api/revalidation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }, mockEnv);

      expect(res.status).toBe(201);
    });

    it('should handle malformed JSON', async () => {
      const res = await app.request('/api/revalidation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json',
      }, mockEnv);

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/revalidation/health', () => {
    it('should return healthy status when all systems are working', async () => {
      const res = await app.request('/api/revalidation/health', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data).toMatchObject({
        status: 'healthy',
        details: {
          revalidation_enabled: true,
          scraper_available: true,
          rate_limits_ok: true,
          scraper_service_url: 'configured',
          api_key: 'configured',
        },
        timestamp: expect.any(String),
      });
    });

    it('should return degraded status when scraper is unavailable', async () => {
      // Mock scraper unavailable
      const { RevalidationUtils } = await import('@/utils/revalidation-integration');
      vi.mocked(RevalidationUtils).mockImplementationOnce(() => ({
        checkScraperHealth: vi.fn().mockResolvedValue(false),
        getRateLimitStatus: vi.fn().mockReturnValue({
          allowed: true,
          usage: { minute: 0, hour: 0 },
          limits: { minute: 10, hour: 100 },
        }),
      }));

      const res = await app.request('/api/revalidation/health', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(503);
      
      const data = await res.json();
      expect(data.status).toBe('degraded');
      expect(data.details.scraper_available).toBe(false);
    });

    it('should return degraded status when rate limited', async () => {
      // Mock rate limit exceeded
      const { RevalidationUtils } = await import('@/utils/revalidation-integration');
      vi.mocked(RevalidationUtils).mockImplementationOnce(() => ({
        checkScraperHealth: vi.fn().mockResolvedValue(true),
        getRateLimitStatus: vi.fn().mockReturnValue({
          allowed: false,
          usage: { minute: 10, hour: 50 },
          limits: { minute: 10, hour: 100 },
        }),
      }));

      const res = await app.request('/api/revalidation/health', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(503);
      
      const data = await res.json();
      expect(data.status).toBe('degraded');
      expect(data.details.rate_limits_ok).toBe(false);
    });

    it('should show missing configuration', async () => {
      const incompleteEnv = {
        ...mockEnv,
        SCRAPER_SERVICE_URL: undefined,
        SCRAPER_API_KEY: undefined,
      };

      const res = await app.request('/api/revalidation/health', {
        method: 'GET',
      }, incompleteEnv);

      // The status might be 200 or 503 depending on other factors, but we care about the details
      const data = await res.json();
      expect(data.details.scraper_service_url).toBe('missing');
      expect(data.details.api_key).toBe('missing');
    });

    it('should handle health check errors', async () => {
      // Mock error in health check
      const { RevalidationUtils } = await import('@/utils/revalidation-integration');
      vi.mocked(RevalidationUtils).mockImplementationOnce(() => {
        throw new Error('Health check failed');
      });

      const res = await app.request('/api/revalidation/health', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(503);
      
      const data = await res.json();
      expect(data.error).toBe('Health Check Failed');
    });
  });

  describe('Error handling', () => {
    it('should handle service initialization errors', async () => {
      // Mock RevalidationUtils constructor error
      const { RevalidationUtils } = await import('@/utils/revalidation-integration');
      vi.mocked(RevalidationUtils).mockImplementationOnce(() => {
        throw new Error('Service initialization failed');
      });

      const res = await app.request('/api/revalidation/metrics', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(500);
    });

    it('should handle async operation errors', async () => {
      // Mock async method error
      const { RevalidationUtils } = await import('@/utils/revalidation-integration');
      vi.mocked(RevalidationUtils).mockImplementationOnce(() => ({
        checkScraperHealth: vi.fn().mockRejectedValue(new Error('Network timeout')),
        getRateLimitStatus: vi.fn().mockReturnValue({
          allowed: true,
          usage: { minute: 0, hour: 0 },
          limits: { minute: 10, hour: 100 },
        }),
      }));

      const res = await app.request('/api/revalidation/status', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(500);
    });
  });
});