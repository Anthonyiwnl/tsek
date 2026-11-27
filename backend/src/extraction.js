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
const lineBreak = /\r\n|[\n\r\u2028\u2029]/u

const modelDirectedLine = /^[ \t]*(?:(?:(?:system|developer)[ \t]+(?:note|message|instructions?)|(?:note|instructions?))[ \t]+(?:to|for)[ \t]+(?:the[ \t]+)?(?:ai|assistant|model)[ \t]*:|ignore[ \t]+(?:all[ \t]+)?(?:previous|prior|above)[ \t]+instructions\b)/imu

/**
 * Put the evidence inside <document> tags so the model sees exactly where the
 * untrusted data starts and ends. A tag written inside the document is
 * escaped, so the document cannot close the block and add text outside it.
 */
export function wrapDocument(text) {
  return `<document>\n${text.replace(/<(\s*\/?\s*document\b)/giu, '&lt;$1')}\n</document>`
}

function documentEvidence(text) {
  return text.split(/(\r?\n[ \t]*\r?\n)/u).map((paragraph) => {
    const directiveStart = paragraph.search(modelDirectedLine)
    return directiveStart === -1 ? paragraph : paragraph.slice(0, directiveStart).trimEnd()
  }).join('')
}

const philSysNameLabels = Object.entries({
  given: /^(?:Mga Pangalan(?: *\/ *Given Names?)?|Given Names?)$/iu,
  middle: /^(?:Gitnang Apelyido(?: *\/ *Middle Name)?|Middle Name)$/iu,
  last: /^(?:Apelyido(?: *\/ *Last Name)?|Last Name)$/iu,
})

function philSysSplitName(text) {
  const parts = new Map()
  const lines = []
  let previousEnd
  for (const match of text.matchAll(/^(?<label>[^:\r\n]+):(?<value>[^\r\n]*)/gmu)) {
    const label = normalizeWhitespace(match.groups.label)
    const entry = philSysNameLabels.find(([, pattern]) => pattern.test(label))
    if (!entry) continue
    const [field] = entry
    const value = normalizeWhitespace(match.groups.value)
    // A single block of distinct name fields avoids joining parts from separate records.
    if (parts.has(field) || (previousEnd !== undefined && text.slice(previousEnd, match.index).trim())) return null
    if ((field !== 'middle' || value) && !/^\p{L}[\p{L}\p{M} .'’\p{Pd}]*$/u.test(value)) return null
    parts.set(field, value)
    if (value) lines.push(match[0])
    previousEnd = match.index + match[0].length
  }
  if (!parts.has('given') || !parts.has('last')) return null
  return { value: [parts.get('given'), parts.get('middle'), parts.get('last')].filter(Boolean).join(' '), lines }
}

function matchingLines(text, value) {
  const phrase = value.split(' ').map(part => RegExp.escape(part)).join('\\s+')
  const match = new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, 'u').exec(text)
  if (!match) return null
  const start = text.slice(0, match.index).split(lineBreak).at(-1)
  const end = text.slice(match.index + match[0].length).split(lineBreak, 1)[0]
  return `${start}${match[0]}${end}`.split(lineBreak).filter(isText)
}

/** Null unsupported values and retain the lines that support the rest. */
function keepSupportedValues(observations, text) {
  const evidence = {}
  let checked = 0
  let dropped = 0
  for (const field of OBSERVATION_FIELDS) {
    const { value } = observations[field]
    const readable = observations.readability.status !== 'unreadable'
    if (value !== null) {
      // Count every returned value, so evidenceMatched (checked - dropped) is
      // never negative; an unreadable document's values are dropped unchecked.
      checked += 1
      if (readable) {
        const normalizedValue = normalizeWhitespace(value)
        const lines = matchingLines(text, normalizedValue)
        if (lines) {
          evidence[field] = lines
          continue
        }
        const title = observations.documentType.value
        if (field === 'applicantName' && title !== null
          && /^(philippine identification card|philsys id)$/iu.test(normalizeWhitespace(title))) {
          const name = philSysSplitName(text)
          if (name?.value === normalizedValue) {
            evidence[field] = name.lines
            continue
          }
        }
      }
      dropped += 1
    }
    observations[field] = { value: null, confidence: 0 }
  }
  return { checked, dropped, evidence }
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
        input: wrapDocument(isText(evidence) ? evidence : '[No readable document text remains.]'),
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
    return logResult(requestId, started, { outcome: 'success', analysis, metadata, evidence: support.evidence }, reply.usage, support)
  }
}
