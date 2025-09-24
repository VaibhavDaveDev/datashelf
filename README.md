# DataShelf - Product Data Explorer

DataShelf is a comprehensive product data exploration platform that crawls the World of Books website to extract, normalize, and serve structured product data. The system consists of a web scraper service, a PostgreSQL database (Supabase), edge API workers (Cloudflare), and a React frontend.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend │    │ Cloudflare Workers│    │  Scraper Service │
│  (Cloudflare     │◄──►│     API          │◄──►│   (Render)      │
│   Pages)         │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Supabase      │    │  Cloudflare R2  │
                       │  PostgreSQL     │    │   Image Storage │
                       └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker (for scraper service)
- Supabase account
- Cloudflare account (Workers, Pages, R2)
- Render account (for scraper deployment)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd datashelf
npm install
```

### 2. Environment Configuration

Copy environment templates and configure:

```bash
# Root level
cp .env.example .env.local

# API (Cloudflare Workers)
cp api/.env.example api/.env

# Scraper service
cp scraper/.env.example scraper/.env

# Frontend
cp frontend/.env.example frontend/.env.local

# Database
cp database/.env.example database/.env
```

### 3. Database Setup

```bash
cd database
npm install
npm run migrate
npm run seed
```

### 4. Start Development Services

```bash
# Terminal 1: Start scraper service
cd scraper
npm install
npm run dev

# Terminal 2: Start API (Cloudflare Workers)
cd api
npm install
npm run dev

# Terminal 3: Start frontend
cd frontend
npm install
npm run dev
```

## 📁 Project Structure

```
datashelf/
├── api/                    # Cloudflare Workers API
│   ├── src/
│   │   ├── handlers/       # API endpoint handlers
│   │   ├── utils/          # Utilities and helpers
│   │   └── index.ts        # Main worker entry point
│   └── wrangler.toml       # Cloudflare Workers config
├── database/               # Database migrations and utilities
│   ├── migrations/         # SQL migration files
│   ├── seeds/             # Database seed data
│   └── utils/             # Database utilities
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API services
│   │   └── utils/         # Frontend utilities
│   └── public/            # Static assets
├── scraper/               # Web scraper service
│   ├── src/
│   │   ├── scrapers/      # Scraping logic
│   │   ├── utils/         # Scraper utilities
│   │   ├── routes/        # HTTP endpoints
│   │   └── worker.ts      # Main worker process
│   └── Dockerfile         # Docker configuration
└── scripts/               # Deployment and utility scripts
```

## 🔧 Component Documentation

### [Scraper Service](./scraper/README.md)
- Web scraping with Crawlee and Playwright
- PostgreSQL job queue management
- Image processing and R2 upload
- Docker deployment on Render

### [API Layer](./api/README.md)
- Cloudflare Workers edge API
- Cache-first with stale-while-revalidate
- Supabase integration
- Request authentication

### [Frontend Application](./frontend/README.md)
- React with TypeScript and Tailwind CSS
- React Query for state management
- Responsive design and accessibility
- Cloudflare Pages deployment

### [Database](./database/README.md)
- PostgreSQL schema and migrations
- Supabase configuration
- Job queue implementation
- Performance optimization

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 📊 Monitoring

- Health checks: `/health` endpoints on all services
- Logs: Structured logging with appropriate levels
- Metrics: Scraping success rates and API performance
- Alerts: Critical failure notifications

## 🧪 Testing

```bash
# Run all tests
npm test

# Component-specific tests
cd scraper && npm test
cd api && npm test
cd frontend && npm test
cd database && npm test
```

## 🔍 Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## 📚 API Documentation

See [API.md](./API.md) for detailed API documentation with request/response examples.

## 🗄️ Database Schema

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for complete database documentation.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.