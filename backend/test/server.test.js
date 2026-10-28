import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ProviderError } from '../src/provider.js';

const catalogue = {
  list: async () => [],
  requirements: async () => null,
  ready: async () => {},
};

function makeApp({ env = {}, provider } = {}) {
  return createApp({ catalogue, env, provider, logger: { error() {} } });
}

test('health reports the release commit and works without provider credentials', async () => {
  await request(makeApp({ env: { RENDER_GIT_COMMIT: '0123456789abcdef0123456789abcdef01234567' } }))
    .get('/health')
    .expect(200, { status: 'ok', commit: '0123456789abcdef0123456789abcdef01234567' });
  await request(makeApp()).get('/health').expect(200, { status: 'ok', commit: null });
});

test('malformed Host does not affect health routing', async () => {
  await request(makeApp()).get('/health').set('Host', '[').expect(200);
});

test('verification returns only the sanitized provider result and model', async () => {
  const app = makeApp({
    provider: async ({ input }) => ({ model: 'gpt-4.1-mini', result: `Verified: ${input}` }),
  });
  await request(app)
    .post('/api/verify')
    .send({ input: '  Synthetic document text  ' })
    .expect(200, { model: 'gpt-4.1-mini', result: 'Verified: Synthetic document text' });
});

test('rejects invalid provider input before calling the provider', async (t) => {
  for (const body of [null, true, 42, 'text', [], {}, { input: 42 }, { input: '  ' }, { input: 'x'.repeat(10001) }]) {
    await t.test(`body type ${body === null ? 'null' : typeof body}`, async () => {
      const app = makeApp({ provider: async () => assert.fail('Invalid input must not reach the provider') });
      await request(app)
        .post('/api/verify')
        .type('json')
        .send(JSON.stringify(body))
        .expect(400)
        .expect(({ body: response }) => assert.equal(response.error.code, 'INVALID_INPUT'));
    });
  }
});

test('maps provider failures to stable sanitized errors', async () => {
  const app = makeApp({
    provider: async () => { throw new ProviderError('The provider is not configured on the server.', 'MISSING_CREDENTIALS', 503); },
  });
  await request(app)
    .post('/api/verify')
    .send({ input: 'Synthetic document text' })
    .expect(503, { error: { code: 'MISSING_CREDENTIALS', message: 'The provider is not configured on the server.' } });
});

test('malformed JSON and oversized request bodies return controlled errors', async () => {
  const app = makeApp();
  await request(app).post('/api/verify').type('json').send('{').expect(400)
    .expect(({ body }) => assert.equal(body.error.code, 'INVALID_JSON'));
  const response = await request(app).post('/api/verify').type('json').send('x'.repeat(1024 * 1024 + 1)).expect(413);
  assert.equal(response.body.error.code, 'REQUEST_TOO_LARGE');
});
