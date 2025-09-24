import { JobManager } from './jobManager';
import { DatabaseService } from './database';
import { ImageProcessor } from './imageProcessor';
import { createScraper } from './scrapers';
import { ScrapeJob, JobResult, ScrapingError } from '../types';
import { logger } from '../utils/logger';
import { logCriticalError, logHighSeverityError } from '../utils/alerting';
import { config } from '../config/environment';

export interface WorkerOptions {
  concurrency?: number;
  enableImageProcessing?: boolean;
  enableDatabaseStorage?: boolean;
  gracefulShutdownTimeout?: number;
}

export interface WorkerMetrics {
  jobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  lastJobProcessedAt?: Date;
  startedAt: Date;
  isRunning: boolean;
}

/**
 * Main worker class that orchestrates the complete scraping pipeline
 */
export class ScraperWorker {
  private jobManager: JobManager;
  private databaseService: DatabaseService;
  private imageProcessor: ImageProcessor;
  private isRunning = false;
  private isShuttingDown = false;
  private metrics: WorkerMetrics;
  private readonly options: Required<WorkerOptions>;

  constructor(options: WorkerOptions = {}) {
    this.options = {
      concurrency: options.concurrency || config.SCRAPER_CONCURRENT_JOBS,
      enableImageProcessing: options.enableImageProcessing ?? true,
      enableDatabaseStorage: options.enableDatabaseStorage ?? true,
      gracefulShutdownTimeout: options.gracefulShutdownTimeout || 30000, // 30 seconds
    };

    this.jobManager = new JobManager({
      concurrency: this.options.concurrency,
    });

    this.databaseService = new DatabaseService();
    this.imageProcessor = new ImageProcessor();

    this.metrics = {
      jobsProcessed: 0,
      jobsSucceeded: 0,
      jobsFailed: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      startedAt: new Date(),
      isRunning: false,
    };

    // Set up job processor
    this.jobManager.setJobProcessor(this.processJob.bind(this));

    // Set up graceful shutdown handlers
    this.setupShutdownHandlers();
  }

