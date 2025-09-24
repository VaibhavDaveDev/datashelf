-- DataShelf Database Schema
-- Initial migration for navigation, category, product, and scrape_job tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Navigation structure table
CREATE TABLE navigation (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    source_url text UNIQUE NOT NULL,
    parent_id uuid REFERENCES navigation(id) ON DELETE CASCADE,
    last_scraped_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Product categories table
CREATE TABLE category (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    navigation_id uuid REFERENCES navigation(id) ON DELETE CASCADE,
    title text NOT NULL,
    source_url text UNIQUE NOT NULL,
    product_count integer DEFAULT 0,
    last_scraped_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Core product data table
CREATE TABLE product (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id uuid REFERENCES category(id) ON DELETE SET NULL,
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

-- Scraping job management table
CREATE TABLE scrape_job (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    type text NOT NULL CHECK (type IN ('navigation', 'category', 'product')),
    target_url text NOT NULL,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    last_error text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for optimal query performance
CREATE INDEX idx_navigation_parent ON navigation(parent_id);
CREATE INDEX idx_navigation_source_url ON navigation(source_url);

CREATE INDEX idx_category_navigation ON category(navigation_id);
CREATE INDEX idx_category_source_url ON category(source_url);

CREATE INDEX idx_product_category ON product(category_id);
CREATE INDEX idx_product_price ON product(price);
CREATE INDEX idx_product_available ON product(available);
CREATE INDEX idx_product_source_url ON product(source_url);
CREATE INDEX idx_product_last_scraped ON product(last_scraped_at);

CREATE INDEX idx_scrape_job_status ON scrape_job(status);
CREATE INDEX idx_scrape_job_type ON scrape_job(type);
CREATE INDEX idx_scrape_job_target_url ON scrape_job(target_url);
CREATE INDEX idx_scrape_job_created_at ON scrape_job(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_navigation_updated_at BEFORE UPDATE ON navigation
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_category_updated_at BEFORE UPDATE ON category
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_updated_at BEFORE UPDATE ON product
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scrape_job_updated_at BEFORE UPDATE ON scrape_job
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();