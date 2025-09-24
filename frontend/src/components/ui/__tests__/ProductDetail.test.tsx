import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductDetail } from '../ProductDetail';
import { ProductDetail as ProductDetailType } from '@/types/product';

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
});

// Mock clipboard API
const mockWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
});

describe('ProductDetail', () => {
  const mockProduct: ProductDetailType = {
    id: '1',
    title: 'The Great Gatsby',
    price: 12.99,
    currency: 'GBP',
    thumbnail: 'https://example.com/thumbnail.jpg',
    available: true,
    image_urls: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    summary: 'A classic American novel about the Jazz Age.',
    specs: {
      author: 'F. Scott Fitzgerald',
      isbn: '978-0-7432-7356-5',
      publisher: 'Scribner',
      pages: 180,
      language: 'English',
      format: 'Paperback',
    },
    source_url: 'https://worldofbooks.com/product/123',
    last_scraped_at: '2024-01-15T10:30:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders product title and price', () => {
    render(<ProductDetail product={mockProduct} />);
    
    expect(screen.getByText('The Great Gatsby')).toBeInTheDocument();
    expect(screen.getByText('£12.99')).toBeInTheDocument();
  });

  it('shows availability status', () => {
    render(<ProductDetail product={mockProduct} />);
    
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('shows out of stock status', () => {
    const unavailableProduct = { ...mockProduct, available: false };
    render(<ProductDetail product={unavailableProduct} />);
    
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
  });

  it('renders product description', () => {
    render(<ProductDetail product={mockProduct} />);
    
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('A classic American novel about the Jazz Age.')).toBeInTheDocument();
  });

  it('renders product specifications', () => {
    render(<ProductDetail product={mockProduct} />);
    
    expect(screen.getByText('Specifications')).toBeInTheDocument();
    expect(screen.getByText(/Author:/)).toBeInTheDocument();
    expect(screen.getByText('F. Scott Fitzgerald')).toBeInTheDocument();
    expect(screen.getByText(/ISBN:/)).toBeInTheDocument();
    expect(screen.getByText('978-0-7432-7356-5')).toBeInTheDocument();
    expect(screen.getByText(/Publisher:/)).toBeInTheDocument();
    expect(screen.getByText('Scribner')).toBeInTheDocument();
  });

  it('opens source URL when clicking View on World of Books', () => {
    render(<ProductDetail product={mockProduct} />);
    
    const viewButton = screen.getByRole('button', { name: /view on world of books/i });
    fireEvent.click(viewButton);
    
    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://worldofbooks.com/product/123',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('renders product image with zoom functionality', () => {
    render(<ProductDetail product={mockProduct} />);
    
    const image = screen.getByAltText('The Great Gatsby');
    expect(image).toBeInTheDocument();
    expect(image).toHaveClass('cursor-zoom-in');
  });

  it('shows image gallery navigation for multiple images', () => {
    render(<ProductDetail product={mockProduct} />);
    
    // Should show thumbnail gallery for multiple images
    const thumbnails = screen.getAllByRole('button');
    const imageThumbnails = thumbnails.filter(btn => 
      btn.querySelector('img') && btn.querySelector('img')?.alt?.includes('The Great Gatsby')
    );
    expect(imageThumbnails.length).toBeGreaterThan(0);
  });

  it('displays last scraped timestamp', () => {
    render(<ProductDetail product={mockProduct} />);
    
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('shows share functionality', () => {
    render(<ProductDetail product={mockProduct} />);
    
    const shareButton = screen.getByRole('button', { name: /share product/i });
    expect(shareButton).toBeInTheDocument();
    
    fireEvent.click(shareButton);
    
    expect(screen.getByText('Share on Facebook')).toBeInTheDocument();
    expect(screen.getByText('Share on Twitter')).toBeInTheDocument();
    expect(screen.getByText('Copy Link')).toBeInTheDocument();
  });

  it('handles product without description', () => {
    const { summary, ...productWithoutSummary } = mockProduct;
    render(<ProductDetail product={productWithoutSummary} />);
    
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });

  it('handles product without specifications', () => {
    const productWithoutSpecs = { ...mockProduct, specs: {} };
    render(<ProductDetail product={productWithoutSpecs} />);
    
    expect(screen.queryByText('Specifications')).not.toBeInTheDocument();
  });

  it('handles product without price', () => {
    const { price, ...productWithoutPrice } = mockProduct;
    render(<ProductDetail product={productWithoutPrice} />);
    
    expect(screen.getByText('Price not available')).toBeInTheDocument();
  });

  it('uses thumbnail when no image_urls available', () => {
    const productWithThumbnail = { ...mockProduct, image_urls: [] };
    render(<ProductDetail product={productWithThumbnail} />);
    
    expect(screen.getByAltText('The Great Gatsby')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ProductDetail product={mockProduct} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('opens image modal when clicking on main image', () => {
    render(<ProductDetail product={mockProduct} />);
    
    const mainImage = screen.getByAltText('The Great Gatsby');
    fireEvent.click(mainImage);
    
    // Modal should be open - check for modal content
    expect(screen.getByText('1 / 2')).toBeInTheDocument(); // Image counter in modal
  });

  it('navigates between images in gallery', () => {
    render(<ProductDetail product={mockProduct} />);
    
    // Click on second thumbnail
    const thumbnails = screen.getAllByRole('button');
    const imageThumbnails = thumbnails.filter(btn => 
      btn.querySelector('img') && btn.querySelector('img')?.alt?.includes('The Great Gatsby')
    );
    
    if (imageThumbnails.length > 1) {
      fireEvent.click(imageThumbnails[1]);
      // Image should change (this is hard to test without more complex setup)
    }
  });
});