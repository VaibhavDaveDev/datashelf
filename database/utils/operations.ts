import { getDatabase, SupabaseClientType } from './connection.js';

// Type definitions for database records
export interface NavigationRow {
  id: string;
  title: string;
  source_url: string;
  parent_id: string | null;
  last_scraped_at: string;
  created_at: string;
  updated_at: string;
}

export interface NavigationInsert {
  id?: string;
  title: string;
  source_url: string;
  parent_id?: string | null;
  last_scraped_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NavigationUpdate {
  id?: string;
  title?: string;
  source_url?: string;
  parent_id?: string | null;
  last_scraped_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryRow {
  id: string;
  navigation_id: string | null;
  title: string;
  source_url: string;
  product_count: number;
  last_scraped_at: string;
  created_at: string;
  updated_at: string;
}

export interface CategoryInsert {
  id?: string;
  navigation_id?: string | null;
  title: string;
  source_url: string;
  product_count?: number;
  last_scraped_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryUpdate {
  id?: string;
  navigation_id?: string | null;
  title?: string;
  source_url?: string;
  product_count?: number;
  last_scraped_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductRow {
  id: string;
  category_id: string | null;
  title: string;
  source_url: string;
  source_id: string | null;
  price: number | null;
  currency: string | null;
  image_urls: any; // JSONB
  summary: string | null;
  specs: any; // JSONB
  available: boolean;
  last_scraped_at: string;
  created_at: string;
  updated_at: string;
}

export interface ProductInsert {
  id?: string;
  category_id?: string | null;
  title: string;
  source_url: string;
  source_id?: string | null;
  price?: number | null;
  currency?: string | null;
  image_urls?: any;
  summary?: string | null;
  specs?: any;
  available?: boolean;
  last_scraped_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductUpdate {
  id?: string;
  category_id?: string | null;
  title?: string;
  source_url?: string;
  source_id?: string | null;
  price?: number | null;
  currency?: string | null;
  image_urls?: any;
  summary?: string | null;
  specs?: any;
  available?: boolean;
  last_scraped_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScrapeJobRow {
  id: string;
  type: 'navigation' | 'category' | 'product';
  target_url: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  metadata: any; // JSONB
  created_at: string;
  updated_at: string;
}

export interface ScrapeJobInsert {
  id?: string;
  type: 'navigation' | 'category' | 'product';
  target_url: string;
  status?: 'queued' | 'running' | 'completed' | 'failed';
  attempts?: number;
  max_attempts?: number;
  last_error?: string | null;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
}

export interface ScrapeJobUpdate {
  id?: string;
  type?: 'navigation' | 'category' | 'product';
  target_url?: string;
  status?: 'queued' | 'running' | 'completed' | 'failed';
  attempts?: number;
  max_attempts?: number;
  last_error?: string | null;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
}

// Error handling wrapper
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Wrap database operations with error handling
 */
async function withErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new DatabaseError(
      `${operation} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      operation,
      error
    );
  }
}

// Navigation operations
export const navigationOps = {
  /**
   * Get all navigation items with hierarchical structure
   */
  async getAll(client?: SupabaseClientType): Promise<NavigationRow[]> {
    return withErrorHandling('Get navigation', async () => {
      const db = client || getDatabase();
      const { data, error } = await db
        .from('navigation')
        .select('*')
        .order('title');

      if (error) throw error;
      return data || [];
    });
  },

  /**
   * Get navigation hierarchy starting from root
   */
  async getHierarchy(client?: SupabaseClientType): Promise<(NavigationRow & { children?: NavigationRow[] })[]> {
    return withErrorHandling('Get navigation hierarchy', async () => {
      const allItems = await navigationOps.getAll(client);
      
      // Build hierarchy
      const itemMap = new Map<string, NavigationRow & { children?: NavigationRow[] }>();
      const rootItems: (NavigationRow & { children?: NavigationRow[] })[] = [];

      // Initialize all items
      allItems.forEach(item => {
        itemMap.set(item.id, { ...item, children: [] });
      });

      // Build parent-child relationships
      allItems.forEach(item => {
        const itemWithChildren = itemMap.get(item.id)!;
        if (item.parent_id) {
          const parent = itemMap.get(item.parent_id);
          if (parent) {
            parent.children!.push(itemWithChildren);
          }
        } else {
          rootItems.push(itemWithChildren);
        }
      });

      return rootItems;
    });
  },

  /**
   * Upsert navigation item
   */
  async upsert(item: NavigationInsert, client?: SupabaseClientType): Promise<NavigationRow> {
    return withErrorHandling('Upsert navigation', async () => {
      const db = client || getDatabase();
      const { data, error } = await db
        .from('navigation')
        .upsert(item, { onConflict: 'source_url' })
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  },

  /**
   * Update last scraped timestamp
   */
  async updateLastScraped(id: string, client?: SupabaseClientType): Promise<void> {
    return withErrorHandling('Update navigation last scraped', async () => {
      const db = client || getDatabase();
      const { error } = await db
        .from('navigation')
        .update({ last_scraped_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    });
  },
};

// Category operations
export const categoryOps = {
  /**
   * Get categories by navigation ID
   */
  async getByNavigation(navigationId: string, client?: SupabaseClientType): Promise<CategoryRow[]> {
    return withErrorHandling('Get categories by navigation', async () => {
      const db = client || getDatabase();
      const { data, error } = await db
        .from('category')
        .select('*')
        .eq('navigation_id', navigationId)
        .order('title');

      if (error) throw error;
      return data || [];
    });
  },

  /**
   * Get paginated categories
   */
  async getPaginated(
    options: {
      navigationId?: string;
      limit?: number;
      offset?: number;
    } = {},
    client?: SupabaseClientType
  ): Promise<{ data: CategoryRow[]; total: number }> {
    return withErrorHandling('Get paginated categories', async () => {
      const db = client || getDatabase();
      const { limit = 20, offset = 0, navigationId } = options;

      let query = db.from('category').select('*', { count: 'exact' });
      
      if (navigationId) {
        query = query.eq('navigation_id', navigationId);
      }

      const { data, error, count } = await query
        .order('title')
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { data: data || [], total: count || 0 };
    });
  },

  /**
   * Upsert category
   */
  async upsert(category: CategoryInsert, client?: SupabaseClientType): Promise<CategoryRow> {
    return withErrorHandling('Upsert category', async () => {
      const db = client || getDatabase();
      const { data, error } = await db
        .from('category')
        .upsert(category, { onConflict: 'source_url' })
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  },

  /**
   * Update product count for category
   */
  async updateProductCount(id: string, count: number, client?: SupabaseClientType): Promise<void> {
    return withErrorHandling('Update category product count', async () => {
      const db = client || getDatabase();
      const { error } = await db
        .from('category')
        .update({ product_count: count })
        .eq('id', id);

      if (error) throw error;
    });
  },
};

// Product operations
export const productOps = {
  /**
   * Get products by category with pagination and sorting
   */
  async getByCategory(
    categoryId: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'title' | 'price' | 'created_at';
      sortOrder?: 'asc' | 'desc';
      availableOnly?: boolean;
    } = {},
    client?: SupabaseClientType
  ): Promise<{ data: ProductRow[]; total: number }> {
    return withErrorHandling('Get products by category', async () => {
      const db = client || getDatabase();
      const { 
        limit = 20, 
        offset = 0, 
        sortBy = 'title', 
        sortOrder = 'asc',
        availableOnly = true 
      } = options;

      let query = db
        .from('product')
        .select('*', { count: 'exact' })
        .eq('category_id', categoryId);

      if (availableOnly) {
        query = query.eq('available', true);
      }

      const { data, error, count } = await query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { data: data || [], total: count || 0 };
    });
  },

  /**
   * Get product by ID
   */
  async getById(id: string, client?: SupabaseClientType): Promise<ProductRow | null> {
    return withErrorHandling('Get product by ID', async () => {
      const db = client || getDatabase();
      const { data, error } = await db
        .from('product')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data;
    });
  },

  /**
   * Get product by source URL
   */
  async getBySourceUrl(sourceUrl: string, client?: SupabaseClientType): Promise<ProductRow | null> {
    return withErrorHandling('Get product by source URL', async () => {
      const db = client || getDatabase();
      const { data, error } = await db
        .from('product')
        .select('*')
        .eq('source_url', sourceUrl)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data;
    });
  },

  /**
   * Upsert product with conflict resolution
   */
  async upsert(product: ProductInsert, client?: SupabaseClientType): Promise<ProductRow> {
    return withErrorHandling('Upsert product', async () => {
      const db = client || getDatabase();
      const { data, error } = await db
        .from('product')
        .upsert(product, { onConflict: 'source_url' })
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  },

  /**
   * Update product availability
   */
  async updateAvailability(id: string, available: boolean, client?: SupabaseClientType): Promise<void> {
    return withErrorHandling('Update product availability', async () => {
      const db = client || getDatabase();
      const { error } = await db
        .from('product')
        .update({ available })
        .eq('id', id);

      if (error) throw error;
    });
  },

  /**
   * Search products by title
   */
  async search(
    query: string,
    options: {
      limit?: number;
      offset?: number;
      categoryId?: string;
    } = {},
    client?: SupabaseClientType
  ): Promise<{ data: ProductRow[]; total: number }> {
    return withErrorHandling('Search products', async () => {
      const db = client || getDatabase();
      const { limit = 20, offset = 0, categoryId } = options;

      let dbQuery = db
        .from('product')
        .select('*', { count: 'exact' })
        .ilike('title', `%${query}%`)
        .eq('available', true);

      if (categoryId) {
        dbQuery = dbQuery.eq('category_id', categoryId);
      }

      const { data, error, count } = await dbQuery
        .order('title')
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { data: data || [], total: count || 0 };
    });
  },
};

// Scrape job operations
export const scrapeJobOps = {
  /**
   * Create new scrape job
   */
  async create(job: ScrapeJobInsert, client?: SupabaseClientType): Promise<ScrapeJobRow> {
    return withErrorHandling('Create scrape job', async () => {
      const db = client || getDatabase();
      const { data, error } = await db
        .from('scrape_job')
        .insert(job)
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  },

  /**
   * Get jobs by status
   */
  async getByStatus(
    status: ScrapeJobRow['status'],
    limit = 50,
    client?: SupabaseClientType
  ): Promise<ScrapeJobRow[]> {
    return withErrorHandling('Get jobs by status', async () => {
      const db = client || getDatabase();
      const { data, error } = await db
        .from('scrape_job')
        .select('*')
        .eq('status', status)
        .order('created_at')
        .limit(limit);

      if (error) throw error;
      return data || [];
    });
  },

  /**
   * Update job status
   */
  async updateStatus(
    id: string,
    status: ScrapeJobRow['status'],
    error?: string,
    client?: SupabaseClientType
  ): Promise<void> {
    return withErrorHandling('Update job status', async () => {
      const db = client || getDatabase();
      const updateData: ScrapeJobUpdate = { status };
      
      if (error) {
        updateData.last_error = error;
      }

      const { error: dbError } = await db
        .from('scrape_job')
        .update(updateData)
        .eq('id', id);

      if (dbError) throw dbError;
    });
  },

  /**
   * Increment job attempts
   */
  async incrementAttempts(id: string, client?: SupabaseClientType): Promise<ScrapeJobRow> {
    return withErrorHandling('Increment job attempts', async () => {
      const db = client || getDatabase();
      
      // First get current attempts
      const { data: currentJob, error: fetchError } = await db
        .from('scrape_job')
        .select('attempts')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Then update with incremented value
      const { data, error } = await db
        .from('scrape_job')
        .update({ attempts: (currentJob.attempts || 0) + 1 })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  },

  /**
   * Get failed jobs that can be retried
   */
  async getRetryableJobs(client?: SupabaseClientType): Promise<ScrapeJobRow[]> {
    return withErrorHandling('Get retryable jobs', async () => {
      const db = client || getDatabase();
      
      // Use a filter to compare attempts < max_attempts
      const { data, error } = await db
        .from('scrape_job')
        .select('*')
        .eq('status', 'failed')
        .filter('attempts', 'lt', 'max_attempts')
        .order('created_at');

      if (error) throw error;
      return data || [];
    });
  },
};