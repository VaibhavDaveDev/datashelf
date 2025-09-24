import { QueryClient } from '@tanstack/react-query';

// Enhanced retry logic with exponential backoff
const retryDelay = (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000);

// Create a query client with enhanced options
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Don't retry on network errors if offline
        if (!navigator.onLine) {
          return false;
        }
        // Retry up to 3 times for server errors and network issues
        return failureCount < 3;
      },
      retryDelay,
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnReconnect: true, // Refetch when network reconnects
      refetchOnMount: true, // Refetch when component mounts
      // Background refetching for stale data
      refetchInterval: (query) => {
        // Only background refetch if data is stale and user is active
        const staleTime = 5 * 60 * 1000; // 5 minutes default
        if (query.state.dataUpdatedAt && Date.now() - query.state.dataUpdatedAt > staleTime) {
          return 30 * 1000; // Refetch every 30 seconds if stale
        }
        return false;
      },
      refetchIntervalInBackground: false, // Don't refetch when tab is not active
    },
    mutations: {
      retry: 2,
      retryDelay,
    },
  },
});

// Query key factories
export const queryKeys = {
  navigation: () => ['navigation'] as const,
  categories: (params?: Record<string, any>) => ['categories', params] as const,
  products: (params?: Record<string, any>) => ['products', params] as const,
  productDetail: (id: string) => ['product-detail', id] as const,
};