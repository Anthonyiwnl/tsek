import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();
const MAX_SPANS = 100;
const SQL_OPERATIONS = new Set([
  'ALTER', 'BEGIN', 'COMMIT', 'CREATE', 'DELETE', 'DROP', 'INSERT', 'ROLLBACK',
  'SELECT', 'SET', 'TRUNCATE', 'UPDATE', 'WITH',
]);
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
    span['error.type'] = error?.constructor?.name ?? 'Error';
    throw error;
  } finally {
    span.durationMs = elapsed(started);
  }
}

/** Only use the registered route pattern. Express expands router mount params in baseUrl. */
function routePattern(req) {
  return typeof req.route?.path === 'string' ? req.route.path : 'unmatched';
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

/** Recognized SQL command for a span attribute. Unrecognized text is not recorded. */
export function sqlOperation(text) {
  const command = typeof text === 'string' ? /^\s*([A-Za-z]+)\b/.exec(text)?.[1].toUpperCase() : undefined;
  return SQL_OPERATIONS.has(command) ? command : 'UNKNOWN';
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
    return withSpan('db.query', { 'db.system.name': 'postgresql', 'db.operation.name': sqlOperation(text) },
      () => query.call(this, config, ...rest));
  };
  const instrumented = new WeakSet();
  pool.query = traced(pool.query);
  const connect = pool.connect;
  pool.connect = async function tracedConnect(...args) {
    if (typeof args.at(-1) === 'function') return connect.apply(this, args);
    const client = await withSpan('db.connect', { 'db.system.name': 'postgresql' }, () => connect.apply(this, args));
    if (!instrumented.has(client)) {
      instrumented.add(client);
      client.query = traced(client.query);
    }
    return client;
  };
  return pool;
}
