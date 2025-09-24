// SIMPLIFIED: Basic product card - just title, image, price

interface Product {
  id: string;
  title: string;
  price?: number;
  currency?: string;
  thumbnail: string;
  available: boolean;
}

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
  className?: string;
}

export function ProductCard({
  product,
  onClick,
  className = ''
}: ProductCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-lg transition-shadow ${className}`}
      onClick={onClick}
    >
      {/* Product Image */}
      <div className="aspect-square mb-4 overflow-hidden rounded-lg bg-gray-100">
        <img
          src={product.thumbnail}
          alt={product.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder-book.svg';
          }}
        />
      </div>
      
      {/* Product Info */}
      <div className="space-y-2">
        <h3 className="font-medium text-gray-900 line-clamp-2">
          {product.title}
        </h3>
        
        {product.price !== undefined ? (
          <p className="text-lg font-bold text-blue-600">
            {product.currency || 'GBP'} {product.price.toFixed(2)}
          </p>
        ) : (
          <p className="text-sm text-gray-500">Price not available</p>
        )}
      </div>
    </div>
  );
}

