# Cloudflare Turnstile Bot Protection Setup

This document provides instructions for setting up Cloudflare Turnstile bot protection for the DataShelf application.

## Overview

Cloudflare Turnstile provides invisible bot protection that runs seamlessly in the background without requiring user interaction in most cases. The implementation includes:

- Frontend React components for Turnstile integration
- API middleware for token verification
- Fallback mechanisms for when Turnstile fails
- Comprehensive error handling and logging

## Prerequisites

1. Cloudflare account with Turnstile access
2. Domain configured in Cloudflare (for production)

## Setup Instructions

### 1. Cloudflare Turnstile Configuration

1. **Access Turnstile Dashboard**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Navigate to "Turnstile" in the sidebar
   - Click "Add Site"

2. **Configure Site Settings**
   - **Site Name**: DataShelf
   - **Domain**: Add your domains (e.g., `datashelf.com`, `localhost` for development)
   - **Widget Mode**: Select "Non-interactive" for seamless user experience
   - **Pre-clearance**: Enable if desired for better performance

3. **Get Keys**
   - Copy the **Site Key** (public key for frontend)
   - Copy the **Secret Key** (private key for API verification)

### 2. Frontend Configuration

1. **Environment Variables**
   Add to your `.env` file:
   ```bash
   VITE_TURNSTILE_SITE_KEY=your_site_key_here
   ```

2. **Development Setup**
   For local development, you can use Cloudflare's test keys:
   ```bash
   # Always passes
   VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
   
   # Always fails
   VITE_TURNSTILE_SITE_KEY=2x00000000000000000000AB
   
   # Always blocks
   VITE_TURNSTILE_SITE_KEY=3x00000000000000000000FF
   ```

### 3. API Configuration

1. **Environment Variables**
   Set the secret key using Wrangler:
   ```bash
   # Development
   wrangler secret put TURNSTILE_SECRET_KEY --env development
   
   # Production
   wrangler secret put TURNSTILE_SECRET_KEY --env production
   ```

2. **Development Secret Keys**
   For local development, you can use Cloudflare's test secret:
   ```bash
   # Test secret key (always passes)
   1x0000000000000000000000000000000AA
   ```

### 4. Environment-Specific Configuration

#### Development
- Turnstile verification is bypassed by default
- Use test keys for testing the integration
- Logging middleware is used instead of blocking middleware

#### Production
- Full Turnstile verification is enabled
- Real site and secret keys are required
- Failed verification blocks API access

## Implementation Details

### Frontend Components

1. **TurnstileWidget**: Core widget component with error handling
2. **TurnstileProtection**: Layout-level protection component
3. **TurnstileContext**: Global state management for verification status
4. **useTurnstileSync**: Hook to sync tokens with API client

### API Components

1. **Turnstile Utilities**: Token verification and extraction functions
2. **Turnstile Middleware**: Request verification middleware
3. **Environment Detection**: Automatic bypass for development/health checks

### Security Features

- **Token Validation**: Server-side verification with Cloudflare
- **IP Tracking**: Client IP logging for security monitoring
- **Fallback Access**: Graceful degradation when Turnstile fails
- **Rate Limiting**: Built-in protection against abuse
- **Environment Bypass**: Automatic bypass for development and monitoring

## Testing

### Frontend Tests
```bash
cd frontend
npm test src/components/security/__tests__/
npm test src/contexts/__tests__/TurnstileContext.test.tsx
```

### API Tests
```bash
cd api
npm test src/tests/utils/turnstile.test.ts
npm test src/tests/middleware/turnstile.test.ts
```

## Troubleshooting

### Common Issues

1. **Widget Not Loading**
   - Check that `VITE_TURNSTILE_SITE_KEY` is set correctly
   - Verify domain is added to Turnstile site configuration
   - Check browser console for JavaScript errors

2. **API Verification Failing**
   - Ensure `TURNSTILE_SECRET_KEY` is set in Cloudflare Workers
   - Verify the secret key matches the site key
   - Check API logs for detailed error messages

3. **Development Issues**
   - Use test keys for local development
   - Ensure `ENVIRONMENT=development` is set to bypass verification
   - Check that middleware is in logging mode for development

### Debug Mode

Enable debug logging by setting:
```bash
# Frontend
VITE_DEBUG_TURNSTILE=true

# API (in wrangler.toml or environment)
DEBUG_TURNSTILE=true
```

## Monitoring

### Metrics to Track

1. **Verification Success Rate**: Percentage of successful verifications
2. **Fallback Usage**: How often fallback access is used
3. **Error Rates**: Types and frequency of verification errors
4. **Performance Impact**: Latency added by verification process

### Logging

The implementation includes comprehensive logging:
- Verification attempts and results
- Error details and error codes
- Client IP addresses and user agents
- Fallback access usage

## Security Considerations

1. **Secret Key Protection**: Never expose secret keys in frontend code
2. **Token Expiration**: Tokens expire and need refresh
3. **Replay Protection**: Tokens are single-use
4. **Rate Limiting**: Implement additional rate limiting as needed
5. **Monitoring**: Monitor for unusual patterns or abuse

## Performance Optimization

1. **Non-Interactive Mode**: Reduces user friction
2. **Caching**: Verification results can be cached briefly
3. **Async Loading**: Widget loads asynchronously
4. **Fallback Handling**: Graceful degradation maintains performance

## Compliance

Turnstile is designed to be privacy-friendly:
- No personal data collection
- GDPR compliant
- No cookies required
- Minimal performance impact

## Support

For issues with Turnstile integration:
1. Check Cloudflare Turnstile documentation
2. Review implementation logs
3. Test with Cloudflare's test keys
4. Contact Cloudflare support for service issues