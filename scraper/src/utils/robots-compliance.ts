/**
 * Robots.txt compliance utilities for World of Books scraping
 * Based on actual robots.txt from https://www.worldofbooks.com/robots.txt
 */

import { logger } from './logger';

/**
 * URLs that are disallowed according to World of Books robots.txt
 */
const DISALLOWED_PATTERNS = [
    // Admin and account areas
    /\/admin/,
    /\/cart/,
    /\/orders/,
    /\/checkouts?\//,
    /\/checkout$/,
    /\/78440726801\/(checkouts|orders)/,
    /\/carts/,
    /\/account/,
    
    // Filtered and sorted collections (these create duplicate content)
    /\/collections\/.*sort_by/,
    /\/.*\/collections\/.*sort_by/,
    /\/collections\/.*\+/,
    /\/collections\/.*%2[Bb]/,
    /\/.*\/collections\/.*\+/,
    /\/.*\/collections\/.*%2[Bb]/,
    /\/collections\/.*filter/,
    
    // Blog filters
    /\/blogs\/.*\+/,
    /\/blogs\/.*%2[Bb]/,
    /\/.*\/blogs\/.*\+/,
    /\/.*\/blogs\/.*%2[Bb]/,
    
    // System and tracking URLs
    /\/.*\?.*oseid=/,
    /\/.*preview_theme_id/,
    /\/.*preview_script_id/,
    /\/policies\//,
    /\/.*\/policies\//,
    /\/.*\?.*ls=.*&ls=/,
    /\/.*\?.*ls%3[Dd].*%3[Ff]ls%3[Dd]/,
    /\/search/,
    /\/apple-app-site-association/,
    /\/\.well-known\/shopify\/monorail/,
    /\/cdn\/wpm\/.*\.js/,
    /\/recommendations\/products/,
    /\/.*\/recommendations\/products/,
    
    // Cart API endpoints
    /\/cart\/(update|add|change|clear)\.js/,
    /\/cart\.js/,
    
    // Other restricted patterns
    /\/wpm@/,
    /\/.*\.atom$/
];

/**
 * URLs that are explicitly allowed
 */
const ALLOWED_PATTERNS = [
    /\/cdn\//,
    /\/tools\/sitemap-builder\//,
    /\/[a-z]{2}-[a-z]{2}(\/|$)/,  // Language/country codes like /en-gb/, /fr-fr/
    /\/.*\.(gif|png|jpe?g|svg|css|pdf)$/
];

/**
 * Check if a URL is allowed according to robots.txt rules
 */
export function isUrlAllowed(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname + urlObj.search;
        
        // Check if explicitly allowed
        for (const pattern of ALLOWED_PATTERNS) {
            if (pattern.test(pathname)) {
                return true;
            }
        }
        
        // Check if disallowed
        for (const pattern of DISALLOWED_PATTERNS) {
            if (pattern.test(pathname)) {
                logger.debug('URL blocked by robots.txt', { url, pattern: pattern.source });
                return false;
            }
        }
        
        // Default to allowed if not explicitly disallowed
        return true;
        
    } catch (error) {
        logger.warn('Failed to parse URL for robots.txt check', { url, error });
        return false;
    }
}

/**
 * Filter a list of URLs to only include those allowed by robots.txt
 */
export function filterAllowedUrls(urls: string[]): string[] {
    return urls.filter(url => isUrlAllowed(url));
}

/**
 * Get the appropriate crawl delay for a user agent
 * Based on robots.txt rules
 */
export function getCrawlDelay(userAgent: string = 'DataShelf-Bot'): number {
    // AhrefsBot and AhrefsSiteAudit have 10s delay
    if (userAgent.toLowerCase().includes('ahrefs')) {
        return 10000;
    }
    
    // MJ12bot has 10s delay
    if (userAgent.toLowerCase().includes('mj12bot')) {
        return 10000;
    }
    
    // Pinterest has 1s delay
    if (userAgent.toLowerCase().includes('pinterest')) {
        return 1000;
    }
    
    // No specific delay for other bots, but we'll use a conservative 2s
    return 2000;
}

/**
 * Check if a URL is a valid collection/category URL for scraping
 */
export function isValidCollectionUrl(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        
        // Must be a collection URL
        if (!pathname.includes('/collections/')) {
            return false;
        }
        
        // Check robots.txt compliance
        if (!isUrlAllowed(url)) {
            return false;
        }
        
        // Avoid filtered/sorted URLs (these are disallowed and create duplicates)
        if (urlObj.search.includes('sort_by') || 
            urlObj.search.includes('filter') || 
            pathname.includes('+') || 
            pathname.includes('%2B') || 
            pathname.includes('%2b')) {
            return false;
        }
        
        return true;
        
    } catch (error) {
        logger.warn('Failed to validate collection URL', { url, error });
        return false;
    }
}

/**
 * Check if a URL is a valid product URL for scraping
 */
export function isValidProductUrl(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        
        // Must be a product URL (Shopify uses /products/ path)
        if (!pathname.includes('/products/')) {
            return false;
        }
        
        // Check robots.txt compliance
        return isUrlAllowed(url);
        
    } catch (error) {
        logger.warn('Failed to validate product URL', { url, error });
        return false;
    }
}

/**
 * Normalize a World of Books URL to ensure consistency
 */
export function normalizeWobUrl(url: string, baseUrl: string = 'https://www.worldofbooks.com'): string {
    try {
        const urlObj = new URL(url, baseUrl);
        
        // Remove tracking parameters
        const trackingParams = ['oseid', 'preview_theme_id', 'preview_script_id'];
        trackingParams.forEach(param => {
            urlObj.searchParams.delete(param);
        });
        
        return urlObj.href;
        
    } catch (error) {
        logger.warn('Failed to normalize URL', { url, error });
        return url;
    }
}

/**
 * Get sitemap URLs from robots.txt
 */
export function getSitemapUrls(): string[] {
    return [
        'https://www.worldofbooks.com/tools/sitemap-builder/sitemap.xml'
    ];
}

/**
 * Validate scraping configuration against robots.txt rules
 */
export function validateScrapingConfig(config: {
    userAgent: string;
    crawlDelay: number;
    maxConcurrency: number;
}): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    // Check crawl delay
    const recommendedDelay = getCrawlDelay(config.userAgent);
    if (config.crawlDelay < recommendedDelay) {
        warnings.push(`Crawl delay ${config.crawlDelay}ms is less than recommended ${recommendedDelay}ms for user agent ${config.userAgent}`);
    }
    
    // Check concurrency
    if (config.maxConcurrency > 3) {
        warnings.push(`High concurrency (${config.maxConcurrency}) may violate rate limiting policies`);
    }
    
    // Check user agent (allow 'bot' in name, but warn about browser impersonation)
    if (!config.userAgent) {
        warnings.push('User agent should be specified');
    } else if (config.userAgent.toLowerCase().includes('mozilla') || 
               config.userAgent.toLowerCase().includes('chrome') ||
               config.userAgent.toLowerCase().includes('safari')) {
        warnings.push('User agent should identify the scraper clearly and not impersonate a regular browser');
    }
    
    return {
        valid: warnings.length === 0,
        warnings
    };
}