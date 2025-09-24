import React from 'react';
import { cn } from '@/utils/cn';

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  responsive?: boolean;
  children: React.ReactNode;
}

export function Grid({
  cols = 4,
  gap = 'md',
  responsive = true,
  className,
  children,
  ...props
}: GridProps) {
  const baseClasses = 'grid';
  
  const colClasses = responsive ? {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
  } : {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  };

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  };

  return (
    <div
      className={cn(
        baseClasses,
        colClasses[cols],
        gapClasses[gap],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface AutoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  minItemWidth?: string;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export function AutoGrid({
  minItemWidth = '250px',
  gap = 'md',
  className,
  children,
  ...props
}: AutoGridProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  };

  return (
    <div
      className={cn('grid', gapClasses[gap], className)}
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${minItemWidth}, 1fr))`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

interface MasonryGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export function MasonryGrid({
  cols = 3,
  gap = 'md',
  className,
  children,
  ...props
}: MasonryGridProps) {
  const colClasses = {
    2: 'columns-1 sm:columns-2',
    3: 'columns-1 sm:columns-2 lg:columns-3',
    4: 'columns-1 sm:columns-2 md:columns-3 lg:columns-4',
  };

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  };

  return (
    <div
      className={cn(
        colClasses[cols],
        gapClasses[gap],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}