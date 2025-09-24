
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
  maxVisiblePages?: number;
  className?: string;
  disabled?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true,
  maxVisiblePages = 5,
  className,
  disabled = false
}: PaginationProps) {
  // Calculate which pages to show
  const getVisiblePages = () => {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisiblePages - 1);

    // Adjust start if we're near the end
    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const visiblePages = getVisiblePages();
  const firstVisiblePage = visiblePages[0];
  const lastVisiblePage = visiblePages[visiblePages.length - 1];
  const showStartEllipsis = firstVisiblePage && firstVisiblePage > 1;
  const showEndEllipsis = lastVisiblePage && lastVisiblePage < totalPages;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      className={cn('flex items-center justify-center space-x-1', className)}
      aria-label="Pagination"
    >
      {/* Previous button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={disabled || currentPage <= 1}
        className="flex items-center space-x-1"
        aria-label="Go to previous page"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Previous</span>
      </Button>

      {/* First page */}
      {showFirstLast && showStartEllipsis && (
        <>
          <Button
            variant={currentPage === 1 ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={disabled}
            className="min-w-[2.5rem]"
          >
            1
          </Button>
          {firstVisiblePage && firstVisiblePage > 2 && (
            <div className="flex items-center justify-center min-w-[2.5rem] h-9">
              <MoreHorizontal className="h-4 w-4 text-secondary-400" />
            </div>
          )}
        </>
      )}

      {/* Visible page numbers */}
      {visiblePages.map((page) => (
        <Button
          key={page}
          variant={currentPage === page ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => onPageChange(page)}
          disabled={disabled}
          className="min-w-[2.5rem]"
          aria-label={`Go to page ${page}`}
          aria-current={currentPage === page ? 'page' : undefined}
        >
          {page}
        </Button>
      ))}

      {/* Last page */}
      {showFirstLast && showEndEllipsis && (
        <>
          {lastVisiblePage && lastVisiblePage < totalPages - 1 && (
            <div className="flex items-center justify-center min-w-[2.5rem] h-9">
              <MoreHorizontal className="h-4 w-4 text-secondary-400" />
            </div>
          )}
          <Button
            variant={currentPage === totalPages ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={disabled}
            className="min-w-[2.5rem]"
          >
            {totalPages}
          </Button>
        </>
      )}

      {/* Next button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={disabled || currentPage >= totalPages}
        className="flex items-center space-x-1"
        aria-label="Go to next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}

interface PaginationInfoProps {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  className?: string;
}

export function PaginationInfo({
  currentPage,
  itemsPerPage,
  totalItems,
  className
}: PaginationInfoProps) {
  if (totalItems === 0) {
    return (
      <div className={cn('text-sm text-secondary-600', className)}>
        No results found
      </div>
    );
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={cn('text-sm text-secondary-600', className)}>
      Showing {startItem} to {endItem} of {totalItems} results
    </div>
  );
}