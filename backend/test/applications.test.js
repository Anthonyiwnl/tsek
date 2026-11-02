import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
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
});
