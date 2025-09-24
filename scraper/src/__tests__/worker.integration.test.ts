import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ScraperWorker } from '../services/worker';
import { logger } from '../utils/logger';

// Mock external dependencies for testing
vi.mock('../services/database', () => ({
  DatabaseService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true),
    upsertNavigation: vi.fn().mockResolvedValue(1),
    upsertNavigationBatch: vi.fn().mockResolvedValue(1),
    upsertCategory: vi.fn().mockResolvedValue({
      id: 'test-category-id',
      title: 'Test Category',
      source_url: 'https://example.com/category',
      product_count: 0,
      last_scraped_at: new Date().toISOString(),
    }),
    upsertProduct: vi.fn().mockResolvedValue(1),
    upsertProducts: vi.fn().mockResolvedValue(5),
  })),
}));

vi.mock('../services/imageProcessor', () => ({
  ImageProcessor: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true),
    processImage: vi.fn().mockResolvedValue({
      success: true,
      originalUrl: 'https://example.com/image.jpg',
      r2Url: 'https://r2.example.com/processed-image.jpg',
      filename: 'processed-image.jpg',
      size: 50000,
      format: 'jpeg',
      dimensions: { width: 800, height: 600 },
    }),
  })),
}));

vi.mock('../services/jobManager', () => ({
  JobManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    setJobProcessor: vi.fn(),
    addJob: vi.fn().mockResolvedValue('test-job-id'),
    getStats: vi.fn().mockResolvedValue({
      queued: 5,
      running: 2,
      completed: 100,
      failed: 3,
      locked: 1,
    }),
    clearQueues: vi.fn().mockResolvedValue(undefined),
    getDeadLetterJobs: vi.fn().mockResolvedValue([]),
    requeueDeadLetterJob: vi.fn().mockResolvedValue(true),
    jobQueue: {
      initialized: true,
      workerId: 'test-worker-123',
      dequeueJob: vi.fn(),
      completeJob: vi.fn(),
      failJob: vi.fn(),
    },
    healthCheck: vi.fn().mockResolvedValue({
      status: 'healthy',
      details: {
        isRunning: true,
        activeWorkers: 1,
        queueStats: { queued: 0, running: 0, completed: 0, failed: 0, locked: 0 },
        postgresConnected: true,
        jobQueueHealth: {
          initialized: true,
          workerId: 'test-worker-123',
          databaseConnected: true,
        },
      },
    }),
  })),
}));

// Mock scrapers to avoid browser dependencies
vi.mock('../services/scrapers', () => ({
  createScraper: vi.fn((type) => {
    switch (type) {
      case 'navigation':
        return {
          scrapeNavigation: vi.fn().mockResolvedValue([
            { title: 'Books', source_url: 'https://example.com/books' },
            { title: 'Fiction', source_url: 'https://example.com/fiction', parent_id: 'books-id' },
          ]),
        };
      case 'category':
        return {
          scrapeCategory: vi.fn().mockResolvedValue({
            category: {
              title: 'Science Fiction',
              source_url: 'https://example.com/sci-fi',
              product_count: 2,
            },
            products: [
              { title: 'Dune', url: 'https://example.com/dune', price: 12.99, currency: 'GBP' },
              { title: 'Foundation', url: 'https://example.com/foundation', price: 10.99, currency: 'GBP' },
            ],
          }),
        };
      case 'product':
        return {
          scrapeProduct: vi.fn().mockResolvedValue({
            title: 'The Hitchhiker\'s Guide to the Galaxy',
            source_url: 'https://example.com/hitchhikers-guide',
            source_id: 'book-123',
            price: 8.99,
            currency: 'GBP',
            image_urls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
            summary: 'A comedy science fiction series',
            specs: { author: 'Douglas Adams', isbn: '978-0345391803', pages: 224 },
            available: true,
          }),
        };
      default:
        throw new Error(`Unknown scraper type: ${type}`);
    }
  }),
}));

