import { Hono } from 'hono';
import type { Env } from '@/types/env';
import type { ProductsResponse, ProductDetailResponse, ProductsQuery } from '@/types/api';
import { createSupabaseClient } from '@/services/supabase';
import { errorResponse, swrResponse } from '@/utils/response';
import { CacheManager, getCacheConfig, generateCacheKey } from '@/utils/cache';
import { validateQuery, productsQuerySchema, calculatePagination, isValidUUID } from '@/utils/validation';
import { NotFoundError, ValidationError } from '@/middleware/error-handler';
import { createRevalidationTrigger } from '@/utils/revalidation-integration';

// Database types for products
interface ProductRow {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  image_urls: string[] | null;
  available: boolean;
  summary: string | null;
  specs: Record<string, any> | null;
  source_url: string;
  last_scraped_at: string;
  created_at: string;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/products
 * Returns paginated products with optional filtering and sorting
 * Query parameters: categoryId, limit, offset, sort
 */
app.get('/', async (c) => {
  const env = c.env as Env;
  const cacheConfig = getCacheConfig(env);
  const cacheManager = new CacheManager();

  try {
    // Validate query parameters
    const queryResult = validateQuery(productsQuerySchema, c.req.query());
    if (!queryResult.success) {
      throw new ValidationError(queryResult.error);
    }

    const query: ProductsQuery = queryResult.data;
    const cacheKey = generateCacheKey('products', query);

    // Create revalidation trigger
    const revalidationTrigger = createRevalidationTrigger(env);

    // Fetch data with stale-while-revalidate pattern
    const result = await cacheManager.getWithSWR(
      cacheKey,
      async () => {
        // Build database query with proper indexing for performance
        const supabase = createSupabaseClient(env);
        let dbQuery = supabase
          .from('product')
          .select('id, title, price, currency, image_urls, available, created_at', { count: 'exact' });

        // Apply category filter with proper validation
        if (query.categoryId) {
          if (!isValidUUID(query.categoryId)) {
            throw new ValidationError('Invalid category ID format');
          }
          dbQuery = dbQuery.eq('category_id', query.categoryId);
        }

        // Apply sorting with proper null handling
        switch (query.sort) {
          case 'price_asc':
            dbQuery = dbQuery.order('price', { ascending: true, nullsFirst: false });
            break;
          case 'price_desc':
            dbQuery = dbQuery.order('price', { ascending: false, nullsFirst: false });
            break;
          case 'title_asc':
            dbQuery = dbQuery.order('title', { ascending: true });
            break;
          case 'title_desc':
            dbQuery = dbQuery.order('title', { ascending: false });
            break;
          case 'created_at_desc':
          default:
            dbQuery = dbQuery.order('created_at', { ascending: false });
            break;
        }

        // Apply pagination with proper defaults
        const limit = query.limit ?? 20;
        const offset = query.offset ?? 0;
        dbQuery = dbQuery.range(offset, offset + limit - 1);

        const { data: productsData, error, count } = await dbQuery;

        if (error) {
          console.error('Database error:', error);
          throw new Error('Failed to fetch products');
        }

        // Handle empty results gracefully
        if (!productsData || productsData.length === 0) {
          return {
            total: count || 0,
            items: [],
            pagination: calculatePagination(count || 0, limit, offset),
          };
        }

        // Format response with proper image URL processing
        const response: ProductsResponse = {
          total: count || 0,
          items: productsData.map((product: ProductRow) => ({
            id: product.id,
            title: product.title,
            price: product.price ?? undefined,
            currency: product.currency ?? undefined,
            thumbnail: product.image_urls && product.image_urls.length > 0 
              ? product.image_urls[0] 
              : '',
            available: product.available,
          })),
          pagination: calculatePagination(count || 0, limit, offset),
        };

        return response;
      },
      cacheConfig.products,
      true,
      revalidationTrigger
    );

    // Add to cache index for invalidation
    if (!result.cached) {
      await cacheManager.addToIndex('products', cacheKey);
    }

    return swrResponse(c, result.data, cacheConfig.products, result.cached, result.stale);

  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(c, 'Validation Error', error.message, 400);
    }
    
    if (error instanceof NotFoundError) {
      return errorResponse(c, 'Not Found', error.message, 404);
    }
    
    console.error('Products handler error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to fetch products', 500);
  }
});

/**
 * GET /api/products/:id
 * Returns detailed product information with comprehensive error handling
 */
app.get('/:id', async (c) => {
  const env = c.env as Env;
  const cacheConfig = getCacheConfig(env);
  const cacheManager = new CacheManager();

  try {
    const productId = c.req.param('id');
    
    // Validate UUID format with proper error message
    if (!productId || !isValidUUID(productId)) {
      throw new ValidationError('Invalid product ID format. Expected a valid UUID.');
    }

    const cacheKey = generateCacheKey('product_detail', { id: productId });

    // Create revalidation trigger
    const revalidationTrigger = createRevalidationTrigger(env);

    // Fetch data with stale-while-revalidate pattern
    const result = await cacheManager.getWithSWR(
      cacheKey,
      async () => {
        // Fetch from database with enhanced query
        const supabase = createSupabaseClient(env);
        const { data: productData, error } = await supabase
          .from('product')
          .select(`
            id,
            title,
            price,
            currency,
            image_urls,
            summary,
            specs,
            source_url,
            last_scraped_at,
            available,
            category_id,
            category:category_id (
              id,
              title
            )
          `)
          .eq('id', productId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned
            throw new NotFoundError(`Product with ID ${productId} not found`);
          }
          console.error('Database error:', error);
          throw new Error('Failed to fetch product');
        }

        if (!productData) {
          throw new NotFoundError(`Product with ID ${productId} not found`);
        }

        // Format response with proper image URL processing to serve R2 URLs correctly
        const product: ProductDetailResponse = {
          id: productData.id,
          title: productData.title,
          price: productData.price ?? undefined,
          currency: productData.currency ?? undefined,
          image_urls: productData.image_urls || [],
          summary: productData.summary ?? undefined,
          specs: productData.specs || {},
          source_url: productData.source_url,
          last_scraped_at: productData.last_scraped_at,
        };

        return product;
      },
      cacheConfig.productDetail,
      true,
      revalidationTrigger
    );

    // Add to cache index for invalidation
    if (!result.cached) {
      await cacheManager.addToIndex('product_detail', cacheKey);
    }

    return swrResponse(c, result.data, cacheConfig.productDetail, result.cached, result.stale);

  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(c, 'Validation Error', error.message, 400);
    }
    
    if (error instanceof NotFoundError) {
      return errorResponse(c, 'Not Found', error.message, 404);
    }
    
    console.error('Product detail handler error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to fetch product', 500);
  }
});

export { app as productsRoutes };