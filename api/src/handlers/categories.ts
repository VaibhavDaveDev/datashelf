import { Hono } from 'hono';
import type { Env } from '@/types/env';
import type { CategoriesResponse, CategoriesQuery } from '@/types/api';
import { createSupabaseClient } from '@/services/supabase';
import { errorResponse, swrResponse } from '@/utils/response';
import { CacheManager, getCacheConfig, generateCacheKey } from '@/utils/cache';
import { validateQuery, categoriesQuerySchema } from '@/utils/validation';
import { NotFoundError, ValidationError } from '@/middleware/error-handler';
import { createRevalidationTrigger } from '@/utils/revalidation-integration';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/categories
 * Returns categories with optional filtering by navigation ID or parent ID
 * Query parameters: navId, parentId, limit, offset
 */
app.get('/', async (c) => {
  const env = c.env as Env;
  const cacheConfig = getCacheConfig(env);
  const cacheManager = new CacheManager();

  try {
    // Validate query parameters
    const queryResult = validateQuery(categoriesQuerySchema, c.req.query());
    if (!queryResult.success) {
      throw new ValidationError(queryResult.error);
    }

    const query: CategoriesQuery = queryResult.data;
    const cacheKey = generateCacheKey('categories', query);

    // Create revalidation trigger
    const revalidationTrigger = createRevalidationTrigger(env);

    // Fetch data with stale-while-revalidate pattern
    const result = await cacheManager.getWithSWR(
      cacheKey,
      async () => {
        // Build database query with proper joins and performance optimization
        const supabase = createSupabaseClient(env);
        let dbQuery = supabase
          .from('category')
          .select(`
            id, 
            title, 
            product_count, 
            last_scraped_at,
            navigation_id,
            navigation:navigation_id (
              id,
              title,
              parent_id
            )
          `, { count: 'exact' });

        // Apply filters with proper validation
        if (query.navId) {
          // Validate UUID format for navId
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.navId)) {
            throw new ValidationError('Invalid navigation ID format');
          }
          dbQuery = dbQuery.eq('navigation_id', query.navId);
        }

        // Handle parentId filtering through navigation hierarchy
        if (query.parentId) {
          // Validate UUID format for parentId
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.parentId)) {
            throw new ValidationError('Invalid parent ID format');
          }
          
          // First, find all navigation items that have the specified parent
          const { data: childNavItems, error: navError } = await supabase
            .from('navigation')
            .select('id')
            .eq('parent_id', query.parentId);

          if (navError) {
            console.error('Navigation query error:', navError);
            throw new Error('Failed to fetch navigation hierarchy');
          }

          if (childNavItems && childNavItems.length > 0) {
            const childNavIds = childNavItems.map(item => item.id);
            dbQuery = dbQuery.in('navigation_id', childNavIds);
          } else {
            // No child navigation items found, return empty result
            return {
              total: 0,
              items: [],
            };
          }
        }
        
        // Apply pagination and ordering with proper defaults
        const limit = query.limit || 20;
        const offset = query.offset || 0;
        
        dbQuery = dbQuery
          .order('title')
          .range(offset, offset + limit - 1);

        const { data: categoriesData, error, count } = await dbQuery;

        if (error) {
          console.error('Database error:', error);
          throw new Error('Failed to fetch categories');
        }

        // Handle empty results gracefully
        if (!categoriesData || categoriesData.length === 0) {
          return {
            total: count || 0,
            items: [],
          };
        }

        // Format response with proper typing
        const response: CategoriesResponse = {
          total: count || 0,
          items: categoriesData.map((category) => ({
            id: category.id,
            title: category.title,
            product_count: category.product_count || 0,
            last_scraped_at: category.last_scraped_at,
          })),
        };

        return response;
      },
      cacheConfig.categories,
      true,
      revalidationTrigger
    );

    // Add to cache index for invalidation
    if (!result.cached) {
      await cacheManager.addToIndex('categories', cacheKey);
    }

    return swrResponse(c, result.data, cacheConfig.categories, result.cached, result.stale);

  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(c, 'Validation Error', error.message, 400);
    }
    
    if (error instanceof NotFoundError) {
      return errorResponse(c, 'Not Found', error.message, 404);
    }
    
    console.error('Categories handler error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to fetch categories', 500);
  }
});

/**
 * GET /api/categories/:id
 * Returns a specific category by ID with enhanced error handling
 */
app.get('/:id', async (c) => {
  const env = c.env as Env;
  const cacheConfig = getCacheConfig(env);
  const cacheManager = new CacheManager();

  try {
    const categoryId = c.req.param('id');
    
    // Validate UUID format with proper error message
    if (!categoryId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(categoryId)) {
      throw new ValidationError('Invalid category ID format. Expected a valid UUID.');
    }

    const cacheKey = generateCacheKey('category', { id: categoryId });

    // Create revalidation trigger
    const revalidationTrigger = createRevalidationTrigger(env);

    // Fetch data with stale-while-revalidate pattern
    const result = await cacheManager.getWithSWR(
      cacheKey,
      async () => {
        // Fetch from database with enhanced query
        const supabase = createSupabaseClient(env);
        const { data: categoryData, error } = await supabase
          .from('category')
          .select(`
            id, 
            title, 
            product_count, 
            last_scraped_at,
            navigation_id,
            navigation:navigation_id (
              id,
              title
            )
          `)
          .eq('id', categoryId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned
            throw new NotFoundError(`Category with ID ${categoryId} not found`);
          }
          console.error('Database error:', error);
          throw new Error('Failed to fetch category');
        }

        if (!categoryData) {
          throw new NotFoundError(`Category with ID ${categoryId} not found`);
        }

        // Format response with proper typing
        const category = {
          id: categoryData.id,
          title: categoryData.title,
          product_count: categoryData.product_count || 0,
          last_scraped_at: categoryData.last_scraped_at,
        };

        return category;
      },
      cacheConfig.categories,
      true,
      revalidationTrigger
    );

    // Add to cache index for invalidation
    if (!result.cached) {
      await cacheManager.addToIndex('categories', cacheKey);
    }

    return swrResponse(c, result.data, cacheConfig.categories, result.cached, result.stale);

  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(c, 'Validation Error', error.message, 400);
    }
    
    if (error instanceof NotFoundError) {
      return errorResponse(c, 'Not Found', error.message, 404);
    }
    
    console.error('Category detail handler error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to fetch category', 500);
  }
});

export { app as categoriesRoutes };