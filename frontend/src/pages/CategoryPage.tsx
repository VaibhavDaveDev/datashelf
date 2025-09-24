
// SIMPLIFIED: Basic category page - shows products in grid with simple Load More
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { ProductGrid } from '@/components/ui';
import { useProducts } from '@/hooks/useProducts';
import type { Product, PaginatedResponse } from '@/types';

export function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  const limit = 20;

  const { 
    data: productsData, 
    isLoading, 
    error
  } = useProducts(categoryId ? { 
    categoryId,
    limit,
    offset
  } : undefined);

  // Accumulate products when new data arrives
  React.useEffect(() => {
    if (productsData?.items) {
      if (offset === 0) {
        // First load - replace all products
        setAllProducts(productsData.items);
      } else {
        // Load more - append new products
        setAllProducts(prev => [...prev, ...productsData.items]);
      }
    }
  }, [productsData, offset]);

  // Reset when category changes
  React.useEffect(() => {
    setOffset(0);
    setAllProducts([]);
  }, [categoryId]);

  const handleProductClick = (product: Product) => {
    navigate(`/product/${product.id}`);
  };

  const handleLoadMore = () => {
    setOffset(prev => prev + limit);
  };

  // Calculate if there are more products to load
  const hasMore = productsData ? 
    (offset + limit) < productsData.total : 
    false;

  // Create combined data for ProductGrid
  const combinedData: PaginatedResponse<Product> | undefined = productsData ? {
    total: productsData.total,
    items: allProducts,
    pagination: productsData.pagination
  } : undefined;

  return (
    <Layout>
      <div className="spacing-mobile">
        <h1 className="text-responsive-3xl font-bold text-gray-900 mb-6 sm:mb-8">
          Products
        </h1>

        <ProductGrid
          data={combinedData}
          loading={isLoading}
          error={error}
          onProductClick={handleProductClick}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          emptyStateTitle="No products found in this category"
          emptyStateMessage="Try browsing different categories."
        />
      </div>
    </Layout>
  );
}