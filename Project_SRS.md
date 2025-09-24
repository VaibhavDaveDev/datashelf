# DataShelf: Product Data Explorer

## Project Brief

### High-level Goal
Crawl World of Books website https://www.worldofbooks.com/ to extract structured product data (navigation → categories → products → product detail), normalize and store it in Postgres (Supabase). Serve that data to a React + TypeScript + Tailwind frontend hosted on Cloudflare Pages. Use Cloudflare Workers for edge GETs + caching. Run Crawlee + Playwright as a Dockerized worker on Render to perform headful scraping. Use PostgreSQL for job queues/locks and Cloudflare R2 for images.

## System Components

### 1. Scraper Service (Render, Docker)
- Accepts protected POST /enqueue requests (HMAC-signed or API-key)
- Maintains a job queue (PostgreSQL-backed)
- Worker loop:
    - dequeue → acquire PostgreSQL lock per target → fetch with Crawlee+Playwright
    - extract structured fields → upload images to R2 → upsert into Supabase
    - release lock → log metrics
- Exposes status endpoints for monitoring

### 2. Database (Supabase / Postgres)
- Tables: navigation, category, product, product_detail, review, scrape_job, view_history
- Use JSONB for:
    - product.specs
    - product.image_urls
    - product.raw_meta
- Unique constraint on source_url to prevent duplicates

### 3. Edge API (Cloudflare Workers)
- Read-only GET endpoints with caching and stale-while-revalidate behavior
- Routes: 
    - /api/navigation
    - /api/categories
    - /api/products
    - /api/products/:id
- When cache is stale, return cached data and kick a signed POST /enqueue to the scraper

### 4. Frontend (React + TypeScript + Tailwind)
- Pages: Landing, Category Drilldown, Product Grid (paging), Product Detail, About, Contact
- Use React Query (SWR acceptable) for data fetching with optimistic cache behavior
- Persist view history locally and mirror to backend when user opts-in
- UI must be original with "Source" link

### 5. Image Storage (Cloudflare R2)
- Scraper uploads canonical images to R2 and stores R2 URLs in product.image_urls
- Workers optionally generate signed short-lived URLs for secure delivery

### 6. Queue & Locks (PostgreSQL)
- Use row-level locking for per-URL concurrency
- Use PostgreSQL tables for job queue, with retry and status tracking

### 7. CI / Infrastructure / Documentation
- GitHub Actions to build & deploy Pages & push Docker to Render
- DB migrations and seed script to populate reviewer-friendly data
- README with deploy steps and acceptance checklist

# Detailed Data Model & API Specifications

## Database Schema

### Product Table
```sql
CREATE TABLE product (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid REFERENCES category(id),
    title text NOT NULL,
    source_url text UNIQUE NOT NULL,
    source_id text,
    price numeric,
    currency text,
    image_urls jsonb,
    summary text,
    specs jsonb,
    available boolean DEFAULT true,
    last_scraped_at timestamptz,
    raw_html text
);
```

### Scrape Job Table
```sql
CREATE TABLE scrape_job (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL, -- 'navigation'|'category'|'product'
    target_url text NOT NULL,
    status text NOT NULL DEFAULT 'queued', -- queued,running,failed,done
    attempts int DEFAULT 0,
    last_error text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

## Example Product JSON
```json
{
    "title": "The Secret Garden",
    "source_url": "https://worldofbooks.example/product/12345",
    "source_id": "12345",
    "price": 8.99,
    "currency": "GBP",
    "image_urls": ["r2://bucket/abc123.jpg", "r2://bucket/abc123-2.jpg"],
    "summary": "Classic children's novel...",
    "specs": {
        "author": "Frances Hodgson Burnett",
        "isbn": "978-0141321097",
        "publisher": "Penguin",
        "pages": 240,
        "language": "English",
        "format": "Paperback"
    },
    "available": true,
    "last_scraped_at": "2025-09-01T12:00:00Z"
}
```

## API Contract

### Endpoints

1. **GET /api/navigation**
```json
[{ "id":"...", "title":"Books", "source_url":"...", "last_scraped_at":"..."}]
```

2. **GET /api/categories**
```
Query params: navId=<>&parentId=<>&limit=&offset=
Response: [{ "id":"...", "title":"Fiction", "product_count": 123, "last_scraped_at":"..." }]
```

3. **GET /api/products**
```
Query params: categoryId=...&limit=20&offset=0&sort=price_asc
Response: { "total": 124, "items": [{ "id":"...","title":"...","price":..,"thumbnail":"..."}] }
```

4. **GET /api/products/:id**
```json
{
 "id":"...","title":"...","price":...,"image_urls":[...],
 "specs": {...}, "description":"...", "reviews":[...], "last_scraped_at":"..."
}
```

5. **POST /scraper/enqueue**
```json
Request: { "type":"product", "target_url":"https://worldofbooks/.../12345", "requester":"worker" }
Response: { "job_id":"...", "status":"queued" }
```

## Implementation Details

### Scraper Workflow
1. Validate request
2. Check PostgreSQL locks
3. Update job status
4. Crawl using Crawlee + Playwright
5. Extract data
6. Process images
7. Update database
8. Handle edge cases

### Worker Logic
- Implements stale-while-revalidate pattern
- Manages caching with TTL
- Handles secure request signing

### Frontend Components

#### ProductCard
```typescript
type ProductCardProps = {
    id: string;
    title: string;
    thumbnail: string;
    price?: number;
    currency?: string;
    onSave?: (id:string)=>void;
}
```

#### ProductDetail
```typescript
{
 id: string;
 title: string;
 images: string[];
 price?: number;
 specs: Record<string, any>;
 description: string;
 last_scraped_at: string;
 source_url: string;
}
```

## Example Scraping Output
```json
{
    "navigation": { "title":"Books", "url":"..." },
    "category": { "title":"Children & Young Adults", "url":"..." },
    "products": [
        { "title":"The Secret Garden", "url":"https://.../12345", "price":8.99, "thumbnail":"https://..." }
    ],
    "pagination": { "page":1, "total_pages":10 }
}
```

## Acceptance Tests
- [x] Seed data verification
- [x] Product grid functionality
- [x] Product detail display
- [x] Revalidation flow
- [x] Deduplication check
- [x] Concurrent access handling
- [x] Security validation

