import { ScraperCrawler } from './crawler';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import {
    ScrapedNavigation,
    ScrapedCategory,
    ScrapedProduct,
    ScrapingError
} from '../types';
import {
    extractNavigation,
    extractCategories,
    extractProductListings,
    extractProductDetails,
    hasNextPage,
    resolveUrl
} from '../utils/extractors';

/**
 * Navigation scraper - extracts main category structure from World of Books
 */
export class NavigationScraper {
    private crawler: ScraperCrawler;

    constructor() {
        this.crawler = new ScraperCrawler({
            maxRequestsPerCrawl: 10,
            maxConcurrency: 1,
            requestDelay: config.WOB_RATE_LIMIT_DELAY
        });
    }

    async scrapeNavigation(jobId: string): Promise<ScrapedNavigation[]> {
        const results: ScrapedNavigation[] = [];

        try {
            this.crawler.setRequestHandler(async ({ page, request }) => {
                try {
                    logger.info('Scraping navigation', { url: request.url, jobId });

                    // Wait for page to load completely
                    await page.waitForLoadState('networkidle', { timeout: 30000 });

                    // Extract navigation items
                    const navigationItems = await extractNavigation(page);

                    logger.info('Extracted navigation items', {
                        count: navigationItems.length,
                        jobId
                    });

                    results.push(...navigationItems);

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.error('Navigation scraping failed', {
                        url: request.url,
                        error: errorMessage,
                        jobId
                    });

                    throw new ScrapingError(
                        `Navigation scraping failed: ${errorMessage}`,
                        request.url,
                        jobId,
                        request.retryCount || 0,
                        error instanceof Error ? error : undefined
                    );
                }
            });

            // Add the main World of Books URL to start scraping
            await this.crawler.addRequest(config.WOB_BASE_URL, { jobId });

            // Run the crawler
            await this.crawler.run();

            return results;

        } catch (error) {
            logger.error('Navigation scraper failed', { error, jobId });
            throw error;
        } finally {
            await this.crawler.shutdown();
        }
    }
}

/**
 * Category scraper - extracts category information and product listings
 */
export class CategoryScraper {
    private crawler: ScraperCrawler;

    constructor() {
        this.crawler = new ScraperCrawler({
            maxRequestsPerCrawl: 100,
            maxConcurrency: 2,
            requestDelay: config.WOB_RATE_LIMIT_DELAY
        });
    }

    async scrapeCategory(categoryUrl: string, jobId: string): Promise<{
        category: ScrapedCategory;
        products: Array<{ title: string; url: string; price?: number; currency?: string }>;
    }> {
        let categoryInfo: ScrapedCategory | null = null;
        const products: Array<{ title: string; url: string; price?: number; currency?: string }> = [];

        try {
            this.crawler.setRequestHandler(async ({ page, request }) => {
                try {
                    logger.info('Scraping category page', { url: request.url, jobId });

                    // Wait for page to load
                    await page.waitForLoadState('networkidle', { timeout: 30000 });

                    // Extract category information if this is the first page
                    if (!categoryInfo) {
                        const categories = await extractCategories(page);
                        if (categories.length > 0) {
                            const category = categories[0]!; // We know it exists because length > 0
                            categoryInfo = {
                                title: category.title,
                                source_url: request.url,
                                product_count: category.product_count
                            };
                            if (category.navigation_id) {
                                categoryInfo.navigation_id = category.navigation_id;
                            }
                        } else {
                            // If no categories found, create basic category info from page
                            const title = await page.title();
                            categoryInfo = {
                                title: title || 'Unknown Category',
                                source_url: request.url,
                                product_count: 0
                            };
                        }
                    }

                    // Extract product listings from current page
                    const pageProducts = await extractProductListings(page);
                    products.push(...pageProducts);

                    logger.info('Extracted products from page', {
                        count: pageProducts.length,
                        totalProducts: products.length,
                        url: request.url,
                        jobId
                    });

                    // Check if there are more pages and add them to the queue
                    const hasNext = await hasNextPage(page);
                    if (hasNext) {
                        // Try to get the next page URL
                        const nextPageUrl = await page.evaluate(() => {
                            const nextSelectors = [
                                '.pagination .next:not(.disabled)',
                                '.pager .next:not(.disabled)',
                                'a[aria-label="Next"]',
                                '.next-page:not(.disabled)',
                                '[data-next]:not(.disabled)'
                            ];

                            for (const selector of nextSelectors) {
                                const element = document.querySelector(selector) as HTMLAnchorElement;
                                if (element && element.href) {
                                    return element.href;
                                }
                            }
                            return null;
                        });

                        if (nextPageUrl) {
                            await this.crawler.addRequest(nextPageUrl, { jobId, isNextPage: true });
                        }
                    }

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.error('Category page scraping failed', {
                        url: request.url,
                        error: errorMessage,
                        jobId
                    });

                    throw new ScrapingError(
                        `Category scraping failed: ${errorMessage}`,
                        request.url,
                        jobId,
                        request.retryCount || 0,
                        error instanceof Error ? error : undefined
                    );
                }
            });

            // Add the category URL to start scraping
            await this.crawler.addRequest(categoryUrl, { jobId });

            // Run the crawler
            await this.crawler.run();

            if (!categoryInfo) {
                throw new Error('Failed to extract category information');
            }

            // Update product count with actual scraped count
            if (!categoryInfo) {
                // Fallback if no category info was extracted
                categoryInfo = {
                    title: 'Unknown Category',
                    source_url: categoryUrl,
                    product_count: products.length
                };
            } else {
                // TypeScript assertion: we know categoryInfo is not null here
                (categoryInfo as ScrapedCategory).product_count = products.length;
            }

            return {
                category: categoryInfo,
                products
            };

        } catch (error) {
            logger.error('Category scraper failed', { error, categoryUrl, jobId });
            throw error;
        } finally {
            await this.crawler.shutdown();
        }
    }
}

