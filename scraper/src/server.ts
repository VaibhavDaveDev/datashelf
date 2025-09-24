import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/environment';
import { healthRoutes } from './routes/health';
import { scraperRoutes } from './routes/scraper';
import { monitoringRoutes } from './routes/monitoring';
import { logsRoutes } from './routes/logs';

import workerRoutes, { setWorker } from './routes/worker';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { JobManager } from './services/jobManager';
import { ScraperWorker } from './services/worker';

export async function createServer() {
  const app = express();

  // Initialize job manager
  const jobManager = new JobManager();
  await jobManager.initialize();
  
  // Initialize worker
  const worker = new ScraperWorker();
  await worker.initialize();
  

  
  // Set worker for worker routes
  setWorker(worker);

  // Store job manager and worker on app for access in other parts of the application
  app.locals['jobManager'] = jobManager;
  app.locals['worker'] = worker;

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API
  }));

  // CORS configuration
  app.use(cors({
    origin: config.NODE_ENV === 'production' 
      ? ['https://datashelf.pages.dev'] // Add your production domains
      : true,
    credentials: true,
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use(requestLogger);

  // Static files for monitoring dashboard
  app.use('/public', express.static('public'));

  // Routes
  app.use('/health', healthRoutes);
  app.use('/api', scraperRoutes);
  app.use('/monitoring', monitoringRoutes);
  app.use('/logs', logsRoutes);
  app.use('/api/worker', workerRoutes);

  // Monitoring dashboard route
  app.get('/dashboard', (_req, res) => {
    res.sendFile('monitoring.html', { root: 'public' });
  });

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      service: 'DataShelf Scraper Service',
      version: process.env['npm_package_version'] || '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        detailedHealth: '/health/detailed',
        metrics: '/health/metrics',
        monitoring: '/monitoring/dashboard',
        logs: '/logs',
        dashboard: '/dashboard',
      },
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}