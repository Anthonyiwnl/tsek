import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { createAiRequestBudget } from '../src/ai-request-budget.js';

const user = (n) => `abcdef00-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
let db;
let checkedAt;
let released = Promise.resolve();

function embeddedPool() {
  return {
    async connect() {
      // PGlite uses one physical session. Lease it for an entire transaction,
      // even when independent consumers submit requests at the same time.
      const precedingLease = released;
      let release;
      released = new Promise(resolve => { release = resolve; });
      await precedingLease;
      return {
        async query(sql, params) {
          const result = await db.query(sql, params);
          if (result.rows[0]?.checked_at) result.rows[0].checked_at = new Date(checkedAt);
          return result;
        },
        release,
      };
    },
  };
}

async function globalCount() {
  const { rows } = await db.query('SELECT request_count FROM public.ai_request_hourly_budget');
  return rows[0].request_count;
}

before(async () => {
  db = new PGlite();
  const migration = new URL('../db/migrations/005_ai_request_budget.sql', import.meta.url);
  await db.exec(await readFile(migration, 'utf8'));
  await db.exec("SET TIME ZONE 'Asia/Manila'");
});

beforeEach(async () => {
  checkedAt = '2026-11-12T12:00:15.456Z';
  await db.exec(`
    TRUNCATE public.ai_request_user_budgets;
    UPDATE public.ai_request_hourly_budget SET hour_start = 'epoch', request_count = 0;
  `);
});

after(async () => { await db?.close(); });

test('the minute cap is shared by parallel callers and a new budget instance', async () => {
  const first = createAiRequestBudget(embeddedPool());
  const second = createAiRequestBudget(embeddedPool());
  const outcomes = await Promise.all(Array.from({ length: 8 }, (_, n) => (
    n % 2 ? first(user(1)) : second(user(1).toUpperCase())
  )));
  assert.equal(outcomes.filter(result => result.allowed).length, 3);
  for (const result of outcomes.filter(result => !result.allowed)) {
    assert.deepEqual(result, { allowed: false, retryAfterSeconds: 45 });
  }

  const restarted = createAiRequestBudget(embeddedPool());
  assert.deepEqual(await restarted(user(1)), { allowed: false, retryAfterSeconds: 45 });
  assert.deepEqual(await restarted(user(2)), { allowed: true });
  assert.equal(await globalCount(), 4);

  checkedAt = '2026-11-12T12:01:00.000Z';
  assert.deepEqual(await restarted(user(1)), { allowed: true });
  const { rows } = await db.query(`
    SELECT minute_count, day_count FROM public.ai_request_user_budgets WHERE user_id = $1
  `, [user(1)]);
  assert.deepEqual(rows, [{ minute_count: 1, day_count: 4 }]);
});

test('the UTC daily cap wins over a shorter exhausted window and clears at midnight', async () => {
  const consume = createAiRequestBudget(embeddedPool());
  await consume(user(2));
  for (let n = 0; n < 20; n++) {
    const minute = String(Math.floor((n + 1) / 3)).padStart(2, '0');
    checkedAt = `2026-11-12T12:${minute}:15.456Z`;
    assert.deepEqual(await consume(user(1)), { allowed: true });
  }

  assert.deepEqual(await consume(user(1)), { allowed: false, retryAfterSeconds: 42825 });
  assert.equal(await globalCount(), 21);

  checkedAt = '2026-11-13T00:00:00.000Z';
  assert.deepEqual(await consume(user(1)), { allowed: true });
  const { rows } = await db.query('SELECT user_id, day_count FROM public.ai_request_user_budgets');
  assert.deepEqual(rows, [{ user_id: user(1), day_count: 1 }]);
  assert.equal(await globalCount(), 1);
});

test('the global hourly cap applies across users and leaves a rejected user uncharged', async () => {
  const first = createAiRequestBudget(embeddedPool());
  const second = createAiRequestBudget(embeddedPool());
  const outcomes = await Promise.all(Array.from({ length: 62 }, (_, n) => (
    n % 2 ? first(user(n)) : second(user(n))
  )));
  assert.equal(outcomes.filter(result => result.allowed).length, 60);
  for (const result of outcomes.filter(result => !result.allowed)) {
    assert.deepEqual(result, { allowed: false, retryAfterSeconds: 3585 });
  }
  const rejected = outcomes.findIndex(result => !result.allowed);
  const result = await db.query('SELECT day_count FROM public.ai_request_user_budgets WHERE user_id = $1', [user(rejected)]);
  assert.deepEqual(result.rows, []);
  assert.equal(await globalCount(), 60);

  checkedAt = '2026-11-12T13:00:00.000Z';
  assert.deepEqual(await second(user(rejected)), { allowed: true });
  assert.equal(await globalCount(), 1);
});

test('a database failure rolls back both the hourly charge and daily pruning', async () => {
  const consume = createAiRequestBudget(embeddedPool());
  assert.deepEqual(await consume(user(1)), { allowed: true });
  checkedAt = '2026-11-13T00:00:00.000Z';
  // Reject only new writes so the previous day's stored usage remains present.
  await db.exec(`ALTER TABLE public.ai_request_user_budgets
    ADD CONSTRAINT test_budget_check CHECK (day_start < '2026-11-13T00:00:00Z')`);
  try {
    await assert.rejects(consume(user(2)), { code: '23514' });
    assert.equal(await globalCount(), 1);
    const { rows } = await db.query('SELECT user_id FROM public.ai_request_user_budgets');
    assert.deepEqual(rows, [{ user_id: user(1) }]);
  } finally {
    await db.exec('ALTER TABLE public.ai_request_user_budgets DROP CONSTRAINT test_budget_check');
  }
  assert.deepEqual(await consume(user(2)), { allowed: true });
});
