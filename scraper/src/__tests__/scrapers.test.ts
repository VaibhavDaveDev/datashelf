import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NavigationScraper, CategoryScraper, ProductScraper, createScraper } from '../services/scrapers';
import { ScraperCrawler } from '../services/crawler';
import { config } from '../config/environment';

// Mock the crawler
vi.mock('../services/crawler');
vi.mock('../config/environment', () => ({
  config: {
    WOB_BASE_URL: 'https://www.worldofbooks.com',
    WOB_RATE_LIMIT_DELAY: 1000
  }
}));

// Mock the extractors
vi.mock('../utils/extractors', () => ({
  extractNavigation: vi.fn(),
  extractCategories: vi.fn(),
  extractProductListings: vi.fn(),
  extractProductDetails: vi.fn(),
  hasNextPage: vi.fn(),
  goToNextPage: vi.fn(),
  resolveUrl: vi.fn((base, relative) => `${base}${relative}`)
}));

const mockCrawler = {
  setRequestHandler: vi.fn(),
  addRequest: vi.fn(),
  run: vi.fn(),
  shutdown: vi.fn(),
  getStats: vi.fn()
};

describe('Scrapers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ScraperCrawler as any).mockImplementation(() => mockCrawler);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('NavigationScraper', () => {
    it('should scrape navigation successfully', async () => {
      const mockNavigationData = [
        { title: 'Fiction', source_url: 'https://www.worldofbooks.com/fiction', parent_id: undefined },
        { title: 'Non-Fiction', source_url: 'https://www.worldofbooks.com/non-fiction', parent_id: undefined }
      ];

      const { extractNavigation } = await import('../utils/extractors');
      (extractNavigation as any).mockResolvedValue(mockNavigationData);

      // Mock the request handler to simulate successful scraping
      let requestHandler: any;
      mockCrawler.setRequestHandler.mockImplementation((handler) => {
        requestHandler = handler;
      });

      // Mock the run method to execute the handler
      mockCrawler.run.mockImplementation(async () => {
        if (requestHandler) {
          const mockPage = {
            waitForLoadState: vi.fn().mockResolvedValue(undefined)
          };
          const mockRequest = {
            url: 'https://www.worldofbooks.com',
            retryCount: 0
          };
          
          await requestHandler({ page: mockPage, request: mockRequest });
        }
      });

      const scraper = new NavigationScraper();
      const result = await scraper.scrapeNavigation('test-job-1');

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Fiction');
      expect(result[1].title).toBe('Non-Fiction');
      expect(mockCrawler.addRequest).toHaveBeenCalledWith(
        'https://www.worldofbooks.com',
        { jobId: 'test-job-1' }
      );
      expect(mockCrawler.run).toHaveBeenCalled();
      expect(mockCrawler.shutdown).toHaveBeenCalled();
    });

    it('should handle scraping errors', async () => {
      const { extractNavigation } = await import('../utils/extractors');
      (extractNavigation as any).mockRejectedValue(new Error('Extraction failed'));

      let requestHandler: any;
      mockCrawler.setRequestHandler.mockImplementation((handler) => {
        requestHandler = handler;
      });

      // Mock the run method to execute the handler and throw error
      mockCrawler.run.mockImplementation(async () => {
        if (requestHandler) {
          const mockPage = {
            waitForLoadState: vi.fn().mockResolvedValue(undefined)
          };
          const mockRequest = {
            url: 'https://www.worldofbooks.com',
            retryCount: 0
          };
          
          await requestHandler({ page: mockPage, request: mockRequest });
        }
      });

      const scraper = new NavigationScraper();
      
      await expect(scraper.scrapeNavigation('test-job-1')).rejects.toThrow();
      expect(mockCrawler.shutdown).toHaveBeenCalled();
    });
  });

  describe('CategoryScraper', () => {
    it('should scrape category and products successfully', async () => {
      const mockCategoryData = [
        { title: 'Science Fiction', source_url: 'https://www.worldofbooks.com/sci-fi', product_count: 0, navigation_id: undefined }
      ];
      
      const mockProductData = [
        { title: 'Dune', url: 'https://www.worldofbooks.com/product/dune', price: 15.99, currency: 'GBP' },
        { title: 'Foundation', url: 'https://www.worldofbooks.com/product/foundation', price: 12.50, currency: 'GBP' }
      ];

      const { extractCategories, extractProductListings, hasNextPage } = await import('../utils/extractors');
      (extractCategories as any).mockResolvedValue(mockCategoryData);
      (extractProductListings as any).mockResolvedValue(mockProductData);
      (hasNextPage as any).mockResolvedValue(false);

      let requestHandler: any;
      mockCrawler.setRequestHandler.mockImplementation((handler) => {
        requestHandler = handler;
      });

      mockCrawler.run.mockImplementation(async () => {
        if (requestHandler) {
          const mockPage = {
            waitForLoadState: vi.fn().mockResolvedValue(undefined),
            evaluate: vi.fn().mockResolvedValue(null),
            title: vi.fn().mockResolvedValue('Science Fiction')
          };
          const mockRequest = {
            url: 'https://www.worldofbooks.com/sci-fi',
            retryCount: 0
          };
          
          await requestHandler({ page: mockPage, request: mockRequest });
        }
      });

      const scraper = new CategoryScraper();
      const result = await scraper.scrapeCategory('https://www.worldofbooks.com/sci-fi', 'test-job-2');

      expect(result.category.title).toBe('Science Fiction');
      expect(result.category.product_count).toBe(2); // Updated with actual scraped count
      expect(result.products).toHaveLength(2);
      expect(result.products[0].title).toBe('Dune');
      expect(mockCrawler.shutdown).toHaveBeenCalled();
    });

    it('should handle pagination', async () => {
      const mockCategoryData = [
        { title: 'Fantasy', source_url: 'https://www.worldofbooks.com/fantasy', product_count: 0, navigation_id: undefined }
      ];
      
      const mockProductData = [
        { title: 'Lord of the Rings', url: 'https://www.worldofbooks.com/product/lotr', price: 20.00, currency: 'GBP' }
      ];

      const { extractCategories, extractProductListings, hasNextPage } = await import('../utils/extractors');
      (extractCategories as any).mockResolvedValue(mockCategoryData);
      (extractProductListings as any).mockResolvedValue(mockProductData);
      (hasNextPage as any).mockResolvedValue(true);

      let requestHandler: any;
      mockCrawler.setRequestHandler.mockImplementation((handler) => {
        requestHandler = handler;
      });

      mockCrawler.run.mockImplementation(async () => {
        if (requestHandler) {
          const mockPage = {
            waitForLoadState: vi.fn().mockResolvedValue(undefined),
            evaluate: vi.fn().mockResolvedValue('https://www.worldofbooks.com/fantasy?page=2'),
            title: vi.fn().mockResolvedValue('Fantasy')
          };
          const mockRequest = {
            url: 'https://www.worldofbooks.com/fantasy',
            retryCount: 0
          };
          
          await requestHandler({ page: mockPage, request: mockRequest });
        }
      });

      const scraper = new CategoryScraper();
      const result = await scraper.scrapeCategory('https://www.worldofbooks.com/fantasy', 'test-job-3');

      expect(result.category.title).toBe('Fantasy');
      expect(result.products).toHaveLength(1);
      expect(mockCrawler.addRequest).toHaveBeenCalledWith(
        'https://www.worldofbooks.com/fantasy',
        { jobId: 'test-job-3' }
      );
      expect(mockCrawler.shutdown).toHaveBeenCalled();
    });
  });

  describe('ProductScraper', () => {
    it('should scrape single product successfully', async () => {
      const mockProductData = {
        title: 'The Hobbit',
        source_id: 'hobbit-123',
        price: 12.99,
        currency: 'GBP',
        image_urls: ['https://images.worldofbooks.com/hobbit.jpg'],
        summary: 'A fantasy adventure novel.',
        specs: { author: 'J.R.R. Tolkien', pages: '366' },
        available: true
      };

      const { extractProductDetails, resolveUrl } = await import('../utils/extractors');
      (extractProductDetails as any).mockResolvedValue(mockProductData);
      (resolveUrl as any).mockImplementation((base: any, url: any) => url.startsWith('http') ? url : `${base}${url}`);

      let requestHandler: any;
      mockCrawler.setRequestHandler.mockImplementation((handler) => {
        requestHandler = handler;
      });

      mockCrawler.run.mockImplementation(async () => {
        if (requestHandler) {
          const mockPage = {
            waitForLoadState: vi.fn().mockResolvedValue(undefined),
            url: () => 'https://www.worldofbooks.com/product/hobbit-123'
          };
          const mockRequest = {
            url: 'https://www.worldofbooks.com/product/hobbit-123',
            retryCount: 0
          };
          
          await requestHandler({ page: mockPage, request: mockRequest });
        }
      });

      const scraper = new ProductScraper();
      const result = await scraper.scrapeProduct('https://www.worldofbooks.com/product/hobbit-123', 'test-job-4');

      expect(result.title).toBe('The Hobbit');
      expect(result.price).toBe(12.99);
      expect(result.currency).toBe('GBP');
      expect(result.available).toBe(true);
      expect(result.specs).toEqual({ author: 'J.R.R. Tolkien', pages: '366' });
      expect(mockCrawler.shutdown).toHaveBeenCalled();
    });

    it('should scrape multiple products in batch', async () => {
      const mockProductData1 = {
        title: 'Book 1',
        price: 10.00,
        currency: 'GBP',
        image_urls: [],
        specs: {},
        available: true
      };

      const mockProductData2 = {
        title: 'Book 2',
        price: 15.00,
        currency: 'GBP',
        image_urls: [],
        specs: {},
        available: true
      };

      const { extractProductDetails, resolveUrl } = await import('../utils/extractors');
      (extractProductDetails as any)
        .mockResolvedValueOnce(mockProductData1)
        .mockResolvedValueOnce(mockProductData2);
      (resolveUrl as any).mockImplementation((base: any, url: any) => url.startsWith('http') ? url : `${base}${url}`);

      let requestHandler: any;
      let callCount = 0;
      mockCrawler.setRequestHandler.mockImplementation((handler) => {
        requestHandler = handler;
      });

      mockCrawler.run.mockImplementation(async () => {
        if (requestHandler) {
          const urls = [
            'https://www.worldofbooks.com/product/book1',
            'https://www.worldofbooks.com/product/book2'
          ];
          
          // Simulate processing both URLs
          for (const url of urls) {
            const mockPage = {
              waitForLoadState: vi.fn().mockResolvedValue(undefined),
              url: () => url
            };
            const mockRequest = {
              url: url,
              retryCount: 0
            };
            
            await requestHandler({ page: mockPage, request: mockRequest });
          }
        }
      });

      const scraper = new ProductScraper();
      const productUrls = [
        'https://www.worldofbooks.com/product/book1',
        'https://www.worldofbooks.com/product/book2'
      ];
      
      const result = await scraper.scrapeProducts(productUrls, 'test-job-5');

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Book 1');
      expect(result[1].title).toBe('Book 2');
      expect(mockCrawler.shutdown).toHaveBeenCalled();
    });

    it('should handle missing product title gracefully in batch mode', async () => {
      const { extractProductDetails } = await import('../utils/extractors');
      (extractProductDetails as any).mockResolvedValue({ title: '' }); // Missing title

      mockCrawler.setRequestHandler.mockImplementation((handler) => {
        const mockPage = {
          waitForLoadState: vi.fn().mockResolvedValue(undefined),
          url: () => 'https://www.worldofbooks.com/product/invalid'
        };
        const mockRequest = {
          url: 'https://www.worldofbooks.com/product/invalid',
          retryCount: 0
        };
        
        handler({ page: mockPage, request: mockRequest });
      });

      const scraper = new ProductScraper();
      const result = await scraper.scrapeProducts(['https://www.worldofbooks.com/product/invalid'], 'test-job-6');

      expect(result).toHaveLength(0); // Should skip products without titles
      expect(mockCrawler.shutdown).toHaveBeenCalled();
    });
  });

  describe('createScraper', () => {
    it('should create NavigationScraper for navigation type', () => {
      const scraper = createScraper('navigation');
      expect(scraper).toBeInstanceOf(NavigationScraper);
    });

    it('should create CategoryScraper for category type', () => {
      const scraper = createScraper('category');
      expect(scraper).toBeInstanceOf(CategoryScraper);
    });

    it('should create ProductScraper for product type', () => {
      const scraper = createScraper('product');
      expect(scraper).toBeInstanceOf(ProductScraper);
    });

    it('should throw error for unknown scraper type', () => {
      expect(() => createScraper('unknown' as any)).toThrow('Unknown scraper type: unknown');
    });
  });
});