import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Grid, AutoGrid, MasonryGrid } from '../Grid';

describe('Grid', () => {
  it('renders children correctly', () => {
    const { container } = render(
      <Grid>
        <div>Item 1</div>
        <div>Item 2</div>
      </Grid>
    );
    
    expect(container.textContent).toContain('Item 1');
    expect(container.textContent).toContain('Item 2');
  });

  it('applies default grid classes', () => {
    const { container } = render(
      <Grid>
        <div>Item</div>
      </Grid>
    );
    
    const grid = container.firstChild;
    expect(grid).toHaveClass('grid');
  });

  it('applies responsive column classes by default', () => {
    const { container } = render(
      <Grid cols={4}>
        <div>Item</div>
      </Grid>
    );
    
    const grid = container.firstChild;
    expect(grid).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-2',
      'md:grid-cols-3',
      'lg:grid-cols-4'
    );
  });

  it('applies non-responsive column classes when responsive is false', () => {
    const { container } = render(
      <Grid cols={3} responsive={false}>
        <div>Item</div>
      </Grid>
    );
    
    const grid = container.firstChild;
    expect(grid).toHaveClass('grid-cols-3');
    expect(grid).not.toHaveClass('sm:grid-cols-2');
  });

  it('applies different gap sizes', () => {
    const { container: smContainer } = render(
      <Grid gap="sm">
        <div>Item</div>
      </Grid>
    );
    
    const { container: lgContainer } = render(
      <Grid gap="lg">
        <div>Item</div>
      </Grid>
    );
    
    const { container: xlContainer } = render(
      <Grid gap="xl">
        <div>Item</div>
      </Grid>
    );
    
    expect(smContainer.firstChild).toHaveClass('gap-2');
    expect(lgContainer.firstChild).toHaveClass('gap-6');
    expect(xlContainer.firstChild).toHaveClass('gap-8');
  });

  it('applies different column counts', () => {
    const { container: col1 } = render(
      <Grid cols={1}>
        <div>Item</div>
      </Grid>
    );
    
    const { container: col6 } = render(
      <Grid cols={6}>
        <div>Item</div>
      </Grid>
    );
    
    expect(col1.firstChild).toHaveClass('grid-cols-1');
    expect(col6.firstChild).toHaveClass('xl:grid-cols-6');
  });

  it('applies custom className', () => {
    const { container } = render(
      <Grid className="custom-class">
        <div>Item</div>
      </Grid>
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('passes through HTML attributes', () => {
    const { container } = render(
      <Grid data-testid="test-grid">
        <div>Item</div>
      </Grid>
    );
    
    expect(container.firstChild).toHaveAttribute('data-testid', 'test-grid');
  });
});

describe('AutoGrid', () => {
  it('renders children correctly', () => {
    const { container } = render(
      <AutoGrid>
        <div>Item 1</div>
        <div>Item 2</div>
      </AutoGrid>
    );
    
    expect(container.textContent).toContain('Item 1');
    expect(container.textContent).toContain('Item 2');
  });

  it('applies grid class', () => {
    const { container } = render(
      <AutoGrid>
        <div>Item</div>
      </AutoGrid>
    );
    
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass('grid');
  });

  it('applies default minItemWidth via inline styles', () => {
    const { container } = render(
      <AutoGrid>
        <div>Item</div>
      </AutoGrid>
    );
    
    const grid = container.firstChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(auto-fill, minmax(250px, 1fr))');
  });

  it('applies custom minItemWidth via inline styles', () => {
    const { container } = render(
      <AutoGrid minItemWidth="300px">
        <div>Item</div>
      </AutoGrid>
    );
    
    const grid = container.firstChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(auto-fill, minmax(300px, 1fr))');
  });

  it('applies gap classes', () => {
    const { container } = render(
      <AutoGrid gap="lg">
        <div>Item</div>
      </AutoGrid>
    );
    
    expect(container.firstChild).toHaveClass('gap-6');
  });

  it('applies custom className', () => {
    const { container } = render(
      <AutoGrid className="custom-auto-grid">
        <div>Item</div>
      </AutoGrid>
    );
    
    expect(container.firstChild).toHaveClass('custom-auto-grid');
  });
});

describe('MasonryGrid', () => {
  it('renders children correctly', () => {
    const { container } = render(
      <MasonryGrid>
        <div>Item 1</div>
        <div>Item 2</div>
      </MasonryGrid>
    );
    
    expect(container.textContent).toContain('Item 1');
    expect(container.textContent).toContain('Item 2');
  });

  it('applies default column classes for 3 columns', () => {
    const { container } = render(
      <MasonryGrid>
        <div>Item</div>
      </MasonryGrid>
    );
    
    const grid = container.firstChild;
    expect(grid).toHaveClass('columns-1', 'sm:columns-2', 'lg:columns-3');
  });

  it('applies column classes for 2 columns', () => {
    const { container } = render(
      <MasonryGrid cols={2}>
        <div>Item</div>
      </MasonryGrid>
    );
    
    const grid = container.firstChild;
    expect(grid).toHaveClass('columns-1', 'sm:columns-2');
    expect(grid).not.toHaveClass('lg:columns-3');
  });

  it('applies column classes for 4 columns', () => {
    const { container } = render(
      <MasonryGrid cols={4}>
        <div>Item</div>
      </MasonryGrid>
    );
    
    const grid = container.firstChild;
    expect(grid).toHaveClass('columns-1', 'sm:columns-2', 'md:columns-3', 'lg:columns-4');
  });

  it('applies gap classes', () => {
    const { container } = render(
      <MasonryGrid gap="xl">
        <div>Item</div>
      </MasonryGrid>
    );
    
    expect(container.firstChild).toHaveClass('gap-8');
  });

  it('applies custom className', () => {
    const { container } = render(
      <MasonryGrid className="custom-masonry">
        <div>Item</div>
      </MasonryGrid>
    );
    
    expect(container.firstChild).toHaveClass('custom-masonry');
  });

  it('passes through HTML attributes', () => {
    const { container } = render(
      <MasonryGrid data-testid="test-masonry">
        <div>Item</div>
      </MasonryGrid>
    );
    
    expect(container.firstChild).toHaveAttribute('data-testid', 'test-masonry');
  });
});