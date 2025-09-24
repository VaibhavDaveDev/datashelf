# Database Setup Guide

This guide will help you set up the DataShelf database with Supabase.

## Prerequisites

1. A Supabase account and project
2. Node.js 18+ installed
3. Environment variables configured

## Step 1: Create Supabase Project

1. Go to [Supabase](https://supabase.com) and create a new project
2. Wait for the project to be fully provisioned
3. Note down your project URL and API keys

## Step 2: Configure Environment Variables

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Fill in your Supabase credentials in `.env`:
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Step 3: Create Migration Tracking Table

Since we can't execute arbitrary SQL via the Supabase client, you need to manually create the migration tracking table:

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Execute the following SQL:

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  version text PRIMARY KEY,
  filename text NOT NULL,
  executed_at timestamptz DEFAULT now()
);
```

## Step 4: Run Initial Migration

1. Install dependencies:
```bash
npm install
```

2. Run the migration command:
```bash
npm run migrate
```

3. The command will output the SQL that needs to be executed
4. Copy and paste this SQL into your Supabase SQL Editor
5. Execute the SQL to create all tables

## Step 5: Seed Sample Data (Optional)

1. Run the seed command:
```bash
npm run seed
```

2. Copy and paste the output SQL into your Supabase SQL Editor
3. Execute to populate with sample data

## Step 6: Verify Setup

1. Check that all tables were created:
   - `navigation`
   - `category` 
   - `product`
   - `scrape_job`
   - `_migrations`

2. Run the tests to verify everything works:
```bash
npm test
```

## Database Schema Overview

### Tables Created

- **navigation**: Hierarchical category structure
- **category**: Product categories with counts
- **product**: Core product data with JSONB specs
- **scrape_job**: Job queue for scraping operations
- **_migrations**: Migration tracking

### Key Features

- UUID primary keys for all tables
- JSONB columns for flexible product specifications
- Optimized indexes for common queries
- Automatic timestamp management
- Foreign key relationships with proper cascading

## Next Steps

After setup is complete, you can:

1. Use the database utilities in your scraper service
2. Connect the API layer to serve data
3. Build the frontend to display products

## Troubleshooting

### Common Issues

**Connection Errors**: Verify your Supabase URL and keys are correct

**Permission Errors**: Make sure you're using the service role key for migrations

**Table Not Found**: Ensure you've executed the migration SQL in Supabase dashboard

**Type Errors**: Run `npm run build` to check for TypeScript issues

### Getting Help

1. Check the Supabase documentation
2. Review the database README.md
3. Examine the test files for usage examples