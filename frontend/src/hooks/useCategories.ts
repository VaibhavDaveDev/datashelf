import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { queryKeys } from '@/utils/api';
import { useOnlineStatus } from './useOnlineStatus';

interface UseCategoriesParams {
  navId?: string;
  parentId?: string;
  limit?: number;
  offset?: number;
}

export function useCategories(params?: UseCategoriesParams) {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: queryKeys.categories(params),
    queryFn: async () => {
      try {
        return await apiService.getCategories(params);
      } catch (error: any) {
        // Enhanced error handling
        if (!isOnline) {
          throw new Error('You are currently offline. Please check your internet connection.');
        }
        
        if (error?.response?.status === 404) {
          throw new Error('Categories not found. Please try again later.');
        }
        
        if (error?.response?.status >= 500) {
          throw new Error('Server error. Please try again in a few moments.');
        }
        
        throw error;
      }
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    enabled: true,
    // Background refetch when data becomes stale
    refetchInterval: (query) => {
      if (!isOnline) return false;
      if (query.state.dataUpdatedAt && Date.now() - query.state.dataUpdatedAt > 30 * 60 * 1000) {
        return 5 * 60 * 1000; // Refetch every 5 minutes if stale
      }
      return false;
    },
  });
}