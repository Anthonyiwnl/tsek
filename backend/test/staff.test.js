import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { migrate, seed } from '../scripts/database-tasks.js';
import { createApp } from '../src/app.js';
import { catalogueRepository } from '../src/catalogue.js';
import { applicationsRepository } from '../src/applications.js';
import { applicationFilesRepository } from '../src/application-files.js';
import { applicationAnalysesRepository } from '../src/application-analyses.js';
import { staffRepository } from '../src/staff.js';

const citizen = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const staffId = '33333333-3333-4333-8333-333333333333';
const adminId = '44444444-4444-4444-8444-444444444444';
let db, client, app, service;
const auth = token => ({ Authorization: `Bearer ${token}` });
before(async () => {
  db = new PGlite();
  client = { query: (sql, params) => params || !sql.includes(';') ? db.query(sql, params) : db.exec(sql).then(result => result.at(-1)) };
  await migrate(client); await seed(client);
  const catalogue = catalogueRepository(client);
  service = (await catalogue.list())[0].id;
  await client.query("INSERT INTO staff_roles(user_id, role) VALUES ($1, 'staff'), ($2, 'admin')", [staffId, adminId]);
  const transaction = work => db.transaction(tx => work({ query: (sql, params) => tx.query(sql, params) }));
  app = createApp({ catalogue, applications: applicationsRepository(client), staff: staffRepository(client, transaction),
    applicationFiles: applicationFilesRepository(client), applicationAnalyses: applicationAnalysesRepository(client),
    verifyToken: async token => ({ citizen, other, staff: staffId, admin: adminId })[token], logger: { error() {} }, env: {} });
});
after(async () => db?.close());

async function draft(withFile = true) {
  const { rows: [record] } = await client.query(`INSERT INTO applications(owner_id, document_type_id, purpose)
    VALUES ($1, $2, 'Employment') RETURNING id`, [citizen, service]);
  if (withFile) {
    const { rows: [file] } = await client.query(`INSERT INTO application_files(owner_id, application_id, original_name, media_type, content)
      VALUES ($1, $2, 'proof.txt', 'text/plain', $3) RETURNING id`, [citizen, record.id, Buffer.from('Synthetic proof of residency')]);
    record.fileId = file.id;
  }
  return record;
}

test('default citizen role, no self-promotion, and every staff endpoint rejects citizens and anonymous callers', async () => {
  assert.equal((await request(app).get('/api/me').set(auth('citizen')).expect(200)).body.data.role, 'citizen');
  for (const token of ['staff', 'admin']) {
    assert.equal((await request(app).get('/api/me').set(auth(token)).expect(200)).body.data.role, token);
  }
  const row = await draft();
  const paths = [`/api/admin/applications`, `/api/admin/applications/${row.id}`, `/api/admin/applications/${row.id}/files/${row.fileId}`];
  for (const path of paths) {
    await request(app).get(path).expect(401);
    await request(app).get(path).set(auth('citizen')).set('X-Role', 'admin').expect(403);
  }
  await request(app).post(`/api/admin/applications/${row.id}/reviews`).send({ decision: 'approved', note: 'OK' }).expect(401);
  await request(app).post(`/api/admin/applications/${row.id}/reviews`).set(auth('citizen')).send({ role: 'admin' }).expect(403);
  await request(app).patch('/api/me').set(auth('citizen')).send({ role: 'admin' }).expect(404);
});

