import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_OUTCOME, createAiGuard, providerOutcome } from '../src/ai-guard.js';

function clock(start = 1_000_000) {
  let time = start;
  return { now: () => time, advance: (ms) => { time += ms; } };
}

function guardWith(options = {}) {
  const logs = [];
  const time = clock();
  const guard = createAiGuard({
    failureThreshold: 3, cooldownMs: 30_000, maxConcurrent: 2, now: time.now,
    logger: { info: (line) => logs.push(JSON.parse(line)) }, ...options,
  });
  return { guard, time, logs };
}

const fail = (guard) => guard.admit('r').finish(AI_OUTCOME.failure);

test('maps provider codes to provider health', () => {
  assert.equal(providerOutcome(null), AI_OUTCOME.success);
  assert.equal(providerOutcome('INVALID_PROVIDER_RESPONSE'), AI_OUTCOME.success);
  for (const code of ['PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'PROVIDER_ERROR']) {
    assert.equal(providerOutcome(code), AI_OUTCOME.failure);
  }
  assert.equal(providerOutcome('MISSING_CREDENTIALS'), AI_OUTCOME.neutral);
  assert.equal(providerOutcome('INVALID_EXTRACTION_INPUT'), AI_OUTCOME.neutral);
});

test('opens after consecutive failures and fails fast until the cool-down ends', () => {
  const { guard, time, logs } = guardWith();
  fail(guard);
  fail(guard);
  assert.equal(guard.snapshot().state, 'closed');
  fail(guard);
  assert.deepEqual(guard.snapshot(), { state: 'open', consecutiveFailures: 3, inFlight: 0, maxConcurrent: 2 });
  assert.deepEqual(guard.admit('r'), { allowed: false, code: 'AI_UNAVAILABLE', retryAfterSeconds: 30 });
  time.advance(29_001);
  assert.deepEqual(guard.admit('r'), { allowed: false, code: 'AI_UNAVAILABLE', retryAfterSeconds: 1 });
  assert.deepEqual(logs.map(({ from, to }) => [from, to]), [['closed', 'open']]);
});

test('a success resets the failure count', () => {
  const { guard } = guardWith();
  fail(guard);
  fail(guard);
  guard.admit('r').finish(AI_OUTCOME.success);
  fail(guard);
  fail(guard);
  assert.equal(guard.snapshot().state, 'closed');
});

test('half-open lets one trial through; success closes, failure reopens', () => {
  const { guard, time, logs } = guardWith();
  for (let index = 0; index < 3; index += 1) fail(guard);
  time.advance(30_000);

  const trial = guard.admit('trial-1');
  assert.equal(trial.allowed, true);
  assert.equal(trial.trial, true);
  assert.equal(guard.admit('r').code, 'AI_UNAVAILABLE');
  trial.finish(AI_OUTCOME.failure);
  assert.equal(guard.snapshot().state, 'open');
  assert.equal(guard.admit('r').code, 'AI_UNAVAILABLE');

  time.advance(30_000);
  guard.admit('trial-2').finish(AI_OUTCOME.success);
  assert.deepEqual(guard.snapshot(), { state: 'closed', consecutiveFailures: 0, inFlight: 0, maxConcurrent: 2 });
  assert.deepEqual(logs.map(({ from, to }) => `${from}>${to}`),
    ['closed>open', 'open>half_open', 'half_open>open', 'open>half_open', 'half_open>closed']);
});

test('a neutral trial frees the slot without changing state', () => {
  const { guard, time } = guardWith();
  for (let index = 0; index < 3; index += 1) fail(guard);
  time.advance(30_000);
  guard.admit('r').finish(AI_OUTCOME.neutral);
  assert.equal(guard.snapshot().state, 'half_open');
  assert.equal(guard.admit('r').allowed, true);
});

test('a late success cannot end the cooldown', () => {
  const { guard, logs } = guardWith({ failureThreshold: 1 });
  const pending = guard.admit('late-success');
  fail(guard);

  pending.finish(AI_OUTCOME.success);

  assert.deepEqual(guard.snapshot(), { state: 'open', consecutiveFailures: 1, inFlight: 0, maxConcurrent: 2 });
  assert.deepEqual(guard.admit('r'), { allowed: false, code: 'AI_UNAVAILABLE', retryAfterSeconds: 30 });
  assert.deepEqual(logs.map(({ from, to }) => [from, to]), [['closed', 'open']]);
});

test('late failures cannot interrupt a trial or reopen a recovered circuit', () => {
  const { guard, time } = guardWith({ failureThreshold: 1, maxConcurrent: 3 });
  const pendingDuringTrial = guard.admit('late-during-trial');
  const pendingAfterRecovery = guard.admit('late-after-recovery');
  fail(guard);
  time.advance(30_000);

  const trial = guard.admit('trial');
  assert.equal(trial.trial, true);
  pendingDuringTrial.finish(AI_OUTCOME.failure);
  assert.deepEqual(guard.snapshot(), { state: 'half_open', consecutiveFailures: 1, inFlight: 2, maxConcurrent: 3 });
  assert.equal(guard.admit('r').code, 'AI_UNAVAILABLE');

  trial.finish(AI_OUTCOME.success);
  pendingAfterRecovery.finish(AI_OUTCOME.failure);
  assert.deepEqual(guard.snapshot(), { state: 'closed', consecutiveFailures: 0, inFlight: 0, maxConcurrent: 3 });
});

test('bulkhead caps calls in flight and frees a slot when one finishes', () => {
  const { guard } = guardWith();
  const first = guard.admit('a');
  const second = guard.admit('b');
  assert.equal(guard.snapshot().inFlight, 2);
  assert.deepEqual(guard.admit('c'), { allowed: false, code: 'AI_BUSY', retryAfterSeconds: 5 });
  first.finish(AI_OUTCOME.success);
  first.finish(AI_OUTCOME.success);
  assert.equal(guard.snapshot().inFlight, 1);
  assert.equal(guard.admit('c').allowed, true);
  second.finish(AI_OUTCOME.neutral);
});
