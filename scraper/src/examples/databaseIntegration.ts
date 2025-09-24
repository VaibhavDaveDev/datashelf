/**
 * Example demonstrating database integration for the scraper service
 * This shows how to use the DatabaseService for typical scraping workflows
 */

import { databaseService } from '../services/database.js';
import type { NavigationInsert, CategoryInsert, ProductInsert } from '../services/database.js';

/**
 * Example: Complete scraping workflow
 */
async function exampleScrapingWorkflow() {
  console.log('🚀 Starting example scraping workflow...');

  try {
    // Test database connection
    const isConnected = await databaseService.testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connection successful');

    // Step 1: Create a scrape job
    const job = await databaseService.createScrapeJob(
      'navigation',
      'https://www.worldofbooks.com/en-gb/sitemap',
      { example: true, priority: 'high' }
    );
    console.log('📝 Created scrape job:', job.id);

    // Step 2: Mark job as running
    await databaseService.markJobAsRunning(job.id);
    console.log('🏃 Job marked as running');

    // Step 3: Insert navigation data
    const navigationData: NavigationInsert[] = [
      {
        title: 'Fiction Books',
        source_url: 'https://www.worldofbooks.com/en-gb/category/fiction',
      },
      {
        title: 'Non-Fiction Books',
        source_url: 'https://www.worldofbooks.com/en-gb/category/non-fiction',
      },
    ];

    const insertedNavigation = await databaseService.upsertNavigations(navigationData);
    console.log(`📚 Inserted ${insertedNavigation.length} navigation items`);

    // Step 4: Insert category data
    const categoryData: CategoryInsert[] = [
      {
        title: 'Science Fiction',
        source_url: 'https://www.worldofbooks.com/en-gb/category/fiction/sci-fi',
        product_count: 0,
        navigation_id: insertedNavigation[0]?.id,
      },
      {
        title: 'Biography',
        source_url: 'https://www.worldofbooks.com/en-gb/category/non-fiction/biography',
        product_count: 0,
        navigation_id: insertedNavigation[1]?.id,
      },
    ];

    const insertedCategories = await databaseService.upsertCategories(categoryData);
    console.log(`🏷️ Inserted ${insertedCategories.length} categories`);

    // Step 5: Insert product data
    const productData: ProductInsert[] = [
      {
        title: 'Dune',
        source_url: 'https://www.worldofbooks.com/en-gb/books/frank-herbert/dune/9780441172719',
        source_id: '9780441172719',
        price: 8.99,
        currency: 'GBP',
        image_urls: ['https://datashelf-images.r2.dev/dune-cover.jpg'],
        summary: 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides...',
        specs: {
          author: 'Frank Herbert',
          isbn: '9780441172719',
          publisher: 'Ace Books',
          pages: 688,
          language: 'English',
          format: 'Paperback',
        },
        available: true,
        category_id: insertedCategories[0]?.id,
      },
      {
        title: 'Steve Jobs',
        source_url: 'https://www.worldofbooks.com/en-gb/books/walter-isaacson/steve-jobs/9781451648539',
        source_id: '9781451648539',
        price: 12.99,
        currency: 'GBP',
        image_urls: ['https://datashelf-images.r2.dev/steve-jobs-cover.jpg'],
        summary: 'Based on more than forty interviews with Jobs conducted over two years...',
        specs: {
          author: 'Walter Isaacson',
          isbn: '9781451648539',
          publisher: 'Simon & Schuster',
          pages: 656,
          language: 'English',
          format: 'Paperback',
        },
        available: true,
        category_id: insertedCategories[1]?.id,
      },
    ];

    const insertedProductsCount = await databaseService.upsertProducts(productData);
    console.log(`📖 Inserted ${insertedProductsCount} products`);

    // Step 6: Update category product counts
    await databaseService.updateCategoryProductCounts();
    console.log('🔄 Updated category product counts');

    // Step 7: Mark job as completed
    await databaseService.markJobAsCompleted(job.id, {
      navigation_count: insertedNavigation.length,
      categories_count: insertedCategories.length,
      products_count: insertedProductsCount,
      duration_ms: Date.now() - new Date(job.created_at).getTime(),
    });
    console.log('✅ Job marked as completed');

    // Step 8: Get database statistics
    const stats = await databaseService.getDatabaseStats();
    console.log('📊 Database statistics:', stats);

    return {
      job,
      navigation: insertedNavigation,
      categories: insertedCategories,
      products: insertedProductsCount,
      stats,
    };

  } catch (error) {
    console.error('❌ Error in scraping workflow:', error);
    throw error;
  }
}

/**
 * Example: Using the transaction-like upsert method
 */
