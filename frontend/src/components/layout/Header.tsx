
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Home, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === '/';

  return (
    <header 
      className="bg-white shadow-sm border-b sticky top-0 z-30"
      role="banner"
    >
      <div className="container-responsive">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Mobile back button for non-home pages */}
          {!isHomePage && (
            <button
              onClick={() => navigate(-1)}
              className="touch-target sm:hidden -ml-2 text-gray-600 hover:text-gray-900"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          {/* Logo - responsive sizing */}
          <Link 
            to="/" 
            className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 transition-colors"
            aria-label="DataShelf - Go to homepage"
          >
            <BookOpen className="h-6 w-6 sm:h-8 sm:w-8" />
            <span className="text-lg sm:text-xl font-bold">
              DataShelf
            </span>
          </Link>

          {/* Desktop navigation - hidden on mobile for simplicity */}
          <nav className="hidden sm:flex items-center space-x-4" role="navigation">
            <Link
              to="/"
              className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isHomePage
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              aria-current={isHomePage ? 'page' : undefined}
            >
              <Home className="h-4 w-4" />
              <span>Browse Categories</span>
            </Link>
          </nav>

          {/* Mobile home button for non-home pages */}
          {!isHomePage && (
            <Link
              to="/"
              className="touch-target sm:hidden -mr-2 text-gray-600 hover:text-gray-900"
              aria-label="Go to homepage"
            >
              <Home className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}