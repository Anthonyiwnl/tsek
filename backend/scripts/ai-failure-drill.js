// Simulates AI provider failures against the real API and provider client (#103).
//
//   npm run drill:ai --prefix backend
//     Local drill: no API key, no network. A fake OpenAI server on 127.0.0.1
//     fails in each way, and the drill checks the API's answer to each.
//
//   npm run drill:ai --prefix backend -- --url https://<staging-backend> --expect PROVIDER_TIMEOUT
//     Deployed drill: after changing the staging environment (docs/AI_FAILURE_DRILL.md),
//     sends one synthetic request and checks the error code and that /health still answers.

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createApp } from '../src/app.js';
import { createOpenAiProvider } from '../src/provider.js';

const DRILL_KEY = 'drill-key-not-a-real-secret';
const INTERNAL_DETAIL = 'fake-provider-internal-detail';
const INPUT = 'Synthetic drill document: Barangay Clearance for an invented applicant.';

// Each scenario is one way OpenAI can fail, and the answer the API must give.
export const SCENARIOS = [
  { name: 'Provider answers normally (control)', mode: 'ok', status: 200, code: null },
  { name: 'No API key configured', mode: 'ok', apiKey: '', status: 503, code: 'MISSING_CREDENTIALS' },
  { name: 'Provider is too slow (timeout)', mode: 'hang', status: 504, code: 'PROVIDER_TIMEOUT' },
  { name: 'Provider cannot be reached', mode: 'down', status: 502, code: 'PROVIDER_UNAVAILABLE' },
  { name: 'Provider returns HTTP 500', mode: 'error', status: 502, code: 'PROVIDER_ERROR' },
  { name: 'Provider rate-limits us (HTTP 429)', mode: 'rate-limit', status: 502, code: 'PROVIDER_ERROR' },
  { name: 'Provider reply is cut off', mode: 'truncated', status: 502, code: 'INVALID_PROVIDER_RESPONSE' },
  { name: 'Provider reply is not JSON', mode: 'garbage', status: 502, code: 'INVALID_PROVIDER_RESPONSE' },
];

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

/** A stand-in for the OpenAI chat completions endpoint that fails on request. */
async function startFakeProvider() {
  let mode = 'ok';
  const hanging = new Set();
  const server = createServer((req, res) => {
    req.resume();
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': type });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    switch (mode) {
      case 'hang':
        hanging.add(res);
        return undefined;
      case 'error':
        return send(500, { error: { message: INTERNAL_DETAIL } });
      case 'rate-limit':
        return send(429, { error: { message: `Rate limit reached. ${INTERNAL_DETAIL}` } });
      case 'truncated':
        return send(200, { choices: [{ finish_reason: 'length', message: { content: 'Partial answer' } }] });
      case 'garbage':
        return send(200, `<html>${INTERNAL_DETAIL}</html>`, 'text/html');
      default:
        return send(200, { choices: [{ finish_reason: 'stop', message: { content: 'Synthetic verification result.' } }] });
    }
  });
  const port = await listen(server);
  return {
    endpoint: `http://127.0.0.1:${port}/v1/chat/completions`,
    setMode(next) { mode = next; },
    async close() {
      for (const res of hanging) res.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

/** A port that nothing listens on, for the "cannot be reached" case. */
async function closedPortEndpoint() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return `http://127.0.0.1:${port}/v1/chat/completions`;
}

const catalogue = {
  list: async () => [{ id: '00000000-0000-4000-8000-000000000001', name: 'Barangay Clearance' }],
  requirements: async () => null,
  ready: async () => {},
};

async function getJson(url, init, timeoutMs = 15000) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* checked by the caller */ }
  return { status: response.status, text, body };
}

