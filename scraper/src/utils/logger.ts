import winston from 'winston';
import { config } from '../config/environment';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(colors);

// Create formatters
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const simpleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.LOG_FORMAT === 'json' ? jsonFormat : simpleFormat,
  }),
];

// Add file transport in production
if (config.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  levels,
  transports,
  exitOnError: false,
});

// Create specialized loggers for different components
export const scraperLogger = logger.child({ component: 'scraper' });
export const crawlerLogger = logger.child({ component: 'crawler' });
export const queueLogger = logger.child({ component: 'queue' });
export const dbLogger = logger.child({ component: 'database' });
export const storageLogger = logger.child({ component: 'storage' });

// Helper function to create component-specific loggers
export const createLogger = (component: string) => {
  return logger.child({ component });
};

// Helper functions for structured logging (moved to enhanced versions below)

export const logCrawlerEvent = (event: string, data: Record<string, any>) => {
  crawlerLogger.info(`Crawler event: ${event}`, {
    event,
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const logQueueOperation = (operation: string, data: Record<string, any>) => {
  queueLogger.info(`Queue operation: ${operation}`, {
    operation,
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const logDatabaseOperation = (operation: string, table: string, data: Record<string, any>) => {
  dbLogger.info(`Database operation: ${operation}`, {
    operation,
    table,
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const logStorageOperation = (operation: string, data: Record<string, any>) => {
  storageLogger.info(`Storage operation: ${operation}`, {
    operation,
    ...data,
    timestamp: new Date().toISOString(),
  });
};

// Performance monitoring helpers
export const createTimer = (label: string) => {
  const start = Date.now();
  return {
    end: (additionalData?: Record<string, any>) => {
      const duration = Date.now() - start;
      logger.info(`Timer: ${label}`, {
        label,
        duration,
        ...additionalData,
        timestamp: new Date().toISOString(),
      });
      return duration;
    },
  };
};

// Metrics collection
export interface ScrapingMetrics {
  jobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  totalScrapingTime: number;
  averageScrapingTime: number;
  itemsScraped: number;
  imagesProcessed: number;
  errorsEncountered: number;
  lastResetTime: string;
}

class MetricsCollector {
  private metrics: ScrapingMetrics = {
    jobsProcessed: 0,
    jobsSucceeded: 0,
    jobsFailed: 0,
    totalScrapingTime: 0,
    averageScrapingTime: 0,
    itemsScraped: 0,
    imagesProcessed: 0,
    errorsEncountered: 0,
    lastResetTime: new Date().toISOString(),
  };

  recordJobStart() {
    this.metrics.jobsProcessed++;
  }

  recordJobSuccess(duration: number, itemsScraped: number = 0) {
    this.metrics.jobsSucceeded++;
    this.metrics.totalScrapingTime += duration;
    this.metrics.averageScrapingTime = this.metrics.totalScrapingTime / this.metrics.jobsSucceeded;
    this.metrics.itemsScraped += itemsScraped;
  }

  recordJobFailure() {
    this.metrics.jobsFailed++;
  }

  recordImageProcessed() {
    this.metrics.imagesProcessed++;
  }

  recordError() {
    this.metrics.errorsEncountered++;
  }

  getMetrics(): ScrapingMetrics {
    return { ...this.metrics };
  }

  resetMetrics() {
    this.metrics = {
      jobsProcessed: 0,
      jobsSucceeded: 0,
      jobsFailed: 0,
      totalScrapingTime: 0,
      averageScrapingTime: 0,
      itemsScraped: 0,
      imagesProcessed: 0,
      errorsEncountered: 0,
      lastResetTime: new Date().toISOString(),
    };
  }

  getSuccessRate(): number {
    return this.metrics.jobsProcessed > 0 
      ? (this.metrics.jobsSucceeded / this.metrics.jobsProcessed) * 100 
      : 0;
  }

  getErrorRate(): number {
    return this.metrics.jobsProcessed > 0 
      ? (this.metrics.jobsFailed / this.metrics.jobsProcessed) * 100 
      : 0;
  }
}

export const metricsCollector = new MetricsCollector();

// Enhanced logging functions with metrics
export const logScrapingStart = (url: string, jobId: string) => {
  metricsCollector.recordJobStart();
  scraperLogger.info('Starting scraping job', {
    url,
    jobId,
    timestamp: new Date().toISOString(),
    metrics: {
      totalJobsProcessed: metricsCollector.getMetrics().jobsProcessed,
    },
  });
};

export const logScrapingSuccess = (url: string, jobId: string, duration: number, itemsScraped: number) => {
  metricsCollector.recordJobSuccess(duration, itemsScraped);
  scraperLogger.info('Scraping job completed successfully', {
    url,
    jobId,
    duration,
    itemsScraped,
    timestamp: new Date().toISOString(),
    metrics: {
      successRate: metricsCollector.getSuccessRate(),
      averageTime: metricsCollector.getMetrics().averageScrapingTime,
    },
  });
};

export const logScrapingError = (url: string, jobId: string, error: Error, attempt: number) => {
  metricsCollector.recordJobFailure();
  metricsCollector.recordError();
  scraperLogger.error('Scraping job failed', {
    url,
    jobId,
    error: error.message,
    stack: error.stack,
    attempt,
    timestamp: new Date().toISOString(),
    metrics: {
      errorRate: metricsCollector.getErrorRate(),
      totalErrors: metricsCollector.getMetrics().errorsEncountered,
    },
  });
};

// Error handling helpers
export const logAndThrow = (message: string, error?: Error, additionalData?: Record<string, any>) => {
  logger.error(message, {
    error: error?.message,
    stack: error?.stack,
    ...additionalData,
    timestamp: new Date().toISOString(),
  });
  throw new Error(message);
};

export const logWarning = (message: string, data?: Record<string, any>) => {
  logger.warn(message, {
    ...data,
    timestamp: new Date().toISOString(),
  });
};