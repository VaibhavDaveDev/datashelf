import { Loader2, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface LoadingStateProps {
  message?: string;
  showRetry?: boolean;
  onRetry?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'skeleton' | 'pulse';
}

export function LoadingState({ 
  message = 'Loading...', 
  showRetry = false,
  onRetry,
  size = 'md',
  variant = 'spinner'
}: LoadingStateProps) {
  const isOnline = useOnlineStatus();

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6 sm:h-8 sm:w-8',
    lg: 'h-8 w-8 sm:h-12 sm:w-12',
  };

  const textSizeClasses = {
    sm: 'text-responsive-xs',
    md: 'text-responsive-sm',
    lg: 'text-responsive-base',
  };

  if (variant === 'skeleton') {
    return (
      <div className="animate-pulse">
        <div className="space-y-3 sm:space-y-4">
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className="flex items-center justify-center p-6 sm:p-8">
        <div className="animate-pulse">
          <div className={`${sizeClasses[size]} bg-primary-200 rounded-full`}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-8 text-center">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary-600 mb-4`} />
      
      <p className={`text-gray-600 mb-4 ${textSizeClasses[size]} px-4`}>
        {message}
      </p>

      {!isOnline && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg max-w-sm mx-auto">
          <p className="text-responsive-xs text-yellow-800">
            You appear to be offline. Content may be limited.
          </p>
        </div>
      )}

      {showRetry && onRetry && (
        <button
          onClick={onRetry}
          disabled={!isOnline}
          className="flex items-center touch-target px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-responsive-sm"
          aria-label="Retry loading content"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </button>
      )}
    </div>
  );
}

// Mobile-responsive skeleton components for specific use cases
export function ProductCardSkeleton() {
  return (
    <div className="card-mobile padding-mobile animate-pulse">
      <div className="bg-gray-200 img-aspect-square rounded-lg mb-4"></div>
      <div className="space-y-2">
        <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-2 sm:h-3 bg-gray-200 rounded w-1/3"></div>
      </div>
    </div>
  );
}

export function CategoryCardSkeleton() {
  return (
    <div className="card-mobile padding-mobile animate-pulse">
      <div className="h-5 sm:h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="animate-pulse spacing-mobile">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <div className="space-y-4">
          <div className="bg-gray-200 h-64 sm:h-80 lg:h-96 rounded-lg"></div>
          <div className="flex space-x-2 overflow-x-auto pb-2">
            <div className="bg-gray-200 h-12 w-12 sm:h-16 sm:w-16 rounded flex-shrink-0"></div>
            <div className="bg-gray-200 h-12 w-12 sm:h-16 sm:w-16 rounded flex-shrink-0"></div>
            <div className="bg-gray-200 h-12 w-12 sm:h-16 sm:w-16 rounded flex-shrink-0"></div>
          </div>
        </div>
        <div className="spacing-mobile">
          <div className="h-6 sm:h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2 mb-6">
            <div className="h-3 sm:h-4 bg-gray-200 rounded"></div>
            <div className="h-3 sm:h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 sm:h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
          <div className="space-y-3">
            <div className="h-10 sm:h-12 bg-gray-200 rounded"></div>
            <div className="h-10 sm:h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}