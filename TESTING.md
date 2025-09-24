# DataShelf Testing Guide

This document outlines the testing strategy, procedures, and acceptance criteria for the DataShelf platform.

## Testing Strategy

### Testing Pyramid

```
                    ┌─────────────────┐
                    │   E2E Tests     │ ← Few, High-level
                    │   (Cypress)     │
                    └─────────────────┘
                  ┌───────────────────────┐
                  │  Integration Tests    │ ← Some, API + DB
                  │  (Jest + Supertest)   │
                  └───────────────────────┘
              ┌─────────────────────────────────┐
              │        Unit Tests               │ ← Many, Fast
              │  (Jest + React Testing Library) │
              └─────────────────────────────────┘
```

### Test Types

1. **Unit Tests**: Individual functions and components
2. **Integration Tests**: API endpoints and database operations
3. **End-to-End Tests**: Complete user workflows
4. **Performance Tests**: Load testing and benchmarks
5. **Manual Tests**: Acceptance criteria validation

## Test Environment Setup

### Prerequisites

- Node.js 18+
- Test database (separate from development)
- Docker (for integration tests)

### Environment Configuration

```bash
# Test environment variables
NODE_ENV=test
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_KEY=test-service-key
API_BASE_URL=http://localhost:8787
SCRAPER_API_KEY=test-api-key
```

### Setup Commands

```bash
# Install all dependencies
npm install

# Set up test database
cd database
npm run migrate:test
npm run seed:test

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Unit Tests

### Scraper Service Tests

#### Data Extraction Tests

```typescript
// scraper/src/tests/scrapers/product.test.ts
import { scrapeProduct } from '../scrapers/product';
import { Page } from 'playwright';

describe('Product Scraper', () => {
  let mockPage: jest.Mocked<Page>;
  
  beforeEach(() => {
    mockPage = {
      goto: jest.fn(),
      evaluate: jest.fn(),
      waitForLoadState: jest.fn(),
    } as any;
  });
  
  test('should extract product data correctly', async () => {
    mockPage.evaluate.mockResolvedValue({
      title: 'Dune by Frank Herbert',
      price: 12.99,
      summary: 'Set on the desert planet Arrakis...',
      image_urls: ['https://example.com/dune.jpg'],
      specs: {
        author: 'Frank Herbert',
        isbn: '978-0441172719',
        pages: 688
      },
      available: true
    });
    
    const result = await scrapeProduct(mockPage, 'https://worldofbooks.com/dune');
    
    expect(result.title).toBe('Dune by Frank Herbert');
    expect(result.price).toBe(12.99);
    expect(result.specs.author).toBe('Frank Herbert');
    expect(mockPage.goto).toHaveBeenCalledWith('https://worldofbooks.com/dune');
  });
  
  test('should handle missing data gracefully', async () => {
    mockPage.evaluate.mockResolvedValue({
      title: 'Test Book',
      price: null,
      summary: null,
      image_urls: [],
      specs: {},
      available: false
    });
    
    const result = await scrapeProduct(mockPage, 'https://worldofbooks.com/test');
    
    expect(result.title).toBe('Test Book');
    expect(result.price).toBeNull();
    expect(result.image_urls).toEqual([]);
  });
});
```

#### Queue Management Tests

```typescript
// scraper/src/tests/utils/queue.test.ts
import { getNextJob, completeJob, failJob } from '../utils/queue';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

describe('Queue Management', () => {
  let mockSupabase: any;
  
  beforeEach(() => {
    mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ data: null, error: null }))
        }))
      }))
    };
    
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });
  
  test('should get next job with locking', async () => {
    const mockJob = {
      id: 'job-123',
      type: 'product',
      target_url: 'https://example.com',
      metadata: {}
    };
    
    mockSupabase.rpc.mockResolvedValue({ data: [mockJob], error: null });
    
    const job = await getNextJob('worker-1');
    
    expect(job).toEqual(mockJob);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_next_scrape_job', {
      worker_id: 'worker-1'
    });
  });
  
  test('should complete job successfully', async () => {
    await completeJob('job-123');
    
    expect(mockSupabase.from).toHaveBeenCalledWith('scrape_job');
  });
});
```

### API Tests

#### Handler Tests

```typescript
// api/src/tests/handlers/products.test.ts
import { handleProducts } from '../handlers/products';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

