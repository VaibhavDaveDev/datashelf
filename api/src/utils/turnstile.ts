import type { Env } from '@/types/env';

export interface TurnstileVerificationResult {
  success: boolean;
  error?: string;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Verify Cloudflare Turnstile token
 */
export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteip?: string
): Promise<TurnstileVerificationResult> {
  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const result = await response.json() as TurnstileVerificationResult;
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown verification error',
    };
  }
}

/**
 * Extract Turnstile token from request headers
 */
export function extractTurnstileToken(request: Request): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Turnstile ')) {
    return authHeader.substring(10);
  }

  // Check X-Turnstile-Token header
  const turnstileHeader = request.headers.get('X-Turnstile-Token');
  if (turnstileHeader) {
    return turnstileHeader;
  }

  return null;
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string | undefined {
  // Cloudflare Workers provides the client IP in CF-Connecting-IP header
  const cfConnectingIP = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to X-Forwarded-For
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  // Fallback to X-Real-IP
  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) {
    return xRealIP;
  }

  return undefined;
}

/**
 * Check if Turnstile verification should be bypassed
 */
export function shouldBypassTurnstile(env: Env, request: Request): boolean {
  // Bypass in development environment
  if (env.ENVIRONMENT === 'development') {
    return true;
  }

  // Bypass if Turnstile is not configured
  if (!env.TURNSTILE_SECRET_KEY) {
    return true;
  }

  // Bypass for health checks and internal requests
  const url = new URL(request.url);
  const bypassPaths = ['/health', '/api/health', '/favicon.ico'];
  
  if (bypassPaths.some(path => url.pathname.startsWith(path))) {
    return true;
  }

  // Bypass for specific user agents (monitoring, etc.)
  const userAgent = request.headers.get('User-Agent') || '';
  const bypassUserAgents = ['health-check', 'monitoring', 'uptime'];
  
  if (bypassUserAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
    return true;
  }

  return false;
}