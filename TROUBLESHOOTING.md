# DataShelf Troubleshooting Guide

This guide covers common issues and their solutions for the DataShelf platform.

## Table of Contents

- [General Issues](#general-issues)
- [Scraper Service Issues](#scraper-service-issues)
- [API Issues](#api-issues)
- [Frontend Issues](#frontend-issues)
- [Database Issues](#database-issues)
- [Deployment Issues](#deployment-issues)
- [Performance Issues](#performance-issues)
- [Monitoring and Debugging](#monitoring-and-debugging)

---

## General Issues

### Environment Variables Not Loading

**Symptoms:**
- Services fail to start
- Database connection errors
- API authentication failures

**Solutions:**

1. **Check environment file locations:**
   ```bash
   # Verify files exist
   ls -la .env*
   ls -la api/.env
   ls -la scraper/.env
   ls -la frontend/.env.local
   ```

2. **Validate environment file format:**
   ```bash
   # No spaces around = sign
   SUPABASE_URL=https://your-project.supabase.co
   
   # Not this:
   SUPABASE_URL = https://your-project.supabase.co
   ```

3. **Check for missing variables:**
   ```bash
   # Use the setup script
   ./scripts/setup-secrets.sh
   # or
   ./scripts/setup-secrets.ps1
   ```

### Port Conflicts

**Symptoms:**
- "Port already in use" errors
- Services fail to start

**Solutions:**

1. **Find processes using ports:**
   ```bash
   # Linux/Mac
   lsof -i :3000
   lsof -i :8787
   
   # Windows
   netstat -ano | findstr :3000
   ```

2. **Kill conflicting processes:**
   ```bash
   # Linux/Mac
   kill -9 <PID>
   
   # Windows
   taskkill /PID <PID> /F
   ```

3. **Use different ports:**
   ```bash
   # Frontend
   PORT=3001 npm run dev
   
   # API
   PORT=8788 npm run dev
   ```

---

## Scraper Service Issues

### Playwright Browser Installation

**Symptoms:**
- "Browser not found" errors
- Scraping jobs fail immediately

**Solutions:**

1. **Install browsers manually:**
   ```bash
   cd scraper
   npx playwright install chromium
   npx playwright install-deps
   ```

2. **Docker browser issues:**
   ```dockerfile
   # Ensure Dockerfile includes browser installation
   RUN npx playwright install chromium
   RUN npx playwright install-deps
   ```

3. **Check browser path:**
   ```javascript
   // In scraper config
   const browser = await playwright.chromium.launch({
     executablePath: process.env.CHROMIUM_PATH || undefined
   });
   ```

### Scraping Jobs Stuck in Queue

**Symptoms:**
- Jobs remain in "queued" status
- No scraping activity in logs

**Solutions:**

1. **Check worker process:**
   ```bash
   cd scraper
   npm run worker
   ```

2. **Verify database connection:**
   ```bash
   # Test database connectivity
   npm run test:db
   ```

3. **Check job queue:**
   ```sql
   SELECT status, COUNT(*) 
   FROM scrape_job 
   GROUP BY status;
   ```

4. **Reset stuck jobs:**
   ```sql
   UPDATE scrape_job 
   SET status = 'queued', 
       locked_at = NULL, 
       locked_by = NULL 
   WHERE status = 'running' 
     AND locked_at < NOW() - INTERVAL '30 minutes';
   ```

### Memory Issues in Docker

**Symptoms:**
- Container crashes with OOM errors
- Browser processes killed

**Solutions:**

1. **Increase Docker memory:**
   ```yaml
   # docker-compose.yml
   services:
     scraper:
       deploy:
         resources:
           limits:
             memory: 2G
   ```

2. **Optimize browser settings:**
   ```javascript
   const browser = await playwright.chromium.launch({
     args: [
       '--no-sandbox',
       '--disable-dev-shm-usage',
       '--disable-gpu',
       '--memory-pressure-off'
     ]
   });
   ```

3. **Implement browser pooling:**
   ```javascript
   // Reuse browser instances
   const browserPool = new BrowserPool({
     maxBrowsers: 2,
     maxPages: 5
   });
   ```

### Rate Limiting from World of Books

**Symptoms:**
- 429 Too Many Requests errors
- Scraping jobs fail with rate limit messages

**Solutions:**

1. **Implement delays:**
   ```javascript
   // Add delays between requests
   await new Promise(resolve => setTimeout(resolve, 2000));
   ```

2. **Use rotating user agents:**
   ```javascript
   const userAgents = [
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
   ];
   ```

3. **Implement exponential backoff:**
   ```javascript
   const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
   await new Promise(resolve => setTimeout(resolve, delay));
   ```

---

## API Issues

### Cloudflare Workers Deployment Failures

**Symptoms:**
- Deployment fails with authentication errors
- Workers not updating after deployment

**Solutions:**

1. **Check Cloudflare credentials:**
   ```bash
   # Verify wrangler authentication
   npx wrangler whoami
   
   # Re-authenticate if needed
   npx wrangler login
   ```

2. **Verify wrangler.toml configuration:**
   ```toml
   name = "datashelf-api"
   main = "src/index.ts"
   compatibility_date = "2024-01-15"
   
   [env.production]
   vars = { ENVIRONMENT = "production" }
   ```

3. **Check environment variables:**
   ```bash
   # Set secrets
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   ```

### Cache Issues

**Symptoms:**
- Stale data served to users
- Cache not updating after scraping

**Solutions:**

1. **Check cache headers:**
   ```javascript
   // Verify TTL settings
   response.headers.set('Cache-Control', 'public, max-age=300');
   ```

2. **Manual cache purge:**
   ```bash
   # Purge specific URLs
   curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
     -H "Authorization: Bearer {api_token}" \
     -H "Content-Type: application/json" \
     --data '{"files":["https://api.datashelf.com/api/products"]}'
   ```

3. **Debug cache keys:**
   ```javascript
   // Log cache keys for debugging
   console.log('Cache key:', cacheKey.url);
   const cached = await caches.default.match(cacheKey);
   console.log('Cache hit:', !!cached);
   ```

### Supabase Connection Issues

**Symptoms:**
- Database connection timeouts
- Authentication errors

**Solutions:**

1. **Check connection string:**
   ```javascript
   // Verify URL format
   const supabaseUrl = 'https://your-project.supabase.co';
   const supabaseKey = 'your-anon-key';
   ```

2. **Test connection:**
   ```bash
   # Test from command line
   curl -H "apikey: your-anon-key" \
        -H "Authorization: Bearer your-anon-key" \
        "https://your-project.supabase.co/rest/v1/product?select=id&limit=1"
   ```

3. **Check RLS policies:**
   ```sql
   -- Verify Row Level Security policies
   SELECT * FROM pg_policies WHERE tablename = 'product';
   ```

---

## Frontend Issues

### Build Failures

**Symptoms:**
- TypeScript compilation errors
- Missing dependencies

**Solutions:**

1. **Clear node_modules and reinstall:**
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check TypeScript configuration:**
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "target": "ES2020",
       "lib": ["ES2020", "DOM", "DOM.Iterable"],
       "allowJs": false,
       "skipLibCheck": true,
       "esModuleInterop": false,
       "allowSyntheticDefaultImports": true,
       "strict": true,
       "forceConsistentCasingInFileNames": true,
       "module": "ESNext",
       "moduleResolution": "Node",
       "resolveJsonModule": true,
       "isolatedModules": true,
       "noEmit": true,
       "jsx": "react-jsx"
     }
   }
   ```

3. **Fix import paths:**
   ```typescript
   // Use relative imports
   import { ProductCard } from '../components/ProductCard';
   
   // Not absolute imports without proper configuration
   import { ProductCard } from 'components/ProductCard';
   ```

### API Connection Issues

**Symptoms:**
- CORS errors in browser console
- API requests failing

**Solutions:**

1. **Check API base URL:**
   ```typescript
   // Verify environment variable
   const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8787';
   ```

2. **Verify CORS configuration:**
   ```javascript
   // In Cloudflare Worker
   const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
     'Access-Control-Allow-Headers': 'Content-Type, Authorization',
   };
   ```

3. **Check network tab:**
   - Open browser DevTools
   - Check Network tab for failed requests
   - Verify request headers and response codes

### React Query Issues

**Symptoms:**
- Data not loading
- Infinite loading states

**Solutions:**

1. **Check query keys:**
   ```typescript
   // Ensure consistent query keys
   const { data } = useQuery(['products', categoryId, filters], fetchProducts);
   ```

2. **Verify error handling:**
   ```typescript
   const { data, error, isLoading } = useQuery(
     ['products'],
     fetchProducts,
     {
       retry: 3,
       retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
       onError: (error) => {
         console.error('Query failed:', error);
       }
     }
   );
   ```

3. **Debug React Query:**
   ```typescript
   import { ReactQueryDevtools } from 'react-query/devtools';
   
   function App() {
     return (
       <>
         <YourApp />
         <ReactQueryDevtools initialIsOpen={false} />
       </>
     );
   }
   ```

---

## Database Issues

### Migration Failures

**Symptoms:**
- Migration scripts fail to run
- Schema inconsistencies

**Solutions:**

1. **Check migration order:**
   ```bash
   cd database
   ls -la migrations/
   # Ensure proper naming: 001_initial.sql, 002_add_indexes.sql
   ```

2. **Run migrations manually:**
   ```bash
   # Test individual migration
   psql -h your-host -U postgres -d your-db -f migrations/001_initial.sql
   ```

3. **Check migration status:**
   ```sql
   -- If using migration tracking table
   SELECT * FROM schema_migrations ORDER BY version;
   ```

### Performance Issues

**Symptoms:**
- Slow query responses
- High CPU usage on database

**Solutions:**

1. **Analyze slow queries:**
   ```sql
   -- Enable query logging
   ALTER SYSTEM SET log_min_duration_statement = 1000;
   SELECT pg_reload_conf();
   
   -- Check slow queries
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

2. **Check missing indexes:**
   ```sql
   -- Find tables without indexes
   SELECT schemaname, tablename, attname, n_distinct, correlation 
   FROM pg_stats 
   WHERE schemaname = 'public' 
     AND n_distinct > 100;
   ```

3. **Update table statistics:**
   ```sql
   ANALYZE product;
   ANALYZE category;
   ANALYZE scrape_job;
   ```

### Connection Pool Exhaustion

**Symptoms:**
- "Too many connections" errors
- Connection timeouts

**Solutions:**

1. **Check active connections:**
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
   ```

2. **Configure connection pooling:**
   ```javascript
   // In Supabase client
   const supabase = createClient(url, key, {
     db: {
       schema: 'public',
     },
     auth: {
       autoRefreshToken: true,
       persistSession: true,
       detectSessionInUrl: true
     },
     global: {
       headers: { 'x-my-custom-header': 'my-app-name' },
     },
   });
   ```

3. **Use connection pooling service:**
   - Enable Supabase connection pooling
   - Use transaction mode for short queries
   - Use session mode for complex operations

---

## Deployment Issues

### Docker Build Failures

**Symptoms:**
- Docker build fails with dependency errors
- Image size too large

**Solutions:**

1. **Multi-stage builds:**
   ```dockerfile
   # Build stage
   FROM node:18-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   
   # Production stage
   FROM node:18-alpine AS production
   WORKDIR /app
   COPY --from=builder /app/node_modules ./node_modules
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Optimize Docker layers:**
   ```dockerfile
   # Copy package files first for better caching
   COPY package*.json ./
   RUN npm ci --only=production
   
   # Copy source code last
   COPY . .
   ```

3. **Use .dockerignore:**
   ```
   node_modules
   npm-debug.log
   .git
   .gitignore
   README.md
   .env
   coverage
   .nyc_output
   ```

### Render Deployment Issues

**Symptoms:**
- Build fails on Render
- Service crashes after deployment

**Solutions:**

1. **Check build logs:**
   - Review Render dashboard build logs
   - Look for dependency installation failures
   - Check for memory issues during build

2. **Verify render.yaml:**
   ```yaml
   services:
     - type: web
       name: datashelf-scraper
       env: docker
       dockerfilePath: ./scraper/Dockerfile
       dockerContext: ./scraper
       envVars:
         - key: NODE_ENV
           value: production
   ```

3. **Health check configuration:**
   ```javascript
   // Ensure health endpoint responds quickly
   app.get('/health', (req, res) => {
     res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
   });
   ```

### Cloudflare Pages Deployment

**Symptoms:**
- Build fails with "Command not found"
- Assets not loading correctly

**Solutions:**

1. **Check build configuration:**
   ```yaml
   # In Pages dashboard
   Build command: npm run build
   Build output directory: dist
   Root directory: frontend
   ```

2. **Verify build script:**
   ```json
   {
     "scripts": {
       "build": "tsc && vite build",
       "preview": "vite preview"
     }
   }
   ```

3. **Check _redirects file:**
   ```
   # frontend/public/_redirects
   /*    /index.html   200
   ```

---

## Performance Issues

### Slow API Responses

**Symptoms:**
- High response times
- Timeouts on complex queries

**Solutions:**

1. **Add database indexes:**
   ```sql
   CREATE INDEX CONCURRENTLY idx_product_category_price 
   ON product(category_id, price);
   ```

2. **Optimize queries:**
   ```sql
   -- Use LIMIT and proper WHERE clauses
   SELECT * FROM product 
   WHERE category_id = $1 
     AND available = true 
   ORDER BY price ASC 
   LIMIT 20 OFFSET $2;
   ```

3. **Implement pagination:**
   ```typescript
   // Use cursor-based pagination for large datasets
   const products = await supabase
     .from('product')
     .select('*')
     .gt('id', lastId)
     .limit(20);
   ```

### High Memory Usage

**Symptoms:**
- Services crashing with OOM errors
- Slow performance under load

**Solutions:**

1. **Profile memory usage:**
   ```javascript
   // Add memory monitoring
   setInterval(() => {
     const usage = process.memoryUsage();
     console.log('Memory usage:', {
       rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
       heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB'
     });
   }, 30000);
   ```

2. **Optimize data processing:**
   ```javascript
   // Process data in chunks
   const chunkSize = 100;
   for (let i = 0; i < data.length; i += chunkSize) {
     const chunk = data.slice(i, i + chunkSize);
     await processChunk(chunk);
   }
   ```

3. **Implement streaming:**
   ```javascript
   // Stream large responses
   const stream = new ReadableStream({
     start(controller) {
       // Stream data in chunks
     }
   });
   ```

---

## Monitoring and Debugging

### Enable Debug Logging

**Scraper Service:**
```bash
DEBUG=datashelf:* npm run dev
```

**API Workers:**
```javascript
// Add console.log statements
console.log('Request:', request.url);
console.log('Cache status:', cacheStatus);
```

**Frontend:**
```typescript
// Enable React Query devtools
import { ReactQueryDevtools } from 'react-query/devtools';
```

### Health Check Endpoints

Test all health endpoints:

```bash
# Scraper
curl http://localhost:3000/health

# API
curl https://api.datashelf.com/health

# Database
curl -H "apikey: your-key" \
     "https://your-project.supabase.co/rest/v1/product?select=count&limit=1"
```

### Log Analysis

**Structured logging format:**
```javascript
const log = {
  timestamp: new Date().toISOString(),
  level: 'info',
  service: 'scraper',
  message: 'Job completed',
  jobId: 'uuid',
  duration: 1234,
  url: 'https://example.com'
};
console.log(JSON.stringify(log));
```

### Performance Monitoring

**Database queries:**
```sql
-- Monitor query performance
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

**API response times:**
```javascript
// Add timing headers
const start = Date.now();
// ... process request
const duration = Date.now() - start;
response.headers.set('X-Response-Time', `${duration}ms`);
```

---

## Getting Help

### Log Collection

When reporting issues, include:

1. **Service logs:**
   ```bash
   # Scraper logs
   docker logs datashelf-scraper

   # API logs (from Cloudflare dashboard)
   # Frontend logs (browser console)
   ```

2. **System information:**
   ```bash
   node --version
   npm --version
   docker --version
   ```

3. **Configuration:**
   ```bash
   # Sanitized environment variables (remove secrets)
   env | grep -E "(NODE_ENV|PORT|DATABASE_URL)" | sed 's/=.*/=***/'
   ```

### Support Channels

- **GitHub Issues**: For bugs and feature requests
- **Documentation**: Check README and troubleshooting guides
- **Health Checks**: Monitor service status endpoints

### Emergency Procedures

**Service Down:**
1. Check health endpoints
2. Review recent deployments
3. Check error logs
4. Rollback if necessary

**Data Corruption:**
1. Stop all write operations
2. Assess damage scope
3. Restore from backup
4. Verify data integrity

**Security Incident:**
1. Rotate all API keys
2. Review access logs
3. Update security policies
4. Monitor for suspicious activity