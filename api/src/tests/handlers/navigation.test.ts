import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { navigationRoutes } from '@/handlers/navigation';
import type { Env } from '@/types/env';

// Create mock functions
const mockGetWithSWR = vi.fn();
const mockAddToIndex = vi.fn();

// Mock dependencies
vi.mock('@/services/supabase', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          then: vi.fn(),
        })),
      })),
    })),
  })),
}));

vi.mock('@/utils/cache', () => ({
  CacheManager: vi.fn(() => ({
    getWithSWR: mockGetWithSWR,
    addToIndex: mockAddToIndex,
  })),
  getCacheConfig: vi.fn(() => ({
    navigation: 3600,
    categories: 1800,
    products: 300,
    productDetail: 120,
  })),
  generateCacheKey: vi.fn((prefix) => `https://cache.datashelf.internal/${prefix}`),
}));

vi.mock('@/utils/response', () => ({
  swrResponse: vi.fn((c, data) => c.json({ data })),
  errorResponse: vi.fn((c, error, message, status) => 
    c.json({ error, message, code: status }, status)
  ),
}));

// Mock global caches for Workers Cache API
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

global.caches = {
  default: mockCache,
} as any;

describe('Navigation API Endpoints', () => {
  let app: Hono;
  let mockEnv: Env;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/navigation', navigationRoutes);
    
    mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SCRAPER_API_KEY: 'test-scraper-key',
      SCRAPER_SERVICE_URL: 'https://scraper.test.com',
    };

    vi.clearAllMocks();
  });

  describe('GET /api/navigation', () => {
    it('should return hierarchical navigation structure', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: [
          {
            id: 'nav-1',
            title: 'Fiction',
            source_url: 'https://worldofbooks.com/fiction',
            last_scraped_at: '2023-01-01T00:00:00Z',
            children: [
              {
                id: 'nav-2',
                title: 'Science Fiction',
                source_url: 'https://worldofbooks.com/fiction/sci-fi',
                last_scraped_at: '2023-01-01T00:00:00Z',
              },
            ],
          },
          {
            id: 'nav-3',
            title: 'Non-Fiction',
            source_url: 'https://worldofbooks.com/non-fiction',
            last_scraped_at: '2023-01-01T00:00:00Z',
          },
        ],
        cached: false,
        stale: false,
      });

      const req = new Request('http://localhost/api/navigation');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(2);
      expect(data.data[0].title).toBe('Fiction');
      expect(data.data[0].children).toHaveLength(1);
      expect(data.data[0].children[0].title).toBe('Science Fiction');
    });

    it('should handle empty navigation data', async () => {
      const { NotFoundError } = await import('@/middleware/error-handler');
      mockGetWithSWR.mockRejectedValue(
        new NotFoundError('No navigation data found')
      );

      const req = new Request('http://localhost/api/navigation');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Not Found');
    });

    it('should handle database errors', async () => {
      mockGetWithSWR.mockRejectedValue(
        new Error('Database connection failed')
      );

      const req = new Request('http://localhost/api/navigation');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal Server Error');
    });

    it('should return cached data when available', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: [
          {
            id: 'nav-1',
            title: 'Fiction',
            source_url: 'https://worldofbooks.com/fiction',
            last_scraped_at: '2023-01-01T00:00:00Z',
          },
        ],
        cached: true,
        stale: false,
      });

      const req = new Request('http://localhost/api/navigation');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
    });

    it('should handle stale cached data', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: [
          {
            id: 'nav-1',
            title: 'Fiction',
            source_url: 'https://worldofbooks.com/fiction',
            last_scraped_at: '2023-01-01T00:00:00Z',
          },
        ],
        cached: true,
        stale: true,
      });

      const req = new Request('http://localhost/api/navigation');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
    });
  });
});