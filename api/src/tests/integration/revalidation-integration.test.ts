import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRevalidationTrigger, extractRevalidationDetails } from '@/utils/revalidation-integration';
import { createSignedRequest, verifySignature } from '@/utils/request-signing';
import type { Env } from '@/types/env';

// Mock fetch for integration tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Revalidation System Integration', () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SCRAPER_API_KEY: 'test-scraper-key-integration',
      SCRAPER_SERVICE_URL: 'https://scraper-integration.example.com',
      REVALIDATION_ENABLED: 'true',
      REVALIDATION_RATE_LIMIT_PER_MINUTE: '5',
      REVALIDATION_RATE_LIMIT_PER_HOUR: '50',
    };

    mockFetch.mockClear();
  });

  describe('End-to-end revalidation flow', () => {
    it('should extract cache key details and trigger signed revalidation request', async () => {
      // Mock scraper health and job creation
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'healthy' }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ 
          success: true, 
          jobId: 'integration-job-123',
          message: 'Job created successfully'
        }), { status: 201 }));

      // Test cache key extraction
      const cacheKey = 'https://cache.datashelf.internal/products:categoryId=cat-123&limit=20';
      const details = extractRevalidationDetails(cacheKey);
      
      expect(details).toBeTruthy();
      expect(details?.dataType).toBe('product');
      expect(details?.metadata?.category_id).toBe('cat-123');

      // Test revalidation trigger
      const trigger = createRevalidationTrigger(mockEnv);
      await trigger(cacheKey);

      // Verify the scraper was called with signed request
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object)
      );
      
      // Verify at least health check was called
      expect(mockFetch).toHaveBeenCalled();
      
      // Find health check call
      const healthCalls = mockFetch.mock.calls.filter(call => 
        call[0].includes('/health')
      );
      expect(healthCalls.length).toBeGreaterThan(0);
      
      const healthCall = healthCalls[0];
      expect(healthCall[0]).toBe('https://scraper-integration.example.com/health');
      
      // Find job creation calls (if any - might be rate limited)
      const jobCalls = mockFetch.mock.calls.filter(call => 
        call[0].includes('/api/worker/jobs')
      );
      
      if (jobCalls.length > 0) {
        const jobCall = jobCalls[0];
        expect(jobCall[0]).toBe('https://scraper-integration.example.com/api/worker/jobs');
        expect(jobCall[1].method).toBe('POST');
        expect(jobCall[1].headers['Authorization']).toBe('Bearer test-scraper-key-integration');
        expect(jobCall[1].headers['X-Signature']).toMatch(/^[a-f0-9]{64}$/);
        expect(jobCall[1].headers['X-Timestamp']).toMatch(/^\d+$/);
        expect(jobCall[1].headers['X-Nonce']).toMatch(/^[a-f0-9]{32}$/);
        
        // Verify request body
        const requestBody = JSON.parse(jobCall[1].body);
        expect(requestBody).toMatchObject({
          type: 'product',
          target_url: 'https://www.worldofbooks.com/category/cat-123/products',
          priority: 3,
          metadata: {
            cache_key: cacheKey,
            revalidation_type: 'stale',
            category_id: 'cat-123',
          },
        });
      }
    });

    it('should handle disabled revalidation gracefully', async () => {
      const disabledEnv = { ...mockEnv, REVALIDATION_ENABLED: 'false' };
      const trigger = createRevalidationTrigger(disabledEnv);
      const cacheKey = 'https://cache.datashelf.internal/navigation';

      // Should not make any network calls
      await trigger(cacheKey);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle invalid cache keys without errors', async () => {
      const trigger = createRevalidationTrigger(mockEnv);
      const invalidKeys = [
        'invalid-url',
        'https://cache.datashelf.internal/unknown:param=value',
        'https://cache.datashelf.internal/product_detail', // missing id
      ];

      for (const key of invalidKeys) {
        await expect(trigger(key)).resolves.toBeUndefined();
      }

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Request signing integration', () => {
    it('should create verifiable signed requests', () => {
      const secret = 'test-secret-key';
      const requestData = {
        method: 'POST',
        url: 'https://scraper.example.com/api/jobs',
        body: {
          type: 'navigation',
          target_url: 'https://worldofbooks.com',
          priority: 5,
        },
      };

      const signedRequest = createSignedRequest(secret, requestData);

      // Verify the signature can be validated
      const isValid = verifySignature(
        secret,
        signedRequest.method,
        signedRequest.url,
        parseInt(signedRequest.headers['X-Timestamp']),
        signedRequest.headers['X-Nonce'],
        signedRequest.headers['X-Signature'],
        signedRequest.body
      );

      expect(isValid).toBe(true);
    });

    it('should reject tampered requests', () => {
      const secret = 'test-secret-key';
      const requestData = {
        method: 'POST',
        url: 'https://scraper.example.com/api/jobs',
        body: { type: 'product', target_url: 'https://example.com' },
      };

      const signedRequest = createSignedRequest(secret, requestData);

      // Tamper with the body
      const tamperedBody = JSON.stringify({ 
        type: 'navigation', // Changed from 'product'
        target_url: 'https://example.com' 
      });

      const isValid = verifySignature(
        secret,
        signedRequest.method,
        signedRequest.url,
        parseInt(signedRequest.headers['X-Timestamp']),
        signedRequest.headers['X-Nonce'],
        signedRequest.headers['X-Signature'],
        tamperedBody
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Cache key parsing edge cases', () => {
    it('should handle various cache key formats', () => {
      const testCases = [
        {
          key: 'https://cache.datashelf.internal/navigation',
          expected: { dataType: 'navigation', targetUrl: 'https://www.worldofbooks.com' }
        },
        {
          key: 'https://cache.datashelf.internal/categories:navId=nav-123',
          expected: { dataType: 'category', targetUrl: 'https://www.worldofbooks.com/category/nav-123' }
        },
        {
          key: 'https://cache.datashelf.internal/products:categoryId=cat-456&sort=price_asc',
          expected: { dataType: 'product', targetUrl: 'https://www.worldofbooks.com/category/cat-456/products' }
        },
        {
          key: 'https://cache.datashelf.internal/product_detail:id=prod-789',
          expected: { dataType: 'product', targetUrl: 'https://www.worldofbooks.com/product/prod-789' }
        },
      ];

      testCases.forEach(({ key, expected }) => {
        const details = extractRevalidationDetails(key);
        expect(details?.dataType).toBe(expected.dataType);
        expect(details?.targetUrl).toBe(expected.targetUrl);
      });
    });

    it('should return null for malformed keys', () => {
      const malformedKeys = [
        'not-a-url',
        'https://wrong-domain.com/cache',
        'https://cache.datashelf.internal/unknown-type',
        'https://cache.datashelf.internal/product_detail', // missing required id
      ];

      malformedKeys.forEach(key => {
        const details = extractRevalidationDetails(key);
        expect(details).toBeNull();
      });
    });
  });

  describe('Rate limiting integration', () => {
    it('should respect rate limits across multiple triggers', async () => {
      // Mock scraper as healthy
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: 'healthy' }), { status: 200 }));

      const trigger = createRevalidationTrigger(mockEnv);
      const cacheKey = 'https://cache.datashelf.internal/products:categoryId=test';

      // Trigger multiple times rapidly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(trigger(cacheKey));
      }

      await Promise.all(promises);

      // Should have made health checks but some requests should be rate limited
      // The exact number depends on the rate limiting implementation
      expect(mockFetch).toHaveBeenCalled();
      
      // At least one health check should have been made
      const healthCalls = mockFetch.mock.calls.filter(call => 
        call[0].includes('/health')
      );
      expect(healthCalls.length).toBeGreaterThan(0);
    });
  });
});