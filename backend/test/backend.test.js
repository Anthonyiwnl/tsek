import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose';
import request from 'supertest';
import { migrate, seed, transaction } from '../scripts/database-tasks.js';
import { catalogueRepository } from '../src/catalogue.js';
import { applicationsRepository } from '../src/applications.js';
import { createApp } from '../src/app.js';
import { createNeonTokenVerifier, createTokenVerifier } from '../src/auth.js';
import { databaseUrl, serverConfig } from '../src/config.js';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
let db;
let client;
let app;
let catalogue;
let applications;
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

test('migrations and seed are repeatable without replacing IDs or duplicating records', async () => {
  const before = await catalogue.list();
  await migrate(client);
  await seed(client);
  assert.deepEqual(await catalogue.list(), before);
  assert.equal(before.length, 3);
  assert.equal((await client.query('SELECT count(*)::int AS count FROM document_requirements')).rows[0].count, 9);
  assert.equal((await client.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, 2);
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
