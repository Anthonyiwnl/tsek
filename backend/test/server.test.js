import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { Readable } from 'node:stream'
import { createRequestHandler, createServer } from '../src/server.js'

function responseRecorder() {
  return {
    headers: {},
    status: null,
    body: '',
    setHeader(name, value) {
      this.headers[name] = value
    },
    writeHead(status) {
      this.status = status
    },
    end(body = '') {
      this.body = body
    },
  }
}

async function request(handler, body) {
  const input = Readable.from([JSON.stringify(body)])
  input.method = 'POST'
  input.url = '/api/verify'
  input.headers = { host: 'localhost', 'content-type': 'application/json' }
  const response = responseRecorder()
  await handler(input, response)
  return { status: response.status, body: JSON.parse(response.body) }
}

async function startServer(t, env = {}) {
  const server = createServer({
    env,
    provider: async () => assert.fail('Health and malformed URLs must not reach the provider'),
  })
  t.after(() => {
    server.closeAllConnections()
    return new Promise((resolve) => server.close(resolve))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return server
}

function getJson(server, options = {}) {
  return new Promise((resolve, reject) => {
    const client = http.get({
      hostname: '127.0.0.1',
      port: server.address().port,
      path: '/health',
      agent: false,
      ...options,
    }, (incoming) => {
      let body = ''
      incoming.setEncoding('utf8')
      incoming.on('data', (chunk) => { body += chunk })
      incoming.on('error', reject)
      incoming.on('end', () => {
        try {
          resolve({ status: incoming.statusCode, body: JSON.parse(body) })
        } catch (error) {
          reject(error)
        }
      })
    })
    client.on('error', reject)
    client.setTimeout(2000, () => client.destroy(new Error('No HTTP response')))
  })
}

test('health reports the release commit required by deployment smoke tests', async (t) => {
  const commit = '0123456789abcdef0123456789abcdef01234567'
  const server = await startServer(t, { RENDER_GIT_COMMIT: commit })
  assert.deepEqual(await getJson(server), {
    status: 200,
    body: { status: 'ok', commit },
  })
})

test('health remains available without a deployment commit or provider credentials', async (t) => {
  const server = await startServer(t)
  assert.deepEqual(await getJson(server), {
    status: 200,
    body: { status: 'ok', commit: null },
  })
})

test('malformed Host cannot crash routing and the server handles subsequent requests', async (t) => {
  const server = await startServer(t)
  assert.equal((await getJson(server, { headers: { Host: '[' } })).status, 200)
  assert.equal((await getJson(server)).status, 200)
})

test('invalid request URL returns 400 and the server handles subsequent requests', async (t) => {
  const server = await startServer(t)
  assert.deepEqual(await getJson(server, { path: 'http://[' }), {
    status: 400,
    body: { error: { code: 'INVALID_URL', message: 'Request URL must be valid.' } },
  })
  assert.equal((await getJson(server)).status, 200)
})

test('backend-only verification returns a usable provider response', async () => {
  const handler = createRequestHandler({
    env: { FRONTEND_URL: 'http://localhost:5173' },
    provider: async ({ input }) => ({
    model: 'gpt-4.1-mini',
    result: `Verified: ${input}`,
    }),
  })

  const response = await request(handler, { input: 'Synthetic document text' })

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
      model: 'gpt-4.1-mini',
      result: 'Verified: Synthetic document text',
  })
})

test('rejects malformed input before calling the provider', async () => {
  let called = false
  const handler = createRequestHandler({
    provider: async () => {
      called = true
      return { model: 'gpt-4.1-mini', result: 'unexpected' }
    },
  })

  const response = await request(handler, { input: '' })

  assert.equal(response.status, 400)
  assert.deepEqual(response.body, {
    error: {
      code: 'INVALID_INPUT',
      message: 'The input field must be a non-empty string of 10,000 characters or fewer.',
    },
  })
  assert.equal(called, false)
})

test('rejects non-object JSON bodies and invalid input fields', async (t) => {
  for (const body of [null, true, 42, 'text', [], {}, { input: 42 }, { input: '  ' }, { input: 'x'.repeat(10001) }]) {
    await t.test(`body type: ${body === null ? 'null' : typeof body}, input length: ${body?.input?.length}`, async () => {
      const handler = createRequestHandler({
        provider: async () => assert.fail('Invalid input must not reach the provider'),
      })

      const response = await request(handler, body)

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_INPUT')
    })
  }
})

test('sends the full 413 response before closing an oversized upload', async (t) => {
  for (const chunked of [false, true]) {
    await t.test(chunked ? 'chunked upload' : 'fixed-length upload', async (t) => {
      const server = createServer({
        provider: async () => assert.fail('Oversized bodies must not reach the provider'),
      })
      t.after(() => {
        server.closeAllConnections()
        return new Promise((resolve) => server.close(resolve))
      })
      server.listen(0, '127.0.0.1')
      await once(server, 'listening')

      const response = await new Promise((resolve, reject) => {
        const client = http.request({
          hostname: '127.0.0.1',
          port: server.address().port,
          path: '/api/verify',
          method: 'POST',
          headers: chunked
            ? { 'Transfer-Encoding': 'chunked' }
            : { 'Content-Length': 2 * 1024 * 1024 },
        }, (incoming) => {
          let body = ''
          incoming.setEncoding('utf8')
          incoming.on('data', (chunk) => { body += chunk })
          incoming.on('error', reject)
          incoming.on('end', () => resolve({
            status: incoming.statusCode,
            headers: incoming.headers,
            body: JSON.parse(body),
          }))
        })
        t.after(() => client.destroy())
        client.on('error', reject)
        client.setTimeout(2000, () => client.destroy(new Error('No oversized-body response')))
        // Leave the upload unfinished: the server must respond without waiting for EOF.
        client.write('x'.repeat(1024 * 1024 + 1))
      })

      assert.equal(response.status, 413)
      assert.equal(response.headers.connection, 'close')
      assert.deepEqual(response.body, {
        error: { code: 'REQUEST_TOO_LARGE', message: 'Request body is too large.' },
      })
    })
  }
})
