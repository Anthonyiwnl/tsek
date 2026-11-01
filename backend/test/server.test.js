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

function makeApp({ env = {}, provider, commit = null } = {}) {
  return createApp({ catalogue, env, provider, commit, logger: { error() {} } });
}

test('health reports the release commit and works without provider credentials', async () => {
  await request(makeApp({ commit: '0123456789abcdef0123456789abcdef01234567' }))
    .get('/health')
    .expect(200, { status: 'ok', commit: '0123456789abcdef0123456789abcdef01234567' });
  await request(makeApp()).get('/health').expect(200, { status: 'ok', commit: null });
});

test('malformed Host does not affect health routing', async () => {
  await request(makeApp()).get('/health').set('Host', '[').expect(200);
});

test('verification returns only the sanitized provider result and model', async () => {
  const app = makeApp({
    env: { AI_VERIFY_ENABLED: 'true' },
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
      const app = makeApp({ env: { AI_VERIFY_ENABLED: 'true' }, provider: async () => assert.fail('Invalid input must not reach the provider') });
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
    env: { AI_VERIFY_ENABLED: 'true' },
    provider: async () => { throw new ProviderError('The provider is not configured on the server.', 'MISSING_CREDENTIALS', 503); },
  });
  await request(app)
    .post('/api/verify')
    .send({ input: 'Synthetic document text' })
    .expect(503, { error: { code: 'MISSING_CREDENTIALS', message: 'The provider is not configured on the server.' } });
});

test('malformed JSON and oversized request bodies return controlled errors', async () => {
  const app = makeApp({ env: { AI_VERIFY_ENABLED: 'true' } });
  await request(app).post('/api/verify').type('json').send('{').expect(400)
    .expect(({ body }) => assert.equal(body.error.code, 'INVALID_JSON'));
  const response = await request(app).post('/api/verify').type('json').send('x'.repeat(1024 * 1024 + 1)).expect(413);
  assert.equal(response.body.error.code, 'REQUEST_TOO_LARGE');
});

test('verification is unavailable unless explicitly enabled, even with credentials', async (t) => {
  for (const flag of [undefined, '', 'false', 'TRUE', '1', ' true ', true]) {
    await t.test(`AI_VERIFY_ENABLED: ${String(flag)}`, async () => {
      const app = makeApp({
        env: { AI_VERIFY_ENABLED: flag, OPENAI_API_KEY: 'test-key' },
        provider: async () => assert.fail('Disabled verification must not call the provider'),
      });
      for (const body of [JSON.stringify({ input: 'Synthetic document text' }), '{']) {
        await request(app).post('/api/verify').type('json').send(body)
          .expect(404, { error: { code: 'NOT_FOUND', message: 'Route not found.' } });
      }
      await request(app).get('/health').expect(200);
      await request(app).get('/health/ready').expect(200);
      await request(app).get('/api/document-types').expect(200, { data: [] });
    });
  }
});

test('unsupported body charsets and encodings return sanitized 415 errors', async (t) => {
  for (const headers of [
    { 'Content-Type': 'application/json; charset=iso-8859-1' },
    { 'Content-Type': 'application/json', 'Content-Encoding': 'unsupported-private-value' },
  ]) {
    await t.test(JSON.stringify(headers), async () => {
      const app = createApp({
        catalogue,
        env: { AI_VERIFY_ENABLED: 'true' },
        provider: async () => assert.fail('Invalid body must not reach the provider'),
        logger: { error: () => assert.fail('Parser client errors must not be logged as server failures') },
      });
      await request(app).post('/api/verify').set(headers).send('{"input":"Synthetic document text"}')
        .expect(415, { error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Request body uses an unsupported charset or encoding.',
        } });
    });
  }
});
