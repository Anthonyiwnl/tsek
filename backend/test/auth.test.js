import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createNeonTokenVerifier, createTokenVerifier } from '../src/auth.js';
import { createTestContext, userA } from './_helpers.js';

let context;

before(async () => { context = await createTestContext(); });
after(async () => { await context?.db.close(); });

test('application API rejects malformed JSON and invalid bearer tokens', async () => {
  const invalidToken = await request(context.app)
    .get('/api/applications')
    .set('Authorization', 'Bearer invalid-token')
    .expect(401);
  assert.equal(invalidToken.body.error.code, 'INVALID_BEARER_TOKEN');
  const malformed = await request(context.app)
    .post('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .set('Content-Type', 'application/json')
    .send('{"document_type_id":')
    .expect(400);
  assert.equal(malformed.body.error.code, 'INVALID_JSON');

  const authErrors = [];
  const unavailableAuth = createApp({
    catalogue: context.catalogue,
    applications: context.applications,
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
    catalogue: context.catalogue,
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
