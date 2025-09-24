/**
 * API response types based on the design document
 */

// Navigation API types
export interface NavigationResponse {
  id: string;
  title: string;
  source_url: string;
  children?: NavigationResponse[];
  last_scraped_at: string;
}

// Categories API types
export interface CategoryItem {
  id: string;
  title: string;
  product_count: number;
  last_scraped_at: string;
}

export interface CategoriesResponse {
  total: number;
  items: CategoryItem[];
}

// Products API types
export interface ProductItem {
  id: string;
  title: string;
  price?: number;
  currency?: string;
  thumbnail: string;
  available: boolean;
}

export interface ProductsResponse {
  total: number;
  items: ProductItem[];
  pagination: {
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface ProductDetailResponse {
  id: string;
  title: string;
  price?: number;
  currency?: string;
  image_urls: string[];
  summary?: string;
  specs: Record<string, any>;
  source_url: string;
  last_scraped_at: string;
}

// Error response type
export interface APIError {
  error: string;
  message: string;
  code: number;
  timestamp: string;
}

// Query parameter types
export interface CategoriesQuery {
  navId?: string;
  parentId?: string;
  limit?: number;
  offset?: number;
}

export interface ProductsQuery {
  categoryId?: string;
  limit?: number;
  offset?: number;
  sort?: 'price_asc' | 'price_desc' | 'title_asc' | 'title_desc' | 'created_at_desc';
}

// Response metadata
export interface ResponseMetadata {
  timestamp: string;
  cached: boolean;
  ttl?: number;
}

// Standard API response wrapper
export interface APIResponse<T> {
  data: T;
  meta?: ResponseMetadata;
}