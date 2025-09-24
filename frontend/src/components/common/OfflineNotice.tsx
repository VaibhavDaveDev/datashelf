import { useEffect, useState } from 'react';
import { WifiOff, Wifi, AlertCircle } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useErrorRecovery } from '@/hooks/useErrorRecovery';

export function OfflineNotice() {
  const isOnline = useOnlineStatus();
  const { retryFailedQueries } = useErrorRecovery();
  const [showNotice, setShowNotice] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowNotice(true);
      setWasOffline(true);
    } else if (wasOffline && isOnline) {
      // Just came back online
      setShowNotice(true);
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setShowNotice(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOnline, wasOffline]);

  const handleRetry = async () => {
    if (!isOnline) return;
    
    setIsRetrying(true);
    try {
      await retryFailedQueries();
    } catch (error) {
      console.error('Failed to retry queries:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDismiss = () => {
    setShowNotice(false);
    setWasOffline(false);
  };

  if (!showNotice) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className={`px-4 py-3 text-white text-center transition-colors ${
        isOnline ? 'bg-green-600' : 'bg-red-600'
      }`}>
        <div className="flex items-center justify-center space-x-2">
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4" />
              <span>Back online!</span>
              {wasOffline && (
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="ml-4 px-3 py-1 bg-white bg-opacity-20 rounded text-sm hover:bg-opacity-30 disabled:opacity-50"
                >
                  {isRetrying ? 'Retrying...' : 'Retry failed requests'}
                </button>
              )}
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4" />
              <span>You're offline</span>
              <AlertCircle className="h-4 w-4" />
            </>
          )}
          
          <button
            onClick={handleDismiss}
            className="ml-4 text-white hover:text-gray-200"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
        
        {!isOnline && (
          <p className="text-sm mt-1 opacity-90">
            Some features may not work properly. Check your connection.
          </p>
        )}
      </div>
    </div>
  );
}