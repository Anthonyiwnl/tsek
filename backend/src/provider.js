const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

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
    return null
  }
}

export function createOpenAiProvider({
  apiKey,
  model,
  timeoutMs,
  fetchImpl = fetch,
  endpoint = OPENAI_ENDPOINT,
}) {
  return async function requestProvider({ input }) {
    if (!apiKey) {
      throw new ProviderError(
        'The provider is not configured on the server.',
        'MISSING_CREDENTIALS',
        503,
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      let response
      let payload
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: input }],
            temperature: 0,
          }),
          signal: controller.signal,
        })
        payload = await readJson(response)
        controller.signal.throwIfAborted()
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) {
          throw new ProviderError(
            'The provider request timed out.',
            'PROVIDER_TIMEOUT',
            504,
          )
        }
        throw new ProviderError(
          'The provider could not be reached.',
          'PROVIDER_UNAVAILABLE',
          502,
        )
      }

      if (!response.ok) {
        throw new ProviderError(
          'The provider returned an error.',
          'PROVIDER_ERROR',
          502,
        )
      }

      const content = readContent(payload)
      if (!content) {
        throw new ProviderError(
          'The provider returned an unusable response.',
          'INVALID_PROVIDER_RESPONSE',
          502,
        )
      }

      return { model, result: content }
    } finally {
      clearTimeout(timeout)
    }
  }
}

export { OPENAI_ENDPOINT }
