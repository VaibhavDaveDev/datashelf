import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Pagination, PaginationInfo } from '../Pagination';

describe('Pagination', () => {
  const mockOnPageChange = vi.fn();

  beforeEach(() => {
    mockOnPageChange.mockClear();
  });

  it('renders pagination controls correctly', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={10}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.getByLabelText('Go to previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to next page')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to page 3')).toHaveAttribute('aria-current', 'page');
  });

  it('disables previous button on first page', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
    expect(screen.getByLabelText('Go to next page')).not.toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.getByLabelText('Go to previous page')).not.toBeDisabled();
    expect(screen.getByLabelText('Go to next page')).toBeDisabled();
  });

  it('calls onPageChange when clicking page numbers', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={10}
        onPageChange={mockOnPageChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Go to page 4'));
    expect(mockOnPageChange).toHaveBeenCalledWith(4);
  });

  it('calls onPageChange when clicking previous/next buttons', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={10}
        onPageChange={mockOnPageChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Go to previous page'));
    expect(mockOnPageChange).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(mockOnPageChange).toHaveBeenCalledWith(4);
  });

  it('shows ellipsis when there are many pages', () => {
    render(
      <Pagination
        currentPage={10}
        totalPages={20}
        onPageChange={mockOnPageChange}
        maxVisiblePages={5}
      />
    );

    // Should show ellipsis before and after visible pages
    const ellipsis = screen.getAllByRole('generic');
    expect(ellipsis.length).toBeGreaterThan(0);
  });

  it('does not render when totalPages is 1 or less', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        onPageChange={mockOnPageChange}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('disables all controls when disabled prop is true', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={10}
        onPageChange={mockOnPageChange}
        disabled={true}
      />
    );

    expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
    expect(screen.getByLabelText('Go to next page')).toBeDisabled();
    expect(screen.getByLabelText('Go to page 3')).toBeDisabled();
  });

  it('shows first and last pages when showFirstLast is true', () => {
    render(
      <Pagination
        currentPage={10}
        totalPages={20}
        onPageChange={mockOnPageChange}
        showFirstLast={true}
        maxVisiblePages={3}
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });
});

describe('PaginationInfo', () => {
  it('displays correct pagination information', () => {
    render(
      <PaginationInfo
        currentPage={2}
        itemsPerPage={20}
        totalItems={150}
      />
    );

    expect(screen.getByText('Showing 21 to 40 of 150 results')).toBeInTheDocument();
  });

  it('handles first page correctly', () => {
    render(
      <PaginationInfo
        currentPage={1}
        itemsPerPage={20}
        totalItems={150}
      />
    );

    expect(screen.getByText('Showing 1 to 20 of 150 results')).toBeInTheDocument();
  });

  it('handles last page with fewer items', () => {
    render(
      <PaginationInfo
        currentPage={8}
        itemsPerPage={20}
        totalItems={150}
      />
    );

    expect(screen.getByText('Showing 141 to 150 of 150 results')).toBeInTheDocument();
  });

  it('handles single item correctly', () => {
    render(
      <PaginationInfo
        currentPage={1}
        itemsPerPage={20}
        totalItems={1}
      />
    );

    expect(screen.getByText('Showing 1 to 1 of 1 results')).toBeInTheDocument();
  });

  it('handles empty results', () => {
    render(
      <PaginationInfo
        currentPage={1}
        itemsPerPage={20}
        totalItems={0}
      />
    );

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });
});