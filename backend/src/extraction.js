import { randomUUID } from 'node:crypto'
import analysisSchema from '../schema/document-analysis.v1.schema.json' with { type: 'json' }
import {
  ANALYSIS_SCHEMA_VERSION, OBSERVATION_FIELDS, deriveAnalysisDecisions,
  validateAnalysisObservations, validateDocumentAnalysis,
} from './analysis.js'
import { loadConfig } from './config.js'
import { EXTRACTION_INSTRUCTIONS, EXTRACTION_PROMPT_VERSION } from './extraction-prompt.v1.js'
import { createOpenAiProvider, ProviderError, PROVIDER_TEMPERATURE } from './provider.js'

const responseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'document_observations_v1',
    strict: true,
    schema: { ...analysisSchema.properties.observations, $defs: analysisSchema.$defs },
  },
}

const normalizeWhitespace = (text) => text.trim().replace(/\s+/gu, ' ')
const isText = (value) => typeof value === 'string' && value.trim().length > 0

const modelDirectedLine = /^[ \t]*(?:(?:(?:system|developer)[ \t]+(?:note|message|instructions?)|(?:note|instructions?))[ \t]+(?:to|for)[ \t]+(?:the[ \t]+)?(?:ai|assistant|model)[ \t]*:|ignore[ \t]+(?:all[ \t]+)?(?:previous|prior|above)[ \t]+instructions\b)/imu

function documentEvidence(text) {
  return text.split(/(\r?\n[ \t]*\r?\n)/u).map((paragraph) => {
    const directiveStart = paragraph.search(modelDirectedLine)
    return directiveStart === -1 ? paragraph : paragraph.slice(0, directiveStart).trimEnd()
  }).join('')
}

/** Null every value the document does not contain; report how many were checked and dropped. */
function keepSupportedValues(observations, text) {
  const source = normalizeWhitespace(text)
  let checked = 0
  let dropped = 0
  for (const field of OBSERVATION_FIELDS) {
    const { value } = observations[field]
    const readable = observations.readability.status !== 'unreadable'
    if (readable && value !== null) {
      checked += 1
      const phrase = RegExp.escape(normalizeWhitespace(value))
      const exactPhrase = new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, 'u')
      if (exactPhrase.test(source)) continue
    }
    if (value !== null) dropped += 1
    observations[field] = { value: null, confidence: 0 }
  }
  return { checked, dropped }
}

/** Extract observations from document text already obtained by the backend. */
export function createDocumentExtractor({ env = process.env, fetchImpl, logger = console } = {}) {
  const { openAiApiKey, openAiModel, timeoutMs, prices } = loadConfig(env)
  const requestProvider = createOpenAiProvider({
    apiKey: openAiApiKey, model: openAiModel, timeoutMs, fetchImpl, logger, prices,
  })
  const metadata = Object.freeze({
    provider: 'openai',
    model: openAiModel,
    temperature: PROVIDER_TEMPERATURE,
    timeoutMs,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
  })

  /**
   * One record per admitted analysis: what validation did with the reply and what
   * the user got instead when it failed. Never contains document text.
   */
  function logResult(requestId, started, result, usage, evidence = null) {
    const validation = {
      success: evidence?.dropped ? 'passed_after_repair' : 'passed',
      malformed_output: usage ? 'failed' : null,
    }[result.outcome] ?? null
    logger?.info?.(JSON.stringify({
      event: 'ai_result',
      requestId: requestId ?? null,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      model: openAiModel,
      outcome: result.outcome,
      code: result.code ?? null,
      validation,
      evidenceChecked: evidence?.checked ?? null,
      evidenceMatched: evidence ? evidence.checked - evidence.dropped : null,
      attempts: usage?.attempts ?? 0,
      retries: usage?.retries ?? 0,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      costUsd: usage?.costUsd ?? null,
      // TSEK has no second model: a failed analysis is stored as failed and the user sees an error.
      fallback: result.outcome === 'success' ? null : 'error_response',
      latencyMs: Math.round(performance.now() - started),
    }))
    return result
  }

  return async function extractDocument(input) {
    const { text, applicationId, uploadedFileId, requestId } = input ?? {}
    const malformed = { outcome: 'malformed_output', code: 'INVALID_PROVIDER_RESPONSE', metadata }
    if (![text, applicationId, uploadedFileId].every(isText)) {
      return { outcome: 'invalid_input', code: 'INVALID_EXTRACTION_INPUT', metadata }
    }

    const started = performance.now()
    // The provider and the source check must use the same document evidence.
    const evidence = documentEvidence(text)
    let reply
    try {
      reply = await requestProvider({
        input: isText(evidence) ? evidence : '[No readable document text remains.]',
        instructions: EXTRACTION_INSTRUCTIONS,
        responseFormat,
        requestId,
        promptVersion: EXTRACTION_PROMPT_VERSION,
      })
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error
      if (error.code === 'INVALID_PROVIDER_RESPONSE') return logResult(requestId, started, malformed, error.usage)
      const outcome = error.code === 'PROVIDER_TIMEOUT' ? 'timeout' : 'provider_failure'
      return logResult(requestId, started, { outcome, code: error.code, metadata }, error.usage)
    }

    const observations = reply.structuredResult
    if (!validateAnalysisObservations(observations).valid) {
      return logResult(requestId, started, malformed, reply.usage)
    }
    const support = keepSupportedValues(observations, evidence)

    const analysis = {
      schemaVersion: ANALYSIS_SCHEMA_VERSION,
      analysisId: randomUUID(),
      source: { applicationId, uploadedFileId },
      observations,
      decisions: deriveAnalysisDecisions(observations),
    }
    if (!validateDocumentAnalysis(analysis).valid) return logResult(requestId, started, malformed, reply.usage)
    return logResult(requestId, started, { outcome: 'success', analysis, metadata }, reply.usage, support)
  }
}
