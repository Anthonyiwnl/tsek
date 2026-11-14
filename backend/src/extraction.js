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

function keepSupportedValues(observations, text) {
  const source = normalizeWhitespace(text)
  for (const field of OBSERVATION_FIELDS) {
    const { value } = observations[field]
    const readable = observations.readability.status !== 'unreadable'
    if (readable && value !== null) {
      const phrase = RegExp.escape(normalizeWhitespace(value))
      const exactPhrase = new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, 'u')
      if (exactPhrase.test(source)) continue
    }
    observations[field] = { value: null, confidence: 0 }
  }
}

/** Extract observations from document text already obtained by the backend. */
export function createDocumentExtractor({ env = process.env, fetchImpl, logger } = {}) {
  const { openAiApiKey, openAiModel, timeoutMs } = loadConfig(env)
  const requestProvider = createOpenAiProvider({
    apiKey: openAiApiKey, model: openAiModel, timeoutMs, fetchImpl, logger,
  })
  const metadata = Object.freeze({
    provider: 'openai',
    model: openAiModel,
    temperature: PROVIDER_TEMPERATURE,
    timeoutMs,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
  })

  return async function extractDocument(input) {
    const { text, applicationId, uploadedFileId, requestId } = input ?? {}
    const malformed = { outcome: 'malformed_output', code: 'INVALID_PROVIDER_RESPONSE', metadata }
    if (![text, applicationId, uploadedFileId].every(isText)) {
      return { outcome: 'invalid_input', code: 'INVALID_EXTRACTION_INPUT', metadata }
    }

    let reply
    try {
      reply = await requestProvider({
        input: text,
        instructions: EXTRACTION_INSTRUCTIONS,
        responseFormat,
        requestId,
        promptVersion: EXTRACTION_PROMPT_VERSION,
      })
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error
      if (error.code === 'INVALID_PROVIDER_RESPONSE') return malformed
      const outcome = error.code === 'PROVIDER_TIMEOUT' ? 'timeout' : 'provider_failure'
      return { outcome, code: error.code, metadata }
    }

    const observations = reply.structuredResult
    if (!validateAnalysisObservations(observations).valid) return malformed
    keepSupportedValues(observations, text)

    const analysis = {
      schemaVersion: ANALYSIS_SCHEMA_VERSION,
      analysisId: randomUUID(),
      source: { applicationId, uploadedFileId },
      observations,
      decisions: deriveAnalysisDecisions(observations),
    }
    if (!validateDocumentAnalysis(analysis).valid) return malformed
    return { outcome: 'success', analysis, metadata }
  }
}
