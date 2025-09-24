import { Router } from 'express';
import { logger, metricsCollector } from '../utils/logger';
import { alertingService } from '../utils/alerting';

const router = Router();

/**
 * Monitoring dashboard data endpoint
 */
router.get('/dashboard', async (req, res) => {
  try {
    const jobManager = req.app.locals['jobManager'];
    const worker = req.app.locals['worker'];

    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    // Get scraping metrics
    const scrapingMetrics = metricsCollector.getMetrics();

    // Get queue statistics
    let queueStats = null;
    if (jobManager) {
      try {
        queueStats = await jobManager.getQueueStats();
      } catch (error) {
        logger.warn('Failed to get queue stats for dashboard', { error });
      }
    }

    // Get worker metrics
    let workerMetrics = null;
    if (worker) {
      try {
        workerMetrics = worker.getMetrics();
      } catch (error) {
        logger.warn('Failed to get worker metrics for dashboard', { error });
      }
    }

    // Calculate derived metrics
    const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
    const memoryPercentage = (memoryUsage.heapUsed / totalMemory) * 100;
    const successRate = metricsCollector.getSuccessRate();
    const errorRate = metricsCollector.getErrorRate();

    const dashboardData = {
      timestamp: new Date().toISOString(),
      system: {
        uptime,
        memory: {
          used: memoryUsage.heapUsed,
          total: totalMemory,
          percentage: Math.round(memoryPercentage * 100) / 100,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
        },
        cpu: {
          user: cpuUsage.user / 1000000, // Convert to seconds
          system: cpuUsage.system / 1000000,
        },
        process: {
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      },
      scraping: {
        ...scrapingMetrics,
        successRate: Math.round(successRate * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        currentErrorRate: alertingService.getErrorRate(),
      },
      queue: queueStats,
      worker: workerMetrics,
      health: {
        status: 'healthy', // Will be determined by health checks
        checks: {
          memory: memoryPercentage < 90 ? 'healthy' : 'warning',
          errorRate: errorRate < 10 ? 'healthy' : 'warning',
          queue: queueStats ? 'healthy' : 'unhealthy',
          worker: workerMetrics?.isRunning ? 'healthy' : 'unhealthy',
        },
      },
    };

    // Determine overall health status
    const healthChecks = Object.values(dashboardData.health.checks);
    if (healthChecks.includes('unhealthy')) {
      dashboardData.health.status = 'unhealthy';
    } else if (healthChecks.includes('warning')) {
      dashboardData.health.status = 'warning';
    }

    res.status(200).json(dashboardData);
  } catch (error) {
    logger.error('Failed to get dashboard data', { error });
    res.status(500).json({
      error: 'Failed to retrieve dashboard data',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Historical metrics endpoint (simplified - would need persistent storage for full implementation)
 */
router.get('/metrics/history', async (req, res) => {
  try {
    const timeRange = req.query['range'] as string || '1h';
    const interval = req.query['interval'] as string || '5m';

    // For now, return current metrics as a single data point
    // In a full implementation, this would query a time-series database
    const currentMetrics = metricsCollector.getMetrics();
    const timestamp = new Date().toISOString();

    const historyData = {
      timeRange,
      interval,
      dataPoints: [
        {
          timestamp,
          jobsProcessed: currentMetrics.jobsProcessed,
          jobsSucceeded: currentMetrics.jobsSucceeded,
          jobsFailed: currentMetrics.jobsFailed,
          successRate: metricsCollector.getSuccessRate(),
          errorRate: metricsCollector.getErrorRate(),
          averageProcessingTime: currentMetrics.averageScrapingTime,
          itemsScraped: currentMetrics.itemsScraped,
          imagesProcessed: currentMetrics.imagesProcessed,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      ],
      summary: {
        totalDataPoints: 1,
        averageSuccessRate: metricsCollector.getSuccessRate(),
        averageErrorRate: metricsCollector.getErrorRate(),
        peakMemoryUsage: process.memoryUsage().heapUsed,
        totalJobsProcessed: currentMetrics.jobsProcessed,
      },
    };

    res.status(200).json(historyData);
  } catch (error) {
    logger.error('Failed to get metrics history', { error });
    res.status(500).json({
      error: 'Failed to retrieve metrics history',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * System alerts endpoint
 */
router.get('/alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 50;
    const level = req.query['level'] as string;

    // For now, return current system status as alerts
    // In a full implementation, this would query an alerts database
    const alerts = [];

    // Check current system status and generate alerts
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
    const memoryPercentage = (memoryUsage.heapUsed / totalMemory) * 100;

    if (memoryPercentage > 85) {
      alerts.push({
        id: 'memory-high',
        level: 'warning',
        title: 'High Memory Usage',
        message: `Memory usage is at ${memoryPercentage.toFixed(2)}%`,
        timestamp: new Date().toISOString(),
        source: 'system-monitor',
        resolved: false,
      });
    }

    const errorRate = metricsCollector.getErrorRate();
    if (errorRate > 5) {
      alerts.push({
        id: 'error-rate-high',
        level: 'warning',
        title: 'High Error Rate',
        message: `Error rate is at ${errorRate.toFixed(2)}%`,
        timestamp: new Date().toISOString(),
        source: 'scraper-metrics',
        resolved: false,
      });
    }

    // Filter by level if specified
    const filteredAlerts = level 
      ? alerts.filter(alert => alert.level === level)
      : alerts;

    res.status(200).json({
      alerts: filteredAlerts.slice(0, limit),
      total: filteredAlerts.length,
      filters: {
        level,
        limit,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get alerts', { error });
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Performance report endpoint
 */
router.get('/performance', async (req, res) => {
  try {
    const metrics = metricsCollector.getMetrics();
    const jobManager = req.app.locals['jobManager'];
    
    let queueStats = null;
    if (jobManager) {
      try {
        queueStats = await jobManager.getQueueStats();
      } catch (error) {
        logger.warn('Failed to get queue stats for performance report', { error });
      }
    }

    const performanceReport = {
      timestamp: new Date().toISOString(),
      scraping: {
        totalJobs: metrics.jobsProcessed,
        successRate: metricsCollector.getSuccessRate(),
        errorRate: metricsCollector.getErrorRate(),
        averageProcessingTime: metrics.averageScrapingTime,
        totalProcessingTime: metrics.totalScrapingTime,
        itemsPerJob: metrics.jobsProcessed > 0 ? metrics.itemsScraped / metrics.jobsProcessed : 0,
        imagesPerJob: metrics.jobsProcessed > 0 ? metrics.imagesProcessed / metrics.jobsProcessed : 0,
      },
      queue: queueStats ? {
        ...queueStats,
        queueEfficiency: queueStats.queued > 0 ? (queueStats.running / queueStats.queued) * 100 : 100,
        completionRate: (queueStats.queued + queueStats.running + queueStats.completed) > 0 
          ? (queueStats.completed / (queueStats.queued + queueStats.running + queueStats.completed)) * 100 
          : 0,
      } : null,
      system: {
        uptime: process.uptime(),
        memoryEfficiency: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          efficiency: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
        },
      },
      recommendations: [] as string[],
    };

    // Generate performance recommendations
    if (performanceReport.scraping.successRate < 80) {
      performanceReport.recommendations.push('Consider investigating frequent job failures');
    }
    
    if (performanceReport.scraping.averageProcessingTime > 30000) { // 30 seconds
      performanceReport.recommendations.push('Average processing time is high - consider optimizing scrapers');
    }
    
    if (performanceReport.system.memoryEfficiency.efficiency > 80) {
      performanceReport.recommendations.push('Memory usage is high - consider increasing available memory');
    }

    if (queueStats && queueStats.failed > queueStats.completed * 0.1) {
      performanceReport.recommendations.push('High number of failed jobs - review error patterns');
    }

    res.status(200).json(performanceReport);
  } catch (error) {
    logger.error('Failed to generate performance report', { error });
    res.status(500).json({
      error: 'Failed to generate performance report',
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as monitoringRoutes };