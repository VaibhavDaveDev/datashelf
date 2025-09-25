# DataShelf Scraper Service

The scraper service is responsible for extracting product data from World of Books using Crawlee and Playwright. It runs as a containerized service on Render and processes jobs from a PostgreSQL queue.

## Architecture

 <img width="3840" height="1028" alt="Flowchart_Scraper" src="https://github.com/user-attachments/assets/4d0e0f1c-a2d4-4d68-9711-313f4550602b" />


## Features

- **Browser Automation**: Uses Playwright for JavaScript-heavy pages
- **Intelligent Crawling**: Crawlee handles retries, rate limiting, and session management
- **Distributed Locking**: PostgreSQL row-level locks prevent duplicate work
- **Image Processing**: Downloads and uploads images to R2 storage
- **Error Recovery**: Exponential backoff and retry mechanisms
- **Health Monitoring**: Status endpoints and structured logging

## Quick Start

### Prerequisites

- Node.js 20+ (LTS recommended)
- Docker (for deployment)
- PostgreSQL database (Supabase)
- Cloudflare R2 credentials

### Development Setup

1. **Install dependencies:**
   ```bash
   cd scraper
   npm install
   ```

2. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   npx playwright install-deps
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

### Using Pre-built Docker Image

You can use our pre-built Docker image to run the scraper service:

```bash
# Pull the latest image
docker pull vaibhavdavedev/datashelf-scraper:latest

# Run the container with environment variables
docker run -p 3000:3000 \
  -e SUPABASE_URL=your_supabase_url \
  -e SUPABASE_SERVICE_KEY=your_service_key \
  -e CLOUDFLARE_R2_ENDPOINT=your_r2_endpoint \
  -e CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key \
  -e CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key \
  -e CLOUDFLARE_R2_BUCKET_NAME=datashelf-images \
  -e SCRAPER_API_KEY=your_api_key \
  -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  vaibhavdavedev/datashelf-scraper:latest
```

### Live Demo Service

A running instance of the scraper service is available at:
https://datashelf-scraper.onrender.com

Check the health endpoint: https://datashelf-scraper.onrender.com/health
   ```

### Environment Variables

```bash
# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Cloudflare R2 Configuration
CLOUDFLARE_R2_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET_NAME=datashelf-images
CLOUDFLARE_R2_PUBLIC_URL=https://images.datashelf.com

# Scraper Configuration
SCRAPER_API_KEY=your-secure-api-key
WORKER_CONCURRENCY=3
BROWSER_HEADLESS=true
REQUEST_DELAY_MS=2000

# Monitoring
LOG_LEVEL=info
HEALTH_CHECK_PORT=3000
```

## Project Structure

```
scraper/
├── src/
│   ├── scrapers/           # Scraping logic
│   │   ├── navigation.ts   # Navigation structure scraper
│   │   ├── category.ts     # Category page scraper
│   │   └── product.ts      # Product detail scraper
│   ├── utils/              # Utilities
│   │   ├── database.ts     # Database operations
│   │   ├── images.ts       # Image processing
│   │   ├── logger.ts       # Structured logging
│   │   └── queue.ts        # Job queue management
│   ├── routes/             # HTTP endpoints
│   │   ├── health.ts       # Health check endpoint
│   │   ├── enqueue.ts      # Job enqueue endpoint
│   │   └── status.ts       # Status and metrics
│   ├── worker.ts           # Main worker process
│   └── server.ts           # HTTP server
├── public/                 # Static assets
│   └── monitoring.html     # Monitoring dashboard
├── Dockerfile              # Docker configuration
├── package.json
└── README.md
```

## API Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "memory": {
    "used": "245MB",
    "total": "512MB"
  },
  "database": "connected",
  "browser": "ready"
}
```

### Enqueue Job

```http
POST /enqueue
Authorization: Bearer your-api-key
Content-Type: application/json
```

**Request:**
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

### Status and Metrics

```http
GET /status
```

**Response:**
```json
{
  "worker": {
    "status": "running",
    "jobs_processed": 1247,
    "jobs_failed": 12,
    "success_rate": 99.04,
    "current_job": "product-uuid"
  },
  "queue": {
    "queued": 45,
    "running": 3,
    "completed_today": 1247,
    "failed_today": 12
  },
  "browser": {
    "status": "ready",
    "pages_open": 2,
    "memory_usage": "180MB"
  }
}
```

