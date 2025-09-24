
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryClient } from '@/utils/api';
import { ErrorBoundary, OfflineNotice } from '@/components/common';
import { HomePage, CategoryPage, ProductPage, NotFoundPage } from '@/pages';
import { trackPageView } from '@/utils/analytics';

// Analytics wrapper component
function AnalyticsWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    // Track page views
    trackPageView(location.pathname, document.title);
  }, [location]);

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <OfflineNotice />
        <Router>
          <AnalyticsWrapper>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/category/:categoryId" element={<CategoryPage />} />
              <Route path="/product/:productId" element={<ProductPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AnalyticsWrapper>
        </Router>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;