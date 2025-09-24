import { z } from 'zod';

/**
 * Query parameter validation schemas
 */

// Common pagination schema
export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// Categories query parameters
export const categoriesQuerySchema = z.object({
  navId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  ...paginationSchema.shape,
});

// Products query parameters
export const productsQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'title_asc', 'title_desc', 'created_at_desc']).default('created_at_desc'),
  ...paginationSchema.shape,
});

// Product ID parameter
export const productIdSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Validate and parse query parameters
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  query: Record<string, string | string[] | undefined>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = schema.parse(query);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, error: `Validation error: ${messages.join(', ')}` };
    }
    return { success: false, error: 'Invalid query parameters' };
  }
}

/**
 * Validate UUID parameter
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(total: number, limit: number, offset: number) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
}