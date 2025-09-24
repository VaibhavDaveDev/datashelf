import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { categoriesRoutes } from '@/handlers/categories';
import type { Env } from '@/types/env';

// Mock dependencies
vi.mock('@/services/supabase', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(() => ({
              then: vi.fn(),
            })),
          })),
        })),
        order: vi.fn(() => ({
          range: vi.fn(() => ({
            then: vi.fn(),
          })),
        })),
        range: vi.fn(() => ({
          then: vi.fn(),
        })),
      })),
    })),
  })),
}));

// Create mock functions
const mockGetWithSWR = vi.fn();
const mockAddToIndex = vi.fn();

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
  generateCacheKey: vi.fn((prefix, params) => 
    `https://cache.datashelf.internal/${prefix}${params ? ':' + JSON.stringify(params) : ''}`
  ),
}));

vi.mock('@/utils/response', () => ({
  swrResponse: vi.fn((c, data) => c.json({ data })),
  errorResponse: vi.fn((c, error, message, status) => 
    c.json({ error, message, code: status }, status)
  ),
}));

vi.mock('@/utils/validation', () => ({
  validateQuery: vi.fn((schema, query) => ({
    success: true,
    data: {
      limit: 20,
      offset: 0,
      ...query,
    },
  })),
  categoriesQuerySchema: {},
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

describe('Categories API Endpoints', () => {
  let app: Hono;
  let mockEnv: Env;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/categories', categoriesRoutes);
    
    mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SCRAPER_API_KEY: 'test-scraper-key',
      SCRAPER_SERVICE_URL: 'https://scraper.test.com',
    };

    vi.clearAllMocks();
  });

  describe('GET /api/categories', () => {
    it('should return categories with pagination', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 2,
          items: [
            {
              id: 'cat-1',
              title: 'Science Fiction',
              product_count: 150,
              last_scraped_at: '2023-01-01T00:00:00Z',
            },
            {
              id: 'cat-2',
              title: 'Fantasy',
              product_count: 200,
              last_scraped_at: '2023-01-01T00:00:00Z',
            },
          ],
        },
        cached: false,
        stale: false,
      });

      const req = new Request('http://localhost/api/categories');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.total).toBe(2);
      expect(data.data.items).toHaveLength(2);
      expect(data.data.items[0].title).toBe('Science Fiction');
    });

    it('should filter categories by navigation ID', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 1,
          items: [
            {
              id: 'cat-1',
              title: 'Science Fiction',
              product_count: 150,
              last_scraped_at: '2023-01-01T00:00:00Z',
            },
          ],
        },
        cached: false,
        stale: false,
      });

      const navId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/categories?navId=${navId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.items).toHaveLength(1);
    });

    it('should filter categories by parent ID', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 1,
          items: [
            {
              id: 'cat-1',
              title: 'Science Fiction',
              product_count: 150,
              last_scraped_at: '2023-01-01T00:00:00Z',
            },
          ],
        },
        cached: false,
        stale: false,
      });

      const parentId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/categories?parentId=${parentId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.items).toHaveLength(1);
    });

    it('should handle pagination parameters', async () => {
      const { validateQuery } = await import('@/utils/validation');
      vi.mocked(validateQuery).mockReturnValue({
        success: true,
        data: {
          limit: 10,
          offset: 20,
        },
      });

      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 100,
          items: [],
        },
        cached: false,
        stale: false,
      });

      const req = new Request('http://localhost/api/categories?limit=10&offset=20');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(validateQuery).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const { validateQuery } = await import('@/utils/validation');
      vi.mocked(validateQuery).mockReturnValue({
        success: false,
        error: 'Invalid limit parameter',
      });

      const req = new Request('http://localhost/api/categories?limit=invalid');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation Error');
    });

    it('should handle empty results', async () => {
      const { validateQuery } = await import('@/utils/validation');
      vi.mocked(validateQuery).mockReturnValue({
        success: true,
        data: {
          limit: 20,
          offset: 0,
        },
      });

      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 0,
          items: [],
        },
        cached: false,
        stale: false,
      });

      const req = new Request('http://localhost/api/categories');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.total).toBe(0);
      expect(data.data.items).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const { validateQuery } = await import('@/utils/validation');
      vi.mocked(validateQuery).mockReturnValue({
        success: true,
        data: {
          limit: 20,
          offset: 0,
        },
      });

      mockGetWithSWR.mockRejectedValue(
        new Error('Database connection failed')
      );

      const req = new Request('http://localhost/api/categories');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal Server Error');
    });
  });

  describe('GET /api/categories/:id', () => {
    it('should return a specific category by ID', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: {
          id: 'cat-1',
          title: 'Science Fiction',
          product_count: 150,
          last_scraped_at: '2023-01-01T00:00:00Z',
        },
        cached: false,
        stale: false,
      });

      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/categories/${categoryId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.id).toBe('cat-1');
      expect(data.data.title).toBe('Science Fiction');
    });

    it('should validate UUID format', async () => {
      const req = new Request('http://localhost/api/categories/invalid-uuid');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation Error');
      expect(data.message).toContain('Invalid category ID format');
    });

    it('should handle category not found', async () => {
      const { NotFoundError } = await import('@/middleware/error-handler');
      mockGetWithSWR.mockRejectedValue(
        new NotFoundError('Category with ID 123e4567-e89b-12d3-a456-426614174000 not found')
      );

      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/categories/${categoryId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Not Found');
    });

    it('should handle database errors for specific category', async () => {
      mockGetWithSWR.mockRejectedValue(
        new Error('Database connection failed')
      );

      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/categories/${categoryId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal Server Error');
    });

    it('should return cached category data', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: {
          id: 'cat-1',
          title: 'Science Fiction',
          product_count: 150,
          last_scraped_at: '2023-01-01T00:00:00Z',
        },
        cached: true,
        stale: false,
      });

      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/categories/${categoryId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.id).toBe('cat-1');
    });
  });
});