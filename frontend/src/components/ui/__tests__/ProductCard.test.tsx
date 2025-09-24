import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProductCard, ProductCardSkeleton, ProductGrid } from '../ProductCard';

const mockProduct = {
  id: '1',
  title: 'Test Book Title',
  price: 19.99,
  currency: 'GBP',
  thumbnail: 'https://example.com/image.jpg',
  available: true,
  source_url: 'https://example.com/book'
};

const mockUnavailableProduct = {
  ...mockProduct,
  id: '2',
  available: false
};

const mockProductNoPriceNoUrl = {
  id: '3',
  title: 'Book Without Price',
  thumbnail: 'https://example.com/image2.jpg',
  available: true
};

describe('ProductCard', () => {
  it('renders product information correctly', () => {
    render(<ProductCard product={mockProduct} />);
    
    expect(screen.getByText('Test Book Title')).toBeInTheDocument();
    expect(screen.getByText('GBP 19.99')).toBeInTheDocument();
    expect(screen.getByText('In Stock')).toBeInTheDocument();
  });

  it('handles product without price', () => {
    render(<ProductCard product={mockProductNoPriceNoUrl} />);
    
    expect(screen.getByText('Book Without Price')).toBeInTheDocument();
    expect(screen.getByText('Price not available')).toBeInTheDocument();
  });

  it('shows out of stock for unavailable products', () => {
    render(<ProductCard product={mockUnavailableProduct} />);
    
    const outOfStockElements = screen.getAllByText('Out of Stock');
    expect(outOfStockElements).toHaveLength(2); // Badge and status
  });

  it('calls onClick when card is clicked', () => {
    const onClick = vi.fn();
    render(<ProductCard product={mockProduct} onClick={onClick} />);
    
    const card = screen.getByText('Test Book Title').closest('div[role="button"], div')?.parentElement;
    if (card) {
      fireEvent.click(card);
      expect(onClick).toHaveBeenCalledOnce();
    }
  });

  it('opens source URL when view source button is clicked', () => {
    const originalOpen = window.open;
    window.open = vi.fn();
    
    render(<ProductCard product={mockProduct} />);
    
    // Hover to show overlay buttons
    const card = screen.getByText('Test Book Title').closest('div')?.parentElement;
    if (card) {
      fireEvent.mouseEnter(card);
    }
    
    const buttons = screen.getAllByRole('button');
    const externalLinkButton = buttons.find(button => button.querySelector('svg.lucide-external-link'));
    if (externalLinkButton) {
      fireEvent.click(externalLinkButton);
    }
    
    expect(window.open).toHaveBeenCalledWith(
      'https://example.com/book',
      '_blank',
      'noopener,noreferrer'
    );
    
    window.open = originalOpen;
  });

  it('handles image load error with fallback', () => {
    render(<ProductCard product={mockProduct} />);
    
    const image = screen.getByAltText('Test Book Title');
    fireEvent.error(image);
    
    expect(image).toHaveAttribute('src', '/placeholder-book.jpg');
  });

  it('does not show actions when showActions is false', () => {
    render(<ProductCard product={mockProduct} showActions={false} />);
    
    // Actions should not be visible even on hover
    const card = screen.getByText('Test Book Title').closest('div')?.parentElement;
    if (card) {
      fireEvent.mouseEnter(card);
    }
    
    expect(screen.queryByText('View Details')).not.toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    render(<ProductCard product={mockProduct} loading={true} />);
    
    expect(screen.queryByText('Test Book Title')).not.toBeInTheDocument();
    // Should show skeleton instead
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ProductCard product={mockProduct} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('prevents card click when clicking on buttons', () => {
    const onClick = vi.fn();
    render(<ProductCard product={mockProduct} onClick={onClick} />);
    
    // Hover to show overlay buttons
    const card = screen.getByText('Test Book Title').closest('div')?.parentElement;
    if (card) {
      fireEvent.mouseEnter(card);
    }
    
    const viewDetailsButton = screen.getByText('View Details');
    fireEvent.click(viewDetailsButton);
    
    // onClick should not be called when clicking the button directly
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('ProductCardSkeleton', () => {
  it('renders skeleton structure', () => {
    const { container } = render(<ProductCardSkeleton />);
    
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ProductCardSkeleton className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('ProductGrid', () => {
  const mockProducts = [mockProduct, mockUnavailableProduct, mockProductNoPriceNoUrl];

  it('renders products in grid layout', () => {
    render(<ProductGrid products={mockProducts} />);
    
    expect(screen.getAllByText('Test Book Title')).toHaveLength(2); // Two products have same title
    expect(screen.getByText('Book Without Price')).toBeInTheDocument();
  });

  it('shows loading skeletons when loading', () => {
    render(<ProductGrid products={[]} loading={true} skeletonCount={3} />);
    
    const skeletonCards = document.querySelectorAll('.bg-white.shadow-md');
    expect(skeletonCards).toHaveLength(3);
  });

  it('shows empty state when no products', () => {
    render(<ProductGrid products={[]} />);
    
    expect(screen.getByText('No products found')).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your search/)).toBeInTheDocument();
  });

  it('calls onProductClick when product is clicked', () => {
    const onProductClick = vi.fn();
    render(<ProductGrid products={mockProducts} onProductClick={onProductClick} />);
    
    const firstProductCard = screen.getAllByText('Test Book Title')[0].closest('div')?.parentElement;
    if (firstProductCard) {
      fireEvent.click(firstProductCard);
      expect(onProductClick).toHaveBeenCalledWith(mockProduct);
    }
  });

  it('applies custom className', () => {
    const { container } = render(
      <ProductGrid products={mockProducts} className="custom-grid-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-grid-class');
  });

  it('uses default skeleton count when not specified', () => {
    render(<ProductGrid products={[]} loading={true} />);
    
    const skeletonCards = document.querySelectorAll('.bg-white.shadow-md');
    expect(skeletonCards).toHaveLength(8); // Default skeleton count
  });
});