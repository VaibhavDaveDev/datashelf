# PostgreSQL Queue and Job Management System

> **⚠️ OUTDATED DOCUMENTATION**: This document describes the old Redis-based system. The system has been migrated to use PostgreSQL for job queues and locking. This file will be updated in task 4 when the PostgreSQL implementation is complete.

This document describes the PostgreSQL-based queue and job management system implemented for the DataShelf scraper service.

## Overview

The queue system provides:
- **Distributed job queue** using Redis sorted sets for priority-based processing
- **Distributed locking** to prevent duplicate work on the same URLs
- **Retry logic** with exponential backoff for failed jobs
- **Dead letter queue** for jobs that exceed maximum retry attempts
- **Concurrent processing** with configurable worker count
- **Job monitoring** and statistics

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Job Producer  │───▶│   Redis Queue   │───▶│  Job Processor  │
│                 │    │                 │    │                 │
│ - API Endpoints │    │ - Main Queue    │    │ - Worker Pool   │
│ - Scheduled     │    │ - Delayed Queue │    │ - Lock Manager  │
│   Tasks         │    │ - Dead Letter   │    │ - Retry Logic   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Components

### 1. RedisQueue (`src/services/queue.ts`)

Core queue operations:
- `enqueue(job)` - Add job to queue with priority
- `dequeue()` - Get next job from queue
- `completeJob(jobId)` - Mark job as completed
- `failJob(jobId, error)` - Handle job failure with retry logic
- `acquireLock(url, options)` - Acquire distributed lock
- `releaseLock(url, lockValue)` - Release distributed lock

### 2. JobManager (`src/services/jobManager.ts`)

High-level job management:
- Worker pool management
- Job processing orchestration
- Health monitoring
- Graceful shutdown handling

### 3. Queue Routes (`src/routes/queue.ts`)

HTTP API for queue management:
- `POST /api/queue/jobs` - Add new job
- `GET /api/queue/stats` - Get queue statistics
- `GET /api/queue/dead-letter` - View failed jobs
- `POST /api/queue/dead-letter/requeue` - Retry failed jobs

## Usage

### Basic Setup

```typescript
import { JobManager } from './services/jobManager';
import { JobResult } from './types';

// Initialize job manager
const jobManager = new JobManager({
  concurrency: 3,           // Number of concurrent workers
  lockTTL: 10 * 60 * 1000, // Lock timeout (10 minutes)
  pollInterval: 1000,       // Queue polling interval
});

await jobManager.initialize();

// Set job processor
jobManager.setJobProcessor(async (job) => {
  // Your job processing logic here
  console.log(`Processing ${job.type} job: ${job.target_url}`);
  
  // Return result
  return {
    success: true,
    itemsProcessed: 1,
    errors: [],
    duration: 1000,
  } as JobResult;
});

// Start processing
await jobManager.start();
```

### Adding Jobs

```typescript
// Add a single job
const jobId = await jobManager.addJob({
  type: 'product',
  target_url: 'https://example.com/product/123',
  priority: 5,
  metadata: { category: 'books' },
});

// Add multiple jobs
const jobs = [
  { type: 'navigation', target_url: 'https://example.com', priority: 10 },
  { type: 'category', target_url: 'https://example.com/books', priority: 7 },
  { type: 'product', target_url: 'https://example.com/book/1', priority: 5 },
];

for (const job of jobs) {
  await jobManager.addJob(job);
}
```

### Monitoring

```typescript
// Get queue statistics
const stats = await jobManager.getStats();
console.log('Queue stats:', stats);
// Output: { queued: 5, running: 2, completed: 100, failed: 3 }

// Health check
const health = await jobManager.healthCheck();
console.log('Health:', health.status); // 'healthy' or 'unhealthy'

// Dead letter queue
const deadJobs = await jobManager.getDeadLetterJobs(10);
console.log('Failed jobs:', deadJobs.length);

// Requeue failed job
await jobManager.requeueDeadLetterJob(0); // Requeue first failed job
```

## Job Types

The system supports three job types:

### Navigation Jobs
- **Purpose**: Scrape main navigation and category structure
- **Priority**: High (8-10)
- **Example**: `{ type: 'navigation', target_url: 'https://worldofbooks.com' }`

### Category Jobs
- **Purpose**: Scrape product listings from category pages
- **Priority**: Medium (5-7)
- **Example**: `{ type: 'category', target_url: 'https://worldofbooks.com/fiction' }`

### Product Jobs
- **Purpose**: Scrape individual product details
- **Priority**: Low-Medium (1-5)
- **Example**: `{ type: 'product', target_url: 'https://worldofbooks.com/book/123' }`

## Error Handling and Retries

### Retry Logic
- **Exponential backoff**: 1s, 2s, 4s, 8s, 16s...
- **Jitter**: ±10% randomization to prevent thundering herd
- **Max attempts**: Configurable (default: 3)

### Dead Letter Queue
Jobs that fail after maximum attempts are moved to a dead letter queue for manual review:

