
// SIMPLIFIED: Basic 404 page
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { Button } from '@/components/ui';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-6xl font-bold text-blue-600 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 mb-8">
          Sorry, we couldn't find the page you're looking for.
        </p>
        
        <Button onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    </Layout>
  );
}