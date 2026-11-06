import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { errors } from 'jose';
import request from 'supertest';
import { migrate, seed, transaction } from '../scripts/database-tasks.js';
import { catalogueRepository } from '../src/catalogue.js';
import { applicationsRepository } from '../src/applications.js';
import { createApp } from '../src/app.js';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
let db;
let client;
let app;
let documentTypeId;

before(async () => {
  db = new PGlite();
  client = { query: (sql, params) => params || !sql.includes(';')
    ? db.query(sql, params) : db.exec(sql).then(results => results.at(-1)) };
  await migrate(client);
  await seed(client);
  const catalogue = catalogueRepository(client);
  const applications = applicationsRepository(client);
  documentTypeId = (await catalogue.list())[0].id;
  app = createApp({
    catalogue,
    applications,
    verifyToken: async token => {
      if (token === 'user-a') return userA;
      if (token === 'user-b') return userB;
      throw new Error('Invalid test token');
    },
    logger: { error() {} },
  });
});

after(async () => { await db?.close(); });

test('application create and read routes require authentication and enforce owner scope', async () => {
  const unauthenticated = await request(app).get('/api/applications').expect(401);
  assert.equal(unauthenticated.body.error.code, 'MISSING_BEARER_TOKEN');

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

  const persisted = await client.query(
    'SELECT owner_id FROM public.applications WHERE id = $1',
    [application.id],
  );
  assert.equal(persisted.rows[0].owner_id, userA);

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
    .set('Authorization', 'Bearer user-a')
    .expect(200);
  const notOwned = await request(app)
    .get(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-b')
    .expect(404);
  assert.equal(notOwned.body.error.code, 'NOT_FOUND');

  await request(app)
    .get('/api/applications/not-a-uuid')
    .set('Authorization', 'Bearer user-a')
    .expect(400);
});

test('application create rejects missing fields, invalid document types, and supplied ownership', async () => {
  const authorization = { Authorization: 'Bearer user-a' };
  const missing = await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({})
    .expect(400);
  assert.equal(missing.body.error.code, 'INVALID_BODY');

  const malformed = await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: 'not-a-uuid' })
    .expect(400);
  assert.equal(malformed.body.error.code, 'INVALID_BODY');

  const invalidType = await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: '00000000-0000-0000-0000-000000000000' })
    .expect(422);
  assert.equal(invalidType.body.error.code, 'INVALID_DOCUMENT_TYPE');

  await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: documentTypeId, owner_id: userB })
    .expect(400);

  for (const purpose of ['x'.repeat(201), 123]) {
    const invalidPurpose = await request(app)
      .post('/api/applications')
      .set(authorization)
      .send({ document_type_id: documentTypeId, purpose })
      .expect(400);
    assert.equal(invalidPurpose.body.error.code, 'INVALID_BODY');
  }
});

test('create and edit accept a 200-character purpose with surrounding whitespace', async () => {
  const authorization = { Authorization: 'Bearer user-a' };
  const purpose = 'x'.repeat(200);
  const created = await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: documentTypeId, purpose: `  ${purpose}  ` })
    .expect(201);
  assert.equal(created.body.data.purpose, purpose);

  const updatedPurpose = 'y'.repeat(200);
  const updated = await request(app)
    .patch(`/api/applications/${created.body.data.id}`)
    .set(authorization)
    .send({ purpose: `  ${updatedPurpose}  ` })
    .expect(200);
  assert.equal(updated.body.data.purpose, updatedPurpose);
});

test('JWKS server failures return an authentication-unavailable response', async () => {
  const unavailableAuthApp = createApp({
    catalogue: catalogueRepository(client),
    applications: applicationsRepository(client),
    verifyToken: async () => { throw new errors.JOSEError('JWKS endpoint returned a non-200 response.'); },
    logger: { error() {} },
  });
  await request(unavailableAuthApp)
    .get('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .expect(503, { error: {
      code: 'AUTH_UNAVAILABLE',
      message: 'Authentication is temporarily unavailable.',
    } });
});

