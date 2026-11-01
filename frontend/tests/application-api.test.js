import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createApplicationApi, errorMessage } from '../src/application-api.js';
import { backendProxyTarget } from '../vite.config.js';
const reply = (data, status = 200) => new Response(JSON.stringify({ data }), { status });

test('proxy accepts HTTPS and local HTTP but rejects insecure remote targets', () => {
  assert.equal(backendProxyTarget(), 'http://127.0.0.1:3000/');
  for (const url of ['http://localhost:4319', 'http://[::1]:3000', 'https://backend.example']) assert.ok(backendProxyTarget(url));
  for (const url of ['http://backend.example', 'ftp://localhost', 'https://user:password@backend.example']) assert.throws(() => backendProxyTarget(url));
});

test('aborted token requests cannot clear a session or send a request', async () => {
  const controller = new AbortController(); let unauthorized = 0; let requests = 0;
  const api = createApplicationApi({ getToken: async () => { controller.abort(); return null; }, onUnauthorized: () => unauthorized++, fetchImpl: async () => { requests++; return reply([]); } });
  await assert.rejects(api.list(controller.signal), { name: 'AbortError' });
  assert.equal(unauthorized, 0); assert.equal(requests, 0);
});

test('request deadline reports TIMEOUT and does not retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requests = 0;
  const api = createApplicationApi({ getToken: async () => 'token', fetchImpl: async (_url, { signal }) => {
    requests++;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  const pending = api.list();
  const rejection = assert.rejects(pending, error => error.code === 'TIMEOUT' && errorMessage(error).includes('Refresh before retrying'));
  await Promise.resolve(); t.mock.timers.tick(45000); await rejection;
  assert.equal(requests, 1);
});

test('authenticated requests use current tokens, no owner IDs, and no cache', async () => {
  let token = 'first'; const calls = [];
  const api = createApplicationApi({ getToken: async () => token, fetchImpl: async (url, init) => { calls.push({ url, init }); return reply([]); } });
  await api.list(); token = 'refreshed'; await api.get('id/with slash');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer first');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer refreshed');
  assert.equal(calls[1].url, '/api/applications/id%2Fwith%20slash');
  assert.equal(calls[1].init.body, undefined);
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.redirect, 'error');
});
test('no token prevents network access; rejected tokens trigger sign-in recovery', async () => {
  let unauthorized = 0; let requests = 0;
  const options = { onUnauthorized: () => unauthorized++, fetchImpl: async () => { requests++; return new Response('', { status: 401 }); } };
  await assert.rejects(createApplicationApi({ ...options, getToken: async () => null }).list(), { status: 401 });
  assert.equal(requests, 0);
  await assert.rejects(createApplicationApi({ ...options, getToken: async () => 'expired' }).list(), { status: 401 });
  assert.equal(unauthorized, 2);
});
test('HTTP and malformed responses never become success', async () => {
  for (const status of [403, 404, 409, 413, 415, 422, 429, 503]) {
    const failed = createApplicationApi({ getToken: async () => 'token', fetchImpl: async () => new Response('failure', { status }) });
    await assert.rejects(failed.list(), { status });
    assert.ok(errorMessage(new ApiError(status, '', '')).length > 15);
  }
  await assert.rejects(createApplicationApi({ getToken: async () => 'token', fetchImpl: async () => new Response('<html>fallback</html>') }).list(), { code: 'INVALID_RESPONSE' });
});
