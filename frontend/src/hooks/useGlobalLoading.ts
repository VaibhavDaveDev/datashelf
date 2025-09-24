import { useIsFetching, useIsMutating } from '@tanstack/react-query';

/**
 * Hook to track global loading state across all queries and mutations
 */
export function useGlobalLoading() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();

  const isLoading = isFetching > 0 || isMutating > 0;
  const fetchingCount = isFetching;
  const mutatingCount = isMutating;

  return {
    isLoading,
    isFetching: isFetching > 0,
    isMutating: isMutating > 0,
    fetchingCount,
    mutatingCount,
  };
}