/**
 * Product scraper - extracts detailed product information
 */
export class ProductScraper {
    private crawler: ScraperCrawler;

    constructor() {
        this.crawler = new ScraperCrawler({
            maxRequestsPerCrawl: 50,
            maxConcurrency: 3,
            requestDelay: config.WOB_RATE_LIMIT_DELAY
        });
    }

    async scrapeProduct(productUrl: string, jobId: string): Promise<ScrapedProduct> {
        let productData: ScrapedProduct | null = null;

        try {
            this.crawler.setRequestHandler(async ({ page, request }) => {
                try {
                    logger.info('Scraping product page', { url: request.url, jobId });

                    // Wait for page to load
                    await page.waitForLoadState('networkidle', { timeout: 30000 });

                    // Extract product details
                    const extractedData = await extractProductDetails(page);

                    if (!extractedData.title) {
                        throw new Error('Failed to extract product title');
                    }

                    // Convert to ScrapedProduct format
                    productData = {
                        title: extractedData.title,
                        source_url: request.url,
                        source_id: extractedData.source_id || '',
                        image_urls: extractedData.image_urls || [],
                        specs: extractedData.specs || {},
                        available: extractedData.available !== false
                    };

                    // Add optional properties only if they exist
                    if (extractedData.price !== undefined) {
                        productData.price = extractedData.price;
                    }
                    if (extractedData.currency) {
                        productData.currency = extractedData.currency;
                    } else {
                        productData.currency = 'GBP';
                    }
                    if (extractedData.summary) {
                        productData.summary = extractedData.summary;
                    }
                    if (extractedData.category_id) {
                        productData.category_id = extractedData.category_id;
                    }

                    // Resolve relative image URLs to absolute URLs
                    productData.image_urls = productData.image_urls.map(url =>
                        resolveUrl(config.WOB_BASE_URL, url)
                    );

                    logger.info('Extracted product details', {
                        title: productData.title,
                        price: productData.price,
                        imageCount: productData.image_urls.length,
                        specsCount: Object.keys(productData.specs).length,
                        jobId
                    });

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.error('Product page scraping failed', {
                        url: request.url,
                        error: errorMessage,
                        jobId
                    });

                    throw new ScrapingError(
                        `Product scraping failed: ${errorMessage}`,
                        request.url,
                        jobId,
                        request.retryCount || 0,
                        error instanceof Error ? error : undefined
                    );
                }
            });

            // Add the product URL to start scraping
            await this.crawler.addRequest(productUrl, { jobId });

            // Run the crawler
            await this.crawler.run();

            if (!productData) {
                throw new Error('Failed to extract product data');
            }

            return productData;

        } catch (error) {
            logger.error('Product scraper failed', { error, productUrl, jobId });
            throw error;
        } finally {
            await this.crawler.shutdown();
        }
    }

    /**
     * Scrape multiple products in batch
     */
    async scrapeProducts(productUrls: string[], jobId: string): Promise<ScrapedProduct[]> {
        const results: ScrapedProduct[] = [];

        try {
            this.crawler.setRequestHandler(async ({ page, request }) => {
                try {
                    logger.info('Scraping product page (batch)', { url: request.url, jobId });

                    // Wait for page to load
                    await page.waitForLoadState('networkidle', { timeout: 30000 });

                    // Extract product details
                    const extractedData = await extractProductDetails(page);

                    if (!extractedData.title) {
                        logger.warn('Failed to extract product title, skipping', { url: request.url, jobId });
                        return;
                    }

                    // Convert to ScrapedProduct format
                    const productData: ScrapedProduct = {
                        title: extractedData.title,
                        source_url: request.url,
                        source_id: extractedData.source_id || '',
                        image_urls: (extractedData.image_urls || []).map(url =>
                            resolveUrl(config.WOB_BASE_URL, url)
                        ),
                        specs: extractedData.specs || {},
                        available: extractedData.available !== false,
                        currency: extractedData.currency || 'GBP'
                    };

                    // Add optional properties only if they exist
                    if (extractedData.price !== undefined) {
                        productData.price = extractedData.price;
                    }
                    if (extractedData.summary) {
                        productData.summary = extractedData.summary;
                    }
                    if (extractedData.category_id) {
                        productData.category_id = extractedData.category_id;
                    }

                    results.push(productData);

                    logger.info('Extracted product details (batch)', {
                        title: productData.title,
                        price: productData.price,
                        imageCount: productData.image_urls.length,
                        processed: results.length,
                        total: productUrls.length,
                        jobId
                    });

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.error('Product page scraping failed (batch)', {
                        url: request.url,
                        error: errorMessage,
                        jobId
                    });

                    // Don't throw in batch mode, just log and continue
                }
            });

            // Add all product URLs to the crawler queue
            for (const url of productUrls) {
                await this.crawler.addRequest(url, { jobId });
            }

            // Run the crawler
            await this.crawler.run();

            logger.info('Batch product scraping completed', {
                requested: productUrls.length,
                successful: results.length,
                jobId
            });

            return results;

        } catch (error) {
            logger.error('Batch product scraper failed', { error, jobId });
            throw error;
        } finally {
            await this.crawler.shutdown();
        }
    }
}

/**
 * Factory function to create appropriate scraper based on job type
 */
export function createScraper(jobType: 'navigation' | 'category' | 'product') {
    switch (jobType) {
        case 'navigation':
            return new NavigationScraper();
        case 'category':
            return new CategoryScraper();
        case 'product':
            return new ProductScraper();
        default:
            throw new Error(`Unknown scraper type: ${jobType}`);
    }
}