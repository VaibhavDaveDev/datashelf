import type { Context } from 'hono';
import type { APIError, APIResponse, ResponseMetadata } from '@/types/api';
import type { Env } from '@/types/env';

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Partial<ResponseMetadata>
): APIResponse<T> {
  return {
    data,
    meta: {
      timestamp: new Date().toISOString(),
      cached: false,
      ...meta,
    },
  };
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  message: string,
  code: number
): APIError {
  return {
    error,
    message,
    code,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Send a JSON response with appropriate headers
 */
export function jsonResponse<T>(
  c: Context,
  data: T,
  status: number = 200,
  headers?: Record<string, string>
) {
  return c.json(data, status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=900',
    ...headers,
  });
}

/**
 * Send an error response
 */
export function errorResponse(
  c: Context,
  error: string,
  message: string,
  status: number = 500
) {
  const errorData = createErrorResponse(error, message, status);
  return c.json(errorData, status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  });
}

/**
 * Send a cached response with appropriate headers
 */
export function cachedResponse<T>(
  c: Context,
  data: T,
  ttl: number,
  stale: boolean = false,
  status: number = 200
) {
  const response = createSuccessResponse(data, {
    cached: true,
    ttl,
  });

  const cacheStatus = stale ? 'STALE' : 'HIT';
  const maxAge = stale ? 0 : ttl; // Don't cache stale responses in browser

  return c.json(response, status, {
    'Content-Type': 'application/json',
    'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${ttl * 2}`,
    'X-Cache': cacheStatus,
    'X-Cache-TTL': ttl.toString(),
  });
}

/**
 * Send a fresh response that will be cached
 */
export function freshResponse<T>(
  c: Context,
  data: T,
  ttl: number,
  status: number = 200
) {
  const response = createSuccessResponse(data, {
    cached: false,
    ttl,
  });

  return c.json(response, status, {
    'Content-Type': 'application/json',
    'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`,
    'X-Cache': 'MISS',
    'X-Cache-TTL': ttl.toString(),
  });
}

/**
 * Send response with stale-while-revalidate pattern
 */
export function swrResponse<T>(
  c: Context,
  data: T,
  ttl: number,
  cached: boolean,
  stale: boolean,
  status: number = 200
) {
  if (cached) {
    return cachedResponse(c, data, ttl, stale, status);
  } else {
    return freshResponse(c, data, ttl, status);
  }
}