import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Page } from 'playwright';
import {
  cleanText,
  extractPrice,
  resolveUrl,
  extractNavigation,
  extractCategories,
  extractProductListings,
  extractProductDetails,
  hasNextPage,
  goToNextPage
} from '../utils/extractors';

// Mock page object
const createMockPage = (evaluateResult: any, url = 'https://www.worldofbooks.com/test') => {
  return {
    evaluate: vi.fn().mockResolvedValue(evaluateResult),
    url: () => url,
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    title: vi.fn().mockResolvedValue('Test Page')
  } as unknown as Page;
};

describe('Data Extraction Utilities', () => {
  describe('cleanText', () => {
    it('should clean and normalize text content', () => {
      expect(cleanText('  Hello   World  \n\t  ')).toBe('Hello World');
      expect(cleanText('\n\nMultiple\n\nLines\n\n')).toBe('Multiple Lines');
      expect(cleanText('')).toBe('');
      expect(cleanText(null)).toBe('');
      expect(cleanText(undefined)).toBe('');
    });
  });

  describe('extractPrice', () => {
    it('should extract GBP prices correctly', () => {
      expect(extractPrice('£12.99')).toEqual({ price: 12.99, currency: 'GBP' });
      expect(extractPrice('Price: £25.50')).toEqual({ price: 25.50, currency: 'GBP' });
      expect(extractPrice('£5')).toEqual({ price: 5, currency: 'GBP' });
    });

    it('should extract USD prices correctly', () => {
      expect(extractPrice('$15.99')).toEqual({ price: 15.99, currency: 'USD' });
      expect(extractPrice('Price: $30.00')).toEqual({ price: 30.00, currency: 'USD' });
    });

    it('should extract EUR prices correctly', () => {
      expect(extractPrice('€20.50')).toEqual({ price: 20.50, currency: 'EUR' });
    });

    it('should handle invalid or missing prices', () => {
      expect(extractPrice('')).toEqual({});
      expect(extractPrice('No price')).toEqual({});
      expect(extractPrice('Free')).toEqual({});
    });
  });

  describe('resolveUrl', () => {
    const baseUrl = 'https://www.worldofbooks.com';

    it('should resolve relative URLs correctly', () => {
      expect(resolveUrl(baseUrl, '/category/books')).toBe('https://www.worldofbooks.com/category/books');
      expect(resolveUrl(baseUrl, 'product/123')).toBe('https://www.worldofbooks.com/product/123');
    });

    it('should return absolute URLs unchanged', () => {
      const absoluteUrl = 'https://example.com/image.jpg';
      expect(resolveUrl(baseUrl, absoluteUrl)).toBe(absoluteUrl);
    });

    it('should handle empty or invalid URLs', () => {
      expect(resolveUrl(baseUrl, '')).toBe('');
      expect(resolveUrl(baseUrl, 'invalid-url')).toBe('https://www.worldofbooks.com/invalid-url');
    });
  });

  describe('extractNavigation', () => {
    it('should extract navigation items from page', async () => {
      const mockNavigationData = [
        { title: 'Fiction', url: 'https://www.worldofbooks.com/fiction' },
        { title: 'Non-Fiction', url: 'https://www.worldofbooks.com/non-fiction' },
        { title: 'Children\'s Books', url: 'https://www.worldofbooks.com/childrens' }
      ];

      const mockPage = createMockPage(mockNavigationData);
      const result = await extractNavigation(mockPage);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        title: 'Fiction',
        source_url: 'https://www.worldofbooks.com/fiction',
        parent_id: undefined
      });
      expect(result[1]).toEqual({
        title: 'Non-Fiction',
        source_url: 'https://www.worldofbooks.com/non-fiction',
        parent_id: undefined
      });
    });

    it('should handle empty navigation', async () => {
      const mockPage = createMockPage([]);
      const result = await extractNavigation(mockPage);
      expect(result).toHaveLength(0);
    });

    it('should handle page evaluation errors', async () => {
      const mockPage = {
        evaluate: vi.fn().mockRejectedValue(new Error('Page error'))
      } as unknown as Page;

      const result = await extractNavigation(mockPage);
      expect(result).toHaveLength(0);
    });
  });

  describe('extractCategories', () => {
    it('should extract category information', async () => {
      const mockCategoryData = [
        { title: 'Science Fiction', url: 'https://www.worldofbooks.com/sci-fi', productCount: 150 },
        { title: 'Fantasy', url: 'https://www.worldofbooks.com/fantasy', productCount: 200 }
      ];

      const mockPage = createMockPage(mockCategoryData);
      const result = await extractCategories(mockPage);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        title: 'Science Fiction',
        source_url: 'https://www.worldofbooks.com/sci-fi',
        product_count: 150,
        navigation_id: undefined
      });
    });

    it('should handle categories without product counts', async () => {
      const mockCategoryData = [
        { title: 'Mystery', url: 'https://www.worldofbooks.com/mystery', productCount: 0 }
      ];

      const mockPage = createMockPage(mockCategoryData);
      const result = await extractCategories(mockPage);

      expect(result).toHaveLength(1);
      expect(result[0].product_count).toBe(0);
    });
  });

  describe('extractProductListings', () => {
    it('should extract product listings with prices', async () => {
      const mockProductData = [
        { 
          title: 'The Great Gatsby', 
          url: 'https://www.worldofbooks.com/product/gatsby',
          priceText: '£8.99',
          thumbnail: 'https://images.worldofbooks.com/gatsby.jpg'
        },
        { 
          title: '1984', 
          url: 'https://www.worldofbooks.com/product/1984',
          priceText: '£7.50',
          thumbnail: 'https://images.worldofbooks.com/1984.jpg'
        }
      ];

      const mockPage = createMockPage(mockProductData);
      const result = await extractProductListings(mockPage);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        title: 'The Great Gatsby',
        url: 'https://www.worldofbooks.com/product/gatsby',
        price: 8.99,
        currency: 'GBP',
        thumbnail: 'https://images.worldofbooks.com/gatsby.jpg'
      });
    });

    it('should handle products without prices', async () => {
      const mockProductData = [
        { 
          title: 'Free Book', 
          url: 'https://www.worldofbooks.com/product/free',
          priceText: '',
          thumbnail: ''
        }
      ];

      const mockPage = createMockPage(mockProductData);
      const result = await extractProductListings(mockPage);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: 'Free Book',
        url: 'https://www.worldofbooks.com/product/free',
        price: undefined,
        currency: undefined,
        thumbnail: ''
      });
    });
  });

  describe('extractProductDetails', () => {
    it('should extract comprehensive product details', async () => {
      const mockProductData = {
        title: 'The Hobbit',
        priceText: '£12.99',
        images: [
          'https://images.worldofbooks.com/hobbit1.jpg',
          'https://images.worldofbooks.com/hobbit2.jpg'
        ],
        summary: 'A classic fantasy adventure novel by J.R.R. Tolkien.',
        specs: {
          author: 'J.R.R. Tolkien',
          isbn: '978-0547928227',
          publisher: 'Houghton Mifflin Harcourt',
          pages: '366',
          language: 'English',
          format: 'Paperback'
        },
        available: true
      };

      const mockPage = createMockPage(
        mockProductData, 
        'https://www.worldofbooks.com/product/hobbit-123'
      );
      
      const result = await extractProductDetails(mockPage);

      expect(result.title).toBe('The Hobbit');
      expect(result.price).toBe(12.99);
      expect(result.currency).toBe('GBP');
      expect(result.image_urls).toHaveLength(2);
      expect(result.summary).toBe('A classic fantasy adventure novel by J.R.R. Tolkien.');
      expect(result.specs).toEqual(mockProductData.specs);
      expect(result.available).toBe(true);
      expect(result.source_id).toBe('hobbit-123');
    });

    it('should handle missing product information gracefully', async () => {
      const mockProductData = {
        title: '',
        priceText: '',
        images: [],
        summary: '',
        specs: {},
        available: true
      };

      const mockPage = createMockPage(mockProductData);
      const result = await extractProductDetails(mockPage);

      expect(result.title).toBe('');
      expect(result.price).toBeUndefined();
      expect(result.image_urls).toHaveLength(0);
      expect(result.specs).toEqual({});
    });

    it('should handle page evaluation errors', async () => {
      const mockPage = {
        evaluate: vi.fn().mockRejectedValue(new Error('Page error')),
        url: () => 'https://www.worldofbooks.com/product/test'
      } as unknown as Page;

      const result = await extractProductDetails(mockPage);
      expect(result).toEqual({});
    });
  });

  describe('hasNextPage', () => {
    it('should detect when next page is available', async () => {
      const mockPage = createMockPage(true);
      const result = await hasNextPage(mockPage);
      expect(result).toBe(true);
    });

    it('should detect when no next page is available', async () => {
      const mockPage = createMockPage(false);
      const result = await hasNextPage(mockPage);
      expect(result).toBe(false);
    });

    it('should handle page evaluation errors', async () => {
      const mockPage = {
        evaluate: vi.fn().mockRejectedValue(new Error('Page error'))
      } as unknown as Page;

      const result = await hasNextPage(mockPage);
      expect(result).toBe(false);
    });
  });

  describe('goToNextPage', () => {
    it('should navigate to next page successfully', async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(true),
        waitForLoadState: vi.fn().mockResolvedValue(undefined)
      } as unknown as Page;

      const result = await goToNextPage(mockPage);
      expect(result).toBe(true);
      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 10000 });
    });

    it('should return false when no next page button found', async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(false),
        waitForLoadState: vi.fn().mockResolvedValue(undefined)
      } as unknown as Page;

      const result = await goToNextPage(mockPage);
      expect(result).toBe(false);
    });

    it('should handle navigation errors', async () => {
      const mockPage = {
        evaluate: vi.fn().mockRejectedValue(new Error('Navigation error'))
      } as unknown as Page;

      const result = await goToNextPage(mockPage);
      expect(result).toBe(false);
    });
  });
});