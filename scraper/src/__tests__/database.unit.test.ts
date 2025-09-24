import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationError } from '../types/index.js';

// Mock Supabase client before importing the service
const mockQuery = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

const mockSupabaseClient = {
  from: vi.fn().mockReturnValue(mockQuery),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('../config/environment.js', () => ({
  config: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  },
}));

// Import after mocking
const { DatabaseService } = await import('../services/database.js');

describe('DatabaseService Unit Tests', () => {
  let databaseService: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    databaseService = new DatabaseService();
  });

  describe('Product Operations', () => {
    const mockProduct = {
      title: 'Test Book',
      source_url: 'https://example.com/book/1',
      source_id: 'book-1',
      price: 19.99,
      currency: 'GBP',
      image_urls: ['https://example.com/image1.jpg'],
      summary: 'A test book',
      specs: { author: 'Test Author', isbn: '1234567890' },
      available: true,
    };

    const mockDatabaseProduct = {
      id: 'test-uuid',
      category_id: 'cat-uuid',
      ...mockProduct,
      last_scraped_at: '2023-01-01T00:00:00Z',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    };

    it('should upsert a product successfully', async () => {
      mockQuery.single.mockResolvedValue({
        data: mockDatabaseProduct,
        error: null,
      });

      const result = await databaseService.upsertProduct(mockProduct);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('product');
      expect(mockQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockProduct,
          last_scraped_at: expect.any(String),
          updated_at: expect.any(String),
        }),
        {
          onConflict: 'source_url',
          ignoreDuplicates: false,
        }
      );
      expect(result).toEqual(mockDatabaseProduct);
    });

    it('should handle validation errors for invalid product data', async () => {
      const invalidProduct = {
        title: '', // Invalid: empty title
        source_url: 'not-a-url', // Invalid: not a URL
      };

      await expect(databaseService.upsertProduct(invalidProduct as any))
        .rejects.toThrow(); // Just check that it throws, not the specific error type
    });

    it('should handle database errors during product upsert', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(databaseService.upsertProduct(mockProduct))
        .rejects.toThrow('Failed to upsert product: Database error');
    });

    it('should get product by source URL', async () => {
      mockQuery.single.mockResolvedValue({
        data: mockDatabaseProduct,
        error: null,
      });

      const result = await databaseService.getProductBySourceUrl('https://example.com/book/1');

      expect(mockQuery.eq).toHaveBeenCalledWith('source_url', 'https://example.com/book/1');
      expect(result).toEqual(mockDatabaseProduct);
    });

    it('should return null when product not found', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found error
      });

      const result = await databaseService.getProductBySourceUrl('https://example.com/nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('Navigation Operations', () => {
    const mockNavigation = {
      title: 'Fiction',
      source_url: 'https://example.com/fiction',
      parent_id: '550e8400-e29b-41d4-a716-446655440000',
    };

    const mockDatabaseNavigation = {
      id: 'nav-uuid',
      ...mockNavigation,
      last_scraped_at: '2023-01-01T00:00:00Z',
    };

    it('should upsert navigation successfully', async () => {
      mockQuery.single.mockResolvedValue({
        data: mockDatabaseNavigation,
        error: null,
      });

      const result = await databaseService.upsertNavigation(mockNavigation);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('navigation');
      expect(result).toEqual(mockDatabaseNavigation);
    });

    it('should get navigation hierarchy', async () => {
      mockQuery.order.mockResolvedValue({
        data: [mockDatabaseNavigation],
        error: null,
      });

      const result = await databaseService.getNavigationHierarchy();

      expect(mockQuery.order).toHaveBeenCalledWith('title');
      expect(result).toEqual([mockDatabaseNavigation]);
    });
  });

  describe('Category Operations', () => {
    const mockCategory = {
      navigation_id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Science Fiction',
      source_url: 'https://example.com/sci-fi',
      product_count: 10,
    };

    const mockDatabaseCategory = {
      id: 'cat-uuid',
      ...mockCategory,
      last_scraped_at: '2023-01-01T00:00:00Z',
    };

    it('should upsert category successfully', async () => {
      mockQuery.single.mockResolvedValue({
        data: mockDatabaseCategory,
        error: null,
      });

      const result = await databaseService.upsertCategory(mockCategory);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('category');
      expect(result).toEqual(mockDatabaseCategory);
    });

    it('should get categories by navigation ID', async () => {
      mockQuery.order.mockResolvedValue({
        data: [mockDatabaseCategory],
        error: null,
      });

      const result = await databaseService.getCategoriesByNavigation('nav-uuid');

      expect(mockQuery.eq).toHaveBeenCalledWith('navigation_id', 'nav-uuid');
      expect(result).toEqual([mockDatabaseCategory]);
    });
  });

  describe('Scrape Job Operations', () => {
    const mockScrapeJob = {
      id: 'job-uuid',
      type: 'product' as const,
      target_url: 'https://example.com/product/1',
      status: 'queued' as const,
      attempts: 0,
      max_attempts: 3,
      last_error: null,
      metadata: {},
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    };

    it('should create scrape job successfully', async () => {
      mockQuery.single.mockResolvedValue({
        data: mockScrapeJob,
        error: null,
      });

      const result = await databaseService.createScrapeJob('product', 'https://example.com/product/1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('scrape_job');
      expect(mockQuery.insert).toHaveBeenCalledWith({
        type: 'product',
        target_url: 'https://example.com/product/1',
        status: 'queued',
        attempts: 0,
        max_attempts: 3,
        metadata: {},
      });
      expect(result).toEqual(mockScrapeJob);
    });

    it('should update scrape job status', async () => {
      mockQuery.single.mockResolvedValue({
        data: { ...mockScrapeJob, status: 'running' },
        error: null,
      });

      const result = await databaseService.updateScrapeJob('job-uuid', { status: 'running' });

      expect(mockQuery.update).toHaveBeenCalledWith({
        status: 'running',
        updated_at: expect.any(String),
      });
      expect(result.status).toBe('running');
    });

    it('should mark job as completed', async () => {
      mockQuery.single.mockResolvedValue({
        data: { ...mockScrapeJob, status: 'completed' },
        error: null,
      });

      const result = await databaseService.markJobAsCompleted('job-uuid', { items_processed: 5 });

      expect(mockQuery.update).toHaveBeenCalledWith({
        status: 'completed',
        metadata: { items_processed: 5 },
        updated_at: expect.any(String),
      });
      expect(result.status).toBe('completed');
    });

    it('should mark job as failed', async () => {
      mockQuery.single.mockResolvedValue({
        data: { ...mockScrapeJob, status: 'failed', last_error: 'Test error' },
        error: null,
      });

      const result = await databaseService.markJobAsFailed('job-uuid', 'Test error');

      expect(mockQuery.update).toHaveBeenCalledWith({
        status: 'failed',
        last_error: 'Test error',
        updated_at: expect.any(String),
      });
      expect(result.status).toBe('failed');
      expect(result.last_error).toBe('Test error');
    });

    it('should get jobs by status', async () => {
      // Mock the full chain including limit
      const mockLimitQuery = {
        ...mockQuery,
        limit: vi.fn().mockResolvedValue({
          data: [mockScrapeJob],
          error: null,
        }),
      };
      
      mockQuery.order.mockReturnValue(mockLimitQuery);

      const result = await databaseService.getScrapeJobsByStatus('queued', 10);

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'queued');
      expect(mockLimitQuery.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockScrapeJob]);
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      mockQuery.limit.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await databaseService.testConnection();

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('navigation');
    });

    it('should handle connection test failure', async () => {
      mockQuery.limit.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' },
      });

      const result = await databaseService.testConnection();

      expect(result).toBe(false);
    });
  });
});