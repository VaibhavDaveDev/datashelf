export interface NavigationItem {
  id: string;
  title: string;
  source_url: string;
  children?: NavigationItem[];
  last_scraped_at: string;
}

export interface Category {
  id: string;
  title: string;
  product_count: number;
  last_scraped_at: string;
}