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
