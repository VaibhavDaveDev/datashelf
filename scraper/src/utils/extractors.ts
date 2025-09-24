import { Page } from 'playwright';
import { logger } from './logger';
import { ScrapedProduct, ScrapedCategory, ScrapedNavigation } from '../types';

/**
 * Utility functions for extracting and cleaning data from World of Books pages
 * 
 * These functions are specifically designed to work with World of Books website structure
 * and handle various edge cases and data formats found on the site.
 */

/**
 * Clean and normalize text content
 */
export function cleanText(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, ' ')
        .replace(/\t+/g, ' ');
}

/**
 * Extract price from text content
 */
export function extractPrice(priceText: string): { price?: number; currency?: string } {
    if (!priceText) return {};

    // Match patterns like "£12.99", "$15.50", "€10.00"
    const priceMatch = priceText.match(/([£$€])(\d+\.?\d*)/);
    if (priceMatch && priceMatch[1] && priceMatch[2]) {
        const currencySymbol = priceMatch[1];
        const priceValue = parseFloat(priceMatch[2]);

        const currencyMap: Record<string, string> = {
            '£': 'GBP',
            '$': 'USD',
            '€': 'EUR'
        };

        if (!isNaN(priceValue)) {
            return {
                price: priceValue,
                currency: currencyMap[currencySymbol] || 'GBP'
            };
        }
    }

    return {};
}

/**
 * Convert relative URLs to absolute URLs
 */
export function resolveUrl(baseUrl: string, relativeUrl: string): string {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http')) return relativeUrl;

    try {
        return new URL(relativeUrl, baseUrl).href;
    } catch (error) {
        logger.warn('Failed to resolve URL', { baseUrl, relativeUrl, error });
        return relativeUrl;
    }
}

/**
 * Extract navigation items from the main navigation menu
 * Specifically designed for World of Books navigation structure
 */
export async function extractNavigation(page: Page): Promise<ScrapedNavigation[]> {
    try {
        const navigationItems = await page.evaluate(() => {
            const items: Array<{ title: string; url: string; parentTitle?: string }> = [];

            // World of Books specific navigation selectors (Shopify-based structure)
            const navSelectors = [
                // Shopify Dawn theme navigation
                '.header__inline-menu a',
                '.list-menu a',
                '.header-menu a',
                'nav[role="navigation"] a',
                '.navigation-list a',
                // Mobile navigation
                '.mobile-nav a',
                '.drawer__menu a',
                // Category-specific navigation
                '.collection-nav a',
                '.category-navigation a',
                // Fallback selectors
                'header nav a',
                '.main-nav a',
                '.navbar-nav a'
            ];

            for (const selector of navSelectors) {
                const links = document.querySelectorAll(selector);
                if (links.length > 0) {
                    links.forEach(link => {
                        const anchor = link as HTMLAnchorElement;
                        const title = anchor.textContent?.trim();
                        const url = anchor.href;

                        if (title && url && title.length > 0) {
                            // Skip non-category links and utility pages
                            const skipPatterns = [
                                /my account/i,
                                /account/i,
                                /contact/i,
                                /about/i,
                                /help/i,
                                /support/i,
                                /login/i,
                                /sign in/i,
                                /register/i,
                                /sign up/i,
                                /basket/i,
                                /cart/i,
                                /checkout/i,
                                /wishlist/i,
                                /track.*order/i,
                                /returns/i,
                                /delivery/i,
                                /terms/i,
                                /privacy/i,
                                /cookies/i,
                                /newsletter/i,
                                /blog/i,
                                /news/i
                            ];

                            const shouldSkip = skipPatterns.some(pattern => pattern.test(title));
                            if (!shouldSkip && !url.includes('#') && !url.includes('javascript:')) {
                                items.push({ title, url });
                            }
                        }
                    });
                    break; // Use first successful selector
                }
            }

            return items;
        });

        return navigationItems.map(item => {
            const result: ScrapedNavigation = {
                title: cleanText(item.title),
                source_url: item.url
            };
            // parent_id will be determined by hierarchical structure later
            return result;
        });

    } catch (error) {
        logger.error('Failed to extract navigation', { error });
        return [];
    }
}

