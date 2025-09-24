# API Revalidation Trigger System

This document describes the revalidation trigger system implemented for the DataShelf API, which provides stale-while-revalidate behavior with background job triggering.

## Overview

The revalidation system automatically triggers scraper jobs when cached data becomes stale, ensuring fresh data is available while serving stale data to maintain performance. It uses HMAC-SHA256 signed requests for secure communication with the scraper service.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Handler   │    │  Cache Manager   │    │ Revalidation    │
│                 │───▶│                  │───▶│ Service         │
│ (products.ts)   │    │ (cache.ts)       │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                │                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Workers Cache    │    │ Scraper Service │
                       │ API              │    │ (Render)        │
                       └──────────────────┘    └─────────────────┘
```

## Components

### 1. Request Signing (`utils/request-signing.ts`)

Provides HMAC-SHA256 request signing for secure communication:

- `generateSignature()` - Creates HMAC-SHA256 signatures
- `createSignedRequest()` - Builds complete signed requests
- `verifySignature()` - Validates request signatures
- `isTimestampValid()` - Checks timestamp windows

### 2. Revalidation Service (`services/revalidation.ts`)

Core revalidation logic with rate limiting:

- **Rate Limiting**: 10 requests/minute, 100 requests/hour (configurable)
- **Health Checking**: Monitors scraper service availability
- **Metrics Collection**: Tracks success rates and response times
- **Background Triggering**: Non-blocking job creation

### 3. Integration Utilities (`utils/revalidation-integration.ts`)

Cache key parsing and integration helpers:

- `extractRevalidationDetails()` - Parses cache keys to job details
- `createRevalidationTrigger()` - Creates trigger functions for cache manager
- `RevalidationUtils` - High-level utility class

### 4. API Endpoints (`handlers/revalidation.ts`)

Monitoring and manual control endpoints:

- `GET /api/revalidation/metrics` - Service metrics
- `GET /api/revalidation/status` - System status
- `POST /api/revalidation/trigger` - Manual job triggering
- `GET /api/revalidation/health` - Health check

## Configuration

Environment variables:

```bash
# Required
SCRAPER_SERVICE_URL=https://scraper.example.com
SCRAPER_API_KEY=your-secret-key

# Optional
REVALIDATION_ENABLED=true
REVALIDATION_RATE_LIMIT_PER_MINUTE=10
REVALIDATION_RATE_LIMIT_PER_HOUR=100
```

## Cache Key Mapping

The system maps cache keys to scraper jobs:

| Cache Key Pattern | Job Type | Target URL |
|-------------------|----------|------------|
| `navigation` | `navigation` | `https://www.worldofbooks.com` |
| `categories:navId=X` | `category` | `https://www.worldofbooks.com/category/X` |
| `products:categoryId=X` | `product` | `https://www.worldofbooks.com/category/X/products` |
| `product_detail:id=X` | `product` | `https://www.worldofbooks.com/product/X` |

## Usage

### Automatic Revalidation

Revalidation is automatically triggered when cached data becomes stale:

```typescript
// In API handlers
const result = await cacheManager.getWithSWR(
  cacheKey,
  fetcher,
  ttl,
  true, // Enable background revalidation
  revalidationTrigger // Trigger function
);
```

### Manual Revalidation

Trigger jobs manually via API:

```bash
curl -X POST /api/revalidation/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "type": "product",
    "target_url": "https://worldofbooks.com/product/123",
    "priority": 8
  }'
```

### Monitoring

Check system status:

```bash
# Get metrics
curl /api/revalidation/metrics

# Check health
curl /api/revalidation/health

# Get status
curl /api/revalidation/status
```

## Security

### Request Signing

All requests to the scraper service are signed using HMAC-SHA256:

1. **Canonical String**: `METHOD\nURL\nTIMESTAMP\nNONCE\nBODY`
2. **Signature**: `HMAC-SHA256(secret, canonical_string)`
3. **Headers**: `X-Signature`, `X-Timestamp`, `X-Nonce`, `Authorization`

### Timestamp Validation

Requests must be within 5 minutes of current time to prevent replay attacks.

### Rate Limiting

Per-source rate limiting prevents abuse:
- 10 requests per minute
- 100 requests per hour
- Configurable limits

## Error Handling

### Fallback Mechanisms

1. **Scraper Unavailable**: Serves stale data, logs error
2. **Rate Limited**: Skips revalidation, serves stale data
3. **Network Errors**: Falls back to direct cache revalidation
4. **Invalid Cache Keys**: Logs warning, continues operation

### Monitoring

The system provides comprehensive metrics:

- Total requests and success rates
- Average response times
- Rate limiting statistics
- Scraper availability status

## Testing

Comprehensive test suite covers:

- **Unit Tests**: Individual component functionality
- **Integration Tests**: End-to-end revalidation flows
- **Security Tests**: Request signing and validation
- **Error Handling**: Failure scenarios and fallbacks

Run tests:

```bash
npm test -- --run request-signing
npm test -- --run revalidation
npm test -- --run integration/revalidation
```

## Performance Considerations

### Cache-First Strategy

1. **Serve Stale**: Always serve cached data immediately
2. **Background Refresh**: Trigger revalidation in background
3. **Non-Blocking**: Never block user requests for revalidation

### Rate Limiting

Prevents overwhelming the scraper service while ensuring data freshness.

### Edge Caching

Uses Cloudflare Workers Cache API for global edge distribution.

## Troubleshooting

### Common Issues

1. **Revalidation Not Triggering**
   - Check `REVALIDATION_ENABLED` environment variable
   - Verify scraper service URL and API key
   - Check rate limiting status

2. **High Error Rates**
   - Monitor scraper service health
   - Check network connectivity
   - Review rate limiting configuration

3. **Signature Validation Failures**
   - Verify API key matches scraper configuration
   - Check system clock synchronization
   - Review request signing implementation

### Debug Logging

Enable debug logging to troubleshoot issues:

```typescript
// Check revalidation metrics
const metrics = revalidationService.getMetrics();
console.log('Revalidation metrics:', metrics);

// Check rate limit status
const rateLimits = revalidationService.getRateLimitStatus();
console.log('Rate limits:', rateLimits);
```

## Future Enhancements

Potential improvements:

1. **Distributed Rate Limiting**: Use KV storage for multi-instance rate limiting
2. **Priority Queues**: Implement job prioritization in scraper service
3. **Adaptive TTL**: Adjust cache TTL based on data change frequency
4. **Circuit Breaker**: Implement circuit breaker pattern for scraper failures
5. **Metrics Dashboard**: Web interface for monitoring revalidation metrics