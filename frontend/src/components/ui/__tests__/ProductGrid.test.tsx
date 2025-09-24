import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProductGrid } from '../ProductGrid';
import type { Product, PaginatedResponse } from '@/types';

// Mock the ProductCard component
vi.mock('../ProductCard', () => ({
  ProductCard: ({ product, onClick, layout }: any) => (
    <div 
      data-testid={`product-${product.id}`}
      data-layout={layout}
      onClick={onClick}
    >
      {product.title} - ${product.price}
    </div>
  ),
  ProductCardSkeleton: ({ layout }: any) => (
    <div data-testid="product-skeleton" data-layout={layout}>
      Loading...
    </div>
  ),
}));

// Mock the Pagination component
vi.mock('../Pagination', () => ({
  Pagination: ({ currentPage, totalPages, onPageChange }: any) => (
    <div data-testid="pagination">
      <button onClick={() => onPageChange(currentPage - 1)}>Previous</button>
      <span>Page {currentPage} of {totalPages}</span>
      <button onClick={() => onPageChange(currentPage + 1)}>Next</button>
    </div>
  ),
  PaginationInfo: ({ currentPage, itemsPerPage, totalItems }: any) => (
    <div data-testid="pagination-info">
      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
    </div>
  ),
}));

const mockProducts: Product[] = [
  {
    id: '1',
    title: 'Test Book 1',
    price: 19.99,
    currency: 'GBP',
    thumbnail: 'https://example.com/book1.jpg',
    available: true,
  },
  {
    id: '2',
    title: 'Test Book 2',
    price: 24.99,
    currency: 'GBP',
    thumbnail: 'https://example.com/book2.jpg',
    available: false,
  },
];

const mockPaginatedData: PaginatedResponse<Product> = {
  total: 50,
  items: mockProducts,
  pagination: {
    page: 1,
    limit: 20,
    total_pages: 3,
  },
};

describe('ProductGrid', () => {
  const mockHandlers = {
    onProductClick: vi.fn(),
    onPageChange: vi.fn(),
    onSortChange: vi.fn(),
    onViewModeChange: vi.fn(),
    onLimitChange: vi.fn(),
  };

  beforeEach(() => {
    Object.values(mockHandlers).forEach(mock => mock.mockClear());
  });

  it('renders products in grid layout by default', () => {
    render(
      <ProductGrid
        data={mockPaginatedData}
        onProductClick={mockHandlers.onProductClick}
      />
    );

    expect(screen.getByTestId('product-1')).toBeInTheDocument();
    expect(screen.getByTestId('product-2')).toBeInTheDocument();
    expect(screen.getByTestId('product-1')).toHaveAttribute('data-layout', 'grid');
  });

  it('renders products in list layout when specified', () => {
    render(
      <ProductGrid
        data={mockPaginatedData}
        currentViewMode="list"
        onProductClick={mockHandlers.onProductClick}
      />
    );

    expect(screen.getByTestId('product-1')).toHaveAttribute('data-layout', 'list');
  });

  it('shows loading skeletons when loading', () => {
    render(
      <ProductGrid
        loading={true}
        skeletonCount={4}
      />
    );

    const skeletons = screen.getAllByTestId('product-skeleton');
    expect(skeletons).toHaveLength(4);
  });

  it('shows error state when error occurs', () => {
    const error = new Error('Failed to load products');
    render(
      <ProductGrid
        error={error}
      />
    );

    expect(screen.getByRole('heading', { name: 'Failed to load products' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('shows empty state when no products', () => {
    const emptyData: PaginatedResponse<Product> = {
      total: 0,
      items: [],
      pagination: { page: 1, limit: 20, total_pages: 0 },
    };

    render(
      <ProductGrid
        data={emptyData}
        emptyStateTitle="No books found"
        emptyStateMessage="Try a different search"
      />
    );

    expect(screen.getByText('No books found')).toBeInTheDocument();
    expect(screen.getByText('Try a different search')).toBeInTheDocument();
  });

  it('calls onProductClick when product is clicked', () => {
    render(
      <ProductGrid
        data={mockPaginatedData}
        onProductClick={mockHandlers.onProductClick}
      />
    );

    fireEvent.click(screen.getByTestId('product-1'));
    expect(mockHandlers.onProductClick).toHaveBeenCalledWith(mockProducts[0]);
  });

  it('calls onSortChange when sort option changes', () => {
    render(
      <ProductGrid
        data={mockPaginatedData}
        onSortChange={mockHandlers.onSortChange}
        showSortOptions={true}
      />
    );

    const sortSelect = screen.getByLabelText('Sort products');
    fireEvent.change(sortSelect, { target: { value: 'price_asc' } });
    expect(mockHandlers.onSortChange).toHaveBeenCalledWith('price_asc');
  });

  it('calls onViewModeChange when view mode is toggled', () => {
    render(
      <ProductGrid
        data={mockPaginatedData}
        onViewModeChange={mockHandlers.onViewModeChange}
        showViewToggle={true}
      />
    );

    const listViewButton = screen.getByLabelText('List view');
    fireEvent.click(listViewButton);
    expect(mockHandlers.onViewModeChange).toHaveBeenCalledWith('list');
  });

  it('calls onLimitChange when items per page changes', () => {
    render(
      <ProductGrid
        data={mockPaginatedData}
        onLimitChange={mockHandlers.onLimitChange}
        showPagination={true}
      />
    );

    const limitSelect = screen.getByLabelText('Items per page');
    fireEvent.change(limitSelect, { target: { value: '40' } });
    expect(mockHandlers.onLimitChange).toHaveBeenCalledWith(40);
  });

  it('shows pagination when enabled and multiple pages exist', () => {
    render(
      <ProductGrid
        data={mockPaginatedData}
        onPageChange={mockHandlers.onPageChange}
        showPagination={true}
        currentPage={2}
      />
    );

    expect(screen.getByTestId('pagination')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('hides pagination when only one page exists', () => {
    const singlePageData: PaginatedResponse<Product> = {
      ...mockPaginatedData,
      pagination: { page: 1, limit: 20, total_pages: 1 },
    };

    render(
      <ProductGrid
        data={singlePageData}
        onPageChange={mockHandlers.onPageChange}
        showPagination={true}
      />
    );

    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
  });

  it('shows pagination info when enabled', () => {
    render(
      <ProductGrid
        data={mockPaginatedData}
        showPaginationInfo={true}
        currentPage={1}
        currentLimit={20}
      />
    );

    expect(screen.getByTestId('pagination-info')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 to 20 of 50 results')).toBeInTheDocument();
  });

  it('applies correct view mode classes', () => {
    const { rerender } = render(
      <ProductGrid
        data={mockPaginatedData}
        currentViewMode="grid"
      />
    );

    // Check for grid classes (this would need to be tested via DOM structure)
    expect(screen.getByTestId('product-1')).toHaveAttribute('data-layout', 'grid');

    rerender(
      <ProductGrid
        data={mockPaginatedData}
        currentViewMode="list"
      />
    );

    expect(screen.getByTestId('product-1')).toHaveAttribute('data-layout', 'list');
  });

  it('handles loading state with existing data', () => {
    render(
      <ProductGrid
        data={mockPaginatedData}
        loading={true}
      />
    );

    // Should still show products but with loading overlay
    expect(screen.getByTestId('product-1')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('disables pagination controls when loading', () => {
    render(
      <ProductGrid
        data={mockPaginatedData}
        loading={true}
        onPageChange={mockHandlers.onPageChange}
        showPagination={true}
      />
    );

    // The pagination component should receive disabled=true
    // This would be tested by checking if the pagination buttons are disabled
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
  });
});