import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// PostgreSQL connection pool
// Only create pool if not using Bitable storage
const pool = process.env.DATABASE_STORAGE === 'bitable'
  ? null as any  // Skip pool creation in Bitable mode
  : new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

// Type-safe query function with error handling
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  // If using Bitable storage, PostgreSQL queries should not be called
  if (process.env.DATABASE_STORAGE === 'bitable') {
    throw new Error('PostgreSQL query called in Bitable mode. Use Bitable repositories instead.');
  }

  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Database query error:', { text, error });
    throw error;
  }
}

// Connection health check
export async function healthCheck(): Promise<boolean> {
  // If using Bitable storage, skip PostgreSQL health check
  if (process.env.DATABASE_STORAGE === 'bitable') {
    console.log('Using Bitable storage, skipping PostgreSQL health check');
    return true;
  }

  try {
    const result = await query('SELECT 1 as health');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  if (process.env.DATABASE_STORAGE === 'bitable') {
    console.log('Bitable mode, no pool to close');
    return;
  }
  await pool.end();
  console.log('Database pool closed');
}

// Get pool instance for transactions
export function getPool(): pg.Pool {
  return pool;
}

export default {
  query,
  healthCheck,
  closePool,
  getPool,
};
