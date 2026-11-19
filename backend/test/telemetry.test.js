import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { migrate } from '../scripts/database-tasks.js';
import { createApp } from '../src/app.js';
import { metricsRepository } from '../src/metrics.js';
import { createTelemetryLogger, createTelemetryRecorder } from '../src/telemetry.js';

const token = 'ops-token-for-tests-0123456789abcdef';
let db;
let pool;

before(async () => {
  db = new PGlite();
  pool = { query: (sql, params) => params || !sql.includes(';')
    ? db.query(sql, params) : db.exec(sql).then((results) => results.at(-1)) };
  await migrate(pool);
});
after(async () => db?.close());

async function reset() {
  await pool.query('DELETE FROM public.request_metrics');
  await pool.query('DELETE FROM public.ai_call_metrics');
  await pool.query('DELETE FROM public.ai_result_metrics');
  await pool.query("UPDATE public.ai_request_hourly_budget SET hour_start = date_trunc('hour', now()), request_count = 0");
}

const httpLine = (route, durationMs, status = 200, extra = {}) => ({
  event: 'http_request', requestId: `r-${route}-${durationMs}`, method: 'GET', route, status, aborted: false, durationMs,
  spans: [{ id: 1, parentId: null, name: 'db.query', startMs: 1, durationMs: 2, status: 'ok' }], ...extra,
});

test('records log events in batches and summarizes the golden and AI signals', async () => {
  await reset();
  const recorder = createTelemetryRecorder({ pool, flushMs: 0, logger: {} });
  const logger = createTelemetryLogger({ info() {} }, recorder);
  for (let index = 1; index <= 19; index += 1) logger.info(JSON.stringify(httpLine('/api/applications', index * 10)));
  logger.info(JSON.stringify(httpLine('/api/applications/:id/analyses', 4600, 201)));
  logger.info(JSON.stringify(httpLine('/api/applications', 50, 500)));
  logger.info(JSON.stringify(httpLine('/health', 99999)));
  logger.info(JSON.stringify(httpLine('/api/ops/metrics', 5)));
  logger.info(JSON.stringify({ event: 'ai_call', requestId: 'a', attempt: 1, status: 200, result: 'success', costUsd: 0.0071, latencyMs: 4210 }));
  logger.info(JSON.stringify({ event: 'ai_call', requestId: 'b', attempt: 1, status: 503, result: 'PROVIDER_ERROR', costUsd: null, latencyMs: 30 }));
  const result = (validation, fallback, checked, matched, costUsd) => logger.info(JSON.stringify({
    event: 'ai_result', outcome: fallback ? 'malformed_output' : 'success', validation, fallback,
    evidenceChecked: checked, evidenceMatched: matched, costUsd, latencyMs: 4000, attempts: 1, retries: 0,
  }));
  result('passed', null, 3, 3, 0.006);
  result('passed_after_repair', null, 3, 2, 0.008);
  result('failed', 'error_response', null, null, 0.007);
  result(null, 'error_response', null, null, null);
  logger.info('plain text, not an event');
  logger.info(JSON.stringify({ event: 'ai_circuit', from: 'closed', to: 'open' }));
  await recorder.flush();

  const { rows: [counts] } = await pool.query(`SELECT
    (SELECT count(*)::integer FROM public.request_metrics) AS requests,
    (SELECT count(*)::integer FROM public.ai_call_metrics) AS calls,
    (SELECT count(*)::integer FROM public.ai_result_metrics) AS results`);
  assert.deepEqual(counts, { requests: 22, calls: 2, results: 4 });

  await pool.query("UPDATE public.ai_request_hourly_budget SET request_count = 15, hour_start = date_trunc('hour', now())");
  const summary = await metricsRepository(pool, { poolStats: () => ({ total: 3, idle: 1, waiting: 0, max: 5 }) }).summary(24);
  assert.equal(summary.golden.requests, 21);
  assert.equal(summary.golden.errorRate, round(1 / 21));
  assert.equal(summary.golden.trafficPerHour, 0.88);
  assert.ok(summary.golden.latencyP95Ms >= 190 && summary.golden.latencyP95Ms <= 4600);
  assert.deepEqual(summary.golden.saturationDetail, { databasePoolInUse: 0.4, databaseWaiting: 0, aiHourlyBudgetUsed: 0.25 });
  assert.equal(summary.golden.saturation, 0.4);
  assert.deepEqual({ ...summary.ai, latencyP95Ms: undefined }, {
    analyses: 4, costPerAnalysisUsd: 0.007, totalCostUsd: 0.0071, providerAttempts: 2,
    invalidOutputRate: round(1 / 3), repairedOutputRate: round(1 / 3), fallbackRate: 0.5,
    evidenceHitRate: round(5 / 6), latencyP95Ms: undefined,
  });
  assert.equal(summary.slowestRequest.route, '/api/applications/:id/analyses');
  assert.equal(summary.slowestRequest.durationMs, 4600);
  assert.equal(summary.slowestRequest.spans[0].name, 'db.query');
});

