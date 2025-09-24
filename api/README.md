# DataShelf API

The DataShelf API is built on Cloudflare Workers and provides fast, globally distributed access to product data with intelligent caching and stale-while-revalidate behavior.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │ Cloudflare Workers│    │   Supabase      │
│   Requests      │───►│     Edge API      │───►│  PostgreSQL     │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Workers Cache   │
                       │ API (Global)    │
                       └─────────────────┘
```

## Features

- **Edge Caching**: Global CDN with 300+ locations
- **Stale-While-Revalidate**: Serve cached data while updating in background
- **Dynamic TTL**: Different cache durations based on data type
- **Request Authentication**: HMAC-SHA256 for internal endpoints
- **Rate Limiting**: Per-IP and per-API-key limits
- **Error Handling**: Consistent error responses with proper HTTP codes

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers enabled
- Supabase project
- Wrangler CLI

### Development Setup

1. **Install dependencies:**
   ```bash
   cd api
   npm install
   ```

2. **Install Wrangler CLI:**
   ```bash
   npm install -g wrangler
   wrangler login
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Set up secrets:**
   ```bash
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_ANON_KEY
   wrangler secret put SUPABASE_SERVICE_KEY
   wrangler secret put SCRAPER_API_KEY
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

### Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Authentication
SCRAPER_API_KEY=your-secure-api-key
HMAC_SECRET=your-hmac-secret

# Cache Configuration
DEFAULT_CACHE_TTL=300
NAVIGATION_CACHE_TTL=3600
CATEGORY_CACHE_TTL=1800
PRODUCT_CACHE_TTL=120

# Rate Limiting
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_AUTHENTICATED=1000

# Environment
ENVIRONMENT=development
```

## Project Structure

```
api/
├── src/
│   ├── handlers/           # Request handlers
│   │   ├── navigation.ts   # Navigation endpoints
│   │   ├── categories.ts   # Category endpoints
│   │   ├── products.ts     # Product endpoints
│   │   └── scraper.ts      # Internal scraper endpoints
│   ├── utils/              # Utilities
│   │   ├── cache.ts        # Cache management
│   │   ├── database.ts     # Supabase client
│   │   ├── auth.ts         # Authentication
│   │   ├── validation.ts   # Request validation
│   │   └── errors.ts       # Error handling
│   ├── middleware/         # Middleware functions
│   │   ├── cors.ts         # CORS handling
│   │   ├── rateLimit.ts    # Rate limiting
│   │   └── logging.ts      # Request logging
│   ├── types/              # TypeScript types
│   │   ├── api.ts          # API types
│   │   └── database.ts     # Database types
│   └── index.ts            # Main worker entry point
├── wrangler.toml           # Cloudflare Workers config
├── package.json
└── README.md
```

## API Endpoints

### Public Endpoints

#### GET /api/navigation

Returns hierarchical navigation structure.

**Cache**: 1 hour

```typescript
export async function handleNavigation(request: Request): Promise<Response> {
  const cacheKey = new Request(request.url, { method: 'GET' });
  
  // Try cache first
  let response = await caches.default.match(cacheKey);
  if (response) {
    return response;
  }
  
  // Fetch from database
  const { data, error } = await supabase
    .from('navigation')
    .select(`
      id,
      title,
      source_url,
      children:navigation!parent_id(
        id,
        title,
        source_url
      )
    `)
    .is('parent_id', null)
    .order('title');
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  response = new Response(JSON.stringify({ data }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'CDN-Cache-Control': 'public, max-age=3600'
    }
  });
  
  // Store in cache
  await caches.default.put(cacheKey, response.clone());
  
  return response;
}
```

#### GET /api/categories

Returns categories with filtering and pagination.

**Query Parameters:**
- `navId`: Filter by navigation ID
- `parentId`: Filter by parent category
- `limit`: Results per page (default: 20, max: 100)
- `offset`: Pagination offset (default: 0)

**Cache**: 30 minutes

