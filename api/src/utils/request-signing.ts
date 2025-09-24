import { createHmac } from 'crypto';

/**
 * Request signing utilities for secure communication with scraper service
 */

export interface SignedRequestOptions {
  method: string;
  url: string;
  body?: any;
  timestamp?: number;
  nonce?: string;
}

export interface SignedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Generate HMAC-SHA256 signature for request
 */
export function generateSignature(
  secret: string,
  method: string,
  url: string,
  timestamp: number,
  nonce: string,
  body?: string
): string {
  // Create canonical string for signing
  const canonicalString = [
    method.toUpperCase(),
    url,
    timestamp.toString(),
    nonce,
    body || '',
  ].join('\n');

  // Generate HMAC-SHA256 signature
  const hmac = createHmac('sha256', secret);
  hmac.update(canonicalString);
  return hmac.digest('hex');
}

/**
 * Generate a cryptographically secure nonce
 */
export function generateNonce(): string {
  // Generate 16 random bytes and convert to hex
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a signed request for scraper service
 */
export function createSignedRequest(
  secret: string,
  options: SignedRequestOptions
): SignedRequest {
  const timestamp = options.timestamp || Date.now();
  const nonce = options.nonce || generateNonce();
  const body = options.body ? JSON.stringify(options.body) : undefined;

  const signature = generateSignature(
    secret,
    options.method,
    options.url,
    timestamp,
    nonce,
    body
  );

  return {
    url: options.url,
    method: options.method,
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Timestamp': timestamp.toString(),
      'X-Nonce': nonce,
      'Authorization': `Bearer ${secret}`,
    },
    body,
  };
}

/**
 * Verify a signed request (for testing purposes)
 */
export function verifySignature(
  secret: string,
  method: string,
  url: string,
  timestamp: number,
  nonce: string,
  signature: string,
  body?: string
): boolean {
  const expectedSignature = generateSignature(
    secret,
    method,
    url,
    timestamp,
    nonce,
    body
  );

  return signature === expectedSignature;
}

/**
 * Check if timestamp is within acceptable window (5 minutes)
 */
export function isTimestampValid(timestamp: number, windowMs: number = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  return diff <= windowMs;
}