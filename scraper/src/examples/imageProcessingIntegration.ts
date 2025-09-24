/**
 * Example integration showing how to use the ImageProcessor with scraped product data
 * This demonstrates the complete flow from scraping to image processing and storage
 */

import { ScrapedProduct } from '../types/index.js';
import { processProductImages } from '../utils/imageUtils.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ImageProcessingIntegration');

/**
 * Example: Process images for a scraped product
 */
export async function processScrapedProductImages(
  product: ScrapedProduct,
  baseUrl: string = 'https://www.worldofbooks.com'
): Promise<ScrapedProduct> {
  logger.info('Processing images for scraped product', {
    productTitle: product.title,
    originalImageCount: product.image_urls.length,
    sourceUrl: product.source_url,
  });

  try {
    // Process all product images
    const processedImageUrls = await processProductImages(
      product.image_urls,
      baseUrl,
      product.title
    );

    // Update the product with processed R2 URLs
    const updatedProduct: ScrapedProduct = {
      ...product,
      image_urls: processedImageUrls,
    };

    logger.info('Product image processing completed', {
      productTitle: product.title,
      originalImageCount: product.image_urls.length,
      processedImageCount: processedImageUrls.length,
      sourceUrl: product.source_url,
    });

    return updatedProduct;
  } catch (error) {
    logger.error('Failed to process product images', {
      productTitle: product.title,
      sourceUrl: product.source_url,
      error: error instanceof Error ? error.message : String(error),
    });

    // Return original product if image processing fails
    // This ensures scraping continues even if image processing has issues
    return product;
  }
}

/**
 * Example: Batch process images for multiple products
 */
