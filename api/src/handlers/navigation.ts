import { Hono } from 'hono';
import type { NavigationResponse } from '@/types/api';
import type { Env } from '@/types/env';
import { createSupabaseClient } from '@/services/supabase';
import { errorResponse, swrResponse } from '@/utils/response';
import { CacheManager, getCacheConfig, generateCacheKey } from '@/utils/cache';
import { NotFoundError } from '@/middleware/error-handler';
import { createRevalidationTrigger } from '@/utils/revalidation-integration';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/navigation
 * Returns hierarchical navigation structure with stale-while-revalidate caching
 */
app.get('/', async (c) => {
  const env = c.env as Env;
  const cacheConfig = getCacheConfig(env);
  const cacheManager = new CacheManager();
  const cacheKey = generateCacheKey('navigation');

  try {
    // Create revalidation trigger
    const revalidationTrigger = createRevalidationTrigger(env);

    // Fetch data with stale-while-revalidate pattern
    const result = await cacheManager.getWithSWR(
      cacheKey,
      async () => {
        // Fetch from database with proper joins and performance optimization
        const supabase = createSupabaseClient(env);
        const { data: navigationData, error } = await supabase
          .from('navigation')
          .select('id, title, source_url, parent_id, last_scraped_at')
          .order('title');

        if (error) {
          console.error('Database error:', error);
          throw new Error('Failed to fetch navigation data');
        }

        if (!navigationData || navigationData.length === 0) {
          throw new NotFoundError('No navigation data found');
        }

        // Build hierarchical structure with proper typing
        const navigationMap = new Map<string, NavigationResponse>();
        const rootItems: NavigationResponse[] = [];

        // First pass: create all items
        navigationData.forEach((item) => {
          const navItem: NavigationResponse = {
            id: item.id,
            title: item.title,
            source_url: item.source_url,
            last_scraped_at: item.last_scraped_at,
          };
          navigationMap.set(item.id, navItem);
        });

        // Second pass: build hierarchy
        navigationData.forEach((item) => {
          const navItem = navigationMap.get(item.id)!;
          
          if (item.parent_id) {
            const parent = navigationMap.get(item.parent_id);
            if (parent) {
              if (!parent.children) parent.children = [];
              parent.children.push(navItem);
            }
          } else {
            rootItems.push(navItem);
          }
        });

        // Sort children recursively for consistent ordering
        const sortChildren = (items: NavigationResponse[]) => {
          items.sort((a, b) => a.title.localeCompare(b.title));
          items.forEach(item => {
            if (item.children && item.children.length > 0) {
              sortChildren(item.children);
            }
          });
        };
        sortChildren(rootItems);

        return rootItems;
      },
      cacheConfig.navigation,
      true,
      revalidationTrigger
    );

    // Add to cache index for invalidation
    if (!result.cached) {
      await cacheManager.addToIndex('navigation', cacheKey);
    }

    return swrResponse(c, result.data, cacheConfig.navigation, result.cached, result.stale);

  } catch (error) {
    if (error instanceof NotFoundError) {
      return errorResponse(c, 'Not Found', error.message, 404);
    }
    
    console.error('Navigation handler error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to fetch navigation data', 500);
  }
});

export { app as navigationRoutes };