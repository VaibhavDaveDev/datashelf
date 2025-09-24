import { Router, Request, Response } from 'express';
import { ScraperWorker } from '../services/worker';
import { logger } from '../utils/logger';

const router = Router();

// Global worker instance (will be set by the main application)
let worker: ScraperWorker;

export function setWorker(workerInstance: ScraperWorker) {
  worker = workerInstance;
}

/**
 * GET /api/worker/status
 * Get worker status and metrics
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    if (!worker) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Worker not initialized',
      });
    }

    const metrics = worker.getMetrics();
    const health = await worker.getHealthStatus();

    return res.json({
      success: true,
      data: {
        metrics,
        health: health.status,
        details: health.details,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get worker status', {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get worker status',
    });
  }
});

/**
 * GET /api/worker/metrics
 * Get detailed worker metrics
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    if (!worker) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Worker not initialized',
      });
    }

    const metrics = worker.getMetrics();
    const queueStats = await worker.getQueueStats();

    // Calculate additional metrics
    const uptime = Date.now() - metrics.startedAt.getTime();
    const successRate = metrics.jobsProcessed > 0 
      ? (metrics.jobsSucceeded / metrics.jobsProcessed) * 100 
      : 0;
    const failureRate = metrics.jobsProcessed > 0 
      ? (metrics.jobsFailed / metrics.jobsProcessed) * 100 
      : 0;
    const throughput = uptime > 0 
      ? (metrics.jobsProcessed / (uptime / 1000 / 60)) // jobs per minute
      : 0;

    return res.json({
      success: true,
      data: {
        worker: {
          ...metrics,
          uptime,
          successRate: Math.round(successRate * 100) / 100,
          failureRate: Math.round(failureRate * 100) / 100,
          throughput: Math.round(throughput * 100) / 100, // jobs per minute
        },
        queue: queueStats,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get worker metrics', {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get worker metrics',
    });
  }
});

/**
 * GET /api/worker/health
 * Health check endpoint for monitoring systems
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    if (!worker) {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Worker not initialized',
        timestamp: new Date().toISOString(),
      });
    }

    const health = await worker.getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    return res.status(statusCode).json({
      status: health.status,
      details: health.details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Worker health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/worker/start
 * Start the worker (for manual control)
 */
router.post('/start', async (_req: Request, res: Response) => {
  try {
    if (!worker) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Worker not initialized',
      });
    }

    const metrics = worker.getMetrics();
    if (metrics.isRunning) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Worker is already running',
      });
    }

    await worker.start();

    logger.info('Worker started via API');

    return res.json({
      success: true,
      message: 'Worker started successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to start worker via API', {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start worker',
    });
  }
});

/**
 * POST /api/worker/stop
 * Stop the worker gracefully (for manual control)
 */
router.post('/stop', async (_req: Request, res: Response) => {
  try {
    if (!worker) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Worker not initialized',
      });
    }

    const metrics = worker.getMetrics();
    if (!metrics.isRunning) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Worker is not running',
      });
    }

    await worker.stop();

    logger.info('Worker stopped via API');

    return res.json({
      success: true,
      message: 'Worker stopped successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to stop worker via API', {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to stop worker',
    });
  }
});

/**
 * POST /api/worker/jobs
 * Add a job to the worker queue (convenience endpoint)
 */
router.post('/jobs', async (req: Request, res: Response) => {
  try {
    if (!worker) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Worker not initialized',
      });
    }

    const { type, target_url, priority = 5, metadata } = req.body;

    // Basic validation
    if (!type || !target_url) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'type and target_url are required',
      });
    }

    if (!['navigation', 'category', 'product'].includes(type)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'type must be one of: navigation, category, product',
      });
    }

    const jobId = await worker.addJob({
      type,
      target_url,
      priority,
      metadata,
    });

    logger.info('Job added via worker API', {
      jobId,
      type,
      target_url,
      priority,
    });

    return res.status(201).json({
      success: true,
      jobId,
      message: 'Job added to queue successfully',
    });
  } catch (error) {
    logger.error('Failed to add job via worker API', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add job to queue',
    });
  }
});

export default router;