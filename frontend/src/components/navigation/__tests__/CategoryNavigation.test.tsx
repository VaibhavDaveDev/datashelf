import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { CategoryNavigation } from '../CategoryNavigation';
import { useNavigation } from '@/hooks/useNavigation';
import type { NavigationItem } from '@/types';

// Mock the useNavigation hook
vi.mock('@/hooks/useNavigation');
const mockUseNavigation = vi.mocked(useNavigation);

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/category/test-category' })
  };
});

const mockNavigationData: NavigationItem[] = [
  {
    id: 'fiction',
    title: 'Fiction',
    source_url: '/fiction',
    last_scraped_at: '2024-01-01T00:00:00Z',
    children: [
      {
        id: 'mystery',
        title: 'Mystery',
        source_url: '/fiction/mystery',
        last_scraped_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 'romance',
        title: 'Romance',
        source_url: '/fiction/romance',
        last_scraped_at: '2024-01-01T00:00:00Z'
      }
    ]
  },
  {
    id: 'non-fiction',
    title: 'Non-Fiction',
    source_url: '/non-fiction',
    last_scraped_at: '2024-01-01T00:00:00Z',
    children: [
      {
        id: 'biography',
        title: 'Biography',
        source_url: '/non-fiction/biography',
        last_scraped_at: '2024-01-01T00:00:00Z'
      }
    ]
  },
  {
    id: 'textbooks',
    title: 'Textbooks',
    source_url: '/textbooks',
    last_scraped_at: '2024-01-01T00:00:00Z'
  }
];

const renderWithProviders = (component: React.ReactElement) => {
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
};

describe('CategoryNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    mockUseNavigation.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn()
    });

    renderWithProviders(<CategoryNavigation />);
    
    expect(screen.getByText('Loading categories...')).toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    const mockRefetch = vi.fn();
    mockUseNavigation.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
      refetch: mockRefetch
    });

    renderWithProviders(<CategoryNavigation />);
    
    expect(screen.getByText('Failed to load categories')).toBeInTheDocument();
    expect(screen.getByText('Unable to load the category navigation. Please try again.')).toBeInTheDocument();
    
    const retryButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders navigation items correctly', () => {
    mockUseNavigation.mockReturnValue({
      data: mockNavigationData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });

    renderWithProviders(<CategoryNavigation />);
    
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('Fiction')).toBeInTheDocument();
    expect(screen.getByText('Non-Fiction')).toBeInTheDocument();
    expect(screen.getByText('Textbooks')).toBeInTheDocument();
  });

  it('expands and collapses categories with children', async () => {
    mockUseNavigation.mockReturnValue({
      data: mockNavigationData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });

    renderWithProviders(<CategoryNavigation />);
    
    // Initially, children should not be visible
    expect(screen.queryByText('Mystery')).not.toBeInTheDocument();
    expect(screen.queryByText('Romance')).not.toBeInTheDocument();
    
    // Click on Fiction to expand
    const fictionButton = screen.getByText('Fiction');
    fireEvent.click(fictionButton);
    
    // Children should now be visible
    await waitFor(() => {
      expect(screen.getByText('Mystery')).toBeInTheDocument();
      expect(screen.getByText('Romance')).toBeInTheDocument();
    });
    
    // Click again to collapse
    fireEvent.click(fictionButton);
    
    // Children should be hidden again
    await waitFor(() => {
      expect(screen.queryByText('Mystery')).not.toBeInTheDocument();
      expect(screen.queryByText('Romance')).not.toBeInTheDocument();
    });
  });

  it('navigates to category when clicking leaf nodes', () => {
    mockUseNavigation.mockReturnValue({
      data: mockNavigationData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });

    renderWithProviders(<CategoryNavigation />);
    
    // Click on Textbooks (leaf node)
    const textbooksButton = screen.getByText('Textbooks');
    fireEvent.click(textbooksButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/category/textbooks');
  });

  it('calls onCategorySelect when provided', () => {
    const mockOnCategorySelect = vi.fn();
    mockUseNavigation.mockReturnValue({
      data: mockNavigationData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });

    renderWithProviders(
      <CategoryNavigation onCategorySelect={mockOnCategorySelect} />
    );
    
    // Click on Textbooks (leaf node)
    const textbooksButton = screen.getByText('Textbooks');
    fireEvent.click(textbooksButton);
    
    expect(mockOnCategorySelect).toHaveBeenCalledWith('textbooks');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('filters categories based on search term', async () => {
    mockUseNavigation.mockReturnValue({
      data: mockNavigationData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });

    renderWithProviders(<CategoryNavigation showSearch={true} />);
    
    const searchInput = screen.getByPlaceholderText('Search categories...');
    
    // Search for "fiction"
    fireEvent.change(searchInput, { target: { value: 'fiction' } });
    
    await waitFor(() => {
      expect(screen.getByText('Fiction')).toBeInTheDocument();
      expect(screen.getByText('Non-Fiction')).toBeInTheDocument();
      expect(screen.queryByText('Textbooks')).not.toBeInTheDocument();
    });
  });

  it('clears search when clear button is clicked', async () => {
    mockUseNavigation.mockReturnValue({
      data: mockNavigationData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });

    renderWithProviders(<CategoryNavigation showSearch={true} />);
    
    const searchInput = screen.getByPlaceholderText('Search categories...');
    
    // Enter search term
    fireEvent.change(searchInput, { target: { value: 'fiction' } });
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('fiction')).toBeInTheDocument();
    });
    
    // Click clear button
    const clearButton = screen.getByRole('button', { name: '' }); // X button
    fireEvent.click(clearButton);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('')).toBeInTheDocument();
      expect(screen.getByText('Textbooks')).toBeInTheDocument();
    });
  });

  it('shows no results message when search yields no matches', async () => {
    mockUseNavigation.mockReturnValue({
      data: mockNavigationData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });

    renderWithProviders(<CategoryNavigation showSearch={true} />);
    
    const searchInput = screen.getByPlaceholderText('Search categories...');
    
    // Search for something that doesn't exist
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    await waitFor(() => {
      expect(screen.getByText('No categories found matching "nonexistent"')).toBeInTheDocument();
    });
  });

  it('hides search when showSearch is false', () => {
    mockUseNavigation.mockReturnValue({
      data: mockNavigationData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });

    renderWithProviders(<CategoryNavigation showSearch={false} />);
    
    expect(screen.queryByPlaceholderText('Search categories...')).not.toBeInTheDocument();
  });

  it('applies correct ARIA attributes', async () => {
    mockUseNavigation.mockReturnValue({
      data: mockNavigationData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });

    renderWithProviders(<CategoryNavigation />);
    
    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('Fiction')).toBeInTheDocument();
    });
    
    // Find the button element that contains Fiction text
    const fictionButton = screen.getByText('Fiction').closest('button');
    expect(fictionButton).toBeInTheDocument();
    
    // Fiction has children, so it should have aria-expanded
    expect(fictionButton).toHaveAttribute('aria-expanded', 'false');
    
    // Click to expand
    fireEvent.click(fictionButton!);
    
    await waitFor(() => {
      expect(fictionButton).toHaveAttribute('aria-expanded', 'true');
    });
    
    // Textbooks has no children, so it should not have aria-expanded
    const textbooksButton = screen.getByText('Textbooks').closest('button');
    expect(textbooksButton).not.toHaveAttribute('aria-expanded');
  });
});