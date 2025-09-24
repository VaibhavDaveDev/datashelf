import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSignature,
  generateNonce,
  createSignedRequest,
  verifySignature,
  isTimestampValid,
} from '@/utils/request-signing';

describe('Request Signing Utilities', () => {
  const testSecret = 'test-secret-key-12345';
  const testMethod = 'POST';
  const testUrl = 'https://scraper.example.com/api/jobs';
  const testBody = JSON.stringify({ type: 'product', target_url: 'https://example.com' });

  describe('generateSignature', () => {
    it('should generate consistent signatures for same inputs', () => {
      const timestamp = 1640995200000; // Fixed timestamp
      const nonce = 'test-nonce-123';

      const signature1 = generateSignature(testSecret, testMethod, testUrl, timestamp, nonce, testBody);
      const signature2 = generateSignature(testSecret, testMethod, testUrl, timestamp, nonce, testBody);

      expect(signature1).toBe(signature2);
      expect(signature1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex string
    });

    it('should generate different signatures for different inputs', () => {
      const timestamp = Date.now();
      const nonce = 'test-nonce';

      const signature1 = generateSignature(testSecret, testMethod, testUrl, timestamp, nonce, testBody);
      const signature2 = generateSignature(testSecret, 'GET', testUrl, timestamp, nonce, testBody);
      const signature3 = generateSignature(testSecret, testMethod, testUrl + '/different', timestamp, nonce, testBody);

      expect(signature1).not.toBe(signature2);
      expect(signature1).not.toBe(signature3);
      expect(signature2).not.toBe(signature3);
    });

    it('should handle empty body', () => {
      const timestamp = Date.now();
      const nonce = 'test-nonce';

      const signature = generateSignature(testSecret, 'GET', testUrl, timestamp, nonce);
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('generateNonce', () => {
    it('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      const nonce3 = generateNonce();

      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).not.toBe(nonce3);
      expect(nonce2).not.toBe(nonce3);
    });

    it('should generate nonces of correct length', () => {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^[a-f0-9]{32}$/); // 16 bytes = 32 hex chars
    });
  });

  describe('createSignedRequest', () => {
    it('should create properly signed request with body', () => {
      const requestBody = { type: 'product', target_url: 'https://example.com' };
      const timestamp = Date.now();
      const nonce = 'test-nonce-456';

      const signedRequest = createSignedRequest(testSecret, {
        method: testMethod,
        url: testUrl,
        body: requestBody,
        timestamp,
        nonce,
      });

      expect(signedRequest.url).toBe(testUrl);
      expect(signedRequest.method).toBe(testMethod);
      expect(signedRequest.body).toBe(JSON.stringify(requestBody));
      expect(signedRequest.headers['Content-Type']).toBe('application/json');
      expect(signedRequest.headers['X-Signature']).toMatch(/^[a-f0-9]{64}$/);
      expect(signedRequest.headers['X-Timestamp']).toBe(timestamp.toString());
      expect(signedRequest.headers['X-Nonce']).toBe(nonce);
      expect(signedRequest.headers['Authorization']).toBe(`Bearer ${testSecret}`);
    });

    it('should create properly signed request without body', () => {
      const signedRequest = createSignedRequest(testSecret, {
        method: 'GET',
        url: testUrl,
      });

      expect(signedRequest.body).toBeUndefined();
      expect(signedRequest.headers['X-Signature']).toMatch(/^[a-f0-9]{64}$/);
      expect(signedRequest.headers['X-Timestamp']).toMatch(/^\d+$/);
      expect(signedRequest.headers['X-Nonce']).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should use provided timestamp and nonce', () => {
      const timestamp = 1640995200000;
      const nonce = 'custom-nonce-789';

      const signedRequest = createSignedRequest(testSecret, {
        method: testMethod,
        url: testUrl,
        timestamp,
        nonce,
      });

      expect(signedRequest.headers['X-Timestamp']).toBe(timestamp.toString());
      expect(signedRequest.headers['X-Nonce']).toBe(nonce);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signatures', () => {
      const timestamp = 1640995200000;
      const nonce = 'test-nonce-verify';

      const signature = generateSignature(testSecret, testMethod, testUrl, timestamp, nonce, testBody);
      const isValid = verifySignature(testSecret, testMethod, testUrl, timestamp, nonce, signature, testBody);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const timestamp = 1640995200000;
      const nonce = 'test-nonce-verify';
      const invalidSignature = 'invalid-signature-123';

      const isValid = verifySignature(testSecret, testMethod, testUrl, timestamp, nonce, invalidSignature, testBody);

      expect(isValid).toBe(false);
    });

    it('should reject signatures with wrong parameters', () => {
      const timestamp = 1640995200000;
      const nonce = 'test-nonce-verify';

      const signature = generateSignature(testSecret, testMethod, testUrl, timestamp, nonce, testBody);
      
      // Wrong method
      expect(verifySignature(testSecret, 'GET', testUrl, timestamp, nonce, signature, testBody)).toBe(false);
      
      // Wrong URL
      expect(verifySignature(testSecret, testMethod, testUrl + '/wrong', timestamp, nonce, signature, testBody)).toBe(false);
      
      // Wrong timestamp
      expect(verifySignature(testSecret, testMethod, testUrl, timestamp + 1000, nonce, signature, testBody)).toBe(false);
      
      // Wrong nonce
      expect(verifySignature(testSecret, testMethod, testUrl, timestamp, 'wrong-nonce', signature, testBody)).toBe(false);
    });
  });

  describe('isTimestampValid', () => {
    it('should accept current timestamp', () => {
      const now = Date.now();
      expect(isTimestampValid(now)).toBe(true);
    });

    it('should accept timestamp within window', () => {
      const now = Date.now();
      const windowMs = 5 * 60 * 1000; // 5 minutes
      
      expect(isTimestampValid(now - windowMs + 1000)).toBe(true); // 4 minutes ago
      expect(isTimestampValid(now + windowMs - 1000)).toBe(true); // 4 minutes in future
    });

    it('should reject timestamp outside window', () => {
      const now = Date.now();
      const windowMs = 5 * 60 * 1000; // 5 minutes
      
      expect(isTimestampValid(now - windowMs - 1000)).toBe(false); // 6 minutes ago
      expect(isTimestampValid(now + windowMs + 1000)).toBe(false); // 6 minutes in future
    });

    it('should use custom window size', () => {
      const now = Date.now();
      const customWindow = 10 * 60 * 1000; // 10 minutes
      
      expect(isTimestampValid(now - 8 * 60 * 1000, customWindow)).toBe(true); // 8 minutes ago
      expect(isTimestampValid(now - 12 * 60 * 1000, customWindow)).toBe(false); // 12 minutes ago
    });
  });

  describe('Integration test', () => {
    it('should create and verify complete signed request', () => {
      const requestBody = { type: 'navigation', target_url: 'https://worldofbooks.com' };
      const timestamp = Date.now();
      const nonce = generateNonce();

      // Create signed request
      const signedRequest = createSignedRequest(testSecret, {
        method: 'POST',
        url: testUrl,
        body: requestBody,
        timestamp,
        nonce,
      });

      // Verify the signature
      const isValid = verifySignature(
        testSecret,
        signedRequest.method,
        signedRequest.url,
        parseInt(signedRequest.headers['X-Timestamp']),
        signedRequest.headers['X-Nonce'],
        signedRequest.headers['X-Signature'],
        signedRequest.body
      );

      expect(isValid).toBe(true);
    });
  });
});