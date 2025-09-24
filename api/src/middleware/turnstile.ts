import type { Context, Next } from 'hono';
import type { Env } from '@/types/env';
import { 
  verifyTurnstileToken, 
  extractTurnstileToken, 
  getClientIP, 
  shouldBypassTurnstile 
} from '@/utils/turnstile';

/**
 * Middleware to verify Cloudflare Turnstile tokens
 */
export async function turnstileMiddleware(c: Context<Env>, next: Next) {
  const env = c.env;
  const request = c.req.raw;

  // Check if we should bypass Turnstile verification
  if (shouldBypassTurnstile(env, request)) {
    return next();
  }

  // Extract Turnstile token from request
  const token = extractTurnstileToken(request);
  
  if (!token) {
    return c.json({
      error: 'Unauthorized',
      message: 'Turnstile verification token is required',
      code: 401,
      timestamp: new Date().toISOString(),
    }, 401);
  }

  // Special handling for fallback tokens
  if (token === 'fallback-access') {
    console.warn('Allowing access with fallback token');
    return next();
  }

  // Verify the token with Cloudflare
  const clientIP = getClientIP(request);
  const verificationResult = await verifyTurnstileToken(
    token,
    env.TURNSTILE_SECRET_KEY,
    clientIP
  );

  if (!verificationResult.success) {
    console.error('Turnstile verification failed:', {
      error: verificationResult.error,
      errorCodes: verificationResult['error-codes'],
      clientIP,
      userAgent: request.headers.get('User-Agent'),
    });

    return c.json({
      error: 'Forbidden',
      message: 'Turnstile verification failed',
      code: 403,
      details: verificationResult['error-codes'],
      timestamp: new Date().toISOString(),
    }, 403);
  }

  // Store verification result in context for potential use by handlers
  c.set('turnstileVerified', true);
  c.set('turnstileChallenge', verificationResult.challenge_ts);
  c.set('turnstileHostname', verificationResult.hostname);

  return next();
}

/**
 * Optional middleware that only logs Turnstile verification without blocking
 */
export async function turnstileLoggingMiddleware(c: Context<Env>, next: Next) {
  const env = c.env;
  const request = c.req.raw;

  // Skip if Turnstile is not configured
  if (!env.TURNSTILE_SECRET_KEY || shouldBypassTurnstile(env, request)) {
    return next();
  }

  const token = extractTurnstileToken(request);
  
  if (token && token !== 'fallback-access') {
    const clientIP = getClientIP(request);
    const verificationResult = await verifyTurnstileToken(
      token,
      env.TURNSTILE_SECRET_KEY,
      clientIP
    );

    // Log the result but don't block the request
    console.log('Turnstile verification result:', {
      success: verificationResult.success,
      clientIP,
      userAgent: request.headers.get('User-Agent'),
      path: new URL(request.url).pathname,
    });

    if (verificationResult.success) {
      c.set('turnstileVerified', true);
    }
  }

  return next();
}