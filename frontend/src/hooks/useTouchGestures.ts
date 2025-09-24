import { useEffect, useRef, useState } from 'react';

interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinch?: (scale: number) => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  threshold?: number;
  preventScroll?: boolean;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export function useTouchGestures(options: TouchGestureOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onPinch,
    onTap,
    onDoubleTap,
    threshold = 50,
    preventScroll = false
  } = options;

  const elementRef = useRef<HTMLElement>(null);
  const [isTouch, setIsTouch] = useState(false);
  
  // Touch tracking
  const touchStart = useRef<TouchPoint | null>(null);
  const lastTap = useRef<number>(0);
  const initialDistance = useRef<number>(0);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      setIsTouch(true);
      
      if (preventScroll) {
        e.preventDefault();
      }

      const touch = e.touches[0];
      if (!touch) return;
      
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };

      // Handle pinch gesture
      if (e.touches.length === 2 && onPinch) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        if (touch1 && touch2) {
          initialDistance.current = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
          );
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (preventScroll) {
        e.preventDefault();
      }

      // Handle pinch gesture
      if (e.touches.length === 2 && onPinch && initialDistance.current > 0) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        if (touch1 && touch2) {
          const currentDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
          );
          const scale = currentDistance / initialDistance.current;
          onPinch(scale);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.changedTouches[0];
      if (!touch) return;
      
      const touchEnd = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };

      const deltaX = touchEnd.x - touchStart.current.x;
      const deltaY = touchEnd.y - touchStart.current.y;
      const deltaTime = touchEnd.time - touchStart.current.time;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Handle tap gestures
      if (distance < 10 && deltaTime < 300) {
        const now = Date.now();
        const timeSinceLastTap = now - lastTap.current;
        
        if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
          // Double tap
          if (onDoubleTap) {
            onDoubleTap();
          }
        } else {
          // Single tap
          if (onTap) {
            setTimeout(() => {
              const timeSinceThisTap = Date.now() - now;
              if (timeSinceThisTap >= 300) {
                onTap();
              }
            }, 300);
          }
        }
        
        lastTap.current = now;
        return;
      }

      // Handle swipe gestures
      if (distance > threshold) {
        const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
        
        if (isHorizontal) {
          if (deltaX > 0 && onSwipeRight) {
            onSwipeRight();
          } else if (deltaX < 0 && onSwipeLeft) {
            onSwipeLeft();
          }
        } else {
          if (deltaY > 0 && onSwipeDown) {
            onSwipeDown();
          } else if (deltaY < 0 && onSwipeUp) {
            onSwipeUp();
          }
        }
      }

      touchStart.current = null;
      initialDistance.current = 0;
    };

    // Add event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: !preventScroll });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventScroll });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onPinch, onTap, onDoubleTap, threshold, preventScroll]);

  return {
    elementRef,
    isTouch
  };
}

// Hook for detecting mobile device
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
      const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
      const isSmallViewport = window.innerWidth < 768;
      
      setIsMobile(isMobileUA || isSmallViewport);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
}

// Hook for handling viewport changes
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    ...viewport,
    isMobile: viewport.width < 768,
    isTablet: viewport.width >= 768 && viewport.width < 1024,
    isDesktop: viewport.width >= 1024,
  };
}