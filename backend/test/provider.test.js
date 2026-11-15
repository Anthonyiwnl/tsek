import test from 'node:test'
import assert from 'node:assert/strict'
import { createOpenAiProvider, ProviderError } from '../src/provider.js'

test('sends the configured model and returns sanitized text', async () => {
  let request
  const logs = []
  const provider = createOpenAiProvider({
    apiKey: 'test-key',
    model: 'gpt-4.1-mini',
    timeoutMs: 100,
    logger: { info: (line) => logs.push(line) },
    fetchImpl: async (url, options) => {
      request = { url, options }
      return new Response(JSON.stringify({
        id: 'not-returned-to-callers',
        choices: [{ finish_reason: 'stop', message: { content: '  Synthetic verification result.  ' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }), { status: 200 })
    },
  })

  const result = await provider({
    input: 'Synthetic document text', requestId: 'request-example', promptVersion: 'verify.v1',
  })

  assert.equal(result.result, 'Synthetic verification result.')
  assert.equal(result.model, 'gpt-4.1-mini')
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions')
  assert.equal(request.options.headers.Authorization, 'Bearer test-key')
  assert.deepEqual(JSON.parse(request.options.body), {
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: 'Synthetic document text' }],
    temperature: 0,
    max_tokens: 1000,
  })
  assert.equal(logs.length, 1)
  const { latencyMs, ...event } = JSON.parse(logs[0])
  assert.ok(Number.isInteger(latencyMs) && latencyMs >= 0)
  assert.deepEqual(event, {
    event: 'ai_call',
    requestId: 'request-example',
    promptVersion: 'verify.v1',
    model: 'gpt-4.1-mini',
    attempt: 1,
    status: 200,
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
    result: 'success',
  })
})

test('retries one throttled, server-error, or malformed JSON response with the same deadline', async (t) => {
  const cases = [
    [429, 'PROVIDER_ERROR', 'HTTP'],
    [500, 'PROVIDER_ERROR', 'HTTP'],
    [501, 'PROVIDER_ERROR', 'HTTP'],
    [599, 'PROVIDER_ERROR', 'HTTP'],
    [200, 'INVALID_PROVIDER_RESPONSE', 'HTTP'],
    [200, 'INVALID_PROVIDER_RESPONSE', 'completion'],
  ]
  for (const [status, errorCode, layer] of cases) {
    await t.test(`${layer} ${status}`, async () => {
      const calls = []
      const logs = []
      const provider = createOpenAiProvider({
        apiKey: 'test-key',
        model: 'gpt-4.1-mini',
        timeoutMs: 1000,
        logger: { info: (line) => logs.push(JSON.parse(line)) },
        fetchImpl: async (_url, request) => {
          calls.push(request)
          if (calls.length === 1 && layer === 'HTTP') return new Response('Sensitive provider detail', { status })
          const content = calls.length === 1 ? 'Malformed provider completion' : '{"valid":true}'
          return Response.json({ choices: [{ finish_reason: 'stop', message: { content } }] })
        },
      })

      const reply = await provider({
        input: 'Synthetic document text', responseFormat: { type: 'json_schema' },
        requestId: 'retry-example', promptVersion: '1.0.0',
      })
      assert.deepEqual(reply.structuredResult, { valid: true })
      assert.equal(calls.length, 2)
      assert.equal(calls[0].signal, calls[1].signal)
      assert.equal(calls[0].body, calls[1].body)
      assert.deepEqual(logs.map(({ requestId, attempt, result }) => [requestId, attempt, result]), [
        ['retry-example', 1, errorCode], ['retry-example', 2, 'success'],
      ])
      assert.equal(logs[0].status, status)
      assert.equal(logs[0].inputTokens, null)
      assert.doesNotMatch(JSON.stringify(logs), /Synthetic document text|Sensitive provider detail|Malformed provider completion|test-key/)
    })
  }
})

test('does not retry a client error when its body is not JSON', async () => {
  let calls = 0
  const provider = createOpenAiProvider({
    apiKey: 'test-key',
    model: 'gpt-4.1-mini',
    timeoutMs: 100,
    logger: {},
    fetchImpl: async () => {
      calls += 1
      return new Response('Sensitive provider detail', { status: 400 })
    },
  })
  await assert.rejects(provider({ input: 'Synthetic document text' }), { code: 'PROVIDER_ERROR', status: 502 })
  assert.equal(calls, 1)
})

test('retries a server error without waiting for its body', async () => {
  let calls = 0
  let cancelled = false
  const unfinishedBody = new ReadableStream({
    cancel() { cancelled = true },
  })
  const provider = createOpenAiProvider({
    apiKey: 'test-key',
    model: 'gpt-4.1-mini',
    timeoutMs: 1000,
    logger: {},
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) return new Response(unfinishedBody, { status: 503 })
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Synthetic result' } }] })
    },
  })
  assert.equal((await provider({ input: 'Synthetic document text' })).result, 'Synthetic result')
  assert.equal(calls, 2)
  assert.equal(cancelled, true)
})

