import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/environment.js';
import { ValidationError } from '../types/index.js';
import { z } from 'zod';

// Database types based on the schema
export interface DatabaseNavigation {
  id: string;
  title: string;
  source_url: string;
  parent_id?: string;
  last_scraped_at: string;
}

export interface DatabaseCategory {
  id: string;
  navigation_id?: string;
  title: string;
  source_url: string;
  product_count: number;
  last_scraped_at: string;
}

export interface DatabaseProduct {
  id: string;
  category_id?: string;
  title: string;
  source_url: string;
  source_id?: string;
  price?: number;
  currency?: string;
  image_urls: string[];
  summary?: string;
  specs: Record<string, any>;
  available: boolean;
  last_scraped_at: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseScrapeJob {
  id: string;
  type: 'navigation' | 'category' | 'product';
  target_url: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  last_error?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Validation schemas
const navigationInsertSchema = z.object({
  title: z.string().min(1),
  source_url: z.string().url(),
  parent_id: z.string().uuid().optional(),
});

const categoryInsertSchema = z.object({
  navigation_id: z.string().uuid().optional(),
  title: z.string().min(1),
  source_url: z.string().url(),
  product_count: z.number().int().min(0).default(0),
});

const productInsertSchema = z.object({
  category_id: z.string().uuid().optional(),
  title: z.string().min(1),
  source_url: z.string().url(),
  source_id: z.string().optional(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).default('GBP'),
  image_urls: z.array(z.string().url()).default([]),
  summary: z.string().optional(),
  specs: z.record(z.any()).default({}),
  available: z.boolean().default(true),
});

const scrapeJobUpdateSchema = z.object({
  status: z.enum(['queued', 'running', 'completed', 'failed']).optional(),
  attempts: z.number().int().min(0).optional(),
  last_error: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type NavigationInsert = z.infer<typeof navigationInsertSchema>;
export type CategoryInsert = z.infer<typeof categoryInsertSchema>;
export type ProductInsert = z.infer<typeof productInsertSchema>;
export type ScrapeJobUpdate = z.infer<typeof scrapeJobUpdateSchema>;

/**
 * Database service for Supabase operations
 */
export class DatabaseService {
  private client: SupabaseClient;
  private isInitialized = false;

  constructor() {
    this.client = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  /**
   * Initialize the database service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Test the connection
      const isConnected = await this.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to database');
      }
      
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close database connections (cleanup)
   */
  async close(): Promise<void> {
    // Supabase client doesn't require explicit closing
    this.isInitialized = false;
  }

  /**
   * Health check for the database service
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.testConnection();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the Supabase client instance
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('navigation')
        .select('id')
        .limit(1);
      
      return !error;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Upsert navigation data (batch method for worker)
   */
  async upsertNavigationBatch(navigationData: any): Promise<number> {
    if (Array.isArray(navigationData)) {
      const results = await this.upsertNavigations(navigationData);
      return results.length;
    } else {
      await this.upsertNavigation(navigationData);
      return 1;
    }
  }

  /**
   * Upsert product data with conflict resolution on source_url
   */
  async upsertProduct(productData: ProductInsert): Promise<number> {
    // Validate input data
    const validatedData = productInsertSchema.parse(productData);

    try {
      const { data, error } = await this.client
        .from('product')
        .upsert(
          {
            ...validatedData,
            last_scraped_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'source_url',
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to upsert product: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from product upsert');
      }

      return 1; // Return count for consistency with worker expectations
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          `Product validation failed: ${error.errors.map(e => e.message).join(', ')}`,
          'product',
          productData
        );
      }
      throw error;
    }
  }

  /**
   * Batch upsert multiple products with transaction handling
   */
  async upsertProducts(products: ProductInsert[]): Promise<number> {
    if (products.length === 0) {
      return 0;
    }

    // Validate all products first
    const validatedProducts = products.map(product => {
      try {
        return productInsertSchema.parse(product);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError(
            `Product validation failed: ${error.errors.map(e => e.message).join(', ')}`,
            'product',
            product
          );
        }
        throw error;
      }
    });

    const timestamp = new Date().toISOString();
    const productsWithTimestamps = validatedProducts.map(product => ({
      ...product,
      last_scraped_at: timestamp,
      updated_at: timestamp,
    }));

    try {
      const { data, error } = await this.client
        .from('product')
        .upsert(productsWithTimestamps, {
          onConflict: 'source_url',
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        throw new Error(`Failed to batch upsert products: ${error.message}`);
      }

      return (data || []).length; // Return count for consistency with worker expectations
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get product by source URL
   */
  async getProductBySourceUrl(sourceUrl: string): Promise<DatabaseProduct | null> {
    try {
      const { data, error } = await this.client
        .from('product')
        .select('*')
        .eq('source_url', sourceUrl)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw new Error(`Failed to get product: ${error.message}`);
      }

      return data as DatabaseProduct | null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get products by category ID with pagination
   */
  async getProductsByCategory(
    categoryId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ products: DatabaseProduct[]; total: number }> {
    try {
      const [productsResult, countResult] = await Promise.all([
        this.client
          .from('product')
          .select('*')
          .eq('category_id', categoryId)
          .range(offset, offset + limit - 1)
          .order('updated_at', { ascending: false }),
        this.client
          .from('product')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', categoryId),
      ]);

      if (productsResult.error) {
        throw new Error(`Failed to get products: ${productsResult.error.message}`);
      }

      if (countResult.error) {
        throw new Error(`Failed to get product count: ${countResult.error.message}`);
      }

      return {
        products: (productsResult.data || []) as DatabaseProduct[],
        total: countResult.count || 0,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Insert or update navigation data
   */
  async upsertNavigation(navigationData: NavigationInsert): Promise<DatabaseNavigation> {
    // Validate input data
    const validatedData = navigationInsertSchema.parse(navigationData);

    try {
      const { data, error } = await this.client
        .from('navigation')
        .upsert(
          {
            ...validatedData,
            last_scraped_at: new Date().toISOString(),
          },
          {
            onConflict: 'source_url',
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to upsert navigation: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from navigation upsert');
      }

      return data as DatabaseNavigation;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          `Navigation validation failed: ${error.errors.map(e => e.message).join(', ')}`,
          'navigation',
          navigationData
        );
      }
      throw error;
    }
  }

  /**
   * Batch insert navigation items
   */
  async upsertNavigations(navigations: NavigationInsert[]): Promise<DatabaseNavigation[]> {
    if (navigations.length === 0) {
      return [];
    }

    // Validate all navigations first
    const validatedNavigations = navigations.map(nav => {
      try {
        return navigationInsertSchema.parse(nav);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError(
            `Navigation validation failed: ${error.errors.map(e => e.message).join(', ')}`,
            'navigation',
            nav
          );
        }
        throw error;
      }
    });

    const timestamp = new Date().toISOString();
    const navigationsWithTimestamps = validatedNavigations.map(nav => ({
      ...nav,
      last_scraped_at: timestamp,
    }));

    try {
      const { data, error } = await this.client
        .from('navigation')
        .upsert(navigationsWithTimestamps, {
          onConflict: 'source_url',
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        throw new Error(`Failed to batch upsert navigations: ${error.message}`);
      }

      return (data || []) as DatabaseNavigation[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get navigation by source URL
   */
  async getNavigationBySourceUrl(sourceUrl: string): Promise<DatabaseNavigation | null> {
    try {
      const { data, error } = await this.client
        .from('navigation')
        .select('*')
        .eq('source_url', sourceUrl)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw new Error(`Failed to get navigation: ${error.message}`);
      }

      return data as DatabaseNavigation | null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get navigation hierarchy (parent-child relationships)
   */
  async getNavigationHierarchy(): Promise<DatabaseNavigation[]> {
    try {
      const { data, error } = await this.client
        .from('navigation')
        .select('*')
        .order('title');

      if (error) {
        throw new Error(`Failed to get navigation hierarchy: ${error.message}`);
      }

      return (data || []) as DatabaseNavigation[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Insert or update category data
   */
  async upsertCategory(categoryData: CategoryInsert): Promise<DatabaseCategory> {
    // Validate input data
    const validatedData = categoryInsertSchema.parse(categoryData);

    try {
      const { data, error } = await this.client
        .from('category')
        .upsert(
          {
            ...validatedData,
            last_scraped_at: new Date().toISOString(),
          },
          {
            onConflict: 'source_url',
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to upsert category: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from category upsert');
      }

      return data as DatabaseCategory;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          `Category validation failed: ${error.errors.map(e => e.message).join(', ')}`,
          'category',
          categoryData
        );
      }
      throw error;
    }
  }

  /**
   * Batch insert categories
   */
  async upsertCategories(categories: CategoryInsert[]): Promise<DatabaseCategory[]> {
    if (categories.length === 0) {
      return [];
    }

    // Validate all categories first
    const validatedCategories = categories.map(cat => {
      try {
        return categoryInsertSchema.parse(cat);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError(
            `Category validation failed: ${error.errors.map(e => e.message).join(', ')}`,
            'category',
            cat
          );
        }
        throw error;
      }
    });

    const timestamp = new Date().toISOString();
    const categoriesWithTimestamps = validatedCategories.map(cat => ({
      ...cat,
      last_scraped_at: timestamp,
    }));

    try {
      const { data, error } = await this.client
        .from('category')
        .upsert(categoriesWithTimestamps, {
          onConflict: 'source_url',
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        throw new Error(`Failed to batch upsert categories: ${error.message}`);
      }

      return (data || []) as DatabaseCategory[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get category by source URL
   */
  async getCategoryBySourceUrl(sourceUrl: string): Promise<DatabaseCategory | null> {
    try {
      const { data, error } = await this.client
        .from('category')
        .select('*')
        .eq('source_url', sourceUrl)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw new Error(`Failed to get category: ${error.message}`);
      }

      return data as DatabaseCategory | null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get categories by navigation ID
   */
  async getCategoriesByNavigation(navigationId: string): Promise<DatabaseCategory[]> {
    try {
      const { data, error } = await this.client
        .from('category')
        .select('*')
        .eq('navigation_id', navigationId)
        .order('title');

      if (error) {
        throw new Error(`Failed to get categories: ${error.message}`);
      }

      return (data || []) as DatabaseCategory[];
    } catch (error) {
      throw error;
    }
  } 
 /**
   * Create a new scrape job
   */
  async createScrapeJob(
    type: 'navigation' | 'category' | 'product',
    targetUrl: string,
    metadata: Record<string, any> = {},
    maxAttempts: number = 3
  ): Promise<DatabaseScrapeJob> {
    try {
      const { data, error } = await this.client
        .from('scrape_job')
        .insert({
          type,
          target_url: targetUrl,
          status: 'queued',
          attempts: 0,
          max_attempts: maxAttempts,
          metadata,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create scrape job: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from scrape job creation');
      }

      return data as DatabaseScrapeJob;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update scrape job status and metadata
   */
  async updateScrapeJob(jobId: string, updates: ScrapeJobUpdate): Promise<DatabaseScrapeJob> {
    // Validate input data
    const validatedUpdates = scrapeJobUpdateSchema.parse(updates);

    try {
      const { data, error } = await this.client
        .from('scrape_job')
        .update({
          ...validatedUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update scrape job: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from scrape job update');
      }

      return data as DatabaseScrapeJob;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          `Scrape job update validation failed: ${error.errors.map(e => e.message).join(', ')}`,
          'scrape_job',
          updates
        );
      }
      throw error;
    }
  }

  /**
   * Mark scrape job as running
   */
  async markJobAsRunning(jobId: string): Promise<DatabaseScrapeJob> {
    return this.updateScrapeJob(jobId, {
      status: 'running',
      attempts: await this.incrementJobAttempts(jobId),
    });
  }

  /**
   * Mark scrape job as completed
   */
  async markJobAsCompleted(jobId: string, metadata?: Record<string, any>): Promise<DatabaseScrapeJob> {
    const updates: ScrapeJobUpdate = { status: 'completed' };
    if (metadata) {
      updates.metadata = metadata;
    }
    return this.updateScrapeJob(jobId, updates);
  }

  /**
   * Mark scrape job as failed
   */
  async markJobAsFailed(jobId: string, error: string, metadata?: Record<string, any>): Promise<DatabaseScrapeJob> {
    const updates: ScrapeJobUpdate = {
      status: 'failed',
      last_error: error,
    };
    if (metadata) {
      updates.metadata = metadata;
    }
    return this.updateScrapeJob(jobId, updates);
  }

  /**
   * Increment job attempts counter
   */
  private async incrementJobAttempts(jobId: string): Promise<number> {
    try {
      const { data, error } = await this.client
        .from('scrape_job')
        .select('attempts')
        .eq('id', jobId)
        .single();

      if (error) {
        throw new Error(`Failed to get job attempts: ${error.message}`);
      }

      return (data?.attempts || 0) + 1;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get scrape job by ID
   */
  async getScrapeJob(jobId: string): Promise<DatabaseScrapeJob | null> {
    try {
      const { data, error } = await this.client
        .from('scrape_job')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw new Error(`Failed to get scrape job: ${error.message}`);
      }

      return data as DatabaseScrapeJob | null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get scrape jobs by status
   */
  async getScrapeJobsByStatus(
    status: 'queued' | 'running' | 'completed' | 'failed',
    limit: number = 50
  ): Promise<DatabaseScrapeJob[]> {
    try {
      const { data, error } = await this.client
        .from('scrape_job')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get scrape jobs: ${error.message}`);
      }

      return (data || []) as DatabaseScrapeJob[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get failed jobs that can be retried using the get_retryable_jobs database function
   */
  async getRetryableJobs(limit: number = 20): Promise<DatabaseScrapeJob[]> {
    try {
      interface RetryableJob {
        id: string;
        type: 'navigation' | 'category' | 'product';
        target_url: string;
        metadata: Record<string, any>;
        attempts: number;
        max_attempts: number;
      }

      const { data, error } = await this.client
        .rpc('get_retryable_jobs', { limit_count: limit });

      if (error) {
        throw new Error(`Failed to get retryable jobs: ${error.message}`);
      }

      // Map the results to include all DatabaseScrapeJob fields
      return (data || []).map((job: RetryableJob) => ({
        ...job,
        status: 'failed' as const,
        last_error: null,
        locked_at: null,
        locked_by: null,
        priority: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })) as DatabaseScrapeJob[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      const { data, error } = await this.client
        .from('scrape_job')
        .delete()
        .eq('status', 'completed')
        .lt('updated_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw new Error(`Failed to cleanup old jobs: ${error.message}`);
      }

      return (data || []).length;
    } catch (error) {
      throw error;
    }
  }  /**

   * Execute multiple operations in a transaction-like manner
   * Note: Supabase doesn't support explicit transactions in the client,
   * but we can implement atomic operations and rollback logic
   */
  async executeTransaction<T>(
    operations: Array<() => Promise<any>>,
    rollbackOperations?: Array<() => Promise<any>>
  ): Promise<T[]> {
    const results: any[] = [];
    const completedOperations: number[] = [];

    try {
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        if (operation) {
          const result = await operation();
          results.push(result);
          completedOperations.push(i);
        }
      }

      return results;
    } catch (error) {
      // If rollback operations are provided, execute them in reverse order
      if (rollbackOperations && rollbackOperations.length > 0) {
        for (let i = completedOperations.length - 1; i >= 0; i--) {
          const rollbackIndex = completedOperations[i];
          if (rollbackIndex !== undefined && rollbackOperations[rollbackIndex]) {
            try {
              const rollbackOperation = rollbackOperations[rollbackIndex];
              if (rollbackOperation) {
                await rollbackOperation();
              }
            } catch (rollbackError) {
              console.error(`Rollback operation ${rollbackIndex} failed:`, rollbackError);
            }
          }
        }
      }

      throw error;
    }
  }

  /**
   * Upsert complete scraping result (navigation, categories, and products)
   * This is a complex operation that should be atomic
   */
  async upsertScrapingResult(result: {
    navigation?: NavigationInsert[];
    categories?: CategoryInsert[];
    products?: ProductInsert[];
    jobId?: string;
  }): Promise<{
    navigation: DatabaseNavigation[];
    categories: DatabaseCategory[];
    products: DatabaseProduct[];
  }> {
    const operations: Array<() => Promise<any>> = [];
    const results: any = {
      navigation: [],
      categories: [],
      products: [],
    };

    // Add navigation operations
    if (result.navigation && result.navigation.length > 0) {
      operations.push(async () => {
        const navResults = await this.upsertNavigations(result.navigation!);
        results.navigation = navResults;
        return navResults;
      });
    }

    // Add category operations
    if (result.categories && result.categories.length > 0) {
      operations.push(async () => {
        const catResults = await this.upsertCategories(result.categories!);
        results.categories = catResults;
        return catResults;
      });
    }

    // Add product operations
    if (result.products && result.products.length > 0) {
      operations.push(async () => {
        const prodResults = await this.upsertProducts(result.products!);
        results.products = prodResults;
        return prodResults;
      });
    }

    // Add job completion operation if jobId is provided
    if (result.jobId) {
      operations.push(async () => {
        return this.markJobAsCompleted(result.jobId!, {
          navigation_count: results.navigation.length,
          categories_count: results.categories.length,
          products_count: results.products.length,
        });
      });
    }

    try {
      await this.executeTransaction(operations);
      return results;
    } catch (error) {
      // If jobId is provided, mark the job as failed
      if (result.jobId) {
        try {
          await this.markJobAsFailed(
            result.jobId,
            error instanceof Error ? error.message : 'Unknown error during scraping result upsert'
          );
        } catch (jobUpdateError) {
          console.error('Failed to mark job as failed:', jobUpdateError);
        }
      }
      throw error;
    }
  }

  /**
   * Update category product counts based on actual product data
   * This ensures data consistency between categories and products
   */
  async updateCategoryProductCounts(): Promise<void> {
    try {
      // Get product counts per category
      const { data: productCounts, error: countError } = await this.client
        .from('product')
        .select('category_id')
        .not('category_id', 'is', null);

      if (countError) {
        throw new Error(`Failed to get product counts: ${countError.message}`);
      }

      // Count products per category
      const categoryCountMap = new Map<string, number>();
      (productCounts || []).forEach(product => {
        if (product.category_id) {
          const currentCount = categoryCountMap.get(product.category_id) || 0;
          categoryCountMap.set(product.category_id, currentCount + 1);
        }
      });

      // Update each category's product count
      const updatePromises = Array.from(categoryCountMap.entries()).map(
        ([categoryId, count]) =>
          this.client
            .from('category')
            .update({ product_count: count })
            .eq('id', categoryId)
      );

      // Also reset categories with no products to 0
      const { error: resetError } = await this.client
        .from('category')
        .update({ product_count: 0 })
        .not('id', 'in', `(${Array.from(categoryCountMap.keys()).join(',')})`);

      if (resetError) {
        console.warn('Failed to reset empty category counts:', resetError);
      }

      await Promise.all(updatePromises);
    } catch (error) {
      throw new Error(`Failed to update category product counts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    navigation_count: number;
    category_count: number;
    product_count: number;
    job_counts: Record<string, number>;
  }> {
    try {
      const [navResult, catResult, prodResult, jobResult] = await Promise.all([
        this.client.from('navigation').select('*', { count: 'exact', head: true }),
        this.client.from('category').select('*', { count: 'exact', head: true }),
        this.client.from('product').select('*', { count: 'exact', head: true }),
        this.client.from('scrape_job').select('status'),
      ]);

      if (navResult.error) throw new Error(`Navigation count error: ${navResult.error.message}`);
      if (catResult.error) throw new Error(`Category count error: ${catResult.error.message}`);
      if (prodResult.error) throw new Error(`Product count error: ${prodResult.error.message}`);
      if (jobResult.error) throw new Error(`Job count error: ${jobResult.error.message}`);

      // Count jobs by status
      const jobCounts: Record<string, number> = {};
      (jobResult.data || []).forEach(job => {
        jobCounts[job.status] = (jobCounts[job.status] || 0) + 1;
      });

      return {
        navigation_count: navResult.count || 0,
        category_count: catResult.count || 0,
        product_count: prodResult.count || 0,
        job_counts: jobCounts,
      };
    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();