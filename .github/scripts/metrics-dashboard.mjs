// Render the /api/ops/metrics response as a Markdown dashboard for the uptime
// workflow's job summary. Usage: node metrics-dashboard.mjs metrics.json
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const dash = '—';
const percent = (value, digits = 1) => (value === null || value === undefined ? dash : `${(value * 100).toFixed(digits)} %`);
const seconds = (ms) => (ms === null || ms === undefined ? dash : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
const usd = (value) => (value === null || value === undefined ? dash : `$${value.toFixed(value < 0.01 ? 4 : 2)}`);
const count = (value) => (value === null || value === undefined ? dash : String(value));

/** One text bar per span, offset by its start, scaled to the whole request. */
export function waterfall(request, width = 40) {
  const total = Math.max(request.durationMs, 1);
  const spans = (request.spans ?? []).slice(0, 20);
  const depth = new Map();
  const label = (span) => {
    const level = span.parentId ? (depth.get(span.parentId) ?? 0) + 1 : 0;
    depth.set(span.id, level);
    return `${'  '.repeat(level)}${span.name}`;
  };
  const labels = spans.map(label);
  const pad = Math.max(...labels.map((text) => text.length), request.route.length + request.method.length + 1);
  const bar = (start, length) => {
    const offset = Math.min(width - 1, Math.round((start / total) * width));
    const size = Math.max(1, Math.min(width - offset, Math.round((length / total) * width)));
    return `${' '.repeat(offset)}${'█'.repeat(size)}`.padEnd(width);
  };
  const lines = [`${`${request.method} ${request.route}`.padEnd(pad)} │${bar(0, total)}│ ${seconds(request.durationMs)}`];
  spans.forEach((span, index) => {
    const flag = span.status === 'error' ? ' error' : '';
    lines.push(`${labels[index].padEnd(pad)} │${bar(span.startMs, span.durationMs ?? 0)}│ ${seconds(span.durationMs)}${flag}`);
  });
  return lines.join('\n');
}

export function renderDashboard({ data }) {
  const { golden, ai, slowestRequest, windowHours, generatedAt } = data;
  const detail = golden.saturationDetail ?? {};
  const out = [
    `Last ${windowHours} h, generated ${generatedAt.replace('T', ' ').slice(0, 16)} UTC. Health checks are not counted as traffic.`,
    '',
    '| Golden signals (any web service) | Value | AI signals (this course) | Value |',
    '|---|---|---|---|',
    `| Latency, p95 | ${seconds(golden.latencyP95Ms)} | Cost per analysis | ${usd(ai.costPerAnalysisUsd)} |`,
    `| Traffic | ${golden.trafficPerHour ?? dash} req/h (${count(golden.requests)} total) | Invalid output | ${percent(ai.invalidOutputRate)} |`,
    `| Error rate (5xx) | ${percent(golden.errorRate)} | Fallback rate | ${percent(ai.fallbackRate)} |`,
    `| Saturation | ${percent(golden.saturation, 0)} | Evidence hit rate | ${percent(ai.evidenceHitRate, 0)} |`,
    '',
    `Saturation is the higher of database pool in use (${percent(detail.databasePoolInUse, 0)}, ${count(detail.databaseWaiting)} waiting) `
      + `and this hour's shared AI budget used (${percent(detail.aiHourlyBudgetUsed, 0)}). `
      + `AI: ${count(ai.analyses)} analyses, ${count(ai.providerAttempts)} OpenAI attempts, ${usd(ai.totalCostUsd)} total, `
      + `p95 ${seconds(ai.latencyP95Ms)}, ${percent(ai.repairedOutputRate)} repaired (a value not found in the document was removed).`,
  ];
  out.push('', '### Weekly AI–staff agreement (UTC)', '', '| Week | Reviewed requirements | Agreed | Rate |', '|---|---|---|---|');
  for (const row of ai.staffAgreement ?? []) out.push(`| ${String(row.week).slice(0, 10)} | ${count(row.reviewed)} | ${count(row.agreed)} | ${percent(row.agreementRate)} |`);
  out.push('', 'Only explicit requirement reviews are counted. No reviews means no agreement estimate.');
  if (slowestRequest) {
    out.push('', `### Slowest request: where the time went`, '', '```text', waterfall(slowestRequest), '```');
  } else {
    out.push('', 'No user requests in this window yet.');
  }
  return `${out.join('\n')}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.stdout.write(renderDashboard(JSON.parse(readFileSync(process.argv[2], 'utf8'))));
}