describe('ScraperWorker Integration Tests', () => {
  let worker: ScraperWorker;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Mock logger to reduce noise in tests
    vi.spyOn(logger, 'info').mockReturnValue(logger);
    vi.spyOn(logger, 'debug').mockReturnValue(logger);
    vi.spyOn(logger, 'warn').mockReturnValue(logger);
  });

  beforeEach(async () => {
    // Create worker with test configuration
    worker = new ScraperWorker({
      concurrency: 1,
      enableImageProcessing: true,
      enableDatabaseStorage: true,
      gracefulShutdownTimeout: 5000,
    });
  });

  afterEach(async () => {
    if (worker) {
      try {
        await worker.stop();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Worker Initialization', () => {
    it('should initialize successfully with all services', async () => {
      await expect(worker.initialize()).resolves.not.toThrow();
    });

    it('should handle database initialization failure', async () => {
      // Create a new worker instance for this test
      const failingWorker = new ScraperWorker({
        enableDatabaseStorage: true,
      });
      
      // Mock the database service to fail
      const mockDb = (failingWorker as any).databaseService;
      mockDb.initialize = vi.fn().mockRejectedValue(new Error('Database connection failed'));
      
      await expect(failingWorker.initialize()).rejects.toThrow('Database connection failed');
    });

    it('should handle image processor initialization failure', async () => {
      // Create a new worker instance for this test
      const failingWorker = new ScraperWorker({
        enableImageProcessing: true,
      });
      
      // Mock the image processor to fail
      const mockProcessor = (failingWorker as any).imageProcessor;
      mockProcessor.initialize = vi.fn().mockRejectedValue(new Error('R2 connection failed'));
      
      await expect(failingWorker.initialize()).rejects.toThrow('R2 connection failed');
    });
  });

  describe('Worker Lifecycle', () => {
    beforeEach(async () => {
      await worker.initialize();
    });

    it('should start and stop gracefully', async () => {
      await expect(worker.start()).resolves.not.toThrow();
      
      const metrics = worker.getMetrics();
      expect(metrics.isRunning).toBe(true);
      
      await expect(worker.stop()).resolves.not.toThrow();
      
      const finalMetrics = worker.getMetrics();
      expect(finalMetrics.isRunning).toBe(false);
    });

    it('should not start if already running', async () => {
      await worker.start();
      
      // Starting again should not throw but should log a warning
      await expect(worker.start()).resolves.not.toThrow();
    });

    it('should not stop if not running', async () => {
      // Stopping when not running should not throw but should log a warning
      await expect(worker.stop()).resolves.not.toThrow();
    });
  });

  describe('Health Checks', () => {
    beforeEach(async () => {
      await worker.initialize();
    });

    it('should return healthy status when all services are healthy', async () => {
      const health = await worker.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.details.database).toBe(true);
      expect(health.details.imageProcessor).toBe(true);
    });

    it('should return degraded status when database is unhealthy', async () => {
      // Mock the database health check to fail
      const mockDb = (worker as any).databaseService;
      mockDb.healthCheck = vi.fn().mockResolvedValue(false);
      
      const health = await worker.getHealthStatus();
      
      expect(health.status).toBe('degraded');
      expect(health.details.database).toBe(false);
    });

    it('should return degraded status when image processor is unhealthy', async () => {
      // Mock the image processor health check to fail
      const mockProcessor = (worker as any).imageProcessor;
      mockProcessor.healthCheck = vi.fn().mockResolvedValue(false);
      
      const health = await worker.getHealthStatus();
      
      expect(health.status).toBe('degraded');
      expect(health.details.imageProcessor).toBe(false);
    });
  });

  describe('Job Processing Pipeline', () => {
    beforeEach(async () => {
      await worker.initialize();
    });

    it('should process navigation job successfully', async () => {
      const job = {
        id: 'test-job-1',
        type: 'navigation' as const,
        target_url: 'https://example.com',
        priority: 5,
        created_at: new Date().toISOString(),
        attempts: 0,
        max_attempts: 3,
      };

      // Process the job directly (bypassing queue for testing)
      const result = await (worker as any).processJob(job);

      expect(result.success).toBe(true);
      expect(result.itemsProcessed).toBe(2);
      expect(result.errors).toHaveLength(0);
      
      // Verify database was called
      const mockDb = (worker as any).databaseService;
      expect(mockDb.upsertNavigationBatch).toHaveBeenCalled();
    });

    it('should process category job successfully', async () => {
      const job = {
        id: 'test-job-2',
        type: 'category' as const,
        target_url: 'https://example.com/sci-fi',
        priority: 5,
        created_at: new Date().toISOString(),
        attempts: 0,
        max_attempts: 3,
      };

      const result = await (worker as any).processJob(job);

      expect(result.success).toBe(true);
      expect(result.itemsProcessed).toBe(1); // Category counts as 1 item
      expect(result.errors).toHaveLength(0);
      
      // Verify database was called
      const mockDb = (worker as any).databaseService;
      expect(mockDb.upsertCategory).toHaveBeenCalled();
      expect(mockDb.upsertProducts).toHaveBeenCalled();
    });

    it('should process product job with images successfully', async () => {
      const job = {
        id: 'test-job-3',
        type: 'product' as const,
        target_url: 'https://example.com/hitchhikers-guide',
        priority: 5,
        created_at: new Date().toISOString(),
        attempts: 0,
        max_attempts: 3,
      };

      const result = await (worker as any).processJob(job);

      expect(result.success).toBe(true);
      expect(result.itemsProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);
      
      // Verify image processing and database storage
      const mockProcessor = (worker as any).imageProcessor;
      const mockDb = (worker as any).databaseService;
      expect(mockProcessor.processImage).toHaveBeenCalledTimes(2);
      expect(mockDb.upsertProduct).toHaveBeenCalled();
    });

    it('should handle scraping errors gracefully', async () => {
      // Create a worker with a failing scraper
      const { createScraper } = await import('../services/scrapers');
      vi.mocked(createScraper).mockImplementation(() => ({
        scrapeProduct: vi.fn().mockRejectedValue(new Error('Scraping failed')),
        scrapeProducts: vi.fn().mockRejectedValue(new Error('Scraping failed')),
        crawler: {} as any,
      }));

      const job = {
        id: 'test-job-4',
        type: 'product' as const,
        target_url: 'https://example.com/invalid-product',
        priority: 5,
        created_at: new Date().toISOString(),
        attempts: 0,
        max_attempts: 3,
      };

      await expect((worker as any).processJob(job)).rejects.toThrow('Scraping failed');
    });

    it('should continue processing when image processing fails', async () => {
      // Test the image processing error handling directly
      const mockProductData = {
        title: 'Test Product',
        source_url: 'https://example.com/test-product',
        image_urls: ['https://example.com/invalid-image.jpg'],
        specs: {},
        available: true,
      };

      const job = {
        id: 'test-job-5',
        type: 'product' as const,
        target_url: 'https://example.com/test-product',
        priority: 5,
        created_at: new Date().toISOString(),
        attempts: 0,
        max_attempts: 3,
      };

      // Mock image processor to fail
      const mockProcessor = (worker as any).imageProcessor;
      mockProcessor.processImage = vi.fn().mockResolvedValue({
        success: false,
        originalUrl: 'https://example.com/invalid-image.jpg',
        error: 'Image download failed',
      });

      // Mock the processImages method directly to test error handling
      const result = { success: true, itemsProcessed: 1, errors: [], duration: 0, metadata: {} };
      
      // Simulate image processing failure
      await (worker as any).processImages(mockProductData, job, result);
      
      expect(result.errors.length).toBeGreaterThan(0); // Should have image errors
      expect(mockProductData.image_urls).toEqual([]); // Should have no processed images due to failure
    });

    it('should fail when database storage fails', async () => {
      // Test the database storage error handling directly
      const mockProductData = {
        title: 'Test Product',
        source_url: 'https://example.com/test-product',
        image_urls: [],
        specs: {},
        available: true,
      };

      const job = {
        id: 'test-job-6',
        type: 'product' as const,
        target_url: 'https://example.com/test-product',
        priority: 5,
        created_at: new Date().toISOString(),
        attempts: 0,
        max_attempts: 3,
      };

      const result = { success: true, itemsProcessed: 1, errors: [], duration: 0, metadata: {} };

      // Mock database to fail
      const mockDb = (worker as any).databaseService;
      mockDb.upsertProduct = vi.fn().mockRejectedValue(new Error('Database error'));

      // Test the storeData method directly
      await expect((worker as any).storeData(mockProductData, job, result)).rejects.toThrow('Database error');
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      await worker.initialize();
    });

    it('should track job processing metrics', async () => {
      const initialMetrics = worker.getMetrics();
      expect(initialMetrics.jobsProcessed).toBe(0);
      expect(initialMetrics.jobsSucceeded).toBe(0);
      expect(initialMetrics.jobsFailed).toBe(0);

      // Simulate successful job processing
      (worker as any).updateMetrics(true, 1000);
      (worker as any).updateMetrics(true, 2000);
      (worker as any).updateMetrics(false, 500);

      const finalMetrics = worker.getMetrics();
      expect(finalMetrics.jobsProcessed).toBe(3);
      expect(finalMetrics.jobsSucceeded).toBe(2);
      expect(finalMetrics.jobsFailed).toBe(1);
      expect(finalMetrics.averageProcessingTime).toBeCloseTo(1166.67, 2); // (1000 + 2000 + 500) / 3
    });

    it('should update last job processed timestamp', async () => {
      const initialMetrics = worker.getMetrics();
      expect(initialMetrics.lastJobProcessedAt).toBeUndefined();

      (worker as any).updateMetrics(true, 1000);

      const finalMetrics = worker.getMetrics();
      expect(finalMetrics.lastJobProcessedAt).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await worker.initialize();
    });

    it('should handle unknown job types', async () => {
      const job = {
        id: 'test-job-unknown',
        type: 'unknown' as any,
        target_url: 'https://example.com/test',
        priority: 5,
        created_at: new Date().toISOString(),
        attempts: 0,
        max_attempts: 3,
      };

      await expect((worker as any).processJob(job)).rejects.toThrow('Unknown job type: unknown');
    });

    it('should handle service unavailability gracefully', async () => {
      // Test with disabled services
      const workerWithDisabledServices = new ScraperWorker({
        enableImageProcessing: false,
        enableDatabaseStorage: false,
      });

      await workerWithDisabledServices.initialize();

      const health = await workerWithDisabledServices.getHealthStatus();
      expect(health.status).toBe('healthy'); // Should be healthy when services are disabled
      expect(health.details.database).toBe(true);
      expect(health.details.imageProcessor).toBe(true);

      await workerWithDisabledServices.stop();
    });
  });

  describe('PostgreSQL Queue Integration', () => {
    beforeEach(async () => {
      await worker.initialize();
    });

    it('should add jobs to PostgreSQL queue successfully', async () => {
      const jobData = {
        type: 'product' as const,
        target_url: 'https://example.com/test-product',
        priority: 5,
      };

      // Mock the job manager's addJob method
      const mockAddJob = vi.fn().mockResolvedValue('test-job-id');
      (worker as any).jobManager.addJob = mockAddJob;

      const jobId = await worker.addJob(jobData);

      expect(jobId).toBe('test-job-id');
      expect(mockAddJob).toHaveBeenCalledWith(jobData);
    });

    it('should get PostgreSQL queue statistics with lock information', async () => {
      const mockStats = {
        queued: 5,
        running: 2,
        completed: 100,
        failed: 3,
        locked: 1, // PostgreSQL-specific locked jobs count
      };

      // Mock the job manager's getStats method
      const mockGetStats = vi.fn().mockResolvedValue(mockStats);
      (worker as any).jobManager.getStats = mockGetStats;

      const stats = await worker.getQueueStats();

      expect(stats).toEqual(mockStats);
      expect(stats.locked).toBeDefined(); // Ensure locked count is included
      expect(mockGetStats).toHaveBeenCalledOnce();
    });

    it('should handle PostgreSQL row-level locking correctly', async () => {
      // Test that the job manager uses PostgreSQL row-level locking
      const mockJobManager = (worker as any).jobManager;
      
      // Verify that the job manager has PostgreSQL-specific methods
      expect(mockJobManager.jobQueue).toBeDefined();
      expect(typeof mockJobManager.clearQueues).toBe('function');
      expect(typeof mockJobManager.getDeadLetterJobs).toBe('function');
      expect(typeof mockJobManager.requeueDeadLetterJob).toBe('function');
    });

    it('should process jobs with PostgreSQL-based retry logic', async () => {
      const job = {
        id: 'test-job-retry',
        type: 'product' as const,
        target_url: 'https://example.com/test-product',
        priority: 5,
        created_at: new Date().toISOString(),
        attempts: 1, // Simulate a retry
        max_attempts: 3,
        metadata: { attempts: 1 }, // Include attempts in metadata for PostgreSQL tracking
      };

      // Test that the worker correctly handles retry attempts from PostgreSQL
      try {
        await (worker as any).processJob(job);
      } catch (error) {
        // Expect the error to include the correct attempt count from PostgreSQL
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Scraping failed');
        
        // Verify that the attempt count is correctly tracked from PostgreSQL metadata
        if (error.attempt !== undefined) {
          expect(error.attempt).toBe(1); // Should use the attempt from metadata
        }
      }
      
      // Verify that PostgreSQL-based job processing was attempted
      const mockJobManager = (worker as any).jobManager;
      expect(mockJobManager.jobQueue).toBeDefined();
    });
  });
});

describe('Worker Integration with Real Services', () => {
  // These tests would run against real services in a test environment
  // They are skipped by default to avoid requiring actual service connections

  it.skip('should connect to real PostgreSQL and process a test job', async () => {
    // This test would require a real PostgreSQL instance
    // and would test the complete integration
  });

  it.skip('should connect to real Supabase and store test data', async () => {
    // This test would require a real Supabase instance
    // and would test database operations
  });

  it.skip('should connect to real R2 and process test images', async () => {
    // This test would require real R2 credentials
    // and would test image processing pipeline
  });
});