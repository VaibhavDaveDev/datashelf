# DataShelf Frontend

The DataShelf frontend is a React application built with TypeScript, Tailwind CSS, and React Query. It provides a responsive interface for browsing products scraped from World of Books.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React App     │    │ Cloudflare Pages │    │ Cloudflare      │
│  (TypeScript +  │───►│   Static Hosting │───►│ Workers API     │
│   Tailwind)     │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│  React Query    │
│  State Mgmt     │
└─────────────────┘
```

## Features

- **Modern React**: Built with React 18, TypeScript, and modern hooks
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **State Management**: React Query for server state and caching
- **Performance**: Code splitting, lazy loading, and optimized builds
- **Accessibility**: WCAG 2.1 compliant with screen reader support
- **Error Handling**: Comprehensive error boundaries and retry mechanisms

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Development Setup

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API URL
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   ```
   http://localhost:3000
   ```

### Environment Variables

```bash
# API Configuration
REACT_APP_API_URL=https://api.datashelf.com
REACT_APP_API_URL_DEV=http://localhost:8787

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_ERROR_REPORTING=true

# Build Configuration
GENERATE_SOURCEMAP=false
REACT_APP_VERSION=$npm_package_version
```

## Project Structure

```
frontend/
├── public/                 # Static assets
│   ├── index.html         # HTML template
│   ├── favicon.ico        # Favicon
│   └── _redirects         # Cloudflare Pages redirects
├── src/
│   ├── components/        # React components
│   │   ├── common/        # Shared components
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   └── OfflineNotice.tsx
│   │   ├── layout/        # Layout components
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   └── ui/            # UI components
│   │       ├── ProductCard.tsx
│   │       ├── ProductGrid.tsx
│   │       └── ProductDetail.tsx
│   ├── pages/             # Page components
│   │   ├── HomePage.tsx
│   │   ├── CategoryPage.tsx
│   │   └── ProductPage.tsx
│   ├── hooks/             # Custom React hooks
│   │   ├── useCategories.ts
│   │   ├── useProducts.ts
│   │   └── useProductDetail.ts
│   ├── services/          # API services
│   │   ├── api.ts
│   │   └── types.ts
│   ├── utils/             # Utility functions
│   │   ├── api-client.ts
│   │   ├── formatting.ts
│   │   └── validation.ts
│   ├── styles/            # Global styles
│   │   └── index.css
│   ├── App.tsx            # Main app component
│   └── index.tsx          # Entry point
├── tailwind.config.js     # Tailwind configuration
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite configuration
└── package.json
```

## Components

### Core Components

#### ProductCard

Displays product summary information in grid layouts.

```typescript
interface ProductCardProps {
  product: {
    id: string;
    title: string;
    price?: number;
    currency?: string;
    thumbnail?: string;
    available: boolean;
  };
  onClick: () => void;
  className?: string;
}

export function ProductCard({ product, onClick, className }: ProductCardProps) {
  return (
    <div 
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer ${className}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
    >
      <div className="aspect-w-3 aspect-h-4">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.title}
            className="w-full h-48 object-cover rounded-t-lg"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-48 bg-gray-200 rounded-t-lg flex items-center justify-center">
            <span className="text-gray-400">No Image</span>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
          {product.title}
        </h3>
        
        {product.price && (
          <p className="text-lg font-bold text-green-600">
            {product.currency === 'GBP' ? '£' : '$'}{product.price.toFixed(2)}
          </p>
        )}
        
        <div className="mt-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            product.available 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {product.available ? 'Available' : 'Out of Stock'}
          </span>
        </div>
      </div>
    </div>
  );
}
```

#### ProductGrid

Displays products in a responsive grid layout.

```typescript
interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  error?: string;
  onProductClick: (productId: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function ProductGrid({ 
  products, 
  loading, 
  error, 
  onProductClick, 
  onLoadMore, 
  hasMore 
}: ProductGridProps) {
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onClick={() => onProductClick(product.id)}
          />
        ))}
        
        {loading && (
          Array.from({ length: 8 }).map((_, index) => (
            <ProductCardSkeleton key={`skeleton-${index}`} />
          ))
        )}
      </div>
      
      {hasMore && !loading && (
        <div className="text-center mt-8">
          <button
            onClick={onLoadMore}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Load More Products
          </button>
        </div>
      )}
    </div>
  );
}
```

#### ProductDetail

Displays comprehensive product information.

```typescript
interface ProductDetailProps {
  productId: string;
}

