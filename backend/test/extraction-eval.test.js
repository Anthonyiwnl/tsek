import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OBSERVATION_FIELDS, validateDocumentAnalysis } from '../src/analysis.js'
import { createDocumentExtractor } from '../src/extraction.js'
import dataset from './fixtures/extraction-eval.v1.json' with { type: 'json' }

function mockCompletion(reply) {
  const confidence = reply.confidence ?? 0.95
  const observations = Object.fromEntries(OBSERVATION_FIELDS.map((field, index) => {
    const value = reply.values?.[index]
    return [field, { value, confidence: value === null ? 0 : confidence }]
  }))
  observations.readability = { status: reply.readability, confidence }
  return Response.json({
    choices: [{ finish_reason: 'stop', message: { content: reply.content ?? JSON.stringify(observations) } }],
  })
}

function summarize(result, requestedType) {
  const { outcome: processing, analysis, code } = result
  if (processing !== 'success') {
    assert.equal(analysis, undefined)
    return { processing, code }
  }

  assert.deepEqual(validateDocumentAnalysis(analysis), { valid: true, errors: [] })
  const fields = Object.fromEntries(OBSERVATION_FIELDS.map((field) => {
    const { value, confidence } = analysis.observations[field]
    if (value === null) assert.equal(confidence, 0)
    return [field, value]
  }))
  return {
    processing,
    fields,
    readability: analysis.observations.readability.status,
    decision: analysis.decisions.outcome,
    missing: analysis.decisions.missingInformation.map(({ field }) => field),
    typeMatches: fields.documentType === requestedType,
  }
}

test(`synthetic backend extraction evaluation v${dataset.version}`, async (t) => {
  t.diagnostic('Provider responses are scripted fixtures.')
  for (const sample of dataset.cases) {
    await t.test(`${sample.kind}: ${sample.id}`, async (caseTest) => {
      const requests = []
      const extract = createDocumentExtractor({
        env: { OPENAI_API_KEY: 'mock-placeholder' },
        logger: {},
        fetchImpl: async (_url, { body }) => {
          requests.push(JSON.parse(body))
          return mockCompletion(sample.reply)
        },
      })
      const source = { applicationId: 'synthetic-eval', uploadedFileId: sample.id }
      const result = await extract({ ...source, text: sample.text })
      assert.equal(requests.length, sample.expectedProviderAttempts ?? (sample.reply ? 1 : 0))
      for (const request of requests) {
        assert.equal(request.messages[1].content, sample.text)
        assert.equal(request.model, result.metadata.model)
        assert.equal(request.temperature, result.metadata.temperature)
        assert.equal(request.response_format.json_schema.strict, true)
      }
      assert.equal(result.metadata.promptVersion, dataset.promptVersion)
      assert.equal(result.metadata.schemaVersion, dataset.schemaVersion)
      if (result.analysis) assert.deepEqual(result.analysis.source, source)
      const actual = summarize(result, sample.requestedType)
      caseTest.diagnostic(JSON.stringify({ mode: 'mock', metadata: result.metadata, actual }))
      assert.deepEqual(actual, sample.expected)
    })
  }
})
