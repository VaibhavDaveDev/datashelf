import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type SupabaseClientType = SupabaseClient;

// Connection configuration
interface DatabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

// Global client instance
let supabaseClient: SupabaseClientType | null = null;

/**
 * Initialize Supabase client with configuration
 */
export function initializeDatabase(config: DatabaseConfig): SupabaseClientType {
  if (!config.url || !config.anonKey) {
    throw new Error('Supabase URL and anon key are required');
  }

  supabaseClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false, // For server-side usage
    },
    db: {
      schema: 'public',
    },
  });

  return supabaseClient;
}

/**
 * Get the initialized Supabase client
 */
export function getDatabase(): SupabaseClientType {
  if (!supabaseClient) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return supabaseClient;
}

/**
 * Create a service role client for admin operations
 */
export function createServiceRoleClient(config: DatabaseConfig): SupabaseClientType {
  if (!config.serviceRoleKey) {
    throw new Error('Service role key is required for admin operations');
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
  });
}

/**
 * Test database connection
 */
export async function testConnection(client?: SupabaseClientType): Promise<boolean> {
  try {
    const db = client || getDatabase();
    const { error } = await db.from('navigation').select('count').limit(1);
    return !error;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Health check for database
 */
export async function healthCheck(client?: SupabaseClientType): Promise<{
  status: 'healthy' | 'unhealthy';
  message: string;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();
  
  try {
    const db = client || getDatabase();
    const { data, error } = await db
      .from('navigation')
      .select('count')
      .limit(1);

    if (error) {
      return {
        status: 'unhealthy',
        message: `Database query failed: ${error.message}`,
        timestamp,
      };
    }

    return {
      status: 'healthy',
      message: 'Database connection is working',
      timestamp,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp,
    };
  }
}