
// SIMPLIFIED: Basic home page - just list categories from API
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { CategoryCard } from '@/components/ui';
import { LoadingState, CategoryCardSkeleton } from '@/components/common';
import { useCategories, useErrorRecovery, useOnlineStatus } from '@/hooks';

export function HomePage() {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { getErrorMessage, retryFailedQueries } = useErrorRecovery();
  
  // Fetch all categories
  const { 
    data: categoriesData, 
    isLoading, 
    error, 
    refetch,
    isRefetching 
  } = useCategories();

  const handleCategorySelect = (categoryId: string) => {
    navigate(`/category/${categoryId}`);
  };

  const handleRetry = async () => {
    try {
      await refetch();
      await retryFailedQueries();
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="spacing-mobile">
          <h1 className="text-responsive-3xl font-bold text-gray-900 mb-6 sm:mb-8">
            Browse Categories
          </h1>
          
          <div className="grid-responsive-categories">
            {Array.from({ length: 8 }).map((_, index) => (
              <CategoryCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="spacing-mobile">
          <div className="text-center py-8 sm:py-12">
            <div className="text-4xl sm:text-6xl mb-4" role="img" aria-label="Books">📚</div>
            <h2 className="text-responsive-xl font-bold text-gray-900 mb-2">
              Unable to Load Categories
            </h2>
            <p className="text-responsive-sm text-gray-600 mb-6 max-w-md mx-auto px-4">
              {getErrorMessage(error)}
            </p>
            
            <LoadingState
              message={isRefetching ? "Retrying..." : ""}
              showRetry={!isRefetching}
              onRetry={handleRetry}
              size="md"
              variant={isRefetching ? "spinner" : "pulse"}
            />

            {!isOnline && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md mx-auto mx-4">
                <p className="text-responsive-xs text-yellow-800">
                  You appear to be offline. Please check your internet connection and try again.
                </p>
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="spacing-mobile">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
          <h1 className="text-responsive-3xl font-bold text-gray-900">
            Browse Categories
          </h1>
          
          {/* Show refresh indicator if refetching in background */}
          {isRefetching && (
            <div className="flex items-center text-responsive-xs text-gray-500">
              <div className="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full mr-2"></div>
              <span>Updating...</span>
            </div>
          )}
        </div>

        <div className="grid-responsive-categories">
          {categoriesData?.items.map((category) => (
            <CategoryCard
              key={category.id}
              title={category.title}
              productCount={category.product_count}
              onClick={() => handleCategorySelect(category.id)}
            />
          ))}
        </div>

        {categoriesData?.items.length === 0 && (
          <div className="text-center py-8 sm:py-12">
            <div className="text-4xl sm:text-6xl mb-4" role="img" aria-label="Folder">📂</div>
            <h2 className="text-responsive-lg font-semibold text-gray-900 mb-2">
              No Categories Available
            </h2>
            <p className="text-responsive-sm text-gray-500 mb-4 px-4">
              Categories will appear here once they're available.
            </p>
            <button
              onClick={handleRetry}
              className="touch-target px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 transition-colors font-medium"
              aria-label="Refresh categories"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}