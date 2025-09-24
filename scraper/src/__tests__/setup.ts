// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.LOG_LEVEL = 'error';

// Mock environment variables for testing
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

process.env.CLOUDFLARE_R2_ACCOUNT_ID = 'test-account-id';
process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'test-access-key';
process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.CLOUDFLARE_R2_PUBLIC_URL = 'https://test.r2.dev';
process.env.SCRAPER_API_KEY = 'test-api-key';