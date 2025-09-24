// Common types for the scraper service

export interface ScrapeJob {
  id: string;
  type: 'navigation' | 'category' | 'product';
  target_url: string;
  priority: number;
  created_at: string;
  metadata?: Record<string, any>;
  status?: 'queued' | 'running' | 'completed' | 'failed';
  attempts?: number;
  max_attempts?: number;
  locked_at?: string;
  locked_by?: string;
  last_error?: string;
}

export interface ScrapedProduct {
  title: string;
  source_url: string;
  source_id?: string;
  price?: number;
  currency?: string;
  image_urls: string[];
  summary?: string;
  specs: Record<string, any>;
  available: boolean;
  category_id?: string;
}

export interface ImageProcessingResult {
  success: boolean;
  r2Url?: string;
  originalUrl: string;
  filename?: string;
  error?: string;
  size?: number;
  format?: string;
  dimensions?: { width: number; height: number };
}

export interface ImageValidationResult {
  isValid: boolean;
  format?: string;
  size?: number;
  dimensions?: { width: number; height: number };
  error?: string;
}

export interface ScrapedCategory {
  title: string;
  source_url: string;
  product_count: number;
  navigation_id?: string;
}

export interface ScrapedNavigation {
  title: string;
  source_url: string;
  parent_id?: string;
}

export interface CrawlerStats {
  requestsFinished: number;
  requestsFailed: number;
  requestsRetries: number;
  requestsTotal: number;
  crawlerRuntimeMillis: number;
}

export interface JobResult {
  success: boolean;
  itemsProcessed: number;
  errors: string[];
  duration: number;
  metadata?: Record<string, any>;
}

export interface QueueStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  locked: number; // PostgreSQL-specific: jobs with active locks
}



// Error types
export class ScrapingError extends Error {
  constructor(
    message: string,
    public url: string,
    public jobId: string,
    public attempt: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ScrapingError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field: string, public value: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string, public configKey: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}