test('invalid bearer tokens return an unauthorized response', async () => {
  const invalidTokenApp = createApp({
    catalogue: catalogueRepository(client),
    applications: applicationsRepository(client),
    verifyToken: async () => { throw new errors.JWTInvalid('Invalid token'); },
    logger: { error() {} },
  });
  await request(invalidTokenApp)
    .get('/api/applications')
    .set('Authorization', 'Bearer invalid-token')
    .expect(401, { error: {
      code: 'INVALID_BEARER_TOKEN',
      message: 'The bearer token is invalid or was issued by a different Auth branch.',
    } });
});

test('JWKS timeouts return an authentication-unavailable response', async () => {
  for (const error of [
    new errors.JWKSTimeout('JWKS request timed out'),
    new TypeError('fetch failed', { cause: new Error('connection refused') }),
  ]) {
    const unavailableAuthApp = createApp({
      catalogue: catalogueRepository(client),
      applications: applicationsRepository(client),
      verifyToken: async () => { throw error; },
      logger: { error() {} },
    });
    await request(unavailableAuthApp)
      .get('/api/applications')
      .set('Authorization', 'Bearer user-a')
      .expect(503, { error: {
        code: 'AUTH_UNAVAILABLE',
        message: 'Authentication is temporarily unavailable.',
      } });
  }
});

test('other verifier TypeErrors are treated as invalid tokens, not auth outages', async () => {
  for (const error of [new TypeError('programming error'), new TypeError('fetch failed')]) {
    const invalidTokenApp = createApp({
      catalogue: catalogueRepository(client),
      applications: applicationsRepository(client),
      verifyToken: async () => { throw error; },
      logger: { error() {} },
    });
    await request(invalidTokenApp)
      .get('/api/applications')
      .set('Authorization', 'Bearer malformed-token')
      .expect(401, { error: {
        code: 'INVALID_BEARER_TOKEN',
        message: 'The bearer token is invalid or was issued by a different Auth branch.',
      } });
  }
});

test('application list pagination defaults, enforces limits, and rejects malformed values', async () => {
  let receivedPagination;
  let listRows = [];
  const paginatedApp = createApp({
    catalogue: catalogueRepository(client),
    applications: {
      list: async (_ownerId, pagination) => {
        receivedPagination = pagination;
        return {
          rows: listRows.slice(pagination.offset, pagination.offset + pagination.limit),
          hasMore: listRows.length > pagination.offset + pagination.limit,
        };
      },
    },
    verifyToken: async () => userA,
    logger: { error() {} },
  });
  const auth = { Authorization: 'Bearer user-a' };

  listRows = Array.from({ length: 51 }, (_, index) => ({ id: `application-${index}` }));
  const firstPage = await request(paginatedApp)
    .get('/api/applications')
    .set(auth)
    .expect(200);
  assert.deepEqual(receivedPagination, { limit: 50, offset: 0 });
  assert.equal(firstPage.body.data.length, 50);
  assert.equal(firstPage.body.hasMore, true);

  listRows = Array.from({ length: 125 }, (_, index) => ({ id: `application-${index}` }));
  const lastPage = await request(paginatedApp)
    .get('/api/applications?limit=100&offset=25')
    .set(auth)
    .expect(200);
  assert.deepEqual(receivedPagination, { limit: 100, offset: 25 });
  assert.equal(lastPage.body.data.length, 100);
  assert.deepEqual(lastPage.body.data, listRows.slice(25, 125));
  assert.equal(lastPage.body.hasMore, false);

  for (const query of ['limit=0', 'limit=101', 'limit=abc', 'offset=-1', 'offset=1e2']) {
    const invalid = await request(paginatedApp)
      .get(`/api/applications?${query}`)
      .set(auth)
      .expect(400);
    assert.equal(invalid.body.error.code, 'INVALID_QUERY');
  }
});

