#!/usr/bin/env node

/**
 * Database Migration Deployment Script
 * Runs migrations in production/staging environments
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Environment configuration
const config = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  environment: process.env.NODE_ENV || 'development'
};

// Validate configuration
function validateConfig() {
  const required = ['supabaseUrl', 'supabaseServiceKey'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}

// Create Supabase client
function createSupabaseClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Get migration files
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.log('📁 No migrations directory found');
    return [];
  }
  
  return fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(file => ({
      name: file,
      path: path.join(migrationsDir, file),
      content: fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    }));
}

// Check if migration has been applied
async function isMigrationApplied(supabase, migrationName) {
  const { data, error } = await supabase
    .from('schema_migrations')
    .select('version')
    .eq('version', migrationName)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error;
  }
  
  return !!data;
}

// Record migration as applied
async function recordMigration(supabase, migrationName) {
  const { error } = await supabase
    .from('schema_migrations')
    .insert({
      version: migrationName,
      applied_at: new Date().toISOString()
    });
  
  if (error) {
    throw error;
  }
}

// Create schema_migrations table if it doesn't exist
async function ensureMigrationsTable(supabase) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  
  const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
  
  if (error) {
    console.log('⚠️  Could not create schema_migrations table, it may already exist');
  }
}

// Run a single migration
async function runMigration(supabase, migration) {
  console.log(`🔄 Running migration: ${migration.name}`);
  
  try {
    // Execute the migration SQL
    const { error } = await supabase.rpc('exec_sql', { sql: migration.content });
    
    if (error) {
      throw error;
    }
    
    // Record the migration as applied
    await recordMigration(supabase, migration.name);
    
    console.log(`✅ Migration completed: ${migration.name}`);
  } catch (error) {
    console.error(`❌ Migration failed: ${migration.name}`);
    console.error('Error:', error.message);
    throw error;
  }
}

// Main migration function
async function runMigrations() {
  console.log(`🚀 Starting database migrations for ${config.environment} environment`);
  
  validateConfig();
  
  const supabase = createSupabaseClient();
  const migrations = getMigrationFiles();
  
  if (migrations.length === 0) {
    console.log('📝 No migrations to run');
    return;
  }
  
  console.log(`📋 Found ${migrations.length} migration files`);
  
  try {
    // Ensure migrations table exists
    await ensureMigrationsTable(supabase);
    
    // Run each migration
    for (const migration of migrations) {
      const isApplied = await isMigrationApplied(supabase, migration.name);
      
      if (isApplied) {
        console.log(`⏭️  Skipping already applied migration: ${migration.name}`);
        continue;
      }
      
      await runMigration(supabase, migration);
    }
    
    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('💥 Migration process failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };