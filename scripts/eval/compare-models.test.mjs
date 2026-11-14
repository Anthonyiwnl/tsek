import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  extractJson, normalize, parseModelSpec, schemaProblems, scoreAnswer, summarize, textMatches,
} from './lib.mjs';

const run = promisify(execFile);
const script = fileURLToPath(new URL('./compare-models.mjs', import.meta.url));
const dataset = JSON.parse(await readFile(new URL('./dataset/documents.v1.json', import.meta.url), 'utf8'));

const answerFor = (expected) => ({
  documentType: { value: expected.documentType, confidence: 0.9 },
  applicantName: { value: expected.applicantName, confidence: 0.9 },
  address: { value: expected.address, confidence: 0.9 },
  readability: { status: expected.readability, confidence: 0.9 },
  outcome: expected.outcome,
  missingInformation: expected.missingInformation,
});

test('model specs keep the colons inside Ollama tags', () => {
  assert.deepEqual(parseModelSpec('ollama:qwen3.5:9b'), { spec: 'ollama:qwen3.5:9b', provider: 'ollama', model: 'qwen3.5:9b' });
  assert.equal(parseModelSpec('openai:gpt-4.1-mini').model, 'gpt-4.1-mini');
  assert.throws(() => parseModelSpec('gpt-4.1-mini'), /provider:model/);
  assert.throws(() => parseModelSpec('azure:gpt'), /Unknown provider/);
});

test('JSON is found inside think blocks, code fences and chatty replies', () => {
  assert.deepEqual(extractJson('<think>{"draft": true}</think>\n{"outcome":"complete"}').value, { outcome: 'complete' });
  assert.deepEqual(extractJson('```json\n{"a":1}\n```').value, { a: 1 });
  assert.deepEqual(extractJson('Here you go: {"a":1} hope that helps').value, { a: 1 });
  assert.equal(extractJson('I cannot read this.').ok, false);
  assert.equal(extractJson('{"a":').ok, false);
  assert.equal(extractJson('[1,2]').ok, false);
  assert.equal(extractJson(undefined).ok, false);
});

test('every expected answer in the dataset is itself a valid reply that scores 100%', () => {
  assert.ok(dataset.cases.length >= 20);
  assert.equal(new Set(dataset.cases.map((testCase) => testCase.id)).size, dataset.cases.length);
  for (const testCase of dataset.cases) {
    const answer = answerFor(testCase.expected);
    assert.deepEqual(schemaProblems(answer), [], testCase.id);
    const score = scoreAnswer(testCase.expected, answer);
    assert.equal(score.fieldScore, 1, testCase.id);
    assert.ok(score.outcomeCorrect && score.missingCorrect, testCase.id);
  }
});

test('the dataset covers every kind and every outcome', () => {
  const kinds = new Set(dataset.cases.map((testCase) => testCase.kind));
  for (const kind of ['complete', 'noisy', 'incomplete', 'unreadable', 'wrong_type']) assert.ok(kinds.has(kind), kind);
  const outcomes = new Set(dataset.cases.map((testCase) => testCase.expected.outcome));
  for (const outcome of ['complete', 'incomplete', 'unreadable', 'needs_review']) assert.ok(outcomes.has(outcome), outcome);
});

test('expected outcomes follow the decision rules in the prompt', () => {
  for (const { id, expected } of dataset.cases) {
    const missing = ['documentType', 'applicantName', 'address'].filter((field) => expected[field] === null);
    let outcome = 'complete';
    if (expected.readability === 'unreadable') outcome = 'unreadable';
    else if (missing.length) outcome = 'incomplete';
    else if (expected.documentType === 'Other') outcome = 'needs_review';
    assert.equal(expected.outcome, outcome, id);
    assert.deepEqual(expected.missingInformation, missing, id);
  }
});

