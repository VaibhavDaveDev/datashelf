import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  processProductImages, 
  processSingleImage, 
  validateImageUrls, 
  extractImageUrls,
  calculateImageStats,
  batchProcessImages
} from '../utils/imageUtils.js';
import { ImageProcessingResult } from '../types/index.js';

// Mock the image processor
vi.mock('../services/imageProcessor.js', () => ({
  imageProcessor: {
    processImageUrls: vi.fn(),
    processImageUrl: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import the mocked imageProcessor
import { imageProcessor } from '../services/imageProcessor.js';

describe('ImageUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processProductImages', () => {
    it('should process product images successfully', async () => {
      const mockResults: ImageProcessingResult[] = [
        {
          success: true,
          originalUrl: 'https://example.com/image1.jpg',
          r2Url: 'https://r2.dev/products/uuid1.jpeg',
          filename: 'uuid1.jpeg',
          format: 'jpeg',
          size: 1024,
        },
        {
          success: true,
          originalUrl: 'https://example.com/image2.jpg',
          r2Url: 'https://r2.dev/products/uuid2.jpeg',
          filename: 'uuid2.jpeg',
          format: 'jpeg',
          size: 2048,
        },
      ];

      (imageProcessor.processImageUrls as any).mockResolvedValue(mockResults);

      const imageUrls = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'];
      const result = await processProductImages(imageUrls, 'https://example.com', 'Test Product');

      expect(result).toEqual([
        'https://r2.dev/products/uuid1.jpeg',
        'https://r2.dev/products/uuid2.jpeg',
      ]);
      expect(imageProcessor.processImageUrls).toHaveBeenCalledWith(imageUrls, 'https://example.com');
    });

    it('should handle mixed success and failure results', async () => {
      const mockResults: ImageProcessingResult[] = [
        {
          success: true,
          originalUrl: 'https://example.com/image1.jpg',
          r2Url: 'https://r2.dev/products/uuid1.jpeg',
          filename: 'uuid1.jpeg',
          format: 'jpeg',
          size: 1024,
        },
        {
          success: false,
          originalUrl: 'https://example.com/image2.jpg',
          error: 'Download failed',
        },
      ];

      (imageProcessor.processImageUrls as any).mockResolvedValue(mockResults);

      const imageUrls = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'];
      const result = await processProductImages(imageUrls, 'https://example.com');

      expect(result).toEqual(['https://r2.dev/products/uuid1.jpeg']);
    });

    it('should return empty array for empty input', async () => {
      const result = await processProductImages([], 'https://example.com');
      expect(result).toEqual([]);
      expect(imageProcessor.processImageUrls).not.toHaveBeenCalled();
    });

    it('should handle processing errors gracefully', async () => {
      (imageProcessor.processImageUrls as any).mockRejectedValue(new Error('Processing failed'));

      const imageUrls = ['https://example.com/image1.jpg'];
      const result = await processProductImages(imageUrls, 'https://example.com');

      expect(result).toEqual([]);
    });
  });

  describe('processSingleImage', () => {
    it('should process single image successfully', async () => {
      const mockResult: ImageProcessingResult = {
        success: true,
        originalUrl: 'https://example.com/image.jpg',
        r2Url: 'https://r2.dev/products/uuid.jpeg',
        filename: 'uuid.jpeg',
        format: 'jpeg',
        size: 1024,
      };

      (imageProcessor.processImageUrl as any).mockResolvedValue(mockResult);

      const result = await processSingleImage('https://example.com/image.jpg', 'https://example.com');

      expect(result).toBe('https://r2.dev/products/uuid.jpeg');
      expect(imageProcessor.processImageUrl).toHaveBeenCalledWith('https://example.com/image.jpg', 'https://example.com');
    });

    it('should return null for failed processing', async () => {
      const mockResult: ImageProcessingResult = {
        success: false,
        originalUrl: 'https://example.com/image.jpg',
        error: 'Download failed',
      };

      (imageProcessor.processImageUrl as any).mockResolvedValue(mockResult);

      const result = await processSingleImage('https://example.com/image.jpg');

      expect(result).toBeNull();
    });

    it('should handle processing errors', async () => {
      (imageProcessor.processImageUrl as any).mockRejectedValue(new Error('Processing error'));

      const result = await processSingleImage('https://example.com/image.jpg');

      expect(result).toBeNull();
    });
  });

  describe('validateImageUrls', () => {
    it('should validate and filter image URLs', () => {
      const urls = [
        'https://example.com/image.jpg',
        'https://example.com/photo.png',
        'https://example.com/pic.gif',
        'https://example.com/image.webp',
        'https://example.com/document.pdf', // Should be filtered
        '', // Should be filtered
        '   ', // Should be filtered
        null as any, // Should be filtered
        undefined as any, // Should be filtered
        'https://example.com/image-gallery', // Should pass (contains 'image')
        '/relative/image.jpg', // Should be filtered (no http)
        'http://example.com/old.jpeg', // Should pass
      ];

      const result = validateImageUrls(urls);

      expect(result).toEqual([
        'https://example.com/image.jpg',
        'https://example.com/photo.png',
        'https://example.com/pic.gif',
        'https://example.com/image.webp',
        'https://example.com/image-gallery',
        'http://example.com/old.jpeg',
      ]);
    });

    it('should handle empty array', () => {
      const result = validateImageUrls([]);
      expect(result).toEqual([]);
    });
  });

  describe('extractImageUrls', () => {
    it('should extract URLs from array', () => {
      const data = ['https://example.com/image1.jpg', 'https://example.com/image2.png'];
      const result = extractImageUrls(data);
      expect(result).toEqual(data);
    });

    it('should extract URLs from object with image properties', () => {
      const data = {
        image_urls: ['https://example.com/image1.jpg'],
        thumbnail: 'https://example.com/thumb.jpg',
        other_property: 'not an image',
      };

      const result = extractImageUrls(data);
      expect(result).toEqual([
        'https://example.com/image1.jpg',
        'https://example.com/thumb.jpg',
      ]);
    });

    it('should handle object with single image string', () => {
      const data = {
        image: 'https://example.com/single.jpg',
      };

      const result = extractImageUrls(data);
      expect(result).toEqual(['https://example.com/single.jpg']);
    });

    it('should return empty array for invalid data', () => {
      expect(extractImageUrls(null)).toEqual([]);
      expect(extractImageUrls(undefined)).toEqual([]);
      expect(extractImageUrls('string')).toEqual([]);
      expect(extractImageUrls(123)).toEqual([]);
      expect(extractImageUrls({})).toEqual([]);
    });
  });

  describe('calculateImageStats', () => {
    it('should calculate statistics correctly', () => {
      const results: ImageProcessingResult[] = [
        {
          success: true,
          originalUrl: 'url1',
          r2Url: 'r2url1',
          size: 1000,
          format: 'jpeg',
        },
        {
          success: true,
          originalUrl: 'url2',
          r2Url: 'r2url2',
          size: 2000,
          format: 'jpeg',
        },
        {
          success: true,
          originalUrl: 'url3',
          r2Url: 'r2url3',
          size: 3000,
          format: 'png',
        },
        {
          success: false,
          originalUrl: 'url4',
          error: 'Failed',
        },
      ];

      const stats = calculateImageStats(results);

      expect(stats).toEqual({
        totalProcessed: 4,
        successful: 3,
        failed: 1,
        totalSize: 6000,
        averageSize: 2000,
        formats: {
          jpeg: 2,
          png: 1,
        },
      });
    });

    it('should handle empty results', () => {
      const stats = calculateImageStats([]);

      expect(stats).toEqual({
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        totalSize: 0,
        averageSize: 0,
        formats: {},
      });
    });

    it('should handle all failed results', () => {
      const results: ImageProcessingResult[] = [
        {
          success: false,
          originalUrl: 'url1',
          error: 'Failed',
        },
        {
          success: false,
          originalUrl: 'url2',
          error: 'Failed',
        },
      ];

      const stats = calculateImageStats(results);

      expect(stats).toEqual({
        totalProcessed: 2,
        successful: 0,
        failed: 2,
        totalSize: 0,
        averageSize: 0,
        formats: {},
      });
    });
  });

  describe('batchProcessImages', () => {
    it('should process images in batches', async () => {
      const mockResults: ImageProcessingResult[] = [
        {
          success: true,
          originalUrl: 'https://example.com/image1.jpg',
          r2Url: 'https://r2.dev/products/uuid1.jpeg',
          filename: 'uuid1.jpeg',
          format: 'jpeg',
          size: 1024,
        },
        {
          success: true,
          originalUrl: 'https://example.com/image2.jpg',
          r2Url: 'https://r2.dev/products/uuid2.jpeg',
          filename: 'uuid2.jpeg',
          format: 'jpeg',
          size: 2048,
        },
      ];

      (imageProcessor.processImageUrls as any).mockResolvedValue(mockResults);

      const imageUrls = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'];
      const onProgress = vi.fn();
      const onBatchComplete = vi.fn();

      const result = await batchProcessImages(imageUrls, 'https://example.com', {
        batchSize: 2,
        onProgress,
        onBatchComplete,
      });

      expect(result).toEqual(mockResults);
      expect(onProgress).toHaveBeenCalledWith(2, 2, expect.any(Object));
      expect(onBatchComplete).toHaveBeenCalledWith(mockResults);
    });

    it('should handle batch processing errors', async () => {
      (imageProcessor.processImageUrls as any).mockRejectedValue(new Error('Batch failed'));

      const imageUrls = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'];
      const result = await batchProcessImages(imageUrls, 'https://example.com', {
        batchSize: 2,
      });

      expect(result).toHaveLength(2);
      expect(result.every(r => !r.success)).toBe(true);
      expect(result.every(r => r.error?.includes('Batch processing failed'))).toBe(true);
    });

    it('should process multiple batches', async () => {
      const batch1Results: ImageProcessingResult[] = [
        { success: true, originalUrl: 'https://example.com/image1.jpg', r2Url: 'r2url1', filename: 'file1', format: 'jpeg', size: 1000 },
        { success: true, originalUrl: 'https://example.com/image2.jpg', r2Url: 'r2url2', filename: 'file2', format: 'jpeg', size: 2000 },
      ];
      
      const batch2Results: ImageProcessingResult[] = [
        { success: true, originalUrl: 'https://example.com/image3.jpg', r2Url: 'r2url3', filename: 'file3', format: 'png', size: 3000 },
      ];

      (imageProcessor.processImageUrls as any)
        .mockResolvedValueOnce(batch1Results)
        .mockResolvedValueOnce(batch2Results);

      const imageUrls = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg', 'https://example.com/image3.jpg'];
      const result = await batchProcessImages(imageUrls, 'https://example.com', {
        batchSize: 2,
      });

      expect(result).toEqual([...batch1Results, ...batch2Results]);
      expect(imageProcessor.processImageUrls).toHaveBeenCalledTimes(2);
    });
  });
});