/**
 * Extract category information from category listing pages
 * Optimized for World of Books category page structure
 */
export async function extractCategories(page: Page): Promise<ScrapedCategory[]> {
    try {
        const categories = await page.evaluate(() => {
            const items: Array<{ title: string; url: string; productCount: number }> = [];

            // World of Books specific category selectors (Shopify structure)
            const categorySelectors = [
                // Shopify collection selectors
                '.collection-list a',
                '.collection-grid a',
                '.collection-item a',
                '.collections-grid a',
                // Sidebar collections
                '.sidebar .collection-list a',
                '.collection-sidebar a',
                '.facets a',
                // Category navigation
                '.category-nav a',
                '.subcategory-nav a',
                // Generic Shopify selectors
                '.list-menu--inline a',
                '.collection-card a',
                // Fallback selectors
                '.category-list a',
                '.subcategory a',
                '[data-collection] a'
            ];

            for (const selector of categorySelectors) {
                const links = document.querySelectorAll(selector);
                if (links.length > 0) {
                    links.forEach(link => {
                        const anchor = link as HTMLAnchorElement;
                        let title = anchor.textContent?.trim();
                        const url = anchor.href;

                        // Try to get title from nested elements if not directly available
                        if (!title) {
                            const titleElement = anchor.querySelector('h3, h4, .category-name, .title, .name');
                            title = titleElement?.textContent?.trim() || '';
                        }

                        // Try to extract product count from various possible locations
                        let productCount = 0;
                        const countSelectors = [
                            '.product-count',
                            '.count',
                            '.item-count',
                            '.results-count',
                            '.book-count',
                            '[data-count]',
                            '.badge',
                            '.number'
                        ];

                        for (const countSelector of countSelectors) {
                            const countElement = anchor.querySelector(countSelector) ||
                                anchor.parentElement?.querySelector(countSelector) ||
                                anchor.closest('.category-item')?.querySelector(countSelector);
                            if (countElement) {
                                const countText = countElement.textContent?.trim() || '';
                                // Match various count formats: "123", "(123)", "123 books", "123 items"
                                const countMatch = countText.match(/(\d+)/);
                                if (countMatch && countMatch[1]) {
                                    productCount = parseInt(countMatch[1], 10);
                                    break;
                                }
                            }
                        }

                        if (title && url && title.length > 0 && !url.includes('#')) {
                            items.push({ title, url, productCount });
                        }
                    });
                    break;
                }
            }

            return items;
        });

        return categories.map(item => {
            const result: ScrapedCategory = {
                title: cleanText(item.title),
                source_url: item.url,
                product_count: item.productCount
            };
            // navigation_id will be set by the calling code
            return result;
        });

    } catch (error) {
        logger.error('Failed to extract categories', { error });
        return [];
    }
}

/**
 * Extract product listings from category pages
 */
