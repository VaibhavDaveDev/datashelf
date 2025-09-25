# DataShelf API Documentation

The DataShelf API is built on Cloudflare Workers and provides fast, globally distributed access to product data with intelligent caching.

## Base URL

- **Production**: `https://api.datashelf.com`
- **Development**: `http://localhost:8787`

## Authentication

Internal scraper endpoints require HMAC-SHA256 authentication:

```http
Authorization: Bearer <api-key>
X-Signature: <hmac-sha256-signature>
X-Timestamp: <unix-timestamp>
```

## Rate Limiting

- **Public endpoints**: 100 requests per minute per IP
- **Authenticated endpoints**: 1000 requests per minute per API key

## Caching Strategy

The API uses Cloudflare's edge caching with stale-while-revalidate:

- **Navigation data**: 1 hour TTL
- **Category data**: 30 minutes TTL
- **Product lists**: 5 minutes TTL
- **Product details**: 2 minutes TTL

### API Request Flow
<img width="3840" height="3249" alt="Sequence Diagram_API Request Flow" src="https://github.com/user-attachments/assets/b721d8f7-996a-4051-97b2-04a23efb692b" />


## Endpoints

### Navigation

#### GET /api/navigation

Returns the hierarchical navigation structure from World of Books.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Fiction",
      "source_url": "https://worldofbooks.com/fiction",
      "children": [
        {
          "id": "uuid",
          "title": "Science Fiction",
          "source_url": "https://worldofbooks.com/fiction/sci-fi",
          "children": []
        }
      ],
      "last_scraped_at": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "last_updated": "2024-01-15T10:30:00Z"
  }
}
```

**Cache:** 1 hour

---

### Categories

#### GET /api/categories

Returns categories with optional filtering and pagination.

**Query Parameters:**
- `navId` (string, optional): Filter by navigation ID
- `parentId` (string, optional): Filter by parent category
- `limit` (number, optional): Results per page (default: 20, max: 100)
- `offset` (number, optional): Pagination offset (default: 0)

**Example Request:**
```http
GET /api/categories?navId=fiction-uuid&limit=10&offset=0
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "navigation_id": "fiction-uuid",
      "title": "Science Fiction",
      "product_count": 1247,
      "last_scraped_at": "2024-01-15T09:15:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 10,
    "offset": 0,
    "pages": 5
  }
}
```

**Cache:** 30 minutes

---

### Products

#### GET /api/products

Returns paginated product listings with filtering and sorting.

**Query Parameters:**
- `categoryId` (string, optional): Filter by category ID
- `limit` (number, optional): Results per page (default: 20, max: 100)
- `offset` (number, optional): Pagination offset (default: 0)
- `sort` (string, optional): Sort order
  - `price_asc`: Price low to high
  - `price_desc`: Price high to low
  - `title_asc`: Title A-Z
  - `title_desc`: Title Z-A
  - `newest`: Recently added first
- `available` (boolean, optional): Filter by availability

**Example Request:**
```http
GET /api/products?categoryId=sci-fi-uuid&sort=price_asc&limit=20&offset=0
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Dune by Frank Herbert",
      "price": 12.99,
      "currency": "GBP",
      "thumbnail": "https://r2.datashelf.com/images/dune-thumb.jpg",
      "available": true,
      "category_id": "sci-fi-uuid"
    }
  ],
  "pagination": {
    "total": 1247,
    "limit": 20,
    "offset": 0,
    "pages": 63,
    "current_page": 1
  },
  "filters": {
    "categoryId": "sci-fi-uuid",
    "sort": "price_asc",
    "available": true
  }
}
```

**Cache:** 5 minutes

#### GET /api/products/:id

Returns detailed information for a specific product.

**Path Parameters:**
- `id` (string, required): Product UUID

**Example Request:**
```http
GET /api/products/dune-uuid
```

**Response:**
```json
{
  "data": {
    "id": "dune-uuid",
    "title": "Dune by Frank Herbert",
    "price": 12.99,
    "currency": "GBP",
    "image_urls": [
      "https://r2.datashelf.com/images/dune-1.jpg",
      "https://r2.datashelf.com/images/dune-2.jpg"
    ],
    "summary": "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides...",
    "specs": {
      "author": "Frank Herbert",
      "isbn": "978-0441172719",
      "publisher": "Ace Books",
      "pages": 688,
      "language": "English",
      "format": "Paperback",
      "publication_date": "1990-08-01",
      "dimensions": "4.2 x 1.2 x 6.9 inches",
      "weight": "11.2 ounces"
    },
    "available": true,
    "source_url": "https://worldofbooks.com/dune-frank-herbert",
    "category_id": "sci-fi-uuid",
    "last_scraped_at": "2024-01-15T08:45:00Z",
    "created_at": "2024-01-10T14:20:00Z",
    "updated_at": "2024-01-15T08:45:00Z"
  }
}
```

**Cache:** 2 minutes

---

### Internal Endpoints

#### POST /api/scraper/enqueue

Enqueues scraping jobs (requires authentication).

**Request Body:**
```json
{
  "type": "product",
  "target_url": "https://worldofbooks.com/dune-frank-herbert",
  "priority": 1,
  "metadata": {
    "category_id": "sci-fi-uuid"
  }
}
```

**Response:**
```json
{
  "success": true,
  "job_id": "job-uuid",
  "message": "Job enqueued successfully"
}
```

#### GET /api/scraper/status

Returns scraper service status and metrics.

**Response:**
```json
{
  "status": "healthy",
  "metrics": {
    "jobs_queued": 45,
    "jobs_running": 3,
    "jobs_completed_today": 1247,
    "jobs_failed_today": 12,
    "success_rate": 99.04
  },
  "last_updated": "2024-01-15T10:30:00Z"
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Product not found",
    "details": "No product found with ID: invalid-uuid"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req-uuid"
}
```

### Error Codes

- `400 BAD_REQUEST`: Invalid request parameters
- `401 UNAUTHORIZED`: Missing or invalid authentication
- `403 FORBIDDEN`: Insufficient permissions
- `404 RESOURCE_NOT_FOUND`: Requested resource not found
- `429 RATE_LIMITED`: Too many requests
- `500 INTERNAL_ERROR`: Server error
- `503 SERVICE_UNAVAILABLE`: Service temporarily unavailable

---

## Response Headers

All responses include these headers:

```http
Content-Type: application/json
Cache-Control: public, max-age=300
CDN-Cache-Control: public, max-age=300
X-Request-ID: req-uuid
X-Cache-Status: HIT|MISS
X-Edge-Location: LHR
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { DataShelfAPI } from '@datashelf/api-client';

