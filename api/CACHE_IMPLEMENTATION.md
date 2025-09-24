# Cache Implementation with Stale-While-Revalidate

This document describes the comprehensive caching layer implementation for the DataShelf API using Cloudflare Workers KV with stale-while-revalidate pattern.

## Overview

The caching system provides:
- **Stale-While-Revalidate (SWR)** pattern for optimal performance
- **Cache invalidation** mechanisms for data consistency
- **Monitoring and metrics** for observability
- **TTL management** for different data types
- **Background revalidation** for seamless user experience

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Request   │───▶│  Cache Manager  │───▶│ Cloudflare KV   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Database      │
                       │   (Supabase)    │
                       └─────────────────┘
```

## Core Components

### 1. CacheManager (`src/utils/cache.ts`)

The main cache operations class that handles:
- **Data storage** with metadata (timestamp, TTL, stale time)
- **Stale-while-revalidate** logic
- **Background revalidation** for stale data
- **Metrics tracking** (hits, misses, stale hits, errors)
- **Cache invalidation** by prefix patterns

#### Key Methods:

```typescript
// Get cached data with metadata
async get<T>(key: string): Promise<CacheEntry<T> | null>

// Set data with TTL and SWR metadata
async set<T>(key: string, data: T, ttl: number): Promise<void>

// SWR pattern implementation
async getWithSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  revalidateInBackground = true
): Promise<{ data: T; cached: boolean; stale: boolean }>
```

### 2. Cache Configuration (`src/types/env.ts`)

Environment-based TTL configuration:
- **Navigation**: 15 minutes (900s) - Changes infrequently
- **Categories**: 5 minutes (300s) - Moderate change frequency
- **Products**: 5 minutes (300s) - Regular updates
- **Product Details**: 15 minutes (900s) - Detailed data, less frequent changes

### 3. Response Utilities (`src/utils/response.ts`)

Standardized response functions with appropriate cache headers:
- `swrResponse()` - Handles both cached and fresh responses
- `cachedResponse()` - For cache hits with proper headers
- `freshResponse()` - For cache misses with caching headers

### 4. Cache Invalidation (`src/utils/cache-invalidation.ts`)

Handles cache invalidation patterns:
- **By type**: navigation, category, product, all
- **By relationships**: invalidate related data (e.g., products when category changes)
- **Index management**: maintains key indexes for efficient bulk invalidation

### 5. Monitoring Service (`src/utils/cache-monitoring.ts`)

Provides observability:
- **Real-time metrics**: hit rates, error rates, stale rates
- **Health checks**: cache connectivity and performance
- **Performance reports**: recommendations based on metrics
- **Historical data**: metrics over time for trend analysis

## Stale-While-Revalidate Implementation

### How It Works

1. **Request arrives** for cached data
2. **Check cache** for existing entry
3. **If found and fresh**: Return immediately
4. **If found but stale**: 
   - Return stale data immediately (fast response)
   - Trigger background revalidation (update cache)
5. **If not found**: Fetch fresh data and cache it

### Benefits

- **Fast responses**: Users get immediate responses from cache
- **Fresh data**: Background updates ensure data freshness
- **Resilience**: Stale data served if database is slow/unavailable
- **Reduced load**: Database queries happen in background

### Cache Headers

```http
# Fresh data
Cache-Control: public, max-age=300, stale-while-revalidate=600
X-Cache: MISS
X-Cache-TTL: 300

# Cached fresh data
Cache-Control: public, max-age=300, stale-while-revalidate=600
X-Cache: HIT
X-Cache-TTL: 300