## Scraping Logic

### Navigation Scraper

Extracts the main navigation structure:

```typescript
export async function scrapeNavigation(page: Page): Promise<NavigationItem[]> {
  await page.goto('https://worldofbooks.com');
  
  const navigation = await page.evaluate(() => {
    const navItems = document.querySelectorAll('.main-nav a');
    return Array.from(navItems).map(item => ({
      title: item.textContent?.trim(),
      url: item.getAttribute('href')
    }));
  });
  
  return navigation.filter(item => item.title && item.url);
}
```

### Category Scraper

Extracts product listings from category pages:

```typescript
export async function scrapeCategory(page: Page, categoryUrl: string): Promise<ProductSummary[]> {
  await page.goto(categoryUrl);
  
  // Handle pagination
  const products: ProductSummary[] = [];
  let hasNextPage = true;
  
  while (hasNextPage) {
    const pageProducts = await page.evaluate(() => {
      const productCards = document.querySelectorAll('.product-card');
      return Array.from(productCards).map(card => ({
        title: card.querySelector('.title')?.textContent?.trim(),
        price: parseFloat(card.querySelector('.price')?.textContent?.replace(/[£$€]/, '') || '0'),
        url: card.querySelector('a')?.getAttribute('href'),
        thumbnail: card.querySelector('img')?.getAttribute('src')
      }));
    });
    
    products.push(...pageProducts);
    
    // Check for next page
    hasNextPage = await page.locator('.pagination .next').isVisible();
    if (hasNextPage) {
      await page.click('.pagination .next');
      await page.waitForLoadState('networkidle');
    }
  }
  
  return products;
}
```

### Product Scraper

Extracts detailed product information:

```typescript
export async function scrapeProduct(page: Page, productUrl: string): Promise<ProductDetail> {
  await page.goto(productUrl);
  
  const product = await page.evaluate(() => {
    const getTextContent = (selector: string) => 
      document.querySelector(selector)?.textContent?.trim() || '';
    
    const getImageUrls = () => {
      const images = document.querySelectorAll('.product-images img');
      return Array.from(images).map(img => img.getAttribute('src')).filter(Boolean);
    };
    
    const getSpecs = () => {
      const specs: Record<string, string> = {};
      const specRows = document.querySelectorAll('.product-specs tr');
      
      specRows.forEach(row => {
        const label = row.querySelector('td:first-child')?.textContent?.trim();
        const value = row.querySelector('td:last-child')?.textContent?.trim();
        if (label && value) {
          specs[label.toLowerCase().replace(/\s+/g, '_')] = value;
        }
      });
      
      return specs;
    };
    
    return {
      title: getTextContent('.product-title'),
      price: parseFloat(getTextContent('.price').replace(/[£$€]/, '') || '0'),
      summary: getTextContent('.product-description'),
      image_urls: getImageUrls(),
      specs: getSpecs(),
      available: !document.querySelector('.out-of-stock')
    };
  });
  
  return product;
}
```

## Job Queue Management

### Queue Operations

```typescript
// Get next job with distributed locking
export async function getNextJob(workerId: string): Promise<ScrapeJob | null> {
  const { data } = await supabase
    .rpc('get_next_scrape_job', { worker_id: workerId });
  
  return data?.[0] || null;
}

// Complete job
export async function completeJob(jobId: string): Promise<void> {
  await supabase
    .from('scrape_job')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null
    })
    .eq('id', jobId);
}

// Fail job with retry logic
export async function failJob(jobId: string, error: string): Promise<void> {
  const { data: job } = await supabase
    .from('scrape_job')
    .select('attempts, max_attempts')
    .eq('id', jobId)
    .single();
  
  const status = job.attempts >= job.max_attempts ? 'failed' : 'queued';
  
  await supabase
    .from('scrape_job')
    .update({
      status,
      last_error: error,
      locked_at: null,
      locked_by: null
    })
    .eq('id', jobId);
}
```

### Worker Process

