import type { Env } from '@/types/env';
import { createSignedRequest } from '@/utils/request-signing';
// import { logger } from '@/utils/logger'; // TODO: Fix logger import

/**
 * Job types for revalidation
 */
export type RevalidationJobType = 'navigation' | 'category' | 'product';

/**
 * Revalidation request payload
 */
export interface RevalidationJob {
  type: RevalidationJobType;
  target_url: string;
  priority?: number;
  metadata?: Record<string, any>;
}

/**
 * Revalidation trigger response
 */
export interface RevalidationResponse {
  success: boolean;
  jobId?: string;
  message: string;
  timestamp: string;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  windowSizeMs: number;
}

/**
 * Rate limiter using in-memory storage (suitable for single-instance Workers)
 */
class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is within rate limits
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Clean up old requests outside the window
    const validRequests = requests.filter(
      timestamp => now - timestamp < this.config.windowSizeMs
    );
    
    // Check minute limit
    const recentRequests = validRequests.filter(
      timestamp => now - timestamp < 60 * 1000
    );
    
    if (recentRequests.length >= this.config.maxRequestsPerMinute) {
      return false;
    }
    
    // Check hour limit
    const hourlyRequests = validRequests.filter(
      timestamp => now - timestamp < 60 * 60 * 1000
    );
    
    if (hourlyRequests.length >= this.config.maxRequestsPerHour) {
      return false;
    }
    
    return true;
  }

  /**
   * Record a request
   */
  recordRequest(key: string): void {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Add current request
    requests.push(now);
    
    // Clean up old requests
    const validRequests = requests.filter(
      timestamp => now - timestamp < this.config.windowSizeMs
    );
    
    this.requests.set(key, validRequests);
  }

  /**
   * Get current usage for a key
   */
  getUsage(key: string): { minute: number; hour: number } {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    const minuteRequests = requests.filter(
      timestamp => now - timestamp < 60 * 1000
    ).length;
    
    const hourRequests = requests.filter(
      timestamp => now - timestamp < 60 * 60 * 1000
    ).length;
    
    return { minute: minuteRequests, hour: hourRequests };
  }
}

/**
 * Revalidation metrics for monitoring
 */
export interface RevalidationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  averageResponseTime: number;
  lastRequestTime?: string;
  scraperAvailable: boolean;
}

/**
 * Revalidation trigger service
 */
export class RevalidationService {
  private env: Env;
  private rateLimiter: InMemoryRateLimiter;
  private metrics: RevalidationMetrics;

