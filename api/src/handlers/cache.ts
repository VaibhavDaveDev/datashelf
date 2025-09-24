import { Hono } from 'hono';
import type { Env } from '@/types/env';
import { jsonResponse, errorResponse } from '@/utils/response';
import { CacheInvalidationService, type InvalidationRequest } from '@/utils/cache-invalidation';
import { CacheMonitoringService } from '@/utils/cache-monitoring';
import { ValidationError } from '@/middleware/error-handler';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /cache/invalidate
 * Invalidate cache entries based on type and parameters
 */
app.post('/invalidate', async (c) => {
  const env = c.env as Env;
  
  try {
    // Verify request signature for security
    const signature = c.req.header('X-Signature');
    if (!signature || !verifySignature(c.req, signature, env.SCRAPER_API_KEY)) {
      return errorResponse(c, 'Unauthorized', 'Invalid signature', 401);
    }

    const body = await c.req.json() as InvalidationRequest;
    
    // Validate request body
    if (!body.type || !['navigation', 'category', 'product', 'all'].includes(body.type)) {
      throw new ValidationError('Invalid invalidation type');
    }

    const invalidationService = new CacheInvalidationService(env);
    await invalidationService.invalidate(body);

    return jsonResponse(c, {
      success: true,
      message: `Cache invalidated for type: ${body.type}`,
      timestamp: new Date().toISOString(),
    }, 200, {
      'Cache-Control': 'no-cache',
    });

  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(c, 'Validation Error', error.message, 400);
    }
    
    console.error('Cache invalidation error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to invalidate cache', 500);
  }
});

/**
 * POST /cache/warm
 * Warm cache with fresh data
 */
app.post('/warm', async (c) => {
  const env = c.env as Env;
  
  try {
    // Verify request signature for security
    const signature = c.req.header('X-Signature');
    if (!signature || !verifySignature(c.req, signature, env.SCRAPER_API_KEY)) {
      return errorResponse(c, 'Unauthorized', 'Invalid signature', 401);
    }

    const body = await c.req.json() as {
      type: 'navigation' | 'categories' | 'products';
      data?: any;
    };

    if (!body.type || !['navigation', 'categories', 'products'].includes(body.type)) {
      throw new ValidationError('Invalid cache warm type');
    }

    // This would typically trigger background jobs to refresh cache
    // For now, we'll just return success
    return jsonResponse(c, {
      success: true,
      message: `Cache warming initiated for type: ${body.type}`,
      timestamp: new Date().toISOString(),
    }, 202, {
      'Cache-Control': 'no-cache',
    });

  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(c, 'Validation Error', error.message, 400);
    }
    
    console.error('Cache warming error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to warm cache', 500);
  }
});

/**
 * POST /cache/cleanup
 * Clean up expired cache entries and indexes
 */
app.post('/cleanup', async (c) => {
  const env = c.env as Env;
  
  try {
    // Verify request signature for security
    const signature = c.req.header('X-Signature');
    if (!signature || !verifySignature(c.req, signature, env.SCRAPER_API_KEY)) {
      return errorResponse(c, 'Unauthorized', 'Invalid signature', 401);
    }

    const invalidationService = new CacheInvalidationService(env);
    await invalidationService.cleanup();

    return jsonResponse(c, {
      success: true,
      message: 'Cache cleanup completed',
      timestamp: new Date().toISOString(),
    }, 200, {
      'Cache-Control': 'no-cache',
    });

  } catch (error) {
    console.error('Cache cleanup error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to cleanup cache', 500);
  }
});

/**
 * GET /cache/stats
 * Get detailed cache statistics and performance metrics
 */
app.get('/stats', async (c) => {
  const env = c.env as Env;
  const monitoringService = new CacheMonitoringService(env);
  
  try {
    const stats = {
      metrics: monitoringService.getCurrentStats(),
      history: monitoringService.getMetricsHistory(),
      performance: monitoringService.generatePerformanceReport(),
      sizes: await monitoringService.getCacheSizeEstimate(),
      health: await monitoringService.performHealthCheck(),
      timestamp: new Date().toISOString(),
    };

    return jsonResponse(c, stats, 200, {
      'Cache-Control': 'no-cache',
    });

  } catch (error) {
    console.error('Cache stats error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to retrieve cache stats', 500);
  }
});

/**
 * POST /cache/metrics/record
 * Record current metrics to history (typically called by a scheduled job)
 */
app.post('/metrics/record', async (c) => {
  const env = c.env as Env;
  
  try {
    // Verify request signature for security
    const signature = c.req.header('X-Signature');
    if (!signature || !verifySignature(c.req, signature, env.SCRAPER_API_KEY)) {
      return errorResponse(c, 'Unauthorized', 'Invalid signature', 401);
    }

    const monitoringService = new CacheMonitoringService(env);
    monitoringService.recordMetrics();

    return jsonResponse(c, {
      success: true,
      message: 'Metrics recorded to history',
      timestamp: new Date().toISOString(),
    }, 200, {
      'Cache-Control': 'no-cache',
    });

  } catch (error) {
    console.error('Metrics recording error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to record metrics', 500);
  }
});

/**
 * Verify HMAC signature for webhook security
 */
function verifySignature(request: Request, signature: string, secret: string): boolean {
  // This is a placeholder implementation
  // In production, implement proper HMAC-SHA256 verification
  return signature.startsWith('sha256=') && signature.length > 10;
}

export { app as cacheRoutes };