import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';
import { createOpenAiProvider } from '../src/provider.js';
import { runDeployedDrill, runLocalDrill, SCENARIOS } from '../scripts/ai-failure-drill.js';

const catalogue = { list: async () => [], requirements: async () => null, ready: async () => {} };

async function withBackend(options, check) {
  const app = createApp({ catalogue, commit: null, logger: { error() {} }, ...options });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    return await check(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('AI provider failure drill: every failure returns a clean error and the API stays up', async () => {
  const results = await runLocalDrill({ timeoutMs: 200 });
  assert.equal(results.length, SCENARIOS.length);
  for (const result of results) {
    assert.ok(result.ok, `${result.name}: ${result.problems.join('; ')}`);
  }
  const timeout = results.find((result) => result.mode === 'hang');
  assert.ok(timeout.ms < 5000, `the timeout case took ${timeout.ms} ms`);
});

test('deployed drill checks the code, the matching status and the catalogue', async () => {
  // Like the staging timeout drill, with a local provider that never answers instead of OpenAI.
  const hanging = new Set();
  const slowProvider = createServer((_req, res) => { hanging.add(res); });
  await new Promise((resolve) => slowProvider.listen(0, '127.0.0.1', resolve));
  const provider = createOpenAiProvider({
    apiKey: 'drill-key-not-a-real-secret',
    model: 'gpt-4.1-mini',
    timeoutMs: 50,
    endpoint: `http://127.0.0.1:${slowProvider.address().port}/v1/chat/completions`,
  });
  await withBackend({ env: { AI_VERIFY_ENABLED: 'true' }, provider }, async (url) => {
    const [pass] = await runDeployedDrill({ url: `${url}/health`, expect: 'PROVIDER_TIMEOUT' });
    assert.ok(pass.ok, pass.problems.join('; '));
    const [wrongCode] = await runDeployedDrill({ url, expect: 'PROVIDER_ERROR' });
    assert.ok(!wrongCode.ok);
    assert.match(wrongCode.problems.join(' '), /status 504, expected 502/);
    const [notOk] = await runDeployedDrill({ url, expect: 'OK' });
    assert.ok(!notOk.ok);
  }).finally(async () => {
    for (const res of hanging) res.destroy();
    await new Promise((resolve) => slowProvider.close(resolve));
  });
  await assert.rejects(runDeployedDrill({ url: 'http://127.0.0.1:9', expect: 'TIMEOUT' }), /--expect must be one of/);
});

test('deployed drill rejects an empty success and a failing catalogue', async () => {
  const env = { AI_VERIFY_ENABLED: 'true' };
  await withBackend({ env, provider: async () => ({ model: '', result: '' }) }, async (url) => {
    const [result] = await runDeployedDrill({ url, expect: 'OK' });
    assert.match(result.problems.join(' '), /non-empty result and model/);
  });
  const broken = { ...catalogue, list: async () => { throw new Error('database down'); } };
  await withBackend({ env, catalogue: broken, provider: async () => ({ model: 'm', result: 'r' }) }, async (url) => {
    const [result] = await runDeployedDrill({ url, expect: 'OK' });
    assert.deepEqual(result.problems, ['/api/document-types returned 500']);
  });
  await withBackend({ env: {} }, async (url) => {
    const [result] = await runDeployedDrill({ url, expect: 'OK' });
    assert.match(result.problems.join(' '), /AI_VERIFY_ENABLED=true/);
  });
});
