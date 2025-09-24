import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { productsRoutes } from '@/handlers/products';
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
        single: vi.fn(() => ({
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
      sort: 'created_at_desc',
      ...query,
    },
  })),
  productsQuerySchema: {},
  calculatePagination: vi.fn((total, limit, offset) => ({
    page: Math.floor(offset / limit) + 1,
    limit,
    total_pages: Math.ceil(total / limit),
  })),
  isValidUUID: vi.fn(() => true), // Default to true, will be overridden in specific tests
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

describe('Products API Endpoints', () => {
  let app: Hono;
  let mockEnv: Env;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/products', productsRoutes);
    
    mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SCRAPER_API_KEY: 'test-scraper-key',
      SCRAPER_SERVICE_URL: 'https://scraper.test.com',
    };

    vi.clearAllMocks();
  });

  describe('GET /api/products', () => {
    it('should return products with pagination', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 2,
          items: [
            {
              id: 'prod-1',
              title: 'The Hitchhiker\'s Guide to the Galaxy',
              price: 12.99,
              currency: 'GBP',
              thumbnail: 'https://r2.datashelf.com/images/prod-1-thumb.jpg',
              available: true,
            },
            {
              id: 'prod-2',
              title: 'Dune',
              price: 15.99,
              currency: 'GBP',
              thumbnail: 'https://r2.datashelf.com/images/prod-2-thumb.jpg',
              available: true,
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total_pages: 1,
          },
        },
        cached: false,
        stale: false,
      });

      const req = new Request('http://localhost/api/products');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.total).toBe(2);
      expect(data.data.items).toHaveLength(2);
      expect(data.data.items[0].title).toBe('The Hitchhiker\'s Guide to the Galaxy');
      expect(data.data.pagination.page).toBe(1);
    });

    it('should filter products by category ID', async () => {
      const { validateQuery } = await import('@/utils/validation');
      vi.mocked(validateQuery).mockReturnValue({
        success: true,
        data: {
          categoryId: '123e4567-e89b-12d3-a456-426614174000',
          limit: 20,
          offset: 0,
          sort: 'created_at_desc',
        },
      });

      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 1,
          items: [
            {
              id: 'prod-1',
              title: 'The Hitchhiker\'s Guide to the Galaxy',
              price: 12.99,
              currency: 'GBP',
              thumbnail: 'https://r2.datashelf.com/images/prod-1-thumb.jpg',
              available: true,
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total_pages: 1,
          },
        },
        cached: false,
        stale: false,
      });

      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/products?categoryId=${categoryId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.items).toHaveLength(1);
    });

    it('should handle sorting by price ascending', async () => {
      const { validateQuery } = await import('@/utils/validation');
      vi.mocked(validateQuery).mockReturnValue({
        success: true,
        data: {
          limit: 20,
          offset: 0,
          sort: 'price_asc',
        },
      });

      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 2,
          items: [
            {
              id: 'prod-1',
              title: 'Cheaper Book',
              price: 9.99,
              currency: 'GBP',
              thumbnail: 'https://r2.datashelf.com/images/prod-1-thumb.jpg',
              available: true,
            },
            {
              id: 'prod-2',
              title: 'Expensive Book',
              price: 19.99,
              currency: 'GBP',
              thumbnail: 'https://r2.datashelf.com/images/prod-2-thumb.jpg',
              available: true,
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total_pages: 1,
          },
        },
        cached: false,
        stale: false,
      });

      const req = new Request('http://localhost/api/products?sort=price_asc');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.items[0].price).toBe(9.99);
      expect(data.data.items[1].price).toBe(19.99);
    });

    it('should handle sorting by price descending', async () => {
      const { validateQuery } = await import('@/utils/validation');
      vi.mocked(validateQuery).mockReturnValue({
        success: true,
        data: {
          limit: 20,
          offset: 0,
          sort: 'price_desc',
        },
      });

      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 2,
          items: [
            {
              id: 'prod-2',
              title: 'Expensive Book',
              price: 19.99,
              currency: 'GBP',
              thumbnail: 'https://r2.datashelf.com/images/prod-2-thumb.jpg',
              available: true,
            },
            {
              id: 'prod-1',
              title: 'Cheaper Book',
              price: 9.99,
              currency: 'GBP',
              thumbnail: 'https://r2.datashelf.com/images/prod-1-thumb.jpg',
              available: true,
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total_pages: 1,
          },
        },
        cached: false,
        stale: false,
      });

      const req = new Request('http://localhost/api/products?sort=price_desc');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.items[0].price).toBe(19.99);
      expect(data.data.items[1].price).toBe(9.99);
    });

    it('should handle sorting by title', async () => {
      const { validateQuery } = await import('@/utils/validation');
      vi.mocked(validateQuery).mockReturnValue({
        success: true,
        data: {
          limit: 20,
          offset: 0,
          sort: 'title_asc',
        },
      });

      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 2,
          items: [
            {
              id: 'prod-2',
              title: 'A Book Title',
              price: 12.99,
              currency: 'GBP',
              thumbnail: 'https://r2.datashelf.com/images/prod-2-thumb.jpg',
              available: true,
            },
            {
              id: 'prod-1',
              title: 'Z Book Title',
              price: 15.99,
              currency: 'GBP',
              thumbnail: 'https://r2.datashelf.com/images/prod-1-thumb.jpg',
              available: true,
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total_pages: 1,
          },
        },
        cached: false,
        stale: false,
      });

      const req = new Request('http://localhost/api/products?sort=title_asc');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.items[0].title).toBe('A Book Title');
      expect(data.data.items[1].title).toBe('Z Book Title');
    });

    it('should handle pagination parameters', async () => {
      const { validateQuery } = await import('@/utils/validation');
      vi.mocked(validateQuery).mockReturnValue({
        success: true,
        data: {
          limit: 10,
          offset: 20,
          sort: 'created_at_desc',
        },
      });

      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 100,
          items: [],
          pagination: {
            page: 3,
            limit: 10,
            total_pages: 10,
          },
        },
        cached: false,
        stale: false,
      });

      const req = new Request('http://localhost/api/products?limit=10&offset=20');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(validateQuery).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const { validateQuery } = await import('@/utils/validation');
      vi.mocked(validateQuery).mockReturnValue({
        success: false,
        error: 'Invalid sort parameter',
      });

      const req = new Request('http://localhost/api/products?sort=invalid');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation Error');
    });

    it('should handle invalid category ID format', async () => {
      const { validateQuery, isValidUUID } = await import('@/utils/validation');
      vi.mocked(validateQuery).mockReturnValue({
        success: true,
        data: {
          categoryId: 'invalid-uuid',
          limit: 20,
          offset: 0,
          sort: 'created_at_desc',
        },
      });

      // Mock isValidUUID to return false for invalid UUID
      vi.mocked(isValidUUID).mockReturnValueOnce(false);

      // Mock the error to be thrown
      mockGetWithSWR.mockRejectedValue(
        new (await import('@/middleware/error-handler')).ValidationError('Invalid category ID format')
      );

      const req = new Request('http://localhost/api/products?categoryId=invalid-uuid');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation Error');
    });

    it('should handle empty results', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 0,
          items: [],
          pagination: {
            page: 1,
            limit: 20,
            total_pages: 0,
          },
        },
        cached: false,
        stale: false,
      });

      const req = new Request('http://localhost/api/products');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.total).toBe(0);
      expect(data.data.items).toHaveLength(0);
    });

    it('should handle products without images', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 1,
          items: [
            {
              id: 'prod-1',
              title: 'Book Without Image',
              price: 12.99,
              currency: 'GBP',
              thumbnail: '', // Empty thumbnail when no images
              available: true,
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total_pages: 1,
          },
        },
        cached: false,
        stale: false,
      });

      const req = new Request('http://localhost/api/products');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.items[0].thumbnail).toBe('');
    });

    it('should handle products without price', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 1,
          items: [
            {
              id: 'prod-1',
              title: 'Free Book',
              price: undefined,
              currency: undefined,
              thumbnail: 'https://r2.datashelf.com/images/prod-1-thumb.jpg',
              available: true,
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total_pages: 1,
          },
        },
        cached: false,
        stale: false,
      });

      const req = new Request('http://localhost/api/products');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.items[0].price).toBeUndefined();
      expect(data.data.items[0].currency).toBeUndefined();
    });

    it('should handle database errors', async () => {
      mockGetWithSWR.mockRejectedValue(
        new Error('Database connection failed')
      );

      const req = new Request('http://localhost/api/products');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal Server Error');
    });

    it('should return cached product data', async () => {
      mockGetWithSWR.mockResolvedValue({
        data: {
          total: 1,
          items: [
            {
              id: 'prod-1',
              title: 'Cached Book',
              price: 12.99,
              currency: 'GBP',
              thumbnail: 'https://r2.datashelf.com/images/prod-1-thumb.jpg',
              available: true,
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total_pages: 1,
          },
        },
        cached: true,
        stale: false,
      });

      const req = new Request('http://localhost/api/products');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.items[0].title).toBe('Cached Book');
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return detailed product information', async () => {
      // Mock isValidUUID to return true for valid UUID
      const { isValidUUID } = await import('@/utils/validation');
      vi.mocked(isValidUUID).mockImplementation((value) => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      });

      mockGetWithSWR.mockResolvedValue({
        data: {
          id: 'prod-1',
          title: 'The Hitchhiker\'s Guide to the Galaxy',
          price: 12.99,
          currency: 'GBP',
          image_urls: [
            'https://r2.datashelf.com/images/prod-1-1.jpg',
            'https://r2.datashelf.com/images/prod-1-2.jpg',
          ],
          summary: 'A comedic science fiction series created by Douglas Adams.',
          specs: {
            author: 'Douglas Adams',
            isbn: '978-0345391803',
            publisher: 'Del Rey',
            pages: 224,
            language: 'English',
            format: 'Paperback',
          },
          source_url: 'https://worldofbooks.com/product/123',
          last_scraped_at: '2023-01-01T00:00:00Z',
        },
        cached: false,
        stale: false,
      });

      const productId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/products/${productId}`);
      const res = await app.fetch(req, mockEnv);

      // Debug: log the actual response
      if (res.status !== 200) {
        const errorData = await res.clone().json();
        console.log('Unexpected response:', res.status, errorData);
      }

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.id).toBe('prod-1');
      expect(data.data.title).toBe('The Hitchhiker\'s Guide to the Galaxy');
      expect(data.data.image_urls).toHaveLength(2);
      expect(data.data.specs.author).toBe('Douglas Adams');
      expect(data.data.source_url).toBe('https://worldofbooks.com/product/123');
    });

    it('should validate UUID format', async () => {
      // Mock isValidUUID to return false for invalid UUID
      const { isValidUUID } = await import('@/utils/validation');
      vi.mocked(isValidUUID).mockImplementation((value) => {
        return value !== 'invalid-uuid';
      });

      const req = new Request('http://localhost/api/products/invalid-uuid');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation Error');
      expect(data.message).toContain('Invalid product ID format');
    });

    it('should handle product not found', async () => {
      // Mock isValidUUID to return true for valid UUID
      const { isValidUUID } = await import('@/utils/validation');
      vi.mocked(isValidUUID).mockImplementation((value) => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      });

      const { NotFoundError } = await import('@/middleware/error-handler');
      mockGetWithSWR.mockRejectedValue(
        new NotFoundError('Product with ID 123e4567-e89b-12d3-a456-426614174000 not found')
      );

      const productId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/products/${productId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Not Found');
    });

    it('should handle product without optional fields', async () => {
      const { isValidUUID } = await import('@/utils/validation');
      vi.mocked(isValidUUID).mockReturnValueOnce(true);

      mockGetWithSWR.mockResolvedValue({
        data: {
          id: 'prod-1',
          title: 'Minimal Product',
          price: undefined,
          currency: undefined,
          image_urls: [],
          summary: undefined,
          specs: {},
          source_url: 'https://worldofbooks.com/product/123',
          last_scraped_at: '2023-01-01T00:00:00Z',
        },
        cached: false,
        stale: false,
      });

      const productId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/products/${productId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.price).toBeUndefined();
      expect(data.data.currency).toBeUndefined();
      expect(data.data.summary).toBeUndefined();
      expect(data.data.image_urls).toHaveLength(0);
      expect(data.data.specs).toEqual({});
    });

    it('should handle database errors for specific product', async () => {
      const { isValidUUID } = await import('@/utils/validation');
      vi.mocked(isValidUUID).mockReturnValueOnce(true);

      mockGetWithSWR.mockRejectedValue(
        new Error('Database connection failed')
      );

      const productId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/products/${productId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal Server Error');
    });

    it('should return cached product detail data', async () => {
      const { isValidUUID } = await import('@/utils/validation');
      vi.mocked(isValidUUID).mockReturnValueOnce(true);

      mockGetWithSWR.mockResolvedValue({
        data: {
          id: 'prod-1',
          title: 'Cached Product Detail',
          price: 12.99,
          currency: 'GBP',
          image_urls: ['https://r2.datashelf.com/images/prod-1-1.jpg'],
          summary: 'A cached product.',
          specs: {
            author: 'Test Author',
          },
          source_url: 'https://worldofbooks.com/product/123',
          last_scraped_at: '2023-01-01T00:00:00Z',
        },
        cached: true,
        stale: false,
      });

      const productId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/products/${productId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.title).toBe('Cached Product Detail');
    });

    it('should handle stale cached data', async () => {
      const { isValidUUID } = await import('@/utils/validation');
      vi.mocked(isValidUUID).mockReturnValueOnce(true);

      mockGetWithSWR.mockResolvedValue({
        data: {
          id: 'prod-1',
          title: 'Stale Product Data',
          price: 12.99,
          currency: 'GBP',
          image_urls: ['https://r2.datashelf.com/images/prod-1-1.jpg'],
          summary: 'A stale product.',
          specs: {},
          source_url: 'https://worldofbooks.com/product/123',
          last_scraped_at: '2023-01-01T00:00:00Z',
        },
        cached: true,
        stale: true,
      });

      const productId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/products/${productId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.title).toBe('Stale Product Data');
    });

    it('should handle products with complex specs', async () => {
      const { isValidUUID } = await import('@/utils/validation');
      vi.mocked(isValidUUID).mockReturnValueOnce(true);

      mockGetWithSWR.mockResolvedValue({
        data: {
          id: 'prod-1',
          title: 'Complex Product',
          price: 25.99,
          currency: 'GBP',
          image_urls: ['https://r2.datashelf.com/images/prod-1-1.jpg'],
          summary: 'A product with complex specifications.',
          specs: {
            author: 'Complex Author',
            isbn: '978-0123456789',
            publisher: 'Test Publisher',
            pages: 500,
            language: 'English',
            format: 'Hardcover',
            publication_date: '2023-01-01',
            dimensions: '23.4 x 15.6 x 3.2 cm',
            weight: '680g',
            genre: ['Science Fiction', 'Adventure'],
            series: 'Test Series',
            volume: 1,
          },
          source_url: 'https://worldofbooks.com/product/123',
          last_scraped_at: '2023-01-01T00:00:00Z',
        },
        cached: false,
        stale: false,
      });

      const productId = '123e4567-e89b-12d3-a456-426614174000';
      const req = new Request(`http://localhost/api/products/${productId}`);
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.specs.author).toBe('Complex Author');
      expect(data.data.specs.genre).toEqual(['Science Fiction', 'Adventure']);
      expect(data.data.specs.pages).toBe(500);
    });
  });
});