import { Hono } from 'hono';
import type { Env } from '@/types/env';
import { jsonResponse } from '@/utils/response';
import { createSupabaseClient } from '@/services/supabase';
import { CacheMonitoringService } from '@/utils/cache-monitoring';

const app = new Hono<{ Bindings: Env }>();

/**
 * Health check endpoint with cache monitoring
 */
app.get('/health', async (c) => {
  const env = c.env as Env;
  const monitoringService = new CacheMonitoringService(env);
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: env.API_VERSION || 'v1',
    services: {
      database: 'unknown',
      cache: 'unknown',
    },
    cache: {
      metrics: {},
      health: {},
    },
  };

  // Check database connection
  try {
    const supabase = createSupabaseClient(env);
    const { error } = await supabase.from('navigation').select('id').limit(1);
    health.services.database = error ? 'unhealthy' : 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
  }

  // Check cache connection and get metrics
  try {
    const kv = env.CACHE as KVNamespace;
    await kv.put('health_check', 'ok', { expirationTtl: 10 });
    const cached = await kv.get('health_check');
    health.services.cache = cached === 'ok' ? 'healthy' : 'unhealthy';
    
    // Get cache metrics and health check
    health.cache.metrics = monitoringService.getCurrentStats();
    health.cache.health = await monitoringService.performHealthCheck();
  } catch (error) {
    health.services.cache = 'unhealthy';
    console.error('Cache health check error:', error);
  }

  // Determine overall status
  const isHealthy = Object.values(health.services).every(status => status === 'healthy');
  health.status = isHealthy ? 'healthy' : 'degraded';

  return jsonResponse(c, health, isHealthy ? 200 : 503, {
    'Cache-Control': 'no-cache',
  });
});

/**
 * Cache metrics endpoint
 */
app.get('/cache/metrics', async (c) => {
  const env = c.env as Env;
  const monitoringService = new CacheMonitoringService(env);
  
  try {
    const metrics = {
      current: monitoringService.getCurrentStats(),
      history: monitoringService.getMetricsHistory(),
      performance: monitoringService.generatePerformanceReport(),
      sizes: await monitoringService.getCacheSizeEstimate(),
      timestamp: new Date().toISOString(),
    };

    return jsonResponse(c, metrics, 200, {
      'Cache-Control': 'no-cache',
    });
  } catch (error) {
    console.error('Cache metrics error:', error);
    return jsonResponse(c, {
      error: 'Failed to retrieve cache metrics',
      timestamp: new Date().toISOString(),
    }, 500, {
      'Cache-Control': 'no-cache',
    });
  }
});

/**
 * Cache health check endpoint
 */
app.get('/cache/health', async (c) => {
  const env = c.env as Env;
  const monitoringService = new CacheMonitoringService(env);
  
  try {
    const healthCheck = await monitoringService.performHealthCheck();
    const statusCode = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 200 : 503;

    return jsonResponse(c, healthCheck, statusCode, {
      'Cache-Control': 'no-cache',
    });
  } catch (error) {
    console.error('Cache health check error:', error);
    return jsonResponse(c, {
      status: 'unhealthy',
      error: 'Failed to perform cache health check',
      timestamp: new Date().toISOString(),
    }, 503, {
      'Cache-Control': 'no-cache',
    });
  }
});

/**
 * Readiness check endpoint
 */
app.get('/ready', async (c) => {
  const env = c.env as Env;
  
  // Basic readiness check - ensure environment variables are set
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !env[varName as keyof Env]);

  if (missingVars.length > 0) {
    return jsonResponse(c, {
      status: 'not_ready',
      message: `Missing required environment variables: ${missingVars.join(', ')}`,
      timestamp: new Date().toISOString(),
    }, 503, {
      'Cache-Control': 'no-cache',
    });
  }

  return jsonResponse(c, {
    status: 'ready',
    timestamp: new Date().toISOString(),
  }, 200, {
    'Cache-Control': 'no-cache',
  });
});

export { app as healthRoutes };