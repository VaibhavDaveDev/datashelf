
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorMessageProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-6 text-center', className)}>
      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-secondary-900 mb-2">{title}</h3>
      <p className="text-secondary-600 mb-4 max-w-md">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="inline-flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
}