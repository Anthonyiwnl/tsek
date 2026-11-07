import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateAnalysisResponse, validateDocumentAnalysis } from '../src/analysis.js'

const fixtureDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'analysis')

function readFixture(name) {
  return fs.readFileSync(path.join(fixtureDirectory, name), 'utf8')
}

test('accepts a complete analysis fixture', () => {
  const result = validateAnalysisResponse(readFixture('valid.json'))

  assert.equal(result.valid, true)
  assert.deepEqual(result.errors, [])
})

test('accepts an incomplete analysis and keeps missing information as a decision', () => {
  const result = validateAnalysisResponse(readFixture('incomplete.json'))

  assert.equal(result.valid, true)
  assert.equal(result.value.observations.applicantName.value, null)
  assert.equal(result.value.decisions.missingInformation[0].field, 'applicantName')
  assert.equal(result.value.decisions.missingInformation[0].section, undefined)
})

test('accepts an unreadable analysis fixture', () => {
  const result = validateAnalysisResponse(readFixture('unreadable.json'))

  assert.equal(result.valid, true)
  assert.equal(result.value.observations.readability.status, 'unreadable')
  assert.equal(result.value.decisions.outcome, 'unreadable')
})

test('rejects wrong observation types as observation errors', () => {
  const result = validateAnalysisResponse(readFixture('wrong-type.json'))

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.code === 'INVALID_OBSERVATION_VALUE' && error.section === 'observation'))
})

test('rejects malformed JSON responses', () => {
  const result = validateAnalysisResponse(readFixture('malformed-response.txt'))

  assert.equal(result.valid, false)
  assert.deepEqual(result.errors, [{
    path: '$',
    code: 'MALFORMED_JSON',
    message: 'The analysis response is not valid JSON.',
    section: 'contract',
  }])
})

test('rejects a business-rule decision that contradicts observations', () => {
  const analysis = JSON.parse(readFixture('valid.json'))
  analysis.decisions.missingInformation = [{
    field: 'address',
    reason: 'Address is required.',
  }]

  const result = validateDocumentAnalysis(analysis)

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.code === 'CONFLICTING_DECISION' && error.section === 'decision'))
})

test('rejects a null observation without a missing-information decision', () => {
  const analysis = JSON.parse(readFixture('valid.json'))
  analysis.observations.address.value = null

  const result = validateDocumentAnalysis(analysis)

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.code === 'MISSING_DECISION' && error.section === 'decision'))
})

test('rejects an outcome that contradicts observations', () => {
  const analysis = JSON.parse(readFixture('valid.json'))
  analysis.decisions.outcome = 'incomplete'

  const result = validateDocumentAnalysis(analysis)

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.code === 'CONFLICTING_OUTCOME' && error.section === 'decision'))
})

test('rejects duplicate missing-information decisions', () => {
  const analysis = JSON.parse(readFixture('incomplete.json'))
  analysis.decisions.missingInformation.push({ ...analysis.decisions.missingInformation[0] })

  const result = validateDocumentAnalysis(analysis)

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.code === 'DUPLICATE_MISSING_FIELD' && error.section === 'decision'))
})

test('rejects unknown fields', () => {
  const analysis = JSON.parse(readFixture('valid.json'))
  analysis.extra = true

  const result = validateDocumentAnalysis(analysis)

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.code === 'UNKNOWN_FIELD' && error.path === '$.extra'))
})

test('rejects unsupported schema versions', () => {
  const analysis = JSON.parse(readFixture('valid.json'))
  analysis.schemaVersion = '2.0.0'

  const result = validateDocumentAnalysis(analysis)

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.code === 'UNSUPPORTED_SCHEMA_VERSION'))
})

for (const confidence of [-0.1, 1.5, '0.5', null, NaN, Infinity]) {
  test(`rejects invalid observation confidence: ${confidence}`, () => {
    const analysis = JSON.parse(readFixture('valid.json'))
    analysis.observations.address.confidence = confidence

    const result = validateDocumentAnalysis(analysis)

    assert.equal(result.valid, false)
    assert.ok(result.errors.some((error) => error.code === 'INVALID_CONFIDENCE'
      && error.path === '$.observations.address.confidence' && error.section === 'observation'))
  })
}

for (const input of [null, 42, []]) {
  test(`rejects non-object analysis input: ${JSON.stringify(input)}`, () => {
    const result = validateAnalysisResponse(input)

    assert.equal(result.valid, false)
    assert.deepEqual(result.errors, [{
      path: '$',
      code: 'INVALID_ANALYSIS',
      message: 'Analysis must be a JSON object.',
      section: 'contract',
    }])
  })
}
