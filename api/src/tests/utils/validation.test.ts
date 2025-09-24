import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { 
  validateQuery, 
  isValidUUID, 
  sanitizeString, 
  calculatePagination,
  categoriesQuerySchema,
  productsQuerySchema 
} from '@/utils/validation';

describe('Validation Utils', () => {
  describe('validateQuery', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.coerce.number().min(0),
    });

    it('should validate valid query parameters', () => {
      const query = { name: 'John', age: '25' };
      const result = validateQuery(testSchema, query);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John');
        expect(result.data.age).toBe(25);
      }
    });

    it('should return error for invalid query parameters', () => {
      const query = { name: 'John', age: 'invalid' };
      const result = validateQuery(testSchema, query);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Validation error');
      }
    });

    it('should return error for missing required parameters', () => {
      const query = { age: '25' };
      const result = validateQuery(testSchema, query);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Validation error');
      }
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUID format', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      expect(isValidUUID(validUUID)).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      expect(isValidUUID('invalid-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove dangerous characters', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = sanitizeString(input);
      expect(sanitized).toBe('scriptalert("xss")/script');
    });

    it('should trim whitespace', () => {
      const input = '  test string  ';
      const sanitized = sanitizeString(input);
      expect(sanitized).toBe('test string');
    });

    it('should handle empty string', () => {
      const sanitized = sanitizeString('');
      expect(sanitized).toBe('');
    });
  });

  describe('calculatePagination', () => {
    it('should calculate pagination for first page', () => {
      const pagination = calculatePagination(100, 20, 0);
      
      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(20);
      expect(pagination.total_pages).toBe(5);
      expect(pagination.has_next).toBe(true);
      expect(pagination.has_prev).toBe(false);
    });

    it('should calculate pagination for middle page', () => {
      const pagination = calculatePagination(100, 20, 40);
      
      expect(pagination.page).toBe(3);
      expect(pagination.limit).toBe(20);
      expect(pagination.total_pages).toBe(5);
      expect(pagination.has_next).toBe(true);
      expect(pagination.has_prev).toBe(true);
    });

    it('should calculate pagination for last page', () => {
      const pagination = calculatePagination(100, 20, 80);
      
      expect(pagination.page).toBe(5);
      expect(pagination.limit).toBe(20);
      expect(pagination.total_pages).toBe(5);
      expect(pagination.has_next).toBe(false);
      expect(pagination.has_prev).toBe(true);
    });

    it('should handle edge case with no results', () => {
      const pagination = calculatePagination(0, 20, 0);
      
      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(20);
      expect(pagination.total_pages).toBe(0);
      expect(pagination.has_next).toBe(false);
      expect(pagination.has_prev).toBe(false);
    });
  });

  describe('categoriesQuerySchema', () => {
    it('should validate valid categories query', () => {
      const query = {
        navId: '123e4567-e89b-12d3-a456-426614174000',
        limit: '10',
        offset: '0'
      };
      
      const result = categoriesQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.navId).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should apply default values', () => {
      const query = {};
      const result = categoriesQuerySchema.safeParse(query);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });
  });

  describe('productsQuerySchema', () => {
    it('should validate valid products query', () => {
      const query = {
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
        sort: 'price_asc',
        limit: '50',
        offset: '20'
      };
      
      const result = productsQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.categoryId).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(result.data.sort).toBe('price_asc');
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(20);
      }
    });

    it('should reject invalid sort option', () => {
      const query = { sort: 'invalid_sort' };
      const result = productsQuerySchema.safeParse(query);
      
      expect(result.success).toBe(false);
    });
  });
});