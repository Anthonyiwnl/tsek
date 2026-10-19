import { createPool } from '../src/db.js';

export async function runTask(task) {
  const pool = createPool(process.env, { migration: true });
  let client;
  try {
    client = await pool.connect();
    await task(client);
    console.log('Database task completed.');
  } catch {
    console.error('Database task failed. Check connection settings, permissions, and migration files. No pending changes were committed.');
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}