describe('Products Handler', () => {
  let mockSupabase: any;
  let mockRequest: Request;
  
  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => ({
                data: mockProducts,
                error: null,
                count: 100
              }))
            }))
          }))
        }))
      }))
    };
    
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    
    mockRequest = new Request('https://api.datashelf.com/api/products?categoryId=123&limit=20');
  });
  
  test('should return products with pagination', async () => {
    const response = await handleProducts(mockRequest);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(100);
    expect(data.pagination.limit).toBe(20);
  });
  
  test('should handle database errors', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            range: jest.fn(() => ({
              data: null,
              error: { message: 'Database error' }
            }))
          }))
        }))
      }))
    });
    
    const response = await handleProducts(mockRequest);
    
    expect(response.status).toBe(500);
  });
});

const mockProducts = [
  {
    id: '1',
    title: 'Test Book 1',
    price: 12.99,
    currency: 'GBP',
    image_urls: ['https://example.com/1.jpg'],
    available: true
  },
  {
    id: '2',
    title: 'Test Book 2',
    price: 15.99,
    currency: 'GBP',
    image_urls: ['https://example.com/2.jpg'],
    available: true
  }
];
```

#### Cache Tests

```typescript
// api/src/tests/utils/cache.test.ts
import { createCachedResponse, getCacheTTL } from '../utils/cache';

// Mock Cloudflare Workers Cache API
const mockCache = {
  match: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
};

global.caches = {
  default: mockCache
} as any;

describe('Cache Utils', () => {
  test('should create cached response with correct headers', async () => {
    const data = { test: 'data' };
    const ttl = 300;
    
    const response = await createCachedResponse(data, ttl);
    
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(response.headers.get('CDN-Cache-Control')).toBe('public, max-age=300');
    expect(response.headers.get('X-Cache-TTL')).toBe('300');
    
    const responseData = await response.json();
    expect(responseData).toEqual(data);
  });
  
  test('should return correct TTL for different paths', () => {
    expect(getCacheTTL('/api/navigation')).toBe(3600);
    expect(getCacheTTL('/api/categories')).toBe(1800);
    expect(getCacheTTL('/api/products/123')).toBe(120);
    expect(getCacheTTL('/api/products')).toBe(300);
    expect(getCacheTTL('/api/unknown')).toBe(60);
  });
});
```

### Frontend Tests

#### Component Tests

```typescript
// frontend/src/tests/components/ProductCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from '../components/ui/ProductCard';

const mockProduct = {
  id: '1',
  title: 'Test Book',
  price: 12.99,
  currency: 'GBP',
  thumbnail: 'https://example.com/image.jpg',
  available: true
};

