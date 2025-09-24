// Enhanced mobile-responsive category card
interface CategoryCardProps {
  title: string;
  productCount?: number;
  onClick?: () => void;
  className?: string;
}

export function CategoryCard({
  title,
  productCount,
  onClick,
  className = ''
}: CategoryCardProps) {
  const handleClick = () => {
    onClick?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`card-mobile padding-mobile cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Browse ${title} category${productCount !== undefined ? ` with ${productCount} products` : ''}`}
    >
      <div className="flex flex-col h-full">
        <h3 className="text-responsive-base font-medium text-gray-900 mb-2 line-clamp-2 flex-1">
          {title}
        </h3>
        {productCount !== undefined && (
          <p className="text-responsive-xs text-gray-500 mt-auto">
            {productCount.toLocaleString()} {productCount === 1 ? 'product' : 'products'}
          </p>
        )}
      </div>
    </div>
  );
}

