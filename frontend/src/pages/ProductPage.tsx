
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout';
import { ProductDetail, Button } from '@/components/ui';
import { useProductDetail } from '@/hooks/useProductDetail';

export function ProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  
  const { 
    data: product, 
    isLoading, 
    error
  } = useProductDetail(productId!);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mx-auto mb-4 text-primary-600" />
            <p className="text-responsive-sm text-gray-600">Loading product details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !product) {
    return (
      <Layout>
        <div className="spacing-mobile">
          <div className="mb-6 sm:mb-8">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="touch-target"
              aria-label="Go back to previous page"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          
          <div className="text-center py-8 sm:py-12">
            <div className="text-4xl sm:text-6xl mb-4" role="img" aria-label="Books">📚</div>
            <h2 className="text-responsive-xl font-bold text-gray-900 mb-2">Product Not Found</h2>
            <p className="text-responsive-sm text-gray-600 mb-6 px-4">
              The product you're looking for doesn't exist or may have been removed.
            </p>
            <Button 
              onClick={() => navigate('/')}
              className="touch-target"
              size="lg"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="spacing-mobile">
        <div className="mb-6 sm:mb-8">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="touch-target"
            aria-label="Go back to previous page"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        
        <ProductDetail product={product} />
      </div>
    </Layout>
  );
}