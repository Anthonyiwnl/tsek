import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { migrate, seed } from '../scripts/database-tasks.js';
import { createApp } from '../src/app.js';
import { createEmailProvider, decisionEmailsRepository, emailDailyLimit } from '../src/decision-emails.js';

const owner = '11111111-1111-4111-8111-111111111111';
const reviewer = '22222222-2222-4222-8222-222222222222';
test('disabled emails ignore an invalid optional cap; enabled emails validate it', () => {
  assert.equal(emailDailyLimit(false, 'abc'), 20);
  assert.equal(emailDailyLimit(true, '12'), 12);
  assert.throws(() => emailDailyLimit(true, 'abc'), /daily limit/);
});

test('notification settings retain global IP limits and authenticated write limits', async () => {
  const options = { verifyToken: async () => owner, notifications: { preference: async () => ({ enabled: false }), savePreference: async () => ({ enabled: false }) }, env: {}, logger: { error() {} } };
  const limitedReads = createApp({ ...options, rateLimitOptions: { ipLimit: 1 } });
  await request(limitedReads).get('/api/me/notifications').set('Authorization','Bearer demo').expect(200);
  const readLimit = await request(limitedReads).get('/api/me/notifications').set('Authorization','Bearer demo').expect(429);
  assert.equal(readLimit.body.error.code, 'RATE_LIMITED');
  const limitedWrites = createApp({ ...options, rateLimitOptions: { writeLimit: 1 } });
  await request(limitedWrites).put('/api/me/notifications').set('Authorization','Bearer demo').send({ enabled: false }).expect(200);
  assert.equal((await request(limitedWrites).put('/api/me/notifications').set('Authorization','Bearer demo').send({ enabled: false }).expect(429)).body.error.code,'RATE_LIMITED');
});

test('emails are opt-in, queued once, capped, retried safely, and never roll back decisions', async () => {
  const db = new PGlite();
  const client = { query: (sql, params) => params || !sql.includes(';') ? db.query(sql, params) : db.exec(sql).then(rows => rows.at(-1)) };
  try {
    await migrate(client); await seed(client);
    const sent = [], logs = [];
    let fail = true;
    const service = decisionEmailsRepository(client, work => db.transaction(work), { dailyLimit: 2, logger: { error: row => logs.push(row) }, send: async row => { if (fail) throw new Error('PRIVATE provider detail'); sent.push(row); } });
    const { rows: [type] } = await client.query('SELECT id FROM document_types LIMIT 1');
    const decide = async () => {
      const { rows: [app] } = await client.query("INSERT INTO applications(owner_id, document_type_id, purpose, status) VALUES ($1,$2,'Synthetic','submitted') RETURNING id", [owner, type.id]);
      await client.query("UPDATE applications SET status = 'approved' WHERE id = $1", [app.id]);
      const { rows: [review] } = await client.query("INSERT INTO application_reviews(application_id, reviewer_id, decision, note) VALUES ($1,$2,'approved','Original checked') RETURNING id", [app.id, reviewer]);
      return review.id;
    };
    await decide(); assert.equal((await client.query('SELECT * FROM decision_email_outbox')).rows.length, 0);
    assert.equal(await service.savePreference(owner, true, null), null);
    await service.savePreference(owner, true, 'citizen@example.test');
    const id = await decide();
    await service.tick(); assert.equal(logs.length, 1); assert.ok(!JSON.stringify(logs).includes('PRIVATE'));
    assert.equal((await client.query('SELECT decision FROM application_reviews WHERE id = $1', [id])).rows[0].decision, 'approved');
    fail = false; await service.tick(); assert.equal(sent.length, 0, 'backoff prevents immediate retries');
    assert.equal((await client.query('SELECT attempts FROM decision_email_outbox WHERE review_id=$1', [id])).rows[0].attempts, 1);
    await client.query("UPDATE decision_email_outbox SET next_attempt_at=now()-interval '1 second' WHERE review_id=$1", [id]);
    await service.tick(); await service.tick(); assert.equal(sent.length, 1);
    assert.equal((await client.query('SELECT state FROM decision_email_outbox WHERE review_id = $1', [id])).rows[0].state, 'sent');
    await decide(); await service.tick(); assert.equal(sent.length, 1, 'daily cap includes failed attempts');
    await service.savePreference(owner, false, null); await service.tick();
    assert.ok((await client.query("SELECT state FROM decision_email_outbox WHERE state = 'skipped'")).rows.length);
    const verifyToken = Object.assign(async () => owner, { identity: async () => ({ id: owner, verifiedEmail: null }) });
    const app = createApp({ verifyToken, notifications: service, env: {}, logger: { error() {} } });
    await request(app).put('/api/me/notifications').set('Authorization', 'Bearer demo').send({ enabled: true, email: 'attacker@example.test' }).expect(400);
    await request(app).put('/api/me/notifications').set('Authorization', 'Bearer demo').send({ enabled: true }).expect(422);
    await request(app).put('/api/me/notifications').set('Authorization', 'Bearer demo').send({ enabled: false }).expect(200);
    await request(app).get('/api/me/notifications').expect(401);
  } finally { await db.close(); }
});

test('provider uses a stable idempotency key and a minimal plain-text message', async () => {
  const calls = [];
  const send = createEmailProvider({ apiKey: 'fake', from: 'TSEK <demo@example.test>', applicationOrigin: 'https://tsek.example.test', fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ id: 'mail' }) }; } });
  await send({ review_id: 'review', application_id: owner, recipient: 'citizen@example.test', decision: 'approved', note: 'Please collect your document', document: 'PRIVATE DOCUMENT' });
  assert.equal(calls[0].options.headers['Idempotency-Key'], 'decision/review');
  const body = JSON.parse(calls[0].options.body);
  assert.match(body.text, /TSK-111111/); assert.match(body.text, /Please collect your document/);
  assert.ok(!JSON.stringify(body).includes('PRIVATE DOCUMENT'));
});
