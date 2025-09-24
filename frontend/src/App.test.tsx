import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from '@/components/common';
import { HomePage, CategoryPage, ProductPage, NotFoundPage } from '@/pages';

// Mock the API service
vi.mock('@/services/api', () => ({
  apiService: {
    getNavigation: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue({ total: 0, items: [] }),
    getProducts: vi.fn().mockResolvedValue({ total: 0, items: [] }),
    getProductDetail: vi.fn().mockResolvedValue(null),
  },
}));

const TestApp = ({ initialEntries = ['/'] }: { initialEntries?: string[] }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/category/:categoryId" element={<CategoryPage />} />
              <Route path="/product/:productId" element={<ProductPage />} />
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </MemoryRouter>
        </ErrorBoundary>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

describe('App', () => {
  it('renders home page by default', () => {
    render(<TestApp />);
    expect(screen.getByText('Welcome to DataShelf')).toBeInTheDocument();
  });

  it('renders 404 page for unknown routes', () => {
    render(<TestApp initialEntries={['/unknown-route']} />);
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });
});