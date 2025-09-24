import type { Env } from '@/types/env';
import { CacheManager, generateCacheKey } from './cache';

/**
 * Cache monitoring and metrics collection
 */

export interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  errors: number;
  hitRate: number;
  staleRate: number;
  errorRate: number;
  totalRequests: number;
}

export interface CacheHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: CacheStats;
  issues: string[];
  timestamp: string;
}

/**
 * Cache monitoring service
 */
export class CacheMonitoringService {
  private cacheManager: CacheManager;
  private metricsHistory: CacheStats[] = [];
  private readonly maxHistorySize = 100;

  constructor(env: Env) {
    this.cacheManager = new CacheManager();
  }

  /**
   * Get current cache statistics
   */
  getCurrentStats(): CacheStats {
    const metrics = this.cacheManager.getMetrics();
    const totalRequests = metrics.hits + metrics.misses + metrics.staleHits;
    
    return {
      ...metrics,
      hitRate: totalRequests > 0 ? (metrics.hits / totalRequests) * 100 : 0,
      staleRate: totalRequests > 0 ? (metrics.staleHits / totalRequests) * 100 : 0,
      errorRate: totalRequests > 0 ? (metrics.errors / totalRequests) * 100 : 0,
      totalRequests,
    };
  }

  /**
   * Record current metrics to history
   */
  recordMetrics(): void {
    const stats = this.getCurrentStats();
    this.metricsHistory.push(stats);
    
    // Keep only recent history
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
    
    // Reset current metrics after recording
    this.cacheManager.resetMetrics();
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): CacheStats[] {
    return [...this.metricsHistory];
  }

  /**
   * Perform cache health check
   */
  async performHealthCheck(): Promise<CacheHealthCheck> {
    const metrics = this.getCurrentStats();
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check error rate
    if (metrics.errorRate > 10) {
      issues.push(`High error rate: ${metrics.errorRate.toFixed(2)}%`);
      status = 'unhealthy';
    } else if (metrics.errorRate > 5) {
      issues.push(`Elevated error rate: ${metrics.errorRate.toFixed(2)}%`);
      status = 'degraded';
    }

    // Check hit rate
    if (metrics.totalRequests > 10) {
      if (metrics.hitRate < 30) {
        issues.push(`Low hit rate: ${metrics.hitRate.toFixed(2)}%`);
        if (status === 'healthy') status = 'degraded';
      }
    }

    // Check stale rate
    if (metrics.staleRate > 50) {
      issues.push(`High stale rate: ${metrics.staleRate.toFixed(2)}%`);
      if (status === 'healthy') status = 'degraded';
    }

    // Test cache connectivity
    try {
      const testKey = generateCacheKey('_health_check_' + Date.now());
      await this.cacheManager.set(testKey, { test: true }, 60);
      const retrieved = await this.cacheManager.get(testKey);
      await this.cacheManager.delete(testKey);
      
      if (!retrieved) {
        issues.push('Cache connectivity test failed');
        status = 'unhealthy';
      }
    } catch (error) {
      issues.push(`Cache connectivity error: ${error}`);
      status = 'unhealthy';
    }

    return {
      status,
      metrics,
      issues,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get cache size estimates (simplified for Cache API)
   */
  async getCacheSizeEstimate(): Promise<Record<string, number>> {
    const prefixes = ['navigation', 'categories', 'products', 'product_detail'];
    const sizes: Record<string, number> = {};

    // Cache API doesn't provide size information directly
    // We'll return estimated sizes based on typical usage patterns
    for (const prefix of prefixes) {
      try {
        // Test if we can access cache for this prefix
        const testKey = `https://cache.datashelf.internal/${prefix}:test`;
        const testRequest = new Request(testKey);
        const cached = await caches.default.match(testRequest);
        
        // Since we can't get actual counts, we'll use -1 to indicate "unknown"
        sizes[prefix] = cached ? -1 : 0; // -1 means "has cache entries", 0 means "no test entry found"
      } catch (error) {
        console.error(`Error testing cache for ${prefix}:`, error);
        sizes[prefix] = -2; // Indicate error
      }
    }

    return sizes;
  }

  /**
   * Generate cache performance report
   */
  generatePerformanceReport(): {
    summary: CacheStats;
    trends: {
      hitRateTrend: number;
      errorRateTrend: number;
      requestVolumeTrend: number;
    };
    recommendations: string[];
  } {
    const current = this.getCurrentStats();
    const recommendations: string[] = [];

    // Analyze trends if we have history
    let trends = {
      hitRateTrend: 0,
      errorRateTrend: 0,
      requestVolumeTrend: 0,
    };

    if (this.metricsHistory.length >= 2) {
      const recent = this.metricsHistory.slice(-10);
      const older = this.metricsHistory.slice(-20, -10);

      if (older.length > 0) {
        const recentAvg = recent.reduce((sum, m) => sum + m.hitRate, 0) / recent.length;
        const olderAvg = older.reduce((sum, m) => sum + m.hitRate, 0) / older.length;
        trends.hitRateTrend = recentAvg - olderAvg;

        const recentErrorAvg = recent.reduce((sum, m) => sum + m.errorRate, 0) / recent.length;
        const olderErrorAvg = older.reduce((sum, m) => sum + m.errorRate, 0) / older.length;
        trends.errorRateTrend = recentErrorAvg - olderErrorAvg;

        const recentVolumeAvg = recent.reduce((sum, m) => sum + m.totalRequests, 0) / recent.length;
        const olderVolumeAvg = older.reduce((sum, m) => sum + m.totalRequests, 0) / older.length;
        trends.requestVolumeTrend = recentVolumeAvg - olderVolumeAvg;
      }
    }

    // Generate recommendations
    if (current.hitRate < 50) {
      recommendations.push('Consider increasing cache TTL values to improve hit rate');
    }

    if (current.staleRate > 30) {
      recommendations.push('High stale rate detected - consider more frequent cache warming');
    }

    if (current.errorRate > 5) {
      recommendations.push('Investigate cache errors - check KV namespace configuration');
    }

    if (trends.hitRateTrend < -10) {
      recommendations.push('Hit rate is declining - review cache invalidation patterns');
    }

    if (trends.errorRateTrend > 5) {
      recommendations.push('Error rate is increasing - check system health');
    }

    return {
      summary: current,
      trends,
      recommendations,
    };
  }
}