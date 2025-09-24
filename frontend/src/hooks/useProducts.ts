import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { queryKeys } from '@/utils/api';
import { useOnlineStatus } from './useOnlineStatus';
import type { SortOption } from '@/types';

interface UseProductsParams {
  categoryId?: string;
  limit?: number;
  offset?: number;
  sort?: SortOption;
}

export function useProducts(params?: UseProductsParams) {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: queryKeys.products(params),
    queryFn: async () => {
      try {
        return await apiService.getProducts(params);
      } catch (error: any) {
        // Enhanced error handling
        if (!isOnline) {
          throw new Error('You are currently offline. Please check your internet connection.');
        }
        
        if (error?.response?.status === 404) {
          throw new Error('Products not found for this category.');
        }
        
        if (error?.response?.status >= 500) {
          throw new Error('Server error. Please try again in a few moments.');
        }
        
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - product data changes more frequently
    enabled: !!params, // Only enabled when params are provided
    // More aggressive background refetching for product data
    refetchInterval: (query) => {
      if (!isOnline) return false;
      if (query.state.dataUpdatedAt && Date.now() - query.state.dataUpdatedAt > 5 * 60 * 1000) {
        return 2 * 60 * 1000; // Refetch every 2 minutes if stale
      }
      return false;
    },
  });
}