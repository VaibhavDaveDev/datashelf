export interface Product {
  id: string;
  title: string;
  price?: number;
  currency?: string;
  thumbnail: string;
  available: boolean;
}

export interface ProductDetail extends Product {
  image_urls: string[];
  summary?: string;
  specs: Record<string, any>;
  source_url: string;
  last_scraped_at: string;
}

export interface BookSpecs {
  author?: string;
  isbn?: string;
  publisher?: string;
  pages?: number;
  language?: string;
  format?: 'Paperback' | 'Hardcover' | 'eBook';
  publication_date?: string;
  dimensions?: string;
  weight?: string;
}

export type SortOption = 'price_asc' | 'price_desc' | 'title_asc' | 'title_desc';