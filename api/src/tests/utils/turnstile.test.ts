import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  verifyTurnstileToken, 
  extractTurnstileToken, 
  getClientIP, 
  shouldBypassTurnstile 
} from '@/utils/turnstile';
import type { Env } from '@/types/env';

// Mock fetch globally
global.fetch = vi.fn();

describe('Turnstile Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyTurnstileToken', () => {
    it('successfully verifies valid token', async () => {
      const mockResponse = {
        success: true,
        challenge_ts: '2023-12-01T10:00:00.000Z',
        hostname: 'datashelf.com',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await verifyTurnstileToken('valid-token', 'secret-key', '192.168.1.1');

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });

    it('handles verification failure', async () => {
      const mockResponse = {
        success: false,
        'error-codes': ['invalid-input-response'],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await verifyTurnstileToken('invalid-token', 'secret-key');

      expect(result).toEqual(mockResponse);
    });

    it('handles HTTP errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      const result = await verifyTurnstileToken('token', 'secret-key');

      expect(result).toEqual({
        success: false,
        error: 'HTTP 400: Bad Request',
      });
    });

    it('handles network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await verifyTurnstileToken('token', 'secret-key');

      expect(result).toEqual({
        success: false,
        error: 'Network error',
      });
    });
  });

  describe('extractTurnstileToken', () => {
    it('extracts token from Authorization header', () => {
      const request = new Request('https://example.com', {
        headers: {
          'Authorization': 'Turnstile abc123',
        },
      });

      const token = extractTurnstileToken(request);
      expect(token).toBe('abc123');
    });

    it('extracts token from X-Turnstile-Token header', () => {
      const request = new Request('https://example.com', {
        headers: {
          'X-Turnstile-Token': 'xyz789',
        },
      });

      const token = extractTurnstileToken(request);
      expect(token).toBe('xyz789');
    });

    it('prioritizes Authorization header over X-Turnstile-Token', () => {
      const request = new Request('https://example.com', {
        headers: {
          'Authorization': 'Turnstile auth-token',
          'X-Turnstile-Token': 'header-token',
        },
      });

      const token = extractTurnstileToken(request);
      expect(token).toBe('auth-token');
    });

    it('returns null when no token found', () => {
      const request = new Request('https://example.com');

      const token = extractTurnstileToken(request);
      expect(token).toBeNull();
    });
  });

  describe('getClientIP', () => {
    it('extracts IP from CF-Connecting-IP header', () => {
      const request = new Request('https://example.com', {
        headers: {
          'CF-Connecting-IP': '192.168.1.1',
        },
      });

      const ip = getClientIP(request);
      expect(ip).toBe('192.168.1.1');
    });

    it('falls back to X-Forwarded-For header', () => {
      const request = new Request('https://example.com', {
        headers: {
          'X-Forwarded-For': '10.0.0.1, 192.168.1.1',
        },
      });

      const ip = getClientIP(request);
      expect(ip).toBe('10.0.0.1');
    });

    it('falls back to X-Real-IP header', () => {
      const request = new Request('https://example.com', {
        headers: {
          'X-Real-IP': '172.16.0.1',
        },
      });

      const ip = getClientIP(request);
      expect(ip).toBe('172.16.0.1');
    });

    it('returns undefined when no IP headers found', () => {
      const request = new Request('https://example.com');

      const ip = getClientIP(request);
      expect(ip).toBeUndefined();
    });
  });

  describe('shouldBypassTurnstile', () => {
    const mockEnv: Env = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'key',
      SCRAPER_API_KEY: 'key',
      SCRAPER_SERVICE_URL: 'https://scraper.example.com',
      TURNSTILE_SECRET_KEY: 'secret',
      ENVIRONMENT: 'production',
    };

    it('bypasses in development environment', () => {
      const env = { ...mockEnv, ENVIRONMENT: 'development' };
      const request = new Request('https://example.com/api/products');

      const shouldBypass = shouldBypassTurnstile(env, request);
      expect(shouldBypass).toBe(true);
    });

    it('bypasses when Turnstile is not configured', () => {
      const env = { ...mockEnv, TURNSTILE_SECRET_KEY: undefined };
      const request = new Request('https://example.com/api/products');

      const shouldBypass = shouldBypassTurnstile(env, request);
      expect(shouldBypass).toBe(true);
    });

    it('bypasses for health check paths', () => {
      const request = new Request('https://example.com/health');

      const shouldBypass = shouldBypassTurnstile(mockEnv, request);
      expect(shouldBypass).toBe(true);
    });

    it('bypasses for monitoring user agents', () => {
      const request = new Request('https://example.com/api/products', {
        headers: {
          'User-Agent': 'health-check-bot/1.0',
        },
      });

      const shouldBypass = shouldBypassTurnstile(mockEnv, request);
      expect(shouldBypass).toBe(true);
    });

    it('does not bypass for regular requests', () => {
      const request = new Request('https://example.com/api/products', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const shouldBypass = shouldBypassTurnstile(mockEnv, request);
      expect(shouldBypass).toBe(false);
    });
  });
});