test('draft privacy, owner-only submission, prerequisites and immutable submitted documents', async () => {
  const row = await draft(); const empty = await draft(false);
  await request(app).get(`/api/admin/applications/${row.id}`).set(auth('admin')).expect(404);
  await request(app).get(`/api/admin/applications/${row.id}/files/${row.fileId}`).set(auth('staff')).expect(404);
  await request(app).post(`/api/applications/${row.id}/submit`).set(auth('other')).expect(404);
  await request(app).post(`/api/applications/${row.id}/submit`).set(auth('staff')).expect(404);
  await request(app).post(`/api/applications/${empty.id}/submit`).set(auth('citizen')).expect(409);
  await request(app).post(`/api/applications/${row.id}/submit`).set(auth('citizen')).expect(200);
  await request(app).post(`/api/applications/${row.id}/submit`).set(auth('citizen')).expect(409);
  await request(app).patch(`/api/applications/${row.id}`).set(auth('citizen')).send({ purpose: 'Changed' }).expect(409);
  await request(app).delete(`/api/applications/${row.id}`).set(auth('citizen')).expect(409);
  await request(app).delete(`/api/applications/${row.id}/files/${row.fileId}`).set(auth('citizen')).expect(409);
  const detail = await request(app).get(`/api/admin/applications/${row.id}`).set(auth('staff')).expect(200);
  assert.equal(detail.body.data.files[0].id, row.fileId);
  assert.equal(detail.body.data.checklist.is_complete, false);
  assert.equal(detail.body.data.application.owner_id, undefined);
  assert.match(detail.headers['cache-control'], /no-store/);
  const download = await request(app).get(`/api/admin/applications/${row.id}/files/${row.fileId}`).set(auth('admin')).expect(200);
  assert.equal(download.text, 'Synthetic proof of residency');
  assert.match(download.headers['content-disposition'], /^attachment;/);
  const foreign = await draft();
  await request(app).get(`/api/admin/applications/${row.id}/files/${foreign.fileId}`).set(auth('staff')).expect(404);
  await request(app).get(`/api/applications/${row.id}`).set(auth('staff')).expect(404);
});

test('review is atomic, records actor and note, prevents overwrite, and exposes notes only to the owner', async () => {
  const row = await draft();
  await request(app).post(`/api/applications/${row.id}/submit`).set(auth('citizen')).expect(200);
  for (const body of [{ decision: 'approved' }, { decision: 'draft', note: 'No' }, { decision: 'approved', note: ' ' }, { decision: 'rejected', note: 'x'.repeat(2001) }, { decision: 'approved', note: 'OK', reviewer_id: citizen }]) {
    await request(app).post(`/api/admin/applications/${row.id}/reviews`).set(auth('staff')).send(body).expect(400);
  }
  await request(app).post(`/api/admin/applications/${row.id}/reviews`).set(auth('staff')).send({ decision: 'rejected', note: ' Please provide a current proof of residency. ' }).expect(201);
  await request(app).post(`/api/admin/applications/${row.id}/reviews`).set(auth('admin')).send({ decision: 'approved', note: 'Override' }).expect(409);
  const saved = (await client.query('SELECT * FROM application_reviews WHERE application_id = $1', [row.id])).rows;
  assert.equal(saved.length, 1); assert.equal(saved[0].reviewer_id, staffId);
  assert.equal((await request(app).get(`/api/applications/${row.id}`).set(auth('citizen')).expect(200)).body.data.status, 'rejected');
  const history = await request(app).get(`/api/applications/${row.id}/reviews`).set(auth('citizen')).expect(200);
  assert.equal(history.body.data[0].note, 'Please provide a current proof of residency.');
  await request(app).get(`/api/applications/${row.id}/reviews`).set(auth('other')).expect(404);
  const approved = await draft();
  await request(app).post(`/api/applications/${approved.id}/submit`).set(auth('citizen')).expect(200);
  await request(app).post(`/api/admin/applications/${approved.id}/reviews`).set(auth('admin')).send({ decision: 'approved', note: 'Documents reviewed.' }).expect(201);
});