test('does not start a second call if the deadline expires during backoff', async () => {
  let calls = 0
  const logs = []
  const provider = createOpenAiProvider({
    apiKey: 'test-key',
    model: 'gpt-4.1-mini',
    timeoutMs: 10,
    logger: { info: (line) => logs.push(JSON.parse(line)) },
    fetchImpl: async () => {
      calls += 1
      return Response.json({}, { status: 503 })
    },
  })
  await assert.rejects(provider({ input: 'Synthetic document text' }), { code: 'PROVIDER_TIMEOUT', status: 504 })
  assert.equal(calls, 1)
  assert.equal(logs.length, 1)
  assert.equal(logs[0].result, 'PROVIDER_ERROR')
})

test('rejects non-stop or missing finish reasons even with non-empty content', async (t) => {
  for (const finishReason of ['length', 'content_filter', 'tool_calls', 'function_call', 'unknown', null, undefined]) {
    await t.test(`finish_reason: ${String(finishReason)}`, async () => {
      const provider = createOpenAiProvider({
        apiKey: 'test-key',
        model: 'gpt-4.1-mini',
        timeoutMs: 100,
        fetchImpl: async () => new Response(JSON.stringify({
          choices: [{ finish_reason: finishReason, message: { content: 'Partial or unusable result' } }],
        }), { status: 200 }),
      })

      await assert.rejects(provider({ input: 'Synthetic document text' }), {
        name: 'ProviderError',
        code: 'INVALID_PROVIDER_RESPONSE',
        status: 502,
        message: 'The provider returned an unusable response.',
      })
    })
  }
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
  let calls = 0
  const provider = createOpenAiProvider({
    apiKey: 'test-key',
    model: 'gpt-4.1-mini',
    timeoutMs: 1000,
    logger: {},
    fetchImpl: async () => {
      calls += 1
      return Response.json({ error: { message: 'Sensitive upstream details' } }, { status: 429 })
    },
  })

  await assert.rejects(
    provider({ input: 'Synthetic document text' }),
    (error) => error instanceof ProviderError
      && error.code === 'PROVIDER_ERROR'
      && error.status === 502
      && !error.message.includes('Sensitive'),
  )
  assert.equal(calls, 2)
})

test('rejects missing, non-string, and blank provider content', async (t) => {
  for (const content of [undefined, null, 42, true, {}, [], '', '  ']) {
    await t.test(`content: ${JSON.stringify(content)}`, async () => {
      const provider = createOpenAiProvider({
        apiKey: 'test-key',
        model: 'gpt-4.1-mini',
        timeoutMs: 100,
        fetchImpl: async () => new Response(JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { content } }],
        })),
      })

      await assert.rejects(provider({ input: 'Synthetic document text' }), {
        name: 'ProviderError', code: 'INVALID_PROVIDER_RESPONSE', status: 502,
      })
    })
  }
})

test('preserves error mapping for JSON parsing failures', async (t) => {
  for (const [status, code] of [[200, 'INVALID_PROVIDER_RESPONSE'], [503, 'PROVIDER_ERROR']]) {
    await t.test(`HTTP ${status}`, async () => {
      const provider = createOpenAiProvider({
        apiKey: 'test-key',
        model: 'gpt-4.1-mini',
        timeoutMs: 1000,
        fetchImpl: async () => new Response('not JSON', { status }),
      })

      await assert.rejects(provider({ input: 'Synthetic document text' }), {
        name: 'ProviderError', code, status: 502,
      })
    })
  }
})

test('maps an abort while reading JSON to a provider timeout', async () => {
  const provider = createOpenAiProvider({
    apiKey: 'test-key',
    model: 'gpt-4.1-mini',
    timeoutMs: 100,
    fetchImpl: async () => ({
      ok: true,
      json: async () => { throw new DOMException('aborted', 'AbortError') },
    }),
  })

  await assert.rejects(provider({ input: 'Synthetic document text' }), {
    name: 'ProviderError', code: 'PROVIDER_TIMEOUT', status: 504,
  })
})

test('enforces the deadline while waiting for the response body', async (t) => {
  for (const ok of [true, false]) {
    for (const aborts of [true, false]) {
      await t.test(`response ok: ${ok}, body aborts: ${aborts}`, async () => {
        const provider = createOpenAiProvider({
          apiKey: 'test-key',
          model: 'gpt-4.1-mini',
          timeoutMs: 1,
          fetchImpl: async (_url, { signal }) => ({
            ok,
            json: () => new Promise((resolve, reject) => {
              signal.addEventListener('abort', () => {
                if (aborts) {
                  reject(new DOMException('aborted', 'AbortError'))
                } else {
                  resolve({ choices: [{ message: { content: 'Late result' } }] })
                }
              }, { once: true })
            }),
          }),
        })

        await assert.rejects(provider({ input: 'Synthetic document text' }), {
          name: 'ProviderError', code: 'PROVIDER_TIMEOUT', status: 504,
        })
      })
    }
  }
})