export async function batchProcessProductImages(
  products: ScrapedProduct[],
  baseUrl: string = 'https://www.worldofbooks.com',
  options: {
    concurrency?: number;
    onProgress?: (processed: number, total: number) => void;
  } = {}
): Promise<ScrapedProduct[]> {
  const { concurrency = 3, onProgress } = options;
  
  logger.info('Starting batch product image processing', {
    productCount: products.length,
    concurrency,
    baseUrl,
  });

  const processedProducts: ScrapedProduct[] = [];
  
  // Process products in batches to control concurrency
  for (let i = 0; i < products.length; i += concurrency) {
    const batch = products.slice(i, i + concurrency);
    const batchNumber = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(products.length / concurrency);

    logger.debug('Processing product batch', {
      batchNumber,
      totalBatches,
      batchSize: batch.length,
    });

    try {
      // Process batch concurrently
      const batchPromises = batch.map(product => 
        processScrapedProductImages(product, baseUrl)
      );
      
      const batchResults = await Promise.all(batchPromises);
      processedProducts.push(...batchResults);

      // Report progress
      if (onProgress) {
        onProgress(processedProducts.length, products.length);
      }

      logger.debug('Product batch completed', {
        batchNumber,
        processed: processedProducts.length,
        total: products.length,
      });
    } catch (error) {
      logger.error('Product batch processing failed', {
        batchNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Add original products if batch fails
      processedProducts.push(...batch);
    }
  }

  const totalOriginalImages = products.reduce((sum, p) => sum + p.image_urls.length, 0);
  const totalProcessedImages = processedProducts.reduce((sum, p) => sum + p.image_urls.length, 0);

  logger.info('Batch product image processing completed', {
    productCount: products.length,
    totalOriginalImages,
    totalProcessedImages,
    successRate: totalProcessedImages / totalOriginalImages,
  });

  return processedProducts;
}

/**
 * Example: Integration with existing scraper workflow
 * This shows how to modify existing scrapers to include image processing
 */
export class ImageProcessingProductScraper {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://www.worldofbooks.com') {
    this.baseUrl = baseUrl;
  }

  /**
   * Enhanced product scraping that includes image processing
   */
  async scrapeProductWithImages(productUrl: string): Promise<ScrapedProduct | null> {
    try {
      // This would typically be done by your existing product scraper
      const scrapedProduct = await this.mockScrapeProduct(productUrl);
      
      if (!scrapedProduct) {
        return null;
      }

      // Process images after scraping
      const productWithProcessedImages = await processScrapedProductImages(
        scrapedProduct,
        this.baseUrl
      );

      return productWithProcessedImages;
    } catch (error) {
      logger.error('Failed to scrape product with images', {
        productUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Mock product scraper for demonstration
   * In real implementation, this would use your existing scraping logic
   */
  private async mockScrapeProduct(productUrl: string): Promise<ScrapedProduct> {
    // This is just a mock - replace with your actual scraping logic
    return {
      title: 'Example Book Title',
      source_url: productUrl,
      source_id: 'book-123',
      price: 9.99,
      currency: 'GBP',
      image_urls: [
        '/images/book-cover-front.jpg',
        '/images/book-cover-back.jpg',
        'https://example.com/book-spine.jpg',
      ],
      summary: 'An example book description',
      specs: {
        author: 'Example Author',
        isbn: '978-0123456789',
        publisher: 'Example Publisher',
        pages: 250,
        language: 'English',
        format: 'Paperback',
      },
      available: true,
      category_id: 'fiction-books',
    };
  }
}

/**
 * Example usage and testing
 */
export async function demonstrateImageProcessing() {
  logger.info('Starting image processing demonstration');

  // Example 1: Process a single product
  const singleProduct: ScrapedProduct = {
    title: 'The Great Gatsby',
    source_url: 'https://www.worldofbooks.com/en-gb/books/f-scott-fitzgerald/the-great-gatsby/9780141182636',
    price: 7.99,
    currency: 'GBP',
    image_urls: [
      '/images/covers/9780141182636.jpg',
      '/images/covers/9780141182636-back.jpg',
    ],
    summary: 'A classic American novel',
    specs: {
      author: 'F. Scott Fitzgerald',
      isbn: '9780141182636',
      pages: 180,
    },
    available: true,
  };

  const processedProduct = await processScrapedProductImages(singleProduct);
  logger.info('Single product processing result', {
    originalImageCount: singleProduct.image_urls.length,
    processedImageCount: processedProduct.image_urls.length,
  });

  // Example 2: Batch process multiple products
  const multipleProducts: ScrapedProduct[] = [
    singleProduct,
    {
      ...singleProduct,
      title: 'To Kill a Mockingbird',
      source_url: 'https://www.worldofbooks.com/en-gb/books/harper-lee/to-kill-a-mockingbird/9780061120084',
      image_urls: ['/images/covers/9780061120084.jpg'],
    },
  ];

  const batchProcessedProducts = await batchProcessProductImages(
    multipleProducts,
    'https://www.worldofbooks.com',
    {
      concurrency: 2,
      onProgress: (processed, total) => {
        logger.info('Batch progress', { processed, total, percentage: (processed / total) * 100 });
      },
    }
  );

  logger.info('Batch processing result', {
    totalProducts: batchProcessedProducts.length,
    totalImages: batchProcessedProducts.reduce((sum, p) => sum + p.image_urls.length, 0),
  });

  // Example 3: Enhanced scraper with image processing
  const enhancedScraper = new ImageProcessingProductScraper();
  const scrapedProductWithImages = await enhancedScraper.scrapeProductWithImages(
    'https://www.worldofbooks.com/en-gb/books/example-book'
  );

  if (scrapedProductWithImages) {
    logger.info('Enhanced scraper result', {
      title: scrapedProductWithImages.title,
      imageCount: scrapedProductWithImages.image_urls.length,
    });
  }

  logger.info('Image processing demonstration completed');
}

// Export for use in other modules
export {
  ImageProcessor,
  imageProcessor,
} from '../services/imageProcessor.js';

export {
  processSingleImage,
  validateImageUrls,
  extractImageUrls,
  batchProcessImages,
} from '../utils/imageUtils.js';