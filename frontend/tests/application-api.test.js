import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createApplicationApi, errorMessage } from '../src/application-api.js';
const reply = (data, status = 200) => new Response(JSON.stringify({ data }), { status });

test('aborted token requests cannot clear a session or send a request', async () => {
  const controller = new AbortController(); let unauthorized = 0; let requests = 0;
  const api = createApplicationApi({ getToken: async () => { controller.abort(); return null; }, onUnauthorized: () => unauthorized++, fetchImpl: async () => { requests++; return reply([]); } });
  await assert.rejects(api.services(controller.signal), { name: 'AbortError' });
  assert.equal(unauthorized, 0); assert.equal(requests, 0);
});

test('request deadline reports TIMEOUT and does not retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requests = 0;
  const api = createApplicationApi({ getToken: async () => 'token', fetchImpl: async (_url, { signal }) => {
    requests++;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  const pending = api.services();
  const rejection = assert.rejects(pending, error => error.code === 'TIMEOUT' && errorMessage(error).includes('Refresh before retrying'));
  await Promise.resolve(); t.mock.timers.tick(45000); await rejection;
  assert.equal(requests, 1);
});

test('creation sends only the service and purpose with the current token', async () => {
  let call;
  const api = createApplicationApi({ getToken: async () => 'current', fetchImpl: async (url, init) => { call = { url, init }; return reply({ id: 'saved' }, 201); } });
  assert.deepEqual(await api.create({ document_type_id: 'service', purpose: 'Employment' }), { id: 'saved' });
  assert.equal(call.url, '/api/applications');
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.headers.Authorization, 'Bearer current');
  assert.deepEqual(JSON.parse(call.init.body), { document_type_id: 'service', purpose: 'Employment' });
  assert.equal(call.init.cache, 'no-store');
  assert.equal(call.init.redirect, 'error');
});
test('no token prevents network access; rejected tokens trigger sign-in recovery', async () => {
  let unauthorized = 0; let requests = 0;
  const options = { onUnauthorized: () => unauthorized++, fetchImpl: async () => { requests++; return new Response('', { status: 401 }); } };
  await assert.rejects(createApplicationApi({ ...options, getToken: async () => null }).services(), { status: 401 });
  assert.equal(requests, 0);
  await assert.rejects(createApplicationApi({ ...options, getToken: async () => 'expired' }).services(), { status: 401 });
  assert.equal(unauthorized, 2);
});
test('HTTP and malformed responses never become success', async () => {
  for (const status of [403, 404, 409, 413, 415, 422, 429, 503]) {
    const failed = createApplicationApi({ getToken: async () => 'token', fetchImpl: async () => new Response('failure', { status }) });
    await assert.rejects(failed.services(), { status });
    assert.ok(errorMessage(new ApiError(status, '', '')).length > 15);
  }
  await assert.rejects(createApplicationApi({ getToken: async () => 'token', fetchImpl: async () => new Response('<html>fallback</html>') }).services(), { code: 'INVALID_RESPONSE' });
});
