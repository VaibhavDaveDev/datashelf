import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/utils/api';

/**
 * Hook for managing cache operations
 */
export function useCacheManager() {
  const queryClient = useQueryClient();

  // Invalidate all navigation-related queries
  const invalidateNavigation = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: queryKeys.navigation() });
  }, [queryClient]);

  // Invalidate all category-related queries
  const invalidateCategories = useCallback((params?: Record<string, any>) => {
    if (params) {
      return queryClient.invalidateQueries({ queryKey: queryKeys.categories(params) });
    }
    return queryClient.invalidateQueries({ queryKey: ['categories'] });
  }, [queryClient]);

  // Invalidate all product-related queries
  const invalidateProducts = useCallback((params?: Record<string, any>) => {
    if (params) {
      return queryClient.invalidateQueries({ queryKey: queryKeys.products(params) });
    }
    return queryClient.invalidateQueries({ queryKey: ['products'] });
  }, [queryClient]);

  // Invalidate specific product detail
  const invalidateProductDetail = useCallback((productId: string) => {
    return queryClient.invalidateQueries({ queryKey: queryKeys.productDetail(productId) });
  }, [queryClient]);

  // Invalidate all queries
  const invalidateAll = useCallback(() => {
    return queryClient.invalidateQueries();
  }, [queryClient]);

  // Clear all cache
  const clearCache = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);

  // Get cache stats
  const getCacheStats = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const stats = {
      totalQueries: queries.length,
      staleQueries: queries.filter(q => q.isStale()).length,
      fetchingQueries: queries.filter(q => q.state.status === 'pending').length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      successQueries: queries.filter(q => q.state.status === 'success').length,
    };

    return stats;
  }, [queryClient]);

  // Prefetch navigation data
  const prefetchNavigation = useCallback(() => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.navigation(),
      staleTime: 60 * 60 * 1000, // 1 hour
    });
  }, [queryClient]);

  // Prefetch categories for a navigation item
  const prefetchCategories = useCallback((params?: Record<string, any>) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.categories(params),
      staleTime: 30 * 60 * 1000, // 30 minutes
    });
  }, [queryClient]);

  // Prefetch products for a category
  const prefetchProducts = useCallback((params?: Record<string, any>) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.products(params),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }, [queryClient]);

  // Prefetch product detail
  const prefetchProductDetail = useCallback((productId: string) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.productDetail(productId),
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  }, [queryClient]);

  return {
    // Invalidation methods
    invalidateNavigation,
    invalidateCategories,
    invalidateProducts,
    invalidateProductDetail,
    invalidateAll,
    
    // Cache management
    clearCache,
    getCacheStats,
    
    // Prefetching methods
    prefetchNavigation,
    prefetchCategories,
    prefetchProducts,
    prefetchProductDetail,
  };
}