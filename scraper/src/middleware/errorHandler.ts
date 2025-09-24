import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface APIError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  error: APIError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log the error
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const code = error.code || 'INTERNAL_ERROR';

  // Don't expose stack traces in production
  const response: any = {
    error: code,
    message,
    timestamp: new Date().toISOString(),
  };

  if (process.env['NODE_ENV'] === 'development') {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
}