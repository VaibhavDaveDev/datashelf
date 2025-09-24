import { NavigationInsert, CategoryInsert, ProductInsert } from '../../services/database.js';

// Test fixtures for database integration tests

export const mockNavigationData: NavigationInsert[] = [
  {
    title: 'Fiction',
    source_url: 'https://www.worldofbooks.com/en-gb/category/fiction',
  },
  {
    title: 'Science Fiction',
    source_url: 'https://www.worldofbooks.com/en-gb/category/fiction/science-fiction',
    parent_id: 'fiction-parent-id', // This would be set after inserting the parent
  },
  {
    title: 'Non-Fiction',
    source_url: 'https://www.worldofbooks.com/en-gb/category/non-fiction',
  },
];

export const mockCategoryData: CategoryInsert[] = [
  {
    title: 'Science Fiction Books',
    source_url: 'https://www.worldofbooks.com/en-gb/category/fiction/science-fiction/books',
    product_count: 150,
    navigation_id: 'sci-fi-nav-id', // This would be set after inserting navigation
  },
  {
    title: 'Fantasy Books',
    source_url: 'https://www.worldofbooks.com/en-gb/category/fiction/fantasy/books',
    product_count: 200,
    navigation_id: 'fantasy-nav-id',
  },
  {
    title: 'Biography Books',
    source_url: 'https://www.worldofbooks.com/en-gb/category/non-fiction/biography/books',
    product_count: 75,
    navigation_id: 'biography-nav-id',
  },
];

export const mockProductData: ProductInsert[] = [
  {
    title: 'Dune',
    source_url: 'https://www.worldofbooks.com/en-gb/books/frank-herbert/dune/9780441172719',
    source_id: '9780441172719',
    price: 8.99,
    currency: 'GBP',
    image_urls: [
      'https://datashelf-images.r2.dev/dune-cover-1.jpg',
      'https://datashelf-images.r2.dev/dune-cover-2.jpg',
    ],
    summary: 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides...',
    specs: {
      author: 'Frank Herbert',
      isbn: '9780441172719',
      publisher: 'Ace Books',
      pages: 688,
      language: 'English',
      format: 'Paperback',
      publication_date: '1990-08-15',
      dimensions: '10.8 x 17.5 x 4.3 cm',
      weight: '340g',
    },
    available: true,
    category_id: 'sci-fi-category-id',
  },
  {
    title: 'The Hobbit',
    source_url: 'https://www.worldofbooks.com/en-gb/books/j-r-r-tolkien/the-hobbit/9780547928227',
    source_id: '9780547928227',
    price: 7.50,
    currency: 'GBP',
    image_urls: [
      'https://datashelf-images.r2.dev/hobbit-cover-1.jpg',
    ],
    summary: 'In a hole in the ground there lived a hobbit...',
    specs: {
      author: 'J.R.R. Tolkien',
      isbn: '9780547928227',
      publisher: 'Houghton Mifflin Harcourt',
      pages: 366,
      language: 'English',
      format: 'Paperback',
      publication_date: '2012-09-18',
      dimensions: '10.6 x 17.1 x 2.5 cm',
      weight: '295g',
    },
    available: true,
    category_id: 'fantasy-category-id',
  },
  {
    title: 'Steve Jobs',
    source_url: 'https://www.worldofbooks.com/en-gb/books/walter-isaacson/steve-jobs/9781451648539',
    source_id: '9781451648539',
    price: 12.99,
    currency: 'GBP',
    image_urls: [
      'https://datashelf-images.r2.dev/steve-jobs-cover-1.jpg',
    ],
    summary: 'Based on more than forty interviews with Jobs conducted over two years...',
    specs: {
      author: 'Walter Isaacson',
      isbn: '9781451648539',
      publisher: 'Simon & Schuster',
      pages: 656,
      language: 'English',
      format: 'Paperback',
      publication_date: '2011-10-24',
      dimensions: '15.2 x 22.9 x 4.1 cm',
      weight: '680g',
    },
    available: true,
    category_id: 'biography-category-id',
  },
  {
    title: 'Out of Stock Book',
    source_url: 'https://www.worldofbooks.com/en-gb/books/author/out-of-stock/9999999999999',
    source_id: '9999999999999',
    price: 15.99,
    currency: 'GBP',
    image_urls: [],
    summary: 'This book is currently out of stock',
    specs: {
      author: 'Test Author',
      isbn: '9999999999999',
      publisher: 'Test Publisher',
      pages: 300,
      language: 'English',
      format: 'Hardcover',
    },
    available: false,
    category_id: 'sci-fi-category-id',
  },
];

