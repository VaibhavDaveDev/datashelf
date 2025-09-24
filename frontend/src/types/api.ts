// Base API response types
export interface APIResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  total: number;
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface APIError {
  error: string;
  message: string;
  code: number;
  timestamp: string;
}