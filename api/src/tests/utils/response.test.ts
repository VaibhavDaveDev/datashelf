import { describe, it, expect } from 'vitest';
import { createSuccessResponse, createErrorResponse } from '@/utils/response';

describe('Response Utils', () => {
  describe('createSuccessResponse', () => {
    it('should create a success response with data', () => {
      const data = { id: '1', name: 'Test' };
      const response = createSuccessResponse(data);

      expect(response.data).toEqual(data);
      expect(response.meta).toBeDefined();
      expect(response.meta?.timestamp).toBeDefined();
      expect(response.meta?.cached).toBe(false);
    });

    it('should create a success response with custom meta', () => {
      const data = { id: '1', name: 'Test' };
      const meta = { cached: true, ttl: 300 };
      const response = createSuccessResponse(data, meta);

      expect(response.data).toEqual(data);
      expect(response.meta?.cached).toBe(true);
      expect(response.meta?.ttl).toBe(300);
      expect(response.meta?.timestamp).toBeDefined();
    });
  });

  describe('createErrorResponse', () => {
    it('should create an error response', () => {
      const error = createErrorResponse('ValidationError', 'Invalid input', 400);

      expect(error.error).toBe('ValidationError');
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe(400);
      expect(error.timestamp).toBeDefined();
    });

    it('should create an error response with current timestamp', () => {
      const before = new Date().toISOString();
      const error = createErrorResponse('TestError', 'Test message', 500);
      const after = new Date().toISOString();

      expect(error.timestamp >= before).toBe(true);
      expect(error.timestamp <= after).toBe(true);
    });
  });
});