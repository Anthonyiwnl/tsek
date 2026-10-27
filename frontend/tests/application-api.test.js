import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createApplicationApi, errorMessage } from '../src/application-api.js';
const reply = (data, status = 200) => new Response(JSON.stringify({ data }), { status });

test('authenticated requests use current tokens, no owner IDs, and no cache', async () => {
  let token = 'first'; const calls = [];
  const api = createApplicationApi({ getToken: async () => token, fetchImpl: async (url, init) => { calls.push({ url, init }); return reply([]); } });
  await api.list(); token = 'refreshed'; await api.update('id/with slash', { purpose: 'Changed' });
  assert.equal(calls[0].init.headers.Authorization, 'Bearer first');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer refreshed');
  assert.equal(calls[1].url, '/api/applications/id%2Fwith%20slash');
  assert.equal(calls[1].init.body, '{"purpose":"Changed"}');
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
test('DELETE accepts 204; HTTP and malformed responses never become success', async () => {
  const api = createApplicationApi({ getToken: async () => 'token', fetchImpl: async () => new Response(null, { status: 204 }) });
  assert.equal(await api.remove('id'), null);
  for (const status of [403, 404, 409, 413, 415, 422, 429, 503]) {
    const failed = createApplicationApi({ getToken: async () => 'token', fetchImpl: async () => new Response('failure', { status }) });
    await assert.rejects(failed.list(), { status });
    assert.ok(errorMessage(new ApiError(status, '', '')).length > 15);
  }
  await assert.rejects(createApplicationApi({ getToken: async () => 'token', fetchImpl: async () => new Response('<html>fallback</html>') }).list(), { code: 'INVALID_RESPONSE' });
});
test('network failure explains uncertain writes and never retries mutations', async () => {
  let calls = 0;
  const api = createApplicationApi({ getToken: async () => 'token', fetchImpl: async () => { calls++; throw new TypeError('network'); } });
  await assert.rejects(api.update('id', { purpose: 'Example' }), { code: 'NETWORK' });
  assert.equal(calls, 1);
  assert.match(errorMessage(new ApiError(0, 'NETWORK', '')), /Refresh before retrying/);
});