# Stale data (triggers background refresh)
Cache-Control: public, max-age=0, stale-while-revalidate=600
X-Cache: STALE
X-Cache-TTL: 300
```

## API Endpoints

### Cache Management

- `POST /api/cache/invalidate` - Invalidate cache by type/ID
- `POST /api/cache/warm` - Warm cache with fresh data
- `POST /api/cache/cleanup` - Clean expired cache entries
- `GET /api/cache/stats` - Detailed cache statistics

### Monitoring

- `GET /health` - Overall health including cache status
- `GET /cache/health` - Cache-specific health check
- `GET /cache/metrics` - Detailed cache metrics
- `POST /cache/metrics/record` - Record metrics to history

## Usage Examples

### In API Handlers

```typescript
// Navigation handler with SWR
app.get('/', async (c) => {
  const env = c.env as Env;
  const cacheConfig = getCacheConfig(env);
  const cacheManager = new CacheManager(env.CACHE);
  const cacheKey = generateCacheKey('navigation');

  const result = await cacheManager.getWithSWR(
    cacheKey,
    async () => {
      // Database fetch logic
      const supabase = createSupabaseClient(env);
      const { data } = await supabase.from('navigation').select('*');
      return processNavigationData(data);
    },
    cacheConfig.navigation
  );

  // Add to index for invalidation
  if (!result.cached) {
    await cacheManager.addToIndex('navigation', cacheKey);
  }

  return swrResponse(c, result.data, cacheConfig.navigation, result.cached, result.stale);
});
```

### Cache Invalidation

```typescript
// Invalidate when data changes
const invalidationService = new CacheInvalidationService(env);

// Invalidate specific product and related data
await invalidationService.invalidate({
  type: 'product',
  id: 'product-123',
  categoryId: 'category-456'
});

// Invalidate all navigation data
await invalidationService.invalidate({
  type: 'navigation'
});
```

## Configuration

### Environment Variables

```bash
# Cache TTL values (seconds)
CACHE_TTL_NAVIGATION=900      # 15 minutes
CACHE_TTL_CATEGORIES=300      # 5 minutes  
CACHE_TTL_PRODUCTS=300        # 5 minutes
CACHE_TTL_PRODUCT_DETAIL=900  # 15 minutes

# API security
SCRAPER_API_KEY=your-secret-key
```

### Cloudflare Workers Configuration

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"
```

## Monitoring and Metrics

### Key Metrics

- **Hit Rate**: Percentage of requests served from cache
- **Stale Rate**: Percentage of requests served stale data
- **Error Rate**: Percentage of cache operations that failed
- **Response Times**: Cache vs database response times

### Health Checks

The system provides multiple health check levels:
- **Basic**: Cache connectivity test
- **Performance**: Hit rates and error rates
- **Capacity**: Cache size estimates by prefix

### Alerts and Recommendations

The monitoring service provides automatic recommendations:
- Low hit rates → Increase TTL values
- High stale rates → More frequent cache warming
- High error rates → Check KV namespace configuration

## Best Practices

### Cache Key Design

- Use consistent naming: `{prefix}:{param1}={value1}&{param2}={value2}`
- Sort parameters for consistency
- URL encode parameter values
- Filter out undefined/null values

### TTL Selection

- **Static data** (navigation): Longer TTL (15+ minutes)
- **Dynamic data** (products): Shorter TTL (5 minutes)
- **User-specific data**: Very short TTL or no cache
- **Critical data**: Shorter TTL with frequent revalidation

### Invalidation Strategy

- **Cascade invalidation**: Related data invalidation
- **Batch operations**: Invalidate multiple keys together
- **Index maintenance**: Keep invalidation indexes clean
- **Graceful degradation**: Handle invalidation failures

## Testing

### Unit Tests

- Cache key generation
- TTL configuration parsing
- SWR logic with various scenarios
- Metrics tracking accuracy

### Integration Tests

- End-to-end cache workflows
- API endpoint responses
- Cache header validation
- Error handling scenarios

### Performance Tests

- Cache hit/miss ratios
- Response time improvements
- Concurrent request handling
- Memory usage patterns

## Deployment

### Development

```bash
# Start development server with cache
npm run dev

# Run cache-specific tests
npm test -- cache-simple
```

### Production

```bash
# Deploy with cache configuration
wrangler deploy --env production

# Verify cache health
curl https://api.datashelf.com/cache/health
```

## Troubleshooting

### Common Issues

1. **Low hit rates**
   - Check TTL values
   - Verify cache key consistency
   - Review invalidation patterns

2. **High error rates**
   - Check KV namespace configuration
   - Verify environment variables
   - Monitor KV quotas and limits

3. **Stale data issues**
   - Review background revalidation logic
   - Check database connectivity
   - Verify invalidation triggers

### Debug Tools

- Cache metrics endpoint: `/api/cache/stats`
- Health check endpoint: `/cache/health`
- Individual cache key inspection via KV dashboard

## Future Enhancements

- **Cache warming** strategies for popular content
- **Distributed cache** across multiple regions
- **Cache compression** for large responses
- **Advanced invalidation** patterns with webhooks
- **A/B testing** for cache configurations