import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context } from 'hono';
import { errorHandler, ValidationError, NotFoundError, RateLimitError } from '@/middleware/error-handler';
import type { Env } from '@/types/env';

describe('Error Handler Middleware', () => {
  let mockContext: Context<{ Bindings: Env }>;

  beforeEach(() => {
    mockContext = {
      req: {
        url: 'https://api.example.com/test',
        method: 'GET',
      },
      json: vi.fn().mockImplementation((data, status, headers) => {
        return new Response(JSON.stringify(data), { status, headers });
      }),
    } as any;
  });

  it('should handle ValidationError with 400 status', async () => {
    const error = new ValidationError('Invalid input data');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await errorHandler(error, mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toBe('Validation Error');
    expect(responseData.message).toBe('Invalid input data');
    expect(responseData.code).toBe(400);
    expect(responseData.timestamp).toBeDefined();

    consoleSpy.mockRestore();
  });

  it('should handle NotFoundError with 404 status', async () => {
    const error = new NotFoundError('Resource not found');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await errorHandler(error, mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(404);
    expect(responseData.error).toBe('Not Found');
    expect(responseData.message).toBe('Resource not found');
    expect(responseData.code).toBe(404);

    consoleSpy.mockRestore();
  });

  it('should handle RateLimitError with 429 status and Retry-After header', async () => {
    const error = new RateLimitError('Too many requests');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await errorHandler(error, mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(429);
    expect(responseData.error).toBe('Rate Limit Exceeded');
    expect(responseData.message).toBe('Too many requests. Please try again later.');
    expect(response.headers.get('Retry-After')).toBe('60');

    consoleSpy.mockRestore();
  });

  it('should handle database connection errors with 503 status', async () => {
    const error = new Error('Database connection timeout');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await errorHandler(error, mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(503);
    expect(responseData.error).toBe('Service Unavailable');
    expect(responseData.message).toBe('Database connection error. Please try again later.');

    consoleSpy.mockRestore();
  });

  it('should handle generic errors with 500 status', async () => {
    const error = new Error('Something went wrong');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await errorHandler(error, mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe('Internal Server Error');
    expect(responseData.message).toBe('An unexpected error occurred. Please try again later.');
    expect(responseData.code).toBe(500);

    consoleSpy.mockRestore();
  });

  it('should log error details', async () => {
    const error = new Error('Test error');
    error.stack = 'Error stack trace';
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await errorHandler(error, mockContext);

    expect(consoleSpy).toHaveBeenCalledWith('API Error:', {
      message: 'Test error',
      stack: 'Error stack trace',
      url: 'https://api.example.com/test',
      method: 'GET',
      timestamp: expect.any(String),
    });

    consoleSpy.mockRestore();
  });
});

describe('Custom Error Classes', () => {
  it('should create ValidationError with correct name', () => {
    const error = new ValidationError('Test validation error');
    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('Test validation error');
    expect(error instanceof Error).toBe(true);
  });

  it('should create NotFoundError with correct name', () => {
    const error = new NotFoundError('Test not found error');
    expect(error.name).toBe('NotFoundError');
    expect(error.message).toBe('Test not found error');
    expect(error instanceof Error).toBe(true);
  });

  it('should create RateLimitError with correct name', () => {
    const error = new RateLimitError('Test rate limit error');
    expect(error.name).toBe('RateLimitError');
    expect(error.message).toBe('Test rate limit error');
    expect(error instanceof Error).toBe(true);
  });
});