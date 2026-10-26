import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const migrationsDirectory = new URL('../db/migrations/', import.meta.url);

/**
 * Serialize schema or seed work with a transaction-scoped advisory lock.
 * Commit successful work; roll back and rethrow failures from the transaction body.
 * @param {object} client - A dedicated PostgreSQL client exposing query.
 * @param {function(): Promise<*>} work - Database work using the same client.
 * @returns {Promise<void>} Resolves after the transaction commits.
 */
export async function transaction(client, work) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query('SELECT pg_advisory_xact_lock(74673521)');
    await work();
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Apply pending numbered SQL migrations in filename order within one locked transaction.
 * Verify checksums and reject changed or missing applied migrations.
 * @param {object} client - A dedicated PostgreSQL client exposing query.
 * @returns {Promise<void>} Resolves after migration SQL and ledger updates commit.
 */
export async function migrate(client) {
  await transaction(client, async () => {
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query('SELECT name, checksum FROM public.schema_migrations');
    const applied = new Map(rows.map(row => [row.name, row.checksum]));
    const files = (await readdir(migrationsDirectory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    for (const name of applied.keys()) {
      if (!files.includes(name)) throw new Error(`Applied migration is missing: ${name}`);
    }
    for (const name of files) {
      const sql = await readFile(new URL(name, migrationsDirectory), 'utf8');
      const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
      if (applied.has(name)) {
        if (applied.get(name) !== checksum) throw new Error(`Applied migration has changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations(name, checksum) VALUES ($1, $2)', [name, checksum]);
    }
  });
}

/**
 * Run the repeatable catalogue seed SQL within a locked transaction.
 * @param {object} client - A dedicated PostgreSQL client exposing query.
 * @returns {Promise<void>} Resolves after seed data commits.
 */
export async function seed(client) {
  const sql = await readFile(new URL('../db/seed.sql', import.meta.url), 'utf8');
  await transaction(client, () => client.query(sql));
}
