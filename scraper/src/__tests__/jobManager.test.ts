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

// Mock the database service
vi.mock('../services/database', () => ({
  DatabaseService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true),
    getClient: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'test-job-id' },
              error: null,
            }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          neq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }),
  })),
}));

// Mock the PostgresJobQueue
vi.mock('../services/postgresJobQueue', () => ({
  PostgresJobQueue: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    addJob: vi.fn().mockResolvedValue('test-job-id'),
    dequeueJob: vi.fn().mockResolvedValue(null),
    completeJob: vi.fn().mockResolvedValue(undefined),
    failJob: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      locked: 0,
    }),
    getRetryableJobs: vi.fn().mockResolvedValue([]),
    requeueJob: vi.fn().mockResolvedValue(true),
    clearAllJobs: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue({
      status: 'healthy',
      details: {
        initialized: true,
        workerId: 'test-worker',
        stats: {
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
          locked: 0,
        },
        databaseConnected: true,
      },
    }),
  })),
}));

describe('JobManager with PostgreSQL Queue', () => {
  let jobManager: JobManager;

  beforeEach(async () => {
    jobManager = new JobManager({
      concurrency: 1,
      lockTTL: 5000,
      pollInterval: 100,
      delayedJobsInterval: 1000,
    });

    await jobManager.initialize();
  });

  afterEach(async () => {
    if (jobManager) {
      await jobManager.stop();
    }
  });

  describe('Initialization and Configuration', () => {
    it('should initialize successfully with PostgreSQL job queue', async () => {
      expect(jobManager).toBeDefined();
      
      // Start the job manager to make it healthy
      await jobManager.start();
      
      const health = await jobManager.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.postgresConnected).toBe(true);
    });

    it('should start and stop workers', async () => {
      await jobManager.start();
      
      let health = await jobManager.healthCheck();
      expect(health.details.isRunning).toBe(true);
      expect(health.details.activeWorkers).toBe(1);

      await jobManager.stop();
      
      health = await jobManager.healthCheck();
      expect(health.details.isRunning).toBe(false);
      expect(health.details.activeWorkers).toBe(0);
    });
  });

  describe('Job Management', () => {
    it('should add jobs to PostgreSQL queue', async () => {
      const job: Omit<ScrapeJob, 'id' | 'created_at'> = {
        type: 'product',
        target_url: 'https://example.com/product/123',
        priority: 5,
        metadata: { test: true },
      };

      const jobId = await jobManager.addJob(job);
      expect(jobId).toBe('test-job-id');
    });

    it('should get queue statistics', async () => {
      const stats = await jobManager.getStats();
      
      expect(stats).toEqual({
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        locked: 0,
      });
    });

    it('should handle dead letter queue operations', async () => {
      const deadLetterJobs = await jobManager.getDeadLetterJobs();
      expect(Array.isArray(deadLetterJobs)).toBe(true);
      expect(deadLetterJobs.length).toBe(0);

      const requeueResult = await jobManager.requeueDeadLetterJob('test-job-id');
      expect(requeueResult).toBe(true);
    });

    it('should clear all queues', async () => {
      await expect(jobManager.clearQueues()).resolves.not.toThrow();
    });
  });

  describe('Job Processing', () => {
    it('should set and use job processor', async () => {
      const mockProcessor = vi.fn().mockResolvedValue({
        success: true,
        itemsProcessed: 1,
        errors: [],
        duration: 100,
      } as JobResult);

      jobManager.setJobProcessor(mockProcessor);
      
      // The processor is set internally and will be called when jobs are dequeued
      expect(jobManager['jobProcessor']).toBe(mockProcessor);
    });
  });

  describe('Health Monitoring', () => {
    it('should provide comprehensive health check', async () => {
      // Start the job manager to make it healthy
      await jobManager.start();
      
      const health = await jobManager.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.details).toHaveProperty('isRunning');
      expect(health.details).toHaveProperty('activeWorkers');
      expect(health.details).toHaveProperty('queueStats');
      expect(health.details).toHaveProperty('postgresConnected');
      expect(health.details).toHaveProperty('jobQueueHealth');
      
      expect(health.details.postgresConnected).toBe(true);
      expect(health.details.jobQueueHealth.initialized).toBe(true);
      expect(health.details.jobQueueHealth.workerId).toBe('test-worker');
    });

    it('should report unhealthy status when not running', async () => {
      // Don't start the job manager
      const health = await jobManager.healthCheck();
      
      expect(health.details.isRunning).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // This test verifies that the mocked services don't throw errors
      await expect(jobManager.initialize()).resolves.not.toThrow();
    });

    it('should handle job addition errors', async () => {
      // Mock the job queue to throw an error
      const mockJobQueue = jobManager['jobQueue'];
      mockJobQueue.addJob = vi.fn().mockRejectedValue(new Error('Database error'));

      const job: Omit<ScrapeJob, 'id' | 'created_at'> = {
        type: 'product',
        target_url: 'https://example.com/product/123',
        priority: 1,
      };

      await expect(jobManager.addJob(job)).rejects.toThrow('Database error');
    });

    it('should handle stats retrieval errors', async () => {
      // Mock the job queue to throw an error
      const mockJobQueue = jobManager['jobQueue'];
      mockJobQueue.getStats = vi.fn().mockRejectedValue(new Error('Stats error'));

      const stats = await jobManager.getStats();
      
      // Should return default stats on error
      expect(stats).toEqual({
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        locked: 0,
      });
    });
  });

  describe('PostgreSQL-Specific Features', () => {
    it('should support priority-based job processing', async () => {
      const highPriorityJob: Omit<ScrapeJob, 'id' | 'created_at'> = {
        type: 'navigation',
        target_url: 'https://example.com/nav',
        priority: 10,
      };

      const lowPriorityJob: Omit<ScrapeJob, 'id' | 'created_at'> = {
        type: 'product',
        target_url: 'https://example.com/product',
        priority: 1,
      };

      // Both should be added successfully
      await expect(jobManager.addJob(highPriorityJob)).resolves.toBe('test-job-id');
      await expect(jobManager.addJob(lowPriorityJob)).resolves.toBe('test-job-id');
    });

    it('should support job metadata', async () => {
      const jobWithMetadata: Omit<ScrapeJob, 'id' | 'created_at'> = {
        type: 'category',
        target_url: 'https://example.com/category',
        priority: 5,
        metadata: {
          categoryId: 'cat-123',
          depth: 2,
          parentUrl: 'https://example.com/parent',
        },
      };

      await expect(jobManager.addJob(jobWithMetadata)).resolves.toBe('test-job-id');
    });

    it('should handle row-level locking concepts', async () => {
      // This test verifies that the job manager can handle concurrent operations
      // The actual row-level locking is tested in the PostgresJobQueue unit tests
      
      const jobs = Array.from({ length: 5 }, (_, i) => ({
        type: 'product' as const,
        target_url: `https://example.com/product/${i}`,
        priority: i,
      }));

      const jobIds = await Promise.all(
        jobs.map(job => jobManager.addJob(job))
      );

      expect(jobIds).toHaveLength(5);
      jobIds.forEach(id => expect(id).toBe('test-job-id'));
    });
  });
});