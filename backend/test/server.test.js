import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createRequestHandler } from '../src/server.js'

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
