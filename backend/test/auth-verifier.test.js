import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { before, test } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createNeonTokenVerifier, createTokenVerifier } from '../src/auth.js';

const issuer = 'https://auth.example';
const subject = '11111111-1111-4111-8111-111111111111';
let signingKey;
let publicJwk;
let verifyToken;

before(async () => {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  signingKey = privateKey;
  publicJwk = await exportJWK(publicKey);
  const jwks = createLocalJWKSet({ keys: [publicJwk] });
  verifyToken = createTokenVerifier(jwks, issuer);
});

function signedToken(payload = {}, key = signingKey, alg = 'EdDSA') {
  return new SignJWT({ iss: issuer, sub: subject, exp: 4102444800, ...payload })
    .setProtectedHeader({ alg }).sign(key);
}

test('the verifier accepts a valid EdDSA token and rejects invalid claims, signatures and algorithms', async () => {
  assert.equal(await verifyToken(await signedToken()), subject);
  for (const [payload, reason] of [
    [{ iss: 'https://other.example' }, { code: 'ERR_JWT_CLAIM_VALIDATION_FAILED', claim: 'iss' }],
    [{ exp: 1 }, { code: 'ERR_JWT_EXPIRED', claim: 'exp' }],
    [{ sub: 'bad-id' }, /valid user ID and expiration/],
    [{ exp: undefined }, /valid user ID and expiration/],
  ]) {
    await assert.rejects(verifyToken(await signedToken(payload)), reason);
  }
  const { privateKey: wrongKey } = await generateKeyPair('EdDSA');
  await assert.rejects(verifyToken(await signedToken({}, wrongKey)), { code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' });
  const secret = new Uint8Array(32).fill(1);
  await assert.rejects(verifyToken(await signedToken({}, secret, 'HS256')), { code: 'ERR_JOSE_ALG_NOT_ALLOWED' });
});

test('Neon Auth rejects missing, malformed, remote HTTP, and credentialed base URLs', () => {
  for (const [url, message] of [
    [undefined, /Set NEON_AUTH_BASE_URL/],
    ['not a URL', /must be a valid URL/],
    ['http://auth.example', /must use HTTPS/],
    ['https://name:password@auth.example', /must not contain credentials/],
    ['https://auth.example?query=1', /must not contain credentials/],
    ['https://auth.example#fragment', /must not contain credentials/],
  ]) {
    assert.throws(() => createNeonTokenVerifier({ NEON_AUTH_BASE_URL: url }), message);
  }
});

test('application routes distinguish authentication setup, storage setup, and invalid signed tokens', async () => {
  const token = await signedToken();
  const noAuth = await request(createApp({ env: {} })).get('/api/applications').set('Authorization', `Bearer ${token}`).expect(503);
  assert.equal(noAuth.body.error.code, 'AUTH_UNAVAILABLE');
  const app = createApp({ env: {}, verifyToken });
  const noStorage = await request(app).get('/api/applications').set('Authorization', `Bearer ${token}`).expect(503);
  assert.equal(noStorage.body.error.code, 'APPLICATIONS_UNAVAILABLE');
  const expired = await signedToken({ exp: 1 });
  const invalid = await request(app).get('/api/applications').set('Authorization', `Bearer ${expired}`).expect(401);
  assert.equal(invalid.body.error.code, 'INVALID_BEARER_TOKEN');
});

test('application routes use the verified subject from the configured Neon key endpoint', async (t) => {
  const keyRequests = [];
  let keyEndpointStatus = 200;
  const server = createServer((req, res) => {
    keyRequests.push(req.url);
    res.writeHead(keyEndpointStatus, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ keys: [publicJwk] }));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const env = { NEON_AUTH_BASE_URL: `${origin}/neondb/auth/` };
  const token = await signedToken({ iss: origin });
  const owners = [];
  const applications = {
    list: async (ownerId) => {
      owners.push(ownerId);
      return { rows: [], hasMore: false };
    },
  };
  const app = createApp({ env: {}, applications, verifyToken: createNeonTokenVerifier(env) });
  await request(app).get('/api/applications').set('Authorization', `Bearer ${token}`)
    .expect(200, { data: [], hasMore: false });

  keyEndpointStatus = 503;
  const unavailable = createApp({ env: {}, applications, verifyToken: createNeonTokenVerifier(env), logger: { error() {} } });
  await request(unavailable).get('/api/applications').set('Authorization', `Bearer ${token}`).expect(503)
    .expect(({ body }) => assert.equal(body.error.code, 'AUTH_UNAVAILABLE'));
  assert.deepEqual(keyRequests, Array(2).fill('/neondb/auth/.well-known/jwks.json'));
  assert.deepEqual(owners, [subject]);
});
