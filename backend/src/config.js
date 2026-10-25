const DEFAULT_MODEL = 'gpt-4.1-mini'
const DEFAULT_PORT = 3000
const DEFAULT_TIMEOUT_MS = 10000

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function loadConfig(env = process.env) {
  return {
    port: positiveInteger(env.PORT, DEFAULT_PORT),
    timeoutMs: positiveInteger(env.OPENAI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    openAiApiKey: env.OPENAI_API_KEY?.trim() || '',
    openAiModel: env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    frontendUrl: env.FRONTEND_URL?.trim() || '',
  }
}

export { DEFAULT_MODEL, DEFAULT_PORT, DEFAULT_TIMEOUT_MS }
