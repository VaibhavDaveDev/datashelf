# DataShelf Setup Guide

This guide will help you set up the DataShelf Product Explorer development environment.

## Prerequisites

- Node.js 20+ and npm 9+
- Docker and Docker Compose (for local development)
- Git

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd datashelf-product-explorer
   ```

2. **Install dependencies**
   ```bash
   npm install
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   cp scraper/.env.example scraper/.env
   cp api/.env.example api/.env
   cp frontend/.env.example frontend/.env
   ```

4. **Configure your environment variables** (see Configuration section below)

5. **Start development servers**
   ```bash
   npm run dev
   ```

This will start:
- Scraper service on http://localhost:3000
- API service on http://localhost:8787
- Frontend on http://localhost:3001

## Configuration

### Required Services

You'll need to set up these external services:

1. **Supabase** (Database)
   - Create a new project at https://supabase.com
   - Get your project URL and anon key
   - Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in your .env files

2. **PostgreSQL Job Queue** (Built into Supabase)
   - Job queues are handled by PostgreSQL using row-level locking
   - No additional setup required beyond Supabase

3. **Cloudflare R2** (Image Storage)
   - Create an R2 bucket in Cloudflare dashboard
   - Generate API tokens with R2 permissions
   - Update Cloudflare R2 variables in your .env files

4. **Cloudflare Workers** (API Deployment)
   - Install Wrangler CLI: `npm install -g wrangler`
   - Login: `wrangler login`
   - Update `wrangler.toml` with your account details

### Environment Variables

#### Root .env
```bash
# Copy from .env.example and fill in your values
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
# ... etc
```

#### Scraper .env
```bash
# Database and cache
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Image storage
CLOUDFLARE_R2_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET_NAME=datashelf-images

# Security
SCRAPER_API_KEY=your-secure-api-key
```

#### API .env
```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Scraper communication
SCRAPER_API_KEY=your-secure-api-key
SCRAPER_SERVICE_URL=https://your-scraper.onrender.com
```

#### Frontend .env
```bash
# API endpoint
VITE_API_BASE_URL=https://api.datashelf.com
# For development:
# VITE_API_BASE_URL=http://localhost:8787
```

## Development Workflow

### Running Individual Components

```bash
# Scraper only
cd scraper && npm run dev

# API only
cd api && npm run dev

# Frontend only
cd frontend && npm run dev
```

### Testing

```bash
# Run all tests
npm run test

# Run tests for specific component
npm run test:scraper
npm run test:api
npm run test:frontend

# Watch mode
cd scraper && npm run test:watch
```

### Linting and Type Checking

```bash
# Lint all components
npm run lint

# Type check all components
cd scraper && npm run types:check
cd api && npm run types:check
cd frontend && npm run types:check
```

### Building

```bash
# Build all components
npm run build

# Build specific component
npm run build:scraper
npm run build:api
npm run build:frontend
```

## Database Setup

1. **Create Supabase project** and get connection details

2. **Run database migrations** (when implemented in task 2):
   ```bash
   cd scraper
   npm run db:migrate
   ```

3. **Seed initial data** (when implemented):
   ```bash
   npm run db:seed
   ```

## Docker Development

For a more production-like environment:

```bash
# Start with local database only
docker-compose --profile local-db up -d

# Start scraper service
docker-compose --profile development up scraper
```

## Deployment

### Scraper (Render)
1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set build command: `cd scraper && npm run build`
4. Set start command: `cd scraper && npm start`
5. Add environment variables from scraper/.env.example

### API (Cloudflare Workers)
```bash
cd api
wrangler deploy --env production
```

### Frontend (Cloudflare Pages)
1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `cd frontend && npm run build`
3. Set output directory: `frontend/dist`
4. Add environment variables from frontend/.env.example

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in package.json scripts if needed
2. **Environment variables**: Double-check all required variables are set
3. **Dependencies**: Run `npm run clean && npm run install:all` to reset
4. **Docker issues**: Ensure Docker is running and has sufficient resources

### Getting Help

1. Check the individual README files in each component directory
2. Review the requirements and design documents in `.kiro/specs/`
3. Check GitHub Issues for known problems
4. Review logs in each service for specific error messages

## Next Steps

After setup is complete, you can:

1. Review the implementation tasks in `.kiro/specs/datashelf-product-explorer/tasks.md`
2. Start implementing features following the task list
3. Set up monitoring and logging (task 22)
4. Configure CI/CD pipeline (task 21)

The project is structured to support incremental development - you can implement and test each component independently.