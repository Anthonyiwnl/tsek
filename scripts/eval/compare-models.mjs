#!/usr/bin/env node
// Compare cloud and local models on the same synthetic documents and prompt (#101).
// Usage and examples: scripts/eval/README.md

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  DEFAULT_PRICES, extractJson, markdownTable, parseModelSpec, schemaProblems, scoreAnswer, summarize,
} from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const { values: args } = parseArgs({
  options: {
    models: { type: 'string', default: 'mock:perfect' },
    dataset: { type: 'string', default: join(here, 'dataset', 'documents.v1.json') },
    prompt: { type: 'string', default: join(here, 'prompt.v1.md') },
    out: { type: 'string', default: join(here, 'results') },
    repeat: { type: 'string', default: '1' },
    limit: { type: 'string' },
    'timeout-ms': { type: 'string', default: '180000' },
    reasoning: { type: 'string' },
    price: { type: 'string', multiple: true, default: [] },
    'min-valid-json': { type: 'string' },
    'min-outcome': { type: 'string' },
    'no-warmup': { type: 'boolean', default: false },
    'no-save': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (args.help) {
  console.log(`node scripts/eval/compare-models.mjs --models openai:gpt-4.1-mini,ollama:qwen3.5:9b [options]

  --models          comma-separated provider:model list (openai, ollama, compat, mock)
  --repeat N        run every case N times (default 1)
  --limit N         only the first N cases (quick check)
  --reasoning X     send reasoning_effort X (e.g. none for Qwen/gpt-oss on Ollama, minimal for gpt-5)
  --price m=in/out  USD per 1M tokens for a model not in the built-in table
  --min-valid-json  fail (exit 1) if any model's valid JSON rate is below this (0..1)
  --min-outcome     fail (exit 1) if any model's outcome accuracy is below this (0..1)
  --timeout-ms      per-request timeout (default 180000, local models can be slow)
  --no-warmup       skip the untimed first request that loads a local model
  --no-save         print the table without writing results files`);
  process.exit(0);
}

const prices = { ...DEFAULT_PRICES };
for (const entry of args.price) {
  const match = entry.match(/^(.+)=([\d.]+)\/([\d.]+)$/);
  if (!match) throw new Error(`--price "${entry}" must look like model=input/output, e.g. gpt-5-mini=0.25/2`);
  prices[match[1]] = [Number(match[2]), Number(match[3])];
}

const endpoints = {
  openai: () => ({
    base: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    key: process.env.OPENAI_API_KEY,
    keyName: 'OPENAI_API_KEY',
  }),
  ollama: () => ({ base: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1', key: 'ollama' }),
  compat: () => ({ base: process.env.COMPAT_BASE_URL, key: process.env.COMPAT_API_KEY || 'none', keyName: 'COMPAT_BASE_URL' }),
};

// The key travels in a header, so plain HTTP is allowed only to this machine.
function assertSafeEndpoint(base) {
  let url;
  try { url = new URL(base); } catch { throw new Error(`${base} is not a valid URL.`); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error(`${url.origin} must use HTTPS; plain HTTP is allowed only for localhost.`);
  }
}

// gpt-5 and o-series models reject temperature; every other model runs at 0.
const isReasoningModel = (model) => /^(gpt-5|o\d)/.test(model);

async function callModel(target, system, testCase) {
  if (target.provider === 'mock') return mockReply(target.model, testCase);
  const { base, key, keyName } = endpoints[target.provider]();
  if (!base || !key) throw new Error(`${keyName} is not set.`);
  assertSafeEndpoint(base);
  const body = {
    model: target.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: testCase.text },
    ],
    response_format: { type: 'json_object' },
  };
  if (!isReasoningModel(target.model)) body.temperature = 0;
  if (args.reasoning) body.reasoning_effort = args.reasoning;

  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (target.provider === 'openai') {
    if (process.env.OPENAI_ORG_ID) headers['OpenAI-Organization'] = process.env.OPENAI_ORG_ID;
    if (process.env.OPENAI_PROJECT_ID) headers['OpenAI-Project'] = process.env.OPENAI_PROJECT_ID;
  }

  const started = performance.now();
  const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(args['timeout-ms'])),
  });
  const payload = await response.json().catch(() => null);
  const latencyMs = performance.now() - started;
  if (!response.ok) {
    const message = payload?.error?.message ?? (typeof payload?.error === 'string' ? payload.error : 'no error body');
    throw new Error(`HTTP ${response.status}: ${String(message).slice(0, 200)}`);
  }
  return { text: payload?.choices?.[0]?.message?.content ?? '', usage: payload?.usage ?? null, latencyMs };
}

