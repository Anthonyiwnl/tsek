import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createTestContext } from './_helpers.js';

let context;

before(async () => { context = await createTestContext(); });
after(async () => { await context?.db.close(); });

test('catalogue HTTP endpoints return seeded, ordered database records', async () => {
  const list = await request(context.app).get('/api/document-types').expect(200);
  assert.equal(list.body.data.length, 3);
  assert.equal(list.body.data[0].name, 'Barangay Clearance');
  const detail = await request(context.app).get(`/api/document-types/${list.body.data[0].id}/requirements`).expect(200);
  assert.deepEqual(detail.body.data.requirements.map(row => row.sort_order), [1, 2, 3]);
  assert.equal(detail.body.data.requirements[2].is_required, false);
  assert.ok(Array.isArray(detail.body.data.requirements[0].accepted_document_types));
});

test('invalid UUIDs, missing records, and unknown routes return JSON errors', async () => {
  await request(context.app).get('/api/document-types/not-a-uuid/requirements').expect(400);
  await request(context.app).get('/api/document-types/00000000-0000-0000-0000-000000000000/requirements').expect(404);
  const response = await request(context.app).get('/missing').expect(404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('inactive types are hidden and a type without requirements returns an empty array', async () => {
  const { rows: [type] } = await context.client.query("INSERT INTO document_types(name) VALUES ('Test empty') RETURNING id");
  try {
    assert.deepEqual((await context.catalogue.requirements(type.id)).requirements, []);
    await context.client.query('UPDATE document_types SET is_active = false WHERE id = $1', [type.id]);
    assert.equal(await context.catalogue.requirements(type.id), null);
    assert.equal((await context.catalogue.list()).length, 3);
  } finally { await context.client.query('DELETE FROM document_types WHERE id = $1', [type.id]); }
});
