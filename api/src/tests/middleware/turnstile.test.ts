import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { turnstileMiddleware, turnstileLoggingMiddleware } from '@/middleware/turnstile';
import type { Env } from '@/types/env';

// Mock the turnstile utils
vi.mock('@/utils/turnstile', () => ({
  verifyTurnstileToken: vi.fn(),
  extractTurnstileToken: vi.fn(),
  getClientIP: vi.fn(),
  shouldBypassTurnstile: vi.fn(),
}));

describe('Turnstile Middleware', () => {
  let app: Hono<Env>;
  const mockEnv: Env = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'key',
    SCRAPER_API_KEY: 'key',
    SCRAPER_SERVICE_URL: 'https://scraper.example.com',
    TURNSTILE_SECRET_KEY: 'secret-key',
    ENVIRONMENT: 'production',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono<Env>();
  });

  describe('turnstileMiddleware', () => {
    it('bypasses verification when shouldBypassTurnstile returns true', async () => {
      const { shouldBypassTurnstile } = await import('@/utils/turnstile');
      vi.mocked(shouldBypassTurnstile).mockReturnValue(true);

      app.use('*', turnstileMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });

    it('returns 401 when no token is provided', async () => {
      const { shouldBypassTurnstile, extractTurnstileToken } = await import('@/utils/turnstile');
      vi.mocked(shouldBypassTurnstile).mockReturnValue(false);
      vi.mocked(extractTurnstileToken).mockReturnValue(null);

      app.use('*', turnstileMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Turnstile verification token is required');
    });

    it('allows fallback access token', async () => {
      const { shouldBypassTurnstile, extractTurnstileToken } = await import('@/utils/turnstile');
      vi.mocked(shouldBypassTurnstile).mockReturnValue(false);
      vi.mocked(extractTurnstileToken).mockReturnValue('fallback-access');

      app.use('*', turnstileMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });

    it('returns 403 when token verification fails', async () => {
      const { 
        shouldBypassTurnstile, 
        extractTurnstileToken, 
        verifyTurnstileToken,
        getClientIP 
      } = await import('@/utils/turnstile');
      
      vi.mocked(shouldBypassTurnstile).mockReturnValue(false);
      vi.mocked(extractTurnstileToken).mockReturnValue('invalid-token');
      vi.mocked(getClientIP).mockReturnValue('192.168.1.1');
      vi.mocked(verifyTurnstileToken).mockResolvedValue({
        success: false,
        error: 'Invalid token',
        'error-codes': ['invalid-input-response'],
      });

      app.use('*', turnstileMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Forbidden');
      expect(body.message).toBe('Turnstile verification failed');
    });

    it('proceeds when token verification succeeds', async () => {
      const { 
        shouldBypassTurnstile, 
        extractTurnstileToken, 
        verifyTurnstileToken,
        getClientIP 
      } = await import('@/utils/turnstile');
      
      vi.mocked(shouldBypassTurnstile).mockReturnValue(false);
      vi.mocked(extractTurnstileToken).mockReturnValue('valid-token');
      vi.mocked(getClientIP).mockReturnValue('192.168.1.1');
      vi.mocked(verifyTurnstileToken).mockResolvedValue({
        success: true,
        challenge_ts: '2023-12-01T10:00:00.000Z',
        hostname: 'datashelf.com',
      });

      app.use('*', turnstileMiddleware);
      app.get('/test', (c) => {
        // Check that verification data is stored in context
        expect(c.get('turnstileVerified')).toBe(true);
        expect(c.get('turnstileChallenge')).toBe('2023-12-01T10:00:00.000Z');
        expect(c.get('turnstileHostname')).toBe('datashelf.com');
        return c.json({ success: true });
      });

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });
  });

  describe('turnstileLoggingMiddleware', () => {
    it('proceeds without blocking when verification fails', async () => {
      const { 
        shouldBypassTurnstile, 
        extractTurnstileToken, 
        verifyTurnstileToken,
        getClientIP 
      } = await import('@/utils/turnstile');
      
      vi.mocked(shouldBypassTurnstile).mockReturnValue(false);
      vi.mocked(extractTurnstileToken).mockReturnValue('invalid-token');
      vi.mocked(getClientIP).mockReturnValue('192.168.1.1');
      vi.mocked(verifyTurnstileToken).mockResolvedValue({
        success: false,
        error: 'Invalid token',
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      app.use('*', turnstileLoggingMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('sets verification flag when token is valid', async () => {
      const { 
        shouldBypassTurnstile, 
        extractTurnstileToken, 
        verifyTurnstileToken,
        getClientIP 
      } = await import('@/utils/turnstile');
      
      vi.mocked(shouldBypassTurnstile).mockReturnValue(false);
      vi.mocked(extractTurnstileToken).mockReturnValue('valid-token');
      vi.mocked(getClientIP).mockReturnValue('192.168.1.1');
      vi.mocked(verifyTurnstileToken).mockResolvedValue({
        success: true,
        challenge_ts: '2023-12-01T10:00:00.000Z',
        hostname: 'datashelf.com',
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      app.use('*', turnstileLoggingMiddleware);
      app.get('/test', (c) => {
        expect(c.get('turnstileVerified')).toBe(true);
        return c.json({ success: true });
      });

      const res = await app.request('/test', {}, mockEnv);

      expect(res.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});