const api = new DataShelfAPI({
  baseURL: 'https://api.datashelf.com',
  apiKey: process.env.DATASHELF_API_KEY
});

// Get products
const products = await api.products.list({
  categoryId: 'sci-fi-uuid',
  sort: 'price_asc',
  limit: 20
});

// Get product details
const product = await api.products.get('dune-uuid');

// Get navigation
const navigation = await api.navigation.list();
```

### cURL Examples

```bash
# Get products
curl -X GET "https://api.datashelf.com/api/products?categoryId=sci-fi-uuid&sort=price_asc" \
  -H "Accept: application/json"

# Get product details
curl -X GET "https://api.datashelf.com/api/products/dune-uuid" \
  -H "Accept: application/json"

# Enqueue scraping job (authenticated)
curl -X POST "https://api.datashelf.com/api/scraper/enqueue" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Signature: hmac-signature" \
  -H "X-Timestamp: 1642248600" \
  -d '{
    "type": "product",
    "target_url": "https://worldofbooks.com/dune-frank-herbert",
    "priority": 1
  }'
```

---

## Webhooks

The API can send webhooks for certain events:

### Product Updated

Sent when a product is successfully scraped and updated.

```json
{
  "event": "product.updated",
  "data": {
    "product_id": "dune-uuid",
    "changes": ["price", "availability"],
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Scraping Failed

Sent when a scraping job fails after all retries.

```json
{
  "event": "scraping.failed",
  "data": {
    "job_id": "job-uuid",
    "target_url": "https://worldofbooks.com/invalid-product",
    "error": "Product page not found",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```
