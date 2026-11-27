import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicationChecklist, normalizeApplicationAnalysis } from '../src/application-analyses.js';
import { deriveAnalysisDecisions } from '../src/analysis.js';
import fixture from './fixtures/analysis/valid.json' with { type: 'json' };

const requirements = [
  { id: 'residency', name: 'Proof of residency', accepted_document_types: ['Utility bill'], is_required: true },
  { id: 'government-id', name: 'Government-issued ID', accepted_document_types: ['PhilSys ID'], is_required: true },
];
function analysisWithTitle(title) {
  const analysis = structuredClone(fixture);
  analysis.observations.documentType.value = title;
  return analysis;
}

const billTitles = ['Utility Bill', 'Electric Bill', 'Electricity Bill', 'Water Bill'];
const acceptedTitles = [
  ...billTitles, 'Statement of Account',
  ...billTitles.flatMap(title => [
    `${title} - Statement of Account`, `${title}–Statement of Account`,
    `${title}  —  Statement of Account`, `${title}\nStatement of Account`,
  ]),
  '  eLeCtRiC\tBiLl\u00a0–\u00a0STATEMENT OF ACCOUNT  ',
];
for (const title of acceptedTitles) {
  test(`utility title completes residency, including saved results: ${JSON.stringify(title)}`, () => {
    const analysis = analysisWithTitle(title);
    const result = normalizeApplicationAnalysis(analysis, requirements);
    assert.equal(result.detected_document_type, title);
    assert.equal(result.requirements[0].status, 'complete');
    assert.equal(result.requirements[1].matches, false);

    // Utility Bill already matched; aliases may have an older unmatched result.
    const oldResult = title === 'Utility Bill' ? result : { ...result, document_type_match: false,
      requirements: result.requirements.map(item => ({ ...item, status: 'uncertain', matches: false })) };
    const checklist = applicationChecklist(requirements, [{ file_id: 'saved-bill', result: analysis, normalized_result: oldResult }]);
    assert.equal(checklist.requirements[0].status, 'complete');
    assert.equal(checklist.requirements[0].file_id, 'saved-bill');
    assert.equal(checklist.requirements[1].status, 'uncertain');
    assert.equal(checklist.is_complete, false, 'a bill cannot satisfy the government ID requirement');
  });
}

for (const title of ['Bill of Lading', 'Bank Statement of Account', 'Invoice - Statement of Account',
  'Not a Utility Bill', 'Electric Bill of Lading', 'Water Bill - Statement of Account - Invoice']) {
  test(`unrelated title stays unmatched: ${title}`, () => {
    const result = normalizeApplicationAnalysis(analysisWithTitle(title), requirements);
    assert.equal(result.document_type_match, false);
    assert.equal(result.requirements[0].status, 'uncertain');
  });
}

test('a recognized bill with missing fields still needs attention', () => {
  const analysis = analysisWithTitle('Electric Bill - Statement of Account');
  analysis.observations.address = { value: null, confidence: 0 };
  analysis.decisions = deriveAnalysisDecisions(analysis.observations);
  const result = normalizeApplicationAnalysis(analysis, requirements);
  assert.equal(result.requirements[0].matches, true);
  assert.equal(result.requirements[0].status, 'incomplete');
});
