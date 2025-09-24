# DataShelf Database

The DataShelf database uses PostgreSQL via Supabase for data storage, job queue management, and real-time features. The schema is designed for efficient querying, data integrity, and scalability.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Supabase      │    │   PostgreSQL     │    │   Row Level     │
│   Dashboard     │◄──►│   Database       │◄──►│   Security      │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   REST API      │    │   Job Queue      │    │   Realtime      │
│   Auto-generated│    │   (PostgreSQL)   │    │   Subscriptions │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Features

- **PostgreSQL Database**: Robust relational database with JSONB support
- **Job Queue System**: PostgreSQL-based queue with distributed locking
- **Auto-generated APIs**: REST and GraphQL APIs via Supabase
- **Real-time Updates**: WebSocket subscriptions for live data
- **Row Level Security**: Fine-grained access control
- **Automated Backups**: Daily backups with point-in-time recovery

## Quick Start

### Prerequisites

- Supabase account
- Node.js 18+ (for migration scripts)
- PostgreSQL client (optional, for direct access)

### Setup

1. **Create Supabase project:**
   ```bash
   # Visit https://supabase.com/dashboard
   # Create new project
   # Note your project URL and API keys
   ```

2. **Configure environment:**
   ```bash
   cd database
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run migrations:**
   ```bash
   npm run migrate
   ```

5. **Seed database:**
   ```bash
   npm run seed
   ```

### Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Direct PostgreSQL Connection (optional)
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Migration Configuration
MIGRATION_TABLE=schema_migrations
MIGRATION_DIRECTORY=./migrations
```

## Project Structure

```
database/
├── migrations/             # SQL migration files
│   ├── 001_initial_schema.sql
│   ├── 002_add_indexes.sql
│   ├── 003_job_queue.sql
│   └── 004_functions.sql
├── seeds/                  # Database seed data
│   ├── navigation.sql
│   ├── categories.sql
│   └── sample_products.sql
├── utils/                  # Database utilities
│   ├── migrate.ts          # Migration runner
│   ├── seed.ts             # Seed data loader
│   └── client.ts           # Database client
├── tests/                  # Database tests
│   ├── schema.test.ts
│   └── functions.test.ts
├── package.json
└── README.md
```

## Schema Overview

### Core Tables

#### navigation
Hierarchical navigation structure from World of Books.

```sql
CREATE TABLE navigation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    source_url text UNIQUE NOT NULL,
    parent_id uuid REFERENCES navigation(id),
    last_scraped_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

#### category
Product categories with metadata and counts.

```sql
CREATE TABLE category (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    navigation_id uuid REFERENCES navigation(id),
    title text NOT NULL,
    source_url text UNIQUE NOT NULL,
    product_count integer DEFAULT 0,
    last_scraped_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

#### product
Core product data with flexible JSONB specifications.

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

#### scrape_job
PostgreSQL-based job queue with distributed locking.

```sql
CREATE TABLE scrape_job (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL CHECK (type IN ('navigation', 'category', 'product')),
    target_url text NOT NULL,
    status text NOT NULL DEFAULT 'queued' 
        CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    priority integer DEFAULT 0,
    locked_at timestamptz,
    locked_by text,
    last_error text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    completed_at timestamptz
);
```

## Migrations

### Migration System

The database uses a custom migration system built on Node.js:

```typescript
// utils/migrate.ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export class MigrationRunner {
  private supabase;
  
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  
  async runMigrations(): Promise<void> {
    // Ensure migration table exists
    await this.createMigrationTable();
    
    // Get applied migrations
    const appliedMigrations = await this.getAppliedMigrations();
    
    // Get migration files
    const migrationFiles = this.getMigrationFiles();
    
    // Run pending migrations
    for (const file of migrationFiles) {
      if (!appliedMigrations.includes(file)) {
        await this.runMigration(file);
      }
    }
  }
  
  private async createMigrationTable(): Promise<void> {
    const { error } = await this.supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version text PRIMARY KEY,
          applied_at timestamptz DEFAULT now()
        );
      `
    });
    
    if (error) throw error;
  }
  
  private async runMigration(filename: string): Promise<void> {
    const filepath = join(__dirname, '../migrations', filename);
    const sql = readFileSync(filepath, 'utf8');
    
    console.log(`Running migration: ${filename}`);
    
    const { error } = await this.supabase.rpc('exec_sql', { sql });
    if (error) throw error;
    
    // Record migration as applied
    await this.supabase
      .from('schema_migrations')
      .insert({ version: filename });
    
    console.log(`✓ Migration completed: ${filename}`);
  }
}
```

### Migration Files

#### 001_initial_schema.sql
```sql
-- Create initial schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Navigation table
CREATE TABLE navigation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    source_url text UNIQUE NOT NULL,
    parent_id uuid REFERENCES navigation(id),
    last_scraped_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Category table
