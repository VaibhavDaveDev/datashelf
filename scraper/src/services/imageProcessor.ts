import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/environment.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ImageProcessor');

export interface ImageProcessingResult {
  success: boolean;
  r2Url?: string;
  originalUrl: string;
  filename?: string;
  error?: string;
  size?: number;
  format?: string;
  dimensions?: { width: number; height: number };
}

export interface ImageValidationResult {
  isValid: boolean;
  format?: string;
  size?: number;
  dimensions?: { width: number; height: number };
  error?: string;
}

export class ImageProcessor {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;
  private isInitialized = false;

  // Supported image formats
  private readonly SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
  
  // Maximum file size (5MB)
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  
  // Image processing options
  private readonly PROCESSING_OPTIONS = {
    quality: 85,
    progressive: true,
    optimizeScans: true,
  };

  constructor() {
    // Configure S3 client for Cloudflare R2
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: config.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });

    this.bucketName = config.CLOUDFLARE_R2_BUCKET_NAME;
    this.publicUrl = config.CLOUDFLARE_R2_PUBLIC_URL;
  }

  /**
   * Initialize the image processor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Test R2 connection by attempting to list objects (with limit 1)
      await this.healthCheck();
      this.isInitialized = true;
      
      logger.info('ImageProcessor initialized', {
        bucketName: this.bucketName,
        publicUrl: this.publicUrl,
      });
    } catch (error) {
      throw new Error(`Image processor initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Health check for the image processor
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test R2 connection by attempting to list objects
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1,
      });
      
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      logger.error('Image processor health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Process single image: download, validate, process, and upload
   * This is the main method that the worker will call
   */
  async processImage(imageUrl: string, baseUrl?: string): Promise<ImageProcessingResult> {
    return this.processImageUrl(imageUrl, baseUrl);
  }

  /**
   * Download image from URL with proper headers and error handling
   */
  async downloadImage(imageUrl: string): Promise<Buffer> {
    try {
      logger.debug('Downloading image', { url: imageUrl });

      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': config.SCRAPER_USER_AGENT,
          'Accept': 'image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
        },
        // Note: timeout is not supported in standard fetch, would need AbortController
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      
      if (buffer.length === 0) {
        throw new Error('Empty image data received');
      }

      if (buffer.length > this.MAX_FILE_SIZE) {
        throw new Error(`Image too large: ${buffer.length} bytes (max: ${this.MAX_FILE_SIZE})`);
      }

      logger.debug('Image downloaded successfully', {
        url: imageUrl,
        size: buffer.length,
        contentType,
      });

      return buffer;
    } catch (error) {
      logger.error('Failed to download image', {
        url: imageUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to download image from ${imageUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate image format and properties
   */
  async validateImage(buffer: Buffer): Promise<ImageValidationResult> {
    try {
      const metadata = await sharp(buffer).metadata();
      
      const format = metadata.format?.toLowerCase();
      if (!format || !this.SUPPORTED_FORMATS.includes(format)) {
        return {
          isValid: false,
          error: `Unsupported format: ${format}. Supported formats: ${this.SUPPORTED_FORMATS.join(', ')}`,
        };
      }

      const size = buffer.length;
      if (size > this.MAX_FILE_SIZE) {
        return {
          isValid: false,
          error: `File too large: ${size} bytes (max: ${this.MAX_FILE_SIZE})`,
        };
      }

      const result: ImageValidationResult = {
        isValid: true,
        format,
        size,
      };

      if (metadata.width && metadata.height) {
        result.dimensions = { width: metadata.width, height: metadata.height };
      }

      return result;
    } catch (error) {
      return {
        isValid: false,
        error: `Invalid image data: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Process image buffer (optimize, resize if needed)
   */
  async processImageBuffer(buffer: Buffer): Promise<{ buffer: Buffer; format: string }> {
    try {
      const metadata = await sharp(buffer).metadata();
      let sharpInstance = sharp(buffer);

      // Convert to JPEG for better compression and compatibility
      const targetFormat = 'jpeg';
      
      // Resize if image is too large (max 1200px width)
      if (metadata.width && metadata.width > 1200) {
        sharpInstance = sharpInstance.resize(1200, null, {
          withoutEnlargement: true,
          fit: 'inside',
        });
      }

      // Apply optimization
      const processedBuffer = await sharpInstance
        .jpeg(this.PROCESSING_OPTIONS)
        .toBuffer();

      logger.debug('Image processed', {
        originalSize: buffer.length,
        processedSize: processedBuffer.length,
        originalFormat: metadata.format,
        targetFormat,
        originalDimensions: metadata.width && metadata.height 
          ? `${metadata.width}x${metadata.height}` 
          : 'unknown',
      });

      return {
        buffer: processedBuffer,
        format: targetFormat,
      };
    } catch (error) {
      logger.error('Failed to process image', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Upload image to Cloudflare R2
   */
  async uploadToR2(buffer: Buffer, format: string): Promise<{ filename: string; r2Url: string }> {
    try {
      const filename = `${uuidv4()}.${format}`;
      const key = `products/${filename}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: `image/${format}`,
        CacheControl: 'public, max-age=31536000', // 1 year cache
        Metadata: {
          'uploaded-at': new Date().toISOString(),
          'source': 'datashelf-scraper',
        },
      });

      await this.s3Client.send(command);

      const r2Url = `${this.publicUrl}/${key}`;

      logger.debug('Image uploaded to R2', {
        filename,
        key,
        r2Url,
        size: buffer.length,
      });

      return { filename, r2Url };
    } catch (error) {
      logger.error('Failed to upload image to R2', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`R2 upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert relative URL to absolute URL
   */
  convertToAbsoluteUrl(imageUrl: string, baseUrl: string): string {
    try {
      // If already absolute, return as-is
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
      }

      // Handle protocol-relative URLs
      if (imageUrl.startsWith('//')) {
        return `https:${imageUrl}`;
      }

      // Handle relative URLs
      const base = new URL(baseUrl);
      const absolute = new URL(imageUrl, base.origin);
      
      return absolute.toString();
    } catch (error) {
      logger.warn('Failed to convert relative URL to absolute', {
        imageUrl,
        baseUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      return imageUrl; // Return original if conversion fails
    }
  }

  /**
   * Generate signed URL for private access (if needed)
   */
  async generateSignedUrl(filename: string, expiresIn: number = 3600): Promise<string> {
    try {
      const key = `products/${filename}`;
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      logger.debug('Generated signed URL', {
        filename,
        key,
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate signed URL', {
        filename,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process single image: download, validate, process, and upload
   */
  async processImageUrl(imageUrl: string, baseUrl?: string): Promise<ImageProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Convert to absolute URL if needed
      const absoluteUrl = baseUrl ? this.convertToAbsoluteUrl(imageUrl, baseUrl) : imageUrl;
      
      logger.info('Processing image', { originalUrl: imageUrl, absoluteUrl });

      // Download image
      const buffer = await this.downloadImage(absoluteUrl);

      // Validate image
      const validation = await this.validateImage(buffer);
      if (!validation.isValid) {
        const result: ImageProcessingResult = {
          success: false,
          originalUrl: imageUrl,
        };
        if (validation.error) {
          result.error = validation.error;
        }
        return result;
      }

      // Process image
      const { buffer: processedBuffer, format } = await this.processImageBuffer(buffer);

      // Upload to R2
      const { filename, r2Url } = await this.uploadToR2(processedBuffer, format);

      const duration = Date.now() - startTime;

      logger.info('Image processed successfully', {
        originalUrl: imageUrl,
        r2Url,
        filename,
        duration,
        originalSize: buffer.length,
        processedSize: processedBuffer.length,
        format,
        dimensions: validation.dimensions,
      });

      const result: ImageProcessingResult = {
        success: true,
        originalUrl: imageUrl,
        r2Url,
        filename,
        size: processedBuffer.length,
        format,
      };

      if (validation.dimensions) {
        result.dimensions = validation.dimensions;
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Image processing failed', {
        originalUrl: imageUrl,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        originalUrl: imageUrl,
        error: errorMessage,
      };
    }
  }

  /**
   * Process multiple images concurrently
   */
  async processImageUrls(imageUrls: string[], baseUrl?: string, concurrency: number = 3): Promise<ImageProcessingResult[]> {
    logger.info('Processing multiple images', {
      count: imageUrls.length,
      concurrency,
      baseUrl,
    });

    const results: ImageProcessingResult[] = [];
    
    // Process images in batches to control concurrency
    for (let i = 0; i < imageUrls.length; i += concurrency) {
      const batch = imageUrls.slice(i, i + concurrency);
      const batchPromises = batch.map(url => this.processImageUrl(url, baseUrl));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info('Batch image processing completed', {
      total: results.length,
      successful,
      failed,
    });

    return results;
  }
}

// Export singleton instance
export const imageProcessor = new ImageProcessor();