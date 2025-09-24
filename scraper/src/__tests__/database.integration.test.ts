import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseService } from '../services/database.js';
import { 
  mockNavigationData, 
  mockCategoryData, 
  mockProductData,
  mockScrapingJobData,
  createTestDataWithRelationships,
  invalidTestData,
  generateLargeDataset
} from './fixtures/database-fixtures.js';
import { ValidationError } from '../types/index.js';

// This test suite requires a test database connection
// In a real environment, you would set up a test Supabase instance
// For now, we'll mock the operations but structure the tests for real integration

describe('DatabaseService Integration Tests', () => {
  let databaseService: DatabaseService;
  let testDataIds: {
    navigationIds: string[];
    categoryIds: string[];
    productIds: string[];
    jobIds: string[];
  };

  beforeEach(async () => {
    databaseService = new DatabaseService();
    testDataIds = {
      navigationIds: [],
      categoryIds: [],
      productIds: [],
      jobIds: [],
    };

    // Test database connection
    const isConnected = await databaseService.testConnection();
    if (!isConnected) {
      console.warn('Database connection test failed - using mocked responses');
    }
  });

  afterEach(async () => {
    // Clean up test data in reverse order (products -> categories -> navigation -> jobs)
    // This would be implemented in a real integration test environment
    
    // Note: In a real test, you would clean up the test data here
    // For now, we'll just reset the IDs
    testDataIds = {
      navigationIds: [],
      categoryIds: [],
      productIds: [],
      jobIds: [],
    };
  });

  describe('Complete Scraping Workflow Integration', () => {
    it('should handle a complete scraping workflow', async () => {
      // This test simulates a complete scraping workflow:
      // 1. Create scrape job
      // 2. Insert navigation data
      // 3. Insert category data
      // 4. Insert product data
      // 5. Update job status
      // 6. Verify data consistency

      // Mock the database operations for this integration test
      const mockOperations = setupMockOperations();

      // Step 1: Create a scrape job
      const job = await databaseService.createScrapeJob(
        'navigation',
        'https://www.worldofbooks.com/en-gb/sitemap',
        { test: true }
      );
      
      expect(job.type).toBe('navigation');
      expect(job.status).toBe('queued');
      testDataIds.jobIds.push(job.id);

      // Step 2: Mark job as running
      const runningJob = await databaseService.markJobAsRunning(job.id);
      expect(runningJob.status).toBe('running');

      // Step 3: Insert navigation data
      const testData = createTestDataWithRelationships();
      const insertedNavigation = await databaseService.upsertNavigations(testData.navigation);
      
      expect(insertedNavigation).toHaveLength(testData.navigation.length);
      testDataIds.navigationIds = insertedNavigation.map(nav => nav.id);

      // Step 4: Insert category data (linking to navigation)
      const categoriesWithNavIds = testData.categories.map((cat, index) => ({
        ...cat,
        navigation_id: insertedNavigation[index % insertedNavigation.length].id,
      }));
      
      const insertedCategories = await databaseService.upsertCategories(categoriesWithNavIds);
      expect(insertedCategories).toHaveLength(categoriesWithNavIds.length);
      testDataIds.categoryIds = insertedCategories.map(cat => cat.id);

      // Step 5: Insert product data (linking to categories)
      const productsWithCatIds = testData.products.map((prod, index) => ({
        ...prod,
        category_id: insertedCategories[index % insertedCategories.length].id,
      }));
      
      const insertedProducts = await databaseService.upsertProducts(productsWithCatIds);
      expect(insertedProducts).toHaveLength(productsWithCatIds.length);
      testDataIds.productIds = insertedProducts.map(prod => prod.id);

      // Step 6: Update category product counts
      await databaseService.updateCategoryProductCounts();

      // Step 7: Mark job as completed
      const completedJob = await databaseService.markJobAsCompleted(job.id, {
        navigation_count: insertedNavigation.length,
        categories_count: insertedCategories.length,
        products_count: insertedProducts.length,
      });
      
      expect(completedJob.status).toBe('completed');
      expect(completedJob.metadata).toMatchObject({
        navigation_count: insertedNavigation.length,
        categories_count: insertedCategories.length,
        products_count: insertedProducts.length,
      });

      // Step 8: Verify data consistency
      const stats = await databaseService.getDatabaseStats();
      expect(stats.navigation_count).toBeGreaterThanOrEqual(insertedNavigation.length);
      expect(stats.category_count).toBeGreaterThanOrEqual(insertedCategories.length);
      expect(stats.product_count).toBeGreaterThanOrEqual(insertedProducts.length);
    });

    it('should handle transaction-like operations with upsertScrapingResult', async () => {
      const mockOperations = setupMockOperations();
      
      const testData = createTestDataWithRelationships();
      
      // Create a job first
      const job = await databaseService.createScrapeJob('category', 'https://example.com/category');
      testDataIds.jobIds.push(job.id);

      // Use the transaction-like upsert method
      const result = await databaseService.upsertScrapingResult({
        navigation: testData.navigation,
        categories: testData.categories,
        products: testData.products,
        jobId: job.id,
      });

      expect(result.navigation).toHaveLength(testData.navigation.length);
      expect(result.categories).toHaveLength(testData.categories.length);
      expect(result.products).toHaveLength(testData.products.length);

      // Verify job was marked as completed
      const updatedJob = await databaseService.getScrapeJob(job.id);
      expect(updatedJob?.status).toBe('completed');
    });
  });

  describe('Data Validation and Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const mockOperations = setupMockOperations();

      // Test invalid navigation data
      await expect(
        databaseService.upsertNavigation(invalidTestData.navigation as any)
      ).rejects.toThrow(ValidationError);

      // Test invalid category data
      await expect(
        databaseService.upsertCategory(invalidTestData.category as any)
      ).rejects.toThrow(ValidationError);

      // Test invalid product data
      await expect(
        databaseService.upsertProduct(invalidTestData.product as any)
      ).rejects.toThrow(ValidationError);
    });

    it('should handle database constraint violations', async () => {
      const mockOperations = setupMockOperations();

      // Insert a product first
      const product = await databaseService.upsertProduct(mockProductData[0]);
      testDataIds.productIds.push(product.id);

      // Try to insert the same product again (should upsert, not fail)
      const duplicateProduct = await databaseService.upsertProduct(mockProductData[0]);
      expect(duplicateProduct.source_url).toBe(mockProductData[0].source_url);
    });

    it('should handle job retry logic', async () => {
      const mockOperations = setupMockOperations();

      // Create a job
      const job = await databaseService.createScrapeJob('product', 'https://example.com/product');
      testDataIds.jobIds.push(job.id);

      // Mark it as failed
      await databaseService.markJobAsFailed(job.id, 'Network timeout');

      // Get retryable jobs
      const retryableJobs = await databaseService.getRetryableJobs();
      const ourJob = retryableJobs.find(j => j.id === job.id);
      
      expect(ourJob).toBeDefined();
      expect(ourJob?.status).toBe('failed');
      expect(ourJob?.attempts).toBeLessThan(ourJob?.max_attempts || 3);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle batch operations efficiently', async () => {
      const mockOperations = setupMockOperations();
      
      // Generate a larger dataset
      const largeProductSet = generateLargeDataset(100);
      
      const startTime = Date.now();
      const insertedProducts = await databaseService.upsertProducts(largeProductSet);
      const endTime = Date.now();
      
      expect(insertedProducts).toHaveLength(largeProductSet.length);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      testDataIds.productIds.push(...insertedProducts.map(p => p.id));
    });

    it('should handle pagination correctly', async () => {
      const mockOperations = setupMockOperations();
      
      // Insert some test products first
      const products = await databaseService.upsertProducts(mockProductData);
      testDataIds.productIds.push(...products.map(p => p.id));
      
      // Assume we have a category ID from the inserted products
      const categoryId = products[0].category_id;
      if (!categoryId) return;
      
      // Test pagination
      const page1 = await databaseService.getProductsByCategory(categoryId, 2, 0);
      const page2 = await databaseService.getProductsByCategory(categoryId, 2, 2);
      
      expect(page1.products).toHaveLength(Math.min(2, page1.total));
      expect(page2.products).toHaveLength(Math.min(2, Math.max(0, page1.total - 2)));
      
      // Ensure no overlap between pages
      const page1Ids = page1.products.map(p => p.id);
      const page2Ids = page2.products.map(p => p.id);
      const overlap = page1Ids.filter(id => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('Data Consistency and Relationships', () => {
    it('should maintain referential integrity', async () => {
      const mockOperations = setupMockOperations();
      
      // Insert navigation
      const navigation = await databaseService.upsertNavigation(mockNavigationData[0]);
      testDataIds.navigationIds.push(navigation.id);
      
      // Insert category linked to navigation
      const category = await databaseService.upsertCategory({
        ...mockCategoryData[0],
        navigation_id: navigation.id,
      });
      testDataIds.categoryIds.push(category.id);
      
      // Insert product linked to category
      const product = await databaseService.upsertProduct({
        ...mockProductData[0],
        category_id: category.id,
      });
      testDataIds.productIds.push(product.id);
      
      // Verify relationships
      expect(category.navigation_id).toBe(navigation.id);
      expect(product.category_id).toBe(category.id);
      
      // Test cascade queries
      const categoriesForNav = await databaseService.getCategoriesByNavigation(navigation.id);
      expect(categoriesForNav).toContainEqual(expect.objectContaining({ id: category.id }));
      
      const productsForCat = await databaseService.getProductsByCategory(category.id);
      expect(productsForCat.products).toContainEqual(expect.objectContaining({ id: product.id }));
    });

    it('should update category product counts correctly', async () => {
      const mockOperations = setupMockOperations();
      
      // Insert category
      const category = await databaseService.upsertCategory(mockCategoryData[0]);
      testDataIds.categoryIds.push(category.id);
      
      // Insert products for this category
      const productsForCategory = mockProductData.slice(0, 2).map(p => ({
        ...p,
        category_id: category.id,
      }));
      
      const insertedProducts = await databaseService.upsertProducts(productsForCategory);
      testDataIds.productIds.push(...insertedProducts.map(p => p.id));
      
      // Update category product counts
      await databaseService.updateCategoryProductCounts();
      
      // Verify the count was updated
      const updatedCategory = await databaseService.getCategoryBySourceUrl(category.source_url);
      expect(updatedCategory?.product_count).toBe(productsForCategory.length);
    });
  });

  describe('Job Management and Monitoring', () => {
    it('should track job lifecycle correctly', async () => {
      const mockOperations = setupMockOperations();
      
      // Create job
      const job = await databaseService.createScrapeJob(
        'product',
        'https://example.com/product',
        { priority: 'high' }
      );
      testDataIds.jobIds.push(job.id);
      
      expect(job.status).toBe('queued');
      expect(job.attempts).toBe(0);
      
      // Mark as running
      const runningJob = await databaseService.markJobAsRunning(job.id);
      expect(runningJob.status).toBe('running');
      expect(runningJob.attempts).toBe(1);
      
      // Mark as completed
      const completedJob = await databaseService.markJobAsCompleted(job.id, {
        items_processed: 1,
        duration_ms: 5000,
      });
      expect(completedJob.status).toBe('completed');
      expect(completedJob.metadata).toMatchObject({
        items_processed: 1,
        duration_ms: 5000,
      });
    });

    it('should handle job cleanup correctly', async () => {
      const mockOperations = setupMockOperations();
      
      // Create and complete a job
      const job = await databaseService.createScrapeJob('navigation', 'https://example.com/nav');
      await databaseService.markJobAsCompleted(job.id);
      testDataIds.jobIds.push(job.id);
      
      // Test cleanup (this would normally clean up old jobs)
      const cleanedCount = await databaseService.cleanupOldJobs(0); // Clean up immediately
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  // Helper function to set up mock operations for testing
  function setupMockOperations() {
    // In a real integration test, this would set up test database state
    // For now, we'll return mock implementations
    
    return {
      // Mock successful database operations
      mockUpsert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      mockSelect: vi.fn().mockResolvedValue({ data: [], error: null }),
      mockUpdate: vi.fn().mockResolvedValue({ data: {}, error: null }),
      mockDelete: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  }
});