CREATE TABLE category (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    navigation_id uuid REFERENCES navigation(id),
    title text NOT NULL,
    source_url text UNIQUE NOT NULL,
    product_count integer DEFAULT 0,
    last_scraped_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Product table
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

-- Add constraints
ALTER TABLE product ADD CONSTRAINT check_price_positive 
    CHECK (price IS NULL OR price >= 0);

ALTER TABLE product ADD CONSTRAINT check_currency_valid 
    CHECK (currency IN ('GBP', 'USD', 'EUR'));

ALTER TABLE product ADD CONSTRAINT check_image_urls_array 
    CHECK (jsonb_typeof(image_urls) = 'array');
```

#### 002_add_indexes.sql
```sql
-- Navigation indexes
CREATE INDEX idx_navigation_parent ON navigation(parent_id);
CREATE INDEX idx_navigation_url ON navigation(source_url);

-- Category indexes
CREATE INDEX idx_category_navigation ON category(navigation_id);
CREATE INDEX idx_category_url ON category(source_url);
CREATE INDEX idx_category_count ON category(product_count DESC);

-- Product indexes
CREATE INDEX idx_product_category ON product(category_id);
CREATE INDEX idx_product_price ON product(price);
CREATE INDEX idx_product_available ON product(available);
CREATE INDEX idx_product_url ON product(source_url);
CREATE INDEX idx_product_scraped ON product(last_scraped_at);

-- Full-text search index
CREATE INDEX idx_product_title_search ON product USING gin(to_tsvector('english', title));

-- JSONB indexes
CREATE INDEX idx_product_specs_gin ON product USING gin(specs);
CREATE INDEX idx_product_author ON product USING gin((specs->>'author'));
CREATE INDEX idx_product_isbn ON product USING gin((specs->>'isbn'));
```

#### 003_job_queue.sql
```sql
-- Scrape job table
CREATE TABLE scrape_job (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL CHECK (type IN ('navigation', 'category', 'product')),
    target_url text NOT NULL,
    status text NOT NULL DEFAULT 'queued' 
        CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    priority integer DEFAULT 0,
    locked_at timestamptz,
    locked_by text,
    last_error text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- Job queue indexes for performance
CREATE INDEX idx_scrape_job_queue ON scrape_job(status, priority DESC, created_at ASC) 
    WHERE status = 'queued';

CREATE INDEX idx_scrape_job_locked ON scrape_job(locked_at) 
    WHERE locked_at IS NOT NULL;

CREATE INDEX idx_scrape_job_cleanup ON scrape_job(completed_at) 
    WHERE status IN ('completed', 'failed');

CREATE INDEX idx_scrape_job_status ON scrape_job(status);
CREATE INDEX idx_scrape_job_type ON scrape_job(type);
CREATE INDEX idx_scrape_job_url ON scrape_job(target_url);
```

#### 004_functions.sql
```sql
-- Function to get next job with locking
CREATE OR REPLACE FUNCTION get_next_scrape_job(worker_id text)
RETURNS TABLE(
    job_id uuid,
    job_type text,
    target_url text,
    metadata jsonb
) AS $$
DECLARE
    job_record RECORD;
BEGIN
    -- Get and lock next job
    SELECT id, type, target_url, metadata INTO job_record
    FROM scrape_job 
    WHERE status = 'queued' 
      AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '10 minutes')
    ORDER BY priority DESC, created_at ASC 
    FOR UPDATE SKIP LOCKED 
    LIMIT 1;
    
    IF job_record.id IS NOT NULL THEN
        -- Lock the job
        UPDATE scrape_job 
        SET status = 'running',
            locked_at = NOW(),
            locked_by = worker_id,
            attempts = attempts + 1,
            updated_at = NOW()
        WHERE id = job_record.id;
        
        -- Return job details
        RETURN QUERY SELECT 
            job_record.id,
            job_record.type,
            job_record.target_url,
            job_record.metadata;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to enqueue jobs with deduplication
CREATE OR REPLACE FUNCTION enqueue_scrape_job(
    p_type text,
    p_target_url text,
    p_priority integer DEFAULT 0,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
    job_id uuid;
BEGIN
    -- Check if job already exists and is not completed/failed
    SELECT id INTO job_id
    FROM scrape_job
    WHERE target_url = p_target_url
      AND type = p_type
      AND status IN ('queued', 'running');
    
    IF job_id IS NOT NULL THEN
        -- Update priority if higher
        UPDATE scrape_job 
        SET priority = GREATEST(priority, p_priority),
            updated_at = NOW()
        WHERE id = job_id;
        RETURN job_id;
    END IF;
    
    -- Create new job
    INSERT INTO scrape_job (type, target_url, priority, metadata)
    VALUES (p_type, p_target_url, p_priority, p_metadata)
    RETURNING id INTO job_id;
    
    RETURN job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert products
CREATE OR REPLACE FUNCTION upsert_product(
    p_category_id uuid,
    p_title text,
    p_source_url text,
    p_source_id text DEFAULT NULL,
    p_price numeric DEFAULT NULL,
    p_currency text DEFAULT 'GBP',
    p_image_urls jsonb DEFAULT '[]'::jsonb,
    p_summary text DEFAULT NULL,
    p_specs jsonb DEFAULT '{}'::jsonb,
    p_available boolean DEFAULT true
) RETURNS uuid AS $$
DECLARE
    product_id uuid;
BEGIN
    INSERT INTO product (
        category_id, title, source_url, source_id, price, 
        currency, image_urls, summary, specs, available,
        last_scraped_at, updated_at
    ) VALUES (
        p_category_id, p_title, p_source_url, p_source_id, p_price,
        p_currency, p_image_urls, p_summary, p_specs, p_available,
        NOW(), NOW()
    )
    ON CONFLICT (source_url) DO UPDATE SET
        category_id = EXCLUDED.category_id,
        title = EXCLUDED.title,
        source_id = EXCLUDED.source_id,
        price = EXCLUDED.price,
        currency = EXCLUDED.currency,
        image_urls = EXCLUDED.image_urls,
        summary = EXCLUDED.summary,
        specs = EXCLUDED.specs,
        available = EXCLUDED.available,
        last_scraped_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO product_id;
    
    RETURN product_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update category product counts
CREATE OR REPLACE FUNCTION update_category_product_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE category 
        SET product_count = product_count + 1,
            updated_at = now()
        WHERE id = NEW.category_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE category 
        SET product_count = product_count - 1,
            updated_at = now()
        WHERE id = OLD.category_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' AND OLD.category_id != NEW.category_id THEN
        -- Product moved to different category
        UPDATE category 
        SET product_count = product_count - 1,
            updated_at = now()
        WHERE id = OLD.category_id;
        
        UPDATE category 
        SET product_count = product_count + 1,
            updated_at = now()
        WHERE id = NEW.category_id;
        
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_category_count
    AFTER INSERT OR DELETE OR UPDATE ON product
    FOR EACH ROW EXECUTE FUNCTION update_category_product_count();
```

## Seed Data

### Navigation Seed

```sql
-- seeds/navigation.sql
INSERT INTO navigation (title, source_url, parent_id) VALUES
('Fiction', 'https://worldofbooks.com/fiction', NULL),
('Non-Fiction', 'https://worldofbooks.com/non-fiction', NULL),
('Children & Young Adult', 'https://worldofbooks.com/children-young-adult', NULL),
('Academic & Professional', 'https://worldofbooks.com/academic-professional', NULL);

-- Fiction subcategories
INSERT INTO navigation (title, source_url, parent_id) VALUES
('Science Fiction', 'https://worldofbooks.com/fiction/sci-fi', 
 (SELECT id FROM navigation WHERE title = 'Fiction')),
('Fantasy', 'https://worldofbooks.com/fiction/fantasy', 
 (SELECT id FROM navigation WHERE title = 'Fiction')),
('Mystery & Thriller', 'https://worldofbooks.com/fiction/mystery-thriller', 
 (SELECT id FROM navigation WHERE title = 'Fiction')),
('Romance', 'https://worldofbooks.com/fiction/romance', 
 (SELECT id FROM navigation WHERE title = 'Fiction'));
```

### Category Seed

```sql
-- seeds/categories.sql
INSERT INTO category (navigation_id, title, source_url, product_count) VALUES
((SELECT id FROM navigation WHERE title = 'Science Fiction'), 
 'Science Fiction Books', 'https://worldofbooks.com/fiction/sci-fi', 1247),
((SELECT id FROM navigation WHERE title = 'Fantasy'), 
 'Fantasy Books', 'https://worldofbooks.com/fiction/fantasy', 892),
((SELECT id FROM navigation WHERE title = 'Mystery & Thriller'), 
 'Mystery & Thriller Books', 'https://worldofbooks.com/fiction/mystery-thriller', 1534),
((SELECT id FROM navigation WHERE title = 'Romance'), 
 'Romance Books', 'https://worldofbooks.com/fiction/romance', 2103);
```

### Sample Products

```sql
-- seeds/sample_products.sql
INSERT INTO product (category_id, title, source_url, price, currency, image_urls, summary, specs, available) VALUES
((SELECT id FROM category WHERE title = 'Science Fiction Books'),
 'Dune by Frank Herbert',
 'https://worldofbooks.com/dune-frank-herbert',
 12.99,
 'GBP',
 '["https://example.com/dune-1.jpg", "https://example.com/dune-2.jpg"]'::jsonb,
 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides...',
 '{
   "author": "Frank Herbert",
   "isbn": "978-0441172719",
   "publisher": "Ace Books",
   "pages": 688,
   "language": "English",
   "format": "Paperback"
 }'::jsonb,
 true);
```

## Database Operations

### Common Queries

#### Get Products by Category

```sql
SELECT 
    p.id,
    p.title,
    p.price,
    p.currency,
    p.image_urls->0 as thumbnail,
    p.available,
    c.title as category_title
FROM product p
JOIN category c ON p.category_id = c.id
WHERE c.id = $1
  AND p.available = true
ORDER BY p.created_at DESC
LIMIT 20 OFFSET $2;
```

#### Search Products

```sql
SELECT 
    p.id,
    p.title,
    p.price,
    p.currency,
    p.image_urls->0 as thumbnail,
    ts_rank(to_tsvector('english', p.title), plainto_tsquery('english', $1)) as rank
FROM product p
WHERE to_tsvector('english', p.title) @@ plainto_tsquery('english', $1)
  AND p.available = true
ORDER BY rank DESC, p.created_at DESC
LIMIT 20;
```

#### Get Job Queue Statistics

```sql
SELECT 
    status,
    type,
    COUNT(*) as count,
    AVG(attempts) as avg_attempts,
    MIN(created_at) as oldest_job,
    MAX(created_at) as newest_job
FROM scrape_job
GROUP BY status, type
ORDER BY status, type;
```

### Maintenance Operations

#### Clean Up Old Jobs

```sql
-- Delete completed jobs older than 7 days
DELETE FROM scrape_job 
WHERE status IN ('completed', 'failed') 
  AND completed_at < NOW() - INTERVAL '7 days';
```

#### Reset Stuck Jobs

```sql
-- Reset jobs that have been locked for more than 30 minutes
UPDATE scrape_job 
SET status = 'queued', 
    locked_at = NULL, 
    locked_by = NULL 
WHERE status = 'running' 
  AND locked_at < NOW() - INTERVAL '30 minutes';
```

#### Update Statistics

```sql
-- Update table statistics for query optimization
ANALYZE navigation;
ANALYZE category;
ANALYZE product;
ANALYZE scrape_job;
```

## Performance Optimization

### Query Optimization

1. **Use appropriate indexes** for common query patterns
2. **Limit result sets** with proper pagination
3. **Use JSONB operators** efficiently
4. **Avoid N+1 queries** with proper JOINs

### JSONB Best Practices

```sql
-- Efficient JSONB queries
SELECT * FROM product WHERE specs->>'author' = 'Frank Herbert';
SELECT * FROM product WHERE specs ? 'isbn';
SELECT * FROM product WHERE specs @> '{"format": "Paperback"}';

-- Inefficient (avoid)
SELECT * FROM product WHERE specs::text LIKE '%Frank Herbert%';
```

### Connection Pooling

Configure Supabase connection pooling:
- **Transaction mode**: For short-lived connections
- **Session mode**: For persistent connections
- **Statement mode**: For simple queries

## Backup and Recovery

### Automated Backups

Supabase provides automated daily backups. For additional protection:

```sql
-- Export specific tables
COPY product TO '/backup/products.csv' WITH CSV HEADER;
COPY category TO '/backup/categories.csv' WITH CSV HEADER;
```

### Point-in-Time Recovery

Supabase supports point-in-time recovery up to 7 days (Pro plan).

### Manual Backup Script

```typescript
// utils/backup.ts
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

export async function backupTable(tableName: string): Promise<void> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  const { data, error } = await supabase
    .from(tableName)
    .select('*');
  
  if (error) throw error;
  
  const filename = `backup_${tableName}_${new Date().toISOString().split('T')[0]}.json`;
  writeFileSync(filename, JSON.stringify(data, null, 2));
  
  console.log(`✓ Backup created: ${filename}`);
}
```

## Testing

### Schema Tests

```typescript
// tests/schema.test.ts
import { createClient } from '@supabase/supabase-js';