```typescript
// View failed jobs
const deadJobs = await jobManager.getDeadLetterJobs();

// Requeue specific job
await jobManager.requeueDeadLetterJob(0);
```

## Distributed Locking

Prevents duplicate work on the same URLs:

```typescript
// Automatic locking in job processing
const lockValue = await queue.acquireLock(job.target_url, {
  ttl: 10 * 60 * 1000, // 10 minutes
  retryDelay: 100,      // 100ms between attempts
  maxRetries: 10,       // Maximum lock acquisition attempts
});

if (lockValue) {
  try {
    // Process job
    await processJob(job);
  } finally {
    // Always release lock
    await queue.releaseLock(job.target_url, lockValue);
  }
}
```

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Scraper Configuration
SCRAPER_CONCURRENT_JOBS=3
SCRAPER_RETRY_ATTEMPTS=3
SCRAPER_REQUEST_DELAY=1000

# Job Manager Configuration (optional)
JOB_MANAGER_LOCK_TTL=600000      # 10 minutes
JOB_MANAGER_POLL_INTERVAL=1000   # 1 second
JOB_MANAGER_DELAYED_INTERVAL=30000 # 30 seconds
```

### JobManager Options

```typescript
const jobManager = new JobManager({
  concurrency: 3,                    // Number of worker processes
  lockTTL: 10 * 60 * 1000,          // Lock timeout in milliseconds
  pollInterval: 1000,                // Queue polling interval
  delayedJobsInterval: 30 * 1000,    // Delayed jobs processing interval
});
```

## API Endpoints

### Add Job
```http
POST /api/queue/jobs
Content-Type: application/json

{
  "type": "product",
  "target_url": "https://example.com/product/123",
  "priority": 5,
  "metadata": {
    "category": "books"
  }
}
```

### Get Statistics
```http
GET /api/queue/stats

Response:
{
  "success": true,
  "data": {
    "queue": {
      "queued": 5,
      "running": 2,
      "completed": 100,
      "failed": 3
    },
    "health": {
      "isRunning": true,
      "activeWorkers": 3,
      "redisConnected": true
    },
    "status": "healthy"
  }
}
```

### View Dead Letter Queue
```http
GET /api/queue/dead-letter?limit=10

Response:
{
  "success": true,
  "data": [
    {
      "id": "job-123",
      "type": "product",
      "target_url": "https://example.com/product/123",
      "attempts": 3,
      "max_attempts": 3,
      "last_error": "Network timeout"
    }
  ],
  "count": 1
}
```

### Requeue Failed Job
```http
POST /api/queue/dead-letter/requeue
Content-Type: application/json

{
  "index": 0
}
```

## Testing

The queue system includes comprehensive tests:

```bash
# Run all tests
npm test

# Run specific test suites
npm test queue.test.ts
npm test jobManager.test.ts
npm test integration.test.ts
```

### Test Coverage
- ✅ Queue operations (enqueue, dequeue, complete, fail)
- ✅ Distributed locking with TTL
- ✅ Retry logic with exponential backoff
- ✅ Dead letter queue management
- ✅ Job manager worker pool
- ✅ Health monitoring
- ✅ Integration scenarios

## Performance Considerations

### Scaling
- **Horizontal**: Multiple scraper instances can share the same Redis queue
- **Vertical**: Increase `concurrency` setting for more workers per instance
- **Redis**: Use Redis Cluster for high availability

### Memory Usage
- Jobs are stored in Redis with automatic cleanup after completion
- Dead letter queue should be monitored and cleaned periodically
- Lock keys have TTL to prevent memory leaks

### Network
- Redis connection pooling is handled automatically by ioredis
- Pipeline operations are used for atomic multi-command operations
- Exponential backoff prevents overwhelming the target servers

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**
   ```
   Error: Connection is closed
   ```
   - Check Redis server is running
   - Verify REDIS_URL configuration
   - Check network connectivity

2. **Jobs Stuck in Processing**
   ```
   Jobs showing as "running" but not completing
   ```
   - Check worker processes are running
   - Look for unhandled exceptions in job processor
   - Verify locks are being released properly

3. **High Memory Usage**
   ```
   Redis memory usage growing continuously
   ```
   - Check dead letter queue size
   - Verify job cleanup is working
   - Monitor lock key expiration

### Debugging

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

Monitor Redis directly:
```bash
redis-cli monitor
```

Check queue contents:
```bash
redis-cli
> ZRANGE scrape_queue 0 -1 WITHSCORES
> SMEMBERS scrape_processing
> LRANGE scrape_dead_letter 0 -1
```

## Example Implementation

See `src/examples/queueUsage.ts` for a complete working example of how to set up and use the queue system.

```bash
# Run the example
npm run dev -- src/examples/queueUsage.ts
```

This will demonstrate:
- Job manager initialization
- Adding different types of jobs
- Processing jobs with simulated work
- Error handling and retries
- Queue monitoring and statistics