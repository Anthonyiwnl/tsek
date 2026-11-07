import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { migrate, seed } from '../scripts/database-tasks.js';
import { createApp } from '../src/app.js';
import { applicationFilesRepository } from '../src/application-files.js';
import { applicationsRepository } from '../src/applications.js';

const owner = '11111111-1111-4111-8111-111111111111';
const stranger = '22222222-2222-4222-8222-222222222222';
const headers = { Authorization: 'Bearer owner' };
const otherHeaders = { Authorization: 'Bearer stranger' };
let db;
let client;
let files;
let applications;
let typeId;
let app;

const makeApp = (applicationFiles, logger = { error() {} }) => createApp({
  applications, applicationFiles, logger,
  verifyToken: async (token) => token === 'owner' ? owner : stranger,
});

before(async () => {
  db = new PGlite();
  client = { query: (sql, params) => params || !sql.includes(';')
    ? db.query(sql, params) : db.exec(sql).then(results => results.at(-1)) };
  await migrate(client);
  await seed(client);
  typeId = (await client.query('SELECT id FROM document_types ORDER BY name LIMIT 1')).rows[0].id;
  files = applicationFilesRepository(client);
  applications = applicationsRepository(client);
  app = makeApp(files);
});

after(async () => { await db?.close(); });

const upload = (api, id, media = 'text/plain', auth = headers) => request(api)
  .post(`/api/applications/${id}/files`).set(auth)
  .set('Content-Type', media).set('Content-Disposition', 'attachment; filename="synthetic.txt"');

test('owner can upload, list, download and delete private files', async () => {
  const { id } = await applications.create(owner, typeId, '');
  const contents = Buffer.from('synthetic text');
  const created = await upload(app, id).send(contents).expect(201);
  const file = created.body.data;
  const listUrl = `/api/applications/${id}/files`;
  const fileUrl = `${listUrl}/${file.id}`;
  assert.equal(created.headers.location, fileUrl);
  assert.equal(file.original_name, 'synthetic.txt');
  assert.equal(file.media_type, 'text/plain');
  assert.equal(file.size, contents.length);
  assert.equal(file.application_id, id);
  assert.equal('content' in file, false);
  await request(app).get(listUrl).set(headers).expect(200, { data: [file] });
  await request(app).get(listUrl).set(otherHeaders).expect(404);
  await request(app).get(fileUrl).set(otherHeaders).expect(404);
  await request(app).delete(fileUrl).set(otherHeaders).expect(404);
  const download = await request(app).get(fileUrl).set(headers).expect(200, contents.toString());
  assert.equal(download.headers['cache-control'], 'private, no-store');
  assert.match(download.headers['content-disposition'], /^attachment;/);
  await request(app).delete(fileUrl).set(headers).expect(204);
  await request(app).get(fileUrl).set(headers).expect(404);
  await upload(app, id).send(contents).expect(201);
  await request(app).delete(`/api/applications/${id}`).set(headers).expect(204);
  assert.deepEqual(await files.listFiles(owner, id), []);
});

test('upload validates ownership before processing and rejects invalid files', async () => {
  const { id } = await applications.create(owner, typeId, '');
  await upload(app, id, 'text/plain', {}).send('synthetic').expect(401);
  await upload(app, id, 'text/plain', otherHeaders).send('synthetic').expect(404);
  await upload(app, id, 'application/zip').send(Buffer.from('synthetic')).expect(415);
  await upload(app, id, 'image/png').send(Buffer.from('not an image')).expect(415);
  await upload(app, id).send(Buffer.alloc(2 * 1024 * 1024 + 1, 65)).expect(413);
  assert.deepEqual(await files.listFiles(owner, id), []);
  const created = await upload(app, id).send('synthetic').expect(201);
  await client.query("UPDATE applications SET status = 'submitted' WHERE id = $1", [id]);
  await upload(app, id).send('synthetic').expect(409);
  await request(app).delete(created.headers.location).set(headers).expect(409);
  assert.equal(await files.createFile(owner, id, {
    originalName: 'blocked.txt', mediaType: 'text/plain', content: Buffer.from('blocked'),
  }), null);
  assert.equal(await files.deleteFile(owner, id, created.body.data.id), false);
});

test('browser preflight allows the upload header and database errors hide file information', async () => {
  const { id } = await applications.create(owner, typeId, '');
  const preflight = await request(app).options(`/api/applications/${id}/files`)
    .set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'authorization,content-type,content-disposition').expect(204);
  assert.match(preflight.headers['access-control-allow-headers'], /content-disposition/i);
  const logs = [];
  const broken = makeApp({
    ...files, createFile: async () => { throw new Error('synthetic.txt private payload'); },
  }, { error: (event) => logs.push(event) });
  const response = await upload(broken, id).send('private payload').expect(500);
  assert.equal(response.body.error.code, 'INTERNAL_ERROR');
  assert.equal(logs.length, 1);
  assert.doesNotMatch(JSON.stringify([response.body, logs]), /synthetic\.txt|private payload/);
});