  constructor(env: Env) {
    this.env = env;
    
    // Configure rate limiting
    const rateLimitConfig: RateLimitConfig = {
      maxRequestsPerMinute: parseInt(env.REVALIDATION_RATE_LIMIT_PER_MINUTE || '10', 10),
      maxRequestsPerHour: parseInt(env.REVALIDATION_RATE_LIMIT_PER_HOUR || '100', 10),
      windowSizeMs: 60 * 60 * 1000, // 1 hour
    };
    
    this.rateLimiter = new InMemoryRateLimiter(rateLimitConfig);
    
    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      averageResponseTime: 0,
      scraperAvailable: true,
    };
  }

  /**
   * Trigger revalidation job for stale data
   */
  async triggerRevalidation(
    job: RevalidationJob,
    source: string = 'cache-miss'
  ): Promise<RevalidationResponse> {
    const startTime = Date.now();
    
    try {
      // Check rate limits
      const rateLimitKey = `revalidation:${source}`;
      if (!this.rateLimiter.isAllowed(rateLimitKey)) {
        this.metrics.rateLimitedRequests++;
        
        logger.warn('Revalidation request rate limited', {
          source,
          job: job.type,
          target_url: job.target_url,
        });
        
        return {
          success: false,
          message: 'Rate limit exceeded',
          timestamp: new Date().toISOString(),
        };
      }
      
      // Record the request
      this.rateLimiter.recordRequest(rateLimitKey);
      this.metrics.totalRequests++;
      
      // Check if scraper service is available
      const scraperAvailable = await this.checkScraperHealth();
      if (!scraperAvailable) {
        this.metrics.failedRequests++;
        
        logger.error('Scraper service unavailable for revalidation', {
          source,
          job: job.type,
          target_url: job.target_url,
        });
        
        return {
          success: false,
          message: 'Scraper service unavailable',
          timestamp: new Date().toISOString(),
        };
      }
      
      // Create signed request
      const scraperUrl = `${this.env.SCRAPER_SERVICE_URL}/api/worker/jobs`;
      const signedRequest = createSignedRequest(this.env.SCRAPER_API_KEY, {
        method: 'POST',
        url: scraperUrl,
        body: {
          type: job.type,
          target_url: job.target_url,
          priority: job.priority || 5,
          metadata: {
            ...job.metadata,
            triggered_by: 'revalidation',
            source,
            timestamp: new Date().toISOString(),
          },
        },
      });
      
      // Send request to scraper service
      const response = await fetch(signedRequest.url, {
        method: signedRequest.method,
        headers: signedRequest.headers,
        body: signedRequest.body,
      });
      
      const responseData = await response.json() as any;
      
      if (response.ok && responseData.success) {
        this.metrics.successfulRequests++;
        
        logger.info('Revalidation job triggered successfully', {
          source,
          jobId: responseData.jobId,
          job: job.type,
          target_url: job.target_url,
          responseTime: Date.now() - startTime,
        });
        
        return {
          success: true,
          jobId: responseData.jobId,
          message: 'Revalidation job triggered successfully',
          timestamp: new Date().toISOString(),
        };
      } else {
        this.metrics.failedRequests++;
        
        logger.error('Failed to trigger revalidation job', {
          source,
          job: job.type,
          target_url: job.target_url,
          status: response.status,
          error: responseData.message || responseData.error,
        });
        
        return {
          success: false,
          message: responseData.message || responseData.error || 'Failed to trigger revalidation',
          timestamp: new Date().toISOString(),
        };
      }
      
    } catch (error) {
      this.metrics.failedRequests++;
      
      logger.error('Revalidation trigger error', {
        source,
        job: job.type,
        target_url: job.target_url,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        success: false,
        message: 'Internal error triggering revalidation',
        timestamp: new Date().toISOString(),
      };
    } finally {
      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      this.metrics.lastRequestTime = new Date().toISOString();
    }
  }

  /**
   * Check if scraper service is healthy
   */
  async checkScraperHealth(): Promise<boolean> {
    try {
      const healthUrl = `${this.env.SCRAPER_SERVICE_URL}/health`;
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.env.SCRAPER_API_KEY}`,
        },
      });
      
      if (response.ok) {
        const healthData = await response.json() as any;
        const isHealthy = healthData.status === 'healthy' || healthData.status === 'ok';
        this.metrics.scraperAvailable = isHealthy;
        return isHealthy;
      }
      
      this.metrics.scraperAvailable = false;
      return false;
    } catch (error) {
      logger.error('Scraper health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      this.metrics.scraperAvailable = false;
      return false;
    }
  }

  /**
   * Trigger revalidation based on cache staleness
   */
  async triggerStaleRevalidation(
    cacheKey: string,
    dataType: RevalidationJobType,
    targetUrl: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Don't await - trigger in background
    this.triggerRevalidation({
      type: dataType,
      target_url: targetUrl,
      priority: 3, // Lower priority for background revalidation
      metadata: {
        ...metadata,
        cache_key: cacheKey,
        revalidation_type: 'stale',
      },
    }, 'stale-cache').catch(error => {
      logger.error('Background stale revalidation failed', {
        cacheKey,
        dataType,
        targetUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Get revalidation metrics
   */
  getMetrics(): RevalidationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(source: string = 'default'): {
    allowed: boolean;
    usage: { minute: number; hour: number };
    limits: { minute: number; hour: number };
  } {
    const rateLimitKey = `revalidation:${source}`;
    const usage = this.rateLimiter.getUsage(rateLimitKey);
    const allowed = this.rateLimiter.isAllowed(rateLimitKey);
    
    return {
      allowed,
      usage,
      limits: {
        minute: parseInt(this.env.REVALIDATION_RATE_LIMIT_PER_MINUTE || '10', 10),
        hour: parseInt(this.env.REVALIDATION_RATE_LIMIT_PER_HOUR || '100', 10),
      },
    };
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    if (this.metrics.totalRequests === 1) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      // Calculate rolling average
      const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1);
      this.metrics.averageResponseTime = (totalTime + responseTime) / this.metrics.totalRequests;
    }
  }
}

/**
 * Create logger utility for revalidation service
 */
const logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() }));
  },
  warn: (message: string, meta?: any) => {
    console.warn(JSON.stringify({ level: 'warn', message, ...meta, timestamp: new Date().toISOString() }));
  },
  error: (message: string, meta?: any) => {
    console.error(JSON.stringify({ level: 'error', message, ...meta, timestamp: new Date().toISOString() }));
  },
};