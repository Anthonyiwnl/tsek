import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose';
import request from 'supertest';
import { migrate, seed, transaction } from '../scripts/database-tasks.js';
import { catalogueRepository } from '../src/catalogue.js';
import { applicationsRepository } from '../src/applications.js';
import { privateDataRepository } from '../src/private-data.js';
import { createOpenAiProvider, ProviderError } from '../src/provider.js';
import { createApp } from '../src/app.js';
import { createNeonTokenVerifier, createTokenVerifier } from '../src/auth.js';
import { databaseUrl, serverConfig } from '../src/config.js';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
function structuredAnalysis(documentType, requirements, { incompleteSecond = true } = {}) {
  return JSON.stringify({
    detected_document_type: documentType,
    extracted_fields: { applicant_name: 'Synthetic Applicant', address: null },
    requirements: requirements.map((requirement, index) => ({
      requirement_id: requirement.id,
      status: index === 1 && incompleteSecond ? 'incomplete' : 'complete',
      reason: index === 1 && incompleteSecond ? 'Address evidence was not present.' : 'Synthetic evidence was present.',
    })),
  });
}
let db;
let client;
let app;
let catalogue;
let applications;
let privateData;
let documentTypeId;
before(async () => {
  db = new PGlite();
  // PGlite uses exec for multi-statement SQL; pg accepts it through query.
  client = { query: (sql, params) => params || !sql.includes(';')
    ? db.query(sql, params) : db.exec(sql).then(results => results.at(-1)) };
  await migrate(client);
  await seed(client);
  catalogue = catalogueRepository(client);
  applications = applicationsRepository(client);
  privateData = privateDataRepository(client);
  documentTypeId = (await catalogue.list())[0].id;
  app = createApp({
    catalogue,
    applications,
    privateData,
    verifyToken: async token => {
      if (token === 'user-a') return userA;
      if (token === 'user-b') return userB;
      throw new Error('Invalid test token');
    },
    logger: { error() {} },
  });
});
after(async () => { await db?.close(); });