```typescript
export async function handleCategories(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const navId = url.searchParams.get('navId');
  const parentId = url.searchParams.get('parentId');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  // Build query
  let query = supabase
    .from('category')
    .select('id, navigation_id, title, product_count, last_scraped_at', { count: 'exact' });
  
  if (navId) query = query.eq('navigation_id', navId);
  if (parentId) query = query.eq('parent_id', parentId);
  
  query = query
    .order('product_count', { ascending: false })
    .range(offset, offset + limit - 1);
  
  const { data, error, count } = await query;
  
  if (error) {
    return createErrorResponse(error.message, 500);
  }
  
  const response = {
    data,
    pagination: {
      total: count || 0,
      limit,
      offset,
      pages: Math.ceil((count || 0) / limit)
    }
  };
  
  return createCachedResponse(response, 1800); // 30 minutes
}
```

#### GET /api/products

Returns paginated product listings with filtering and sorting.

**Query Parameters:**
- `categoryId`: Filter by category ID
- `limit`: Results per page (default: 20, max: 100)
- `offset`: Pagination offset (default: 0)
- `sort`: Sort order (price_asc, price_desc, title_asc, title_desc, newest)
- `available`: Filter by availability (true/false)

**Cache**: 5 minutes

```typescript
export async function handleProducts(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const categoryId = url.searchParams.get('categoryId');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const sort = url.searchParams.get('sort') || 'newest';
  const available = url.searchParams.get('available');
  
  // Build query
  let query = supabase
    .from('product')
    .select(`
      id,
      title,
      price,
      currency,
      image_urls,
      available,
      category_id,
      last_scraped_at
    `, { count: 'exact' });
  
  if (categoryId) query = query.eq('category_id', categoryId);
  if (available !== null) query = query.eq('available', available === 'true');
  
  // Apply sorting
  switch (sort) {
    case 'price_asc':
      query = query.order('price', { ascending: true, nullsLast: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false, nullsLast: true });
      break;
    case 'title_asc':
      query = query.order('title', { ascending: true });
      break;
    case 'title_desc':
      query = query.order('title', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }
  
  query = query.range(offset, offset + limit - 1);
  
  const { data, error, count } = await query;
  
  if (error) {
    return createErrorResponse(error.message, 500);
  }
  
  // Process image URLs to get thumbnails
  const processedData = data?.map(product => ({
    ...product,
    thumbnail: Array.isArray(product.image_urls) && product.image_urls.length > 0 
      ? product.image_urls[0] 
      : null
  }));
  
  const response = {
    data: processedData,
    pagination: {
      total: count || 0,
      limit,
      offset,
      pages: Math.ceil((count || 0) / limit),
      current_page: Math.floor(offset / limit) + 1
    },
    filters: {
      categoryId,
      sort,
      available: available === 'true' ? true : available === 'false' ? false : null
    }
  };
  
  return createCachedResponse(response, 300); // 5 minutes
}
```

#### GET /api/products/:id

Returns detailed product information.

**Cache**: 2 minutes

```typescript
export async function handleProductDetail(request: Request, productId: string): Promise<Response> {
  const { data, error } = await supabase
    .from('product')
    .select(`
      id,
      title,
      price,
      currency,
      image_urls,
      summary,
      specs,
      available,
      source_url,
      category_id,
      last_scraped_at,
      created_at,
      updated_at
    `)
    .eq('id', productId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return createErrorResponse('Product not found', 404);
    }
    return createErrorResponse(error.message, 500);
  }
  
  return createCachedResponse({ data }, 120); // 2 minutes
}
```

### Internal Endpoints (Authenticated)

#### POST /api/scraper/enqueue

Enqueues scraping jobs.

**Authentication**: Required (HMAC-SHA256)