test('application database failures return safe 500 responses through Express 5 error middleware', async () => {
  const loggedEvents = [];
  const failure = new Error('database connection details must not leak');
  const failingApp = createApp({
    catalogue: catalogueRepository(client),
    applications: {
      list: async () => { throw failure; },
      create: async () => { throw failure; },
      get: async () => { throw failure; },
      update: async () => { throw failure; },
      deleteDraft: async () => { throw failure; },
    },
    verifyToken: async () => userA,
    logger: { error: event => loggedEvents.push(event) },
  });
  const authorization = { Authorization: 'Bearer user-a' };

  for (const response of [
    await request(failingApp).get('/api/applications').set(authorization),
    await request(failingApp).post('/api/applications')
      .set(authorization)
      .send({ document_type_id: documentTypeId }),
    await request(failingApp).get('/api/applications/33333333-3333-4333-8333-333333333333')
      .set(authorization),
    await request(failingApp).patch('/api/applications/33333333-3333-4333-8333-333333333333')
      .set(authorization)
      .send({ purpose: 'Updated' }),
    await request(failingApp).delete('/api/applications/33333333-3333-4333-8333-333333333333')
      .set(authorization),
  ]) {
    assert.equal(response.status, 500);
    assert.equal(response.body.error.code, 'INTERNAL_ERROR');
    assert.equal(JSON.stringify(response.body).includes(failure.message), false);
    assert.equal(typeof response.body.error.requestId, 'string');
  }

  assert.equal(loggedEvents.length, 5);
  assert.ok(loggedEvents.every(({ event }) => event === 'request_failed'));
});

test('application update changes permitted draft fields and hides records owned by others', async () => {
  const authorization = { Authorization: 'Bearer user-a' };
  const created = await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: documentTypeId, purpose: 'Original' })
    .expect(201);
  const id = created.body.data.id;

  const updated = await request(app)
    .patch(`/api/applications/${id}`)
    .set(authorization)
    .send({ purpose: '  Updated purpose  ', document_type_id: documentTypeId })
    .expect(200);
  assert.equal(updated.body.data.id, id);
  assert.equal(updated.body.data.purpose, 'Updated purpose');
  assert.equal(updated.body.data.document_type_id, documentTypeId);
  assert.ok(updated.body.data.updated_at >= created.body.data.updated_at);

  const persisted = await client.query(
    'SELECT purpose, status FROM public.applications WHERE id = $1',
    [id],
  );
  assert.deepEqual(persisted.rows[0], { purpose: 'Updated purpose', status: 'draft' });

  await request(app)
    .patch(`/api/applications/${id}`)
    .set({ Authorization: 'Bearer user-b' })
    .send({ purpose: 'Other owner edit' })
    .expect(404, { error: { code: 'NOT_FOUND', message: 'Application not found.' } });
  await request(app)
    .delete(`/api/applications/${id}`)
    .set({ Authorization: 'Bearer user-b' })
    .expect(404, { error: { code: 'NOT_FOUND', message: 'Application not found.' } });
  await request(app)
    .get(`/api/applications/${id}`)
    .set(authorization)
    .expect(200);
});

test('application update rejects invalid bodies and reports missing or invalid targets', async () => {
  const authorization = { Authorization: 'Bearer user-a' };
  const created = await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: documentTypeId })
    .expect(201);
  const id = created.body.data.id;

  for (const body of [
    {},
    { owner_id: userB },
    { purpose: 123 },
    { purpose: 'x'.repeat(201) },
    { document_type_id: 'not-a-uuid' },
  ]) {
    const invalid = await request(app)
      .patch(`/api/applications/${id}`)
      .set(authorization)
      .send(body)
      .expect(400);
    assert.equal(invalid.body.error.code, 'INVALID_BODY');
  }

  await request(app)
    .patch(`/api/applications/${id}`)
    .set(authorization)
    .send({ document_type_id: '00000000-0000-0000-0000-000000000000' })
    .expect(422, { error: {
      code: 'INVALID_DOCUMENT_TYPE',
      message: 'Document type is missing or inactive.',
    } });
  await request(app)
    .patch('/api/applications/not-a-uuid')
    .set(authorization)
    .send({ purpose: 'Updated' })
    .expect(400, { error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' } });
  await request(app)
    .patch('/api/applications/33333333-3333-4333-8333-333333333333')
    .set(authorization)
    .send({ purpose: 'Updated' })
    .expect(404, { error: { code: 'NOT_FOUND', message: 'Application not found.' } });
});

