import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createApplicationApi, errorMessage, validateUpload } from '../src/application-api.js';
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
  await new Promise(resolve => setImmediate(resolve)); t.mock.timers.tick(45000); await rejection;
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

test('list follows backend pagination and details encode the requested ID', async () => {
  const calls = [];
  const api = createApplicationApi({ getToken: async () => 'current', fetchImpl: async url => {
    calls.push(url);
    return new Response(JSON.stringify(calls.length === 1 ? { data: [{ id: 'first' }], hasMore: true } : { data: [{ id: 'second' }], hasMore: false }));
  } });
  assert.deepEqual(await api.list(), [{ id: 'first' }, { id: 'second' }]);
  assert.deepEqual(calls, ['/api/applications?limit=100&offset=0', '/api/applications?limit=100&offset=1']);
  await api.get('id/with slash');
  assert.equal(calls[2], '/api/applications/id%2Fwith%20slash');
});
test('invalid or stalled pagination fails instead of returning an incomplete list', async () => {
  for (const page of [{ data: [], hasMore: true }, { data: [] }, { data: {}, hasMore: false }]) {
    const api = createApplicationApi({ getToken: async () => 'token', fetchImpl: async () => new Response(JSON.stringify(page)) });
    await assert.rejects(api.list(), { code: 'INVALID_RESPONSE' });
  }
});

test('edit uses PATCH and deletion accepts an empty 204 response', async () => {
  const calls = [];
  const api = createApplicationApi({ getToken: async () => 'current', fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return init.method === 'DELETE' ? new Response(null, { status: 204 }) : reply({ id: 'saved' });
  } });
  await api.update('saved', { document_type_id: 'service', purpose: 'Changed' });
  assert.equal(calls[0].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].init.body), { document_type_id: 'service', purpose: 'Changed' });
  assert.equal(await api.remove('saved'), null);
  assert.equal(calls[1].url, '/api/applications/saved');
  assert.equal(calls[1].init.method, 'DELETE');
  assert.equal(calls[1].init.body, undefined);
});

test('token retrieval shares the deadline and a late token sends no request', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish; let requests = 0; let unauthorized = 0;
  const api = createApplicationApi({
    getToken: () => new Promise(resolve => { finish = resolve; }),
    onUnauthorized: () => unauthorized++,
    fetchImpl: async () => { requests++; return reply([]); },
  });
  const rejection = assert.rejects(api.services(), { code: 'TIMEOUT' });
  t.mock.timers.tick(45000); await rejection;
  finish('late-token'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 0); assert.equal(unauthorized, 0);
});

test('upload sends raw bytes and safe filename; analysis submits only file ID', async () => {
  const calls = [];
  const api = createApplicationApi({ getToken: async () => 'token', fetchImpl: async (url, init) => { calls.push({ url, init }); return reply({ id: 'saved' }, 201); } });
  const file = new File(['synthetic text'], 'test"\r\n名.txt', { type: 'text/plain' });
  await api.upload('app', file); await api.analyze('app', 'saved');
  assert.equal(calls[0].init.body, file);
  assert.match(calls[0].init.headers['Content-Disposition'], /^attachment; filename="[ -~]+"$/);
  assert.equal(calls[1].init.body, '{"file_id":"saved"}');
});

test('upload limits match backend and no content is sent on validation', () => {
  assert.ok(validateUpload(new File([], 'empty.txt', { type: 'text/plain' })));
  assert.ok(validateUpload({ size: 2097153, type: 'text/plain' }));
  assert.ok(validateUpload({ size: 12, type: 'text/html' }));
  assert.equal(validateUpload({ size: 2097152, type: 'application/pdf' }), '');
});

test('AI provider errors retain their distinct recovery messages', () => {
  for (const [code, message] of [['AI_TIMEOUT', 'Analysis timed out'], ['AI_INVALID_RESPONSE', 'unreadable result'], ['AI_PROVIDER_ERROR', 'could not process']]) {
    assert.ok(errorMessage(new ApiError(502, code, '')).includes(message));
  }
});
