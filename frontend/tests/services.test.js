import assert from 'node:assert/strict'
import { test } from 'node:test'
import handler from '../api/services.js'
/** Invoke the sample handler with an in-memory response and return its captured output. */
function request(method = 'GET', url = '/api/services') {
  const response = { code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value }, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
  handler({ method, url }, response)
  return response
}
test('service contract contains unique IDs and usable requirements', () => {
  const response = request()
  assert.equal(response.code, 200)
  assert.equal(response.body.source, 'sample')
  assert.equal(new Set(response.body.services.map(service => service.id)).size, 3)
  for (const service of response.body.services) {
    assert.ok(service.name && service.description)
    assert.ok(service.requirements.length > 0)
    assert.equal(new Set(service.requirements.map(item => item.id)).size, service.requirements.length)
    assert.ok(service.requirements.every(item => item.name))
  }
})
test('empty response keeps the expected contract', () => assert.deepEqual(request('GET', '/api/services?scenario=empty').body, { source: 'sample', services: [] }))
test('simulated outage returns an error status', () => assert.equal(request('GET', '/api/services?scenario=error').code, 503))
test('write requests are rejected', () => { const response = request('POST'); assert.equal(response.code, 405); assert.equal(response.headers.Allow, 'GET') })

test('configured backend returns database records and never falls back on an outage', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.TSEK_BACKEND_URL;
  process.env.TSEK_BACKEND_URL = 'https://backend.example';
  const response = { setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } };
  try {
    globalThis.fetch = async url => {
      assert.equal(url, 'https://backend.example/api/document-types');
      return new Response(JSON.stringify({ data: [] }));
    };
    await handler({ method: 'GET', url: '/api/services?scenario=error' }, response);
    assert.equal(response.code, 200);
    assert.deepEqual(response.body, { source: 'database', services: [] });
    globalThis.fetch = async () => { throw new Error('private database details'); };
    await handler({ method: 'GET', url: '/api/services' }, response);
    assert.equal(response.code, 503);
    assert.deepEqual(response.body, { error: 'Catalogue unavailable. Please retry.' });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.TSEK_BACKEND_URL;
    else process.env.TSEK_BACKEND_URL = originalUrl;
  }
});