test('text matching tolerates case, titles and punctuation but not a different person', () => {
  assert.equal(normalize('Hon. Teodoro  SUMBINGCO.'), 'teodoro sumbingco');
  assert.ok(textMatches('Teodoro Sumbingco', 'Mr. TEODORO SUMBINGCO'));
  assert.ok(textMatches('Purok 3, Barangay Taculing, Bacolod City', 'Purok 3 Brgy. Taculing, Bacolod City'));
  assert.ok(!textMatches('Sofia Ramos Ledesma', 'Elena Ramos Ledesma'));
  assert.ok(!textMatches('Block 4 Lot 12, Villa Angela Subdivision, Barangay Estefania, Bacolod City',
    'Block 4 Lot 13, Villa Angela Subdivision, Barangay Estefania, Bacolod City'), 'a different lot number');
  assert.ok(!textMatches('Block 4 Lot 12, Villa Angela Subdivision, Barangay Estefania, Bacolod City',
    'Block 12 Lot 4, Villa Angela Subdivision, Barangay Estefania, Bacolod City'), 'block and lot swapped');
  assert.ok(textMatches(null, null));
  assert.ok(!textMatches(null, 'Somebody'));
  assert.ok(!textMatches('Somebody', null));
});

test('schema problems are reported for wrong types and unknown values', () => {
  const answer = answerFor(dataset.cases[0].expected);
  assert.ok(schemaProblems({ ...answer, applicantName: { value: 12345, confidence: 0.9 } }).length > 0);
  assert.ok(schemaProblems({ ...answer, documentType: { value: 'Passport', confidence: 0.9 } }).length > 0);
  assert.ok(schemaProblems({ ...answer, outcome: 'approved' }).length > 0);
  assert.ok(schemaProblems({ ...answer, readability: { status: 'clear', confidence: 2 } }).length > 0);
  assert.ok(schemaProblems({ ...answer, missingInformation: ['phone'] }).length > 0);
  assert.ok(schemaProblems({ ...answer, missingInformation: ['address', 'address'] }).length > 0, 'duplicate');
  assert.ok(schemaProblems({ ...answer, missingInformation: ['address', 'applicantName'] }).length > 0, 'wrong order');
  assert.deepEqual(schemaProblems({ ...answer, missingInformation: ['documentType', 'address'] }), []);
});

test('an omitted or malformed field never scores as a correct null', () => {
  const unreadable = dataset.cases.find((testCase) => testCase.id === 'unreadable-blank').expected;
  const lazy = { readability: { status: 'unreadable', confidence: 0.9 }, outcome: 'unreadable', missingInformation: [] };
  assert.equal(scoreAnswer(unreadable, lazy).fieldScore, 0.25, 'only readability is right');
  const malformed = { ...answerFor(unreadable), address: { value: null } };
  assert.equal(scoreAnswer(unreadable, malformed).fields.address, false);
  const badConfidence = { ...answerFor(unreadable), readability: { status: 'unreadable', confidence: 2 } };
  assert.equal(scoreAnswer(unreadable, badConfidence).fields.readability, false);
});

test('summary rates, latency percentiles and cost', () => {
  const ok = { json: true, schemaProblems: [], score: { fieldScore: 1, outcomeCorrect: true, missingCorrect: true }, latencyMs: 100, usage: { prompt_tokens: 1000, completion_tokens: 200 } };
  const bad = { json: false, latencyMs: 300, usage: null };
  const failed = { json: false, error: 'HTTP 500', latencyMs: null };
  const summary = summarize('openai:gpt-4.1-mini', [ok, ok, bad, failed], [0.4, 1.6]);
  assert.equal(summary.validJson, 0.5);
  assert.equal(summary.outcomeAccuracy, 0.5);
  assert.equal(summary.errors, 1);
  assert.equal(summary.latencyMedianMs, 100);
  assert.equal(summary.latencyP95Ms, 300);
  assert.ok(Math.abs(summary.costUsd - (2000 * 0.4 + 400 * 1.6) / 1e6) < 1e-12);
});

test('mock run end to end: perfect passes the thresholds, broken fails them', async () => {
  const { stdout } = await run(process.execPath, [script, '--models', 'mock:perfect', '--no-save', '--min-valid-json', '1', '--min-outcome', '1']);
  assert.match(stdout, /\| `mock:perfect` \| 100% \| 100% \| 100% \| 100% \| 100% \|/);
  await assert.rejects(
    run(process.execPath, [script, '--models', 'mock:broken', '--no-save', '--min-valid-json', '0.9']),
    (error) => error.code === 1 && /Below threshold/.test(error.stderr),
  );
});

