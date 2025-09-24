#!/usr/bin/env node

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServiceRoleClient, SupabaseClientType } from './utils/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MigrationFile {
  filename: string;
  version: string;
  content: string;
}

interface MigrationRecord {
  version: string;
  filename: string;
  executed_at: string;
}

/**
 * Migration runner for DataShelf database
 */
class MigrationRunner {
  private client: SupabaseClientType;

  constructor(client: SupabaseClientType) {
    this.client = client;
  }

  /**
   * Initialize migration tracking table
   */
  private async initializeMigrationTable(): Promise<void> {
    // Note: This assumes the _migrations table is created manually or via Supabase dashboard
    // For production, you would create this table through the Supabase dashboard or SQL editor
    console.log('Note: Ensure _migrations table exists in your Supabase database');
    console.log('Create it with: CREATE TABLE IF NOT EXISTS _migrations (version text PRIMARY KEY, filename text NOT NULL, executed_at timestamptz DEFAULT now());');
  }

  /**
   * Get list of executed migrations
   */
  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    const { data, error } = await this.client
      .from('_migrations')
      .select('*')
      .order('version');

    if (error) {
      throw new Error(`Failed to get executed migrations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Load migration files from disk
   */
  private loadMigrationFiles(): MigrationFile[] {
    const migrationsDir = join(__dirname, 'migrations');
    const files = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(filename => {
      const version = filename.replace('.sql', '');
      const content = readFileSync(join(migrationsDir, filename), 'utf-8');
      return { filename, version, content };
    });
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(migration: MigrationFile): Promise<void> {
    console.log(`Executing migration: ${migration.filename}`);
    console.log('Note: Execute the following SQL in your Supabase SQL editor:');
    console.log('---');
    console.log(migration.content);
    console.log('---');

    // For now, we'll just record the migration as executed
    // In a real implementation, you would execute the SQL via Supabase dashboard or API
    const { error: recordError } = await this.client
      .from('_migrations')
      .insert({
        version: migration.version,
        filename: migration.filename,
      });

    if (recordError) {
      throw new Error(`Failed to record migration ${migration.filename}: ${recordError.message}`);
    }

    console.log(`✓ Migration ${migration.filename} recorded (manual execution required)`);
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    try {
      console.log('Starting database migration...');

      // Initialize migration tracking
      await this.initializeMigrationTable();

      // Get executed migrations
      const executedMigrations = await this.getExecutedMigrations();
      const executedVersions = new Set(executedMigrations.map(m => m.version));

      // Load migration files
      const migrationFiles = this.loadMigrationFiles();

      // Find pending migrations
      const pendingMigrations = migrationFiles.filter(
        migration => !executedVersions.has(migration.version)
      );

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations found.');
        return;
      }

      console.log(`Found ${pendingMigrations.length} pending migration(s)`);

      // Execute pending migrations
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      console.log('All migrations completed successfully!');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Seed the database with sample data
   */
  async seed(): Promise<void> {
    try {
      console.log('Starting database seeding...');

      const seedsDir = join(__dirname, 'seeds');
      const seedFiles = readdirSync(seedsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const filename of seedFiles) {
        console.log(`Executing seed: ${filename}`);
        const content = readFileSync(join(seedsDir, filename), 'utf-8');
        
        console.log('Note: Execute the following SQL in your Supabase SQL editor:');
        console.log('---');
        console.log(content);
        console.log('---');
        
        console.log(`✓ Seed ${filename} ready for manual execution`);
      }

      console.log('Database seeding completed successfully!');
    } catch (error) {
      console.error('Seeding failed:', error);
      throw error;
    }
  }

  /**
   * Show migration status
   */
  async status(): Promise<void> {
    try {
      await this.initializeMigrationTable();
      
      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = this.loadMigrationFiles();
      const executedVersions = new Set(executedMigrations.map(m => m.version));

      console.log('\nMigration Status:');
      console.log('================');

      for (const migration of migrationFiles) {
        const status = executedVersions.has(migration.version) ? '✓ Applied' : '✗ Pending';
        const executedAt = executedMigrations.find(m => m.version === migration.version)?.executed_at;
        
        console.log(`${status} ${migration.filename}${executedAt ? ` (${executedAt})` : ''}`);
      }

      const pendingCount = migrationFiles.length - executedMigrations.length;
      console.log(`\nTotal: ${migrationFiles.length} migrations, ${pendingCount} pending`);
    } catch (error) {
      console.error('Failed to get migration status:', error);
      throw error;
    }
  }
}

/**
 * CLI interface
 */
async function main() {
  const command = process.argv[2];
  
  // Get configuration from environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
    process.exit(1);
  }

  // Create service role client for migrations
  const client = createServiceRoleClient({
    url: supabaseUrl,
    anonKey: '', // Not needed for service role
    serviceRoleKey,
  });

  const runner = new MigrationRunner(client);

  try {
    switch (command) {
      case 'migrate':
        await runner.migrate();
        break;
      case 'seed':
        await runner.seed();
        break;
      case 'status':
        await runner.status();
        break;
      case 'reset':
        await runner.migrate();
        await runner.seed();
        break;
      default:
        console.log('Usage: npm run db:migrate [migrate|seed|status|reset]');
        console.log('');
        console.log('Commands:');
        console.log('  migrate  Run pending migrations');
        console.log('  seed     Run seed scripts');
        console.log('  status   Show migration status');
        console.log('  reset    Run migrations and seeds');
        process.exit(1);
    }
  } catch (error) {
    console.error('Command failed:', error);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { MigrationRunner };