function round(value) {
  return Math.round(value * 10_000) / 10_000;
}

test('an empty window returns nulls, not errors', async () => {
  await reset();
  const summary = await metricsRepository(pool).summary(1);
  assert.equal(summary.golden.requests, 0);
  assert.equal(summary.golden.latencyP95Ms, null);
  assert.equal(summary.golden.errorRate, null);
  assert.equal(summary.ai.costPerAnalysisUsd, null);
  assert.equal(summary.ai.invalidOutputRate, null);
  assert.equal(summary.slowestRequest, null);
});

test('rows older than the retention period are deleted', async () => {
  await reset();
  await pool.query(`INSERT INTO public.request_metrics (recorded_at, method, route, duration_ms)
    VALUES (now() - interval '15 days', 'GET', '/old', 1), (now() - interval '13 days', 'GET', '/recent', 1)`);
  const recorder = createTelemetryRecorder({ pool, flushMs: 0, logger: {} });
  await recorder.flush();
  const { rows } = await pool.query('SELECT route FROM public.request_metrics');
  assert.deepEqual(rows.map(({ route }) => route), ['/recent']);
});

test('a full buffer drops events and reports how many', async () => {
  await reset();
  const errors = [];
  const recorder = createTelemetryRecorder({ pool, flushMs: 0, maxBuffered: 2, logger: { error: (event) => errors.push(event) } });
  for (let index = 0; index < 5; index += 1) recorder.record(httpLine('/api/x', index));
  await recorder.flush();
  const { rows: [{ count }] } = await pool.query('SELECT count(*)::integer AS count FROM public.request_metrics');
  assert.equal(count, 2);
  assert.deepEqual(errors, [{ event: 'telemetry_dropped', count: 3 }]);
});

test('a store failure drops the batch, warns once, and never throws', async () => {
  const errors = [];
  const failing = { query: async () => { const error = new Error('relation "x" does not exist, secret detail'); error.code = '42P01'; throw error; } };
  const recorder = createTelemetryRecorder({ pool: failing, flushMs: 0, logger: { error: (event) => errors.push(event) } });
  recorder.record(httpLine('/api/x', 1));
  await recorder.flush();
  recorder.record(httpLine('/api/x', 2));
  await recorder.close();
  assert.deepEqual(errors, [{ event: 'telemetry_store_unavailable', type: 'Error', code: '42P01' }]);
});

test('the logger wrapper forwards every call to the base logger', () => {
  const seen = [];
  const recorded = [];
  const logger = createTelemetryLogger({
    info: (...args) => seen.push(['info', ...args]), error: (...args) => seen.push(['error', ...args]),
  }, { record: (event) => recorded.push(event.event) });
  logger.info('{"event":"http_request","route":"/a"}');
  logger.info('{"event": broken');
  logger.error({ event: 'x' });
  logger.warn('no warn on base');
  assert.deepEqual(seen.map(([level]) => level), ['info', 'info', 'error']);
  assert.deepEqual(recorded, ['http_request']);
});

test('GET /api/ops/metrics needs the operations token and is hidden without one', async () => {
  await reset();
  const catalogue = { list: async () => [], requirements: async () => null, ready: async () => {} };
  const metrics = metricsRepository(pool);
  const base = { catalogue, env: {}, logger: { error() {} }, metrics };

  await request(createApp(base)).get('/api/ops/metrics').set('Authorization', `Bearer ${token}`).expect(404);
  await request(createApp({ ...base, opsToken: 'too-short' })).get('/api/ops/metrics').expect(404);

  const app = createApp({ ...base, opsToken: token });
  await request(app).get('/api/ops/metrics').expect(401);
  const wrong = await request(app).get('/api/ops/metrics').set('Authorization', `Bearer ${token}x`).expect(401);
  assert.equal(wrong.body.error.code, 'INVALID_OPS_TOKEN');
  for (const hours of ['0', '169', 'abc', '1.5']) {
    await request(app).get(`/api/ops/metrics?hours=${hours}`).set('Authorization', `Bearer ${token}`).expect(400);
  }
  const ok = await request(app).get('/api/ops/metrics?hours=6').set('Authorization', `Bearer ${token}`).expect(200);
  assert.equal(ok.headers['cache-control'], 'no-store');
  assert.equal(ok.body.data.windowHours, 6);
  assert.ok('golden' in ok.body.data && 'ai' in ok.body.data);

  const broken = createApp({ ...base, opsToken: token, metrics: { summary: async () => { throw new Error('no table'); } } });
  const unavailable = await request(broken).get('/api/ops/metrics').set('Authorization', `Bearer ${token}`).expect(503);
  assert.equal(unavailable.body.error.code, 'METRICS_UNAVAILABLE');
});
