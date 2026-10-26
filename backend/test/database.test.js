import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, seed, transaction } from '../scripts/database-tasks.js';
import { createTestContext } from './_helpers.js';

let context;

before(async () => { context = await createTestContext(); });
after(async () => { await context?.db.close(); });

test('migrations and seed are repeatable without replacing IDs or duplicating records', async () => {
  const beforeRecords = await context.catalogue.list();
  await migrate(context.client);
  await seed(context.client);
  assert.deepEqual(await context.catalogue.list(), beforeRecords);
  assert.equal(beforeRecords.length, 3);
  assert.equal((await context.client.query('SELECT count(*)::int AS count FROM document_requirements')).rows[0].count, 9);
  assert.equal((await context.client.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, 2);
});

test('foreign keys, uniqueness and sort order constraints reject bad records', async () => {
  await assert.rejects(context.client.query("INSERT INTO document_requirements(document_type_id,name) VALUES ('00000000-0000-0000-0000-000000000000','Missing parent')"), { code: '23503' });
  await assert.rejects(context.client.query("INSERT INTO document_types(name) VALUES ('Barangay Clearance')"), { code: '23505' });
  await assert.rejects(context.client.query("INSERT INTO document_requirements(document_type_id,name,sort_order) SELECT id,'Bad order',-1 FROM document_types LIMIT 1"), { code: '23514' });
});

test('failed database transactions roll back all changes', async () => {
  await assert.rejects(transaction(context.client, async () => {
    await context.client.query("INSERT INTO document_types(name) VALUES ('Rollback test')");
    throw new Error('deliberate failure');
  }));
  assert.equal((await context.client.query("SELECT id FROM document_types WHERE name = 'Rollback test'")).rows.length, 0);
});

test('migration checksum drift is detected', async () => {
  const { rows: [migration] } = await context.client.query('SELECT name, checksum FROM schema_migrations');
  await context.client.query("UPDATE schema_migrations SET checksum = 'changed'");
  try { await assert.rejects(migrate(context.client), /Applied migration has changed/); }
  finally {
    await context.client.query('UPDATE schema_migrations SET checksum = $1 WHERE name = $2', [migration.checksum, migration.name]);
  }
});
