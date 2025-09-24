import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { 
  LoadingSpinner, 
  LoadingDots, 
  LoadingSkeleton, 
  LoadingCardSkeleton, 
  LoadingPage, 
  LoadingOverlay 
} from '../Loading';

describe('LoadingSpinner', () => {
  it('renders spinner correctly', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('svg');
    
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin', 'text-primary-600');
  });

  it('applies different sizes', () => {
    const { container: smContainer } = render(<LoadingSpinner size="sm" />);
    const { container: lgContainer } = render(<LoadingSpinner size="lg" />);
    const { container: xlContainer } = render(<LoadingSpinner size="xl" />);
    
    expect(smContainer.querySelector('svg')).toHaveClass('h-4', 'w-4');
    expect(lgContainer.querySelector('svg')).toHaveClass('h-8', 'w-8');
    expect(xlContainer.querySelector('svg')).toHaveClass('h-12', 'w-12');
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);
    const spinner = container.querySelector('svg');
    
    expect(spinner).toHaveClass('custom-class');
  });
});

describe('LoadingDots', () => {
  it('renders three dots', () => {
    const { container } = render(<LoadingDots />);
    const dots = container.querySelectorAll('.animate-bounce');
    
    expect(dots).toHaveLength(3);
  });

  it('applies bounce animation to dots', () => {
    const { container } = render(<LoadingDots />);
    const dots = container.querySelectorAll('.animate-bounce');
    
    dots.forEach(dot => {
      expect(dot).toHaveClass('animate-bounce');
    });
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingDots className="custom-class" />);
    const wrapper = container.firstChild;
    
    expect(wrapper).toHaveClass('custom-class');
  });
});

describe('LoadingSkeleton', () => {
  it('renders single line by default', () => {
    const { container } = render(<LoadingSkeleton />);
    const lines = container.querySelectorAll('.bg-secondary-200');
    
    expect(lines).toHaveLength(1);
  });

  it('renders multiple lines when specified', () => {
    const { container } = render(<LoadingSkeleton lines={3} />);
    const lines = container.querySelectorAll('.bg-secondary-200');
    
    expect(lines).toHaveLength(3);
  });

  it('applies pulse animation', () => {
    const { container } = render(<LoadingSkeleton />);
    const wrapper = container.firstChild;
    
    expect(wrapper).toHaveClass('animate-pulse');
  });

  it('makes last line shorter when multiple lines', () => {
    const { container } = render(<LoadingSkeleton lines={3} />);
    const lines = container.querySelectorAll('div > div');
    const lastLine = lines[lines.length - 1];
    
    expect(lastLine).toHaveClass('w-3/4');
  });
});

describe('LoadingCardSkeleton', () => {
  it('renders card skeleton structure', () => {
    const { container } = render(<LoadingCardSkeleton />);
    const card = container.firstChild;
    
    expect(card).toHaveClass('animate-pulse', 'bg-white', 'rounded-lg', 'border');
  });

  it('contains image and text skeletons', () => {
    const { container } = render(<LoadingCardSkeleton />);
    const imageArea = container.querySelector('.aspect-square');
    const textLines = container.querySelectorAll('.space-y-2 > div');
    
    expect(imageArea).toBeInTheDocument();
    expect(textLines.length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingCardSkeleton className="custom-class" />);
    const card = container.firstChild;
    
    expect(card).toHaveClass('custom-class');
  });
});

describe('LoadingPage', () => {
  it('renders default loading message', () => {
    render(<LoadingPage />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders custom loading message', () => {
    render(<LoadingPage message="Please wait..." />);
    
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('contains loading spinner', () => {
    const { container } = render(<LoadingPage />);
    const spinner = container.querySelector('svg');
    
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin');
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingPage className="custom-class" />);
    const wrapper = container.firstChild;
    
    expect(wrapper).toHaveClass('custom-class');
  });
});

describe('LoadingOverlay', () => {
  it('renders when visible', () => {
    render(<LoadingOverlay isVisible={true} />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('does not render when not visible', () => {
    render(<LoadingOverlay isVisible={false} />);
    
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<LoadingOverlay isVisible={true} message="Processing..." />);
    
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('applies overlay styles when visible', () => {
    const { container } = render(<LoadingOverlay isVisible={true} />);
    const overlay = container.firstChild;
    
    expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-black', 'bg-opacity-50', 'z-50');
  });

  it('contains loading spinner when visible', () => {
    const { container } = render(<LoadingOverlay isVisible={true} />);
    const spinner = container.querySelector('svg');
    
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin');
  });
});