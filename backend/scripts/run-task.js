import { createPool } from '../src/db.js';

/**
 * Run a database task with a migration connection and always release acquired resources.
 * Connection and task failures log a generic message and set a failing process exit code.
 * @param {function(import('pg').PoolClient): Promise<*>} task - Work using the acquired client.
 * @returns {Promise<void>} Resolves after cleanup; pool creation errors propagate.
 */
export async function runTask(task) {
  const pool = createPool(process.env, { migration: true });
  let client;
  try {
    client = await pool.connect();
    await task(client);
    console.log('Database task completed.');
  } catch (error) {
    console.error('Database task failed. Check connection settings, permissions, and migration files. No pending changes were committed.', {
      type: typeof error?.name === 'string' ? error.name : 'Error',
      ...(typeof error?.code === 'string' ? { code: error.code } : {}),
      ...(typeof error?.message === 'string' && /^Applied migration (is missing|has changed)/.test(error.message)
        ? { message: error.message } : {}),
    });
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}
