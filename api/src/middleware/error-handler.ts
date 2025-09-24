import type { Context } from 'hono';
import type { Env } from '@/types/env';
import { createErrorResponse } from '@/utils/response';

/**
 * Global error handler middleware
 */
export async function errorHandler(
  err: Error,
  c: Context<Env>
): Promise<Response> {
  console.error('API Error:', {
    message: err.message,
    stack: err.stack,
    url: c.req.url,
    method: c.req.method,
    timestamp: new Date().toISOString(),
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    const errorResponse = createErrorResponse(
      'Validation Error',
      err.message,
      400
    );
    return c.json(errorResponse, 400);
  }

  if (err.name === 'NotFoundError') {
    const errorResponse = createErrorResponse(
      'Not Found',
      err.message,
      404
    );
    return c.json(errorResponse, 404);
  }

  if (err.name === 'RateLimitError') {
    const errorResponse = createErrorResponse(
      'Rate Limit Exceeded',
      'Too many requests. Please try again later.',
      429
    );
    return c.json(errorResponse, 429, {
      'Retry-After': '60',
    });
  }

  // Database connection errors
  if (err.message.includes('connection') || err.message.includes('timeout')) {
    const errorResponse = createErrorResponse(
      'Service Unavailable',
      'Database connection error. Please try again later.',
      503
    );
    return c.json(errorResponse, 503);
  }

  // Default internal server error
  const errorResponse = createErrorResponse(
    'Internal Server Error',
    'An unexpected error occurred. Please try again later.',
    500
  );
  
  return c.json(errorResponse, 500);
}

/**
 * Custom error classes
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}