describe('ProductCard', () => {
  test('renders product information correctly', () => {
    const handleClick = jest.fn();
    
    render(<ProductCard product={mockProduct} onClick={handleClick} />);
    
    expect(screen.getByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('£12.99')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByAltText('Test Book')).toHaveAttribute('src', mockProduct.thumbnail);
  });
  
  test('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    
    render(<ProductCard product={mockProduct} onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  test('handles keyboard navigation', () => {
    const handleClick = jest.fn();
    
    render(<ProductCard product={mockProduct} onClick={handleClick} />);
    
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    fireEvent.keyDown(card, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });
  
  test('shows out of stock status', () => {
    const unavailableProduct = { ...mockProduct, available: false };
    const handleClick = jest.fn();
    
    render(<ProductCard product={unavailableProduct} onClick={handleClick} />);
    
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
  });
});
```

#### Hook Tests

```typescript
// frontend/src/tests/hooks/useProducts.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useProducts } from '../hooks/useProducts';
import * as api from '../services/api';

jest.mock('../services/api');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useProducts', () => {
  test('should fetch products successfully', async () => {
    const mockResponse = {
      data: [mockProduct],
      pagination: { total: 1, limit: 20, offset: 0, pages: 1 }
    };
    
    (api.fetchProducts as jest.Mock).mockResolvedValue(mockResponse);
    
    const { result } = renderHook(
      () => useProducts({ categoryId: '123' }),
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    
    expect(result.current.data).toEqual(mockResponse);
    expect(api.fetchProducts).toHaveBeenCalledWith({ categoryId: '123' });
  });
  
  test('should handle errors', async () => {
    const error = new Error('API Error');
    (api.fetchProducts as jest.Mock).mockRejectedValue(error);
    
    const { result } = renderHook(
      () => useProducts({ categoryId: '123' }),
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    
    expect(result.current.error).toEqual(error);
  });
});
```

### Database Tests

#### Schema Tests

```typescript
// database/tests/schema.test.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

describe('Database Schema', () => {
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
  
  test('should enforce unique constraints', async () => {
    // Insert first product
    const { error: error1 } = await supabase
      .from('product')
      .insert({
        title: 'Test Product',
        source_url: 'https://test.com/unique-product',
        category_id: '00000000-0000-0000-0000-000000000001'
      });
    
    // Try to insert duplicate
    const { error: error2 } = await supabase
      .from('product')
      .insert({
        title: 'Another Test Product',
        source_url: 'https://test.com/unique-product', // Same URL
        category_id: '00000000-0000-0000-0000-000000000001'
      });
    
    expect(error1).toBeNull();
    expect(error2).toBeTruthy();
    expect(error2?.message).toContain('duplicate key value');
  });
});
```

#### Function Tests

```typescript
// database/tests/functions.test.ts
describe('Database Functions', () => {
  test('should enqueue jobs without duplicates', async () => {
    const jobData = {
      p_type: 'product',
      p_target_url: 'https://test.com/product-function-test',
      p_priority: 1
    };
    
    // Enqueue job twice
    const { data: jobId1 } = await supabase.rpc('enqueue_scrape_job', jobData);
    const { data: jobId2 } = await supabase.rpc('enqueue_scrape_job', jobData);
    
    // Should return same job ID
    expect(jobId1).toBe(jobId2);
    
    // Verify only one job exists
    const { data: jobs } = await supabase
      .from('scrape_job')
      .select('id')
      .eq('target_url', jobData.p_target_url);
    
    expect(jobs).toHaveLength(1);
  });
  
  test('should get and lock next job', async () => {
    const workerId = 'test-worker-functions';
    
    // Enqueue a test job
    await supabase.rpc('enqueue_scrape_job', {
      p_type: 'product',
      p_target_url: 'https://test.com/next-job-test',
      p_priority: 5
    });
    
    // Get next job
    const { data } = await supabase.rpc('get_next_scrape_job', {
      worker_id: workerId
    });
    
    expect(data).toHaveLength(1);
    expect(data[0].job_type).toBe('product');
    expect(data[0].target_url).toBe('https://test.com/next-job-test');
    
    // Verify job is locked
    const { data: lockedJob } = await supabase
      .from('scrape_job')
      .select('status, locked_by')
      .eq('id', data[0].job_id)
      .single();
    
    expect(lockedJob.status).toBe('running');
    expect(lockedJob.locked_by).toBe(workerId);
  });
});
```

## Integration Tests

### API Integration Tests

```typescript
// api/src/tests/integration/api.test.ts
import { unstable_dev } from 'wrangler';

describe('API Integration', () => {
  let worker: any;
  
  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });
  
  afterAll(async () => {
    await worker.stop();
  });
  
  test('should return navigation data', async () => {
    const response = await worker.fetch('/api/navigation');
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBeGreaterThan(0);
  });
  
  test('should return products with pagination', async () => {
    const response = await worker.fetch('/api/products?limit=5');
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBeLessThanOrEqual(5);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.limit).toBe(5);
  });
  
  test('should handle invalid product ID', async () => {
    const response = await worker.fetch('/api/products/invalid-id');
    
    expect(response.status).toBe(404);
  });
  
  test('should require authentication for scraper endpoints', async () => {
    const response = await worker.fetch('/api/scraper/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'product',
        target_url: 'https://test.com'
      })
    });
    
    expect(response.status).toBe(401);
  });
});
```

### Scraper Integration Tests

```typescript
// scraper/src/tests/integration/scraper.test.ts
import { ScrapeWorker } from '../worker';
import { createClient } from '@supabase/supabase-js';