describe('Database Schema', () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  test('should have all required tables', async () => {
    const { data } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    const tableNames = data?.map(t => t.table_name) || [];
    
    expect(tableNames).toContain('navigation');
    expect(tableNames).toContain('category');
    expect(tableNames).toContain('product');
    expect(tableNames).toContain('scrape_job');
  });
  
  test('should enforce foreign key constraints', async () => {
    // Try to insert product with invalid category_id
    const { error } = await supabase
      .from('product')
      .insert({
        category_id: '00000000-0000-0000-0000-000000000000',
        title: 'Test Product',
        source_url: 'https://test.com/product'
      });
    
    expect(error).toBeTruthy();
    expect(error?.message).toContain('foreign key constraint');
  });
});
```

### Function Tests

```typescript
// tests/functions.test.ts
describe('Database Functions', () => {
  test('should enqueue jobs without duplicates', async () => {
    const jobData = {
      p_type: 'product',
      p_target_url: 'https://test.com/product',
      p_priority: 1
    };
    
    // Enqueue job twice
    const { data: jobId1 } = await supabase.rpc('enqueue_scrape_job', jobData);
    const { data: jobId2 } = await supabase.rpc('enqueue_scrape_job', jobData);
    
    // Should return same job ID
    expect(jobId1).toBe(jobId2);
  });
  
  test('should get next job with locking', async () => {
    const workerId = 'test-worker-1';
    
    const { data } = await supabase.rpc('get_next_scrape_job', {
      worker_id: workerId
    });
    
    if (data && data.length > 0) {
      const job = data[0];
      expect(job.job_id).toBeTruthy();
      expect(job.job_type).toBeTruthy();
      expect(job.target_url).toBeTruthy();
    }
  });
});
```

## Monitoring

### Database Metrics

```sql
-- Connection count
SELECT count(*) FROM pg_stat_activity;

-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Performance Monitoring

```sql
-- Slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Lock monitoring
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

## Troubleshooting

See the main [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for detailed troubleshooting information.

### Common Issues

1. **Migration failures**: Check migration order and SQL syntax
2. **Performance issues**: Analyze slow queries and add indexes
3. **Connection pool exhaustion**: Configure connection pooling
4. **Lock contention**: Monitor and optimize concurrent operations

### Data Validation

```sql
-- Check data integrity
SELECT COUNT(*) FROM product WHERE category_id NOT IN (SELECT id FROM category);
SELECT COUNT(*) FROM category WHERE navigation_id NOT IN (SELECT id FROM navigation);
SELECT COUNT(*) FROM scrape_job WHERE status NOT IN ('queued', 'running', 'completed', 'failed');

-- Check for orphaned records
SELECT p.id, p.title FROM product p 
LEFT JOIN category c ON p.category_id = c.id 
WHERE c.id IS NULL;
```