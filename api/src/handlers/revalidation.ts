import { Hono } from 'hono';
import type { Env } from '@/types/env';
import { errorResponse, jsonResponse } from '@/utils/response';
import { RevalidationUtils } from '@/utils/revalidation-integration';
import { ValidationError } from '@/middleware/error-handler';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/revalidation/metrics
 * Returns revalidation metrics for monitoring
 */
app.get('/metrics', async (c) => {
  const env = c.env as Env;
  
  try {
    const revalidationUtils = new RevalidationUtils(env);
    const metrics = revalidationUtils.getMetrics();
    
    return jsonResponse(c, {
      revalidation: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Revalidation metrics error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to fetch revalidation metrics', 500);
  }
});

/**
 * GET /api/revalidation/status
 * Returns revalidation service status and rate limits
 */
app.get('/status', async (c) => {
  const env = c.env as Env;
  
  try {
    const revalidationUtils = new RevalidationUtils(env);
    const [metrics, rateLimitStatus, scraperHealth] = await Promise.all([
      revalidationUtils.getMetrics(),
      revalidationUtils.getRateLimitStatus(),
      revalidationUtils.checkScraperHealth(),
    ]);
    
    return jsonResponse(c, {
      enabled: env.REVALIDATION_ENABLED !== 'false',
      scraper_available: scraperHealth,
      rate_limits: rateLimitStatus,
      metrics: {
        total_requests: metrics.totalRequests,
        success_rate: metrics.totalRequests > 0 
          ? Math.round((metrics.successfulRequests / metrics.totalRequests) * 100) 
          : 0,
        average_response_time: Math.round(metrics.averageResponseTime),
        last_request: metrics.lastRequestTime,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Revalidation status error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to fetch revalidation status', 500);
  }
});

/**
 * POST /api/revalidation/trigger
 * Manually trigger revalidation for specific data
 * Body: { type: 'navigation' | 'category' | 'product', target_url: string, priority?: number }
 */
app.post('/trigger', async (c) => {
  const env = c.env as Env;
  
  try {
    const body = await c.req.json();
    const { type, target_url, priority = 7, metadata } = body;
    
    // Validate required fields
    if (!type || !target_url) {
      throw new ValidationError('type and target_url are required');
    }
    
    if (!['navigation', 'category', 'product'].includes(type)) {
      throw new ValidationError('type must be one of: navigation, category, product');
    }
    
    // Validate URL format
    try {
      new URL(target_url);
    } catch {
      throw new ValidationError('target_url must be a valid URL');
    }
    
    const revalidationUtils = new RevalidationUtils(env);
    const result = await revalidationUtils.triggerManualRevalidation(
      type,
      target_url,
      priority,
      metadata
    );
    
    if (result.success) {
      return jsonResponse(c, {
        success: true,
        job_id: result.jobId,
        message: result.message,
        timestamp: result.timestamp,
      }, 201);
    } else {
      return errorResponse(c, 'Revalidation Failed', result.message, 400);
    }
    
  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(c, 'Validation Error', error.message, 400);
    }
    
    console.error('Manual revalidation trigger error:', error);
    return errorResponse(c, 'Internal Server Error', 'Failed to trigger revalidation', 500);
  }
});

/**
 * GET /api/revalidation/health
 * Health check for revalidation system
 */
app.get('/health', async (c) => {
  const env = c.env as Env;
  
  try {
    const revalidationUtils = new RevalidationUtils(env);
    const scraperHealth = await revalidationUtils.checkScraperHealth();
    const rateLimitStatus = revalidationUtils.getRateLimitStatus();
    
    const isHealthy = scraperHealth && rateLimitStatus.allowed;
    const status = isHealthy ? 'healthy' : 'degraded';
    
    return jsonResponse(c, {
      status,
      details: {
        revalidation_enabled: env.REVALIDATION_ENABLED !== 'false',
        scraper_available: scraperHealth,
        rate_limits_ok: rateLimitStatus.allowed,
        scraper_service_url: env.SCRAPER_SERVICE_URL ? 'configured' : 'missing',
        api_key: env.SCRAPER_API_KEY ? 'configured' : 'missing',
      },
      timestamp: new Date().toISOString(),
    }, isHealthy ? 200 : 503);
    
  } catch (error) {
    console.error('Revalidation health check error:', error);
    return errorResponse(c, 'Health Check Failed', 'Revalidation system health check failed', 503);
  }
});

export { app as revalidationRoutes };