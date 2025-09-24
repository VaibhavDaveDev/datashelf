import { describe, it, expect } from 'vitest';
import {
  isUrlAllowed,
  getCrawlDelay,
  isValidCollectionUrl,
  isValidProductUrl,
  normalizeWobUrl,
  validateScrapingConfig
} from '../utils/robots-compliance';

describe('Robots.txt Compliance', () => {
  describe('isUrlAllowed', () => {
    it('should allow valid collection URLs', () => {
      expect(isUrlAllowed('https://www.worldofbooks.com/en-gb/collections/fiction-books')).toBe(true);
      expect(isUrlAllowed('https://www.worldofbooks.com/collections/non-fiction')).toBe(true);
    });

    it('should allow valid product URLs', () => {
      expect(isUrlAllowed('https://www.worldofbooks.com/en-gb/products/the-hobbit')).toBe(true);
      expect(isUrlAllowed('https://www.worldofbooks.com/products/book-123')).toBe(true);
    });

    it('should block disallowed admin URLs', () => {
      expect(isUrlAllowed('https://www.worldofbooks.com/admin')).toBe(false);
      expect(isUrlAllowed('https://www.worldofbooks.com/cart')).toBe(false);
      expect(isUrlAllowed('https://www.worldofbooks.com/checkout')).toBe(false);
      expect(isUrlAllowed('https://www.worldofbooks.com/account')).toBe(false);
    });

    it('should block filtered collection URLs', () => {
      expect(isUrlAllowed('https://www.worldofbooks.com/collections/fiction?sort_by=price')).toBe(false);
      expect(isUrlAllowed('https://www.worldofbooks.com/collections/fiction+mystery')).toBe(false);
      expect(isUrlAllowed('https://www.worldofbooks.com/collections/fiction?filter=author')).toBe(false);
    });

    it('should block cart API endpoints', () => {
      expect(isUrlAllowed('https://www.worldofbooks.com/cart/add.js')).toBe(false);
      expect(isUrlAllowed('https://www.worldofbooks.com/cart/update.js')).toBe(false);
      expect(isUrlAllowed('https://www.worldofbooks.com/cart.js')).toBe(false);
    });

    it('should allow static assets', () => {
      expect(isUrlAllowed('https://www.worldofbooks.com/cdn/shop/files/image.jpg')).toBe(true);
      expect(isUrlAllowed('https://www.worldofbooks.com/assets/style.css')).toBe(true);
      expect(isUrlAllowed('https://www.worldofbooks.com/images/logo.png')).toBe(true);
    });
  });

  describe('getCrawlDelay', () => {
    it('should return correct delays for specific bots', () => {
      expect(getCrawlDelay('AhrefsBot')).toBe(10000);
      expect(getCrawlDelay('AhrefsSiteAudit')).toBe(10000);
      expect(getCrawlDelay('MJ12bot')).toBe(10000);
      expect(getCrawlDelay('Pinterest')).toBe(1000);
    });

    it('should return default delay for other bots', () => {
      expect(getCrawlDelay('DataShelf-Bot')).toBe(2000);
      expect(getCrawlDelay('CustomBot')).toBe(2000);
    });
  });

  describe('isValidCollectionUrl', () => {
    it('should validate collection URLs', () => {
      expect(isValidCollectionUrl('https://www.worldofbooks.com/collections/fiction')).toBe(true);
      expect(isValidCollectionUrl('https://www.worldofbooks.com/en-gb/collections/fiction-books')).toBe(true);
    });

    it('should reject non-collection URLs', () => {
      expect(isValidCollectionUrl('https://www.worldofbooks.com/products/book-123')).toBe(false);
      expect(isValidCollectionUrl('https://www.worldofbooks.com/pages/about')).toBe(false);
    });

    it('should reject filtered collection URLs', () => {
      expect(isValidCollectionUrl('https://www.worldofbooks.com/collections/fiction?sort_by=price')).toBe(false);
      expect(isValidCollectionUrl('https://www.worldofbooks.com/collections/fiction?filter=author')).toBe(false);
    });
  });

  describe('isValidProductUrl', () => {
    it('should validate product URLs', () => {
      expect(isValidProductUrl('https://www.worldofbooks.com/products/the-hobbit')).toBe(true);
      expect(isValidProductUrl('https://www.worldofbooks.com/en-gb/products/book-123')).toBe(true);
    });

    it('should reject non-product URLs', () => {
      expect(isValidProductUrl('https://www.worldofbooks.com/collections/fiction')).toBe(false);
      expect(isValidProductUrl('https://www.worldofbooks.com/pages/about')).toBe(false);
    });
  });

  describe('normalizeWobUrl', () => {
    it('should remove tracking parameters', () => {
      const url = 'https://www.worldofbooks.com/products/book?oseid=123&preview_theme_id=456';
      const normalized = normalizeWobUrl(url);
      expect(normalized).toBe('https://www.worldofbooks.com/products/book');
    });

    it('should preserve valid parameters', () => {
      const url = 'https://www.worldofbooks.com/collections/fiction?page=2';
      const normalized = normalizeWobUrl(url);
      expect(normalized).toBe('https://www.worldofbooks.com/collections/fiction?page=2');
    });

    it('should handle relative URLs', () => {
      const relativeUrl = '/products/book-123';
      const normalized = normalizeWobUrl(relativeUrl);
      expect(normalized).toBe('https://www.worldofbooks.com/products/book-123');
    });
  });

  describe('validateScrapingConfig', () => {
    it('should validate good configuration', () => {
      const config = {
        userAgent: 'DataShelf-Bot/1.0',
        crawlDelay: 2000,
        maxConcurrency: 2
      };
      
      const result = validateScrapingConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about low crawl delay', () => {
      const config = {
        userAgent: 'DataShelf-Bot/1.0',
        crawlDelay: 500,
        maxConcurrency: 2
      };
      
      const result = validateScrapingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.warnings.some(w => w.includes('Crawl delay'))).toBe(true);
    });

    it('should warn about high concurrency', () => {
      const config = {
        userAgent: 'DataShelf-Bot/1.0',
        crawlDelay: 2000,
        maxConcurrency: 5
      };
      
      const result = validateScrapingConfig(config);
      expect(result.valid).toBe(false);
      expect(result.warnings.some(w => w.includes('High concurrency'))).toBe(true);
    });

    it('should warn about problematic user agent', () => {
      const config = {
        userAgent: 'Mozilla/5.0 (compatible; bot)',
        crawlDelay: 2000,
        maxConcurrency: 2
      };
      
      const result = validateScrapingConfig(config);
      expect(result.valid).toBe(false);
      expect(result.warnings.some(w => w.includes('User agent should identify'))).toBe(true);
    });
  });
});