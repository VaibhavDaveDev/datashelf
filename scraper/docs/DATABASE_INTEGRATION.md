# Database Integration

This document describes the database integration for the DataShelf scraper service, including the DatabaseService class, data models, and usage examples.

## Overview

The DatabaseService provides a comprehensive interface for interacting with the Supabase PostgreSQL database. It handles:

- Product data upserts with conflict resolution
- Navigation and category management
- Scrape job tracking and status updates
- Data validation and error handling
- Transaction-like operations for complex workflows

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Scraper       │    │  DatabaseService │    │   Supabase      │
│   Service       │───▶│                  │───▶│   PostgreSQL    │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Data Models    │
                       │   & Validation   │
                       └──────────────────┘
```

## Database Schema

The service works with four main tables:

### Navigation Table
```sql
CREATE TABLE navigation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    source_url text UNIQUE NOT NULL,
    parent_id uuid REFERENCES navigation(id),
    last_scraped_at timestamptz DEFAULT now()
);
```

### Category Table
```sql
CREATE TABLE category (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    navigation_id uuid REFERENCES navigation(id),
    title text NOT NULL,
    source_url text UNIQUE NOT NULL,
    product_count integer DEFAULT 0,
    last_scraped_at timestamptz DEFAULT now()
);
```

### Product Table
```sql
CREATE TABLE product (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid REFERENCES category(id),
    title text NOT NULL,
    source_url text UNIQUE NOT NULL,
    source_id text,
    price numeric(10,2),
    currency text DEFAULT 'GBP',
    image_urls jsonb DEFAULT '[]'::jsonb,
    summary text,
    specs jsonb DEFAULT '{}'::jsonb,
    available boolean DEFAULT true,
    last_scraped_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

### Scrape Job Table
```sql
CREATE TABLE scrape_job (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL CHECK (type IN ('navigation', 'category', 'product')),
    target_url text NOT NULL,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    last_error text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

## Data Models

### TypeScript Interfaces

```typescript
interface DatabaseProduct {
  id: string;
  category_id?: string;
  title: string;
  source_url: string;
  source_id?: string;
  price?: number;
  currency?: string;
  image_urls: string[];
  summary?: string;
  specs: Record<string, any>;
  available: boolean;
  last_scraped_at: string;
  created_at: string;
  updated_at: string;
}

interface DatabaseNavigation {
  id: string;
  title: string;
  source_url: string;
  parent_id?: string;
  last_scraped_at: string;
}

interface DatabaseCategory {
  id: string;
  navigation_id?: string;
  title: string;
  source_url: string;
  product_count: number;
  last_scraped_at: string;
}

interface DatabaseScrapeJob {
  id: string;
  type: 'navigation' | 'category' | 'product';
  target_url: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  last_error?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}
```

## Usage Examples

### Basic Product Upsert

```typescript
import { databaseService } from '../services/database.js';

// Upsert a single product
const product = await databaseService.upsertProduct({
  title: 'Dune',
  source_url: 'https://www.worldofbooks.com/en-gb/books/frank-herbert/dune/9780441172719',
  source_id: '9780441172719',
  price: 8.99,
  currency: 'GBP',
  image_urls: ['https://datashelf-images.r2.dev/dune-cover.jpg'],
  summary: 'Set on the desert planet Arrakis...',
  specs: {
    author: 'Frank Herbert',
    isbn: '9780441172719',
    publisher: 'Ace Books',
    pages: 688,
    language: 'English',
    format: 'Paperback',
  },
  available: true,
  category_id: 'sci-fi-category-id',
});
```

### Batch Operations

```typescript
// Batch upsert multiple products
const products = await databaseService.upsertProducts([
  { /* product 1 */ },
  { /* product 2 */ },
  { /* product 3 */ },
]);

// Batch upsert navigation items
const navigation = await databaseService.upsertNavigations([
  {
    title: 'Fiction',
    source_url: 'https://www.worldofbooks.com/en-gb/category/fiction',
  },
  {
    title: 'Non-Fiction',
    source_url: 'https://www.worldofbooks.com/en-gb/category/non-fiction',
  },
]);
```

### Job Management

```typescript
// Create a scrape job
const job = await databaseService.createScrapeJob(
  'product',
  'https://www.worldofbooks.com/en-gb/books/some-book',
  { priority: 'high', category: 'fiction' }
);

// Mark job as running
await databaseService.markJobAsRunning(job.id);

// Mark job as completed with metadata
await databaseService.markJobAsCompleted(job.id, {
  items_processed: 1,
  duration_ms: 5000,
  images_uploaded: 3,
});

// Mark job as failed
await databaseService.markJobAsFailed(job.id, 'Network timeout', {
  attempt: 2,
  error_type: 'timeout',
});
```

### Transaction-like Operations

```typescript
// Upsert complete scraping result atomically
const result = await databaseService.upsertScrapingResult({
  navigation: [/* navigation items */],
  categories: [/* category items */],
  products: [/* product items */],
  jobId: 'job-uuid', // Optional: will mark job as completed
});
```

### Querying Data

```typescript
// Get products by category with pagination
const { products, total } = await databaseService.getProductsByCategory(
  'category-id',
  20, // limit
  0   // offset
);

// Get navigation hierarchy
const navigation = await databaseService.getNavigationHierarchy();

// Get categories for a navigation item
const categories = await databaseService.getCategoriesByNavigation('nav-id');

// Get jobs by status
const queuedJobs = await databaseService.getScrapeJobsByStatus('queued', 50);
const retryableJobs = await databaseService.getRetryableJobs(20);
```

## Data Validation

The service uses Zod schemas for data validation:

```typescript
// Product validation
const productInsertSchema = z.object({
  category_id: z.string().uuid().optional(),
  title: z.string().min(1),
  source_url: z.string().url(),
  source_id: z.string().optional(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).default('GBP'),
  image_urls: z.array(z.string().url()).default([]),
  summary: z.string().optional(),
  specs: z.record(z.any()).default({}),
  available: z.boolean().default(true),
});
```

Validation errors are thrown as `ValidationError` instances with detailed information about what failed.

## Error Handling

The service provides comprehensive error handling:

```typescript
try {
  await databaseService.upsertProduct(invalidProduct);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.message);
    console.error('Field:', error.field);
    console.error('Value:', error.value);
  } else {
    console.error('Database error:', error.message);
  }
}
```

## Configuration

The service requires these environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Testing

The service includes comprehensive unit tests and integration tests:

```bash
# Run unit tests
npm test -- database.unit

