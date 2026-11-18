import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { instrumentPool, requestTracing, sqlOperation, withSpan } from '../src/tracing.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function tracedApp(routes) {
  const logs = [];
  const app = express();
  app.use((req, _res, next) => { req.requestId = 'trace-request'; next(); });
  app.use(requestTracing({ logger: { info: (line) => logs.push(JSON.parse(line)) } }));
  routes(app);
  return { app, logs };
}

test('outside a request, withSpan only runs the function', async () => {
  assert.equal(await withSpan('db.query', {}, async () => 42), 42);
});

test('logs one http_request line with the route pattern, status and nested spans', async () => {
  const { app, logs } = tracedApp((app) => {
    app.get('/api/things/:id', async (req, res) => {
      await withSpan('db.query', { 'db.operation.name': 'SELECT' }, () => sleep(5));
      await withSpan('ai.extract', {}, () => withSpan('gen_ai.chat', { attempt: 1 }, () => sleep(10)));
      res.json({ id: req.params.id });
    });
  });
  await request(app).get('/api/things/7f3c0b5e-2c71-4f7b-9a61-0b0f1f6d4a11?secret=x').expect(200);
  assert.equal(logs.length, 1);
  const [line] = logs;
  assert.equal(line.event, 'http_request');
  assert.equal(line.requestId, 'trace-request');
  assert.equal(line.method, 'GET');
  assert.equal(line.route, '/api/things/:id');
  assert.equal(line.status, 200);
  assert.equal(line.aborted, false);
  assert.doesNotMatch(JSON.stringify(line), /7f3c0b5e|secret/);
  assert.deepEqual(line.spans.map(({ id, parentId, name, status }) => [id, parentId, name, status]), [
    [1, null, 'db.query', 'ok'], [2, null, 'ai.extract', 'ok'], [3, 2, 'gen_ai.chat', 'ok'],
  ]);
  const [db, extract, chat] = line.spans;
  assert.equal(db['db.operation.name'], 'SELECT');
  assert.equal(chat.attempt, 1);
  assert.ok(db.durationMs >= 4 && chat.durationMs >= 9);
  assert.ok(extract.startMs >= db.startMs + db.durationMs - 1);
  assert.ok(chat.startMs >= extract.startMs && extract.durationMs >= chat.durationMs);
  assert.ok(line.durationMs >= extract.startMs + extract.durationMs - 1);
});

test('marks a failed span with its error name and still logs the request', async () => {
  const { app, logs } = tracedApp((app) => {
    app.get('/fails', async () => {
      await withSpan('db.query', {}, async () => {
        const error = new TypeError('connection detail');
        error.name = 'private request detail';
        throw error;
      });
    });
    app.use((_error, _req, res, _next) => res.status(500).json({ error: 'x' }));
  });
  await request(app).get('/fails').expect(500);
  assert.equal(logs[0].status, 500);
  assert.equal(logs[0].route, '/fails');
  assert.deepEqual(logs[0].spans.map((span) => [span.status, span['error.type']]), [['error', 'TypeError']]);
  assert.doesNotMatch(JSON.stringify(logs), /connection detail|private request detail/);
});

test('concurrent requests keep their own spans', async () => {
  const { promise: bothStarted, resolve: release } = Promise.withResolvers();
  let started = 0;
  const overlap = async (delay) => {
    started += 1;
    if (started === 2) release();
    await bothStarted;
    await sleep(delay);
  };
  const { app, logs } = tracedApp((app) => {
    app.get('/slow', async (_req, res) => {
      await withSpan('step-slow', {}, () => overlap(20));
      res.end();
    });
    app.get('/fast', async (_req, res) => {
      await withSpan('step-fast', {}, () => overlap(5));
      res.end();
    });
  });
  await Promise.all([
    request(app).get('/slow').timeout({ deadline: 5000 }).expect(200),
    request(app).get('/fast').timeout({ deadline: 5000 }).expect(200),
  ]);
  assert.deepEqual(logs.map(({ route, spans }) => [route, spans.map(({ name }) => name)]).sort(), [
    ['/fast', ['step-fast']], ['/slow', ['step-slow']],
  ]);
});

