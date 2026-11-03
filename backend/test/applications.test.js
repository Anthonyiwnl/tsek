import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { errors } from 'jose';
import request from 'supertest';
import { migrate, seed } from '../scripts/database-tasks.js';
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


test('invalid bearer tokens return 401 and verifier outages return 503', async () => {
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

  for (const error of [new errors.JWKSTimeout(), new TypeError('JWKS fetch failed')]) {
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

test('application list validates pagination and reports whether more rows exist', async () => {
  let receivedPagination;
  let listRows = Array.from({ length: 51 }, (_, index) => ({ id: `application-${index}` }));
  const paginatedApp = createApp({
    catalogue: catalogueRepository(client),
    applications: {
      list: async (_ownerId, pagination) => {
        receivedPagination = pagination;
        return listRows;
      },
    },
    verifyToken: async () => userA,
    logger: { error() {} },
  });
  const authorization = { Authorization: 'Bearer user-a' };

  const firstPage = await request(paginatedApp)
    .get('/api/applications')
    .set(authorization)
    .expect(200);
  assert.deepEqual(receivedPagination, { limit: 51, offset: 0 });
  assert.equal(firstPage.body.data.length, 50);
  assert.equal(firstPage.body.hasMore, true);

  listRows = [{ id: 'application-1' }];
  const lastPage = await request(paginatedApp)
    .get('/api/applications?limit=100&offset=25')
    .set(authorization)
    .expect(200);
  assert.deepEqual(receivedPagination, { limit: 101, offset: 25 });
  assert.deepEqual(lastPage.body.data, listRows);
  assert.equal(lastPage.body.hasMore, false);

  for (const query of ['limit=0', 'limit=101', 'limit=abc', 'offset=-1', 'offset=1e2']) {
    const invalid = await request(paginatedApp)
      .get(`/api/applications?${query}`)
      .set(authorization)
      .expect(400);
    assert.equal(invalid.body.error.code, 'INVALID_QUERY');
  }
});