export async function extractProductListings(page: Page): Promise<Array<{ title: string; url: string; price?: number; currency?: string; thumbnail?: string }>> {
    try {
        const products = await page.evaluate(() => {
            const items: Array<{ title: string; url: string; priceText: string; thumbnail: string }> = [];

            // Shopify product listing selectors for World of Books
            const productSelectors = [
                // Shopify Dawn theme product cards
                '.card-wrapper',
                '.product-card-wrapper',
                '.card__content',
                '.grid__item',
                // Generic Shopify product selectors
                '.product-item',
                '.product-card',
                '.collection-product-card',
                // World of Books specific
                '.book-item',
                '.product',
                '[data-product]'
            ];

            for (const selector of productSelectors) {
                const products = document.querySelectorAll(selector);
                if (products.length > 0) {
                    products.forEach(product => {
                        // Extract title and URL (Shopify structure)
                        const titleLink = product.querySelector(
                            'a[href*="/products/"], ' +
                            'a[href*="/product/"], ' +
                            '.card__heading a, ' +
                            '.card__content a, ' +
                            '.product-title a, ' +
                            '.title a, ' +
                            'h3 a, ' +
                            'h2 a'
                        );
                        const title = titleLink?.textContent?.trim();
                        const url = (titleLink as HTMLAnchorElement)?.href;

                        // Extract price (Shopify structure)
                        const priceElement = product.querySelector(
                            '.price, ' +
                            '.price__regular, ' +
                            '.price__sale, ' +
                            '.money, ' +
                            '.cost, ' +
                            '[data-price], ' +
                            '.product-price, ' +
                            '.card__price'
                        );
                        const priceText = priceElement?.textContent?.trim() || '';

                        // Extract thumbnail
                        const imgElement = product.querySelector('img');
                        const thumbnail = imgElement?.src || imgElement?.getAttribute('data-src') || '';

                        if (title && url) {
                            items.push({ title, url, priceText, thumbnail });
                        }
                    });
                    break;
                }
            }

            return items;
        });

        return products.map(item => {
            const { price, currency } = extractPrice(item.priceText);
            const result: { title: string; url: string; price?: number; currency?: string; thumbnail?: string } = {
                title: cleanText(item.title),
                url: item.url,
                thumbnail: item.thumbnail
            };
            
            if (price !== undefined) {
                result.price = price;
            }
            if (currency !== undefined) {
                result.currency = currency;
            }
            
            return result;
        });

    } catch (error) {
        logger.error('Failed to extract product listings', { error });
        return [];
    }
}

/**
 * Extract detailed product information from product pages
 */
