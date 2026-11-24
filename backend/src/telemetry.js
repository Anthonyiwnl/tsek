/**
 * Keep the request and AI log lines in PostgreSQL so the operations dashboard
 * can count them across restarts (Render's free tier keeps no metrics).
 *
 * The logger wrapper copies three structured log events into a bounded
 * in-memory buffer; a timer writes the buffer in one INSERT per table every
 * few seconds, so recording never adds a database round trip to a request and
 * never competes with it for a pooled connection. If the tables are missing or
 * the database is down, the batch is dropped and one warning is logged: the
 * dashboard is best-effort and must never break the API.
 */

const tables = {
  http_request: {
    table: 'request_metrics',
    columns: {
      recorded_at: 'timestamptz', request_id: 'text', method: 'text', route: 'text', status: 'smallint',
      aborted: 'boolean', duration_ms: 'double precision', spans: 'jsonb',
    },
    row: (event) => ({
      request_id: text(event.requestId),
      method: text(event.method) ?? 'UNKNOWN',
      route: text(event.route) ?? 'unmatched',
      status: integer(event.status),
      aborted: event.aborted === true,
      duration_ms: number(event.durationMs) ?? 0,
      spans: Array.isArray(event.spans) ? event.spans : [],
    }),
  },
  ai_call: {
    table: 'ai_call_metrics',
    columns: {
      recorded_at: 'timestamptz', request_id: 'text', prompt_version: 'text', model: 'text', attempt: 'smallint',
      http_status: 'smallint', result: 'text', input_tokens: 'integer', output_tokens: 'integer',
      cost_usd: 'numeric', latency_ms: 'double precision',
    },
    row: (event) => ({
      request_id: text(event.requestId),
      prompt_version: text(event.promptVersion),
      model: text(event.model),
      attempt: integer(event.attempt),
      http_status: integer(event.status),
      result: text(event.result),
      input_tokens: integer(event.inputTokens),
      output_tokens: integer(event.outputTokens),
      cost_usd: number(event.costUsd),
      latency_ms: number(event.latencyMs),
    }),
  },
  ai_result: {
    table: 'ai_result_metrics',
    columns: {
      recorded_at: 'timestamptz', request_id: 'text', prompt_version: 'text', model: 'text', outcome: 'text',
      code: 'text', validation: 'text', evidence_checked: 'integer', evidence_matched: 'integer',
      attempts: 'smallint', retries: 'smallint', cost_usd: 'numeric', fallback: 'text', latency_ms: 'double precision',
    },
    row: (event) => ({
      request_id: text(event.requestId),
      prompt_version: text(event.promptVersion),
      model: text(event.model),
      outcome: text(event.outcome),
      code: text(event.code),
      validation: text(event.validation),
      evidence_checked: integer(event.evidenceChecked),
      evidence_matched: integer(event.evidenceMatched),
      attempts: integer(event.attempts),
      retries: integer(event.retries),
      cost_usd: number(event.costUsd),
      fallback: text(event.fallback),
      latency_ms: number(event.latencyMs),
    }),
  },
};

function text(value) {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 200) : null;
}
function number(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function integer(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647 ? value : null;
}

/** Requests to these routes are not user traffic and are not recorded. */
const ignoredRoutes = /^\/api\/ops(\/|$)/;

export function createTelemetryRecorder({
  pool,
  flushMs = 10_000,
  maxBuffered = 500,
  retentionDays = 14,
  logger = console,
  now = () => new Date(),
} = {}) {
  const buffers = Object.fromEntries(Object.keys(tables).map((event) => [event, []]));
  let dropped = 0;
  let warned = false;
  let lastPrune = 0;
  let flushing = Promise.resolve();

  async function write() {
    for (const [event, spec] of Object.entries(tables)) {
      const rows = buffers[event].splice(0);
      if (!rows.length) continue;
      const columns = Object.keys(spec.columns);
      const definition = Object.entries(spec.columns).map(([name, type]) => `${name} ${type}`).join(', ');
      // One parameter for the whole batch: jsonb_to_recordset types every column.
      await pool.query(
        `INSERT INTO public.${spec.table} (${columns.join(', ')})
         SELECT ${columns.join(', ')} FROM jsonb_to_recordset($1::jsonb) AS batch(${definition})`,
        [JSON.stringify(rows)],
      );
    }
    const time = now().getTime();
    if (time - lastPrune >= 60 * 60 * 1000) {
      lastPrune = time;
      for (const { table } of Object.values(tables)) {
        await pool.query(
          `DELETE FROM public.${table} WHERE recorded_at < $1::timestamptz - make_interval(days => $2::integer)`,
          [now().toISOString(), retentionDays],
        );
      }
    }
  }

  function flush() {
    flushing = flushing.then(async () => {
      try {
        await write();
        warned = false;
      } catch (error) {
        for (const buffer of Object.values(buffers)) buffer.length = 0;
        if (!warned) {
          warned = true;
          logger?.error?.({
            event: 'telemetry_store_unavailable',
            type: error?.name,
            ...(typeof error?.code === 'string' ? { code: error.code } : {}),
          });
        }
      }
      if (dropped) {
        logger?.error?.({ event: 'telemetry_dropped', count: dropped });
        dropped = 0;
      }
    });
    return flushing;
  }

  const timer = flushMs > 0 ? setInterval(flush, flushMs) : null;
  timer?.unref?.();

  return {
    /** Buffer one structured log event; ignores events the dashboard does not use. */
    record(event) {
      const spec = tables[event?.event];
      if (!spec) return;
      if (event.event === 'http_request' && ignoredRoutes.test(event.route ?? '')) return;
      const buffered = Object.values(buffers).reduce((total, buffer) => total + buffer.length, 0);
      if (buffered >= maxBuffered) {
        dropped += 1;
        return;
      }
      buffers[event.event].push({ recorded_at: now().toISOString(), ...spec.row(event) });
    },
    flush,
    /** Stop the timer and write what is left; call before closing the pool. */
    async close() {
      if (timer) clearInterval(timer);
      await flush();
    },
  };
}

/**
 * Wrap a console-like logger: every call still goes to `base`, and `info`
 * lines that are JSON log events are also handed to the recorder.
 */
export function createTelemetryLogger(base, recorder) {
  return {
    ...Object.fromEntries(['log', 'warn', 'error', 'debug'].map((level) => [level, (...args) => base?.[level]?.(...args)])),
    info(...args) {
      base?.info?.(...args);
      const [line] = args;
      if (typeof line !== 'string' || !line.startsWith('{"event":')) return;
      try {
        recorder.record(JSON.parse(line));
      } catch {
        // Not a structured event; nothing to record.
      }
    },
  };
}
