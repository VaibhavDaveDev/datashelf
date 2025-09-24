import { config } from './config/environment';
import { logger } from './utils/logger';
import { startHealthMonitoring } from './utils/alerting';
import { createServer } from './server';

async function main() {
  try {
    logger.info('Starting DataShelf Scraper Service', {
      version: process.env['npm_package_version'] || '1.0.0',
      nodeVersion: process.version,
      environment: config.NODE_ENV,
    });

    const server = await createServer();

    const httpServer = server.listen(config.PORT, async () => {
      logger.info(`Server running on port ${config.PORT}`, {
        port: config.PORT,
        environment: config.NODE_ENV,
      });

      // Start health monitoring
      startHealthMonitoring();

      // Start the worker after server is listening
      try {
        const worker = server.locals['worker'];
        if (worker) {
          await worker.start();
          logger.info('Worker started successfully');
        }
      } catch (error) {
        logger.error('Failed to start worker', { error });
        // Don't exit here - server can still handle API requests
      }
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);

      try {
        // Stop the worker first
        const worker = server.locals['worker'];
        if (worker) {
          await worker.stop();
          logger.info('Worker stopped');
        }

        // Close HTTP server
        httpServer.close(() => {
          logger.info('HTTP server closed');
          process.exit(0);
        });

        // Force exit after timeout
        setTimeout(() => {
          logger.error('Forced shutdown after timeout');
          process.exit(1);
        }, 30000);

      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Unhandled error in main', { error });
  process.exit(1);
});