```typescript
export async function handleEnqueueJob(request: Request): Promise<Response> {
  // Verify authentication
  const authResult = await verifyHMACAuth(request);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }
  
  const body = await request.json();
  const { type, target_url, priority = 0, metadata = {} } = body;
  
  // Validate request
  if (!type || !target_url) {
    return createErrorResponse('Missing required fields: type, target_url', 400);
  }
  
  if (!['navigation', 'category', 'product'].includes(type)) {
    return createErrorResponse('Invalid job type', 400);
  }
  
  // Enqueue job
  const { data, error } = await supabase
    .rpc('enqueue_scrape_job', {
      p_type: type,
      p_target_url: target_url,
      p_priority: priority,
      p_metadata: metadata
    });
  
  if (error) {
    return createErrorResponse(error.message, 500);
  }
  
  return new Response(JSON.stringify({
    success: true,
    job_id: data,
    message: 'Job enqueued successfully'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

#### GET /api/scraper/status

Returns scraper service status and metrics.

```typescript
export async function handleScraperStatus(request: Request): Promise<Response> {
  // Get job queue statistics
  const { data: queueStats } = await supabase
    .from('job_queue_stats')
    .select('*');
  
  // Get recent job metrics
  const { data: recentJobs } = await supabase
    .from('scrape_job')
    .select('status, created_at, completed_at')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const metrics = {
    queue: queueStats?.reduce((acc, stat) => {
      acc[stat.status] = stat.count;
      return acc;
    }, {} as Record<string, number>) || {},
    
    today: {
      completed: recentJobs?.filter(job => job.status === 'completed').length || 0,
      failed: recentJobs?.filter(job => job.status === 'failed').length || 0
    }
  };
  
  const successRate = metrics.today.completed / 
    (metrics.today.completed + metrics.today.failed) * 100;
  
  return new Response(JSON.stringify({
    status: 'healthy',
    metrics: {
      ...metrics,
      success_rate: isNaN(successRate) ? 100 : successRate
    },
    last_updated: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## Cache Management

### Cache Strategy

The API uses Cloudflare's Workers Cache API with different TTL values:

```typescript
export function getCacheTTL(pathname: string): number {
  if (pathname.includes('/navigation')) return 3600; // 1 hour
  if (pathname.includes('/categories')) return 1800; // 30 minutes  
  if (pathname.includes('/products/')) return 120;   // 2 minutes (product detail)
  if (pathname.includes('/products')) return 300;    // 5 minutes (product list)
  return 60; // 1 minute default
}

export async function createCachedResponse(data: any, ttl: number): Promise<Response> {
  const response = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ttl}`,
      'CDN-Cache-Control': `public, max-age=${ttl}`,
      'X-Cache-TTL': ttl.toString()
    }
  });
  
  return response;
}
```

### Cache Invalidation

```typescript
export async function invalidateCache(patterns: string[]): Promise<void> {
  for (const pattern of patterns) {
    // Purge cache using Cloudflare API
    await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: [pattern]
      })
    });
  }
}
```

### Stale-While-Revalidate

```typescript
export async function handleWithSWR(
  request: Request,
  fetchFresh: () => Promise<Response>
): Promise<Response> {
  const cacheKey = new Request(request.url, { method: 'GET' });
  
  // Try cache first
  const cached = await caches.default.match(cacheKey);
  
  if (cached) {
    // Check if cache is stale
    const cacheDate = new Date(cached.headers.get('Date') || 0);
    const ttl = parseInt(cached.headers.get('X-Cache-TTL') || '300');
    const isStale = Date.now() - cacheDate.getTime() > ttl * 1000;
    
    if (isStale) {
      // Return stale data immediately, refresh in background
      ctx.waitUntil(refreshCache(cacheKey, fetchFresh));
    }
    
    return cached;
  }
  
  // Cache miss - fetch fresh data
  const fresh = await fetchFresh();
  await caches.default.put(cacheKey, fresh.clone());
  
  return fresh;
}

