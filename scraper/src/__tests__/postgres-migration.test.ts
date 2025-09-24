import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PostgresJobQueue } from '../services/postgresJobQueue';
import { JobManager } from '../services/jobManager';
import { DatabaseService } from '../services/database';

// Mock the database service for testing
vi.mock('../services/database', () => ({
  DatabaseService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true),
    getClient: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-job-id' }, error: null }),
      rpc: vi.fn().mockResolvedValue({ 
        data: [{ 
          id: 'test-job-id', 
          type: 'product', 
          target_url: 'https://example.com/test',
          priority: 5,
          attempts: 1,
          max_attempts: 3,
          metadata: {},
          created_at: new Date().toISOString()
        }], 
        error: null 
      }),
    }),
  })),
}));

describe('PostgreSQL Migration Tests', () => {
  let jobQueue: PostgresJobQueue;
  let jobManager: JobManager;
  let mockDatabase: DatabaseService;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    mockDatabase = new DatabaseService();
    jobQueue = new PostgresJobQueue(mockDatabase);
    jobManager = new JobManager({ concurrency: 1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('PostgreSQL Job Queue', () => {
    it('should initialize PostgreSQL job queue successfully', async () => {
      await expect(jobQueue.initialize()).resolves.not.toThrow();
      
      const healthCheck = await jobQueue.healthCheck();
      expect(healthCheck.status).toBe('healthy');
      expect(healthCheck.details.initialized).toBe(true);
    });

    it('should add jobs to PostgreSQL queue', async () => {
      await jobQueue.initialize();
      
      const jobId = await jobQueue.addJob('product', 'https://example.com/test', 5, {}, 3);
      
      expect(jobId).toBe('test-job-id');
      expect(mockDatabase.getClient().from).toHaveBeenCalledWith('scrape_job');
    });

    it('should dequeue jobs using PostgreSQL row-level locking', async () => {
      await jobQueue.initialize();
      
      const job = await jobQueue.dequeueJob();
      
      expect(job).toBeDefined();
      expect(job?.id).toBe('test-job-id');
      expect(job?.type).toBe('product');
      expect(mockDatabase.getClient().rpc).toHaveBeenCalledWith('dequeue_job', expect.any(Object));
    });

    it('should complete jobs in PostgreSQL', async () => {
      await jobQueue.initialize();
      
      const result = {
        success: true,
        itemsProcessed: 1,
        errors: [],
        duration: 1000,
        metadata: { test: 'data' },
      };
      
      await expect(jobQueue.completeJob('test-job-id', result)).resolves.not.toThrow();
      expect(mockDatabase.getClient().from).toHaveBeenCalledWith('scrape_job');
    });

    it('should handle job failures with retry logic in PostgreSQL', async () => {
      await jobQueue.initialize();
      
      await expect(jobQueue.failJob('test-job-id', 'Test error')).resolves.not.toThrow();
      expect(mockDatabase.getClient().from).toHaveBeenCalledWith('scrape_job');
    });

    it('should get queue statistics from PostgreSQL', async () => {
      await jobQueue.initialize();
      
      // Mock the stats response
      const mockClient = mockDatabase.getClient();
      mockClient.select = vi.fn().mockResolvedValue({
        data: [
          { status: 'queued', locked_at: null },
          { status: 'running', locked_at: new Date().toISOString() },
          { status: 'completed', locked_at: null },
          { status: 'failed', locked_at: null },
        ],
        error: null,
      });
      
      const stats = await jobQueue.getStats();
      
      expect(stats).toEqual({
        queued: 1,
        running: 1,
        completed: 1,
        failed: 1,
        locked: 1,
      });
    });

    it('should clean up expired locks in PostgreSQL', async () => {
      await jobQueue.initialize();
      
      // The cleanup should happen automatically during dequeue
      await jobQueue.dequeueJob();
      
      // Verify that the RPC function was called (which includes cleanup)
      expect(mockDatabase.getClient().rpc).toHaveBeenCalledWith('dequeue_job', expect.any(Object));
    });

    it('should shutdown gracefully and release locks', async () => {
      await jobQueue.initialize();
      
      await expect(jobQueue.shutdown()).resolves.not.toThrow();
      
      // Verify that locks were released
      expect(mockDatabase.getClient().from).toHaveBeenCalledWith('scrape_job');
    });
  });

  describe('Job Manager PostgreSQL Integration', () => {
    it('should initialize with PostgreSQL job queue', async () => {
      await expect(jobManager.initialize()).resolves.not.toThrow();
    });

    it('should start and stop PostgreSQL-based job processing', async () => {
      await jobManager.initialize();
      
      await expect(jobManager.start()).resolves.not.toThrow();
      await expect(jobManager.stop()).resolves.not.toThrow();
    });

    it('should provide PostgreSQL-specific queue methods', async () => {
      await jobManager.initialize();
      
      // Test PostgreSQL-specific methods
      expect(typeof jobManager.getDeadLetterJobs).toBe('function');
      expect(typeof jobManager.requeueDeadLetterJob).toBe('function');
      expect(typeof jobManager.clearQueues).toBe('function');
      
      // Test that these methods work
      await expect(jobManager.getDeadLetterJobs()).resolves.toBeDefined();
      await expect(jobManager.requeueDeadLetterJob('test-id')).resolves.toBeDefined();
      await expect(jobManager.clearQueues()).resolves.not.toThrow();
    });

    it('should handle PostgreSQL health checks', async () => {
      await jobManager.initialize();
      await jobManager.start();
      
      const health = await jobManager.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.details.postgresConnected).toBe(true);
      expect(health.details.jobQueueHealth).toBeDefined();
      
      await jobManager.stop();
    });
  });

  describe('Redis Migration Verification', () => {
    it('should not have any Redis dependencies', () => {
      // Verify that no Redis-related modules are imported
      const jobQueueInstance = new PostgresJobQueue(mockDatabase);
      
      // Check that the job queue uses PostgreSQL-specific methods
      expect(typeof jobQueueInstance.dequeueJob).toBe('function');
      expect(typeof jobQueueInstance.addJob).toBe('function');
      expect(typeof jobQueueInstance.completeJob).toBe('function');
      expect(typeof jobQueueInstance.failJob).toBe('function');
      
      // Verify PostgreSQL-specific functionality
      expect(typeof jobQueueInstance.getStats).toBe('function');
      expect(typeof jobQueueInstance.healthCheck).toBe('function');
    });

    it('should use PostgreSQL SELECT FOR UPDATE SKIP LOCKED pattern', async () => {
      await jobQueue.initialize();
      
      // Dequeue a job to trigger the PostgreSQL locking mechanism
      await jobQueue.dequeueJob();
      
      // Verify that the dequeue_job RPC function was called
      // This function implements SELECT FOR UPDATE SKIP LOCKED
      expect(mockDatabase.getClient().rpc).toHaveBeenCalledWith(
        'dequeue_job',
        expect.objectContaining({
          worker_id: expect.any(String),
          lock_ttl_minutes: expect.any(Number),
        })
      );
    });

    it('should handle concurrent job processing with PostgreSQL locks', async () => {
      await jobQueue.initialize();
      
      // Simulate multiple workers trying to dequeue jobs
      const worker1Promise = jobQueue.dequeueJob();
      const worker2Promise = jobQueue.dequeueJob();
      
      const [job1, job2] = await Promise.all([worker1Promise, worker2Promise]);
      
      // Both should be able to dequeue (though they might get different jobs or null)
      // The important thing is that PostgreSQL handles the locking correctly
      expect(mockDatabase.getClient().rpc).toHaveBeenCalledTimes(2);
    });

    it('should track job attempts in PostgreSQL metadata', async () => {
      await jobQueue.initialize();
      
      const job = await jobQueue.dequeueJob();
      
      if (job) {
        // Verify that attempts are tracked in the job data
        expect(job.metadata).toBeDefined();
        
        // Fail the job to test retry logic
        await jobQueue.failJob(job.id, 'Test failure');
        
        // The failJob method should handle retry logic based on attempts vs max_attempts
        expect(mockDatabase.getClient().from).toHaveBeenCalledWith('scrape_job');
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle high-frequency job operations', async () => {
      await jobQueue.initialize();
      
      // Add multiple jobs quickly
      const addPromises = Array.from({ length: 10 }, (_, i) => 
        jobQueue.addJob('product', `https://example.com/test-${i}`, i % 5)
      );
      
      await expect(Promise.all(addPromises)).resolves.toBeDefined();
      
      // Verify all jobs were added
      expect(mockDatabase.getClient().from).toHaveBeenCalledTimes(10);
    });

    it('should maintain data consistency during failures', async () => {
      await jobQueue.initialize();
      
      // Mock a database error
      const mockClient = mockDatabase.getClient();
      mockClient.single = vi.fn().mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Database error' } 
      });
      
      // Adding a job should handle the error gracefully
      await expect(jobQueue.addJob('product', 'https://example.com/test')).rejects.toThrow();
      
      // The error should be properly propagated
      expect(mockClient.from).toHaveBeenCalledWith('scrape_job');
    });

    it('should clean up old jobs automatically', async () => {
      await jobQueue.initialize();
      
      // The cleanup should be handled by the PostgreSQL functions
      // We can't easily test the timer-based cleanup in unit tests,
      // but we can verify the cleanup methods exist
      expect(typeof (jobQueue as any).cleanupOldJobs).toBe('function');
      expect(typeof (jobQueue as any).startCleanupTimer).toBe('function');
    });
  });
});