export function ProductDetail({ productId }: ProductDetailProps) {
  const { data: product, isLoading, error } = useProductDetail(productId);
  
  if (isLoading) return <ProductDetailSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!product) return <NotFound />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          <div className="aspect-w-1 aspect-h-1">
            <img
              src={product.image_urls[0] || '/placeholder.jpg'}
              alt={product.title}
              className="w-full h-96 object-cover rounded-lg"
            />
          </div>
          
          {product.image_urls.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.image_urls.slice(1, 5).map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`${product.title} ${index + 2}`}
                  className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-75"
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {product.title}
            </h1>
            
            {product.price && (
              <p className="text-2xl font-bold text-green-600">
                {product.currency === 'GBP' ? '£' : '$'}{product.price.toFixed(2)}
              </p>
            )}
          </div>
          
          {product.summary && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Description</h2>
              <p className="text-gray-700 leading-relaxed">{product.summary}</p>
            </div>
          )}
          
          {/* Specifications */}
          {product.specs && Object.keys(product.specs).length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Specifications</h2>
              <dl className="grid grid-cols-1 gap-3">
                {Object.entries(product.specs).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b border-gray-200">
                    <dt className="font-medium text-gray-600 capitalize">
                      {key.replace(/_/g, ' ')}
                    </dt>
                    <dd className="text-gray-900">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          
          {/* Actions */}
          <div className="space-y-4">
            <a
              href={product.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors text-center block"
            >
              View on World of Books
            </a>
            
            <p className="text-sm text-gray-500">
              Last updated: {new Date(product.last_scraped_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Layout Components

#### Header

```typescript
export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <BookOpenIcon className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">DataShelf</span>
            </Link>
          </div>
          
          <nav className="hidden md:flex space-x-8">
            <Link 
              to="/" 
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              Home
            </Link>
            <Link 
              to="/categories" 
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              Categories
            </Link>
          </nav>
          
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-md text-gray-700 hover:text-blue-600"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
        </div>
        
        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col space-y-2">
              <Link 
                to="/" 
                className="text-gray-700 hover:text-blue-600 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link 
                to="/categories" 
                className="text-gray-700 hover:text-blue-600 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Categories
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
```

## Custom Hooks

### useProducts

```typescript
export function useProducts(options: {
  categoryId?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  available?: boolean;
}) {
  return useQuery({
    queryKey: ['products', options],
    queryFn: () => fetchProducts(options),
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
```

### useProductDetail

```typescript
export function useProductDetail(productId: string) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProductDetail(productId),
    enabled: !!productId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on 404
      if (error?.status === 404) return false;
      return failureCount < 3;
    },
  });
}
```

### useCategories

```typescript
export function useCategories(options: {
  navId?: string;
  parentId?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return useQuery({
    queryKey: ['categories', options],
    queryFn: () => fetchCategories(options),
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
  });
}
```

## API Integration

### API Client

```typescript
class APIClient {
  private baseURL: string;
  
  constructor() {
    this.baseURL = process.env.NODE_ENV === 'development' 
      ? process.env.REACT_APP_API_URL_DEV || 'http://localhost:8787'
      : process.env.REACT_APP_API_URL || 'https://api.datashelf.com';
  }
  
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        message: 'Network error' 
      }));
      throw new APIError(error.message, response.status, error.code);
    }
    
    return response.json();
  }
  
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = params 
      ? `${endpoint}?${new URLSearchParams(params)}`
      : endpoint;
    
    return this.request<T>(url);
  }
  
  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new APIClient();
```

### API Functions

```typescript
export async function fetchProducts(options: {
  categoryId?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  available?: boolean;
}): Promise<ProductsResponse> {
  const params: Record<string, string> = {};
  
  if (options.categoryId) params.categoryId = options.categoryId;
  if (options.limit) params.limit = options.limit.toString();
  if (options.offset) params.offset = options.offset.toString();
  if (options.sort) params.sort = options.sort;
  if (options.available !== undefined) params.available = options.available.toString();
  
  return apiClient.get<ProductsResponse>('/api/products', params);
}

export async function fetchProductDetail(productId: string): Promise<ProductDetail> {
  const response = await apiClient.get<{ data: ProductDetail }>(`/api/products/${productId}`);
  return response.data;
}

export async function fetchCategories(options: {
  navId?: string;
  parentId?: string;
  limit?: number;
  offset?: number;
}): Promise<CategoriesResponse> {
  const params: Record<string, string> = {};
  
  if (options.navId) params.navId = options.navId;
  if (options.parentId) params.parentId = options.parentId;
  if (options.limit) params.limit = options.limit.toString();
  if (options.offset) params.offset = options.offset.toString();
  
  return apiClient.get<CategoriesResponse>('/api/categories', params);
}
```

## State Management

### React Query Configuration

```typescript
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/category/:categoryId" element={<CategoryPage />} />
              <Route path="/product/:productId" element={<ProductPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## Styling

### Tailwind Configuration

```javascript
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      aspectRatio: {
        '3/4': '3 / 4',
      }
    },
  },
  plugins: [
    require('@tailwindcss/line-clamp'),
    require('@tailwindcss/aspect-ratio'),
  ],
}
```

### Global Styles

```css
/* src/styles/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-family: Inter, system-ui, sans-serif;
  }
  
  body {
    @apply text-gray-900 bg-gray-50;
  }
}

@layer components {
  .btn-primary {
    @apply bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors;
  }
  
  .btn-secondary {
    @apply bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors;
  }
  
  .card {
    @apply bg-white rounded-lg shadow-md p-6;
  }
  
  .skeleton {
    @apply animate-pulse bg-gray-200 rounded;
  }
}

@layer utilities {
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
```

## Error Handling

### Error Boundary

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<
  PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Report to error tracking service
    if (process.env.REACT_APP_ENABLE_ERROR_REPORTING === 'true') {
      // reportError(error, errorInfo);
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-6">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

## Performance Optimization

### Code Splitting

```typescript
import { lazy, Suspense } from 'react';

const HomePage = lazy(() => import('./pages/HomePage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));

export function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/category/:categoryId" element={<CategoryPage />} />
          <Route path="/product/:productId" element={<ProductPage />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
```

### Image Optimization

```typescript
interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

export function OptimizedImage({ 
  src, 
  alt, 
  className, 
  loading = 'lazy' 
}: OptimizedImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  return (
    <div className={`relative ${className}`}>
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 skeleton" />
      )}
      
      {imageError ? (
        <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
          <span className="text-gray-400">No Image</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={loading}
          className={`${className} ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />
      )}
    </div>
  );
}
```

## Testing

### Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ProductCard } from '../ProductCard';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('ProductCard', () => {
  const mockProduct = {
    id: '1',
    title: 'Test Book',
    price: 12.99,
    currency: 'GBP',
    thumbnail: 'https://example.com/image.jpg',
    available: true,
  };
  
  it('renders product information correctly', () => {
    const handleClick = jest.fn();
    
    renderWithQueryClient(
      <ProductCard product={mockProduct} onClick={handleClick} />
    );
    
    expect(screen.getByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('£12.99')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });
  
  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    
    renderWithQueryClient(
      <ProductCard product={mockProduct} onClick={handleClick} />
    );
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Build and Deployment

### Build Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: process.env.GENERATE_SOURCEMAP === 'true',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['react-query'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
```

### Cloudflare Pages Configuration

```
# public/_redirects
/*    /index.html   200

# Build settings in Cloudflare Pages dashboard:
# Build command: npm run build
# Build output directory: dist
# Root directory: frontend
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy-frontend.yml
name: Deploy Frontend

on:
  push:
    branches: [main]
    paths: ['frontend/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
          
      - name: Run tests
        run: |
          cd frontend
          npm test -- --coverage --watchAll=false
          
      - name: Build
        run: |
          cd frontend
          npm run build
        env:
          REACT_APP_API_URL: https://api.datashelf.com
          
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: datashelf-frontend
          directory: frontend/dist
```

## Accessibility

### WCAG 2.1 Compliance

- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Color Contrast**: Meets WCAG AA standards
- **Focus Management**: Visible focus indicators and logical tab order

### Accessibility Features

```typescript
// Focus management for modals
export function Modal({ isOpen, onClose, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);
  
  return isOpen ? (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        {children}
      </div>
    </div>
  ) : null;
}
```

## Troubleshooting

See the main [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for detailed troubleshooting information.

### Common Issues

1. **Build failures**: Clear node_modules and reinstall dependencies
2. **API connection issues**: Check CORS configuration and API URL
3. **React Query issues**: Verify query keys and error handling
4. **Styling issues**: Check Tailwind configuration and purge settings