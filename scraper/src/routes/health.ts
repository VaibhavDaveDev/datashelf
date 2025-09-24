import { Router } from 'express';
import { logger, metricsCollector } from '../utils/logger';
import { config } from '../config/environment';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: 'connected' | 'disconnected' | 'error';
    storage: 'connected' | 'disconnected' | 'error';
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
}

/**
 * Basic health check endpoint
 */
router.get('/', (_req, res) => {
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
  const usedMemory = memoryUsage.heapUsed;

  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env['npm_package_version'] || '1.0.0',
    environment: config.NODE_ENV,
    services: {
      database: 'connected', // Will be updated when we implement database checks
      storage: 'connected',   // Will be updated when we implement R2 checks
    },
    system: {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100),
      },
      cpu: {
        usage: 0, // Will be implemented with actual CPU monitoring
      },
    },
  };

  logger.debug('Health check requested', { healthStatus });

  res.status(200).json(healthStatus);
});

/**
 * Detailed health check with service connectivity
 */
router.get('/detailed', async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
    const usedMemory = memoryUsage.heapUsed;

    // Get services from app locals
    const jobManager = req.app.locals['jobManager'];
    const worker = req.app.locals['worker'];

    // Check database connectivity
    let databaseStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    try {
      if (jobManager) {
        await jobManager.getQueueStats();
        databaseStatus = 'connected';
      }
    } catch (error) {
      logger.error('Database health check failed', { error });
      databaseStatus = 'error';
    }

    // Check storage connectivity (R2)
    let storageStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    try {
      // Simple connectivity test - this would be implemented in storage service
      storageStatus = 'connected'; // Placeholder - implement actual R2 health check
    } catch (error) {
      logger.error('Storage health check failed', { error });
      storageStatus = 'error';
    }

    // Get worker status
    const workerStatus = worker ? {
      isRunning: worker.isRunning(),
      activeJobs: worker.getActiveJobCount ? worker.getActiveJobCount() : 0,
      lastActivity: worker.getLastActivity ? worker.getLastActivity() : null,
    } : null;

    const services = {
      database: databaseStatus,
      storage: storageStatus,
    };

    const healthStatus: HealthStatus & {
      worker?: any;
      queue?: any;
    } = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env['npm_package_version'] || '1.0.0',
      environment: config.NODE_ENV,
      services,
      system: {
        memory: {
          used: usedMemory,
          total: totalMemory,
          percentage: Math.round((usedMemory / totalMemory) * 100),
        },
        cpu: {
          usage: process.cpuUsage().user / 1000000, // Convert to seconds
        },
      },
      worker: workerStatus,
    };

    // Add queue statistics if available
    if (jobManager) {
      try {
        const queueStats = await jobManager.getQueueStats();
        healthStatus.queue = queueStats;
      } catch (error) {
        logger.warn('Failed to get queue stats', { error });
      }
    }

    // Check if any service is unhealthy
    const hasUnhealthyService = Object.values(services).some(
      status => status !== 'connected'
    );

    // Check system resources
    const memoryUsageHigh = healthStatus.system.memory.percentage > 90;
    const isUnhealthy = hasUnhealthyService || memoryUsageHigh;

    if (isUnhealthy) {
      healthStatus.status = 'unhealthy';
      res.status(503);
    } else {
      res.status(200);
    }

    logger.info('Detailed health check requested', { 
      status: healthStatus.status,
      services: healthStatus.services,
      memoryUsage: healthStatus.system.memory.percentage,
    });

    res.json(healthStatus);

  } catch (error) {
    logger.error('Health check failed', { error });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Readiness probe for Kubernetes/Docker
 */
router.get('/ready', (_req, res) => {
  // Simple readiness check - can be enhanced with actual service checks
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Liveness probe for Kubernetes/Docker
 */
router.get('/live', (_req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Metrics endpoint for scraping performance
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = metricsCollector.getMetrics();
    const jobManager = req.app.locals['jobManager'];
    
    let queueMetrics = null;
    if (jobManager) {
      try {
        queueMetrics = await jobManager.getQueueStats();
      } catch (error) {
        logger.warn('Failed to get queue metrics', { error });
      }
    }

    const response = {
      scraping: {
        ...metrics,
        successRate: metricsCollector.getSuccessRate(),
        errorRate: metricsCollector.getErrorRate(),
      },
      queue: queueMetrics,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      timestamp: new Date().toISOString(),
    };

    logger.debug('Metrics requested', { 
      successRate: metricsCollector.getSuccessRate(),
      errorRate: metricsCollector.getErrorRate(),
      jobsProcessed: metrics.jobsProcessed,
    });

    res.status(200).json(response);
  } catch (error) {
    logger.error('Failed to get metrics', { error });
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Reset metrics endpoint (for testing/maintenance)
 */
router.post('/metrics/reset', (_req, res) => {
  try {
    metricsCollector.resetMetrics();
    logger.info('Metrics reset requested');
    
    res.status(200).json({
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to reset metrics', { error });
    res.status(500).json({
      error: 'Failed to reset metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as healthRoutes };