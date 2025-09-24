import React from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Skip to main content link for accessibility */}
      <a 
        href="#main-content" 
        className="skip-link"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>
      
      <Header />
      
      {/* Main content with responsive padding and proper semantic structure */}
      <main 
        id="main-content"
        className="flex-1 container-responsive py-4 sm:py-6 lg:py-8"
        role="main"
        aria-label="Main content"
      >
        {children}
      </main>
      
      {/* Mobile-friendly footer spacer to prevent content being hidden behind mobile navigation */}
      <div className="h-4 sm:h-0" aria-hidden="true" />
    </div>
  );
}