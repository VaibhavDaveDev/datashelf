import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useNavigation } from '@/hooks/useNavigation';
import { Loading, ErrorMessage, Button } from '@/components/ui';
import type { NavigationItem } from '@/types';

interface CategoryNavigationProps {
  className?: string;
  onCategorySelect?: (categoryId: string) => void;
  showSearch?: boolean;
  collapsible?: boolean;
}

export function CategoryNavigation({ 
  className, 
  onCategorySelect, 
  showSearch = true,
  collapsible = false 
}: CategoryNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: navigation, isLoading, error, refetch } = useNavigation();
  
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // Get current category from URL
  const currentCategoryId = React.useMemo(() => {
    const match = location.pathname.match(/\/category\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  // Filter navigation items based on search term
  const filteredNavigation = React.useMemo(() => {
    if (!navigation || !searchTerm.trim()) return navigation;
    
    const filterItems = (items: NavigationItem[]): NavigationItem[] => {
      return items.reduce((acc: NavigationItem[], item) => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
        const filteredChildren = item.children ? filterItems(item.children) : [];
        
        if (matchesSearch || filteredChildren.length > 0) {
          acc.push({
            ...item,
            children: filteredChildren.length > 0 ? filteredChildren : (item.children || undefined)
          });
        }
        
        return acc;
      }, []);
    };
    
    return filterItems(navigation);
  }, [navigation, searchTerm]);

  // Auto-expand items that contain the current category
  React.useEffect(() => {
    if (!navigation || !currentCategoryId) return;
    
    const findAndExpandPath = (items: NavigationItem[], targetId: string, path: string[] = []): boolean => {
      for (const item of items) {
        const currentPath = [...path, item.id];
        
        if (item.id === targetId) {
          // Found the target, expand all items in the path
          setExpandedItems(prev => new Set([...prev, ...path]));
          return true;
        }
        
        if (item.children && findAndExpandPath(item.children, targetId, currentPath)) {
          return true;
        }
      }
      return false;
    };
    
    findAndExpandPath(navigation, currentCategoryId);
  }, [navigation, currentCategoryId]);

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(itemId)) {
        newExpanded.delete(itemId);
      } else {
        newExpanded.add(itemId);
      }
      return newExpanded;
    });
  };

  const handleCategoryClick = (item: NavigationItem) => {
    if (item.children && item.children.length > 0) {
      toggleExpanded(item.id);
    } else {
      if (onCategorySelect) {
        onCategorySelect(item.id);
      } else {
        navigate(`/category/${item.id}`);
      }
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const renderNavigationItem = (item: NavigationItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const isActive = currentCategoryId === item.id;
    const paddingLeft = level * 16 + 16; // 16px per level + base padding

    return (
      <div key={item.id}>
        <button
          onClick={() => handleCategoryClick(item)}
          className={cn(
            'w-full text-left px-4 py-2 text-sm hover:bg-secondary-50 transition-colors flex items-center justify-between group',
            level > 0 && 'text-secondary-600',
            isActive && 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
          )}
          style={{ paddingLeft: `${paddingLeft}px` }}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-current={isActive ? 'page' : undefined}
        >
          <span className={cn(
            'truncate',
            isActive && 'font-medium'
          )}>
            {item.title}
          </span>
          {hasChildren && (
            <span className="flex-shrink-0 ml-2 opacity-60 group-hover:opacity-100 transition-opacity">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
          )}
        </button>
        
        {hasChildren && isExpanded && (
          <div className="border-l border-secondary-200 ml-4">
            {item.children!.map((child) => renderNavigationItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={cn('bg-white border-r border-secondary-200', className)}>
        <div className="p-4">
          <Loading text="Loading categories..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white border-r border-secondary-200', className)}>
        <div className="p-4">
          <ErrorMessage
            title="Failed to load categories"
            message="Unable to load the category navigation. Please try again."
            onRetry={() => refetch()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white border-r border-secondary-200 flex flex-col', className)}>
      {/* Header */}
      <div className="p-4 border-b border-secondary-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-secondary-900">Categories</h2>
        {collapsible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="md:hidden"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Content - collapsible on mobile */}
      <div className={cn(
        'flex-1 flex flex-col',
        collapsible && isCollapsed && 'hidden md:flex'
      )}>
        {/* Search */}
        {showSearch && (
          <div className="p-4 border-b border-secondary-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-secondary-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          {filteredNavigation && filteredNavigation.length > 0 ? (
            filteredNavigation.map((item) => renderNavigationItem(item))
          ) : searchTerm ? (
            <div className="p-4 text-center text-secondary-500 text-sm">
              No categories found matching "{searchTerm}"
            </div>
          ) : (
            <div className="p-4 text-center text-secondary-500 text-sm">
              No categories available
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}