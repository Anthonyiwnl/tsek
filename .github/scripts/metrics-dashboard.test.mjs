import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDashboard, waterfall } from './metrics-dashboard.mjs';

const data = {
  windowHours: 24,
  generatedAt: '2026-11-18T09:17:03.000Z',
  golden: {
    latencyP95Ms: 6100, latencyP50Ms: 120, trafficPerHour: 140, requests: 3360, errorRate: 0.012, saturation: 0.35,
    saturationDetail: { databasePoolInUse: 0.2, databaseWaiting: 0, aiHourlyBudgetUsed: 0.35 },
  },
  ai: {
    analyses: 40, costPerAnalysisUsd: 0.007, totalCostUsd: 0.31, providerAttempts: 44, invalidOutputRate: 0.025,
    repairedOutputRate: 0.05, fallbackRate: 0.008, evidenceHitRate: 0.91, latencyP95Ms: 4300,
  },
  slowestRequest: {
    method: 'POST', route: '/api/applications/:id/analyses', status: 201, durationMs: 4600, at: '2026-11-18T08:00:00.000Z',
    spans: [
      { id: 1, parentId: null, name: 'db.query', startMs: 0, durationMs: 40, status: 'ok' },
      { id: 2, parentId: null, name: 'ai.extract', startMs: 160, durationMs: 4200, status: 'ok' },
      { id: 3, parentId: 2, name: 'gen_ai.chat', startMs: 161, durationMs: 4190, status: 'error' },
      { id: 4, parentId: null, name: 'ai.validate', startMs: 4370, durationMs: 20, status: 'ok' },
    ],
  },
};

test('renders the eight signals the way the course dashboard shows them', () => {
  const markdown = renderDashboard({ data });
  for (const expected of ['| Latency, p95 | 6.1 s | Cost per analysis | $0.0070 |', '| Traffic | 140 req/h (3360 total) | Invalid output | 2.5 % |',
    '| Error rate (5xx) | 1.2 % | Fallback rate | 0.8 % |', '| Saturation | 35 % | Evidence hit rate | 91 % |',
    'Last 24 h, generated 2026-11-18 09:17 UTC', '$0.31 total']) {
    assert.ok(markdown.includes(expected), expected);
  }
});

test('the waterfall indents child spans, scales bars and flags errors', () => {
  const lines = waterfall(data.slowestRequest, 20).split('\n');
  assert.equal(lines.length, 5);
  assert.match(lines[0], /^POST \/api\/applications\/:id\/analyses │█{20}│ 4\.6 s$/);
  assert.match(lines[2], /^ai\.extract +│ █{18} +│ 4\.2 s$/);
  assert.match(lines[3], /^  gen_ai\.chat +│ █{18} +│ 4\.2 s error$/);
  assert.match(lines[4], /^ai\.validate +│ {19}█│ 20 ms$/);
});

test('empty windows show dashes instead of failing', () => {
  const markdown = renderDashboard({ data: {
    windowHours: 1, generatedAt: '2026-11-18T09:17:03.000Z',
    golden: { latencyP95Ms: null, trafficPerHour: 0, requests: 0, errorRate: null, saturation: null, saturationDetail: {} },
    ai: { analyses: 0, costPerAnalysisUsd: null, totalCostUsd: 0, invalidOutputRate: null, fallbackRate: null, evidenceHitRate: null },
    slowestRequest: null,
  } });
  assert.ok(markdown.includes('| Latency, p95 | — | Cost per analysis | — |'));
  assert.ok(markdown.includes('No user requests in this window yet.'));
});