test('OpenAI-compatible requests: JSON mode, temperature 0, think blocks stripped, HTTP errors reported', async () => {
  const { createServer } = await import('node:http');
  const bodies = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      const body = JSON.parse(raw);
      bodies.push({ body, headers: req.headers, path: req.url });
      res.setHeader('Content-Type', 'application/json');
      if (body.model === 'fails') {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: { message: 'model crashed' } }));
      }
      if (body.model === 'bad-request') {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: { message: 'response_format is not supported' } }));
      }
      if (body.model === 'slow') return undefined; // never answers
      const caseText = body.messages[1].content;
      const expected = dataset.cases.find((testCase) => testCase.text === caseText).expected;
      res.end(JSON.stringify({
        choices: [{ message: { content: `<think>reading</think>${JSON.stringify(answerFor(expected))}` }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }));
    });
  });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const url = `http://127.0.0.1:${server.address().port}/v1`;
  const env = {
    ...process.env, COMPAT_BASE_URL: url, COMPAT_API_KEY: 'test-key',
    OPENAI_BASE_URL: url, OPENAI_API_KEY: 'test-openai-key',
    OPENAI_ORG_ID: 'org-test', OPENAI_PROJECT_ID: 'proj_test',
  };
  try {
    const { stdout } = await run(process.execPath, [script, '--models', 'compat:local-model,compat:fails,compat:bad-request,compat:slow', '--limit', '2', '--no-save', '--no-warmup', '--timeout-ms', '300'], { env });
    assert.match(stdout, /\| `compat:local-model` \| 100% \| 100% \| 100% \| 100% \|/);
    for (const model of ['fails', 'bad-request', 'slow']) {
      assert.match(stdout, new RegExp(`\\| \`compat:${model}\` \\| 0% .* \\| 2 \\|$`, 'm'), model);
    }
    const first = bodies[0];
    assert.equal(first.path, '/v1/chat/completions');
    assert.equal(first.headers.authorization, 'Bearer test-key');
    assert.equal(first.headers['openai-organization'], undefined);
    assert.equal(first.headers['openai-project'], undefined);
    assert.equal(first.body.temperature, 0);
    assert.deepEqual(first.body.response_format, { type: 'json_object' });
    assert.equal(first.body.messages[0].role, 'system');
    assert.equal(first.body.reasoning_effort, undefined);
    await run(process.execPath, [script, '--models', 'openai:gpt-5-mini', '--limit', '1', '--no-save', '--no-warmup', '--reasoning', 'minimal'], { env });
    const scoped = bodies.at(-1);
    assert.equal(scoped.headers.authorization, 'Bearer test-openai-key');
    assert.equal(scoped.headers['openai-organization'], 'org-test');
    assert.equal(scoped.headers['openai-project'], 'proj_test');
    assert.equal(scoped.body.reasoning_effort, 'minimal');
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test('the key is never sent over plain HTTP to another machine', async () => {
  const env = { ...process.env, COMPAT_BASE_URL: 'http://models.example.com/v1', COMPAT_API_KEY: 'test-key' };
  await assert.rejects(
    run(process.execPath, [script, '--models', 'compat:any', '--no-save'], { env }),
    (error) => error.code === 2 && /must use HTTPS/.test(error.stderr),
  );
});

test('the report lists replies whose only fault is the schema or the missing-field list', async () => {
  const { mkdtemp, readdir, readFile: read, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const out = await mkdtemp(join(tmpdir(), 'eval-report-'));
  try {
    await run(process.execPath, [script, '--models', 'mock:sloppy', '--limit', '2', '--out', out]);
    const report = await read(join(out, (await readdir(out)).find((file) => file.endsWith('.md'))), 'utf8');
    assert.match(report, /bc-clear-01: wrong missingInformation schema: missingInformation must list/);
    assert.doesNotMatch(report, /`mock:sloppy`: none/);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
