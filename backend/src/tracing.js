import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();
const MAX_SPANS = 100;
const elapsed = (from) => Math.round((performance.now() - from) * 10) / 10;

/**
 * Run `fn` as one named step (span) of the current request's trace. Outside a
 * request it just runs `fn`. Spans nest: a span opened inside another records
 * it as its parent. Attributes must never hold SQL text, document text, tokens
 * or personal data.
 */
export async function withSpan(name, attributes, fn) {
  const context = storage.getStore();
  if (!context) return fn();
  const { trace, parentId } = context;
  if (trace.spans.length >= MAX_SPANS) {
    trace.droppedSpans += 1;
    return fn();
  }
  const started = performance.now();
  const span = {
    id: trace.spans.length + 1,
    parentId,
    name,
    startMs: elapsed(trace.started),
    durationMs: null,
    status: 'ok',
    ...attributes,
  };
  trace.spans.push(span);
  try {
    return await storage.run({ trace, parentId: span.id }, fn);
  } catch (error) {
    span.status = 'error';
    span.errorType = error?.name ?? 'Error';
    throw error;
  } finally {
    span.durationMs = elapsed(started);
  }
}

/** The route pattern that matched, never the raw URL, so IDs and query strings stay out of logs. */
function routePattern(req) {
  if (req.route?.path) return `${req.baseUrl || ''}${req.route.path}`;
  if (req.baseUrl) return `${req.baseUrl}/*`;
  return 'unmatched';
}

/**
 * Express middleware: one structured `http_request` log line per request with
 * its status, duration and spans, all joined by the request ID. Must run after
 * the middleware that sets `req.requestId`.
 */
export function requestTracing({ logger = console } = {}) {
  return (req, res, next) => {
    const trace = { started: performance.now(), spans: [], droppedSpans: 0 };
    let logged = false;
    const finish = () => {
      if (logged) return;
      logged = true;
      logger?.info?.(JSON.stringify({
        event: 'http_request',
        requestId: req.requestId ?? null,
        method: req.method,
        route: routePattern(req),
        status: res.headersSent ? res.statusCode : null,
        aborted: !res.writableFinished,
        durationMs: elapsed(trace.started),
        spans: trace.spans,
        ...(trace.droppedSpans && { droppedSpans: trace.droppedSpans }),
      }));
    };
    res.once('finish', finish);
    res.once('close', finish);
    storage.run({ trace, parentId: null }, next);
  };
}

/** The leading SQL keyword (SELECT, INSERT, …) for a span attribute; never the statement. */
export function sqlOperation(text) {
  const match = typeof text === 'string' ? /^\s*([A-Za-z]+)/.exec(text) : null;
  return match ? match[1].toUpperCase() : 'UNKNOWN';
}

/**
 * Time every query on a `pg` pool, and on clients it hands out, as a `db.query` span.
 * Returns the same pool.
 */
export function instrumentPool(pool) {
  const traced = (query) => function tracedQuery(config, ...rest) {
    const text = typeof config === 'string' ? config : config?.text;
    // Callback-style calls are left untouched; the backend only uses promises.
    if (typeof rest.at(-1) === 'function' || typeof config?.submit === 'function') {
      return query.call(this, config, ...rest);
    }
    return withSpan('db.query', { 'db.system': 'postgresql', 'db.operation': sqlOperation(text) },
      () => query.call(this, config, ...rest));
  };
  const instrumented = new WeakSet();
  pool.query = traced(pool.query);
  const connect = pool.connect;
  pool.connect = async function tracedConnect(...args) {
    if (typeof args.at(-1) === 'function') return connect.apply(this, args);
    const client = await withSpan('db.connect', { 'db.system': 'postgresql' }, () => connect.apply(this, args));
    if (!instrumented.has(client)) {
      instrumented.add(client);
      client.query = traced(client.query);
    }
    return client;
  };
  return pool;
}
