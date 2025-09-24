import type { Env } from '@/types/env';
import { CacheManager, generateCacheKey } from './cache';

/**
 * Cache invalidation patterns and utilities
 */

export interface InvalidationRequest {
  type: 'navigation' | 'category' | 'product' | 'all';
  id?: string;
  categoryId?: string;
}

/**
 * Cache invalidation service
 */
export class CacheInvalidationService {
  private cacheManager: CacheManager;

  constructor(env: Env) {
    this.cacheManager = new CacheManager();
  }

  /**
   * Invalidate cache based on data type and relationships
   */
  async invalidate(request: InvalidationRequest): Promise<void> {
    switch (request.type) {
      case 'navigation':
        await this.invalidateNavigation();
        break;
      
      case 'category':
        await this.invalidateCategory(request.id, request.categoryId);
        break;
      
      case 'product':
        await this.invalidateProduct(request.id, request.categoryId);
        break;
      
      case 'all':
        await this.invalidateAll();
        break;
    }
  }

  /**
   * Invalidate navigation cache
   */
  private async invalidateNavigation(): Promise<void> {
    await this.cacheManager.invalidateByPrefix('navigation');
    // Navigation changes might affect categories too
    await this.cacheManager.invalidateByPrefix('categories');
  }

  /**
   * Invalidate category cache
   */
  private async invalidateCategory(categoryId?: string, parentCategoryId?: string): Promise<void> {
    // Invalidate all category listings
    await this.cacheManager.invalidateByPrefix('categories');
    
    // If specific category, also invalidate its products
    if (categoryId) {
      await this.cacheManager.invalidateByPrefix(`products:categoryId=${categoryId}`);
    }
    
    // If parent category changed, invalidate navigation
    if (parentCategoryId) {
      await this.invalidateNavigation();
    }
  }

  /**
   * Invalidate product cache
   */
  private async invalidateProduct(productId?: string, categoryId?: string): Promise<void> {
    // Invalidate specific product detail
    if (productId) {
      const productDetailKey = generateCacheKey('product_detail', { id: productId });
      await this.cacheManager.delete(productDetailKey);
    }
    
    // Invalidate product listings for the category
    if (categoryId) {
      await this.cacheManager.invalidateByPrefix(`products:categoryId=${categoryId}`);
    }
    
    // Invalidate general product listings
    await this.cacheManager.invalidateByPrefix('products');
  }

  /**
   * Invalidate all cache
   */
  private async invalidateAll(): Promise<void> {
    await Promise.all([
      this.cacheManager.invalidateByPrefix('navigation'),
      this.cacheManager.invalidateByPrefix('categories'),
      this.cacheManager.invalidateByPrefix('products'),
      this.cacheManager.invalidateByPrefix('product_detail'),
    ]);
  }

  /**
   * Scheduled cache cleanup (simplified for Cache API)
   */
  async cleanup(): Promise<void> {
    // Cache API automatically handles expiration based on TTL headers
    // No manual cleanup needed, but we can log the cleanup request
    console.log('Cache cleanup requested - Cache API handles expiration automatically');
    
    // If we wanted to force cleanup of specific entries, we could do:
    // const prefixes = ['navigation', 'categories', 'products', 'product_detail'];
    // But since Cache API handles TTL automatically, this is not necessary
  }
}

/**
 * Create cache invalidation webhook handler
 */
export function createInvalidationHandler(env: Env) {
  const invalidationService = new CacheInvalidationService(env);
  
  return async (request: Request): Promise<Response> => {
    try {
      // Verify request signature (implement HMAC verification)
      const signature = request.headers.get('X-Signature');
      if (!signature || !verifySignature(request, signature, env.SCRAPER_API_KEY)) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      const invalidationRequest: InvalidationRequest = await request.json();
      await invalidationService.invalidate(invalidationRequest);
      
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  };
}

/**
 * Verify HMAC signature for webhook security
 */
function verifySignature(request: Request, signature: string, secret: string): boolean {
  // Implement HMAC-SHA256 verification
  // This is a placeholder - implement actual signature verification
  return signature.startsWith('sha256=');
}