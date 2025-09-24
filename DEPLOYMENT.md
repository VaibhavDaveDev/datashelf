# DataShelf Deployment Guide

This guide covers deploying the DataShelf application to production and staging environments.

## Architecture Overview

- **Frontend**: React app deployed to Cloudflare Pages
- **API**: Cloudflare Workers for edge caching and API endpoints
- **Scraper**: Docker container deployed to Render
- **Database**: Supabase (PostgreSQL) for data storage and job queues
- **Storage**: Cloudflare R2 for image storage

## Prerequisites

### Required Tools
- Node.js 18+
- npm or yarn
- Docker (for scraper service)
- Wrangler CLI (`npm install -g wrangler`)

### Required Accounts
- GitHub (for CI/CD)
- Cloudflare (Workers, Pages, R2)
- Render (scraper hosting)
- Supabase (database)

## Environment Setup

### 1. Supabase Configuration

1. Create a new Supabase project
2. Note down your project URL and API keys
3. Run database migrations:
   ```bash
   cd database
   npm run migrate:deploy
   ```

### 2. Cloudflare Configuration

#### R2 Storage
1. Create an R2 bucket named `datashelf-images`
2. Generate R2 API tokens with read/write permissions
3. Configure CORS for your frontend domain

#### Workers
1. Create a Cloudflare Workers account
2. Get your Account ID from the dashboard
3. Generate an API token with Workers permissions

#### Pages
1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set build output directory: `dist`

### 3. Render Configuration

1. Create a new Web Service
2. Connect your GitHub repository
3. Set Docker build context to `./scraper`
4. Configure environment variables (see below)

## Environment Variables

### GitHub Secrets (for CI/CD)

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Cloudflare
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id

# Render
RENDER_SERVICE_ID=your-service-id
RENDER_API_KEY=your-api-key

# Frontend
VITE_API_BASE_URL=https://your-worker.your-subdomain.workers.dev
```

### Render Environment Variables

```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Storage
CLOUDFLARE_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET_NAME=datashelf-images

# API
SCRAPER_API_KEY=your-secure-api-key
WORKER_ID=production-worker-1
NODE_ENV=production
```

### Cloudflare Workers Secrets

Set these using `wrangler secret put`:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SCRAPER_API_KEY
wrangler secret put SCRAPER_SERVICE_URL
```

## Deployment Methods

### 1. Automated Deployment (Recommended)

Push to the `main` branch to trigger automatic deployment via GitHub Actions:

```bash
git push origin main
```

The CI/CD pipeline will:
1. Run tests for all components
2. Build and push Docker image for scraper
3. Deploy API to Cloudflare Workers
4. Build and deploy frontend to Cloudflare Pages
5. Run database migrations
6. Deploy scraper to Render

### 2. Manual Deployment

Use the deployment scripts:

```bash
# Linux/macOS
./scripts/deploy.sh production

# Windows
.\scripts\deploy.ps1 -Environment production
```

### 3. Component-Specific Deployment

#### Database Migrations
```bash
cd database
npm run migrate:deploy
```

#### API (Cloudflare Workers)
```bash
cd api
wrangler deploy --env production
```

#### Frontend (Cloudflare Pages)
```bash
cd frontend
npm run build
wrangler pages deploy dist --project-name datashelf-frontend
```

#### Scraper (Render)
Render automatically deploys when you push to the connected branch.

## Monitoring and Health Checks

### Health Check Endpoints

- **Scraper**: `https://your-scraper.onrender.com/health`
- **API**: `https://your-worker.workers.dev/health`

### Monitoring

1. **Render Dashboard**: Monitor scraper service health and logs
2. **Cloudflare Analytics**: Monitor Workers and Pages performance
3. **Supabase Dashboard**: Monitor database performance and usage

## Troubleshooting

### Common Issues

#### 1. Migration Failures
```bash
# Check migration status
cd database
npm run db:status

# Reset and re-run migrations (CAUTION: This will drop all data)
npm run db:reset
npm run migrate:deploy
```

#### 2. Worker Deployment Failures
```bash
# Check wrangler configuration
wrangler whoami
wrangler dev # Test locally first

# Deploy with verbose logging
wrangler deploy --env production --verbose
```

#### 3. Scraper Service Issues
- Check Render logs for Docker build errors
- Verify all environment variables are set
- Ensure Playwright dependencies are installed in Docker

#### 4. Frontend Build Failures
```bash
# Test build locally
cd frontend
npm run build

# Check environment variables
echo $VITE_API_BASE_URL
```

### Rollback Procedures

#### 1. API Rollback
```bash
cd api
wrangler rollback --env production
```

#### 2. Frontend Rollback
Use Cloudflare Pages dashboard to rollback to a previous deployment.

#### 3. Scraper Rollback
Use Render dashboard to rollback to a previous deployment.

## Security Considerations

### Secrets Management
- Never commit actual secrets to version control
- Use GitHub Secrets for CI/CD
- Use platform-specific secret management (Render env vars, Wrangler secrets)
- Rotate API keys regularly

### Network Security
- All services communicate over HTTPS
- API endpoints use HMAC authentication
- CORS is properly configured
- Rate limiting is enabled

### Access Control
- Use least-privilege principle for API keys
- Separate staging and production environments
- Regular security audits of dependencies

## Performance Optimization

### Caching Strategy
- Cloudflare Workers Cache API for edge caching
- Stale-while-revalidate for optimal performance
- Dynamic TTL based on content type

### Database Optimization
- Proper indexing for query performance
- Connection pooling via Supabase
- Regular VACUUM and ANALYZE operations

### Image Optimization
- WebP format for better compression
- Multiple sizes for responsive images
- CDN delivery via Cloudflare R2

## Scaling Considerations

### Horizontal Scaling
- Multiple scraper instances on Render
- Cloudflare Workers automatically scale
- Database connection limits via Supabase

### Vertical Scaling
- Increase Render service resources
- Upgrade Supabase plan for more connections
- Monitor and adjust based on usage patterns

## Maintenance

### Regular Tasks
- Monitor error rates and performance metrics
- Update dependencies monthly
- Review and rotate API keys quarterly
- Database maintenance (VACUUM, ANALYZE)

### Backup Strategy
- Supabase automatic backups (daily)
- Export critical configuration files
- Document recovery procedures

## Support

For deployment issues:
1. Check service status pages
2. Review application logs
3. Consult troubleshooting section
4. Contact platform support if needed