/**
 * Simple analytics service for tracking user behavior and performance
 */

export interface AnalyticsEvent {
  event: string;
  category: 'navigation' | 'interaction' | 'performance' | 'error';
  properties?: Record<string, any>;
  timestamp: string;
  sessionId: string;
  userId?: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: string;
  metadata?: Record<string, any>;
}

class AnalyticsService {
  private sessionId: string;
  private userId?: string;
  private events: AnalyticsEvent[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private isEnabled: boolean;
  private batchSize = 10;
  private flushInterval = 30000; // 30 seconds
  private flushTimer?: number;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isEnabled = this.shouldEnableAnalytics();

    if (this.isEnabled) {
      this.startPerformanceMonitoring();
      this.startAutoFlush();
      this.setupPageVisibilityHandling();
    }
  }

  /**
   * Track a user event
   */
  track(event: string, category: AnalyticsEvent['category'], properties?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const analyticsEvent: AnalyticsEvent = {
      event,
      category,
      properties,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
    };

    this.events.push(analyticsEvent);
    console.debug('Analytics event tracked:', analyticsEvent);

    // Auto-flush if batch size reached
    if (this.events.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Track page view
   */
  trackPageView(path: string, title?: string): void {
    this.track('page_view', 'navigation', {
      path,
      title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    });
  }

  /**
   * Track user interaction
   */
  trackInteraction(action: string, element?: string, properties?: Record<string, any>): void {
    this.track('user_interaction', 'interaction', {
      action,
      element,
      ...properties,
    });
  }

  /**
   * Track performance metric
   */
  trackPerformance(name: string, value: number, unit: PerformanceMetric['unit'], metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      metadata,
    };

    this.performanceMetrics.push(metric);
    console.debug('Performance metric tracked:', metric);
  }

  /**
   * Track error
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.track('error', 'error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
    });
  }

  /**
   * Track API call performance
   */
  trackApiCall(endpoint: string, method: string, duration: number, status: number, cached?: boolean): void {
    this.trackPerformance('api_call', duration, 'ms', {
      endpoint,
      method,
      status,
      cached,
    });

    this.track('api_call', 'performance', {
      endpoint,
      method,
      duration,
      status,
      cached,
    });
  }

  /**
   * Track search behavior
   */
  trackSearch(query: string, results: number, category?: string): void {
    this.track('search', 'interaction', {
      query: query.toLowerCase(), // Anonymize by lowercasing
      results,
      category,
      queryLength: query.length,
    });
  }

  /**
   * Track product interactions
   */
  trackProductView(productId: string, category?: string, source?: string): void {
    this.track('product_view', 'interaction', {
      productId,
      category,
      source,
    });
  }

  trackProductClick(productId: string, position?: number, category?: string): void {
    this.track('product_click', 'interaction', {
      productId,
      position,
      category,
    });
  }

  /**
   * Set user ID for tracking
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Flush events to server
   */
  async flush(): Promise<void> {
    if (!this.isEnabled || (this.events.length === 0 && this.performanceMetrics.length === 0)) {
      return;
    }

    try {
      const payload = {
        sessionId: this.sessionId,
        userId: this.userId,
        events: [...this.events],
        performanceMetrics: [...this.performanceMetrics],
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // Clear events before sending to avoid duplicates
      this.events = [];
      this.performanceMetrics = [];

      // Send to analytics endpoint
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn('Failed to send analytics data:', response.status, response.statusText);
        // Could implement retry logic here
      } else {
        console.debug('Analytics data sent successfully');
      }
    } catch (error) {
      console.warn('Error sending analytics data:', error);
      // Could implement local storage fallback here
    }
  }

  /**
   * Get current session analytics summary
   */
  getSessionSummary(): {
    sessionId: string;
    userId?: string;
    eventCount: number;
    performanceMetricCount: number;
    sessionDuration: number;
    topEvents: Array<{ event: string; count: number }>;
  } {
    const sessionStart = new Date(this.sessionId.split('-')[0]);
    const sessionDuration = Date.now() - sessionStart.getTime();

    // Count events by type
    const eventCounts = this.events.reduce((acc, event) => {
      acc[event.event] = (acc[event.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEvents = Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([event, count]) => ({ event, count }));

    return {
      sessionId: this.sessionId,
      userId: this.userId,
      eventCount: this.events.length,
      performanceMetricCount: this.performanceMetrics.length,
      sessionDuration,
      topEvents,
    };
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}-${random}`;
  }

  /**
   * Check if analytics should be enabled
   */
  private shouldEnableAnalytics(): boolean {
    // Check for Do Not Track
    if (navigator.doNotTrack === '1') {
      return false;
    }

    // Check for local development
    if (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('.local') ||
      window.location.port === '3000' ||
      window.location.port === '5173') { // Vite dev server
      return false; // Disable in development
    }

    // Could add more privacy checks here
    return true;
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Monitor page load performance
    if (typeof window !== 'undefined' && 'performance' in window) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navigation) {
            this.trackPerformance('page_load', navigation.loadEventEnd - navigation.fetchStart, 'ms', {
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
              firstPaint: this.getFirstPaint(),
              firstContentfulPaint: this.getFirstContentfulPaint(),
            });
          }
        }, 0);
      });

      // Monitor resource loading (with browser support check)
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              const resource = entry as PerformanceResourceTiming;
              this.trackPerformance('resource_load', resource.duration, 'ms', {
                name: resource.name,
                type: this.getResourceType(resource.name),
                size: resource.transferSize,
              });
            }
          }
        });

        observer.observe({ entryTypes: ['resource'] });
      }
    }
  }

  /**
   * Get first paint time
   */
  private getFirstPaint(): number | undefined {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint?.startTime;
  }

  /**
   * Get first contentful paint time
   */
  private getFirstContentfulPaint(): number | undefined {
    const paintEntries = performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return firstContentfulPaint?.startTime;
  }

  /**
   * Get resource type from URL
   */
  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Setup page visibility handling
   */
  private setupPageVisibilityHandling(): void {
    // Flush when page becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });

    // Flush before page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(); // Final flush
  }
}

// Global analytics instance
export const analytics = new AnalyticsService();

// Convenience functions
export const trackPageView = (path: string, title?: string) => analytics.trackPageView(path, title);
export const trackClick = (element: string, properties?: Record<string, any>) =>
  analytics.trackInteraction('click', element, properties);
export const trackSearch = (query: string, results: number, category?: string) =>
  analytics.trackSearch(query, results, category);
export const trackProductView = (productId: string, category?: string, source?: string) =>
  analytics.trackProductView(productId, category, source);
export const trackProductClick = (productId: string, position?: number, category?: string) =>
  analytics.trackProductClick(productId, position, category);
export const trackError = (error: Error, context?: Record<string, any>) =>
  analytics.trackError(error, context);
export const trackApiCall = (endpoint: string, method: string, duration: number, status: number, cached?: boolean) =>
  analytics.trackApiCall(endpoint, method, duration, status, cached);

// React hook for analytics
export const useAnalytics = () => {
  return {
    trackPageView,
    trackClick,
    trackSearch,
    trackProductView,
    trackProductClick,
    trackError,
    trackApiCall,
    getSessionSummary: () => analytics.getSessionSummary(),
  };
};