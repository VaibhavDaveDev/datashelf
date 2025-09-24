import { cn } from '@/utils/cn';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  return (
    <svg
      className={cn(
        'animate-spin text-primary-600',
        sizeClasses[size],
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

interface LoadingDotsProps {
  className?: string;
}

export function LoadingDots({ className }: LoadingDotsProps) {
  return (
    <div className={cn('flex space-x-1', className)}>
      <div className="h-2 w-2 bg-primary-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="h-2 w-2 bg-primary-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="h-2 w-2 bg-primary-600 rounded-full animate-bounce"></div>
    </div>
  );
}

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
}

export function LoadingSkeleton({ className, lines = 1 }: LoadingSkeletonProps) {
  return (
    <div className={cn('animate-pulse', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'bg-secondary-200 rounded',
            index === 0 ? 'h-4' : 'h-3 mt-2',
            index === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  );
}

interface LoadingCardSkeletonProps {
  className?: string;
}

export function LoadingCardSkeleton({ className }: LoadingCardSkeletonProps) {
  return (
    <div className={cn('animate-pulse bg-white rounded-lg border border-secondary-200 p-4', className)}>
      <div className="aspect-square bg-secondary-200 rounded-lg mb-4"></div>
      <div className="space-y-2">
        <div className="h-4 bg-secondary-200 rounded w-3/4"></div>
        <div className="h-3 bg-secondary-200 rounded w-1/2"></div>
        <div className="h-4 bg-secondary-200 rounded w-1/4"></div>
      </div>
    </div>
  );
}

interface LoadingPageProps {
  message?: string;
  className?: string;
}

export function LoadingPage({ message = 'Loading...', className }: LoadingPageProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center min-h-64 space-y-4', className)}>
      <LoadingSpinner size="xl" />
      <p className="text-secondary-600 text-lg">{message}</p>
    </div>
  );
}

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  className?: string;
}

export function LoadingOverlay({ isVisible, message = 'Loading...', className }: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className={cn(
      'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
      className
    )}>
      <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-secondary-700">{message}</p>
      </div>
    </div>
  );
}

// Simple Loading component for general use
interface LoadingProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Loading({ text = 'Loading...', size = 'md', className }: LoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center space-y-2', className)}>
      <LoadingSpinner size={size} />
      <p className="text-secondary-600 text-sm">{text}</p>
    </div>
  );
}