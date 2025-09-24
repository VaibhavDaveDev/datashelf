import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { 
  ErrorMessage, 
  ErrorPage, 
  ErrorBanner, 
  ErrorFallback 
} from '../Error';

describe('ErrorMessage', () => {
  it('renders error message with default title', () => {
    render(<ErrorMessage message="Test error message" />);
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<ErrorMessage title="Custom Error" message="Test error message" />);
    
    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('applies error variant styles by default', () => {
    const { container } = render(<ErrorMessage message="Test error" />);
    const errorDiv = container.firstChild;
    
    expect(errorDiv).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800');
  });

  it('applies warning variant styles', () => {
    const { container } = render(<ErrorMessage message="Test warning" variant="warning" />);
    const errorDiv = container.firstChild;
    
    expect(errorDiv).toHaveClass('bg-yellow-50', 'border-yellow-200', 'text-yellow-800');
  });

  it('applies info variant styles', () => {
    const { container } = render(<ErrorMessage message="Test info" variant="info" />);
    const errorDiv = container.firstChild;
    
    expect(errorDiv).toHaveClass('bg-blue-50', 'border-blue-200', 'text-blue-800');
  });

  it('applies custom className', () => {
    const { container } = render(<ErrorMessage message="Test error" className="custom-class" />);
    const errorDiv = container.firstChild;
    
    expect(errorDiv).toHaveClass('custom-class');
  });
});

describe('ErrorPage', () => {
  it('renders default error page content', () => {
    render(<ErrorPage />);
    
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument();
  });

  it('renders custom title and message', () => {
    render(
      <ErrorPage 
        title="Custom Error Title" 
        message="Custom error message" 
      />
    );
    
    expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('shows retry button by default', () => {
    const onRetry = vi.fn();
    render(<ErrorPage onRetry={onRetry} />);
    
    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows home button by default', () => {
    const onGoHome = vi.fn();
    render(<ErrorPage onGoHome={onGoHome} />);
    
    const homeButton = screen.getByText('Go Home');
    expect(homeButton).toBeInTheDocument();
    
    fireEvent.click(homeButton);
    expect(onGoHome).toHaveBeenCalledOnce();
  });

  it('shows back button when enabled', () => {
    const onGoBack = vi.fn();
    render(<ErrorPage onGoBack={onGoBack} showBack={true} />);
    
    const backButton = screen.getByText('Go Back');
    expect(backButton).toBeInTheDocument();
    
    fireEvent.click(backButton);
    expect(onGoBack).toHaveBeenCalledOnce();
  });

  it('hides buttons when disabled', () => {
    render(
      <ErrorPage 
        showRetry={false} 
        showHome={false} 
        showBack={false} 
      />
    );
    
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    expect(screen.queryByText('Go Home')).not.toBeInTheDocument();
    expect(screen.queryByText('Go Back')).not.toBeInTheDocument();
  });
});

describe('ErrorBanner', () => {
  it('renders error message', () => {
    render(<ErrorBanner message="Banner error message" />);
    
    expect(screen.getByText('Banner error message')).toBeInTheDocument();
  });

  it('shows dismiss button by default', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="Test error" onDismiss={onDismiss} />);
    
    const dismissButton = screen.getByLabelText('Dismiss');
    expect(dismissButton).toBeInTheDocument();
    
    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('shows retry button when provided', () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Test error" onRetry={onRetry} />);
    
    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('hides dismiss button when not dismissible', () => {
    render(<ErrorBanner message="Test error" dismissible={false} />);
    
    expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ErrorBanner message="Test error" className="custom-class" />);
    const banner = container.firstChild;
    
    expect(banner).toHaveClass('custom-class');
  });
});

describe('ErrorFallback', () => {
  const mockError = new Error('Test error message');
  const mockResetError = vi.fn();

  beforeEach(() => {
    mockResetError.mockClear();
  });

  it('renders error fallback with error message', () => {
    render(<ErrorFallback error={mockError} resetError={mockResetError} />);
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('shows try again button', () => {
    render(<ErrorFallback error={mockError} resetError={mockResetError} />);
    
    const tryAgainButton = screen.getByText('Try again');
    expect(tryAgainButton).toBeInTheDocument();
    
    fireEvent.click(tryAgainButton);
    expect(mockResetError).toHaveBeenCalledOnce();
  });

  it('shows error details in collapsible section', () => {
    render(<ErrorFallback error={mockError} resetError={mockResetError} />);
    
    const detailsToggle = screen.getByText('Error details');
    expect(detailsToggle).toBeInTheDocument();
    
    // Click to expand details
    fireEvent.click(detailsToggle);
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ErrorFallback 
        error={mockError} 
        resetError={mockResetError} 
        className="custom-class" 
      />
    );
    const fallback = container.firstChild;
    
    expect(fallback).toHaveClass('custom-class');
  });
});