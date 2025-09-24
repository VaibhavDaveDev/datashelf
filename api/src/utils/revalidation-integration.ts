import type { Env } from '@/types/env';
import { RevalidationService, type RevalidationJobType } from '@/services/revalidation';

/**
 * Cache key to revalidation job mapping
 */
interface CacheKeyMapping {
  dataType: RevalidationJobType;
  targetUrl: string;
  metadata?: Record<string, any>;
}

/**
 * Extract revalidation job details from cache key
 */
export function extractRevalidationDetails(cacheKey: string): CacheKeyMapping | null {
  try {
    // Parse cache key URL
    const url = new URL(cacheKey);
    const keyPath = url.pathname.replace('/cache.datashelf.internal/', '').replace('/', '');
    const [prefix, params] = keyPath.split(':');
    
    // Parse query parameters if they exist
    const queryParams = new URLSearchParams(params || '');
    
    switch (prefix) {
      case 'navigation':
        return {
          dataType: 'navigation',
          targetUrl: 'https://www.worldofbooks.com', // Base navigation URL
          metadata: {
            cache_prefix: prefix,
          },
        };
        
      case 'categories':
        const navId = queryParams.get('navId');
        const parentId = queryParams.get('parentId');
        
        // For categories, we need to determine the target URL based on navigation
        // This is a simplified approach - in production, you might want to store
        // the original source URLs in the database
        return {
          dataType: 'category',
          targetUrl: navId 
            ? `https://www.worldofbooks.com/category/${navId}`
            : 'https://www.worldofbooks.com/categories',
          metadata: {
            cache_prefix: prefix,
            nav_id: navId,
            parent_id: parentId,
          },
        };
        
      case 'products':
        const categoryId = queryParams.get('categoryId');
        
        return {
          dataType: 'product',
          targetUrl: categoryId
            ? `https://www.worldofbooks.com/category/${categoryId}/products`
            : 'https://www.worldofbooks.com/products',
          metadata: {
            cache_prefix: prefix,
            category_id: categoryId,
          },
        };
        
      case 'product_detail':
        const productId = queryParams.get('id');
        
        if (!productId) {
          return null;
        }
        
        return {
          dataType: 'product',
          targetUrl: `https://www.worldofbooks.com/product/${productId}`,
          metadata: {
            cache_prefix: prefix,
            product_id: productId,
          },
        };
        
      default:
        return null;
    }
  } catch (error) {
    console.error('Failed to extract revalidation details from cache key:', error);
    return null;
  }
}

/**
 * Create revalidation trigger function for cache manager
 */
export function createRevalidationTrigger(env: Env) {
  const revalidationService = new RevalidationService(env);
  
  return async (cacheKey: string): Promise<void> => {
    // Check if revalidation is enabled
    const revalidationEnabled = env.REVALIDATION_ENABLED !== 'false';
    if (!revalidationEnabled) {
      console.log('Revalidation disabled, skipping trigger for cache key:', cacheKey);
      return;
    }
    
    // Extract revalidation details from cache key
    const details = extractRevalidationDetails(cacheKey);
    if (!details) {
      console.warn('Could not extract revalidation details from cache key:', cacheKey);
      return;
    }
    
    // Trigger revalidation
    await revalidationService.triggerStaleRevalidation(
      cacheKey,
      details.dataType,
      details.targetUrl,
      details.metadata
    );
  };
}

/**
 * Create revalidation service instance
 */
export function createRevalidationService(env: Env): RevalidationService {
  return new RevalidationService(env);
}

/**
 * Revalidation utilities for handlers
 */
export class RevalidationUtils {
  private revalidationService: RevalidationService;
  
  constructor(env: Env) {
    this.revalidationService = new RevalidationService(env);
  }
  
  /**
   * Trigger manual revalidation for specific data
   */
  async triggerManualRevalidation(
    dataType: RevalidationJobType,
    targetUrl: string,
    priority: number = 7,
    metadata?: Record<string, any>
  ) {
    return this.revalidationService.triggerRevalidation({
      type: dataType,
      target_url: targetUrl,
      priority,
      metadata,
    }, 'manual');
  }
  
  /**
   * Get revalidation metrics
   */
  getMetrics() {
    return this.revalidationService.getMetrics();
  }
  
  /**
   * Get rate limit status
   */
  getRateLimitStatus(source?: string) {
    return this.revalidationService.getRateLimitStatus(source);
  }
  
  /**
   * Check scraper health
   */
  async checkScraperHealth() {
    return this.revalidationService.checkScraperHealth();
  }
}