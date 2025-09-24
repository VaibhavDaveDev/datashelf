import { describe, it, expect, beforeEach, vi } from 'vitest';
import { navigationOps, categoryOps, productOps, DatabaseError } from '../utils/operations.js';

// Mock database client
const mockClient = {
  from: vi.fn(),
  raw: vi.fn()
};

// Mock getDatabase
vi.mock('../utils/connection.js', () => ({
  getDatabase: () => mockClient
}));

describe('Database Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('navigationOps', () => {
    describe('getAll', () => {
      it('should return all navigation items', async () => {
        const mockData = [
          { id: '1', title: 'Books', source_url: 'https://example.com/books', parent_id: null }
        ];

        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockData, error: null })
          })
        });

        const result = await navigationOps.getAll();
        expect(result).toEqual(mockData);
        expect(mockClient.from).toHaveBeenCalledWith('navigation');
      });

      it('should throw DatabaseError on failure', async () => {
        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') })
          })
        });

        await expect(navigationOps.getAll()).rejects.toThrow(DatabaseError);
      });
    });

    describe('getHierarchy', () => {
      it('should build hierarchical structure', async () => {
        const mockData = [
          { id: '1', title: 'Books', source_url: 'https://example.com/books', parent_id: null },
          { id: '2', title: 'Fiction', source_url: 'https://example.com/fiction', parent_id: '1' }
        ];

        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockData, error: null })
          })
        });

        const result = await navigationOps.getHierarchy();
        
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
        expect(result[0].children).toHaveLength(1);
        expect(result[0].children![0].id).toBe('2');
      });
    });

    describe('upsert', () => {
      it('should upsert navigation item', async () => {
        const mockItem = { title: 'New Category', source_url: 'https://example.com/new' };
        const mockResult = { id: '3', ...mockItem, parent_id: null };

        mockClient.from.mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockResult, error: null })
            })
          })
        });

        const result = await navigationOps.upsert(mockItem);
        expect(result).toEqual(mockResult);
      });
    });
  });

  describe('productOps', () => {
    describe('getByCategory', () => {
      it('should return paginated products', async () => {
        const mockProducts = [
          { id: '1', title: 'Book 1', price: 9.99, category_id: 'cat1' }
        ];

        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({ 
                data: mockProducts, 
                error: null, 
                count: 1 
              })
            })
          })
        });

        const result = await productOps.getByCategory('cat1');
        
        expect(result.data).toEqual(mockProducts);
        expect(result.total).toBe(1);
      });

      it('should handle sorting and filtering options', async () => {
        const mockChain = {
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({ 
              data: [], 
              error: null, 
              count: 0 
            })
          })
        };

        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue(mockChain)
        });

        await productOps.getByCategory('cat1', {
          limit: 10,
          offset: 20,
          sortBy: 'price',
          sortOrder: 'desc',
          availableOnly: false
        });

        expect(mockChain.eq).toHaveBeenCalledWith('category_id', 'cat1');
        expect(mockChain.order).toHaveBeenCalledWith('price', { ascending: false });
      });
    });

    describe('getById', () => {
      it('should return product by ID', async () => {
        const mockProduct = { id: '1', title: 'Book 1', price: 9.99 };

        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProduct, error: null })
            })
          })
        });

        const result = await productOps.getById('1');
        expect(result).toEqual(mockProduct);
      });

      it('should return null for not found', async () => {
        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ 
                data: null, 
                error: { code: 'PGRST116' } 
              })
            })
          })
        });

        const result = await productOps.getById('nonexistent');
        expect(result).toBeNull();
      });
    });

    describe('search', () => {
      it('should search products by title', async () => {
        const mockProducts = [
          { id: '1', title: 'Harry Potter', price: 9.99 }
        ];

        mockClient.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ 
                    data: mockProducts, 
                    error: null, 
                    count: 1 
                  })
                })
              })
            })
          })
        });

        const result = await productOps.search('Harry');
        
        expect(result.data).toEqual(mockProducts);
        expect(result.total).toBe(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should wrap errors in DatabaseError', async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockRejectedValue(new Error('Connection failed'))
        })
      });

      try {
        await navigationOps.getAll();
        expect.fail('Should have thrown DatabaseError');
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        expect((error as DatabaseError).operation).toBe('Get navigation');
        expect((error as DatabaseError).message).toContain('Get navigation failed');
      }
    });
  });
});