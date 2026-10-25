import test from 'node:test'
import assert from 'node:assert/strict'
import { createOpenAiProvider, ProviderError } from '../src/provider.js'

test('sends the configured model and returns sanitized text', async () => {
  let request
  const provider = createOpenAiProvider({
    apiKey: 'test-key',
    model: 'gpt-4.1-mini',
    timeoutMs: 100,
    fetchImpl: async (url, options) => {
      request = { url, options }
      return new Response(JSON.stringify({
        id: 'not-returned-to-callers',
        choices: [{ message: { content: '  Synthetic verification result.  ' } }],
      }), { status: 200 })
    },
  })

  const result = await provider({ input: 'Synthetic document text' })

  assert.equal(result.result, 'Synthetic verification result.')
  assert.equal(result.model, 'gpt-4.1-mini')
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions')
  assert.equal(request.options.headers.Authorization, 'Bearer test-key')
  assert.deepEqual(JSON.parse(request.options.body), {
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: 'Synthetic document text' }],
    temperature: 0,
  })
})

test('fails in a controlled way when credentials are missing', async () => {
  const provider = createOpenAiProvider({
    apiKey: '',
    model: 'gpt-4.1-mini',
    timeoutMs: 100,
  })

  await assert.rejects(
    provider({ input: 'Synthetic document text' }),
    (error) => error instanceof ProviderError
      && error.code === 'MISSING_CREDENTIALS'
      && error.status === 503,
  )
})

test('fails in a controlled way on timeout', async () => {
  const provider = createOpenAiProvider({
    apiKey: 'test-key',
    model: 'gpt-4.1-mini',
    timeoutMs: 1,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }),
  })

  await assert.rejects(
    provider({ input: 'Synthetic document text' }),
    (error) => error instanceof ProviderError
      && error.code === 'PROVIDER_TIMEOUT'
      && error.status === 504,
  )
})

test('fails in a controlled way when the provider returns an error', async () => {
  const provider = createOpenAiProvider({
    apiKey: 'test-key',
    model: 'gpt-4.1-mini',
    timeoutMs: 100,
    fetchImpl: async () => new Response(JSON.stringify({
      error: { message: 'Sensitive upstream details' },
    }), { status: 429 }),
  })

  await assert.rejects(
    provider({ input: 'Synthetic document text' }),
    (error) => error instanceof ProviderError
      && error.code === 'PROVIDER_ERROR'
      && error.status === 502
      && !error.message.includes('Sensitive'),
  )
})