# Run integration tests (requires database connection)
npm test -- database.integration

# Run all database tests
npm test -- database
```

## Performance Considerations

### Batch Operations
- Use `upsertProducts()` instead of multiple `upsertProduct()` calls
- Batch operations are more efficient for large datasets

### Indexing
The database includes indexes on frequently queried columns:
- `product.category_id`
- `product.price`
- `product.available`
- `scrape_job.status`
- `scrape_job.type`

### Connection Management
The service uses a singleton pattern with connection pooling handled by Supabase.

## Monitoring and Maintenance

### Database Statistics
```typescript
const stats = await databaseService.getDatabaseStats();
console.log(stats);
// {
//   navigation_count: 50,
//   category_count: 200,
//   product_count: 10000,
//   job_counts: { queued: 5, running: 2, completed: 1000, failed: 10 }
// }
```

### Job Cleanup
```typescript
// Clean up completed jobs older than 7 days
const cleanedCount = await databaseService.cleanupOldJobs(7);
console.log(`Cleaned up ${cleanedCount} old jobs`);
```

### Category Product Count Maintenance
```typescript
// Update category product counts to match actual data
await databaseService.updateCategoryProductCounts();
```

## Best Practices

1. **Always validate data** before database operations
2. **Use batch operations** for multiple items
3. **Handle errors gracefully** with proper logging
4. **Monitor job status** and retry failed jobs
5. **Clean up old data** regularly
6. **Use transactions** for related operations
7. **Test database operations** thoroughly

## Troubleshooting

### Common Issues

1. **Connection Errors**: Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
2. **Validation Errors**: Ensure data matches the expected schema
3. **UUID Errors**: Use valid UUIDs for foreign key references
4. **Timeout Errors**: Consider batch size and network conditions

### Debug Mode

Enable debug logging by setting LOG_LEVEL=debug in your environment.

## Examples

See `src/examples/databaseIntegration.ts` for complete working examples of all database operations.