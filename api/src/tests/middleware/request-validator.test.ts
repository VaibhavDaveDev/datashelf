import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context, Next } from 'hono';
import { requestValidator, rateLimiter } from '@/middleware/request-validator';
import type { Env } from '@/types/env';

describe('Request Validator Middleware', () => {
  let mockContext: Context<{ Bindings: Env }>;
  let mockNext: Next;

  beforeEach(() => {
    mockNext = vi.fn().mockResolvedValue(undefined);
    mockContext = {
      req: {
        method: 'GET',
        header: vi.fn(),
      },
      set: vi.fn(),
      res: {
        headers: new Headers(),
      },
    } as any;
  });

  describe('requestValidator', () => {
    it('should pass through GET requests', async () => {
      mockContext.req.method = 'GET';

      const result = await requestValidator(mockContext, mockNext);

      expect(result).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate Content-Type for POST requests', async () => {
      mockContext.req.method = 'POST';
      vi.mocked(mockContext.req.header).mockImplementation((name) => {
        if (name === 'Content-Type') return 'application/json';
        return undefined;
      });

      const result = await requestValidator(mockContext, mockNext);

      expect(result).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject POST requests without proper Content-Type', async () => {
      mockContext.req.method = 'POST';
      vi.mocked(mockContext.req.header).mockImplementation(() => undefined);
      
      const mockJson = vi.fn().mockReturnValue(new Response());
      mockContext.json = mockJson;

      const result = await requestValidator(mockContext, mockNext);

      expect(result).toBeInstanceOf(Response);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid Content-Type',
          message: 'Content-Type must be application/json for POST requests',
          code: 400,
        }),
        400,
        expect.any(Object)
      );
    });

    it('should reject requests with payload too large', async () => {
      vi.mocked(mockContext.req.header).mockImplementation((name) => {
        if (name === 'Content-Length') return '2000000'; // 2MB
        return undefined;
      });
      
      const mockJson = vi.fn().mockReturnValue(new Response());
      mockContext.json = mockJson;

      const result = await requestValidator(mockContext, mockNext);

      expect(result).toBeInstanceOf(Response);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Payload Too Large',
          code: 413,
        }),
        413,
        expect.any(Object)
      );
    });

    it('should add security headers', async () => {
      await requestValidator(mockContext, mockNext);

      expect(mockContext.res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(mockContext.res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(mockContext.res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(mockContext.res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('should add request ID', async () => {
      await requestValidator(mockContext, mockNext);

      expect(mockContext.res.headers.get('X-Request-ID')).toBeDefined();
    });
  });

  describe('rateLimiter', () => {
    let mockKV: KVNamespace;

    beforeEach(() => {
      mockKV = {
        get: vi.fn(),
        put: vi.fn(),
      } as any;

      mockContext.env = {
        CACHE: mockKV,
        RATE_LIMIT_REQUESTS_PER_MINUTE: '10',
      } as Env;

      vi.mocked(mockContext.req.header).mockImplementation((name) => {
        if (name === 'CF-Connecting-IP') return '192.168.1.1';
        return undefined;
      });
    });

    it('should allow requests under rate limit', async () => {
      vi.mocked(mockKV.get).mockResolvedValue('5'); // Current count
      vi.mocked(mockKV.put).mockResolvedValue();

      const result = await rateLimiter(mockContext, mockNext);

      expect(result).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockKV.put).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit:192.168.1.1:'),
        '6',
        { expirationTtl: 60 }
      );
    });

    it('should block requests over rate limit', async () => {
      vi.mocked(mockKV.get).mockResolvedValue('10'); // At limit
      
      const mockJson = vi.fn().mockReturnValue(new Response());
      mockContext.json = mockJson;

      const result = await rateLimiter(mockContext, mockNext);

      expect(result).toBeInstanceOf(Response);
      expect(mockNext).not.toHaveBeenCalled();
      
      const callArgs = vi.mocked(mockJson).mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Limit: 10 requests per minute',
        code: 429,
      });
      expect(callArgs[1]).toBe(429);
    });

    it('should handle first request (no existing count)', async () => {
      vi.mocked(mockKV.get).mockResolvedValue(null);
      vi.mocked(mockKV.put).mockResolvedValue();

      const result = await rateLimiter(mockContext, mockNext);

      expect(result).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockKV.put).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit:192.168.1.1:'),
        '1',
        { expirationTtl: 60 }
      );
    });

    it('should add rate limit headers', async () => {
      vi.mocked(mockKV.get).mockResolvedValue('3');
      vi.mocked(mockKV.put).mockResolvedValue();

      await rateLimiter(mockContext, mockNext);

      expect(mockContext.res.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(mockContext.res.headers.get('X-RateLimit-Remaining')).toBe('6');
      expect(mockContext.res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should continue on rate limiting errors', async () => {
      vi.mocked(mockKV.get).mockRejectedValue(new Error('KV error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await rateLimiter(mockContext, mockNext);

      expect(result).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Rate limiting error:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});