async function refreshCache(
  cacheKey: Request, 
  fetchFresh: () => Promise<Response>
): Promise<void> {
  try {
    const fresh = await fetchFresh();
    await caches.default.put(cacheKey, fresh);
  } catch (error) {
    console.error('Background refresh failed:', error);
  }
}
```

## Authentication

### HMAC-SHA256 Authentication

```typescript
export async function verifyHMACAuth(request: Request): Promise<{ valid: boolean; error?: string }> {
  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
  const signature = request.headers.get('X-Signature');
  const timestamp = request.headers.get('X-Timestamp');
  
  if (!apiKey || !signature || !timestamp) {
    return { valid: false, error: 'Missing authentication headers' };
  }
  
  // Check API key
  if (apiKey !== SCRAPER_API_KEY) {
    return { valid: false, error: 'Invalid API key' };
  }
  
  // Check timestamp (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp);
  
  if (Math.abs(now - requestTime) > 300) { // 5 minutes tolerance
    return { valid: false, error: 'Request timestamp too old' };
  }
  
  // Verify HMAC signature
  const body = await request.clone().text();
  const payload = `${request.method}${request.url}${timestamp}${body}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  if (signature !== expectedSignature) {
    return { valid: false, error: 'Invalid signature' };
  }
  
  return { valid: true };
}
```

## Rate Limiting

```typescript
export class RateLimiter {
  private cache = new Map<string, { count: number; resetTime: number }>();
  
  async isRateLimited(
    identifier: string, 
    limit: number, 
    windowMs: number = 60000
  ): Promise<boolean> {
    const now = Date.now();
    const key = `rate_limit:${identifier}`;
    
    let record = this.cache.get(key);
    
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      this.cache.set(key, record);
    }
    
    record.count++;
    
    return record.count > limit;
  }
  
  getRemainingRequests(identifier: string, limit: number): number {
    const record = this.cache.get(`rate_limit:${identifier}`);
    return record ? Math.max(0, limit - record.count) : limit;
  }
}

export async function handleRateLimit(request: Request): Promise<Response | null> {
  const rateLimiter = new RateLimiter();
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  const identifier = apiKey || clientIP;
  const limit = apiKey ? RATE_LIMIT_AUTHENTICATED : RATE_LIMIT_PER_MINUTE;
  
  if (await rateLimiter.isRateLimited(identifier, limit)) {
    return new Response(JSON.stringify({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        retry_after: 60
      }
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60'
      }
    });
  }
  
  return null; // Not rate limited
}
```

## Error Handling

```typescript
export interface APIError {
  code: string;
  message: string;
  details?: string;
}

export function createErrorResponse(
  message: string, 
  status: number, 
  code?: string,
  details?: string
): Response {
  const error: APIError = {
    code: code || getErrorCode(status),
    message,
    details
  };
  
  return new Response(JSON.stringify({
    error,
    timestamp: new Date().toISOString(),
    request_id: crypto.randomUUID()
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function getErrorCode(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'RESOURCE_NOT_FOUND';
    case 429: return 'RATE_LIMITED';
    case 500: return 'INTERNAL_ERROR';
    case 503: return 'SERVICE_UNAVAILABLE';
    default: return 'UNKNOWN_ERROR';
  }
}
```

## Deployment

### Wrangler Configuration

```toml
name = "datashelf-api"
main = "src/index.ts"
compatibility_date = "2024-01-15"
compatibility_flags = ["nodejs_compat"]

[build]
command = "npm run build"

[env.development]
vars = { ENVIRONMENT = "development" }

[env.staging]
vars = { ENVIRONMENT = "staging" }

[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.routes]]
pattern = "api.datashelf.com/*"
zone_name = "datashelf.com"
```

### Deployment Commands

```bash
# Deploy to development
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy-api.yml
name: Deploy API

on:
  push:
    branches: [main]
    paths: ['api/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd api
          npm ci
          
      - name: Run tests
        run: |
          cd api
          npm test
          
      - name: Deploy to Cloudflare Workers
        run: |
          cd api
          npx wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Load Testing

```bash
# Test API endpoints under load
npm run test:load
```

## Monitoring

### Health Checks

```typescript
export async function handleHealth(): Promise<Response> {
  const checks = {
    database: await checkDatabase(),
    cache: await checkCache(),
    timestamp: new Date().toISOString()
  };
  
  const allHealthy = Object.values(checks).every(check => 
    typeof check === 'boolean' ? check : true
  );
  
  return new Response(JSON.stringify({
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks
  }), {
    status: allHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function checkDatabase(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('product')
      .select('id')
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function checkCache(): Promise<boolean> {
  try {
    const testKey = new Request('https://test.com/cache-check');
    const testResponse = new Response('test');
    await caches.default.put(testKey, testResponse);
    const cached = await caches.default.match(testKey);
    return !!cached;
  } catch {
    return false;
  }
}
```

### Performance Metrics

```typescript
export function addPerformanceHeaders(response: Response, startTime: number): Response {
  const duration = Date.now() - startTime;
  
  response.headers.set('X-Response-Time', `${duration}ms`);
  response.headers.set('X-Worker-Location', 'global');
  
  return response;
}
```

## Troubleshooting

See the main [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for detailed troubleshooting information.

### Common Issues

1. **Deployment failures**: Check Cloudflare credentials and wrangler.toml
2. **Cache not working**: Verify cache headers and TTL settings
3. **Database connection issues**: Check Supabase URL and keys
4. **Rate limiting**: Verify rate limit configuration and headers