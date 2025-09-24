// Accessibility utilities for mobile and responsive design

/**
 * Check if an element meets minimum touch target size (44x44px)
 */
export function checkTouchTargetSize(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width >= 44 && rect.height >= 44;
}

/**
 * Check color contrast ratio (simplified)
 */
export function hasGoodContrast(foreground: string, background: string): boolean {
  // This is a simplified check - in production, use a proper contrast ratio calculator
  const fgLuminance = getLuminance(foreground);
  const bgLuminance = getLuminance(background);
  
  const contrast = (Math.max(fgLuminance, bgLuminance) + 0.05) / 
                   (Math.min(fgLuminance, bgLuminance) + 0.05);
  
  return contrast >= 4.5; // WCAG AA standard
}

/**
 * Get relative luminance of a color (simplified)
 */
function getLuminance(color: string): number {
  // This is a very simplified implementation
  // In production, use a proper color library
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Add focus management for mobile navigation
 */
export function manageFocus(element: HTMLElement) {
  // Store the currently focused element
  const previouslyFocused = document.activeElement as HTMLElement;
  
  // Focus the target element
  element.focus();
  
  // Return a function to restore focus
  return () => {
    if (previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus();
    }
  };
}

/**
 * Announce content changes to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Add keyboard navigation support
 */
export function addKeyboardNavigation(
  elements: HTMLElement[],
  options: {
    loop?: boolean;
    orientation?: 'horizontal' | 'vertical' | 'both';
  } = {}
) {
  const { loop = true, orientation = 'both' } = options;
  
  elements.forEach((element, index) => {
    element.addEventListener('keydown', (e) => {
      let targetIndex = -1;
      
      switch (e.key) {
        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'both') {
            targetIndex = loop ? (index + 1) % elements.length : Math.min(index + 1, elements.length - 1);
            e.preventDefault();
          }
          break;
        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'both') {
            targetIndex = loop ? (index - 1 + elements.length) % elements.length : Math.max(index - 1, 0);
            e.preventDefault();
          }
          break;
        case 'ArrowDown':
          if (orientation === 'vertical' || orientation === 'both') {
            targetIndex = loop ? (index + 1) % elements.length : Math.min(index + 1, elements.length - 1);
            e.preventDefault();
          }
          break;
        case 'ArrowUp':
          if (orientation === 'vertical' || orientation === 'both') {
            targetIndex = loop ? (index - 1 + elements.length) % elements.length : Math.max(index - 1, 0);
            e.preventDefault();
          }
          break;
        case 'Home':
          targetIndex = 0;
          e.preventDefault();
          break;
        case 'End':
          targetIndex = elements.length - 1;
          e.preventDefault();
          break;
      }
      
      if (targetIndex >= 0 && targetIndex < elements.length) {
        const targetElement = elements[targetIndex];
        if (targetElement) {
          targetElement.focus();
        }
      }
    });
  });
}

/**
 * Create a skip link for better navigation
 */
export function createSkipLink(targetId: string, text: string = 'Skip to main content'): HTMLAnchorElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = text;
  skipLink.className = 'skip-link';
  skipLink.setAttribute('aria-label', text);
  
  return skipLink;
}

/**
 * Ensure proper heading hierarchy
 */
export function validateHeadingHierarchy(): string[] {
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const issues: string[] = [];
  let previousLevel = 0;
  
  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName.charAt(1));
    
    if (index === 0 && level !== 1) {
      issues.push('Page should start with an h1 element');
    }
    
    if (level > previousLevel + 1) {
      issues.push(`Heading level jumps from h${previousLevel} to h${level} - should be sequential`);
    }
    
    previousLevel = level;
  });
  
  return issues;
}

/**
 * Add ARIA labels for better screen reader support
 */
export function enhanceWithARIA(element: HTMLElement, options: {
  label?: string;
  describedBy?: string;
  expanded?: boolean;
  hasPopup?: boolean;
  role?: string;
}) {
  const { label, describedBy, expanded, hasPopup, role } = options;
  
  if (label) element.setAttribute('aria-label', label);
  if (describedBy) element.setAttribute('aria-describedby', describedBy);
  if (expanded !== undefined) element.setAttribute('aria-expanded', expanded.toString());
  if (hasPopup) element.setAttribute('aria-haspopup', 'true');
  if (role) element.setAttribute('role', role);
}