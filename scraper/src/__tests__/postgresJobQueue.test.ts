import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { DatabaseService } from '../services/database';
import { PostgresJobQueue } from '../services/postgresJobQueue';

// Mock the logger to avoid console output during tests
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the config to provide test environment variables
vi.mock('../config/environment', () => ({
  config: {
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'test-anon-key',
    NODE_ENV: 'test',
  },
}));

describe('PostgresJobQueue', () => {
  let database: DatabaseService;
  let jobQueue: PostgresJobQueue;
  let skipTests = false;

  beforeAll(async () => {
    // Check if we have database credentials
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('Skipping PostgresJobQueue tests - no database credentials provided');
      skipTests = true;
      return;
    }

    try {
      // Initialize database service for testing
      database = new DatabaseService();
      await database.initialize();
      
      // Test database connection
      const isConnected = await database.healthCheck();
      if (!isConnected) {
        console.warn('Skipping PostgresJobQueue tests - database connection failed');
        skipTests = true;
        return;
      }
      
      // Ensure we have a clean test environment
      const client = database.getClient();
      await client.from('scrape_job').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (error) {
      console.warn('Skipping PostgresJobQueue tests - database setup failed:', error);
      skipTests = true;
    }
  });

  afterAll(async () => {
    if (database) {
      await database.close();
    }
  });

  beforeEach(async () => {
    if (skipTests) return;
    
    // Create fresh job queue instance for each test
    jobQueue = new PostgresJobQueue(database, {
      lockTTL: 5000, // 5 seconds for faster testing
      pollInterval: 100, // 100ms for faster testing
      maxRetries: 3,
      cleanupInterval: 1000, // 1 second for faster testing
      cleanupTTL: 5000, // 5 seconds for faster testing
    });
    
    await jobQueue.initialize();
    
    // Clear any existing jobs
    await jobQueue.clearAllJobs();
  });

  afterEach(async () => {
    if (skipTests) return;
    
    if (jobQueue) {
      await jobQueue.shutdown();
    }
  });

  describe('Job Queue Operations', () => {
    it('should add a job to the queue', async () => {
      if (skipTests) {
        console.log('Skipping test - no database connection');
        return;
      }
      const jobId = await jobQueue.addJob(
        'product',
        'https://example.com/product/123',
        1,
        { test: 'data' }
      );

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      const stats = await jobQueue.getStats();
      expect(stats.queued).toBe(1);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('should dequeue jobs in priority order', async () => {
      // Add jobs with different priorities
      const lowPriorityJobId = await jobQueue.addJob('product', 'https://example.com/low', 1);
      const highPriorityJobId = await jobQueue.addJob('product', 'https://example.com/high', 10);
      const mediumPriorityJobId = await jobQueue.addJob('product', 'https://example.com/medium', 5);

      // Dequeue jobs - should come out in priority order (high to low)
      const job1 = await jobQueue.dequeueJob();
      const job2 = await jobQueue.dequeueJob();
      const job3 = await jobQueue.dequeueJob();

      expect(job1?.id).toBe(highPriorityJobId);
      expect(job1?.priority).toBe(10);
      
      expect(job2?.id).toBe(mediumPriorityJobId);
      expect(job2?.priority).toBe(5);
      
      expect(job3?.id).toBe(lowPriorityJobId);
      expect(job3?.priority).toBe(1);

      // No more jobs should be available
      const job4 = await jobQueue.dequeueJob();
      expect(job4).toBeNull();
    });

    it('should handle concurrent job dequeuing with row-level locking', async () => {
      // Add multiple jobs
      const jobIds = await Promise.all([
        jobQueue.addJob('product', 'https://example.com/1', 1),
        jobQueue.addJob('product', 'https://example.com/2', 1),
        jobQueue.addJob('product', 'https://example.com/3', 1),
      ]);

      // Create multiple job queues to simulate concurrent workers
      const queue1 = new PostgresJobQueue(database, { lockTTL: 5000 });
      const queue2 = new PostgresJobQueue(database, { lockTTL: 5000 });
      
      await queue1.initialize();
      await queue2.initialize();

      try {
        // Dequeue jobs concurrently
        const [job1, job2] = await Promise.all([
          queue1.dequeueJob(),
          queue2.dequeueJob(),
        ]);

        // Both should get different jobs (no duplicates due to row-level locking)
        expect(job1).not.toBeNull();
        expect(job2).not.toBeNull();
        expect(job1?.id).not.toBe(job2?.id);

        // Verify both jobs are marked as running
        const stats = await jobQueue.getStats();
        expect(stats.running).toBe(2);
        expect(stats.queued).toBe(1);
      } finally {
        await queue1.shutdown();
        await queue2.shutdown();
      }
    });

    it('should complete a job successfully', async () => {
      const jobId = await jobQueue.addJob('product', 'https://example.com/product');
      const job = await jobQueue.dequeueJob();
      
      expect(job).not.toBeNull();
      expect(job?.id).toBe(jobId);

      const result = {
        success: true,
        itemsProcessed: 5,
        errors: [],
        duration: 1000,
        metadata: { processed: true },
      };

      await jobQueue.completeJob(jobId, result);

      const stats = await jobQueue.getStats();
      expect(stats.completed).toBe(1);
      expect(stats.running).toBe(0);
    });

    it('should handle job failure with retry logic', async () => {
      const jobId = await jobQueue.addJob('product', 'https://example.com/product', 0, {}, 2); // max 2 attempts
      
      // First attempt - fail
      let job = await jobQueue.dequeueJob();
      expect(job).not.toBeNull();
      
      await jobQueue.failJob(jobId, 'Test error');
      
      let stats = await jobQueue.getStats();
      expect(stats.queued).toBe(1); // Should be requeued for retry
      expect(stats.failed).toBe(0); // Not permanently failed yet
      
      // Second attempt - fail again
      job = await jobQueue.dequeueJob();
      expect(job).not.toBeNull();
      
      await jobQueue.failJob(jobId, 'Test error again');
      
      stats = await jobQueue.getStats();
      expect(stats.queued).toBe(0);
      expect(stats.failed).toBe(1); // Now permanently failed
    });

    it('should requeue failed jobs that can be retried', async () => {
      const jobId = await jobQueue.addJob('product', 'https://example.com/product', 0, {}, 3);
      
      // Fail the job once
      const job = await jobQueue.dequeueJob();
      await jobQueue.failJob(jobId, 'Test error');
      
      // Get retryable jobs
      const retryableJobs = await jobQueue.getRetryableJobs();
      expect(retryableJobs.length).toBe(1);
      expect(retryableJobs[0].id).toBe(jobId);
      
      // Requeue the job
      const success = await jobQueue.requeueJob(jobId);
      expect(success).toBe(true);
      
      const stats = await jobQueue.getStats();
      expect(stats.queued).toBe(1);
      expect(stats.failed).toBe(0);
    });

    it('should not requeue jobs that have exceeded max attempts', async () => {
      const jobId = await jobQueue.addJob('product', 'https://example.com/product', 0, {}, 1); // max 1 attempt
      
      // Fail the job (exceeds max attempts)
      const job = await jobQueue.dequeueJob();
      await jobQueue.failJob(jobId, 'Test error');
      
      // Should not be retryable
      const retryableJobs = await jobQueue.getRetryableJobs();
      expect(retryableJobs.length).toBe(0);
      
      // Requeue should fail
      const success = await jobQueue.requeueJob(jobId);
      expect(success).toBe(false);
      
      const stats = await jobQueue.getStats();
      expect(stats.failed).toBe(1);
      expect(stats.queued).toBe(0);
    });
  });

  describe('Lock Management', () => {
    it('should handle expired locks', async () => {
      // Create a job queue with very short lock TTL
      const shortLockQueue = new PostgresJobQueue(database, {
        lockTTL: 100, // 100ms
      });
      await shortLockQueue.initialize();

      try {
        const jobId = await shortLockQueue.addJob('product', 'https://example.com/product');
        
        // Dequeue job (locks it)
        const job = await shortLockQueue.dequeueJob();
        expect(job).not.toBeNull();
        
        // Wait for lock to expire
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Another worker should be able to dequeue the same job
        const expiredJob = await jobQueue.dequeueJob();
        expect(expiredJob).not.toBeNull();
        expect(expiredJob?.id).toBe(jobId);
      } finally {
        await shortLockQueue.shutdown();
      }
    });

    it('should release worker locks on shutdown', async () => {
      const workerQueue = new PostgresJobQueue(database, { lockTTL: 60000 }); // 1 minute
      await workerQueue.initialize();

      const jobId = await workerQueue.addJob('product', 'https://example.com/product');
      
      // Dequeue job (locks it)
      const job = await workerQueue.dequeueJob();
      expect(job).not.toBeNull();
      
      let stats = await jobQueue.getStats();
      expect(stats.running).toBe(1);
      
      // Shutdown should release locks
      await workerQueue.shutdown();
      
      // Job should be available again
      const releasedJob = await jobQueue.dequeueJob();
      expect(releasedJob).not.toBeNull();
      expect(releasedJob?.id).toBe(jobId);
    });
  });

  describe('Queue Statistics and Health', () => {
    it('should provide accurate queue statistics', async () => {
      // Add jobs in different states
      const queuedJobId = await jobQueue.addJob('product', 'https://example.com/queued');
      const runningJobId = await jobQueue.addJob('product', 'https://example.com/running');
      const completedJobId = await jobQueue.addJob('product', 'https://example.com/completed');
      const failedJobId = await jobQueue.addJob('product', 'https://example.com/failed', 0, {}, 1);

      // Process jobs to different states
      let job = await jobQueue.dequeueJob(); // running job
      job = await jobQueue.dequeueJob(); // completed job
      await jobQueue.completeJob(completedJobId, {
        success: true,
        itemsProcessed: 1,
        errors: [],
        duration: 100,
      });
      
      job = await jobQueue.dequeueJob(); // failed job
      await jobQueue.failJob(failedJobId, 'Test failure');

      const stats = await jobQueue.getStats();
      expect(stats.queued).toBe(1);
      expect(stats.running).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });

    it('should provide health check information', async () => {
      const health = await jobQueue.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.details.initialized).toBe(true);
      expect(health.details.workerId).toBeDefined();
      expect(health.details.databaseConnected).toBe(true);
      expect(health.details.stats).toBeDefined();
    });
  });

  describe('Job Cleanup', () => {
    it('should clear all jobs when requested', async () => {
      // Add some jobs
      await jobQueue.addJob('product', 'https://example.com/1');
      await jobQueue.addJob('product', 'https://example.com/2');
      await jobQueue.addJob('product', 'https://example.com/3');

      let stats = await jobQueue.getStats();
      expect(stats.queued).toBe(3);

      // Clear all jobs
      await jobQueue.clearAllJobs();

      stats = await jobQueue.getStats();
      expect(stats.queued).toBe(0);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Create a job queue with invalid database
      const invalidDatabase = new DatabaseService();
      // Don't initialize it to simulate connection failure
      
      const invalidQueue = new PostgresJobQueue(invalidDatabase);
      
      // Should throw error on initialization
      await expect(invalidQueue.initialize()).rejects.toThrow();
    });

    it('should handle invalid job parameters', async () => {
      // Test with invalid job type
      await expect(
        jobQueue.addJob('invalid' as any, 'https://example.com/test')
      ).rejects.toThrow();
    });
  });
});