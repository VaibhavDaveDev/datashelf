import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobManager } from '../services/jobManager';
import { ScrapeJob, JobResult } from '../types';

// Mock the logger to avoid console output during tests
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('JobManager Integration', () => {
  let jobManager: JobManager;

  beforeEach(async () => {
    jobManager = new JobManager({
      concurrency: 1,
      lockTTL: 5000, // 5 seconds for faster testing
      pollInterval: 100, // 100ms for faster testing
      delayedJobsInterval: 1000, // 1 second for faster testing
    });

    await jobManager.initialize();
    
    // Clear any existing jobs
    await jobManager.clearQueues();
  });

  afterEach(async () => {
    if (jobManager) {
      await jobManager.stop();
    }
  });

  describe('PostgreSQL Job Queue Integration', () => {
    it('should initialize and start successfully', async () => {
      await jobManager.start();
      
      const health = await jobManager.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.isRunning).toBe(true);
      expect(health.details.postgresConnected).toBe(true);
    });

    it('should add jobs to PostgreSQL queue', async () => {
      const job: Omit<ScrapeJob, 'id' | 'created_at'> = {
        type: 'product',
        target_url: 'https://example.com/product/123',
        priority: 5,
        metadata: { test: true },
      };

      const jobId = await jobManager.addJob(job);
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      const stats = await jobManager.getStats();
      expect(stats.queued).toBe(1);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('should process jobs with PostgreSQL queue', async () => {
      // Set up a mock job processor
      const mockProcessor = vi.fn().mockResolvedValue({
        success: true,
        itemsProcessed: 1,
        errors: [],
        duration: 100,
        metadata: { processed: true },
      } as JobResult);

      jobManager.setJobProcessor(mockProcessor);

      // Add a job
      const job: Omit<ScrapeJob, 'id' | 'created_at'> = {
        type: 'product',
        target_url: 'https://example.com/product/123',
        priority: 1,
        metadata: { test: true },
      };

      const jobId = await jobManager.addJob(job);
      
      // Start processing
      await jobManager.start();

      // Wait for job to be processed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify job was processed
      expect(mockProcessor).toHaveBeenCalledTimes(1);
      
      const stats = await jobManager.getStats();
      expect(stats.completed).toBe(1);
      expect(stats.queued).toBe(0);
    });

    it('should handle job failures with retry logic', async () => {
      let callCount = 0;
      const mockProcessor = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Test failure');
        }
        return {
          success: true,
          itemsProcessed: 1,
          errors: [],
          duration: 100,
        } as JobResult;
      });

      jobManager.setJobProcessor(mockProcessor);

      // Add a job
      const job: Omit<ScrapeJob, 'id' | 'created_at'> = {
        type: 'product',
        target_url: 'https://example.com/product/123',
        priority: 1,
        metadata: { test: true },
      };

      await jobManager.addJob(job);
      
      // Start processing
      await jobManager.start();

      // Wait for retries to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should have been called 3 times (initial + 2 retries)
      expect(mockProcessor).toHaveBeenCalledTimes(3);
      
      const stats = await jobManager.getStats();
      expect(stats.completed).toBe(1);
    });

    it('should handle dead letter queue operations', async () => {
      // Set up a processor that always fails
      const mockProcessor = vi.fn().mockRejectedValue(new Error('Always fails'));
      jobManager.setJobProcessor(mockProcessor);

      // Add a job with max 1 attempt
      const job: Omit<ScrapeJob, 'id' | 'created_at'> = {
        type: 'product',
        target_url: 'https://example.com/product/123',
        priority: 1,
        metadata: { test: true },
      };

      const jobId = await jobManager.addJob(job);
      
      // Start processing
      await jobManager.start();

      // Wait for job to fail permanently
      await new Promise(resolve => setTimeout(resolve, 1000));

      const stats = await jobManager.getStats();
      expect(stats.failed).toBeGreaterThan(0);

      // Check dead letter queue
      const deadLetterJobs = await jobManager.getDeadLetterJobs();
      expect(deadLetterJobs.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive health check information', async () => {
      await jobManager.start();

      const health = await jobManager.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.isRunning).toBe(true);
      expect(health.details.activeWorkers).toBe(1);
      expect(health.details.postgresConnected).toBe(true);
      expect(health.details.jobQueueHealth).toBeDefined();
      expect(health.details.jobQueueHealth.initialized).toBe(true);
      expect(health.details.jobQueueHealth.workerId).toBeDefined();
    });

    it('should handle concurrent job processing', async () => {
      const processedJobs: string[] = [];
      const mockProcessor = vi.fn().mockImplementation((job: ScrapeJob) => {
        processedJobs.push(job.id);
        return Promise.resolve({
          success: true,
          itemsProcessed: 1,
          errors: [],
          duration: 100,
        } as JobResult);
      });

      // Create job manager with higher concurrency
      const concurrentJobManager = new JobManager({
        concurrency: 3,
        lockTTL: 5000,
        pollInterval: 100,
      });

      await concurrentJobManager.initialize();
      await concurrentJobManager.clearQueues();
      concurrentJobManager.setJobProcessor(mockProcessor);

      try {
        // Add multiple jobs
        const jobIds = await Promise.all([
          concurrentJobManager.addJob({
            type: 'product',
            target_url: 'https://example.com/1',
            priority: 1,
          }),
          concurrentJobManager.addJob({
            type: 'product',
            target_url: 'https://example.com/2',
            priority: 1,
          }),
          concurrentJobManager.addJob({
            type: 'product',
            target_url: 'https://example.com/3',
            priority: 1,
          }),
        ]);

        await concurrentJobManager.start();

        // Wait for all jobs to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // All jobs should be processed
        expect(mockProcessor).toHaveBeenCalledTimes(3);
        expect(processedJobs).toHaveLength(3);
        
        // Verify no duplicate processing
        const uniqueJobs = new Set(processedJobs);
        expect(uniqueJobs.size).toBe(3);

        const stats = await concurrentJobManager.getStats();
        expect(stats.completed).toBe(3);
      } finally {
        await concurrentJobManager.stop();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization gracefully', async () => {
      // Should not throw during initialization
      await expect(jobManager.initialize()).resolves.not.toThrow();
    });

    it('should handle health check when not running', async () => {
      const health = await jobManager.healthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.details.isRunning).toBe(false);
    });

    it('should handle database connection issues', async () => {
      // Create job manager that will fail to connect
      const failingJobManager = new JobManager();
      
      // Mock database to fail
      const originalInitialize = failingJobManager['database'].initialize;
      failingJobManager['database'].initialize = vi.fn().mockRejectedValue(new Error('Connection failed'));

      await expect(failingJobManager.initialize()).rejects.toThrow('Connection failed');
    });
  });
});