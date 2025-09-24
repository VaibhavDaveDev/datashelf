import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

interface ErrorMessageProps {
  title?: string;
  message: string;
  variant?: 'error' | 'warning' | 'info';
  className?: string;
}

export function ErrorMessage({ 
  title = 'Something went wrong', 
  message, 
  variant = 'error',
  className 
}: ErrorMessageProps) {
  const variantClasses = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconClasses = {
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };

  return (
    <div className={cn(
      'rounded-lg border p-4 flex items-start space-x-3',
      variantClasses[variant],
      className
    )}>
      <AlertTriangle className={cn('h-5 w-5 mt-0.5 flex-shrink-0', iconClasses[variant])} />
      <div className="flex-1">
        <h3 className="font-medium">{title}</h3>
        <p className="mt-1 text-sm opacity-90">{message}</p>
      </div>
    </div>
  );
}

interface ErrorPageProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  onGoBack?: () => void;
  showRetry?: boolean;
  showHome?: boolean;
  showBack?: boolean;
  className?: string;
}

export function ErrorPage({
  title = 'Oops! Something went wrong',
  message = 'We encountered an unexpected error. Please try again or contact support if the problem persists.',
  onRetry,
  onGoHome,
  onGoBack,
  showRetry = true,
  showHome = true,
  showBack = false,
  className
}: ErrorPageProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center min-h-64 text-center space-y-6 p-8', className)}>
      <div className="flex flex-col items-center space-y-4">
        <div className="rounded-full bg-red-100 p-4">
          <AlertTriangle className="h-12 w-12 text-red-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-secondary-900">{title}</h1>
          <p className="text-secondary-600 max-w-md">{message}</p>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-3 justify-center">
        {showRetry && onRetry && (
          <Button onClick={onRetry} variant="primary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
        {showBack && onGoBack && (
          <Button onClick={onGoBack} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        )}
        {showHome && onGoHome && (
          <Button onClick={onGoHome} variant="ghost">
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        )}
      </div>
    </div>
  );
}

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  dismissible?: boolean;
  className?: string;
}

export function ErrorBanner({ 
  message, 
  onDismiss, 
  onRetry, 
  dismissible = true, 
  className 
}: ErrorBannerProps) {
  return (
    <div className={cn(
      'bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between',
      className
    )}>
      <div className="flex items-center space-x-3">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
        <p className="text-red-800 text-sm">{message}</p>
      </div>
      
      <div className="flex items-center space-x-2">
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-500 hover:text-red-700 p-1"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  className?: string;
}

export function ErrorFallback({ error, resetError, className }: ErrorFallbackProps) {
  return (
    <div className={cn('rounded-lg border border-red-200 bg-red-50 p-6', className)}>
      <div className="flex items-start space-x-3">
        <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-red-900 mb-2">
            Something went wrong
          </h2>
          <details className="mb-4">
            <summary className="cursor-pointer text-sm text-red-700 hover:text-red-900">
              Error details
            </summary>
            <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto">
              {error.message}
            </pre>
          </details>
          <Button onClick={resetError} size="sm" variant="outline">
            <RefreshCw className="h-3 w-3 mr-2" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}