describe('Scraper Integration', () => {
  let worker: ScrapeWorker;
  let supabase: any;
  
  beforeAll(async () => {
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    
    worker = new ScrapeWorker();
  });
  
  afterAll(async () => {
    await worker.stop();
  });
  
  test('should process product scraping job', async () => {
    // Enqueue test job
    const { data: jobId } = await supabase.rpc('enqueue_scrape_job', {
      p_type: 'product',
      p_target_url: 'https://worldofbooks.com/test-product',
      p_priority: 1
    });
    
    // Process job
    await worker.processNextJob();
    
    // Verify job completion
    const { data: job } = await supabase
      .from('scrape_job')
      .select('status')
      .eq('id', jobId)
      .single();
    
    expect(job.status).toBeOneOf(['completed', 'failed']);
  }, 30000);
});
```

## End-to-End Tests

### Cypress E2E Tests

```typescript
// cypress/e2e/product-browsing.cy.ts
describe('Product Browsing', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  
  it('should display homepage with categories', () => {
    cy.get('[data-testid="category-list"]').should('be.visible');
    cy.get('[data-testid="category-card"]').should('have.length.greaterThan', 0);
  });
  
  it('should navigate to category page', () => {
    cy.get('[data-testid="category-card"]').first().click();
    cy.url().should('include', '/category/');
    cy.get('[data-testid="product-grid"]').should('be.visible');
  });
  
  it('should display product details', () => {
    // Navigate to category
    cy.get('[data-testid="category-card"]').first().click();
    
    // Click on first product
    cy.get('[data-testid="product-card"]').first().click();
    
    // Verify product detail page
    cy.url().should('include', '/product/');
    cy.get('[data-testid="product-title"]').should('be.visible');
    cy.get('[data-testid="product-price"]').should('be.visible');
    cy.get('[data-testid="product-image"]').should('be.visible');
  });
  
  it('should handle pagination', () => {
    cy.get('[data-testid="category-card"]').first().click();
    
    // Check if load more button exists
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="load-more-button"]').length > 0) {
        cy.get('[data-testid="load-more-button"]').click();
        cy.get('[data-testid="product-card"]').should('have.length.greaterThan', 20);
      }
    });
  });
  
  it('should be responsive on mobile', () => {
    cy.viewport('iphone-x');
    
    cy.get('[data-testid="mobile-menu-button"]').should('be.visible');
    cy.get('[data-testid="category-list"]').should('be.visible');
    
    // Test mobile navigation
    cy.get('[data-testid="category-card"]').first().click();
    cy.get('[data-testid="product-grid"]').should('be.visible');
  });
});
```

### Performance Tests

```typescript
// cypress/e2e/performance.cy.ts
describe('Performance', () => {
  it('should load homepage within 3 seconds', () => {
    const start = Date.now();
    
    cy.visit('/');
    cy.get('[data-testid="category-list"]').should('be.visible');
    
    cy.then(() => {
      const loadTime = Date.now() - start;
      expect(loadTime).to.be.lessThan(3000);
    });
  });
  
  it('should load product details within 2 seconds', () => {
    cy.visit('/');
    cy.get('[data-testid="category-card"]').first().click();
    
    const start = Date.now();
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="product-title"]').should('be.visible');
    
    cy.then(() => {
      const loadTime = Date.now() - start;
      expect(loadTime).to.be.lessThan(2000);
    });
  });
});
```

## Load Testing

### API Load Tests

```javascript
// k6/api-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function () {
  // Test navigation endpoint
  let response = http.get('https://api.datashelf.com/api/navigation');
  check(response, {
    'navigation status is 200': (r) => r.status === 200,
    'navigation response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
  
  // Test products endpoint
  response = http.get('https://api.datashelf.com/api/products?limit=20');
  check(response, {
    'products status is 200': (r) => r.status === 200,
    'products response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  sleep(1);
}
```

### Scraper Load Tests

```typescript
// scraper/tests/load/scraper-load.test.ts
import { ScrapeWorker } from '../../src/worker';

describe('Scraper Load Test', () => {
  test('should handle concurrent job processing', async () => {
    const workers = Array.from({ length: 5 }, () => new ScrapeWorker());
    
    // Enqueue multiple jobs
    const jobs = Array.from({ length: 50 }, (_, i) => ({
      type: 'product',
      target_url: `https://worldofbooks.com/test-product-${i}`,
      priority: Math.floor(Math.random() * 10)
    }));
    
    // Start all workers
    const workerPromises = workers.map(worker => worker.start());
    
    // Wait for processing
    await Promise.all(workerPromises);
    
    // Verify all jobs processed
    const { data: remainingJobs } = await supabase
      .from('scrape_job')
      .select('id')
      .eq('status', 'queued');
    
    expect(remainingJobs).toHaveLength(0);
  }, 60000);
});
```

## Manual Testing

### Acceptance Criteria Checklist

#### User Story 1: Browse books by categories

**Acceptance Criteria:**
- [ ] Homepage displays navigation categories from World of Books
- [ ] Clicking category shows subcategories and products
- [ ] Categories show product counts
- [ ] Hierarchical structure is displayed correctly
- [ ] Cached data loads quickly with stale-while-revalidate

**Test Steps:**
1. Navigate to homepage
2. Verify categories are displayed
3. Click on a category
4. Verify subcategories and products appear
5. Check product counts are shown
6. Verify page loads quickly on subsequent visits

#### User Story 2: View paginated product list

**Acceptance Criteria:**
- [ ] Products displayed in grid layout with pagination
- [ ] Shows title, thumbnail, price, currency
- [ ] Maintains category context during navigation
- [ ] Supports sorting by price
- [ ] Limits to 20 items per page
- [ ] Shows empty state when no products found

**Test Steps:**
1. Navigate to a category page
2. Verify products are displayed in grid
3. Check pagination controls
4. Test sorting options
5. Verify product information is complete
6. Test empty state with invalid category

#### User Story 3: View detailed product information

**Acceptance Criteria:**
- [ ] Product detail page shows comprehensive information
- [ ] Displays title, images, price, description, specifications
- [ ] Includes author, ISBN, publisher, pages, language, format
- [ ] Provides link to original World of Books source
- [ ] Supports multiple images with loading states
- [ ] Shows last scraped timestamp

**Test Steps:**
1. Click on a product from category page
2. Verify all product information is displayed
3. Check image gallery functionality
4. Test "View on World of Books" link
5. Verify specifications are formatted correctly
6. Check last scraped timestamp

### Browser Compatibility Testing

**Supported Browsers:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Test Matrix:**
- [ ] Desktop Chrome (Windows/Mac/Linux)
- [ ] Desktop Firefox (Windows/Mac/Linux)
- [ ] Desktop Safari (Mac)
- [ ] Desktop Edge (Windows)
- [ ] Mobile Chrome (Android)
- [ ] Mobile Safari (iOS)

### Accessibility Testing

**WCAG 2.1 AA Compliance:**
- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen reader compatibility (NVDA, JAWS, VoiceOver)
- [ ] Color contrast meets minimum requirements
- [ ] Focus indicators are visible
- [ ] Alt text provided for all images
- [ ] Proper heading hierarchy
- [ ] Form labels are associated correctly

**Testing Tools:**
- axe-core browser extension
- WAVE Web Accessibility Evaluator
- Lighthouse accessibility audit
- Manual keyboard navigation testing

### Performance Testing

**Core Web Vitals:**
- [ ] Largest Contentful Paint (LCP) < 2.5s
- [ ] First Input Delay (FID) < 100ms
- [ ] Cumulative Layout Shift (CLS) < 0.1

**Performance Metrics:**
- [ ] Time to First Byte (TTFB) < 600ms
- [ ] First Contentful Paint (FCP) < 1.8s
- [ ] Time to Interactive (TTI) < 3.8s

**Testing Tools:**
- Lighthouse performance audit
- WebPageTest
- Chrome DevTools Performance tab
- Real User Monitoring (RUM)

## Test Data Management

### Test Database Setup

```sql
-- Create test-specific data
INSERT INTO navigation (id, title, source_url) VALUES
('test-nav-1', 'Test Fiction', 'https://test.worldofbooks.com/fiction'),
('test-nav-2', 'Test Non-Fiction', 'https://test.worldofbooks.com/non-fiction');

INSERT INTO category (id, navigation_id, title, source_url, product_count) VALUES
('test-cat-1', 'test-nav-1', 'Test Science Fiction', 'https://test.worldofbooks.com/sci-fi', 10),
('test-cat-2', 'test-nav-1', 'Test Fantasy', 'https://test.worldofbooks.com/fantasy', 15);

INSERT INTO product (id, category_id, title, source_url, price, currency, available) VALUES
('test-prod-1', 'test-cat-1', 'Test Book 1', 'https://test.worldofbooks.com/book-1', 12.99, 'GBP', true),
('test-prod-2', 'test-cat-1', 'Test Book 2', 'https://test.worldofbooks.com/book-2', 15.99, 'GBP', true);
```

### Test Data Cleanup

```typescript
// tests/utils/cleanup.ts
export async function cleanupTestData(): Promise<void> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  // Delete test data in reverse dependency order
  await supabase.from('product').delete().like('source_url', 'https://test.%');
  await supabase.from('category').delete().like('source_url', 'https://test.%');
  await supabase.from('navigation').delete().like('source_url', 'https://test.%');
  await supabase.from('scrape_job').delete().like('target_url', 'https://test.%');
}
```

## Continuous Integration

### GitHub Actions Test Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        component: [scraper, api, frontend, database]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd ${{ matrix.component }}
          npm ci
          
      - name: Run unit tests
        run: |
          cd ${{ matrix.component }}
          npm test -- --coverage --watchAll=false
          
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ${{ matrix.component }}/coverage/lcov.info
          flags: ${{ matrix.component }}

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Start services
        run: |
          npm run start:test &
          sleep 30
          
      - name: Run Cypress tests
        uses: cypress-io/github-action@v5
        with:
          wait-on: 'http://localhost:3000'
          wait-on-timeout: 120
```

## Test Reporting

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

### Test Results Dashboard

```typescript
// scripts/test-report.ts
import { writeFileSync } from 'fs';

interface TestResult {
  component: string;
  passed: number;
  failed: number;
  coverage: number;
  duration: number;
}

export function generateTestReport(results: TestResult[]): void {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.reduce((sum, r) => sum + r.passed + r.failed, 0),
      totalPassed: results.reduce((sum, r) => sum + r.passed, 0),
      totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
      averageCoverage: results.reduce((sum, r) => sum + r.coverage, 0) / results.length
    },
    components: results
  };
  
  writeFileSync('test-report.json', JSON.stringify(report, null, 2));
  console.log('Test report generated: test-report.json');
}
```

This comprehensive testing guide ensures the DataShelf platform maintains high quality, reliability, and performance across all components.