/** Run every scenario against a real listening API. Returns one result per scenario. */
export async function runLocalDrill({ timeoutMs = 300 } = {}) {
  const fake = await startFakeProvider();
  const unreachable = await closedPortEndpoint();
  const results = [];
  try {
    for (const scenario of SCENARIOS) {
      fake.setMode(scenario.mode);
      const provider = createOpenAiProvider({
        apiKey: scenario.apiKey ?? DRILL_KEY,
        model: 'gpt-4.1-mini',
        timeoutMs,
        endpoint: scenario.mode === 'down' ? unreachable : fake.endpoint,
      });
      const app = createApp({
        catalogue,
        provider,
        commit: null,
        env: { AI_VERIFY_ENABLED: 'true' },
        logger: { error() {} },
      });
      const server = app.listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      try {
        const started = performance.now();
        const verify = await getJson(`${base}/api/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: INPUT }),
        });
        const ms = Math.round(performance.now() - started);
        const health = await getJson(`${base}/health`);
        const catalogueResponse = await getJson(`${base}/api/document-types`);
        const problems = [];
        if (verify.status !== scenario.status) problems.push(`status ${verify.status}, expected ${scenario.status}`);
        const code = verify.body?.error?.code ?? null;
        if (code !== scenario.code) problems.push(`code ${code}, expected ${scenario.code}`);
        if (verify.text.includes(DRILL_KEY) || verify.text.includes(INTERNAL_DETAIL)) {
          problems.push('the response leaks the key or the provider\'s internal error');
        }
        if (health.status !== 200) problems.push(`/health returned ${health.status}`);
        if (catalogueResponse.status !== 200) problems.push(`/api/document-types returned ${catalogueResponse.status}`);
        results.push({ ...scenario, gotStatus: verify.status, gotCode: code, ms, ok: problems.length === 0, problems });
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    }
  } finally {
    await fake.close();
  }
  return results;
}

/** One synthetic request to a deployed backend; checks the error code and that /health still answers. */
export async function runDeployedDrill({ url, expect }) {
  const base = url.replace(/\/+$/, '').replace(/\/health$/, '');
  // Render's free services sleep, so the first request can take about a minute.
  let health;
  let verify;
  try {
    health = await getJson(`${base}/health`, undefined, 90000);
    verify = await getJson(`${base}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: INPUT }),
    }, 30000);
    health = await getJson(`${base}/health`);
  } catch (error) {
    return [{ name: `Deployed: ${base}`, gotStatus: '—', gotCode: null, ok: false, problems: [`no answer from ${base}: ${error.message}`] }];
  }
  const code = verify.body?.error?.code ?? (verify.status === 200 ? null : 'NO_ERROR_CODE');
  const problems = [];
  if (expect && code !== (expect === 'OK' ? null : expect)) problems.push(`code ${code}, expected ${expect}`);
  if (verify.status === 404) problems.push('/api/verify is disabled: set AI_VERIFY_ENABLED=true on this backend');
  if (verify.status >= 500 && !verify.body?.error?.code) problems.push('the error is not a clean JSON error');
  if (health.status !== 200) problems.push(`/health returned ${health.status}`);
  return [{ name: `Deployed: ${base}`, gotStatus: verify.status, gotCode: code, ok: problems.length === 0, problems }];
}

function print(results) {
  console.log('| Scenario | Status | Error code | Result |');
  console.log('|---|---|---|---|');
  for (const result of results) {
    const verdict = result.ok ? 'pass' : `FAIL: ${result.problems.join('; ')}`;
    console.log(`| ${result.name} | ${result.gotStatus} | ${result.gotCode ?? '—'} | ${verdict} |`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: { url: { type: 'string' }, expect: { type: 'string' } } });
  const results = values.url ? await runDeployedDrill(values) : await runLocalDrill();
  print(results);
  const failed = results.filter((result) => !result.ok).length;
  console.log(failed
    ? `\n${failed} scenario(s) failed.`
    : `\nAll ${results.length} scenario(s) passed.`);
  process.exitCode = failed ? 1 : 0;
}
