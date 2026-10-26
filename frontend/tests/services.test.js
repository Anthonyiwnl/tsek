import assert from 'node:assert/strict'
import { test } from 'node:test'
import handler from '../api/services.js'
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
