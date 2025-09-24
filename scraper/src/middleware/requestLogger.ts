import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('Content-Length'),
    });

    return originalEnd(chunk, encoding, cb);
  };

  next();
}