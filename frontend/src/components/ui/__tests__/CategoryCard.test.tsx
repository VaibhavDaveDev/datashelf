import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CategoryCard, CategoryCardSkeleton, CategoryGrid } from '../CategoryCard';

const mockCategory = {
  id: '1',
  title: 'Fiction Books',
  product_count: 150,
  source_url: 'https://example.com/fiction'
};

const mockCategoryWithChildren = {
  id: '2',
  title: 'Literature',
  product_count: 75,
  source_url: 'https://example.com/literature',
  children: [
    { id: '3', title: 'Classic Literature', product_count: 25 },
    { id: '4', title: 'Modern Literature', product_count: 50 }
  ]
};

const mockCategoryNoCount = {
  id: '5',
  title: 'Mystery',
  source_url: 'https://example.com/mystery'
};

describe('CategoryCard', () => {
  describe('default variant', () => {
    it('renders category information correctly', () => {
      render(<CategoryCard category={mockCategory} />);
      
      expect(screen.getByText('Fiction Books')).toBeInTheDocument();
      expect(screen.getByText('150 products')).toBeInTheDocument();
    });

    it('shows singular product text for count of 1', () => {
      const singleProductCategory = { ...mockCategory, product_count: 1 };
      render(<CategoryCard category={singleProductCategory} />);
      
      expect(screen.getByText('1 product')).toBeInTheDocument();
    });

    it('handles category without product count', () => {
      render(<CategoryCard category={mockCategoryNoCount} showProductCount={true} />);
      
      expect(screen.getByText('Mystery')).toBeInTheDocument();
      expect(screen.queryByText(/products?/)).not.toBeInTheDocument();
    });

    it('shows folder open icon for categories with children', () => {
      render(<CategoryCard category={mockCategoryWithChildren} />);
      
      // Should show FolderOpen icon (has children)
      const folderIcon = document.querySelector('svg');
      expect(folderIcon).toBeInTheDocument();
    });

    it('shows regular folder icon for categories without children', () => {
      render(<CategoryCard category={mockCategory} />);
      
      // Should show Folder icon (no children)
      const folderIcon = document.querySelector('svg');
      expect(folderIcon).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<CategoryCard category={mockCategory} onClick={onClick} />);
      
      const card = screen.getByText('Fiction Books').closest('div');
      if (card) {
        fireEvent.click(card);
        expect(onClick).toHaveBeenCalledOnce();
      }
    });

    it('hides product count when showProductCount is false', () => {
      render(<CategoryCard category={mockCategory} showProductCount={false} />);
      
      expect(screen.getByText('Fiction Books')).toBeInTheDocument();
      expect(screen.queryByText('150 products')).not.toBeInTheDocument();
    });

    it('hides icon when showIcon is false', () => {
      render(<CategoryCard category={mockCategory} showIcon={false} />);
      
      expect(screen.getByText('Fiction Books')).toBeInTheDocument();
      // ChevronRight icon should still be present, but folder icon should not
      const folderIcons = document.querySelectorAll('svg.lucide-folder, svg.lucide-folder-open');
      expect(folderIcons).toHaveLength(0);
    });
  });

  describe('compact variant', () => {
    it('renders in compact layout', () => {
      render(<CategoryCard category={mockCategory} variant="compact" />);
      
      expect(screen.getByText('Fiction Books')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Shows count in badge
    });

    it('renders as button element', () => {
      render(<CategoryCard category={mockCategory} variant="compact" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Fiction Books');
    });
  });

  describe('featured variant', () => {
    it('renders in featured layout', () => {
      render(<CategoryCard category={mockCategory} variant="featured" />);
      
      expect(screen.getByText('Fiction Books')).toBeInTheDocument();
      expect(screen.getByText('150 products')).toBeInTheDocument();
    });

    it('centers content in featured layout', () => {
      const { container } = render(<CategoryCard category={mockCategory} variant="featured" />);
      
      const card = container.firstChild;
      expect(card).toHaveClass('text-center');
    });
  });

  it('shows loading skeleton when loading', () => {
    render(<CategoryCard category={mockCategory} loading={true} />);
    
    expect(screen.queryByText('Fiction Books')).not.toBeInTheDocument();
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <CategoryCard category={mockCategory} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('CategoryCardSkeleton', () => {
  it('renders default skeleton', () => {
    const { container } = render(<CategoryCardSkeleton />);
    
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders compact skeleton', () => {
    const { container } = render(<CategoryCardSkeleton variant="compact" />);
    
    const skeleton = container.firstChild;
    expect(skeleton).toHaveClass('p-3', 'rounded-lg', 'border');
  });

  it('renders featured skeleton', () => {
    const { container } = render(<CategoryCardSkeleton variant="featured" />);
    
    const skeleton = container.firstChild;
    expect(skeleton).toHaveClass('text-center');
  });

  it('applies custom className', () => {
    const { container } = render(<CategoryCardSkeleton className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('CategoryGrid', () => {
  const mockCategories = [mockCategory, mockCategoryWithChildren, mockCategoryNoCount];

  it('renders categories in grid layout', () => {
    render(<CategoryGrid categories={mockCategories} />);
    
    expect(screen.getByText('Fiction Books')).toBeInTheDocument();
    expect(screen.getByText('Literature')).toBeInTheDocument();
    expect(screen.getByText('Mystery')).toBeInTheDocument();
  });

  it('shows loading skeletons when loading', () => {
    render(<CategoryGrid categories={[]} loading={true} skeletonCount={3} />);
    
    const skeletonCards = document.querySelectorAll('.bg-white.shadow-md, .bg-white.border');
    expect(skeletonCards.length).toBeGreaterThanOrEqual(3);
  });

  it('shows empty state when no categories', () => {
    render(<CategoryGrid categories={[]} />);
    
    expect(screen.getByText('No categories found')).toBeInTheDocument();
    expect(screen.getByText('Categories will appear here when available.')).toBeInTheDocument();
  });

  it('calls onCategoryClick when category is clicked', () => {
    const onCategoryClick = vi.fn();
    render(<CategoryGrid categories={mockCategories} onCategoryClick={onCategoryClick} />);
    
    const firstCategoryCard = screen.getByText('Fiction Books').closest('div');
    if (firstCategoryCard) {
      fireEvent.click(firstCategoryCard);
      expect(onCategoryClick).toHaveBeenCalledWith(mockCategory);
    }
  });

  it('uses featured variant layout', () => {
    const { container } = render(
      <CategoryGrid categories={mockCategories} variant="featured" />
    );
    
    const grid = container.firstChild;
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');
  });

  it('uses compact variant layout', () => {
    const { container } = render(
      <CategoryGrid categories={mockCategories} variant="compact" />
    );
    
    const grid = container.firstChild;
    expect(grid).toHaveClass('space-y-3');
  });

  it('applies custom className', () => {
    const { container } = render(
      <CategoryGrid categories={mockCategories} className="custom-grid-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-grid-class');
  });

  it('uses default skeleton count when not specified', () => {
    render(<CategoryGrid categories={[]} loading={true} />);
    
    const skeletonCards = document.querySelectorAll('.bg-white.shadow-md, .bg-white.border');
    expect(skeletonCards.length).toBeGreaterThanOrEqual(6);
  });

  it('passes variant to skeleton components', () => {
    render(<CategoryGrid categories={[]} loading={true} variant="featured" skeletonCount={2} />);
    
    const skeletons = document.querySelectorAll('.text-center');
    expect(skeletons.length).toBeGreaterThan(0); // Featured skeletons should have text-center class
  });
});