export const mockScrapingJobData = {
  navigation: {
    type: 'navigation' as const,
    target_url: 'https://www.worldofbooks.com/en-gb/sitemap',
    metadata: {
      depth: 0,
      expected_items: 10,
    },
  },
  category: {
    type: 'category' as const,
    target_url: 'https://www.worldofbooks.com/en-gb/category/fiction',
    metadata: {
      navigation_id: 'fiction-nav-id',
      expected_products: 500,
    },
  },
  product: {
    type: 'product' as const,
    target_url: 'https://www.worldofbooks.com/en-gb/books/frank-herbert/dune/9780441172719',
    metadata: {
      category_id: 'sci-fi-category-id',
      priority: 'high',
    },
  },
};

// Helper function to create test data with relationships
export function createTestDataWithRelationships() {
  // Create navigation items
  const navigation = [...mockNavigationData];
  
  // Create categories linked to navigation
  const categories = mockCategoryData.map((cat, index) => ({
    ...cat,
    navigation_id: `nav-${index + 1}`, // Mock navigation IDs
  }));
  
  // Create products linked to categories
  const products = mockProductData.map((prod, index) => ({
    ...prod,
    category_id: `cat-${(index % 3) + 1}`, // Distribute across 3 categories
  }));
  
  return {
    navigation,
    categories,
    products,
  };
}

// Error scenarios for testing
export const invalidTestData = {
  navigation: {
    title: '', // Invalid: empty title
    source_url: 'not-a-url', // Invalid: not a URL
  },
  category: {
    title: '', // Invalid: empty title
    source_url: 'not-a-url', // Invalid: not a URL
    product_count: -1, // Invalid: negative count
  },
  product: {
    title: '', // Invalid: empty title
    source_url: 'not-a-url', // Invalid: not a URL
    price: -10, // Invalid: negative price
    currency: 'INVALID', // Invalid: not 3 characters
    image_urls: ['not-a-url'], // Invalid: not a URL
  },
};

// Large dataset for performance testing
export function generateLargeDataset(size: number) {
  const products: ProductInsert[] = [];
  
  for (let i = 0; i < size; i++) {
    products.push({
      title: `Test Book ${i + 1}`,
      source_url: `https://www.worldofbooks.com/en-gb/books/test-book-${i + 1}`,
      source_id: `test-${i + 1}`,
      price: Math.round((Math.random() * 50 + 5) * 100) / 100, // Random price between 5-55
      currency: 'GBP',
      image_urls: [`https://datashelf-images.r2.dev/test-book-${i + 1}.jpg`],
      summary: `This is test book number ${i + 1}`,
      specs: {
        author: `Test Author ${Math.floor(i / 10) + 1}`,
        isbn: `978${String(i).padStart(10, '0')}`,
        publisher: 'Test Publisher',
        pages: Math.floor(Math.random() * 500) + 100,
        language: 'English',
        format: i % 2 === 0 ? 'Paperback' : 'Hardcover',
      },
      available: Math.random() > 0.1, // 90% available
      category_id: `cat-${(i % 5) + 1}`, // Distribute across 5 categories
    });
  }
  
  return products;
}