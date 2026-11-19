import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { evaluate, loadSet, report, score, summarize } from '../scripts/eval-production-prompt.js';
import { EXTRACTION_PROMPT_VERSION } from '../src/extraction-prompt.v1.js';

test('the mock provider scores the whole set correctly through the real extractor', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Live network call attempted in a mocked evaluation'); };
  try {
    const { summary, scores } = await evaluate({ mode: 'mock', env: {} });
    assert.equal(summary.cases, 17);
    assert.deepEqual(summary, {
      cases: 17, correctOutcomes: 17, outcomeAccuracy: 1, fieldAccuracy: 1, exactMissingLists: 17, errors: 0,
    });
    assert.ok(scores.every(({ ok }) => ok));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a live run sends each document through the production prompt', async () => {
  const samples = await loadSet();
  const sent = [];
  const fetchImpl = async (_url, { body }) => {
    const request = JSON.parse(body);
    sent.push(request);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] });
  };
  const { summary } = await evaluate({ mode: 'live', env: { OPENAI_API_KEY: 'test', EVAL_MODEL: 'gpt-4.1-mini' }, fetchImpl });
  // A reply that fails schema validation counts as an error, never as a pass.
  assert.equal(sent.length, samples.length);
  assert.equal(summary.errors, 17);
  assert.equal(summary.correctOutcomes, 0);
  assert.ok(sent.every(({ model, temperature, messages }) => model === 'gpt-4.1-mini' && temperature === 0
    && messages[0].role === 'system'));
});

test('scoring compares outcome, fields and missing list, ignoring case and spacing', () => {
  const sample = { file: 'x.txt', expected: {
    documentType: "DRIVER'S LICENSE", applicantName: 'JUAN DELA CRUZ', address: null,
    readability: 'clear', outcome: 'incomplete', missingFields: ['address'],
  } };
  const analysis = (applicantName, outcome, missing) => ({ outcome: 'success', analysis: {
    observations: {
      documentType: { value: "driver's  license" }, applicantName: { value: applicantName },
      address: { value: null }, readability: { status: 'clear' },
    },
    decisions: { outcome, missingInformation: missing.map((field) => ({ field })) },
  } });
  assert.deepEqual(score(sample, analysis('Juan Dela Cruz', 'incomplete', ['address'])),
    { file: 'x.txt', ok: true, outcome: 'incomplete', expected: 'incomplete', fields: 4, missing: true });
  assert.deepEqual(score(sample, analysis('Pedro Penduko', 'complete', [])),
    { file: 'x.txt', ok: false, outcome: 'complete', expected: 'incomplete', fields: 3, missing: false });
  assert.equal(score(sample, { outcome: 'timeout', code: 'PROVIDER_TIMEOUT' }).outcome, 'error: PROVIDER_TIMEOUT');
});

test('the report names the prompt version and highlights wrong outcomes', () => {
  const scores = [
    { file: 'a.txt', ok: true, outcome: 'complete', expected: 'complete', fields: 4, missing: true },
    { file: 'b.txt', ok: false, outcome: 'incomplete', expected: 'complete', fields: 3, missing: false },
  ];
  const markdown = report({ summary: summarize(scores), scores, model: 'gpt-4.1-mini', mode: 'live' });
  assert.match(markdown, new RegExp(`prompt ${EXTRACTION_PROMPT_VERSION.replaceAll('.', '\\.')}, gpt-4\\.1-mini`));
  assert.match(markdown, /\| 1\/2 \(50\.0 %\) \| 87\.5 % \| 1\/2 \| 0 \|/);
  assert.match(markdown, /\| b\.txt \| \*\*incomplete\*\* \| complete \|/);
});

test('the command line rejects a minimum that is not a number between 0 and 1', async () => {
  const { spawnSync } = await import('node:child_process');
  const script = fileURLToPath(new URL('../scripts/eval-production-prompt.js', import.meta.url));
  for (const value of ['0,88', '', 'abc', '1.5', '-0.1']) {
    const run = spawnSync(process.execPath, [script, '--mock', `--min-outcome=${value}`], { encoding: 'utf8' });
    assert.equal(run.status, 2, `--min-outcome ${JSON.stringify(value)} must be rejected`);
    assert.match(run.stderr, /between 0 and 1/);
  }
  assert.equal(spawnSync(process.execPath, [script, '--mock', '--min-outcome=1'], { encoding: 'utf8' }).status, 0);
});
