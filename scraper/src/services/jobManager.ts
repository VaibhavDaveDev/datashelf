import { ScrapeJob, JobResult } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { DatabaseService } from './database';
import { PostgresJobQueue } from './postgresJobQueue';

export interface JobManagerOptions {
  concurrency?: number;
  lockTTL?: number;
  pollInterval?: number;
  delayedJobsInterval?: number;
}

export class JobManager {
  private isRunning = false;
  private workers: Promise<void>[] = [];
  private delayedJobsTimer?: NodeJS.Timeout | undefined;
  private readonly options: Required<JobManagerOptions>;
  private database: DatabaseService;
  private jobQueue: PostgresJobQueue;

  constructor(options: JobManagerOptions = {}) {
    this.options = {
      concurrency: options.concurrency || config.SCRAPER_CONCURRENT_JOBS,
      lockTTL: options.lockTTL || 10 * 60 * 1000, // 10 minutes
      pollInterval: options.pollInterval || 1000, // 1 second
      delayedJobsInterval: options.delayedJobsInterval || 30 * 1000, // 30 seconds
    };

    // Initialize PostgreSQL job queue
    this.database = new DatabaseService();
    this.jobQueue = new PostgresJobQueue(this.database, {
      lockTTL: this.options.lockTTL,
      pollInterval: this.options.pollInterval,
      maxRetries: 3,
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      cleanupTTL: 24 * 60 * 60 * 1000, // 24 hours
    });
  }