test('route logs omit resolved router mount parameters and unmatched paths', async () => {
  const { app, logs } = tracedApp((app) => {
    app.use('/api/admin', (_req, res) => res.status(403).end());
    const router = express.Router();
    router.get('/details/:detailId', (_req, res) => res.end());
    app.use('/accounts/:accountId', router);
    app.use('/private/:accountId', (_req, res) => res.status(403).end());
  });
  await request(app).get('/api/admin/applications/123').expect(403);
  await request(app).get('/accounts/account-secret/details/detail-secret').expect(200);
  await request(app).get('/private/blocked-secret').expect(403);
  await request(app).get('/nothing/here').expect(404);
  assert.deepEqual(logs.map(({ route, status }) => [route, status]), [
    ['unmatched', 403], ['/details/:detailId', 200], ['unmatched', 403], ['unmatched', 404],
  ]);
  assert.doesNotMatch(JSON.stringify(logs), /applications\/123|account-secret|detail-secret|blocked-secret|nothing/);
});

test('CORS preflights are traced and cross-origin responses expose the request ID', async () => {
  const logs = [];
  const origin = 'https://example.test';
  const app = createApp({ env: {}, origin, logger: {
    error: () => assert.fail('The test requests should not report an error'),
    info: line => logs.push(JSON.parse(line)),
  } });

  const preflight = await request(app).options('/api/applications/private-id?secret=x')
    .set('Origin', origin).set('Access-Control-Request-Method', 'GET').expect(204);
  const health = await request(app).get('/health').set('Origin', origin).expect(200);

  assert.equal(logs.length, 2);
  assert.ok(preflight.headers['x-request-id']);
  assert.equal(logs[0].requestId, preflight.headers['x-request-id']);
  assert.equal(logs[0].method, 'OPTIONS');
  assert.equal(logs[0].route, 'unmatched');
  assert.equal(logs[0].status, 204);
  assert.equal(logs[1].requestId, health.headers['x-request-id']);
  assert.match(health.headers['access-control-expose-headers'], /\bX-Request-Id\b/i);
  assert.doesNotMatch(JSON.stringify(logs), /private-id|secret/);
});

test('caps spans per request and counts the rest', async () => {
  const { app, logs } = tracedApp((app) => {
    app.get('/many', async (_req, res) => {
      for (let index = 0; index < 105; index += 1) await withSpan('db.query', {}, async () => {});
      res.end();
    });
  });
  await request(app).get('/many').expect(200);
  assert.equal(logs[0].spans.length, 100);
  assert.equal(logs[0].droppedSpans, 5);
});

test('sqlOperation records only recognized commands', () => {
  assert.equal(sqlOperation("  select * from users where email = 'a@b.c'"), 'SELECT');
  assert.equal(sqlOperation('WITH charged AS (UPDATE x)'), 'WITH');
  assert.equal(sqlOperation({ text: 'SELECT 1' }), 'UNKNOWN');
  assert.equal(sqlOperation(''), 'UNKNOWN');
  assert.equal(sqlOperation('privateValue'), 'UNKNOWN');
  assert.equal(sqlOperation('SELECT_secret'), 'UNKNOWN');
});

test('instrumentPool times pool and client queries without logging SQL text', async () => {
  const client = { query: async (text) => ({ rows: [text.length] }), release() {} };
  const callbackCalls = [];
  const pool = {
    query: async () => ({ rows: [] }),
    connect(callback) {
      if (callback) { callbackCalls.push('callback'); return callback(null, client, () => {}); }
      return Promise.resolve(client);
    },
  };
  instrumentPool(pool);
  const { app, logs } = tracedApp((app) => {
    app.get('/db', async (_req, res) => {
      await pool.query('SELECT secret_column FROM private_table WHERE id = $1', ['id-1']);
      const connected = await pool.connect();
      await connected.query('BEGIN');
      await connected.query({ text: 'UPDATE private_table SET x = 1' });
      connected.release();
      const again = await pool.connect();
      await again.query('COMMIT');
      pool.connect(() => {});
      res.end();
    });
  });
  await request(app).get('/db').expect(200);
  assert.deepEqual(logs[0].spans.map((span) => [span.name, span['db.operation.name'] ?? null]), [
    ['db.query', 'SELECT'], ['db.connect', null], ['db.query', 'BEGIN'], ['db.query', 'UPDATE'],
    ['db.connect', null], ['db.query', 'COMMIT'],
  ]);
  assert.ok(logs[0].spans.every(span => span['db.system.name'] === 'postgresql'));
  assert.deepEqual(callbackCalls, ['callback']);
  assert.doesNotMatch(JSON.stringify(logs), /secret_column|private_table|id-1/);
});