test('submitted applications cannot be edited or deleted', async () => {
  const authorization = { Authorization: 'Bearer user-a' };
  const created = await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: documentTypeId })
    .expect(201);
  const { id } = created.body.data;
  await client.query("UPDATE public.applications SET status = 'submitted' WHERE id = $1", [id]);

  await request(app)
    .patch(`/api/applications/${id}`)
    .set(authorization)
    .send({ purpose: 'Should stay locked' })
    .expect(409, { error: {
      code: 'APPLICATION_NOT_EDITABLE',
      message: 'Only draft applications can be updated.',
    } });
  await request(app)
    .delete(`/api/applications/${id}`)
    .set(authorization)
    .expect(409, { error: {
      code: 'APPLICATION_NOT_DELETABLE',
      message: 'Only draft applications can be deleted.',
    } });
  const persisted = await client.query('SELECT status FROM public.applications WHERE id = $1', [id]);
  assert.equal(persisted.rows[0].status, 'submitted');
});

test('draft deletion requires ownership and returns 204 when removed', async () => {
  const authorization = { Authorization: 'Bearer user-a' };
  const created = await request(app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: documentTypeId })
    .expect(201);
  const { id } = created.body.data;

  await request(app)
    .delete('/api/applications/not-a-uuid')
    .set(authorization)
    .expect(400, { error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' } });
  await request(app)
    .delete('/api/applications/33333333-3333-4333-8333-333333333333')
    .set(authorization)
    .expect(404, { error: { code: 'NOT_FOUND', message: 'Application not found.' } });
  await request(app)
    .delete(`/api/applications/${id}`)
    .set(authorization)
    .expect(204, '');
  await request(app)
    .get(`/api/applications/${id}`)
    .set(authorization)
    .expect(404, { error: { code: 'NOT_FOUND', message: 'Application not found.' } });
});

test('application mutation preflights allow PATCH and DELETE with authorization headers', async () => {
  const response = await request(app)
    .options('/api/applications/33333333-3333-4333-8333-333333333333')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'PATCH')
    .set('Access-Control-Request-Headers', 'authorization,content-type')
    .expect(204);
  assert.match(response.headers['access-control-allow-methods'], /PATCH/);
  assert.match(response.headers['access-control-allow-methods'], /DELETE/);
  assert.match(response.headers['access-control-allow-headers'], /Authorization/i);
});

test('application constraints reject invalid persisted data and failed transactions roll back', async () => {
  await assert.rejects(
    client.query(
      'INSERT INTO public.applications(owner_id, document_type_id) VALUES ($1, $2)',
      [null, documentTypeId],
    ),
    { code: '23502' },
  );
  await assert.rejects(
    client.query(
      'INSERT INTO public.applications(owner_id, document_type_id) VALUES ($1, $2)',
      [userA, '00000000-0000-0000-0000-000000000000'],
    ),
    { code: '23503' },
  );
  await assert.rejects(
    client.query(
      'INSERT INTO public.applications(owner_id, document_type_id, purpose) VALUES ($1, $2, $3)',
      [userA, documentTypeId, 'x'.repeat(201)],
    ),
    { code: '23514' },
  );
  await assert.rejects(
    client.query(
      "INSERT INTO public.applications(owner_id, document_type_id, status) VALUES ($1, $2, 'unknown')",
      [userA, documentTypeId],
    ),
    { code: '23514' },
  );

  let rolledBackId;
  await assert.rejects(transaction(client, async () => {
    const { rows: [application] } = await client.query(
      'INSERT INTO public.applications(owner_id, document_type_id, purpose) VALUES ($1, $2, $3) RETURNING id',
      [userA, documentTypeId, 'transaction rollback'],
    );
    rolledBackId = application.id;
    throw new Error('deliberate application transaction failure');
  }), /deliberate application transaction failure/);
  assert.equal(
    (await client.query('SELECT id FROM public.applications WHERE id = $1', [rolledBackId])).rows.length,
    0,
  );
});
