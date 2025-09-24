import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

import { errorHandler } from '@/middleware/error-handler';
import { requestValidator } from '@/middleware/request-validator';
import { turnstileLoggingMiddleware } from '@/middleware/turnstile';
import { navigationRoutes } from '@/handlers/navigation';
import { categoriesRoutes } from '@/handlers/categories';
import { productsRoutes } from '@/handlers/products';
import { healthRoutes } from '@/handlers/health';
import { cacheRoutes } from '@/handlers/cache';
import { revalidationRoutes } from '@/handlers/revalidation';
import { analyticsRoutes } from '@/handlers/analytics';
import type { Env } from '@/types/env';

const app = new Hono<Env>();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());

// CORS configuration
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://datashelf.com', 'https://www.datashelf.com'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  maxAge: 86400,
}));

// Request validation middleware
app.use('/api/*', requestValidator);

// Turnstile verification middleware (logging mode for now)
app.use('/api/*', turnstileLoggingMiddleware);

// Error handling middleware
app.onError(errorHandler);

// Health check routes
app.route('/', healthRoutes);

// API routes
app.route('/api/navigation', navigationRoutes);
app.route('/api/categories', categoriesRoutes);
app.route('/api/products', productsRoutes);
app.route('/api/cache', cacheRoutes);
app.route('/api/revalidation', revalidationRoutes);
app.route('/api/analytics', analyticsRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    code: 404,
    timestamp: new Date().toISOString(),
  }, 404);
});

export default app;