import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Server Configuration
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase Configuration
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1),



  // Cloudflare R2 Configuration
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().min(1),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().min(1),
  CLOUDFLARE_R2_BUCKET_NAME: z.string().default('datashelf-images'),
  CLOUDFLARE_R2_PUBLIC_URL: z.string().url(),

  // Scraper Configuration
  SCRAPER_API_KEY: z.string().min(1),
  SCRAPER_USER_AGENT: z.string().default('DataShelf-Bot/1.0'),
  SCRAPER_CONCURRENT_JOBS: z.string().default('3').transform(Number),
  SCRAPER_REQUEST_DELAY: z.string().default('1000').transform(Number),
  SCRAPER_RETRY_ATTEMPTS: z.string().default('3').transform(Number),

  // World of Books Configuration
  WOB_BASE_URL: z.string().url().default('https://www.worldofbooks.com'),
  WOB_RATE_LIMIT_DELAY: z.string().default('2000').transform(Number),

  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),
});

// Validate and export configuration
export const config = envSchema.parse(process.env);

// Type for configuration
export type Config = z.infer<typeof envSchema>;