import { useState, useEffect } from 'react';
import { 
  ExternalLink, 
  ZoomIn, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Share2,
  Facebook,
  Twitter,
  Linkedin,
  MessageCircle,
  Mail,
  Link,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { ProductDetail as ProductDetailType } from '@/types/product';
import { Button } from '@/components/ui';

interface ProductDetailProps {
  product: ProductDetailType;
  className?: string;
}

export function ProductDetail({ product, className = '' }: ProductDetailProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<number, boolean>>({});
  const [imageErrorStates, setImageErrorStates] = useState<Record<number, boolean>>({});

  const images = product.image_urls?.length > 0 ? product.image_urls : [product.thumbnail];
  const currentImage = images[selectedImageIndex] || '/placeholder-book.svg';

  const handleImageLoad = (index: number) => {
    setImageLoadingStates(prev => ({ ...prev, [index]: false }));
  };

  const handleImageError = (index: number) => {
    setImageLoadingStates(prev => ({ ...prev, [index]: false }));
    setImageErrorStates(prev => ({ ...prev, [index]: true }));
  };

  const handleImageLoadStart = (index: number) => {
    setImageLoadingStates(prev => ({ ...prev, [index]: true }));
    setImageErrorStates(prev => ({ ...prev, [index]: false }));
  };

  // Keyboard navigation for image modal
  useEffect(() => {
    if (!isImageModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          setIsImageModalOpen(false);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          prevImage();
          break;
        case 'ArrowRight':
          event.preventDefault();
          nextImage();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isImageModalOpen, images.length]);

  // Close share menu when clicking outside
  useEffect(() => {
    if (!isShareMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-share-menu]')) {
        setIsShareMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isShareMenuOpen]);

  const handleViewSource = () => {
    window.open(product.source_url, '_blank', 'noopener,noreferrer');
  };

  const formatPrice = (price?: number, currency = 'GBP') => {
    if (!price || price <= 0) return 'Price not available';
    try {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: currency,
      }).format(price);
    } catch (error) {
      // Fallback if currency is invalid
      return `${currency} ${price.toFixed(2)}`;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Unknown';
      }
      return new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch (error) {
      return 'Unknown';
    }
  };

  const formatSpecKey = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .replace(/Isbn/g, 'ISBN')
      .replace(/Url/g, 'URL')
      .replace(/Id/g, 'ID')
      .replace(/Api/g, 'API');
  };

  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleShare = async (platform: string) => {
    const url = window.location.href;
    const text = `Check out this book: ${product.title}`;
    const priceText = product.price ? ` - ${formatPrice(product.price, product.currency)}` : '';
    const fullText = `${text}${priceText}`;

    switch (platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(fullText)}`, '_blank', 'width=600,height=400');
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
        break;
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(`${fullText} ${url}`)}`, '_blank');
        break;
      case 'email':
        const subject = encodeURIComponent(`Check out this book: ${product.title}`);
        const body = encodeURIComponent(`I found this interesting book:\n\n${product.title}${priceText}\n\n${url}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(url);
          alert('Link copied to clipboard!');
        } catch (err) {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = url;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand('copy');
            alert('Link copied to clipboard!');
          } catch (execErr) {
            alert('Unable to copy link. Please copy manually: ' + url);
          }
          document.body.removeChild(textArea);
        }
        break;
    }
    setIsShareMenuOpen(false);
  };

  return (
    <div className={`max-w-6xl mx-auto ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          {/* Main Image */}
          <div className="relative group">
            {imageLoadingStates[selectedImageIndex] && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary-600"></div>
              </div>
            )}
            <img
              src={imageErrorStates[selectedImageIndex] ? '/placeholder-book.svg' : currentImage}
              alt={product.title}
              className="w-full h-64 sm:h-80 lg:h-96 object-cover rounded-lg shadow-mobile cursor-zoom-in"
              onClick={() => setIsImageModalOpen(true)}
              onLoadStart={() => handleImageLoadStart(selectedImageIndex)}
              onLoad={() => handleImageLoad(selectedImageIndex)}
              onError={() => handleImageError(selectedImageIndex)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsImageModalOpen(true);
                }
              }}
              loading="eager"
            />
            <button
              onClick={() => setIsImageModalOpen(true)}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-target"
              aria-label="Zoom image"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            
            {/* Navigation arrows for multiple images */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-target"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-target"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail Gallery */}
          {images.length > 1 && (
            <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`relative flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded border-2 overflow-hidden touch-target ${
                    index === selectedImageIndex ? 'border-primary-500' : 'border-gray-200'
                  }`}
                  aria-label={`View image ${index + 1} of ${images.length}`}
                >
                  {imageLoadingStates[index] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                      <div className="animate-spin rounded-full h-2 w-2 sm:h-3 sm:w-3 border-b-2 border-primary-600"></div>
                    </div>
                  )}
                  <img
                    src={imageErrorStates[index] ? '/placeholder-book.svg' : image}
                    alt=""
                    className="w-full h-full object-cover"
                    onLoadStart={() => handleImageLoadStart(index)}
                    onLoad={() => handleImageLoad(index)}
                    onError={() => handleImageError(index)}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Information */}
        <div className="spacing-mobile">
          <div>
            <h1 className="text-responsive-2xl sm:text-responsive-3xl font-bold text-gray-900 mb-4">{product.title}</h1>
            
            {/* Price and Availability */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-4 sm:mb-6">
              <div className="text-responsive-2xl font-bold text-primary-600">
                {formatPrice(product.price, product.currency)}
              </div>
              <div className="flex items-center">
                {product.available ? (
                  <>
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mr-2" />
                    <span className="text-responsive-sm text-green-600 font-medium">Available</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mr-2" />
                    <span className="text-responsive-sm text-red-600 font-medium">Out of Stock</span>
                  </>
                )}
              </div>
            </div>

            {/* Summary */}
            {product.summary && (
              <div className="bg-gray-50 rounded-lg padding-mobile mb-4 sm:mb-6">
                <h3 className="text-responsive-base font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-responsive-sm text-gray-700 leading-relaxed">{product.summary}</p>
              </div>
            )}
          </div>

          {/* Specifications */}
          {Object.keys(product.specs).length > 0 && (
            <div className="card-mobile padding-mobile">
              <h3 className="text-responsive-base font-semibold text-gray-900 mb-4">Specifications</h3>
              <dl className="space-y-3">
                {Object.entries(product.specs)
                  .filter(([_, value]) => value !== null && value !== undefined && value !== '')
                  .map(([key, value]) => (
                  <div key={key} className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-gray-100 last:border-b-0 space-y-1 sm:space-y-0">
                    <dt className="text-responsive-xs font-medium text-gray-600 sm:flex-shrink-0 sm:mr-4">
                      {formatSpecKey(key)}:
                    </dt>
                    <dd className="text-responsive-xs text-gray-900 sm:text-right break-words">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              className="w-full bg-primary-600 hover:bg-primary-700 touch-target"
              onClick={handleViewSource}
              size="lg"
              aria-label="View this product on World of Books website"
            >
              <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              <span className="text-responsive-sm">View on World of Books</span>
            </Button>

            {/* Share Button */}
            <div className="relative" data-share-menu>
              <Button
                variant="outline"
                className="w-full touch-target"
                onClick={() => setIsShareMenuOpen(!isShareMenuOpen)}
                aria-label="Share this product"
                aria-expanded={isShareMenuOpen}
                aria-haspopup="menu"
              >
                <Share2 className="h-4 w-4 mr-2" />
                <span className="text-responsive-sm">Share Product</span>
              </Button>

              {/* Share Menu */}
              {isShareMenuOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-mobile-lg z-10 animate-slide-down">
                  <div className="p-2" role="menu" aria-label="Share options">
                    <button
                      onClick={() => handleShare('facebook')}
                      className="w-full flex items-center px-3 py-3 text-left hover:bg-gray-50 rounded touch-target text-responsive-sm"
                      role="menuitem"
                    >
                      <Facebook className="h-4 w-4 mr-3 text-blue-600" />
                      Share on Facebook
                    </button>
                    <button
                      onClick={() => handleShare('twitter')}
                      className="w-full flex items-center px-3 py-3 text-left hover:bg-gray-50 rounded touch-target text-responsive-sm"
                      role="menuitem"
                    >
                      <Twitter className="h-4 w-4 mr-3 text-blue-400" />
                      Share on Twitter
                    </button>
                    <button
                      onClick={() => handleShare('linkedin')}
                      className="w-full flex items-center px-3 py-3 text-left hover:bg-gray-50 rounded touch-target text-responsive-sm"
                      role="menuitem"
                    >
                      <Linkedin className="h-4 w-4 mr-3 text-blue-700" />
                      Share on LinkedIn
                    </button>
                    <button
                      onClick={() => handleShare('whatsapp')}
                      className="w-full flex items-center px-3 py-3 text-left hover:bg-gray-50 rounded touch-target text-responsive-sm"
                      role="menuitem"
                    >
                      <MessageCircle className="h-4 w-4 mr-3 text-green-600" />
                      Share on WhatsApp
                    </button>
                    <button
                      onClick={() => handleShare('email')}
                      className="w-full flex items-center px-3 py-3 text-left hover:bg-gray-50 rounded touch-target text-responsive-sm"
                      role="menuitem"
                    >
                      <Mail className="h-4 w-4 mr-3 text-gray-600" />
                      Share via Email
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={() => handleShare('copy')}
                      className="w-full flex items-center px-3 py-3 text-left hover:bg-gray-50 rounded touch-target text-responsive-sm"
                      role="menuitem"
                    >
                      <Link className="h-4 w-4 mr-3 text-gray-600" />
                      Copy Link
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Last Scraped Timestamp */}
          <div className="flex items-center text-responsive-xs text-gray-500 pt-4 border-t border-gray-200">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
            <span>Last updated: {formatTimestamp(product.last_scraped_at)}</span>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {isImageModalOpen && (
        <div 
          className="modal-mobile bg-black bg-opacity-90 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Product image gallery"
        >
          <div className="modal-content-mobile bg-transparent sm:bg-black sm:bg-opacity-90 relative max-w-4xl max-h-full flex items-center justify-center">
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white bg-black bg-opacity-50 p-2 sm:p-3 rounded-full hover:bg-opacity-70 z-10 touch-target"
              aria-label="Close image gallery"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            
            <img
              src={imageErrorStates[selectedImageIndex] ? '/placeholder-book.svg' : currentImage}
              alt={product.title}
              className="max-w-full max-h-full object-contain"
              onError={() => handleImageError(selectedImageIndex)}
            />
            
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 p-2 sm:p-3 rounded-full hover:bg-opacity-70 touch-target"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 p-2 sm:p-3 rounded-full hover:bg-opacity-70 touch-target"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
                
                {/* Image counter */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-3 py-2 rounded-full text-responsive-xs">
                  {selectedImageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}


    </div>
  );
}