  /**
   * Initialize the job manager
   */
  async initialize(): Promise<void> {
    try {
      // Initialize database and job queue
      await this.database.initialize();
      await this.jobQueue.initialize();
      
      logger.info('Job manager initialized', {
        concurrency: this.options.concurrency,
        lockTTL: this.options.lockTTL,
        pollInterval: this.options.pollInterval,
      });
    } catch (error) {
      logger.error('Failed to initialize job manager', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Start processing jobs
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Job manager is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting job manager');

    // Start worker processes
    for (let i = 0; i < this.options.concurrency; i++) {
      const worker = this.startWorker(i);
      this.workers.push(worker);
    }

    // Start delayed jobs processor
    this.startDelayedJobsProcessor();

    logger.info('Job manager started', { workers: this.options.concurrency });
  }

  /**
   * Stop processing jobs
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Job manager is not running');
      return;
    }

    logger.info('Stopping job manager');
    this.isRunning = false;

    // Stop delayed jobs timer
    if (this.delayedJobsTimer) {
      clearInterval(this.delayedJobsTimer);
      this.delayedJobsTimer = undefined;
    }

    // Wait for all workers to finish
    await Promise.all(this.workers);
    this.workers = [];

    // Shutdown job queue and database
    await this.jobQueue.shutdown();
    await this.database.close();
    
    logger.info('Job manager stopped');
  }

  /**
   * Add a job to the queue
   */
  async addJob(job: Omit<ScrapeJob, 'id' | 'created_at'>): Promise<string> {
    try {
      const jobId = await this.jobQueue.addJob(
        job.type,
        job.target_url,
        job.priority || 0,
        job.metadata || {},
        3 // max attempts
      );
      
      logger.info('Job added to queue', {
        jobId,
        type: job.type,
        target_url: job.target_url,
        priority: job.priority || 0,
      });
      
      return jobId;
    } catch (error) {
      logger.error('Failed to add job to queue', {
        type: job.type,
        target_url: job.target_url,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    try {
      return await this.jobQueue.getStats();
    } catch (error) {
      logger.error('Failed to get queue stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        locked: 0,
      };
    }
  }

  /**
   * Get queue statistics (alias for getStats for health check compatibility)
   */
  async getQueueStats() {
    return await this.getStats();
  }

  /**
   * Get dead letter queue jobs (failed jobs that can be retried)
   */
  async getDeadLetterJobs(limit?: number) {
    try {
      return await this.jobQueue.getRetryableJobs(limit || 20);
    } catch (error) {
      logger.error('Failed to get dead letter jobs', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Requeue a job from dead letter queue
   */
  async requeueDeadLetterJob(jobId: string): Promise<boolean> {
    try {
      return await this.jobQueue.requeueJob(jobId);
    } catch (error) {
      logger.error('Failed to requeue dead letter job', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Clear all queues (for testing)
   */
  async clearQueues(): Promise<void> {
    try {
      await this.jobQueue.clearAllJobs();
      logger.info('All queues cleared');
    } catch (error) {
      logger.error('Failed to clear queues', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Set job processor function
   */
  private jobProcessor?: (job: ScrapeJob) => Promise<JobResult>;

  setJobProcessor(processor: (job: ScrapeJob) => Promise<JobResult>): void {
    this.jobProcessor = processor;
  }

  /**
   * Start a worker process
   */
  private async startWorker(workerId: number): Promise<void> {
    logger.info('Worker started', { workerId });

    while (this.isRunning) {
      try {
        // Dequeue next job from PostgreSQL queue
        const job = await this.jobQueue.dequeueJob();
        
        if (!job) {
          // No jobs available, wait before polling again
          await this.sleep(this.options.pollInterval);
          continue;
        }

        // Process the job
        await this.processJob(job, workerId);

      } catch (error) {
        logger.error('Worker error', {
          workerId,
          error: error instanceof Error ? error.message : String(error),
        });
        
        // Wait before retrying to avoid tight error loops
        await this.sleep(this.options.pollInterval * 2);
      }
    }

    logger.info('Worker stopped', { workerId });
  }

  /**
   * Process a single job
   */
  private async processJob(job: ScrapeJob, workerId: number): Promise<void> {
    if (!this.jobProcessor) {
      await this.jobQueue.failJob(job.id, 'No job processor set');
      throw new Error('No job processor set');
    }

    logger.info('Processing job', {
      workerId,
      jobId: job.id,
      type: job.type,
      target_url: job.target_url,
    });

    const startTime = Date.now();
    
    try {
      const result = await this.jobProcessor(job);
      result.duration = Date.now() - startTime;
      
      if (result.success) {
        // Mark job as completed
        await this.jobQueue.completeJob(job.id, result);
        
        logger.info('Job completed successfully', {
          workerId,
          jobId: job.id,
          type: job.type,
          target_url: job.target_url,
          duration: result.duration,
          itemsProcessed: result.itemsProcessed,
        });
      } else {
        // Job completed but with errors
        const errorMessage = result.errors.length > 0 
          ? `Job completed with errors: ${result.errors.join(', ')}`
          : 'Job completed unsuccessfully';
        
        await this.jobQueue.failJob(job.id, errorMessage, result);
        
        logger.warn('Job completed with errors', {
          workerId,
          jobId: job.id,
          type: job.type,
          target_url: job.target_url,
          duration: result.duration,
          errors: result.errors,
        });
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Mark job as failed
      await this.jobQueue.failJob(job.id, errorMessage, { duration });
      
      logger.error('Job processing error', {
        workerId,
        jobId: job.id,
        type: job.type,
        target_url: job.target_url,
        duration,
        error: errorMessage,
      });
    }
  }

  /**
   * Start the delayed jobs processor (for retrying failed jobs)
   */
  private startDelayedJobsProcessor(): void {
    this.delayedJobsTimer = setInterval(async () => {
      try {
        // Get failed jobs that can be retried
        const retryableJobs = await this.jobQueue.getRetryableJobs(10);
        
        if (retryableJobs.length > 0) {
          logger.info('Found retryable jobs', { count: retryableJobs.length });
          
          // Requeue failed jobs that haven't exceeded max attempts
          for (const job of retryableJobs) {
            try {
              await this.jobQueue.requeueJob(job.id);
              logger.info('Requeued failed job', { jobId: job.id, type: job.type });
            } catch (error) {
              logger.error('Failed to requeue job', {
                jobId: job.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
      } catch (error) {
        logger.error('Error in delayed jobs processor', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.options.delayedJobsInterval);
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for the job manager
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      isRunning: boolean;
      activeWorkers: number;
      queueStats: any;
      postgresConnected: boolean;
      jobQueueHealth: any;
    };
  }> {
    try {
      const [queueStats, jobQueueHealth] = await Promise.all([
        this.getStats(),
        this.jobQueue.healthCheck()
      ]);
      
      const isHealthy = this.isRunning && 
                       jobQueueHealth.status === 'healthy' && 
                       jobQueueHealth.details.databaseConnected;
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: {
          isRunning: this.isRunning,
          activeWorkers: this.workers.length,
          queueStats,
          postgresConnected: jobQueueHealth.details.databaseConnected,
          jobQueueHealth: jobQueueHealth.details,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          isRunning: this.isRunning,
          activeWorkers: this.workers.length,
          queueStats: null,
          postgresConnected: false,
          jobQueueHealth: null,
        },
      };
    }
  }
}