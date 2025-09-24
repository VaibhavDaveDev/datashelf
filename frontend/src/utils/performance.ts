// Performance optimization utilities for mobile devices

/**
 * Lazy load images with intersection observer
 */
export function setupLazyLoading() {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const dataSrc = img.dataset['src'];
          if (dataSrc) {
            img.src = dataSrc;
            img.classList.remove('lazy');
            observer.unobserve(img);
          }
        }
      });
    });

    // Observe all images with data-src attribute
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
}

/**
 * Preload critical images
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Get optimal image size based on device pixel ratio and viewport
 */
export function getOptimalImageSize(baseWidth: number, baseHeight: number) {
  const dpr = window.devicePixelRatio || 1;
  const viewportWidth = window.innerWidth;
  
  // Scale down for mobile devices to save bandwidth
  const scaleFactor = viewportWidth < 640 ? 0.8 : 1;
  
  return {
    width: Math.round(baseWidth * dpr * scaleFactor),
    height: Math.round(baseHeight * dpr * scaleFactor)
  };
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for scroll events
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Check if device is mobile based on user agent and viewport
 */
export function isMobileDevice(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
  const isSmallViewport = window.innerWidth < 768;
  
  return isMobileUA || isSmallViewport;
}

/**
 * Get connection speed estimate
 */
export function getConnectionSpeed(): 'slow' | 'fast' | 'unknown' {
  // @ts-ignore - navigator.connection is experimental
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  if (!connection) return 'unknown';
  
  const slowConnections = ['slow-2g', '2g', '3g'];
  return slowConnections.includes(connection.effectiveType) ? 'slow' : 'fast';
}

/**
 * Optimize images based on connection speed
 */
export function getImageQuality(): 'low' | 'medium' | 'high' {
  const connectionSpeed = getConnectionSpeed();
  const isMobile = isMobileDevice();
  
  if (connectionSpeed === 'slow' || isMobile) {
    return 'low';
  } else if (connectionSpeed === 'fast') {
    return 'high';
  }
  
  return 'medium';
}

/**
 * Reduce motion for users who prefer it
 */
export function respectsReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers dark mode
 */
export function prefersDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}