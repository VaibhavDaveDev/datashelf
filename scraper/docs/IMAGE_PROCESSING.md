# Image Processing Documentation

This document describes the image processing functionality implemented for the DataShelf scraper service.

## Overview

The image processing system handles downloading, validating, optimizing, and storing product images from World of Books to Cloudflare R2 storage. It provides a complete pipeline from raw image URLs to optimized, cached images served via CDN.

## Architecture

```
Scraped Image URLs → Download → Validate → Process → Upload to R2 → Return R2 URLs
```

### Key Components

1. **ImageProcessor** - Core service for image processing operations
2. **ImageUtils** - Utility functions for common image processing tasks
3. **Integration Examples** - Sample code showing how to integrate with existing scrapers

## Configuration

### Environment Variables

```bash
# Cloudflare R2 Configuration
CLOUDFLARE_R2_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET_NAME=datashelf-images
CLOUDFLARE_R2_PUBLIC_URL=https://your-bucket.r2.dev

# Scraper Configuration
SCRAPER_USER_AGENT=DataShelf-Bot/1.0
```

### R2 Bucket Setup

1. Create a Cloudflare R2 bucket
2. Configure public access for the bucket
3. Set up custom domain (optional) for better performance
4. Generate API tokens with R2 read/write permissions

## Usage

### Basic Usage

```typescript
import { imageProcessor } from '../services/imageProcessor.js';

// Process a single image
const result = await imageProcessor.processImageUrl(
  'https://example.com/image.jpg',
  'https://example.com'
);

if (result.success) {
  console.log('Image uploaded to:', result.r2Url);
}

// Process multiple images
const results = await imageProcessor.processImageUrls([
  'https://example.com/image1.jpg',
  'https://example.com/image2.jpg'
], 'https://example.com');
```

### Integration with Scrapers

```typescript
import { processProductImages } from '../utils/imageUtils.js';

// In your scraper
const scrapedProduct = await scrapeProduct(url);

// Process images
const processedImageUrls = await processProductImages(
  scrapedProduct.image_urls,
  'https://www.worldofbooks.com',
  scrapedProduct.title
);

// Update product with R2 URLs
scrapedProduct.image_urls = processedImageUrls;
```

### Batch Processing

```typescript
import { batchProcessImages } from '../utils/imageUtils.js';

const results = await batchProcessImages(
  imageUrls,
  'https://www.worldofbooks.com',
  {
    batchSize: 5,
    onProgress: (processed, total, stats) => {
      console.log(`Progress: ${processed}/${total} (${stats.successful} successful)`);
    }
  }
);
```

## Features

### Image Download
- Proper HTTP headers and user agent
- Timeout handling (30 seconds)
- Content type validation
- Size limits (5MB max)
- Error handling and retries

### Image Validation
- Format validation (JPEG, PNG, WebP, GIF)
- Size validation
- Dimension extraction
- Corruption detection

### Image Processing
- Format conversion to JPEG for optimization
- Automatic resizing (max 1200px width)
- Quality optimization (85% quality)
- Progressive JPEG encoding
- Metadata preservation

### Storage
- Unique filename generation (UUID)
- Organized folder structure (`products/`)
- Proper content types and cache headers
- Public read access
- Signed URL generation for private access

### URL Handling
- Relative to absolute URL conversion
- Protocol-relative URL support
- URL validation and sanitization
- Base URL resolution

## API Reference

### ImageProcessor Class

#### Methods

- `downloadImage(imageUrl: string): Promise<Buffer>`
- `validateImage(buffer: Buffer): Promise<ImageValidationResult>`
- `processImage(buffer: Buffer): Promise<{ buffer: Buffer; format: string }>`
- `uploadToR2(buffer: Buffer, format: string): Promise<{ filename: string; r2Url: string }>`
- `convertToAbsoluteUrl(imageUrl: string, baseUrl: string): string`
- `generateSignedUrl(filename: string, expiresIn?: number): Promise<string>`
- `processImageUrl(imageUrl: string, baseUrl?: string): Promise<ImageProcessingResult>`
- `processImageUrls(imageUrls: string[], baseUrl?: string, concurrency?: number): Promise<ImageProcessingResult[]>`

### Utility Functions

#### processProductImages
```typescript
processProductImages(
  imageUrls: string[],
  baseUrl: string,
  productTitle?: string
): Promise<string[]>
```

#### processSingleImage
```typescript
processSingleImage(
  imageUrl: string,
  baseUrl?: string
): Promise<string | null>
```

#### validateImageUrls
```typescript
validateImageUrls(imageUrls: string[]): string[]
```

#### extractImageUrls
```typescript
extractImageUrls(
  data: any,
  selectors?: string[]
): string[]
```

#### batchProcessImages
```typescript
batchProcessImages(
  imageUrls: string[],
  baseUrl: string,
  options?: {
    batchSize?: number;
    onProgress?: (processed: number, total: number, stats: ImageProcessingStats) => void;
    onBatchComplete?: (batchResults: ImageProcessingResult[]) => void;
  }
): Promise<ImageProcessingResult[]>
```

## Error Handling

The image processing system includes comprehensive error handling:

### Network Errors
- Connection timeouts
- DNS resolution failures
- HTTP error responses
- Rate limiting (429 responses)

### Image Errors
- Invalid image formats
- Corrupted image data
- Oversized images
- Processing failures

### Storage Errors
- R2 upload failures
- Authentication errors
- Quota exceeded
- Network issues

### Error Recovery
- Automatic retries with exponential backoff
- Graceful degradation (continue without images)
- Detailed error logging
- Partial success handling

## Performance Considerations

### Concurrency Control
- Configurable batch sizes
- Rate limiting compliance
- Memory usage optimization
- Connection pooling

### Optimization
- Image compression and resizing
- Format conversion for better compression
- Progressive JPEG encoding
- CDN caching with long TTL

### Monitoring
- Processing statistics
- Success/failure rates
- Performance metrics
- Error tracking

## Testing

### Unit Tests
```bash
npm test -- imageProcessor.test.ts
npm test -- imageUtils.test.ts
```

### Integration Tests
```bash
npm test -- imageProcessingIntegration.test.ts
```

### Manual Testing
```typescript
import { demonstrateImageProcessing } from '../examples/imageProcessingIntegration.js';
await demonstrateImageProcessing();
```

## Troubleshooting

### Common Issues

#### Images not downloading
- Check network connectivity
- Verify image URLs are accessible
- Check user agent restrictions
- Verify SSL certificates

#### Upload failures
- Verify R2 credentials
- Check bucket permissions
- Verify bucket exists
- Check quota limits

#### Processing errors
- Check image format support
- Verify image is not corrupted
- Check available memory
- Verify Sharp installation

### Debug Logging
```bash
LOG_LEVEL=debug npm start
```

### Health Checks
The image processor includes built-in health checks and monitoring endpoints.

## Best Practices

### Performance
- Use appropriate batch sizes (3-5 images)
- Implement progress tracking for long operations
- Monitor memory usage during processing
- Use CDN for serving processed images

### Error Handling
- Always handle partial failures gracefully
- Log detailed error information
- Implement retry logic with backoff
- Provide fallback mechanisms

### Security
- Validate all input URLs
- Sanitize filenames
- Use signed URLs for private content
- Implement rate limiting

### Monitoring
- Track processing success rates
- Monitor storage usage
- Alert on high failure rates
- Track performance metrics

## Future Enhancements

- WebP format support for better compression
- Image resizing variants (thumbnails, etc.)
- Lazy loading optimization
- Advanced image analysis (OCR, content detection)
- Batch upload optimization
- Image deduplication
- Automatic format selection based on browser support