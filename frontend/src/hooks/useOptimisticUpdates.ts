import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/utils/api';
import type { Product, ProductDetail, Category } from '@/types';

/**
 * Hook for handling optimistic updates
 */
export function useOptimisticUpdates() {
  const queryClient = useQueryClient();

  // Optimistic update for product availability
  const updateProductAvailability = useMutation({
    mutationFn: async ({ productId, available }: { productId: string; available: boolean }) => {
      // This would be an actual API call in a real app
      // For now, we'll simulate the update
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { productId, available };
    },
    onMutate: async ({ productId, available }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.productDetail(productId) });

      // Snapshot the previous value
      const previousProduct = queryClient.getQueryData<ProductDetail>(queryKeys.productDetail(productId));

      // Optimistically update the cache
      if (previousProduct) {
        queryClient.setQueryData<ProductDetail>(queryKeys.productDetail(productId), {
          ...previousProduct,
          available,
        });

        // Also update in product lists
        queryClient.setQueriesData<any>(
          { queryKey: ['products'] },
          (oldData: any) => {
            if (!oldData?.items) return oldData;
            return {
              ...oldData,
              items: oldData.items.map((product: Product) =>
                product.id === productId ? { ...product, available } : product
              ),
            };
          }
        );
      }

      return { previousProduct };
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousProduct) {
        queryClient.setQueryData(queryKeys.productDetail(variables.productId), context.previousProduct);
      }
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.productDetail(variables.productId) });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  // Optimistic update for category product count
  const updateCategoryProductCount = useMutation({
    mutationFn: async ({ categoryId, count }: { categoryId: string; count: number }) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      return { categoryId, count };
    },
    onMutate: async ({ categoryId, count }) => {
      await queryClient.cancelQueries({ queryKey: ['categories'] });

      const previousData = queryClient.getQueriesData({ queryKey: ['categories'] });

      // Update all category queries
      queryClient.setQueriesData<any>(
        { queryKey: ['categories'] },
        (oldData: any) => {
          if (!oldData?.items) return oldData;
          return {
            ...oldData,
            items: oldData.items.map((category: Category) =>
              category.id === categoryId ? { ...category, product_count: count } : category
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Rollback all category queries
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  return {
    updateProductAvailability,
    updateCategoryProductCount,
  };
}