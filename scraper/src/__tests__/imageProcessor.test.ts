import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageProcessor } from '../services/imageProcessor.js';
import sharp from 'sharp';
import { S3Client } from '@aws-sdk/client-s3';

// Mock dependencies
vi.mock('@aws-sdk/client-s3');
vi.mock('sharp');
vi.mock('../config/environment.js', () => ({
  config: {
    CLOUDFLARE_R2_ACCOUNT_ID: 'test-account',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'test-key',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'test-secret',
    CLOUDFLARE_R2_BUCKET_NAME: 'test-bucket',
    CLOUDFLARE_R2_PUBLIC_URL: 'https://test-bucket.r2.dev',
    SCRAPER_USER_AGENT: 'Test-Bot/1.0',
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

// Mock fetch globally
global.fetch = vi.fn();

describe('ImageProcessor', () => {
  let imageProcessor: ImageProcessor;
  let mockS3Send: ReturnType<typeof vi.fn>;

  // Create test image buffers
  const createTestImageBuffer = async (width = 100, height = 100, format: 'jpeg' | 'png' = 'jpeg') => {
    return await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();
  };

  const createLargeImageBuffer = async () => {
    // Create a buffer larger than 5MB
    return Buffer.alloc(6 * 1024 * 1024, 'test');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock S3Client
    mockS3Send = vi.fn().mockResolvedValue({});
    (S3Client as any).mockImplementation(() => ({
      send: mockS3Send,
    }));

    // Mock sharp
    const mockSharpInstance = {
      metadata: vi.fn().mockResolvedValue({
        format: 'jpeg',
        width: 100,
        height: 100,
      }),
      resize: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image')),
    };

    (sharp as any).mockImplementation(() => mockSharpInstance);
    (sharp as any).mockReturnValue(mockSharpInstance);

    imageProcessor = new ImageProcessor();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('downloadImage', () => {
    it('should successfully download an image', async () => {
      const mockImageBuffer = await createTestImageBuffer();
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('image/jpeg'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockImageBuffer),
      });

      const result = await imageProcessor.downloadImage('https://example.com/image.jpg');
      
      expect(result).toBeInstanceOf(Buffer);
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.jpg', {
        headers: {
          'User-Agent': 'Test-Bot/1.0',
          'Accept': 'image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
        },
        timeout: 30000,
      });
    });

    it('should throw error for non-200 response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(imageProcessor.downloadImage('https://example.com/missing.jpg'))
        .rejects.toThrow('Failed to download image from https://example.com/missing.jpg: HTTP 404: Not Found');
    });

    it('should throw error for non-image content type', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('text/html'),
        },
      });

      await expect(imageProcessor.downloadImage('https://example.com/not-image.html'))
        .rejects.toThrow('Failed to download image from https://example.com/not-image.html: Invalid content type: text/html');
    });

    it('should throw error for empty image data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('image/jpeg'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      });

      await expect(imageProcessor.downloadImage('https://example.com/empty.jpg'))
        .rejects.toThrow('Failed to download image from https://example.com/empty.jpg: Empty image data received');
    });

    it('should throw error for oversized image', async () => {
      const largeBuffer = await createLargeImageBuffer();
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('image/jpeg'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(largeBuffer),
      });

      await expect(imageProcessor.downloadImage('https://example.com/large.jpg'))
        .rejects.toThrow('Failed to download image from https://example.com/large.jpg: Image too large');
    });
  });

  describe('validateImage', () => {
    it('should validate a valid JPEG image', async () => {
      const mockBuffer = await createTestImageBuffer();
      
      const result = await imageProcessor.validateImage(mockBuffer);
      
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('jpeg');
      expect(result.dimensions).toEqual({ width: 100, height: 100 });
    });

    it('should reject unsupported format', async () => {
      const mockSharpInstance = {
        metadata: vi.fn().mockResolvedValue({
          format: 'bmp',
          width: 100,
          height: 100,
        }),
      };
      (sharp as any).mockReturnValue(mockSharpInstance);

      const result = await imageProcessor.validateImage(Buffer.from('test'));
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported format: bmp');
    });

    it('should reject oversized image', async () => {
      const largeBuffer = await createLargeImageBuffer();
      
      const result = await imageProcessor.validateImage(largeBuffer);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File too large');
    });

    it('should handle invalid image data', async () => {
      const mockSharpInstance = {
        metadata: vi.fn().mockRejectedValue(new Error('Invalid image')),
      };
      (sharp as any).mockReturnValue(mockSharpInstance);

      const result = await imageProcessor.validateImage(Buffer.from('invalid'));
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid image data');
    });
  });

  describe('processImage', () => {
    it('should process image with optimization', async () => {
      const mockBuffer = await createTestImageBuffer();
      
      const result = await imageProcessor.processImage(mockBuffer);
      
      expect(result.format).toBe('jpeg');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should resize large images', async () => {
      const mockSharpInstance = {
        metadata: vi.fn().mockResolvedValue({
          format: 'jpeg',
          width: 2000,
          height: 1500,
        }),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized-image')),
      };
      (sharp as any).mockReturnValue(mockSharpInstance);

      const result = await imageProcessor.processImage(Buffer.from('large-image'));
      
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(1200, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
      expect(result.format).toBe('jpeg');
    });

    it('should handle processing errors', async () => {
      const mockSharpInstance = {
        metadata: vi.fn().mockResolvedValue({ format: 'jpeg', width: 100, height: 100 }),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockRejectedValue(new Error('Processing failed')),
      };
      (sharp as any).mockReturnValue(mockSharpInstance);

      await expect(imageProcessor.processImage(Buffer.from('test')))
        .rejects.toThrow('Image processing failed: Processing failed');
    });
  });

  describe('uploadToR2', () => {
    it('should upload image to R2 successfully', async () => {
      const mockBuffer = Buffer.from('test-image');
      
      const result = await imageProcessor.uploadToR2(mockBuffer, 'jpeg');
      
      expect(result.filename).toMatch(/^[0-9a-f-]{36}\.jpeg$/);
      expect(result.r2Url).toMatch(/^https:\/\/test-bucket\.r2\.dev\/products\/[0-9a-f-]{36}\.jpeg$/);
      expect(mockS3Send).toHaveBeenCalledTimes(1);
    });

    it('should handle upload errors', async () => {
      mockS3Send.mockRejectedValueOnce(new Error('Upload failed'));
      
      await expect(imageProcessor.uploadToR2(Buffer.from('test'), 'jpeg'))
        .rejects.toThrow('R2 upload failed: Upload failed');
    });
  });

  describe('convertToAbsoluteUrl', () => {
    it('should return absolute URLs unchanged', () => {
      const absoluteUrl = 'https://example.com/image.jpg';
      const result = imageProcessor.convertToAbsoluteUrl(absoluteUrl, 'https://base.com');
      
      expect(result).toBe(absoluteUrl);
    });

    it('should convert protocol-relative URLs', () => {
      const result = imageProcessor.convertToAbsoluteUrl('//example.com/image.jpg', 'https://base.com');
      
      expect(result).toBe('https://example.com/image.jpg');
    });

    it('should convert relative URLs', () => {
      const result = imageProcessor.convertToAbsoluteUrl('/images/photo.jpg', 'https://example.com/products');
      
      expect(result).toBe('https://example.com/images/photo.jpg');
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-url';
      const result = imageProcessor.convertToAbsoluteUrl(invalidUrl, 'invalid-base');
      
      expect(result).toBe(invalidUrl);
    });
  });

  describe('processImageUrl', () => {
    it('should process image URL successfully', async () => {
      const mockImageBuffer = await createTestImageBuffer();
      
      // Mock fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('image/jpeg'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockImageBuffer),
      });

      const result = await imageProcessor.processImageUrl('https://example.com/image.jpg');
      
      expect(result.success).toBe(true);
      expect(result.originalUrl).toBe('https://example.com/image.jpg');
      expect(result.r2Url).toMatch(/^https:\/\/test-bucket\.r2\.dev\/products\/[0-9a-f-]{36}\.jpeg$/);
      expect(result.filename).toMatch(/^[0-9a-f-]{36}\.jpeg$/);
      expect(result.format).toBe('jpeg');
    });

    it('should handle processing failures', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      const result = await imageProcessor.processImageUrl('https://example.com/image.jpg');
      
      expect(result.success).toBe(false);
      expect(result.originalUrl).toBe('https://example.com/image.jpg');
      expect(result.error).toContain('Network error');
    });

    it('should convert relative URLs with base URL', async () => {
      const mockImageBuffer = await createTestImageBuffer();
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('image/jpeg'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockImageBuffer),
      });

      const result = await imageProcessor.processImageUrl('/images/photo.jpg', 'https://example.com');
      
      expect(result.success).toBe(true);
      expect(result.originalUrl).toBe('/images/photo.jpg');
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/images/photo.jpg', expect.any(Object));
    });
  });

  describe('processImageUrls', () => {
    it('should process multiple images with concurrency control', async () => {
      const mockImageBuffer = await createTestImageBuffer();
      const imageUrls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg',
      ];

      // Mock fetch for all images
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('image/jpeg'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockImageBuffer),
      });

      const results = await imageProcessor.processImageUrls(imageUrls, undefined, 2);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure results', async () => {
      const mockImageBuffer = await createTestImageBuffer();
      const imageUrls = [
        'https://example.com/good.jpg',
        'https://example.com/bad.jpg',
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: vi.fn().mockReturnValue('image/jpeg'),
          },
          arrayBuffer: vi.fn().mockResolvedValue(mockImageBuffer),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const results = await imageProcessor.processImageUrls(imageUrls);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Network error');
    });
  });
});