test('migrations and seed are repeatable without replacing IDs or duplicating records', async () => {
  const before = await catalogue.list();
  await migrate(client);
  await seed(client);
  assert.deepEqual(await catalogue.list(), before);
  assert.equal(before.length, 3);
  assert.equal((await client.query('SELECT count(*)::int AS count FROM document_requirements')).rows[0].count, 9);
  assert.equal((await client.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, 4);
});

test('catalogue HTTP endpoints return seeded, ordered database records', async () => {
  const list = await request(app).get('/api/document-types').expect(200);
  assert.equal(list.body.data.length, 3);
  assert.equal(list.body.data[0].name, 'Barangay Clearance');
  const detail = await request(app).get(`/api/document-types/${list.body.data[0].id}/requirements`).expect(200);
  assert.deepEqual(detail.body.data.requirements.map(row => row.sort_order), [1, 2, 3]);
  assert.equal(detail.body.data.requirements[2].is_required, false);
  assert.ok(Array.isArray(detail.body.data.requirements[0].accepted_document_types));
});

test('invalid UUIDs, missing records, and unknown routes return JSON errors', async () => {
  await request(app).get('/api/document-types/not-a-uuid/requirements').expect(400);
  await request(app).get('/api/document-types/00000000-0000-0000-0000-000000000000/requirements').expect(404);
  const response = await request(app).get('/missing').expect(404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('inactive types are hidden and a type without requirements returns an empty array', async () => {
  const { rows: [type] } = await client.query("INSERT INTO document_types(name) VALUES ('Test empty') RETURNING id");
  try {
    assert.deepEqual((await catalogue.requirements(type.id)).requirements, []);
    await client.query('UPDATE document_types SET is_active = false WHERE id = $1', [type.id]);
    assert.equal(await catalogue.requirements(type.id), null);
    assert.equal((await catalogue.list()).length, 3);
  } finally { await client.query('DELETE FROM document_types WHERE id = $1', [type.id]); }
});

test('foreign keys, uniqueness and sort order constraints reject bad records', async () => {
  await assert.rejects(client.query("INSERT INTO document_requirements(document_type_id,name) VALUES ('00000000-0000-0000-0000-000000000000','Missing parent')"), { code: '23503' });
  await assert.rejects(client.query("INSERT INTO document_types(name) VALUES ('Barangay Clearance')"), { code: '23505' });
  await assert.rejects(client.query("INSERT INTO document_requirements(document_type_id,name,sort_order) SELECT id,'Bad order',-1 FROM document_types LIMIT 1"), { code: '23514' });
});

test('failed database transactions roll back all changes', async () => {
  await assert.rejects(transaction(client, async () => {
    await client.query("INSERT INTO document_types(name) VALUES ('Rollback test')");
    throw new Error('deliberate failure');
  }));
  assert.equal((await client.query("SELECT id FROM document_types WHERE name = 'Rollback test'")).rows.length, 0);
});

test('migration checksum drift is detected', async () => {
  const { rows: [migration] } = await client.query('SELECT name, checksum FROM schema_migrations');
  await client.query("UPDATE schema_migrations SET checksum = 'changed'");
  try { await assert.rejects(migrate(client), /Applied migration has changed/); }
  finally { await client.query('UPDATE schema_migrations SET checksum = $1 WHERE name = $2', [migration.checksum, migration.name]); }
});

test('database failure is sanitized and readiness differs from liveness', async () => {
  const fail = async () => { throw new Error('secret connection string'); };
  const loggedErrors = [];
  const broken = createApp({ catalogue: { list: fail, ready: fail }, logger: { error(error) { loggedErrors.push(error); } } });
  const response = await request(broken).get('/api/document-types').expect(500);
  assert.equal(response.body.error.code, 'INTERNAL_ERROR');
  assert.ok(!response.text.includes('secret'));
  await request(broken).get('/health').expect(200);
  await request(broken).get('/health/ready').expect(503);
  assert.deepEqual(loggedErrors.map(({ event }) => event), ['request_failed', 'readiness_check_failed']);
  assert.ok(!JSON.stringify(loggedErrors).includes('secret'));
  await request(app).get('/health/ready').expect(200);
});

test('API includes security headers and configured CORS origin', async () => {
  const response = await request(app).get('/health').set('Origin', 'http://localhost:5173').expect(200);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('application CRUD requires authentication and scopes every operation to its owner', async () => {
  const unauthenticated = await request(app).get('/api/applications').expect(401);
  assert.equal(unauthenticated.body.error.code, 'UNAUTHENTICATED');

  const created = await request(app)
    .post('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .send({ document_type_id: documentTypeId, purpose: '  Employment  ' })
    .expect(201);
  const application = created.body.data;
  assert.equal(application.purpose, 'Employment');
  assert.equal(application.status, 'draft');
  assert.equal(application.document_type_name, 'Barangay Clearance');
  assert.equal(created.headers.location, `/api/applications/${application.id}`);

  const ownerList = await request(app)
    .get('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .expect(200);
  assert.deepEqual(ownerList.body.data.map(({ id }) => id), [application.id]);
  const otherList = await request(app)
    .get('/api/applications')
    .set('Authorization', 'Bearer user-b')
    .expect(200);
  assert.deepEqual(otherList.body.data, []);

  await request(app)
    .get(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-b')
    .expect(404);
  await request(app)
    .get(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-a')
    .expect(200);

  // The owner is always derived from the verified token, never from request data.
  await request(app)
    .patch(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-b')
    .send({ purpose: 'attempted takeover' })
    .expect(404);

  const updated = await request(app)
    .patch(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-a')
    .send({ purpose: '  Housing support  ' })
    .expect(200);
  assert.equal(updated.body.data.purpose, 'Housing support');
  assert.ok(new Date(updated.body.data.updated_at) >= new Date(application.updated_at));

  await request(app)
    .delete(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-b')
    .expect(404);
  await request(app)
    .delete(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-a')
    .expect(204);
  await request(app)
    .get(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-a')
    .expect(404);
});

test('application CRUD validates inputs, service references, and draft-only changes', async () => {
  const authorization = { Authorization: 'Bearer user-a' };
  await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: 'not-a-uuid' })
    .expect(400);
  await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: [documentTypeId] })
    .expect(400);
  await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: documentTypeId, owner_id: userB })
    .expect(400);
  await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({
      document_type_id: '00000000-0000-0000-0000-000000000000',
    })
    .expect(422);

  const created = await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: documentTypeId })
    .expect(201);
  const id = created.body.data.id;
  const { rows: [otherType] } = await client.query(
    "INSERT INTO public.document_types(name) VALUES ('Applications test category') RETURNING id",
  );
  try {
    await request(app)
      .patch(`/api/applications/${id}`)
      .set(authorization)
      .send({})
      .expect(400);
    await request(app)
      .patch(`/api/applications/${id}`)
      .set(authorization)
      .send({ owner_id: userB })
      .expect(400);
    await request(app)
      .patch(`/api/applications/${id}`)
      .set(authorization)
      .send({ document_type_id: [documentTypeId] })
      .expect(400);
    await request(app)
      .patch(`/api/applications/${id}`)
      .set(authorization)
      .send({ purpose: 'x'.repeat(201) })
      .expect(400);
    await request(app)
      .patch('/api/applications/not-a-uuid')
      .set(authorization)
      .send({ purpose: 'test' })
      .expect(400);

    const changedType = await request(app)
      .patch(`/api/applications/${id}`)
      .set(authorization)
      .send({ document_type_id: otherType.id })
      .expect(200);
    assert.equal(changedType.body.data.document_type_name, 'Applications test category');
    await client.query(
      'UPDATE public.document_types SET is_active = false WHERE id = $1',
      [otherType.id],
    );
    const inactiveType = await request(app)
      .patch(`/api/applications/${id}`)
      .set(authorization)
      .send({ document_type_id: otherType.id })
      .expect(422);
    assert.equal(inactiveType.body.error.code, 'INVALID_DOCUMENT_TYPE');

    await client.query("UPDATE public.applications SET status = 'submitted' WHERE id = $1", [id]);
    const updated = await request(app)
      .patch(`/api/applications/${id}`)
      .set(authorization)
      .send({ purpose: 'cannot change' })
      .expect(409);
    assert.equal(updated.body.error.code, 'APPLICATION_NOT_EDITABLE');
    const deleted = await request(app)
      .delete(`/api/applications/${id}`)
      .set(authorization)
      .expect(409);
    assert.equal(deleted.body.error.code, 'APPLICATION_NOT_DELETABLE');
  } finally {
    await client.query('DELETE FROM public.applications WHERE id = $1', [id]);
    await client.query('DELETE FROM public.document_types WHERE id = $1', [otherType.id]);
  }
});

test('application database failures return sanitized errors with a request ID', async () => {
  const secret = 'postgres://user:password@private.example/db';
  const brokenApplications = {
    list: async () => { throw new Error(secret); },
    create: async () => { throw new Error(secret); },
    get: async () => { throw new Error(secret); },
    update: async () => { throw new Error(secret); },
    deleteDraft: async () => { throw new Error(secret); },
  };
  const errors = [];
  const broken = createApp({
    catalogue,
    applications: brokenApplications,
    verifyToken: async () => userA,
    logger: { error(error) { errors.push(error); } },
  });
  const authorization = 'Bearer user-a';
  const applicationId = '33333333-3333-4333-8333-333333333333';
  const responses = await Promise.all([
    request(broken).get('/api/applications').set('Authorization', authorization),
    request(broken).post('/api/applications').set('Authorization', authorization)
      .send({ document_type_id: documentTypeId }),
    request(broken).get(`/api/applications/${applicationId}`).set('Authorization', authorization),
    request(broken).patch(`/api/applications/${applicationId}`).set('Authorization', authorization)
      .send({ purpose: 'failure test' }),
    request(broken).delete(`/api/applications/${applicationId}`).set('Authorization', authorization),
  ]);
  for (const response of responses) {
    assert.equal(response.status, 500);
    assert.equal(response.body.error.code, 'INTERNAL_ERROR');
    assert.ok(response.body.error.requestId);
    assert.ok(!response.text.includes(secret));
    assert.equal(response.headers['x-request-id'], response.body.error.requestId);
  }
  assert.equal(errors.length, 5);
  assert.ok(!JSON.stringify(errors).includes(secret));
});

test('private file routes enforce owner, draft, media type, and upload size rules', async () => {
  const authorization = 'Bearer user-a';
  const created = await request(app)
    .post('/api/applications')
    .set('Authorization', authorization)
    .send({ document_type_id: documentTypeId })
    .expect(201);
  const applicationId = created.body.data.id;
  const uploaded = await request(app)
    .post(`/api/applications/${applicationId}/files`)
    .set('Authorization', authorization)
    .set('Content-Type', 'text/plain')
    .set('Content-Disposition', 'attachment; filename="proof.txt"')
    .send(Buffer.from('sample proof text'))
    .expect(201);
  const file = uploaded.body.data;
  assert.equal(file.original_name, 'proof.txt');
  assert.equal(file.size, 17);
  assert.equal(Object.hasOwn(file, 'content'), false);

  const listed = await request(app)
    .get(`/api/applications/${applicationId}/files`)
    .set('Authorization', authorization)
    .expect(200);
  assert.deepEqual(listed.body.data.map(({ id }) => id), [file.id]);

  const downloaded = await request(app)
    .get(`/api/applications/${applicationId}/files/${file.id}`)
    .set('Authorization', authorization)
    .expect(200);
  assert.equal(downloaded.text, 'sample proof text');
  assert.equal(downloaded.headers['cache-control'], 'private, no-store');
  await request(app)
    .get(`/api/applications/${applicationId}/files/${file.id}`)
    .set('Authorization', 'Bearer user-b')
    .expect(404);

  await request(app)
    .post(`/api/applications/${applicationId}/files`)
    .set('Authorization', authorization)
    .set('Content-Type', 'application/zip')
    .set('Content-Disposition', 'attachment; filename="archive.zip"')
    .send(Buffer.from('zip'))
    .expect(415);
  await request(app)
    .post(`/api/applications/${applicationId}/files`)
    .set('Authorization', authorization)
    .set('Content-Type', 'text/plain')
    .send(Buffer.from('missing filename'))
    .expect(400);
  await request(app)
    .post(`/api/applications/${applicationId}/files`)
    .set('Authorization', authorization)
    .set('Content-Type', 'text/plain')
    .set('Content-Disposition', 'attachment; filename="large.txt"')
    .send(Buffer.alloc((2 * 1024 * 1024) + 1, 97))
    .expect(413);

  await client.query("UPDATE public.applications SET status = 'submitted' WHERE id = $1", [applicationId]);
  await request(app)
    .post(`/api/applications/${applicationId}/files`)
    .set('Authorization', authorization)
    .set('Content-Type', 'text/plain')
    .set('Content-Disposition', 'attachment; filename="later.txt"')
    .send(Buffer.from('later'))
    .expect(409);
  await request(app)
    .delete(`/api/applications/${applicationId}/files/${file.id}`)
    .set('Authorization', authorization)
    .expect(409);
  await client.query("UPDATE public.applications SET status = 'draft' WHERE id = $1", [applicationId]);
  await request(app)
    .delete(`/api/applications/${applicationId}/files/${file.id}`)
    .set('Authorization', authorization)
    .expect(204);
  await request(app).delete(`/api/applications/${applicationId}`).set('Authorization', authorization).expect(204);
});

test('private file database failures are sanitized', async () => {
  const secret = 'private storage connection details';
  const errors = [];
  const broken = createApp({
    catalogue,
    applications,
    privateData: {
      getApplication: async () => { throw new Error(secret); },
    },
    verifyToken: async () => userA,
    logger: { error(error) { errors.push(error); } },
  });
  const response = await request(broken)
    .get('/api/applications/33333333-3333-4333-8333-333333333333/files')
    .set('Authorization', 'Bearer user-a')
    .expect(500);
  assert.equal(response.body.error.code, 'INTERNAL_ERROR');
  assert.ok(response.body.error.requestId);
  assert.ok(!response.text.includes(secret));
  assert.ok(!JSON.stringify(errors).includes(secret));
});

test('analysis records stay owner-scoped and enforce a rolling per-user quota', async () => {
  const created = await request(app)
    .post('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .send({ document_type_id: documentTypeId })
    .expect(201);
  const applicationId = created.body.data.id;
  const file = await privateData.createFile(userA, applicationId, {
    originalName: 'analysis.txt',
    mediaType: 'text/plain',
    content: Buffer.from('synthetic requirements sample'),
  });
  const analyses = [];
  for (let index = 0; index < 3; index += 1) {
    analyses.push(await privateData.createAnalysis(userA, applicationId, file.id, 'test-model', 3));
  }
  assert.ok(analyses.every(Boolean));
  assert.equal(await privateData.createAnalysis(userA, applicationId, file.id, 'test-model', 3), null);
  assert.equal((await privateData.listAnalyses(userA, applicationId)).length, 3);
  assert.equal(await privateData.getAnalysis(userB, applicationId, analyses[0].id), null);
  const listed = await request(app)
    .get(`/api/applications/${applicationId}/analyses`)
    .set('Authorization', 'Bearer user-a')
    .expect(200);
  assert.equal(listed.body.data.length, 3);
  const detail = await request(app)
    .get(`/api/applications/${applicationId}/analyses/${analyses[0].id}`)
    .set('Authorization', 'Bearer user-a')
    .expect(200);
  assert.equal(detail.body.data.id, analyses[0].id);
  await request(app)
    .get(`/api/applications/${applicationId}/analyses/${analyses[0].id}`)
    .set('Authorization', 'Bearer user-b')
    .expect(404);
  await request(app).delete(`/api/applications/${applicationId}`).set('Authorization', 'Bearer user-a').expect(204);
});

test('analysis endpoint verifies file ownership, bounds requests, saves results, and enforces cost limit', async () => {
  let calls = 0;
  let providerInput;
  const selectedType = await catalogue.requirements(documentTypeId);
  const provider = async ({ input, requirements }) => {
    calls += 1;
    providerInput = { input, requirements };
    return {
      model: 'mock-model',
      result: structuredAnalysis(selectedType.name, requirements, { incompleteSecond: calls > 1 }),
    };
  };
  provider.model = 'mock-model';
  const analysisApp = createApp({
    catalogue,
    applications,
    privateData,
    verifyToken: async token => token === 'user-a' ? userA : userB,
    analysisProvider: provider,
    logger: { error() {} },
  });
  const created = await request(analysisApp)
    .post('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .send({ document_type_id: documentTypeId })
    .expect(201);
  const applicationId = created.body.data.id;
  const uploaded = await request(analysisApp)
    .post(`/api/applications/${applicationId}/files`)
    .set('Authorization', 'Bearer user-a')
    .set('Content-Type', 'text/plain')
    .set('Content-Disposition', 'attachment; filename="sample.txt"')
    .send(Buffer.from('Synthetic document content'))
    .expect(201);
  const body = { file_id: uploaded.body.data.id };

  await request(analysisApp)
    .post(`/api/applications/${applicationId}/analyses`)
    .set('Authorization', 'Bearer user-a')
    .send({ file_id: 'not-a-uuid' })
    .expect(400);
  const image = await request(analysisApp)
    .post(`/api/applications/${applicationId}/files`)
    .set('Authorization', 'Bearer user-a')
    .set('Content-Type', 'image/png')
    .set('Content-Disposition', 'attachment; filename="photo.png"')
    .send(Buffer.from([137, 80, 78, 71]))
    .expect(201);
  await request(analysisApp)
    .post(`/api/applications/${applicationId}/analyses`)
    .set('Authorization', 'Bearer user-a')
    .send({ file_id: image.body.data.id })
    .expect(415);
  const oversizedText = await request(analysisApp)
    .post(`/api/applications/${applicationId}/files`)
    .set('Authorization', 'Bearer user-a')
    .set('Content-Type', 'text/plain')
    .set('Content-Disposition', 'attachment; filename="large.txt"')
    .send(Buffer.alloc(20001, 97))
    .expect(201);
  await request(analysisApp)
    .post(`/api/applications/${applicationId}/analyses`)
    .set('Authorization', 'Bearer user-a')
    .send({ file_id: oversizedText.body.data.id })
    .expect(413);

  await request(analysisApp)
    .post(`/api/applications/${applicationId}/analyses`)
    .set('Authorization', 'Bearer user-b')
    .send(body)
    .expect(404);
  assert.equal(calls, 0);

  let completed;
  for (let index = 0; index < 3; index += 1) {
    const response = await request(analysisApp)
      .post(`/api/applications/${applicationId}/analyses`)
      .set('Authorization', 'Bearer user-a')
      .send(body)
      .expect(201);
    completed = response.body.data;
    assert.equal(completed.status, 'completed');
    assert.equal(completed.normalized_result.detected_document_type, selectedType.name);
    assert.equal(completed.normalized_result.document_type_match, true);
    assert.equal(completed.normalized_result.requirements.length, 3);
    if (index === 0) {
      const firstChecklist = await request(analysisApp)
        .get(`/api/applications/${applicationId}/checklist`)
        .set('Authorization', 'Bearer user-a')
        .expect(200);
      assert.equal(firstChecklist.body.data.is_complete, true);
    }
  }
  assert.equal(calls, 3);
  assert.equal(providerInput.input, 'Synthetic document content');
  assert.equal(providerInput.requirements.length, 3);
  const checklist = await request(analysisApp)
    .get(`/api/applications/${applicationId}/checklist`)
    .set('Authorization', 'Bearer user-a')
    .expect(200);
  assert.equal(checklist.body.data.is_complete, false);
  assert.equal(checklist.body.data.requirements[1].status, 'incomplete');
  assert.equal(checklist.body.data.requirements[1].reason, 'Address evidence was not present.');
  await request(analysisApp)
    .get(`/api/applications/${applicationId}/checklist`)
    .set('Authorization', 'Bearer user-b')
    .expect(404);
  await request(analysisApp)
    .post(`/api/applications/${applicationId}/analyses`)
    .set('Authorization', 'Bearer user-a')
    .send(body)
    .expect(429);
  assert.equal(calls, 3);
  await request(analysisApp)
    .get(`/api/applications/${applicationId}/analyses/${completed.id}`)
    .set('Authorization', 'Bearer user-b')
    .expect(404);
  await client.query("UPDATE public.applications SET status = 'submitted' WHERE id = $1", [applicationId]);
  await request(analysisApp)
    .post(`/api/applications/${applicationId}/analyses`)
    .set('Authorization', 'Bearer user-a')
    .send(body)
    .expect(409);
  await client.query("UPDATE public.applications SET status = 'draft' WHERE id = $1", [applicationId]);
  await request(analysisApp).delete(`/api/applications/${applicationId}`).set('Authorization', 'Bearer user-a').expect(204);
});

test('invalid or mismatched AI output cannot complete checklist items', async () => {
  let modelOutput = '{"requirements":[]}';
  const analysisApp = createApp({
    catalogue,
    applications,
    privateData,
    verifyToken: async () => userB,
    analysisProvider: Object.assign(async ({ requirements }) => ({
      model: 'mock-model',
      result: typeof modelOutput === 'function' ? modelOutput(requirements) : modelOutput,
    }), {
      model: 'mock-model',
    }),
    logger: { error() {} },
  });
  const created = await request(analysisApp)
    .post('/api/applications')
    .set('Authorization', 'Bearer user-b')
    .send({ document_type_id: documentTypeId })
    .expect(201);
  const applicationId = created.body.data.id;
  const uploaded = await request(analysisApp)
    .post(`/api/applications/${applicationId}/files`)
    .set('Authorization', 'Bearer user-b')
    .set('Content-Type', 'text/plain')
    .set('Content-Disposition', 'attachment; filename="invalid.txt"')
    .send(Buffer.from('Synthetic document content'))
    .expect(201);
  const response = await request(analysisApp)
    .post(`/api/applications/${applicationId}/analyses`)
    .set('Authorization', 'Bearer user-b')
    .send({ file_id: uploaded.body.data.id })
    .expect(502);
  assert.equal(response.body.error.code, 'AI_INVALID_RESPONSE');
  const [analysis] = await privateData.listAnalyses(userB, applicationId);
  assert.equal(analysis.status, 'failed');
  assert.equal(analysis.error_code, 'AI_INVALID_RESPONSE');
  const checklist = await request(analysisApp)
    .get(`/api/applications/${applicationId}/checklist`)
    .set('Authorization', 'Bearer user-b')
    .expect(200);
  assert.equal(checklist.body.data.is_complete, false);
  assert.ok(checklist.body.data.requirements.every(item => item.status === 'uncertain'));

  modelOutput = requirements => structuredAnalysis('Unrelated document', requirements, { incompleteSecond: false });
  const mismatched = await request(analysisApp)
    .post(`/api/applications/${applicationId}/analyses`)
    .set('Authorization', 'Bearer user-b')
    .send({ file_id: uploaded.body.data.id })
    .expect(201);
  assert.equal(mismatched.body.data.normalized_result.document_type_match, false);
  const afterMismatch = await request(analysisApp)
    .get(`/api/applications/${applicationId}/checklist`)
    .set('Authorization', 'Bearer user-b')
    .expect(200);
  assert.equal(afterMismatch.body.data.is_complete, false);
  assert.ok(afterMismatch.body.data.requirements.every(item => item.status === 'uncertain'));
  await request(analysisApp).delete(`/api/applications/${applicationId}`).set('Authorization', 'Bearer user-b').expect(204);
});

test('analysis provider failures are stored and returned without upstream details', async () => {
  const provider = async () => { throw new ProviderError('safe timeout', 'AI_TIMEOUT', 504); };
  provider.model = 'mock-model';
  const analysisApp = createApp({
    catalogue,
    applications,
    privateData,
    verifyToken: async () => userA,
    analysisProvider: provider,
    logger: { error() {} },
  });
  const created = await request(analysisApp)
    .post('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .send({ document_type_id: documentTypeId })
    .expect(201);
  const applicationId = created.body.data.id;
  const uploaded = await request(analysisApp)
    .post(`/api/applications/${applicationId}/files`)
    .set('Authorization', 'Bearer user-a')
    .set('Content-Type', 'text/plain')
    .set('Content-Disposition', 'attachment; filename="sample.txt"')
    .send(Buffer.from('Synthetic document content'))
    .expect(201);
  const failure = await request(analysisApp)
    .post(`/api/applications/${applicationId}/analyses`)
    .set('Authorization', 'Bearer user-a')
    .send({ file_id: uploaded.body.data.id })
    .expect(504);
  assert.equal(failure.body.error.code, 'AI_TIMEOUT');
  const [record] = await privateData.listAnalyses(userA, applicationId);
  assert.equal(record.status, 'failed');
  assert.equal(record.error_code, 'AI_TIMEOUT');
  await request(analysisApp).delete(`/api/applications/${applicationId}`).set('Authorization', 'Bearer user-a').expect(204);
});

test('AI provider retries transient failures and returns safe terminal errors', async () => {
  let calls = 0;
  const delays = [];
  const provider = createOpenAiProvider({
    apiKey: 'test-key',
    model: 'test-model',
    timeoutMs: 100,
    sleepImpl: async delay => delays.push(delay),
    fetchImpl: async (_url, options) => {
      calls += 1;
      assert.equal(JSON.parse(options.body).max_tokens, 600);
      assert.deepEqual(JSON.parse(options.body).response_format, { type: 'json_object' });
      return calls === 1
        ? new Response('{}', { status: 503 })
        : new Response(JSON.stringify({ choices: [{ message: { content: ' Synthetic result ' } }] }), { status: 200 });
    },
  });
  assert.deepEqual(await provider({ input: 'synthetic text', requirements: [] }), {
    model: 'test-model', result: 'Synthetic result',
  });
  assert.equal(calls, 2);
  assert.deepEqual(delays, [250]);

  const limited = createOpenAiProvider({
    apiKey: 'test-key',
    model: 'test-model',
    timeoutMs: 100,
    maxAttempts: 2,
    sleepImpl: async () => {},
    fetchImpl: async () => new Response('{}', { status: 429 }),
  });
  await assert.rejects(limited({ input: 'synthetic text', requirements: [] }), error =>
    error instanceof ProviderError && error.code === 'AI_RATE_LIMITED' && error.status === 503);
});

test('application API rejects malformed JSON and invalid bearer tokens', async () => {
  const invalidToken = await request(app)
    .get('/api/applications')
    .set('Authorization', 'Bearer invalid')
    .expect(401);
  assert.equal(invalidToken.body.error.code, 'UNAUTHENTICATED');
  const malformed = await request(app)
    .post('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .set('Content-Type', 'application/json')
    .send('{"document_type_id":')
    .expect(400);
  assert.equal(malformed.body.error.code, 'INVALID_JSON');

  const oversized = await request(app)
    .post('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .set('Content-Type', 'application/json')
    .send(`{"document_type_id":"${documentTypeId}","purpose":"${'x'.repeat(33 * 1024)}"}`)
    .expect(413);
  assert.equal(oversized.body.error.code, 'PAYLOAD_TOO_LARGE');

  const authErrors = [];
  const unavailableAuth = createApp({
    catalogue,
    applications,
    verifyToken: async () => { throw new TypeError('JWKS endpoint unavailable'); },
    logger: { error(error) { authErrors.push(error); } },
  });
  const unavailable = await request(unavailableAuth)
    .get('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .expect(503);
  assert.equal(unavailable.body.error.code, 'AUTH_UNAVAILABLE');
  assert.equal(authErrors[0].event, 'auth_verification_unavailable');

  const unavailableStorage = createApp({
    catalogue,
    verifyToken: async () => userA,
    logger: { error() {} },
  });
  const storageUnavailable = await request(unavailableStorage)
    .get('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .expect(503);
  assert.equal(storageUnavailable.body.error.code, 'APPLICATIONS_UNAVAILABLE');
});

test('Neon Auth token verifier checks EdDSA signature, issuer, and user subject', async () => {
  assert.throws(() => createNeonTokenVerifier({}), /NEON_AUTH_BASE_URL/);
  const issuer = 'https://auth.example.test';
  const { publicKey, privateKey } = await generateKeyPair('EdDSA');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-key';
  const verifier = createTokenVerifier(
    createLocalJWKSet({ keys: [jwk] }),
    issuer,
  );
  const token = await new SignJWT({ sub: userA })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(privateKey);
  assert.equal(await verifier(token), userA);

  const wrongIssuer = await new SignJWT({ sub: userA })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
    .setIssuer('https://other.example.test')
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(privateKey);
  await assert.rejects(verifier(wrongIssuer));

  const invalidSubject = await new SignJWT({ sub: 'not-a-user-id' })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(privateKey);
  await assert.rejects(verifier(invalidSubject), /valid user ID/);
});

test('configuration rejects missing URLs, insecure remote TLS, pooled migrations, and invalid ports', () => {
  assert.throws(() => databaseUrl({}), /Set DATABASE_URL/);
  assert.throws(() => databaseUrl({ DATABASE_URL: 'postgres://user:pass@remote/db?sslmode=disable' }), /verify-full/);
  assert.throws(() => databaseUrl({ DATABASE_URL: 'postgres://user:pass@ep-test-pooler.region.neon.tech/db?sslmode=verify-full' }, { migration: true }), /direct Neon/);
  assert.equal(databaseUrl({ DATABASE_URL: 'postgres://localhost/tsek' }), 'postgres://localhost/tsek');
  assert.throws(() => serverConfig({ PORT: 'invalid' }), /PORT/);
  assert.throws(() => serverConfig({ FRONTEND_URL: 'https://example.com/path' }), /origin/);
});

test('Neon URL handling upgrades TLS and selects a direct migration connection', () => {
  const pooled = databaseUrl({
    DATABASE_URL: 'postgresql://app:test-password@ep-test-pooler.region.aws.neon.tech/db?sslmode=require&channel_binding=require',
  });
  const pooledUrl = new URL(pooled);
  assert.equal(pooledUrl.searchParams.get('sslmode'), 'verify-full');
  assert.equal(pooledUrl.searchParams.get('channel_binding'), 'require');

  const direct = 'postgresql://app:test-password@ep-test.region.aws.neon.tech/db?sslmode=verify-full';
  assert.equal(databaseUrl({
    DATABASE_URL: 'postgresql://app:test-password@ep-test-pooler.region.aws.neon.tech/db?sslmode=verify-full',
    DATABASE_URL_UNPOOLED: direct,
  }, { migration: true }), direct);
});
