import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { queryKeys } from '@/utils/api';
import { useOnlineStatus } from './useOnlineStatus';

export function useProductDetail(productId: string) {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: queryKeys.productDetail(productId),
    queryFn: async () => {
      try {
        return await apiService.getProductDetail(productId);
      } catch (error: any) {
        // Enhanced error handling
        if (!isOnline) {
          throw new Error('You are currently offline. Please check your internet connection.');
        }
        
        if (error?.response?.status === 404) {
          throw new Error('Product not found. It may have been removed or the link is invalid.');
        }
        
        if (error?.response?.status >= 500) {
          throw new Error('Server error. Please try again in a few moments.');
        }
        
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - product details should be fresh
    enabled: !!productId, // Only run query if productId is provided
    // Background refetch for product details
    refetchInterval: (query) => {
      if (!isOnline) return false;
      if (query.state.dataUpdatedAt && Date.now() - query.state.dataUpdatedAt > 2 * 60 * 1000) {
        return 60 * 1000; // Refetch every minute if stale
      }
      return false;
    },
  });
}