export async function extractProductDetails(page: Page): Promise<Partial<ScrapedProduct>> {
    try {
        const productData = await page.evaluate(() => {
            const data: any = {};

            // Extract title
            const titleSelectors = [
                'h1.product-title',
                'h1',
                '.product-name',
                '.book-title',
                '[data-product-title]'
            ];

            for (const selector of titleSelectors) {
                const element = document.querySelector(selector);
                if (element?.textContent?.trim()) {
                    data.title = element.textContent.trim();
                    break;
                }
            }

            // Extract price
            const priceSelectors = [
                '.price',
                '.product-price',
                '.cost',
                '[data-price]',
                '.price-current'
            ];

            for (const selector of priceSelectors) {
                const element = document.querySelector(selector);
                if (element?.textContent?.trim()) {
                    data.priceText = element.textContent.trim();
                    break;
                }
            }

            // Extract images
            const imageSelectors = [
                '.product-images img',
                '.product-gallery img',
                '.book-images img',
                '.main-image img',
                '.product-image img'
            ];

            const images: string[] = [];
            for (const selector of imageSelectors) {
                const imgElements = document.querySelectorAll(selector);
                if (imgElements.length > 0) {
                    imgElements.forEach(img => {
                        const src = (img as HTMLImageElement).src || (img as HTMLImageElement).getAttribute('data-src');
                        if (src && !images.includes(src)) {
                            images.push(src);
                        }
                    });
                    break;
                }
            }
            data.images = images;

            // Extract description/summary
            const descriptionSelectors = [
                '.product-description',
                '.book-description',
                '.description',
                '.summary',
                '[data-description]'
            ];

            for (const selector of descriptionSelectors) {
                const element = document.querySelector(selector);
                if (element?.textContent?.trim()) {
                    data.summary = element.textContent.trim();
                    break;
                }
            }

            // Extract specifications
            const specs: Record<string, any> = {};

            // Look for specification tables or lists
            const specSelectors = [
                '.product-specs',
                '.specifications',
                '.book-details',
                '.product-details',
                '.details-table'
            ];

            for (const selector of specSelectors) {
                const specContainer = document.querySelector(selector);
                if (specContainer) {
                    // Try table format
                    const rows = specContainer.querySelectorAll('tr');
                    if (rows.length > 0) {
                        rows.forEach(row => {
                            const cells = row.querySelectorAll('td, th');
                            if (cells.length >= 2 && cells[0] && cells[1]) {
                                const key = cells[0].textContent?.trim();
                                const value = cells[1].textContent?.trim();
                                if (key && value) {
                                    specs[key.toLowerCase().replace(/[^a-z0-9]/g, '_')] = value;
                                }
                            }
                        });
                    } else {
                        // Try list format
                        const items = specContainer.querySelectorAll('li, .spec-item, .detail-item');
                        items.forEach(item => {
                            const text = item.textContent?.trim();
                            if (text && text.includes(':')) {
                                const [key, ...valueParts] = text.split(':');
                                const value = valueParts.join(':').trim();
                                if (key && value) {
                                    specs[key.toLowerCase().replace(/[^a-z0-9]/g, '_')] = value;
                                }
                            }
                        });
                    }
                    break;
                }
            }

            data.specs = specs;

            // Extract availability
            const availabilitySelectors = [
                '.availability',
                '.stock-status',
                '.in-stock',
                '.out-of-stock',
                '[data-availability]'
            ];

            let available = true; // Default to available
            for (const selector of availabilitySelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const text = element.textContent?.toLowerCase() || '';
                    if (text.includes('out of stock') || text.includes('unavailable')) {
                        available = false;
                    }
                    break;
                }
            }
            data.available = available;

            return data;
        });

        // Process the extracted data
        const result: Partial<ScrapedProduct> = {
            title: cleanText(productData.title),
            source_url: page.url(),
            image_urls: productData.images || [],
            summary: cleanText(productData.summary),
            specs: productData.specs || {},
            available: productData.available !== false
        };

        // Extract price information
        if (productData.priceText) {
            const { price, currency } = extractPrice(productData.priceText);
            if (price !== undefined) {
                result.price = price;
            }
            if (currency !== undefined) {
                result.currency = currency;
            }
        }

        // Extract source ID from URL if possible
        const urlMatch = page.url().match(/\/product\/([^\/]+)/);
        if (urlMatch && urlMatch[1]) {
            result.source_id = urlMatch[1];
        }

        return result;

    } catch (error) {
        logger.error('Failed to extract product details', { error, url: page.url() });
        return {};
    }
}

/**
 * Check if there are more pages in pagination
 */
export async function hasNextPage(page: Page): Promise<boolean> {
    try {
        return await page.evaluate(() => {
            const nextSelectors = [
                '.pagination .next:not(.disabled)',
                '.pager .next:not(.disabled)',
                'a[aria-label="Next"]',
                '.next-page:not(.disabled)',
                '[data-next]:not(.disabled)'
            ];

            for (const selector of nextSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    return true;
                }
            }

            return false;
        });
    } catch (error) {
        logger.error('Failed to check for next page', { error });
        return false;
    }
}

/**
 * Navigate to the next page if available
 */
export async function goToNextPage(page: Page): Promise<boolean> {
    try {
        const nextPageClicked = await page.evaluate(() => {
            const nextSelectors = [
                '.pagination .next:not(.disabled)',
                '.pager .next:not(.disabled)',
                'a[aria-label="Next"]',
                '.next-page:not(.disabled)',
                '[data-next]:not(.disabled)'
            ];

            for (const selector of nextSelectors) {
                const element = document.querySelector(selector) as HTMLElement;
                if (element) {
                    element.click();
                    return true;
                }
            }

            return false;
        });

        if (nextPageClicked) {
            // Wait for navigation to complete
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            return true;
        }

        return false;
    } catch (error) {
        logger.error('Failed to navigate to next page', { error });
        return false;
    }
}