  /**
   * Initialize the worker and all its dependencies
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing scraper worker', {
        concurrency: this.options.concurrency,
        imageProcessing: this.options.enableImageProcessing,
        databaseStorage: this.options.enableDatabaseStorage,
      });

      // Initialize all services
      await this.jobManager.initialize();
      
      if (this.options.enableDatabaseStorage) {
        await this.databaseService.initialize();
      }

      if (this.options.enableImageProcessing) {
        await this.imageProcessor.initialize();
      }

      logger.info('Scraper worker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize scraper worker', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      await logCriticalError(
        'Worker Initialization Failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          concurrency: this.options.concurrency,
          imageProcessing: this.options.enableImageProcessing,
          databaseStorage: this.options.enableDatabaseStorage,
        }
      );
      
      throw error;
    }
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Worker is already running');
      return;
    }

    try {
      logger.info('Starting scraper worker');
      
      this.isRunning = true;
      this.metrics.isRunning = true;
      this.metrics.startedAt = new Date();

      // Start the job manager
      await this.jobManager.start();

      logger.info('Scraper worker started successfully', {
        concurrency: this.options.concurrency,
        pid: process.pid,
      });
    } catch (error) {
      this.isRunning = false;
      this.metrics.isRunning = false;
      logger.error('Failed to start scraper worker', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Worker is not running');
      return;
    }

    if (this.isShuttingDown) {
      logger.warn('Worker is already shutting down');
      return;
    }

    try {
      logger.info('Stopping scraper worker gracefully');
      this.isShuttingDown = true;

      // Stop accepting new jobs
      await this.jobManager.stop();

      // Close database connections
      if (this.options.enableDatabaseStorage) {
        await this.databaseService.close();
      }

      this.isRunning = false;
      this.metrics.isRunning = false;

      logger.info('Scraper worker stopped successfully', {
        totalJobsProcessed: this.metrics.jobsProcessed,
        totalSucceeded: this.metrics.jobsSucceeded,
        totalFailed: this.metrics.jobsFailed,
        uptime: Date.now() - this.metrics.startedAt.getTime(),
      });
    } catch (error) {
      logger.error('Error during worker shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Process a single job through the complete pipeline
   */
  private async processJob(job: ScrapeJob): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: false,
      itemsProcessed: 0,
      errors: [],
      duration: 0,
      metadata: {},
    };

    try {
      logger.info('Starting job processing pipeline', {
        jobId: job.id,
        type: job.type,
        target_url: job.target_url,
        attempts: job.metadata?.['attempts'] || 1, // Track attempts from PostgreSQL job queue
      });

      // Step 1: Scrape data
      const scrapedData = await this.scrapeData(job);
      result.itemsProcessed = Array.isArray(scrapedData) ? scrapedData.length : 1;
      result.metadata = result.metadata || {};
      result.metadata['scrapedItems'] = result.itemsProcessed;

      // Step 2: Process images (if enabled and data contains images)
      if (this.options.enableImageProcessing) {
        await this.processImages(scrapedData, job, result);
      }

      // Step 3: Store data in database (if enabled)
      if (this.options.enableDatabaseStorage) {
        await this.storeData(scrapedData, job, result);
      }

      result.success = true;
      result.duration = Date.now() - startTime;

      // Update metrics
      this.updateMetrics(true, result.duration);

      logger.info('Job processing completed successfully', {
        jobId: job.id,
        type: job.type,
        itemsProcessed: result.itemsProcessed,
        duration: result.duration,
        errors: result.errors.length,
      });

    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);

      // Update metrics
      this.updateMetrics(false, result.duration);

      logger.error('Job processing failed', {
        jobId: job.id,
        type: job.type,
        target_url: job.target_url,
        duration: result.duration,
        error: errorMessage,
        attempts: job.metadata?.['attempts'] || 1, // Track attempts from PostgreSQL job queue
      });

      // Send alert for critical failures
      const attempts = job.metadata?.['attempts'] || 1;
      if (attempts >= 3) {
        await logCriticalError(
          'Job Failed After Max Attempts',
          error instanceof Error ? error : new Error(errorMessage),
          {
            jobId: job.id,
            type: job.type,
            target_url: job.target_url,
            attempts,
            duration: result.duration,
          }
        );
      } else if (error instanceof Error && error.message.includes('timeout')) {
        await logHighSeverityError(
          'Job Timeout Error',
          `Job ${job.id} timed out on attempt ${attempts}`,
          {
            jobId: job.id,
            type: job.type,
            target_url: job.target_url,
            attempts,
          }
        );
      }

      // Re-throw the error so the job manager can handle retries
      throw error;
    }

    return result;
  }

  /**
   * Step 1: Scrape data using appropriate scraper
   */
  private async scrapeData(job: ScrapeJob): Promise<any> {
    try {
      const scraper = createScraper(job.type);
      
      switch (job.type) {
        case 'navigation':
          return await (scraper as any).scrapeNavigation(job.id);
          
        case 'category':
          return await (scraper as any).scrapeCategory(job.target_url, job.id);
          
        case 'product':
          return await (scraper as any).scrapeProduct(job.target_url, job.id);
          
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }
    } catch (error) {
      if (error instanceof ScrapingError) {
        throw error;
      }
      
      throw new ScrapingError(
        `Scraping failed: ${error instanceof Error ? error.message : String(error)}`,
        job.target_url,
        job.id,
        job.metadata?.['attempts'] || 1, // Track attempts from PostgreSQL job queue
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Step 2: Process and upload images
   */
  private async processImages(scrapedData: any, job: ScrapeJob, result: JobResult): Promise<void> {
    try {
      let imageUrls: string[] = [];
      
      // Extract image URLs based on job type
      if (job.type === 'product' && scrapedData.image_urls) {
        imageUrls = scrapedData.image_urls;
      } else if (job.type === 'category' && scrapedData.products) {
        // For category jobs, we might have product thumbnails
        imageUrls = scrapedData.products
          .filter((p: any) => p.thumbnail)
          .map((p: any) => p.thumbnail);
      }

      if (imageUrls.length === 0) {
        logger.debug('No images to process', { jobId: job.id });
        return;
      }

      logger.info('Processing images', {
        jobId: job.id,
        imageCount: imageUrls.length,
      });

      const imageResults = await Promise.allSettled(
        imageUrls.map(url => this.imageProcessor.processImage(url))
      );

      const processedImages: string[] = [];
      const imageErrors: string[] = [];

      imageResults.forEach((imageResult, index) => {
        if (imageResult.status === 'fulfilled' && imageResult.value.success) {
          processedImages.push(imageResult.value.r2Url!);
        } else {
          const error = imageResult.status === 'rejected' 
            ? imageResult.reason 
            : imageResult.value.error;
          imageErrors.push(`Image ${index}: ${error}`);
        }
      });

      // Update scraped data with processed image URLs
      if (job.type === 'product') {
        scrapedData.image_urls = processedImages;
      }

      result.metadata = result.metadata || {};
      result.metadata['imagesProcessed'] = processedImages.length;
      result.metadata['imageErrors'] = imageErrors.length;

      if (imageErrors.length > 0) {
        result.errors.push(...imageErrors);
        logger.warn('Some images failed to process', {
          jobId: job.id,
          successful: processedImages.length,
          failed: imageErrors.length,
        });
      }

      logger.info('Image processing completed', {
        jobId: job.id,
        processed: processedImages.length,
        failed: imageErrors.length,
      });

    } catch (error) {
      const errorMessage = `Image processing failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMessage);
      logger.error('Image processing error', {
        jobId: job.id,
        error: errorMessage,
      });
      
      // Don't throw here - continue with database storage even if images fail
    }
  }

  /**
   * Step 3: Store data in database
   */
  private async storeData(scrapedData: any, job: ScrapeJob, result: JobResult): Promise<void> {
    try {
      logger.info('Storing data in database', {
        jobId: job.id,
        type: job.type,
      });

      let storedCount = 0;

      switch (job.type) {
        case 'navigation':
          storedCount = await this.databaseService.upsertNavigationBatch(scrapedData);
          break;
          
        case 'category':
          // Store category and products
          await this.databaseService.upsertCategory(scrapedData.category);
          if (scrapedData.products && scrapedData.products.length > 0) {
            // Convert product listings to basic product records for database
            const products = scrapedData.products.map((p: any) => ({
              title: p.title,
              source_url: p.url,
              price: p.price,
              currency: p.currency || 'GBP',
              image_urls: [],
              specs: {},
              available: true,
              category_id: scrapedData.category.id,
            }));
            storedCount = await this.databaseService.upsertProducts(products);
          }
          storedCount += 1; // Add the category itself
          break;
          
        case 'product':
          storedCount = await this.databaseService.upsertProduct(scrapedData);
          break;
      }

      result.metadata = result.metadata || {};
      result.metadata['itemsStored'] = storedCount;

      logger.info('Data storage completed', {
        jobId: job.id,
        type: job.type,
        itemsStored: storedCount,
      });

    } catch (error) {
      const errorMessage = `Database storage failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMessage);
      logger.error('Database storage error', {
        jobId: job.id,
        error: errorMessage,
      });
      
      throw error; // Database errors should fail the job
    }
  }

  /**
   * Update worker metrics
   */
  private updateMetrics(success: boolean, duration: number): void {
    this.metrics.jobsProcessed++;
    this.metrics.totalProcessingTime += duration;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.jobsProcessed;
    this.metrics.lastJobProcessedAt = new Date();

    if (success) {
      this.metrics.jobsSucceeded++;
    } else {
      this.metrics.jobsFailed++;
    }
  }

  /**
   * Get current worker metrics
   */
  getMetrics(): WorkerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get worker health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    details: {
      worker: WorkerMetrics;
      jobManager: any;
      database: boolean;
      imageProcessor: boolean;
    };
  }> {
    try {
      const jobManagerHealth = await this.jobManager.healthCheck();
      
      const databaseHealthy = this.options.enableDatabaseStorage 
        ? await this.databaseService.healthCheck()
        : true;

      const imageProcessorHealthy = this.options.enableImageProcessing
        ? await this.imageProcessor.healthCheck()
        : true;

      const overallHealthy = jobManagerHealth.status === 'healthy' && 
                           databaseHealthy && 
                           imageProcessorHealthy;

      return {
        status: overallHealthy ? 'healthy' : 'degraded',
        details: {
          worker: this.getMetrics(),
          jobManager: jobManagerHealth.details,
          database: databaseHealthy,
          imageProcessor: imageProcessorHealthy,
        },
      };
    } catch (error) {
      logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        status: 'unhealthy',
        details: {
          worker: this.getMetrics(),
          jobManager: null,
          database: false,
          imageProcessor: false,
        },
      };
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown`);
      
      try {
        // Set a timeout for graceful shutdown
        const shutdownTimeout = setTimeout(() => {
          logger.error('Graceful shutdown timeout, forcing exit');
          process.exit(1);
        }, this.options.gracefulShutdownTimeout);

        await this.stop();
        clearTimeout(shutdownTimeout);
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      shutdown('unhandledRejection');
    });
  }

  /**
   * Add a job to the queue (convenience method)
   */
  async addJob(job: Omit<import('../types').ScrapeJob, 'id' | 'created_at'>): Promise<string> {
    return await this.jobManager.addJob(job);
  }

  /**
   * Get queue statistics (convenience method)
   */
  async getQueueStats() {
    return await this.jobManager.getStats();
  }

  /**
   * Check if worker is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get active job count (placeholder - would need to track active jobs)
   */
  getActiveJobCount(): number {
    // This would require tracking active jobs in the worker
    // For now, return 0 as a placeholder
    return 0;
  }

  /**
   * Get last activity timestamp
   */
  getLastActivity(): Date | null {
    return this.metrics.lastJobProcessedAt || null;
  }
}