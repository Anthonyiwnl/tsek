import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLocalDrill, SCENARIOS } from '../scripts/ai-failure-drill.js';

test('AI provider failure drill: every failure returns a clean error and the API stays up', async () => {
  const results = await runLocalDrill({ timeoutMs: 200 });
  assert.equal(results.length, SCENARIOS.length);
  for (const result of results) {
    assert.ok(result.ok, `${result.name}: ${result.problems.join('; ')}`);
  }
  const timeout = results.find((result) => result.mode === 'hang');
  assert.ok(timeout.ms < 5000, `the timeout case took ${timeout.ms} ms`);
});
