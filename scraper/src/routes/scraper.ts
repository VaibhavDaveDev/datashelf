import { Router } from 'express';

const router = Router();

/**
 * Scraper status endpoint
 */
router.get('/status', (_req, res) => {
  res.json({
    service: 'scraper',
    status: 'ready',
    timestamp: new Date().toISOString(),
    message: 'Scraper service is ready to accept jobs',
  });
});

/**
 * Scraper metrics endpoint
 */
router.get('/metrics', (_req, res) => {
  // TODO: Implement actual metrics collection
  res.json({
    jobs: {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
    },
    performance: {
      averageJobTime: 0,
      successRate: 100,
      lastJobCompleted: null,
    },
    system: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    },
    timestamp: new Date().toISOString(),
  });
});

export { router as scraperRoutes };