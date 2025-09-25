import { PlaywrightCrawler } from 'crawlee';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { isUrlAllowed, getCrawlDelay, validateScrapingConfig } from '../utils/robots-compliance';

export interface CrawlerOptions {
    maxRequestsPerCrawl?: number;
    maxConcurrency?: number;
    requestDelay?: number;
    retryOnBlocked?: boolean;
}

export class ScraperCrawler {
    private crawler: PlaywrightCrawler;

    constructor(options: CrawlerOptions = {}) {
        const {
            maxRequestsPerCrawl = 1000,
            maxConcurrency = config.SCRAPER_CONCURRENT_JOBS,
            requestDelay = getCrawlDelay(config.SCRAPER_USER_AGENT)
        } = options;

        // Validate configuration against robots.txt
        const validation = validateScrapingConfig({
            userAgent: config.SCRAPER_USER_AGENT,
            crawlDelay: requestDelay,
            maxConcurrency
        });
        
        if (!validation.valid) {
            validation.warnings.forEach(warning => {
                logger.warn('Robots.txt compliance warning', { warning });
            });
        }

        this.crawler = new PlaywrightCrawler({
            // Browser configuration optimized for World of Books (Shopify store)
            // Using explicit browser path from environment variable in containerized environments
            launchContext: {
                launchOptions: {
                    headless: true,
                    ...(process.env['BROWSER_PATH'] ? { executablePath: process.env['BROWSER_PATH'] } : {}),
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor',
                        '--window-size=1920,1080',
                        // Shopify-specific optimizations
                        '--disable-blink-features=AutomationControlled',
                        '--disable-extensions',
                    ],
                },
            },

            // Request configuration
            maxRequestsPerCrawl,
            maxConcurrency,
            requestHandlerTimeoutSecs: 60,
            navigationTimeoutSecs: 30,

            // Rate limiting (robots.txt compliant)
            minConcurrency: 1,
            maxRequestRetries: config.SCRAPER_RETRY_ATTEMPTS,
            
            // Rate limiting configuration

            // Session management
            useSessionPool: true,
            sessionPoolOptions: {
                maxPoolSize: 10,
                sessionOptions: {
                    maxUsageCount: 50,
                },
            },

            // Error handling
            failedRequestHandler: async ({ request, error }) => {
                logger.error('Request failed', {
                    url: request.url,
                    error: error instanceof Error ? error.message : String(error),
                    retryCount: request.retryCount,
                });
            },

            // Browser crash recovery
            browserPoolOptions: {
                retireBrowserAfterPageCount: 100,
                maxOpenPagesPerBrowser: 5,
            },

            // Request interception for custom headers and World of Books optimization
            preNavigationHooks: [
                async ({ page }) => {
                    // Set realistic browser headers for Shopify store
                    await page.context().setExtraHTTPHeaders({
                        'User-Agent': config.SCRAPER_USER_AGENT,
                        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Sec-Fetch-User': '?1',
                        'Upgrade-Insecure-Requests': '1',
                        // Shopify-specific headers
                        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                    });

                    // Set viewport for consistent rendering
                    await page.setViewportSize({ width: 1920, height: 1080 });

                    // Block unnecessary resources for Shopify store optimization
                    await page.route('**/*', (route) => {
                        const url = route.request().url();
                        const resourceType = route.request().resourceType();
                        
                        // Block tracking and analytics
                        if (url.includes('google-analytics') || 
                            url.includes('googletagmanager') || 
                            url.includes('facebook.net') ||
                            url.includes('sgtm.worldofbooks.com') ||
                            url.includes('live.visually-io.com') ||
                            url.includes('tapcart.com')) {
                            route.abort();
                            return;
                        }
                        
                        // Handle static resources
                        if (['stylesheet', 'font', 'media'].includes(resourceType)) {
                            route.abort();
                        } else if (resourceType === 'image') {
                            // Allow product images but block other images
                            if (url.includes('/products/') || url.includes('product-images')) {
                                route.continue();
                            } else {
                                route.abort();
                            }
                        } else {
                            route.continue();
                        }
                    });
                },
            ],
        });

        logger.info('Crawler initialized', {
            maxConcurrency,
            maxRequestsPerCrawl,
        });
    }

    /**
     * Add a URL to the crawler queue (with robots.txt compliance check)
     */
    async addRequest(url: string, userData?: Record<string, any>) {
        // Check robots.txt compliance before adding request
        if (!isUrlAllowed(url)) {
            logger.warn('URL blocked by robots.txt, skipping', { url });
            return;
        }

        await this.crawler.addRequests([{
            url,
            userData: userData || {},
        }]);
    }

    /**
     * Set the request handler for processing pages
     */
    setRequestHandler(handler: Parameters<PlaywrightCrawler['router']['addDefaultHandler']>[0]) {
        this.crawler.router.addDefaultHandler(handler);
    }

    /**
     * Start the crawler
     */
    async run() {
        logger.info('Starting crawler');
        await this.crawler.run();
        logger.info('Crawler finished');
    }

    /**
     * Get crawler statistics
     */
    getStats() {
        return this.crawler.stats;
    }

    /**
     * Gracefully shutdown the crawler
     */
    async shutdown() {
        logger.info('Shutting down crawler');
        try {
            await this.crawler.teardown();
        } catch (error) {
            logger.error('Error during crawler shutdown', { error });
        }
    }

    /**
     * Handle browser crashes and timeouts
     */
    async handleBrowserError(error: Error, url: string): Promise<void> {
        logger.error('Browser error encountered', { 
            error: error.message, 
            url,
            stack: error.stack 
        });

        // Check if it's a browser crash
        if (error.message.includes('Target closed') || 
            error.message.includes('Browser closed') ||
            error.message.includes('Connection closed')) {
            logger.warn('Browser crash detected, will retry with new browser instance');
        }

        // Check if it's a timeout
        if (error.message.includes('Timeout') || 
            error.message.includes('timeout')) {
            logger.warn('Timeout detected', { url });
        }
    }

    /**
     * Check if error is retryable
     */
    isRetryableError(error: Error): boolean {
        const retryablePatterns = [
            /timeout/i,
            /network/i,
            /connection/i,
            /target closed/i,
            /browser closed/i,
            /page crashed/i,
            /navigation failed/i
        ];

        return retryablePatterns.some(pattern => pattern.test(error.message));
    }
}