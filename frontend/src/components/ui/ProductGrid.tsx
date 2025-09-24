
// SIMPLIFIED: Basic product grid - no complex features
import { cn } from '@/utils/cn';
import { Button } from './Button';
import { trackProductClick } from '@/utils/analytics';
import type { Product, PaginatedResponse } from '@/types';

interface ProductGridProps {
  data?: PaginatedResponse<Product> | undefined;
  loading?: boolean;
  error?: Error | null;
  onProductClick?: (product: Product) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
  emptyStateTitle?: string;
  emptyStateMessage?: string;
}

export function ProductGrid({
  data,
  loading = false,
  error = null,
  onProductClick,
  onLoadMore,
  hasMore = false,
  className,
  emptyStateTitle = 'No products found',
  emptyStateMessage = 'Try browsing different categories.',
}: ProductGridProps) {
  const products = data?.items || [];

  // Loading state
  if (loading && !data) {
    return (
      <div className={cn('spacing-mobile', className)}>
        <div className="grid-responsive-products">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="card-mobile padding-mobile animate-pulse">
              <div className="img-aspect-square bg-gray-200 rounded-lg mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className={cn('text-center py-8 sm:py-12', className)}>
        <div className="text-4xl sm:text-6xl mb-4" role="img" aria-label="Error">⚠️</div>
        <p className="text-responsive-sm text-red-600 mb-4 px-4">Failed to load products</p>
        <Button 
          onClick={() => window.location.reload()}
          className="touch-target"
          aria-label="Retry loading products"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('spacing-mobile', className)}>
      {/* Mobile-responsive product grid */}
      {products.length > 0 ? (
        <>
          <div className="grid-responsive-products">
            {products.map((product) => (
              <div
                key={product.id}
                className="card-mobile padding-mobile cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                onClick={() => {
                  trackProductClick(product.id, products.indexOf(product));
                  onProductClick?.(product);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    trackProductClick(product.id, products.indexOf(product));
                    onProductClick?.(product);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${product.title}${product.price ? ` - ${product.currency || 'GBP'} ${product.price.toFixed(2)}` : ''}`}
              >
                {/* Product Image */}
                <div className="img-aspect-square mb-4 overflow-hidden rounded-lg bg-gray-100">
                  <img
                    src={product.thumbnail}
                    alt=""
                    className="img-responsive"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-book.svg';
                    }}
                  />
                </div>
                
                {/* Product Info */}
                <div className="space-y-2">
                  <h3 className="text-responsive-sm font-medium text-gray-900 line-clamp-2">
                    {product.title}
                  </h3>
                  
                  {product.price !== undefined ? (
                    <p className="text-responsive-base font-bold text-primary-600">
                      {product.currency || 'GBP'} {product.price.toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-responsive-xs text-gray-500">Price not available</p>
                  )}
                  
                  {/* Availability indicator */}
                  {product.available !== undefined && (
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${product.available ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-responsive-xs text-gray-500">
                        {product.available ? 'Available' : 'Out of stock'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Mobile-optimized Load More button */}
          {hasMore && onLoadMore && (
            <div className="text-center pt-6">
              <Button
                onClick={onLoadMore}
                disabled={loading}
                className="touch-target px-8 py-3"
                size="lg"
                aria-label={loading ? 'Loading more products' : 'Load more products'}
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        /* Empty state */
        <div className="text-center py-8 sm:py-12">
          <div className="text-4xl sm:text-6xl mb-4" role="img" aria-label="Empty">📭</div>
          <h3 className="text-responsive-lg font-medium text-gray-900 mb-2">
            {emptyStateTitle}
          </h3>
          <p className="text-responsive-sm text-gray-600 px-4">
            {emptyStateMessage}
          </p>
        </div>
      )}
    </div>
  );
}