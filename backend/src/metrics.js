import { createHash, timingSafeEqual } from 'node:crypto';

// Golden signals describe user traffic, so health checks and this route are left out.
const userTraffic = `route NOT LIKE '/health%' AND route NOT LIKE '/api/ops%' AND method <> 'OPTIONS'`;
const AI_HOURLY_LIMIT = 60;
const round = (value, digits = 4) => (value === null || value === undefined ? null
  : Math.round(Number(value) * 10 ** digits) / 10 ** digits);
const ratio = (part, whole) => (Number(whole) > 0 ? round(Number(part) / Number(whole)) : null);

/**
 * Read the four golden signals (any web service) and four AI signals (this
 * course's additions) for the last `hours` from the telemetry tables.
 */
export function metricsRepository(pool, { poolStats } = {}) {
  return {
    async summary(hours = 24) {
      const since = `now() - make_interval(hours => $1::integer)`;
      const [{ rows: [requests] }, { rows: [slowest] }, { rows: [results] }, { rows: [calls] }, { rows: [budget] }] = await Promise.all([
        pool.query(`
          SELECT count(*)::integer AS total,
            count(*) FILTER (WHERE status >= 500 OR status IS NULL)::integer AS errors,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95
          FROM public.request_metrics WHERE recorded_at >= ${since} AND ${userTraffic}`, [hours]),
        pool.query(`
          SELECT route, method, status, duration_ms, spans, recorded_at
          FROM public.request_metrics WHERE recorded_at >= ${since} AND ${userTraffic}
          ORDER BY duration_ms DESC LIMIT 1`, [hours]),
        pool.query(`
          SELECT count(*)::integer AS analyses,
            count(*) FILTER (WHERE validation IS NOT NULL)::integer AS replies,
            count(*) FILTER (WHERE validation = 'failed')::integer AS invalid,
            count(*) FILTER (WHERE validation = 'passed_after_repair')::integer AS repaired,
            count(*) FILTER (WHERE fallback IS NOT NULL)::integer AS fallbacks,
            coalesce(sum(evidence_checked), 0)::integer AS checked,
            coalesce(sum(evidence_matched), 0)::integer AS matched,
            avg(cost_usd) AS cost_per_analysis,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
          FROM public.ai_result_metrics WHERE recorded_at >= ${since}`, [hours]),
        pool.query(`
          SELECT count(*)::integer AS attempts, coalesce(sum(cost_usd), 0) AS cost
          FROM public.ai_call_metrics WHERE recorded_at >= ${since}`, [hours]),
        pool.query(`
          SELECT request_count, hour_start = date_trunc('hour', now()) AS current
          FROM public.ai_request_hourly_budget WHERE singleton`),
      ]);

      const db = poolStats?.() ?? null;
      const dbInUse = db?.max ? ratio(db.total - db.idle, db.max) : null;
      const aiBudgetUsed = budget ? ratio(budget.current ? budget.request_count : 0, AI_HOURLY_LIMIT) : null;
      const saturation = [dbInUse, aiBudgetUsed].filter((value) => value !== null);

      return {
        windowHours: hours,
        generatedAt: new Date().toISOString(),
        golden: {
          latencyP95Ms: round(requests.p95, 1),
          latencyP50Ms: round(requests.p50, 1),
          trafficPerHour: round(requests.total / hours, 2),
          requests: requests.total,
          errorRate: ratio(requests.errors, requests.total),
          saturation: saturation.length ? Math.max(...saturation) : null,
          saturationDetail: {
            databasePoolInUse: dbInUse,
            databaseWaiting: db?.waiting ?? null,
            aiHourlyBudgetUsed: aiBudgetUsed,
          },
        },
        ai: {
          analyses: results.analyses,
          costPerAnalysisUsd: round(results.cost_per_analysis, 6),
          totalCostUsd: round(calls.cost, 6),
          providerAttempts: calls.attempts,
          invalidOutputRate: ratio(results.invalid, results.replies),
          repairedOutputRate: ratio(results.repaired, results.replies),
          fallbackRate: ratio(results.fallbacks, results.analyses),
          evidenceHitRate: ratio(results.matched, results.checked),
          latencyP95Ms: round(results.p95, 1),
        },
        slowestRequest: slowest ? {
          method: slowest.method,
          route: slowest.route,
          status: slowest.status,
          durationMs: round(slowest.duration_ms, 1),
          at: new Date(slowest.recorded_at).toISOString(),
          spans: slowest.spans,
        } : null,
      };
    },
  };
}

function digest(value) {
  return createHash('sha256').update(value).digest();
}

/**
 * GET /api/ops/metrics, for the uptime workflow. It uses its own bearer token
 * (OPS_METRICS_TOKEN, at least 32 characters), not a user's sign-in, and
 * answers 404 when no token is configured, so the route is invisible.
 */
export function registerOpsRoutes(app, { metrics, token, logger = console }) {
  const configured = typeof token === 'string' && token.length >= 32;
  app.get('/api/ops/metrics', async (req, res, next) => {
    if (!configured || !metrics) return next();
    res.set('Cache-Control', 'no-store');
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '');
    if (!match || !timingSafeEqual(digest(match[1]), digest(token))) {
      return res.status(401).json({ error: { code: 'INVALID_OPS_TOKEN', message: 'A valid operations token is required.' } });
    }
    const raw = req.query.hours ?? '24';
    const hours = typeof raw === 'string' && /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
      return res.status(400).json({ error: { code: 'INVALID_QUERY', message: 'hours must be an integer from 1 to 168.' } });
    }
    try {
      res.json({ data: await metrics.summary(hours) });
    } catch (error) {
      logger.error({ requestId: req.requestId, event: 'metrics_unavailable', type: error?.name,
        ...(typeof error?.code === 'string' ? { code: error.code } : {}) });
      res.status(503).json({ error: { code: 'METRICS_UNAVAILABLE', message: 'Metrics are unavailable. Apply migration 007.' } });
    }
  });
}
