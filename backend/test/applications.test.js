import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { errors, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { migrate, seed } from '../scripts/database-tasks.js';
import { catalogueRepository } from '../src/catalogue.js';
import { applicationsRepository } from '../src/applications.js';
import { createApp } from '../src/app.js';
import { createNeonTokenVerifier, createTokenVerifier } from '../src/auth.js';

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

test('purpose length is checked after trimming', async () => {
  const created = await request(app)
    .post('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .send({ document_type_id: documentTypeId, purpose: `  ${'x'.repeat(200)}  ` })
    .expect(201);
  assert.equal(created.body.data.purpose.length, 200);
});

test('unexpected TypeErrors are not reported as auth unavailable', async () => {
  const make = verifyToken => createApp({
    catalogue: catalogueRepository(client),
    applications: applicationsRepository(client),
    verifyToken,
    logger: { error() {} },
  });
  const buggy = await request(make(async () => { throw new TypeError('x is not a function'); }))
    .get('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .expect(401);
  assert.equal(buggy.body.error.code, 'INVALID_BEARER_TOKEN');

  await request(make(async () => {
    throw new TypeError('fetch failed', { cause: new Error('ECONNREFUSED') });
  }))
    .get('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .expect(503);
});

test('createTokenVerifier checks issuer, algorithm, expiry and subject', async () => {
  const issuer = 'https://auth.example.com';
  const { publicKey, privateKey } = await generateKeyPair('EdDSA');
  const verify = createTokenVerifier(async () => publicKey, issuer);
  const sign = (claims, { iss = issuer, exp = '5m', key = privateKey, alg = 'EdDSA' } = {}) =>
    new SignJWT(claims).setProtectedHeader({ alg }).setIssuer(iss).setExpirationTime(exp).sign(key);

  assert.equal(await verify(await sign({ sub: userA })), userA);
  await assert.rejects(verify(await sign({ sub: userA }, { iss: 'https://evil.example.com' })));
  await assert.rejects(verify(await sign({ sub: userA }, { exp: Math.floor(Date.now() / 1000) - 60 })));
  await assert.rejects(verify(await sign({ sub: 'not-a-uuid' })));
  const rsa = await generateKeyPair('RS256');
  const rsaVerify = createTokenVerifier(async () => rsa.publicKey, issuer);
  await assert.rejects(rsaVerify(await sign({ sub: userA }, { key: rsa.privateKey, alg: 'RS256' })));
});

test('createNeonTokenVerifier rejects unsafe or missing URLs', () => {
  assert.throws(() => createNeonTokenVerifier({}), /NEON_AUTH_BASE_URL/);
  assert.throws(() => createNeonTokenVerifier({ NEON_AUTH_BASE_URL: 'not a url' }), /valid URL/);
  assert.throws(() => createNeonTokenVerifier({ NEON_AUTH_BASE_URL: 'http://auth.example.com' }), /HTTPS/);
  assert.throws(() => createNeonTokenVerifier({ NEON_AUTH_BASE_URL: 'https://u:p@auth.example.com' }), /credentials/);
  assert.throws(() => createNeonTokenVerifier({
    NEON_AUTH_BASE_URL: 'https://auth.example.com',
    NEON_AUTH_JWKS_URL: 'http://auth.example.com/jwks',
  }), /JWKS_URL must use HTTPS/);
  assert.equal(typeof createNeonTokenVerifier({ NEON_AUTH_BASE_URL: 'https://auth.example.com' }), 'function');
});

test('routes return 503 or 401 when auth or storage is unavailable or the token is invalid', async () => {
  const noAuth = createApp({
    catalogue: catalogueRepository(client),
    applications: applicationsRepository(client),
  });
  const noAuthRes = await request(noAuth).get('/api/applications').expect(503);
  assert.equal(noAuthRes.body.error.code, 'AUTH_UNAVAILABLE');

  const noStore = createApp({
    catalogue: catalogueRepository(client),
    verifyToken: async () => userA,
    logger: { error() {} },
  });
  const noStoreRes = await request(noStore).get('/api/applications')
    .set('Authorization', 'Bearer user-a').expect(503);
  assert.equal(noStoreRes.body.error.code, 'APPLICATIONS_UNAVAILABLE');

  const invalid = createApp({
    catalogue: catalogueRepository(client),
    applications: applicationsRepository(client),
    verifyToken: async () => { throw new Error('bad'); },
    logger: { error() {} },
  });
  const invalidRes = await request(invalid).get('/api/applications')
    .set('Authorization', 'Bearer x').expect(401);
  assert.equal(invalidRes.body.error.code, 'INVALID_BEARER_TOKEN');
});