// mock:perfect answers every case correctly; mock:broken returns invalid JSON or
// wrong outcomes. They prove the scoring works without an API key (CI).
function mockReply(name, testCase) {
  const e = testCase.expected;
  const answer = {
    documentType: { value: e.documentType, confidence: 0.9 },
    applicantName: { value: e.applicantName, confidence: 0.9 },
    address: { value: e.address, confidence: 0.9 },
    readability: { status: e.readability, confidence: 0.9 },
    outcome: e.outcome,
    missingInformation: e.missingInformation,
  };
  if (name === 'perfect') return { text: JSON.stringify(answer), usage: { prompt_tokens: 500, completion_tokens: 100 }, latencyMs: 1 };
  if (name === 'broken') {
    if (testCase.index % 3 === 0) return { text: 'Sorry, I cannot read this document.', usage: null, latencyMs: 1 };
    return { text: JSON.stringify({ ...answer, outcome: 'complete' }), usage: null, latencyMs: 1 };
  }
  // Right outcome and fields, but no missingInformation list: only the schema and list checks catch it.
  if (name === 'sloppy') {
    const { missingInformation: _omitted, ...rest } = answer;
    return { text: JSON.stringify(rest), usage: null, latencyMs: 1 };
  }
  throw new Error(`Unknown mock "${name}". Use mock:perfect, mock:broken or mock:sloppy.`);
}

async function runModel(target, system, cases) {
  const results = [];
  if (!args['no-warmup'] && target.provider !== 'mock') {
    process.stderr.write(`  warming up ${target.spec} (not timed)... `);
    try { await callModel(target, system, cases[0]); process.stderr.write('ok\n'); }
    catch (error) { process.stderr.write(`failed: ${error.message}\n`); }
  }
  const repeat = Math.max(1, Number(args.repeat));
  for (let round = 1; round <= repeat; round += 1) {
    for (const testCase of cases) {
      const result = { id: testCase.id, kind: testCase.kind, round, latencyMs: null, usage: null };
      try {
        const reply = await callModel(target, system, testCase);
        Object.assign(result, { latencyMs: reply.latencyMs, usage: reply.usage, reply: reply.text });
        const parsed = extractJson(reply.text);
        result.json = parsed.ok;
        if (parsed.ok) {
          result.answer = parsed.value;
          result.schemaProblems = schemaProblems(parsed.value);
          result.score = scoreAnswer(testCase.expected, parsed.value);
        } else {
          result.parseError = parsed.error;
        }
      } catch (error) {
        result.json = false;
        result.error = error.name === 'TimeoutError' ? `timed out after ${args['timeout-ms']} ms` : error.message;
      }
      const mark = result.error ? 'E' : !result.json ? 'J' : result.score.outcomeCorrect ? '.' : 'x';
      process.stderr.write(mark);
      results.push(result);
    }
  }
  process.stderr.write('\n');
  return results;
}

const dataset = JSON.parse(await readFile(resolve(args.dataset), 'utf8'));
const system = await readFile(resolve(args.prompt), 'utf8');
const cases = dataset.cases
  .slice(0, args.limit ? Number(args.limit) : undefined)
  .map((testCase, index) => ({ ...testCase, index }));
const targets = args.models.split(',').map((spec) => spec.trim()).filter(Boolean).map(parseModelSpec);
for (const target of targets) {
  if (target.provider === 'mock') continue;
  const { base, key, keyName } = endpoints[target.provider]();
  if (!base || !key) {
    console.error(`${keyName} is not set, so ${target.spec} cannot run. See scripts/eval/README.md.`);
    process.exit(2);
  }
  try { assertSafeEndpoint(base); } catch (error) {
    console.error(`${target.spec}: ${error.message}`);
    process.exit(2);
  }
}

