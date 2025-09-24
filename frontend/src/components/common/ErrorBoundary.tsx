import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Wifi, WifiOff } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  isRetrying: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isRetrying: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Log to error reporting service in production
    if (process.env['NODE_ENV'] === 'production') {
      // TODO: Send to error reporting service
      console.error('Production error:', { error, errorInfo });
    }
  }

  private handleRetry = () => {
    this.setState({ isRetrying: true });
    
    // Clear any existing timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    // Simulate retry delay
    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRetrying: false,
      });
    }, 1000);
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public override componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  public override render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isOnline = navigator.onLine;
      const { error, isRetrying } = this.state;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-6">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-600 mb-4">
                We encountered an unexpected error. Don't worry, this happens sometimes.
              </p>
            </div>

            {/* Online/Offline Status */}
            <div className="mb-6 flex items-center justify-center">
              {isOnline ? (
                <div className="flex items-center text-green-600">
                  <Wifi className="h-4 w-4 mr-2" />
                  <span className="text-sm">Online</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <WifiOff className="h-4 w-4 mr-2" />
                  <span className="text-sm">Offline</span>
                </div>
              )}
            </div>

            {/* Error Details (Development only) */}
            {process.env['NODE_ENV'] === 'development' && error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                <h3 className="text-sm font-semibold text-red-800 mb-2">Error Details:</h3>
                <p className="text-xs text-red-700 font-mono break-all">
                  {error.message}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                disabled={isRetrying || !isOnline}
                className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Retrying...' : 'Try Again'}
              </button>

              <button
                onClick={this.handleRefresh}
                className="w-full flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Page
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Home
              </button>
            </div>

            {!isOnline && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  You appear to be offline. Please check your internet connection and try again.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}