import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '@/types/env';

/**
 * Database types based on the schema design
 */
export interface Database {
  public: {
    Tables: {
      navigation: {
        Row: {
          id: string;
          title: string;
          source_url: string;
          parent_id: string | null;
          last_scraped_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          source_url: string;
          parent_id?: string | null;
          last_scraped_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          source_url?: string;
          parent_id?: string | null;
          last_scraped_at?: string;
        };
      };
      category: {
        Row: {
          id: string;
          navigation_id: string | null;
          title: string;
          source_url: string;
          product_count: number;
          last_scraped_at: string;
        };
        Insert: {
          id?: string;
          navigation_id?: string | null;
          title: string;
          source_url: string;
          product_count?: number;
          last_scraped_at?: string;
        };
        Update: {
          id?: string;
          navigation_id?: string | null;
          title?: string;
          source_url?: string;
          product_count?: number;
          last_scraped_at?: string;
        };
      };
      product: {
        Row: {
          id: string;
          category_id: string | null;
          title: string;
          source_url: string;
          source_id: string | null;
          price: number | null;
          currency: string | null;
          image_urls: string[];
          summary: string | null;
          specs: Record<string, any>;
          available: boolean;
          last_scraped_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          title: string;
          source_url: string;
          source_id?: string | null;
          price?: number | null;
          currency?: string | null;
          image_urls?: string[];
          summary?: string | null;
          specs?: Record<string, any>;
          available?: boolean;
          last_scraped_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          title?: string;
          source_url?: string;
          source_id?: string | null;
          price?: number | null;
          currency?: string | null;
          image_urls?: string[];
          summary?: string | null;
          specs?: Record<string, any>;
          available?: boolean;
          last_scraped_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

/**
 * Create a Supabase client configured for Cloudflare Workers
 */
export function createSupabaseClient(env: Env): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: fetch.bind(globalThis),
    },
  });
}

/**
 * Type-safe Supabase client type
 */
export type TypedSupabaseClient = SupabaseClient<Database>;