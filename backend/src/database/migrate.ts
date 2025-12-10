import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, getPool } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = join(__dirname, 'migrations');

interface Migration {
  filename: string;
  sql: string;
}

// Create schema_migrations table if not exists
async function createMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✓ schema_migrations table ready');
}

// Get list of already executed migrations
async function getExecutedMigrations(): Promise<Set<string>> {
  const result = await query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY id'
  );
  return new Set(result.rows.map((row) => row.filename));
}

// Read all migration files from migrations directory
async function loadMigrationFiles(): Promise<Migration[]> {
  const files = await readdir(MIGRATIONS_DIR);
  const sqlFiles = files
    .filter((f) => f.endsWith('.sql'))
    .sort(); // Execute in alphabetical order (001_, 002_, etc.)

  const migrations: Migration[] = [];
  for (const filename of sqlFiles) {
    const filepath = join(MIGRATIONS_DIR, filename);
    const sql = await readFile(filepath, 'utf-8');
    migrations.push({ filename, sql });
  }

  return migrations;
}

// Execute a single migration within a transaction
async function executeMigration(migration: Migration): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Execute migration SQL
    await client.query(migration.sql);

    // Record migration as executed
    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      [migration.filename]
    );

    await client.query('COMMIT');
    console.log(`✓ Executed migration: ${migration.filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Failed to execute migration: ${migration.filename}`);
    throw error;
  } finally {
    client.release();
  }
}

// Main migration runner
async function runMigrations(): Promise<void> {
  console.log('Starting database migrations...\n');

  // Skip migrations if using Bitable storage
  if (process.env.DATABASE_STORAGE === 'bitable') {
    console.log('✓ Using Bitable storage mode - skipping PostgreSQL migrations');
    return;
  }

  try {
    // Ensure migrations tracking table exists
    await createMigrationsTable();

    // Get already executed migrations
    const executed = await getExecutedMigrations();
    console.log(`Found ${executed.size} previously executed migrations\n`);

    // Load all migration files
    const migrations = await loadMigrationFiles();
    console.log(`Found ${migrations.length} migration files\n`);

    // Execute pending migrations
    let executedCount = 0;
    for (const migration of migrations) {
      if (!executed.has(migration.filename)) {
        await executeMigration(migration);
        executedCount++;
      } else {
        console.log(`⊙ Skipping (already executed): ${migration.filename}`);
      }
    }

    console.log(`\n✓ Migrations complete! Executed ${executedCount} new migrations.`);
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runMigrations };
