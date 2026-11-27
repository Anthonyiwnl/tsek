import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { migrate, seed } from '../scripts/database-tasks.js';
import { privacyRepository } from '../src/privacy.js';
import { applicationsRepository } from '../src/applications.js';
import { applicationFilesRepository } from '../src/application-files.js';
import { createApp } from '../src/app.js';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
test('consent, owner erasure and retention preserve the correct data boundaries', async () => {
  const db = new PGlite();
  const client = { query: (sql, params) => params || !sql.includes(';') ? db.query(sql, params) : db.exec(sql).then(rows => rows.at(-1)) };
  try {
    await migrate(client); await seed(client);
    const privacy = privacyRepository(client, { enabled: true, retentionDays: 30 });
    const applications = applicationsRepository(client);
    const files = applicationFilesRepository(client, work => db.transaction(work));
    const { rows: [type] } = await client.query('SELECT id FROM document_types LIMIT 1');
    const app = createApp({ privacy, applications, applicationFiles: files, verifyToken: async token => token === 'owner' ? owner : other, env: {}, logger: { error() {} } });
    const draft = await applications.create(owner, type.id, 'Synthetic');
    const upload = () => request(app).post(`/api/applications/${draft.id}/files`).set('Authorization', 'Bearer owner').set('Content-Type', 'text/plain').set('Content-Disposition', 'attachment; filename="sample.txt"');
    await upload().send(Buffer.from('SYNTHETIC')).expect(428);
    assert.equal((await files.listFiles(owner, draft.id)).length, 0);
    await upload().set('X-Privacy-Consent', 'outdated-policy').send(Buffer.from('SYNTHETIC')).expect(428);
    await upload().set('X-Privacy-Consent', privacy.policy.version).send(Buffer.from('SYNTHETIC')).expect(201);
    assert.equal(await privacy.consented(owner), true);
    assert.equal(await privacyRepository(client, { enabled: true, retentionDays: 14 }).consented(owner), false);
    const makeDecided = async (days, status = 'approved') => {
      const row = await applications.create(owner, type.id, 'Synthetic');
      await files.createFile(owner, row.id, { originalName: 'sample.txt', mediaType: 'text/plain', content: Buffer.from('SYNTHETIC') });
      await client.query('UPDATE applications SET status = $2 WHERE id = $1', [row.id, status]);
      if (status !== 'draft') await client.query(`INSERT INTO application_reviews(application_id,reviewer_id,decision,note,created_at)
        VALUES ($1,$2,$3,'Reviewed',now()-make_interval(days=>$4::integer))`, [row.id, other, status, days]);
      return row;
    };
    const old = await makeDecided(31), recent = await makeDecided(29), privateDraft = await makeDecided(90, 'draft');
    assert.equal(await privacy.expireFiles(), 1);
    assert.equal((await files.listFiles(owner, old.id)).length, 0);
    assert.ok(await applications.get(owner, old.id));
    assert.equal((await client.query('SELECT id FROM application_reviews WHERE application_id=$1', [old.id])).rows.length, 1);
    assert.equal((await files.listFiles(owner, recent.id)).length, 1);
    assert.equal((await files.listFiles(owner, privateDraft.id)).length, 1);
    const erase = `/api/applications/${recent.id}/privacy`;
    await request(app).delete(erase).send({ confirm: true }).expect(401);
    await request(app).delete(erase).set('Authorization', 'Bearer other').send({ confirm: true }).expect(404);
    await request(app).delete(erase).set('Authorization', 'Bearer owner').send({}).expect(400);
    assert.equal((await request(app).delete('/api/applications/not-a-uuid/privacy').set('Authorization','Bearer owner').send({ confirm: true }).expect(400)).body.error.code, 'INVALID_BODY');
    assert.equal((await request(app).delete(erase).set('Authorization','Bearer owner').send({ confirm: true, extra: 1 }).expect(400)).body.error.code, 'INVALID_BODY');
    const disabled = createApp({ privacy: privacyRepository(client), verifyToken: async () => owner, env: {}, logger: { error() {} } });
    assert.equal((await request(disabled).delete(erase).set('Authorization','Bearer owner').send({ confirm: true }).expect(503)).body.error.code, 'PRIVACY_UNAVAILABLE');
    await request(app).delete(erase).set('Authorization', 'Bearer owner').send({ confirm: true }).expect(204);
    assert.equal(await applications.get(owner, recent.id), null);
    assert.equal((await client.query('SELECT id FROM application_reviews WHERE application_id=$1', [recent.id])).rows.length, 0);
    assert.equal((await files.listFiles(owner, recent.id)).length, 0);
    assert.equal(await privacy.expireFiles(), 0);
    assert.equal(await privacyRepository(client).expireFiles(), 0);
    assert.throws(() => privacyRepository(client, { enabled: true }), /retention/);
  } finally { await db.close(); }
});

test('retention failures return zero and log no database or document details', async () => {
  const logs = [];
  const privacy = privacyRepository({ query: async () => { throw new Error('PRIVATE DOCUMENT database detail'); } }, { enabled: true, retentionDays: 30, logger: { error: entry => logs.push(entry) } });
  assert.equal(await privacy.expireFiles(), 0);
  assert.deepEqual(logs, [{ event: 'file_retention_failed' }]);
});

test('privacy reads and erasure retain global IP and authenticated write limits', async () => {
  const options = { privacy: { enabled: true, policy: { version: 'test' }, consented: async () => true, erase: async () => true }, verifyToken: async () => owner, env: {}, logger: { error() {} } };
  const readApi = createApp({ ...options, rateLimitOptions: { ipLimit: 1 } });
  await request(readApi).get('/api/me/privacy').set('Authorization','Bearer demo').expect(200);
  assert.equal((await request(readApi).get('/api/me/privacy').set('Authorization','Bearer demo').expect(429)).body.error.code, 'RATE_LIMITED');
  const writeApi = createApp({ ...options, rateLimitOptions: { writeLimit: 1 } });
  const path = `/api/applications/${owner}/privacy`;
  await request(writeApi).delete(path).set('Authorization','Bearer demo').send({ confirm: true }).expect(204);
  assert.equal((await request(writeApi).delete(path).set('Authorization','Bearer demo').send({ confirm: true }).expect(429)).body.error.code, 'RATE_LIMITED');
});
