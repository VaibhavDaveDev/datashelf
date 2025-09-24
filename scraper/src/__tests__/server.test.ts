import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createServer } from '../server';
import type { Express } from 'express';

// Mock the JobManager to avoid database connection in tests
vi.mock('../services/jobManager', () => ({
  JobManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
    }),
    healthCheck: vi.fn().mockResolvedValue({
      status: 'healthy',
      details: {
        isRunning: false,
        activeWorkers: 0,
        queueStats: {
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
        },
        postgresConnected: true,
      },
    }),
  })),
}));

describe('Server', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    // Clean up if needed
    if (app.locals.jobManager) {
      await app.locals.jobManager.stop();
    }
  });

  describe('GET /', () => {
    it('should return service information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'DataShelf Scraper Service',
        status: 'running',
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        environment: expect.any(String),
        services: expect.any(Object),
        system: expect.any(Object),
      });
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ready',
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'alive',
      });
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });

  describe('GET /api/status', () => {
    it('should return scraper status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'scraper',
        status: 'ready',
        message: 'Scraper service is ready to accept jobs',
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/metrics', () => {
    it('should return scraper metrics', async () => {
      const response = await request(app)
        .get('/api/metrics')
        .expect(200);

      expect(response.body).toMatchObject({
        jobs: {
          queued: expect.any(Number),
          running: expect.any(Number),
          completed: expect.any(Number),
          failed: expect.any(Number),
        },
        performance: expect.any(Object),
        system: expect.any(Object),
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: expect.stringContaining('Route GET /unknown-route not found'),
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });
});