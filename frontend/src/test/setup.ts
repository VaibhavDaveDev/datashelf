import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_BASE_URL: 'http://localhost:3000',
    DEV: true,
  },
  writable: true,
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];
  
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() { return []; }
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});