import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { queryKeys } from '@/utils/api';
import { useOnlineStatus } from './useOnlineStatus';

export function useNavigation() {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: queryKeys.navigation(),
    queryFn: async () => {
      try {
        return await apiService.getNavigation();
      } catch (error: any) {
        // Enhanced error handling
        if (!isOnline) {
          throw new Error('You are currently offline. Please check your internet connection.');
        }
        
        if (error?.response?.status === 404) {
          throw new Error('Navigation data not found. Please try again later.');
        }
        
        if (error?.response?.status >= 500) {
          throw new Error('Server error. Please try again in a few moments.');
        }
        
        throw error;
      }
    },
    staleTime: 60 * 60 * 1000, // 1 hour - navigation doesn't change often

  });
}