```typescript
export class ScrapeWorker {
  private browser: Browser | null = null;
  private isRunning = false;
  
  async start(): Promise<void> {
    this.isRunning = true;
    this.browser = await playwright.chromium.launch({
      headless: process.env.BROWSER_HEADLESS === 'true'
    });
    
    logger.info('Worker started');
    
    while (this.isRunning) {
      try {
        const job = await getNextJob(this.workerId);
        
        if (job) {
          await this.processJob(job);
        } else {
          // No jobs available, wait before checking again
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        logger.error('Worker error:', error);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }
  
  private async processJob(job: ScrapeJob): Promise<void> {
    const page = await this.browser!.newPage();
    
    try {
      logger.info('Processing job', { jobId: job.id, type: job.type, url: job.target_url });
      
      let result;
      switch (job.type) {
        case 'navigation':
          result = await scrapeNavigation(page);
          break;
        case 'category':
          result = await scrapeCategory(page, job.target_url);
          break;
        case 'product':
          result = await scrapeProduct(page, job.target_url);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }
      
      await this.saveResult(job, result);
      await completeJob(job.id);
      
      logger.info('Job completed', { jobId: job.id });
    } catch (error) {
      logger.error('Job failed', { jobId: job.id, error: error.message });
      await failJob(job.id, error.message);
    } finally {
      await page.close();
    }
  }
}
```

## Image Processing

### Download and Upload

```typescript
export async function processProductImages(
  imageUrls: string[], 
  productId: string
): Promise<string[]> {
  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  });
  
  const uploadedUrls: string[] = [];
  
  for (const [index, imageUrl] of imageUrls.entries()) {
    try {
      // Download image
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DataShelf/1.0)'
        }
      });
      
      if (!response.ok) continue;
      
      const imageBuffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const extension = contentType.split('/')[1] || 'jpg';
      
      // Generate unique filename
      const filename = `products/${productId}/${index}.${extension}`;
      
      // Upload to R2
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: filename,
        Body: new Uint8Array(imageBuffer),
        ContentType: contentType,
      }));
      
      // Generate public URL
      const publicUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${filename}`;
      uploadedUrls.push(publicUrl);
      
      logger.info('Image uploaded', { filename, size: imageBuffer.byteLength });
    } catch (error) {
      logger.error('Image upload failed', { imageUrl, error: error.message });
    }
  }
  
  return uploadedUrls;
}
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine

# Install Playwright dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Playwright to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S scraper -u 1001
USER scraper

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  scraper:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - CLOUDFLARE_R2_ACCOUNT_ID=${CLOUDFLARE_R2_ACCOUNT_ID}
      - CLOUDFLARE_R2_ACCESS_KEY_ID=${CLOUDFLARE_R2_ACCESS_KEY_ID}
      - CLOUDFLARE_R2_SECRET_ACCESS_KEY=${CLOUDFLARE_R2_SECRET_ACCESS_KEY}
      - CLOUDFLARE_R2_BUCKET_NAME=${CLOUDFLARE_R2_BUCKET_NAME}
      - CLOUDFLARE_R2_PUBLIC_URL=${CLOUDFLARE_R2_PUBLIC_URL}
    volumes:
      - ./src:/app/src
    restart: unless-stopped
```

## Monitoring and Logging

### Structured Logging

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

### Metrics Collection

```typescript
export class MetricsCollector {
  private metrics = {
    jobsProcessed: 0,
    jobsFailed: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0
  };
  
  recordJobCompletion(duration: number): void {
    this.metrics.jobsProcessed++;
    this.metrics.totalProcessingTime += duration;
    this.metrics.averageProcessingTime = 
      this.metrics.totalProcessingTime / this.metrics.jobsProcessed;
  }
  
  recordJobFailure(): void {
    this.metrics.jobsFailed++;
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.jobsProcessed / 
        (this.metrics.jobsProcessed + this.metrics.jobsFailed) * 100
    };
  }
}
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
# Test job processing capacity
npm run test:load
```

## Troubleshooting

See the main [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for common issues and solutions.

### Common Issues

1. **Browser crashes**: Increase memory limits in Docker
2. **Rate limiting**: Implement delays between requests
3. **Stuck jobs**: Reset locked jobs in database
4. **Image upload failures**: Check R2 credentials and permissions

### Debug Mode

```bash
DEBUG=datashelf:* npm run dev
```

This enables detailed logging for all scraper operations.
