// Evaluate the production extraction prompt end to end (#304).
//
// Sends the #31 evaluation set and added synthetic regression cases through
// the real extractor (production prompt, strict schema, validation, evidence
// check and decision rules) and scores the result against the expected
// answers in test/fixtures/document-evaluation-v1/expected.json.
//
//   node scripts/eval-production-prompt.js --mock            # no key, checks the plumbing
//   OPENAI_API_KEY=<capped eval key> node scripts/eval-production-prompt.js --min-outcome 0.88
//
// The documents are synthetic; nothing personal is sent or logged.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createDocumentExtractor } from '../src/extraction.js';
import { EXTRACTION_PROMPT_VERSION } from '../src/extraction-prompt.v1.js';

const setDirectory = new URL('../test/fixtures/document-evaluation-v1/', import.meta.url);
const FIELDS = ['documentType', 'applicantName', 'address'];

const normalize = (value) => (typeof value === 'string'
  ? value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim() : value);

export async function loadSet() {
  const expected = JSON.parse(await readFile(new URL('expected.json', setDirectory), 'utf8'));
  return Promise.all(expected.samples.map(async (sample) => ({
    ...sample,
    text: await readFile(new URL(`samples/${sample.file}`, setDirectory), 'utf8'),
  })));
}

/** A fake provider that answers with the current sample's expected observations: checks the plumbing, not the model. */
export function mockFetch(current) {
  return async () => {
    const expected = current().expected;
    const field = (value) => ({ value: value ?? null, confidence: value == null ? 0 : 0.95 });
    const observations = {
      documentType: field(expected.documentType),
      applicantName: field(expected.applicantName),
      address: field(expected.address),
      readability: { status: expected.readability, confidence: 0.95 },
    };
    return Response.json({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(observations) } }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  };
}

/** Score one extraction against its expected answer. */
export function score(sample, result) {
  const expected = sample.expected;
  if (result.outcome !== 'success') {
    return { file: sample.file, ok: false, outcome: `error: ${result.code}`, expected: expected.outcome, fields: 0, missing: false };
  }
  const { observations, decisions } = result.analysis;
  const fields = [...FIELDS.map((name) => normalize(observations[name].value) === normalize(expected[name] ?? null)),
    observations.readability.status === expected.readability].filter(Boolean).length;
  const missing = decisions.missingInformation.map(({ field }) => field).sort().join(',')
    === [...expected.missingFields].sort().join(',');
  return {
    file: sample.file, ok: decisions.outcome === expected.outcome,
    outcome: decisions.outcome, expected: expected.outcome, fields, missing,
  };
}

export function summarize(scores) {
  const n = scores.length;
  return {
    cases: n,
    correctOutcomes: scores.filter(({ ok }) => ok).length,
    outcomeAccuracy: scores.filter(({ ok }) => ok).length / n,
    fieldAccuracy: scores.reduce((sum, { fields }) => sum + fields, 0) / (n * 4),
    exactMissingLists: scores.filter(({ missing }) => missing).length,
    errors: scores.filter(({ outcome }) => outcome.startsWith('error')).length,
  };
}

export function report({ summary, scores, model, mode }) {
  const pct = (value) => `${(value * 100).toFixed(1)} %`;
  return [
    `## Production prompt evaluation (prompt ${EXTRACTION_PROMPT_VERSION}, ${mode === 'mock' ? 'mock provider' : model})`,
    '',
    `| Correct outcomes | Field accuracy | Exact missing-field lists | Errors |`,
    '|---|---|---|---|',
    `| ${summary.correctOutcomes}/${summary.cases} (${pct(summary.outcomeAccuracy)}) | ${pct(summary.fieldAccuracy)} | ${summary.exactMissingLists}/${summary.cases} | ${summary.errors} |`,
    '',
    '| Case | Outcome | Expected | Fields (of 4) | Missing list |',
    '|---|---|---|---|---|',
    ...scores.map((s) => `| ${s.file} | ${s.ok ? '' : '**'}${s.outcome}${s.ok ? '' : '**'} | ${s.expected} | ${s.fields} | ${s.missing ? 'exact' : 'differs'} |`),
    '',
  ].join('\n');
}

export async function evaluate({ mode = 'live', env = process.env, fetchImpl } = {}) {
  const samples = await loadSet();
  const model = env.EVAL_MODEL || 'gpt-4.1-mini';
  let current;
  const extract = createDocumentExtractor({
    env: {
      OPENAI_API_KEY: mode === 'mock' ? 'mock-placeholder' : env.OPENAI_API_KEY,
      OPENAI_MODEL: model,
      OPENAI_TIMEOUT_MS: '30000',
    },
    logger: {},
    fetchImpl: mode === 'mock' ? mockFetch(() => current) : fetchImpl,
  });
  const scores = [];
  const failedRegressions = [];
  for (const sample of samples) {
    current = sample;
    const result = await extract({ text: sample.text, applicationId: 'evaluation', uploadedFileId: sample.file });
    const scored = score(sample, result);
    scores.push(scored);
    if (sample.required && (!scored.ok || scored.fields !== FIELDS.length + 1 || !scored.missing)) {
      failedRegressions.push(sample.file);
    }
  }
  return { scores, summary: summarize(scores), failedRegressions, model, mode };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { values } = parseArgs({ options: {
    mock: { type: 'boolean', default: false },
    'min-outcome': { type: 'string', default: '0' },
    out: { type: 'string' },
  } });
  const minimum = Number(values['min-outcome']);
  if (values['min-outcome'].trim() === '' || !Number.isFinite(minimum) || minimum < 0 || minimum > 1) {
    console.error('--min-outcome must be a number between 0 and 1.');
    process.exit(2);
  }
  if (!values.mock && !process.env.OPENAI_API_KEY) {
    console.error('Set OPENAI_API_KEY to the capped eval key, or pass --mock.');
    process.exit(2);
  }
  const result = await evaluate({ mode: values.mock ? 'mock' : 'live' });
  const markdown = report(result);
  process.stdout.write(`${markdown}\n`);
  if (values.out) {
    await mkdir(values.out, { recursive: true });
    await writeFile(`${values.out}/production-prompt-${EXTRACTION_PROMPT_VERSION}.md`, markdown);
    await writeFile(`${values.out}/production-prompt-${EXTRACTION_PROMPT_VERSION}.json`,
      `${JSON.stringify({ promptVersion: EXTRACTION_PROMPT_VERSION, ...result }, null, 2)}\n`);
  }
  if (result.summary.outcomeAccuracy < minimum) {
    console.error(`Outcome accuracy ${result.summary.correctOutcomes}/${result.summary.cases} is below the minimum ${minimum}.`);
    process.exitCode = 1;
  }
  if (result.failedRegressions.length) {
    console.error(`Required regression cases did not match: ${result.failedRegressions.join(', ')}.`);
    process.exitCode = 1;
  }
}