test('submission snapshots the checklist and legacy submissions have no snapshot', async () => {
  const row = await draft();
  const submit = body => request(app).post(`/api/applications/${row.id}/submit`).set(auth('citizen')).send(body);
  const read = id => request(app).get(`/api/admin/applications/${id}`).set(auth('staff')).expect(200);
  const blocked = await submit({ confirmIncomplete: false }).expect(409);
  assert.equal(blocked.body.error.code, 'CHECKLIST_CONFIRMATION_REQUIRED');
  const [unchanged] = (await client.query('SELECT status, submission_checklist FROM applications WHERE id = $1', [row.id])).rows;
  assert.deepEqual(unchanged, { status: 'draft', submission_checklist: null });
  await submit({ confirmIncomplete: true }).expect(200);
  const initial = (await read(row.id)).body.data.checklist;
  assert.equal(initial.is_complete, false);
  assert.ok(initial.requirements.length > 0);
  await client.query("UPDATE document_requirements SET name = name || ' (updated)' WHERE document_type_id = $1", [service]);
  try {
    assert.deepEqual((await read(row.id)).body.data.checklist, initial);
    const legacy = await draft();
    await client.query("UPDATE applications SET status = 'submitted' WHERE id = $1", [legacy.id]);
    assert.equal((await read(legacy.id)).body.data.checklist, null);
  } finally {
    await client.query("UPDATE document_requirements SET name = replace(name, ' (updated)', '') WHERE document_type_id = $1", [service]);
  }
});

test('submission rejects invalid confirmation bodies and leaves the draft intact', async () => {
  const row = await draft();
  const submit = () => request(app).post(`/api/applications/${row.id}/submit`).set(auth('citizen'));
  for (const body of [{}, { confirmIncomplete: 'yes' }, { confirmIncomplete: true, extra: 1 }, []]) {
    const response = await submit().type('json').send(JSON.stringify(body)).expect(400);
    assert.equal(response.body.error.code, 'INVALID_BODY');
  }
  const malformed = await submit().type('json').send('{').expect(400);
  assert.equal(malformed.body.error.code, 'INVALID_JSON');
  const [unchanged] = (await client.query('SELECT status, submission_checklist FROM applications WHERE id = $1', [row.id])).rows;
  assert.deepEqual(unchanged, { status: 'draft', submission_checklist: null });
});

test('a complete checklist submits without an incomplete confirmation', async () => {
  const row = await draft();
  const { requirements } = await catalogueRepository(client).requirements(service);
  assert.ok(requirements.some(item => item.is_required));
  await applicationAnalysesRepository(client).create(citizen, row.id, row.fileId, service, {
    status: 'completed',
    result: { observations: { documentType: { value: 'Synthetic supporting document' } } },
    normalizedResult: { requirements: requirements.map(item => ({
      id: item.id, status: 'complete', reason: 'Synthetic evidence matched.', matches: true,
    })) },
    errorCode: null, metadata: null,
  });
  await request(app).post(`/api/applications/${row.id}/submit`).set(auth('citizen')).send({ confirmIncomplete: false }).expect(200);
  const { body } = await request(app).get(`/api/admin/applications/${row.id}`).set(auth('staff')).expect(200);
  assert.equal(body.data.checklist.is_complete, true);
  assert.ok(body.data.checklist.requirements.every(item => item.status === 'complete'));
});

test('staff and admins cannot review their own submissions, including direct repository calls', async () => {
  for (const [token, owner] of [['staff', staffId], ['admin', adminId]]) {
    const { rows: [row] } = await client.query(`INSERT INTO applications(owner_id, document_type_id, purpose, status)
      VALUES ($1, $2, 'Personal application', 'submitted') RETURNING id`, [owner, service]);
    for (const decision of ['approved', 'rejected']) {
      const response = await request(app).post(`/api/admin/applications/${row.id}/reviews`).set(auth(token)).send({ decision, note: 'Own application' }).expect(403);
      assert.equal(response.body.error.code, 'SELF_REVIEW_FORBIDDEN');
      assert.equal(await staffRepository(client).review(owner, row.id, decision, 'Own application'), null);
    }
    assert.equal((await client.query('SELECT status FROM applications WHERE id = $1', [row.id])).rows[0].status, 'submitted');
    assert.equal((await client.query('SELECT count(*)::int AS count FROM application_reviews WHERE application_id = $1', [row.id])).rows[0].count, 0);
    await request(app).post(`/api/admin/applications/${row.id}/reviews`).set(auth(token === 'staff' ? 'admin' : 'staff')).send({ decision: 'approved', note: 'Independently reviewed' }).expect(201);
  }
});