console.error(`Dataset ${dataset.version}: ${cases.length} cases. Prompt: ${args.prompt}`);
console.error('Legend: . correct outcome, x wrong outcome, J not JSON, E request error\n');

const runs = [];
for (const target of targets) {
  console.error(`${target.spec}`);
  const results = await runModel(target, system, cases);
  runs.push({ target, results, summary: summarize(target.spec, results, prices[target.model] ?? null) });
}

const table = markdownTable(runs.map((run) => run.summary));
const startedAt = new Date().toISOString();
const report = [
  `# Model comparison, ${startedAt.slice(0, 16).replace('T', ' ')} UTC`,
  '',
  `Dataset \`${dataset.version}\` (${cases.length} synthetic cases, repeated ${args.repeat}×), prompt \`${args.prompt.split('/').pop()}\`${args.reasoning ? `, reasoning_effort \`${args.reasoning}\`` : ''}.`,
  '',
  table,
  '',
  `Field accuracy averages documentType, applicantName, address and readability per case. Outcome accuracy is the share of cases with the correct complete / incomplete / unreadable / needs_review decision. ${args['no-warmup'] ? 'Warm-up was off (--no-warmup), so latency includes the first request, and a local model\'s load time.' : 'Latency excludes one untimed warm-up request per model.'} Costs use the price table in \`lib.mjs\`; check current prices before quoting them.`,
  '',
  '## Wrong answers',
  '',
  ...runs.flatMap(({ target, results }) => {
    const wrong = results.filter((result) => result.error || !result.json || !result.score.outcomeCorrect
      || result.score.fieldScore < 1 || !result.score.missingCorrect || result.schemaProblems.length > 0);
    if (wrong.length === 0) return [`- \`${target.spec}\`: none`];
    return [`- \`${target.spec}\`:`, ...wrong.map((result) => {
      if (result.error) return `  - ${result.id}: request error (${result.error})`;
      if (!result.json) return `  - ${result.id}: ${result.parseError}`;
      const fields = Object.entries(result.score.fields).filter(([, ok]) => !ok).map(([field]) => field);
      const outcome = result.score.outcomeCorrect ? '' : ` outcome "${result.answer.outcome}"`;
      const missing = result.score.missingCorrect ? '' : ' wrong missingInformation';
      const schema = result.schemaProblems.length ? ` schema: ${result.schemaProblems.join('; ')}` : '';
      return `  - ${result.id}:${outcome}${fields.length ? ` wrong ${fields.join(', ')}` : ''}${missing}${schema}`;
    })];
  }),
].join('\n');

console.log(`\n${table}\n`);

if (!args['no-save']) {
  await mkdir(resolve(args.out), { recursive: true });
  const stamp = startedAt.replace(/[:.]/g, '-').slice(0, 19);
  const base = join(resolve(args.out), stamp);
  await writeFile(`${base}.md`, `${report}\n`);
  await writeFile(`${base}.json`, `${JSON.stringify({ startedAt, dataset: dataset.version, prompt: args.prompt.split('/').pop(), reasoning: args.reasoning ?? null, warmup: !args['no-warmup'], timeoutMs: Number(args['timeout-ms']), repeat: Number(args.repeat), runs: runs.map(({ target, results, summary }) => ({ model: target.spec, summary, results })) }, null, 2)}\n`);
  console.error(`Saved ${base}.md and ${base}.json`);
}

const failures = [];
for (const { summary } of runs) {
  if (args['min-valid-json'] && summary.validJson < Number(args['min-valid-json'])) {
    failures.push(`${summary.model}: valid JSON ${(summary.validJson * 100).toFixed(0)}% < ${args['min-valid-json'] * 100}%`);
  }
  if (args['min-outcome'] && summary.outcomeAccuracy < Number(args['min-outcome'])) {
    failures.push(`${summary.model}: outcome accuracy ${(summary.outcomeAccuracy * 100).toFixed(0)}% < ${args['min-outcome'] * 100}%`);
  }
}
if (failures.length) {
  console.error(`\nBelow threshold:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
}
