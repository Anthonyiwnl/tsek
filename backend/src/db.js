import pg from 'pg';
import { databaseUrl } from './config.js';

/**
 * Create a PostgreSQL pool with bounded connections, timeouts, and sanitized idle errors.
 * @param {object} [env=process.env] - Database connection environment variables.
 * @param {object} [options={}] - Connection options passed to databaseUrl.
 * @param {boolean} [options.migration=false] - Prefer a direct connection for database scripts.
 * @returns {import('pg').Pool} A pool that the caller must close with end().
 */
export function createPool(env = process.env, options = {}) {
  const pool = new pg.Pool({
    connectionString: databaseUrl(env, options),
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
    application_name: 'tsek-backend',
  });
  // Never log connection strings or database error details that may contain secrets.
  pool.on('error', () => console.error('An idle database connection failed.'));
  return pool;
}
