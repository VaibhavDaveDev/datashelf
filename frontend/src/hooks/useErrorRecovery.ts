import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Hook for handling error recovery and retry logic
 */
export function useErrorRecovery() {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  // Retry failed queries
  const retryFailedQueries = useCallback(() => {
    if (!isOnline) {
      return Promise.reject(new Error('Cannot retry while offline'));
    }

    // Retry all failed queries
    return queryClient.refetchQueries({
      type: 'all',
      stale: true,
    });
  }, [queryClient, isOnline]);

  // Clear all caches and refetch
  const clearAndRefetch = useCallback(() => {
    if (!isOnline) {
      return Promise.reject(new Error('Cannot refetch while offline'));
    }

    queryClient.clear();
    return queryClient.refetchQueries();
  }, [queryClient, isOnline]);

  // Invalidate specific query
  const invalidateQuery = useCallback((queryKey: any[]) => {
    return queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);

  // Prefetch query
  const prefetchQuery = useCallback((queryKey: any[], queryFn: () => Promise<any>, staleTime?: number) => {
    if (!isOnline) {
      return Promise.resolve();
    }

    return queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: staleTime || 5 * 60 * 1000,
    });
  }, [queryClient, isOnline]);

  // Get error message for display
  const getErrorMessage = useCallback((error: any): string => {
    if (!isOnline) {
      return 'You are currently offline. Please check your internet connection and try again.';
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error?.message) {
      return error.message;
    }

    if (error?.response?.data?.message) {
      return error.response.data.message;
    }

    if (error?.response?.status) {
      switch (error.response.status) {
        case 404:
          return 'The requested resource was not found.';
        case 429:
          return 'Too many requests. Please wait a moment and try again.';
        case 500:
          return 'Server error. Please try again in a few moments.';
        case 503:
          return 'Service temporarily unavailable. Please try again later.';
        default:
          return 'An unexpected error occurred. Please try again.';
      }
    }

    return 'An unexpected error occurred. Please try again.';
  }, [isOnline]);

  return {
    retryFailedQueries,
    clearAndRefetch,
    invalidateQuery,
    prefetchQuery,
    getErrorMessage,
    isOnline,
  };
}