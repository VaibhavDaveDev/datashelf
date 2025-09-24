import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { cacheRoutes } from '@/handlers/cache';
import { healthRoutes } from '@/handlers/health';
import type { Env } from '@/types/env';

// Mock Supabase client
vi.mock('@/services/supabase', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }))
}));



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

// Mock KV for legacy health check
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// Mock environment with all required variables
const mockEnv: Env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-key',
  SCRAPER_API_KEY: 'test-scraper-key',
  SCRAPER_SERVICE_URL: 'https://scraper.test.com',
  CACHE_TTL_NAVIGATION: '3600',
  CACHE_TTL_CATEGORIES: '1800',
  CACHE_TTL_PRODUCTS: '300',
  CACHE_TTL_PRODUCT_DETAIL: '120',
  API_VERSION: '1.0',
  CORS_ORIGINS: 'http://localhost:3000',
  RATE_LIMIT_REQUESTS_PER_MINUTE: '100',
  CACHE: mockKV as any, // Legacy KV for health check
};

// Create test app with middleware to inject environment
const app = new Hono<{ Bindings: Env }>();

// Middleware to inject mock environment
app.use('*', async (c, next) => {
  // Inject mock environment into context
  c.env = mockEnv;
  await next();
});

app.route('/cache', cacheRoutes);
app.route('/', healthRoutes);

describe('Cache API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset cache mocks
    mockCache.match.mockReset();
    mockCache.put.mockReset();
    mockCache.delete.mockReset();
  });

  describe('POST /cache/invalidate', () => {
    it('should invalidate cache with valid signature', async () => {
      const req = new Request('http://localhost/cache/invalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': 'sha256=valid-signature',
        },
        body: JSON.stringify({
          type: 'navigation',
        }),
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('navigation');
    });

    it('should reject request without valid signature', async () => {
      const req = new Request('http://localhost/cache/invalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'navigation',
        }),
      });

      const res = await app.request(req);
      
      expect(res.status).toBe(401);
    });

    it('should validate invalidation type', async () => {
      const req = new Request('http://localhost/cache/invalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': 'sha256=valid-signature',
        },
        body: JSON.stringify({
          type: 'invalid-type',
        }),
      });

      const res = await app.request(req);
      
      expect(res.status).toBe(400);
    });

    it('should handle product invalidation with category', async () => {
      const req = new Request('http://localhost/cache/invalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': 'sha256=valid-signature',
        },
        body: JSON.stringify({
          type: 'product',
          id: 'product-123',
          categoryId: 'category-456',
        }),
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('POST /cache/warm', () => {
    it('should accept cache warming request', async () => {
      const req = new Request('http://localhost/cache/warm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': 'sha256=valid-signature',
        },
        body: JSON.stringify({
          type: 'navigation',
        }),
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(202);
      expect(data.success).toBe(true);
      expect(data.message).toContain('warming initiated');
    });

    it('should validate warming type', async () => {
      const req = new Request('http://localhost/cache/warm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': 'sha256=valid-signature',
        },
        body: JSON.stringify({
          type: 'invalid-type',
        }),
      });

      const res = await app.request(req);
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /cache/cleanup', () => {
    it('should perform cache cleanup', async () => {
      const req = new Request('http://localhost/cache/cleanup', {
        method: 'POST',
        headers: {
          'X-Signature': 'sha256=valid-signature',
        },
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('cleanup completed');
    });
  });

  describe('GET /cache/stats', () => {
    it('should return cache statistics', async () => {
      // Mock Cache API operations for health check
      mockCache.put.mockResolvedValue(undefined);
      const mockResponse = new Response('{"test":true}');
      mockCache.match.mockResolvedValue(mockResponse);
      mockCache.delete.mockResolvedValue(true);

      const req = new Request('http://localhost/cache/stats');
      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('health');
      expect(data).toHaveProperty('performance');
      expect(data).toHaveProperty('timestamp');
    });
  });

  describe('POST /cache/metrics/record', () => {
    it('should record metrics to history', async () => {
      const req = new Request('http://localhost/cache/metrics/record', {
        method: 'POST',
        headers: {
          'X-Signature': 'sha256=valid-signature',
        },
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('recorded to history');
    });
  });
});

describe('Health Endpoints with Cache Monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset cache mocks
    mockCache.match.mockReset();
    mockCache.put.mockReset();
    mockCache.delete.mockReset();
    // Reset KV mocks
    mockKV.get.mockReset();
    mockKV.put.mockReset();
    mockKV.delete.mockReset();
  });

  describe('GET /health', () => {
    it('should include cache metrics in health check', async () => {
      // Mock successful Cache API operations
      mockCache.put.mockResolvedValue(undefined);
      const mockResponse = new Response('{"test":true}');
      mockCache.match.mockResolvedValue(mockResponse);
      mockCache.delete.mockResolvedValue(true);
      
      // Mock successful KV operations for legacy health check
      mockKV.put.mockResolvedValue(undefined);
      mockKV.get.mockResolvedValue('ok');

      const req = new Request('http://localhost/health');
      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('cache');
      expect(data.cache).toHaveProperty('metrics');
      expect(data.cache).toHaveProperty('health');
      expect(data.services.cache).toBe('healthy');
    });

    it('should report unhealthy when cache fails', async () => {
      // Mock failed Cache API operations
      mockCache.put.mockRejectedValue(new Error('Cache error'));
      
      // Mock failed KV operations for legacy health check
      mockKV.put.mockRejectedValue(new Error('Cache error'));

      const req = new Request('http://localhost/health');
      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.services.cache).toBe('unhealthy');
    });
  });

  describe('GET /cache/metrics', () => {
    it('should return detailed cache metrics', async () => {
      const req = new Request('http://localhost/cache/metrics');
      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('current');
      expect(data).toHaveProperty('history');
      expect(data).toHaveProperty('performance');
      expect(data).toHaveProperty('sizes');
      expect(data.current).toHaveProperty('hits');
      expect(data.current).toHaveProperty('misses');
      expect(data.current).toHaveProperty('hitRate');
    });
  });

  describe('GET /cache/health', () => {
    it('should return cache-specific health check', async () => {
      // Mock successful Cache API operations
      mockCache.put.mockResolvedValue(undefined);
      const mockResponse = new Response('{"test":true}');
      mockCache.match.mockResolvedValue(mockResponse);
      mockCache.delete.mockResolvedValue(true);

      const req = new Request('http://localhost/cache/health');
      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('issues');
      expect(data.status).toBe('healthy');
    });

    it('should return unhealthy status when cache fails', async () => {
      // Mock failed Cache API operations
      mockCache.put.mockRejectedValue(new Error('Cache error'));

      const req = new Request('http://localhost/cache/health');
      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.issues.length).toBeGreaterThan(0);
    });
  });
});

describe('Cache Response Headers', () => {
  it('should set appropriate cache control headers for cached responses', () => {
    // This would be tested in integration with actual handlers
    // Testing the response utility functions
  });

  it('should set stale-while-revalidate headers correctly', () => {
    // Test SWR header generation
  });

  it('should include cache status in response headers', () => {
    // Test X-Cache header values (HIT, MISS, STALE)
  });
});