async function exampleTransactionUpsert() {
  console.log('🔄 Starting transaction upsert example...');

  try {
    // Create a job first
    const job = await databaseService.createScrapeJob(
      'category',
      'https://www.worldofbooks.com/en-gb/category/fiction'
    );

    // Use the transaction-like upsert method
    const result = await databaseService.upsertScrapingResult({
      navigation: [
        {
          title: 'Children\'s Books',
          source_url: 'https://www.worldofbooks.com/en-gb/category/childrens',
        },
      ],
      categories: [
        {
          title: 'Picture Books',
          source_url: 'https://www.worldofbooks.com/en-gb/category/childrens/picture-books',
          product_count: 0,
        },
      ],
      products: [
        {
          title: 'The Very Hungry Caterpillar',
          source_url: 'https://www.worldofbooks.com/en-gb/books/eric-carle/very-hungry-caterpillar/9780241003008',
          source_id: '9780241003008',
          price: 6.99,
          currency: 'GBP',
          image_urls: ['https://datashelf-images.r2.dev/caterpillar-cover.jpg'],
          summary: 'A classic children\'s book about a caterpillar\'s journey...',
          specs: {
            author: 'Eric Carle',
            isbn: '9780241003008',
            publisher: 'Puffin',
            pages: 32,
            language: 'English',
            format: 'Board book',
          },
          available: true,
        },
      ],
      jobId: job.id,
    });

    console.log('✅ Transaction upsert completed:', {
      navigation: result.navigation.length,
      categories: result.categories.length,
      products: result.products.length,
    });

    return result;

  } catch (error) {
    console.error('❌ Error in transaction upsert:', error);
    throw error;
  }
}

/**
 * Example: Querying data
 */
async function exampleDataQueries() {
  console.log('🔍 Starting data query examples...');

  try {
    // Get navigation hierarchy
    const navigation = await databaseService.getNavigationHierarchy();
    console.log(`📚 Found ${navigation.length} navigation items`);

    if (navigation.length > 0 && navigation[0]) {
      // Get categories for the first navigation item
      const categories = await databaseService.getCategoriesByNavigation(navigation[0].id);
      console.log(`🏷️ Found ${categories.length} categories for navigation: ${navigation[0].title}`);

      if (categories.length > 0 && categories[0]) {
        // Get products for the first category
        const { products, total } = await databaseService.getProductsByCategory(categories[0].id, 5, 0);
        console.log(`📖 Found ${products.length} of ${total} products for category: ${categories[0].title}`);

        // Show product details
        products.forEach(product => {
          console.log(`  - ${product.title} (${product.price} ${product.currency})`);
        });
      }
    }

    // Get job statistics
    const queuedJobs = await databaseService.getScrapeJobsByStatus('queued', 10);
    const runningJobs = await databaseService.getScrapeJobsByStatus('running', 10);
    const completedJobs = await databaseService.getScrapeJobsByStatus('completed', 10);
    const failedJobs = await databaseService.getScrapeJobsByStatus('failed', 10);

    console.log('📊 Job statistics:', {
      queued: queuedJobs.length,
      running: runningJobs.length,
      completed: completedJobs.length,
      failed: failedJobs.length,
    });

    // Get retryable jobs
    const retryableJobs = await databaseService.getRetryableJobs(5);
    console.log(`🔄 Found ${retryableJobs.length} retryable jobs`);

    return {
      navigation,
      categories: navigation.length > 0 && navigation[0] ? await databaseService.getCategoriesByNavigation(navigation[0].id) : [],
      jobStats: {
        queued: queuedJobs.length,
        running: runningJobs.length,
        completed: completedJobs.length,
        failed: failedJobs.length,
        retryable: retryableJobs.length,
      },
    };

  } catch (error) {
    console.error('❌ Error in data queries:', error);
    throw error;
  }
}

/**
 * Example: Error handling and validation
 */
async function exampleErrorHandling() {
  console.log('⚠️ Starting error handling examples...');

  try {
    // Example 1: Invalid product data
    try {
      await databaseService.upsertProduct({
        title: '', // Invalid: empty title
        source_url: 'not-a-url', // Invalid: not a URL
        price: -10, // Invalid: negative price
      } as any);
    } catch (error) {
      console.log('✅ Caught validation error for invalid product:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Example 2: Invalid navigation data
    try {
      await databaseService.upsertNavigation({
        title: 'Valid Title',
        source_url: 'https://example.com/valid',
        parent_id: 'not-a-uuid', // Invalid: not a UUID
      } as any);
    } catch (error) {
      console.log('✅ Caught validation error for invalid navigation:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Example 3: Job failure handling
    const job = await databaseService.createScrapeJob('product', 'https://example.com/test');
    await databaseService.markJobAsFailed(job.id, 'Network timeout after 30 seconds', {
      attempt: 1,
      error_type: 'timeout',
      url: 'https://example.com/test',
    });
    console.log('✅ Successfully marked job as failed with error details');

    console.log('✅ Error handling examples completed');

  } catch (error) {
    console.error('❌ Unexpected error in error handling examples:', error);
    throw error;
  }
}

// Export examples for use in other files
export {
  exampleScrapingWorkflow,
  exampleTransactionUpsert,
  exampleDataQueries,
  exampleErrorHandling,
};

// If running this file directly, run all examples
// Note: This check is disabled for TypeScript compatibility
// if (import.meta.url === `file://${process.argv[1]}`) {
  export async function runAllExamples() {
    console.log('🎯 Running all database integration examples...\n');

    try {
      await exampleScrapingWorkflow();
      console.log('\n' + '='.repeat(50) + '\n');

      await exampleTransactionUpsert();
      console.log('\n' + '='.repeat(50) + '\n');

      await exampleDataQueries();
      console.log('\n' + '='.repeat(50) + '\n');

      await exampleErrorHandling();
      console.log('\n✅ All examples completed successfully!');

    } catch (error) {
      console.error('\n❌ Example execution failed:', error);
      process.exit(1);
    }
  }

  // runAllExamples();
// }