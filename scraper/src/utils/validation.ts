import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../types';

// URL validation schema
export const urlSchema = z.string().url();

// Scrape job validation schema
export const scrapeJobSchema = z.object({
  type: z.enum(['navigation', 'category', 'product']),
  target_url: z.string().url(),
  priority: z.number().min(1).max(10).default(5),
  metadata: z.record(z.any()).optional(),
});

// Product data validation schema
export const productSchema = z.object({
  title: z.string().min(1).max(500),
  source_url: z.string().url(),
  source_id: z.string().optional(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).default('GBP'),
  image_urls: z.array(z.string().url()).default([]),
  summary: z.string().max(2000).optional(),
  specs: z.record(z.any()).default({}),
  available: z.boolean().default(true),
  category_id: z.string().uuid().optional(),
});

// Category data validation schema
export const categorySchema = z.object({
  title: z.string().min(1).max(200),
  source_url: z.string().url(),
  product_count: z.number().min(0).default(0),
  navigation_id: z.string().uuid().optional(),
});

// Navigation data validation schema
export const navigationSchema = z.object({
  title: z.string().min(1).max(200),
  source_url: z.string().url(),
  parent_id: z.string().uuid().optional(),
});

// Validation helper functions
export function validateUrl(url: string): string {
  try {
    return urlSchema.parse(url);
  } catch (error) {
    throw new ValidationError(`Invalid URL: ${url}`, 'url', url);
  }
}

export function validateScrapeJob(data: unknown) {
  try {
    return scrapeJobSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      if (firstError) {
        throw new ValidationError(
          `Invalid scrape job data: ${firstError.message}`,
          firstError.path.join('.'),
          data
        );
      }
    }
    throw error;
  }
}

export function validateProduct(data: unknown) {
  try {
    return productSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      if (firstError) {
        throw new ValidationError(
          `Invalid product data: ${firstError.message}`,
          firstError.path.join('.'),
          data
        );
      }
    }
    throw error;
  }
}

export function validateCategory(data: unknown) {
  try {
    return categorySchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      if (firstError) {
        throw new ValidationError(
          `Invalid category data: ${firstError.message}`,
          firstError.path.join('.'),
          data
        );
      }
    }
    throw error;
  }
}

export function validateNavigation(data: unknown) {
  try {
    return navigationSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      if (firstError) {
        throw new ValidationError(
          `Invalid navigation data: ${firstError.message}`,
          firstError.path.join('.'),
          data
        );
      }
    }
    throw error;
  }
}

// Generic validation helper
export function validateWithSchema<T>(schema: z.ZodSchema<T>, data: unknown, fieldName: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      if (firstError) {
        throw new ValidationError(
          `Invalid ${fieldName}: ${firstError.message}`,
          firstError.path.join('.'),
          data
        );
      }
    }
    throw error;
  }
}

// Express middleware for request validation
export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: 'received' in err ? err.received : undefined,
          })),
        });
        return;
      }
      next(error);
    }
  };
}