import { imageProcessor, ImageProcessingResult } from '../services/imageProcessor.js';
import { createLogger } from './logger.js';

const logger = createLogger('ImageUtils');

/**
 * Extract and process images from scraped product data
 */
export async function processProductImages(
  imageUrls: string[],
  baseUrl: string,
  productTitle?: string
): Promise<string[]> {
  if (!imageUrls || imageUrls.length === 0) {
    logger.debug('No images to process', { productTitle });
    return [];
  }

  logger.info('Processing product images', {
    productTitle,
    imageCount: imageUrls.length,
    baseUrl,
  });

  try {
    const results = await imageProcessor.processImageUrls(imageUrls, baseUrl);
    
    // Filter successful results and extract R2 URLs
    const successfulUrls = results
      .filter((result): result is ImageProcessingResult & { success: true; r2Url: string } => 
        result.success && !!result.r2Url
      )
      .map(result => result.r2Url);

    // Log any failures
    const failures = results.filter(result => !result.success);
    if (failures.length > 0) {
      logger.warn('Some images failed to process', {
        productTitle,
        totalImages: imageUrls.length,
        successful: successfulUrls.length,
        failed: failures.length,
        failures: failures.map(f => ({ url: f.originalUrl, error: f.error })),
      });
    }

    logger.info('Product image processing completed', {
      productTitle,
      totalImages: imageUrls.length,
      successful: successfulUrls.length,
      failed: failures.length,
    });

    return successfulUrls;
  } catch (error) {
    logger.error('Failed to process product images', {
      productTitle,
      imageCount: imageUrls.length,
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Return empty array on error to prevent breaking the scraping process
    return [];
  }
}

/**
 * Process a single image URL and return the R2 URL or null if failed
 */
export async function processSingleImage(
  imageUrl: string,
  baseUrl?: string
): Promise<string | null> {
  try {
    const result = await imageProcessor.processImageUrl(imageUrl, baseUrl);
    
    if (result.success && result.r2Url) {
      logger.debug('Single image processed successfully', {
        originalUrl: imageUrl,
        r2Url: result.r2Url,
        size: result.size,
        format: result.format,
      });
      return result.r2Url;
    } else {
      logger.warn('Single image processing failed', {
        originalUrl: imageUrl,
        error: result.error,
      });
      return null;
    }
  } catch (error) {
    logger.error('Error processing single image', {
      originalUrl: imageUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Validate image URLs before processing
 */
export function validateImageUrls(imageUrls: string[]): string[] {
  const validUrls: string[] = [];
  
  for (const url of imageUrls) {
    if (!url || typeof url !== 'string') {
      logger.debug('Skipping invalid image URL', { url });
      continue;
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      logger.debug('Skipping empty image URL');
      continue;
    }

    // Basic URL validation - must be HTTP/HTTPS and either have image extension or contain 'image'
    const hasImageExtension = trimmedUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i);
    const containsImage = trimmedUrl.includes('image');
    const isHttpUrl = trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://');
    
    if (!isHttpUrl || (!hasImageExtension && !containsImage)) {
      logger.debug('Skipping potentially invalid image URL', { url: trimmedUrl });
      continue;
    }

    validUrls.push(trimmedUrl);
  }

  if (validUrls.length !== imageUrls.length) {
    logger.debug('Filtered image URLs', {
      original: imageUrls.length,
      valid: validUrls.length,
      filtered: imageUrls.length - validUrls.length,
    });
  }

  return validUrls;
}

/**
 * Extract image URLs from HTML content or scraped data
 */
export function extractImageUrls(
  data: any
): string[] {
  const imageUrls: string[] = [];

  // If data is already an array of URLs
  if (Array.isArray(data)) {
    return validateImageUrls(data);
  }

  // If data is an object with image properties
  if (typeof data === 'object' && data !== null) {
    const possibleImageKeys = [
      'image_urls', 'imageUrls', 'images', 'image', 'src', 'thumbnail', 'photo', 'picture'
    ];

    for (const key of possibleImageKeys) {
      if (data[key]) {
        if (Array.isArray(data[key])) {
          imageUrls.push(...data[key]);
        } else if (typeof data[key] === 'string') {
          imageUrls.push(data[key]);
        }
      }
    }
  }

  return validateImageUrls(imageUrls);
}

/**
 * Get image processing statistics
 */
export interface ImageProcessingStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  totalSize: number;
  averageSize: number;
  formats: Record<string, number>;
}

export function calculateImageStats(results: ImageProcessingResult[]): ImageProcessingStats {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  const totalSize = successful.reduce((sum, r) => sum + (r.size || 0), 0);
  const formats: Record<string, number> = {};
  
  successful.forEach(r => {
    if (r.format) {
      formats[r.format] = (formats[r.format] || 0) + 1;
    }
  });

  return {
    totalProcessed: results.length,
    successful: successful.length,
    failed: failed.length,
    totalSize,
    averageSize: successful.length > 0 ? Math.round(totalSize / successful.length) : 0,
    formats,
  };
}

/**
 * Batch process images with progress tracking
 */
export async function batchProcessImages(
  imageUrls: string[],
  baseUrl: string,
  options: {
    batchSize?: number;
    onProgress?: (processed: number, total: number, stats: ImageProcessingStats) => void;
    onBatchComplete?: (batchResults: ImageProcessingResult[]) => void;
  } = {}
): Promise<ImageProcessingResult[]> {
  const { batchSize = 5, onProgress, onBatchComplete } = options;
  const validUrls = validateImageUrls(imageUrls);
  const allResults: ImageProcessingResult[] = [];

  logger.info('Starting batch image processing', {
    totalImages: validUrls.length,
    batchSize,
    baseUrl,
  });

  for (let i = 0; i < validUrls.length; i += batchSize) {
    const batch = validUrls.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(validUrls.length / batchSize);

    logger.debug('Processing batch', {
      batchNumber,
      totalBatches,
      batchSize: batch.length,
    });

    try {
      const batchResults = await imageProcessor.processImageUrls(batch, baseUrl);
      allResults.push(...batchResults);

      if (onBatchComplete) {
        onBatchComplete(batchResults);
      }

      if (onProgress) {
        const stats = calculateImageStats(allResults);
        onProgress(allResults.length, validUrls.length, stats);
      }
    } catch (error) {
      logger.error('Batch processing failed', {
        batchNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Add failed results for this batch
      const failedResults: ImageProcessingResult[] = batch.map(url => ({
        success: false,
        originalUrl: url,
        error: `Batch processing failed: ${error instanceof Error ? error.message : String(error)}`,
      }));
      allResults.push(...failedResults);
    }
  }

  const finalStats = calculateImageStats(allResults);
  logger.info('Batch image processing completed', {
    totalImages: validUrls.length,
    ...finalStats,
  });

  return allResults;
}