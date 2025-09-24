import type { Context, Next } from 'hono';
import type { Env } from '@/types/env';
import { errorResponse } from '@/utils/response';

/**
 * Request validation middleware
 */
export async function requestValidator(
  c: Context<Env>,
  next: Next
): Promise<Response | void> {
  // Validate Content-Type for POST requests
  if (c.req.method === 'POST') {
    const contentType = c.req.header('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      return errorResponse(
        c,
        'Invalid Content-Type',
        'Content-Type must be application/json for POST requests',
        400
      );
    }
  }

  // Validate request size (prevent large payloads)
  const contentLength = c.req.header('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) { // 1MB limit
    return errorResponse(
      c,
      'Payload Too Large',
      'Request payload exceeds maximum size limit',
      413
    );
  }

  // Add request ID for tracing
  const requestId = crypto.randomUUID();
  c.res.headers.set('X-Request-ID', requestId);

  // Add security headers
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('X-XSS-Protection', '1; mode=block');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  await next();
}

/**
 * Rate limiting middleware (basic implementation)
 */
export async function rateLimiter(
  c: Context<Env>,
  next: Next
): Promise<Response | void> {
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const rateLimit = parseInt(c.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '100', 10);
  
  // Simple rate limiting using KV store
  const rateLimitKey = `rate_limit:${clientIP}:${Math.floor(Date.now() / 60000)}`;
  
  try {
    const currentCount = await c.env.CACHE.get(rateLimitKey);
    const count = currentCount ? parseInt(currentCount, 10) : 0;
    
    if (count >= rateLimit) {
      return errorResponse(
        c,
        'Rate Limit Exceeded',
        `Too many requests. Limit: ${rateLimit} requests per minute`,
        429
      );
    }
    
    // Increment counter
    await c.env.CACHE.put(rateLimitKey, (count + 1).toString(), {
      expirationTtl: 60, // 1 minute
    });
    
    // Add rate limit headers
    c.res.headers.set('X-RateLimit-Limit', rateLimit.toString());
    c.res.headers.set('X-RateLimit-Remaining', (rateLimit - count - 1).toString());
    c.res.headers.set('X-RateLimit-Reset', (Math.floor(Date.now() / 60000) + 1).toString());
    
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Continue on rate limiting errors to avoid blocking legitimate requests
  }

  await next();
}