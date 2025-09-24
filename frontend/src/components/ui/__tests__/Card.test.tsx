import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../Card';

describe('Card', () => {
  it('renders children correctly', () => {
    render(
      <Card>
        <div>Test content</div>
      </Card>
    );
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('applies default variant classes', () => {
    const { container } = render(
      <Card>
        <div>Test content</div>
      </Card>
    );
    
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('bg-white', 'border', 'border-secondary-200');
  });

  it('applies elevated variant classes', () => {
    const { container } = render(
      <Card variant="elevated">
        <div>Test content</div>
      </Card>
    );
    
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('bg-white', 'shadow-md', 'hover:shadow-lg');
  });

  it('applies outlined variant classes', () => {
    const { container } = render(
      <Card variant="outlined">
        <div>Test content</div>
      </Card>
    );
    
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('bg-white', 'border-2', 'border-secondary-300');
  });

  it('applies different padding sizes', () => {
    const { container: noneContainer } = render(
      <Card padding="none">
        <div>Test content</div>
      </Card>
    );
    
    const { container: smContainer } = render(
      <Card padding="sm">
        <div>Test content</div>
      </Card>
    );
    
    const { container: lgContainer } = render(
      <Card padding="lg">
        <div>Test content</div>
      </Card>
    );
    
    expect(noneContainer.firstChild).not.toHaveClass('p-3', 'p-4', 'p-6');
    expect(smContainer.firstChild).toHaveClass('p-3');
    expect(lgContainer.firstChild).toHaveClass('p-6');
  });

  it('applies custom className', () => {
    const { container } = render(
      <Card className="custom-class">
        <div>Test content</div>
      </Card>
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('passes through HTML attributes', () => {
    render(
      <Card data-testid="test-card">
        <div>Test content</div>
      </Card>
    );
    
    expect(screen.getByTestId('test-card')).toBeInTheDocument();
  });
});

describe('CardHeader', () => {
  it('renders children correctly', () => {
    render(
      <CardHeader>
        <div>Header content</div>
      </CardHeader>
    );
    
    expect(screen.getByText('Header content')).toBeInTheDocument();
  });

  it('applies default classes', () => {
    const { container } = render(
      <CardHeader>
        <div>Header content</div>
      </CardHeader>
    );
    
    expect(container.firstChild).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'pb-4');
  });
});

describe('CardTitle', () => {
  it('renders children correctly', () => {
    render(
      <CardTitle>Test Title</CardTitle>
    );
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders as h3 element', () => {
    render(
      <CardTitle>Test Title</CardTitle>
    );
    
    const title = screen.getByText('Test Title');
    expect(title.tagName).toBe('H3');
  });

  it('applies default classes', () => {
    render(
      <CardTitle>Test Title</CardTitle>
    );
    
    const title = screen.getByText('Test Title');
    expect(title).toHaveClass('text-lg', 'font-semibold', 'leading-none', 'tracking-tight');
  });
});

describe('CardContent', () => {
  it('renders children correctly', () => {
    render(
      <CardContent>
        <div>Content</div>
      </CardContent>
    );
    
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies default classes', () => {
    const { container } = render(
      <CardContent>
        <div>Content</div>
      </CardContent>
    );
    
    expect(container.firstChild).toHaveClass('pt-0');
  });
});

describe('CardFooter', () => {
  it('renders children correctly', () => {
    render(
      <CardFooter>
        <div>Footer content</div>
      </CardFooter>
    );
    
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('applies default classes', () => {
    const { container } = render(
      <CardFooter>
        <div>Footer content</div>
      </CardFooter>
    );
    
    expect(container.firstChild).toHaveClass('flex', 'items-center', 'pt-4');
  });
});

describe('Card composition', () => {
  it('renders complete card structure', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is the card content.</p>
        </CardContent>
        <CardFooter>
          <button>Action</button>
        </CardFooter>
      </Card>
    );
    
    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('This is the card content.')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});