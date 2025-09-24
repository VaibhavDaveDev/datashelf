import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductPage } from '../ProductPage';
import { ProductDetail as ProductDetailType } from '@/types/product';

// Mock the hooks and components
vi.mock('@/hooks/useProductDetail');
vi.mock('@/components/ui', () => ({
  Loading: ({ text }: { text: string }) => <div data-testid="loading">{text}</div>,
  ErrorMessage: ({ title, message, onRetry }: any) => (
    <div data-testid="error">
      <h2>{title}</h2>
      <p>{message}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
  ProductDetail: ({ product }: { product: ProductDetailType }) => (
    <div data-testid="product-detail">
      <h1>{product.title}</h1>
      <p>{product.price}</p>
    </div>
  ),
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/layout', () => ({
  Layout: ({ children, onCategorySelect }: any) => (
    <div data-testid="layout">
      <button onClick={() => onCategorySelect('test-category')}>Select Category</button>
      {children}
    </div>
  ),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ productId: 'test-product-id' }),
    useNavigate: () => mockNavigate,
  };
});

const mockProduct: ProductDetailType = {
  id: 'test-product-id',
  title: 'Test Book',
  price: 19.99,
  currency: 'GBP',
  thumbnail: 'https://example.com/thumbnail.jpg',
  available: true,
  image_urls: ['https://example.com/image1.jpg'],
  summary: 'A test book description',
  specs: {
    author: 'Test Author',
    isbn: '123-456-789',
  },
  source_url: 'https://worldofbooks.com/test',
  last_scraped_at: '2024-01-15T10:30:00Z',
};

function renderWithProviders(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('ProductPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching product', async () => {
    const { useProductDetail } = await import('@/hooks/useProductDetail');
    vi.mocked(useProductDetail).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithProviders(<ProductPage />);

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.getByText('Loading product details...')).toBeInTheDocument();
  });

  it('shows error state when product fetch fails', async () => {
    const mockRefetch = vi.fn();
    const { useProductDetail } = await import('@/hooks/useProductDetail');
    vi.mocked(useProductDetail).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: mockRefetch,
    } as any);

    renderWithProviders(<ProductPage />);

    expect(screen.getByTestId('error')).toBeInTheDocument();
    expect(screen.getByText('Product not found')).toBeInTheDocument();
    expect(screen.getByText(/Unable to load product details/)).toBeInTheDocument();
  });

  it('shows error state when product is null', async () => {
    const { useProductDetail } = await import('@/hooks/useProductDetail');
    vi.mocked(useProductDetail).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithProviders(<ProductPage />);

    expect(screen.getByTestId('error')).toBeInTheDocument();
    expect(screen.getByText('Product not found')).toBeInTheDocument();
  });

  it('renders product detail when data is loaded', async () => {
    const { useProductDetail } = await import('@/hooks/useProductDetail');
    vi.mocked(useProductDetail).mockReturnValue({
      data: mockProduct,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithProviders(<ProductPage />);

    expect(screen.getByTestId('product-detail')).toBeInTheDocument();
    expect(screen.getByText('Test Book')).toBeInTheDocument();
  });

  it('calls refetch when retry button is clicked', async () => {
    const mockRefetch = vi.fn();
    const { useProductDetail } = await import('@/hooks/useProductDetail');
    vi.mocked(useProductDetail).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: mockRefetch,
    } as any);

    renderWithProviders(<ProductPage />);

    const retryButton = screen.getByText('Retry');
    retryButton.click();

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('navigates to category when category is selected', async () => {
    const { useProductDetail } = await import('@/hooks/useProductDetail');
    vi.mocked(useProductDetail).mockReturnValue({
      data: mockProduct,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithProviders(<ProductPage />);

    const categoryButton = screen.getByText('Select Category');
    categoryButton.click();

    expect(mockNavigate).toHaveBeenCalledWith('/category/test-category');
  });

  it('passes correct productId to useProductDetail hook', async () => {
    const { useProductDetail } = await import('@/hooks/useProductDetail');
    const mockUseProductDetail = vi.mocked(useProductDetail);
    mockUseProductDetail.mockReturnValue({
      data: mockProduct,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithProviders(<ProductPage />);

    expect(mockUseProductDetail).toHaveBeenCalledWith('test-product-id');
  });

  it('renders layout with sidebar enabled', async () => {
    const { useProductDetail } = await import('@/hooks/useProductDetail');
    vi.mocked(useProductDetail).mockReturnValue({
      data: mockProduct,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithProviders(<ProductPage />);

    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });
});