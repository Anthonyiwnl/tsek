import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const MAX_TOKENS = 1000
const MAX_ATTEMPTS = 2
export const PROVIDER_TEMPERATURE = 0

export class ProviderError extends Error {
  constructor(message, code, status = 502) {
    super(message)
    this.name = 'ProviderError'
    this.code = code
    this.status = status
  }
}

function readContent(payload) {
  const content = payload?.choices?.[0]?.message?.content
  return typeof content === 'string' ? content.trim() : ''
}

async function readJson(response) {
  try {
    return await response.json()
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    return undefined
  }
}

function invalidResponse() {
  return new ProviderError(
    'The provider returned an unusable response.',
    'INVALID_PROVIDER_RESPONSE',
    502,
  )
}

function providerTimeout() {
  return new ProviderError('The provider request timed out.', 'PROVIDER_TIMEOUT', 504)
}

function tokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

function retryableHttpStatus(status) {
  return status === 429 || (status >= 500 && status < 600)
}

function completion(response, payload, responseFormat) {
  if (!response.ok) {
    return {
      failure: new ProviderError('The provider returned an error.', 'PROVIDER_ERROR', 502),
      retryable: retryableHttpStatus(response.status),
    }
  }
  if (payload === undefined) return { failure: invalidResponse(), retryable: true }

  const content = readContent(payload)
  const choice = payload?.choices?.[0]
  if (!content || choice?.finish_reason !== 'stop' || choice?.message?.refusal) {
    return { failure: invalidResponse() }
  }
  if (responseFormat?.type === 'json_schema') {
    try {
      return { content, structuredResult: JSON.parse(content) }
    } catch {
      return { failure: invalidResponse(), retryable: true }
    }
  }
  return { content }
}

export function createOpenAiProvider({
  apiKey,
  model,
  timeoutMs,
  fetchImpl = fetch,
  endpoint = OPENAI_ENDPOINT,
  logger = console,
}) {
  return async function requestProvider({
    input, instructions, responseFormat, requestId = randomUUID(), promptVersion = 'unversioned',
  }) {
    if (!apiKey) {
      throw new ProviderError(
        'The provider is not configured on the server.',
        'MISSING_CREDENTIALS',
        503,
      )
    }

    const controller = new AbortController()
    const request = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(instructions ? [{ role: 'system', content: instructions }] : []),
          { role: 'user', content: input },
        ],
        temperature: PROVIDER_TEMPERATURE,
        max_tokens: MAX_TOKENS,
        response_format: responseFormat,
      }),
      signal: controller.signal,
    }

    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const started = performance.now()
        let response
        let payload
        let outcome
        try {
          response = await fetchImpl(endpoint, request)
          if (retryableHttpStatus(response.status)) {
            // A slow error body should leave time to try again.
            void response.body?.cancel().catch(() => {})
          } else {
            payload = await readJson(response)
          }
          controller.signal.throwIfAborted()
          outcome = completion(response, payload, responseFormat)
        } catch (error) {
          const timedOut = error?.name === 'AbortError' || controller.signal.aborted
          outcome = {
            failure: timedOut ? providerTimeout() : new ProviderError(
              'The provider could not be reached.', 'PROVIDER_UNAVAILABLE', 502,
            ),
          }
        } finally {
          logger?.info?.(JSON.stringify({
            event: 'ai_call',
            requestId,
            promptVersion,
            model,
            attempt,
            status: tokenCount(response?.status),
            inputTokens: tokenCount(payload?.usage?.prompt_tokens),
            outputTokens: tokenCount(payload?.usage?.completion_tokens),
            totalTokens: tokenCount(payload?.usage?.total_tokens),
            latencyMs: Math.round(performance.now() - started),
            result: outcome.failure?.code ?? 'success',
          }))
        }

        if (!outcome.failure) {
          const { content, structuredResult } = outcome
          return { model, result: content, ...(responseFormat?.type === 'json_schema' && { structuredResult }) }
        }
        if (!outcome.retryable || attempt === MAX_ATTEMPTS) throw outcome.failure

        try {
          await delay(50 + Math.floor(Math.random() * 50), undefined, { signal: controller.signal })
          controller.signal.throwIfAborted()
        } catch {
          throw providerTimeout()
        }
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}

export { OPENAI_ENDPOINT }