test('staff search finds submitted applications by TSK reference or UUID prefix', async () => {
  const matchingId = '9a07c5e4-8dc3-4d86-8d3e-4312a0e44b03';
  const embeddedId = '073f1d63-cfb0-4966-936f-3857129a07c5';
  const draftId = '9a07c5b2-7a9a-4c6f-b196-cc75ffd67bd2';
  await client.query(`INSERT INTO applications(id, owner_id, document_type_id, purpose, status)
    VALUES ($1, $4, $5, 'Market stall renewal', 'submitted'),
           ($2, $4, $5, 'Unrelated application', 'submitted'),
           ($3, $4, $5, 'Private draft', 'draft')`, [matchingId, embeddedId, draftId, citizen, service]);

  for (const search of ['TSK-9A07C5', ' tsk-9a07c5 ', '9a07c5', matchingId, 'MARKET STALL']) {
    const response = await request(app).get('/api/admin/applications')
      .query({ search, status: '' }).set(auth('staff')).expect(200);
    assert.deepEqual(response.body.data.map(application => application.id), [matchingId], `search: ${search}`);
  }

  const invalid = await request(app).get('/api/admin/applications?search=TSK-9A07C5&search=duplicate')
    .set(auth('staff')).expect(400);
  assert.equal(invalid.body.error.code, 'INVALID_QUERY');
});

test('bare six-character hex searches also match purpose and service name', async () => {
  const referenceId = 'decade78-3cdd-4240-9d6b-dd3bd356c257';
  const textId = '016c3a16-0c90-4697-810c-cd32009f3597';
  const { rows: [{ id: facadeService }] } = await client.query(
    "INSERT INTO document_types(name) VALUES ('Facade permit') RETURNING id",
  );
  await client.query(`INSERT INTO applications(id, owner_id, document_type_id, purpose, status)
    VALUES ($1, $3, $4, 'Ordinary request', 'submitted'),
           ($2, $3, $5, 'A decade of residency', 'submitted')`, [referenceId, textId, citizen, service, facadeService]);

  const searches = [
    ['DECADE', [textId, referenceId]],
    ['FaCaDe', [textId]],
    ['TSK-DECADE', [referenceId]],
    ['TSK-FACADE', []],
  ];
  for (const [search, expected] of searches) {
    const response = await request(app).get('/api/admin/applications')
      .query({ search }).set(auth('staff')).expect(200);
    assert.deepEqual(response.body.data.map(application => application.id).sort(), expected, `search: ${search}`);
  }
});

test('queue filters, validation, pagination, role revocation and database errors fail closed', async () => {
  const page = await request(app).get('/api/admin/applications?limit=1&status=').set(auth('admin')).expect(200);
  assert.equal(page.body.data.length, 1); assert.equal(page.body.hasMore, true);
  const next = await request(app).get('/api/admin/applications?limit=1&status=&offset=1').set(auth('admin')).expect(200);
  assert.notEqual(next.body.data[0].id, page.body.data[0].id);
  const filtered = await request(app).get('/api/admin/applications?status=rejected&search=Employment').set(auth('admin')).expect(200);
  assert.ok(filtered.body.data.length > 0);
  assert.ok(filtered.body.data.every(row => row.status === 'rejected'));
  for (const query of ['status=draft', 'limit=101', 'offset=-1', 'status=approved&status=rejected', 'role=admin']) {
    await request(app).get('/api/admin/applications?' + query).set(auth('staff')).expect(400);
  }
  await request(app).get('/api/admin/applications/not-a-uuid').set(auth('staff')).expect(400);
  await client.query('DELETE FROM staff_roles WHERE user_id = $1', [staffId]);
  await request(app).get('/api/admin/applications').set(auth('staff')).expect(403);
  const broken = createApp({ staff: { role: async () => { throw new Error('secret DB details'); } }, verifyToken: async () => adminId, logger: { error() {} }, env: {} });
  const result = await request(broken).get('/api/admin/applications').set(auth('admin')).expect(500);
  assert.doesNotMatch(result.text, /secret DB details/);
});
