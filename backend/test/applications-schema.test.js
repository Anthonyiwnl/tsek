import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate, seed } from '../scripts/database-tasks.js';

const owner = '11111111-1111-4111-8111-111111111111';
const missingId = '00000000-0000-0000-0000-000000000000';

let db;
let client;
let clearanceId;

before(async () => {
  db = new PGlite();
  client = { query: (sql, params) => params || !sql.includes(';')
    ? db.query(sql, params) : db.exec(sql).then(results => results.at(-1)) };
  await migrate(client);
  await seed(client);
  ({ rows: [{ id: clearanceId }] } = await client.query(
    "SELECT id FROM document_types WHERE name = 'Barangay Clearance'"));
});
after(async () => { await db?.close(); });

/** Insert one application with defaults for omitted columns. */
const insertApplication = (values = {}) => {
  const row = { owner_id: owner, document_type_id: clearanceId, purpose: 'Employment', ...values };
  const columns = Object.keys(row);
  return client.query(
    `INSERT INTO applications(${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
    columns.map(column => row[column]));
};

test('both migrations are recorded in the ledger', async () => {
  const { rows } = await client.query('SELECT name FROM schema_migrations ORDER BY name');
  assert.deepEqual(rows.map(row => row.name), ['001_catalogue.sql', '002_applications.sql']);
});

test('an application persists its owner, document type, purpose and draft status', async () => {
  const { rows: [application] } = await insertApplication();
  try {
    assert.equal(application.owner_id, owner);
    assert.equal(application.document_type_id, clearanceId);
    assert.equal(application.purpose, 'Employment');
    assert.equal(application.status, 'draft');
    assert.ok(application.created_at instanceof Date);
    assert.ok(application.updated_at instanceof Date);
  } finally { await client.query('DELETE FROM applications WHERE id = $1', [application.id]); }
});

test('an application reaches its requirements through its document type', async () => {
  const { rows: [application] } = await insertApplication({ status: 'submitted' });
  try {
    const { rows } = await client.query(`
      SELECT r.name FROM applications a
      JOIN document_types t ON t.id = a.document_type_id
      JOIN document_requirements r ON r.document_type_id = t.id
      WHERE a.id = $1 ORDER BY r.sort_order`, [application.id]);
    assert.equal(rows.length, 3);
  } finally { await client.query('DELETE FROM applications WHERE id = $1', [application.id]); }
});

test('constraints reject a missing owner, unknown type, invalid status and long purpose', async () => {
  await assert.rejects(insertApplication({ owner_id: null }), { code: '23502' });
  await assert.rejects(insertApplication({ document_type_id: missingId }), { code: '23503' });
  await assert.rejects(insertApplication({ status: 'approved' }), { code: '23514' });
  await assert.rejects(insertApplication({ purpose: 'x'.repeat(201) }), { code: '23514' });
  assert.equal((await client.query('SELECT count(*)::int AS count FROM applications')).rows[0].count, 0);
});

test('a document type with applications cannot be deleted', async () => {
  const { rows: [application] } = await insertApplication();
  try {
    await assert.rejects(client.query('DELETE FROM document_types WHERE id = $1', [clearanceId]), { code: '23001' });
  } finally { await client.query('DELETE FROM applications WHERE id = $1', [application.id]); }
});

test('owner lookups are indexed by owner and most recent update', async () => {
  const { rows } = await client.query(
    "SELECT indexdef FROM pg_indexes WHERE tablename = 'applications' AND indexname = 'applications_owner_updated_idx'");
  assert.match(rows[0].indexdef, /\(owner_id, updated_at DESC, id\)/);
});
