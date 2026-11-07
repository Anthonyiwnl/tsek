import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { migrate, seed } from '../scripts/database-tasks.js';
import { createApp } from '../src/app.js';
import { applicationFilesRepository } from '../src/application-files.js';
import { applicationAnalysesRepository } from '../src/application-analyses.js';
import { applicationsRepository } from '../src/applications.js';
import { catalogueRepository } from '../src/catalogue.js';
import { deriveAnalysisDecisions } from '../src/analysis.js';
import fixture from './fixtures/analysis/valid.json' with { type: 'json' };

const owner = '11111111-1111-4111-8111-111111111111';
const stranger = '22222222-2222-4222-8222-222222222222';
const auth = { Authorization: 'Bearer owner' };
let db;
let client;
let files;
let analyses;
let catalogue;
let applications;

before(async () => {
  db = new PGlite();
  client = { query: (sql, params) => params || !sql.includes(';')
    ? db.query(sql, params) : db.exec(sql).then(results => results.at(-1)) };
  await migrate(client);
  await seed(client);
  files = applicationFilesRepository(client);
  analyses = applicationAnalysesRepository(client);
  catalogue = catalogueRepository(client);
  applications = applicationsRepository(client);
});

after(async () => { await db?.close(); });

function makeApp(extractDocument) {
  return createApp({
    env: {}, catalogue, applications, applicationFiles: files, applicationAnalyses: analyses, extractDocument,
    verifyToken: async (token) => token === 'owner' ? owner : stranger,
    logger: { error() {} },
  });
}

async function setup() {
  const type = (await catalogue.list())[0];
  const { id } = await applications.create(owner, type.id, '');
  const upload = (contents = 'synthetic document', mediaType = 'text/plain') => files.createFile(owner, id, {
    originalName: 'synthetic.txt', mediaType, content: Buffer.from(contents),
  });
  return { id, upload, url: `/api/applications/${id}` };
}

function extraction({ applicationId, uploadedFileId }, detected, { incomplete = false } = {}) {
  const observations = structuredClone(fixture.observations);
  observations.documentType.value = detected;
  if (incomplete) observations.address = { value: null, confidence: 0 };
  return {
    outcome: 'success',
    analysis: { ...fixture, analysisId: randomUUID(), source: { applicationId, uploadedFileId },
      observations, decisions: deriveAnalysisDecisions(observations) },
    metadata: { model: 'synthetic', promptVersion: 'test' },
  };
}

test('validated results persist and the checklist uses matching files and the latest outcome', async () => {
  const { id, upload, url } = await setup();
  const idFile = await upload('Passport');
  const addressFile = await upload('Utility bill');
  let incomplete = false;
  let timeout = false;
  const app = makeApp(input => timeout ? { outcome: 'timeout' } : extraction(input, input.text, { incomplete }));
  const analyze = (fileId) => request(app).post(`${url}/analyses`).set(auth).send({ file_id: fileId });
  const first = await analyze(idFile.id).expect(201);
  assert.equal(first.body.data.result.source.uploadedFileId, idFile.id);
  assert.equal(first.body.data.metadata.model, 'synthetic');
  assert.equal(first.body.data.normalized_result.requirements[0].status, 'complete');
  assert.equal((await request(app).get(`${url}/checklist`).set(auth).expect(200)).body.data.is_complete, false);
  await analyze(addressFile.id).expect(201);
  assert.equal((await request(app).get(`${url}/checklist`).set(auth).expect(200)).body.data.is_complete, true);
  incomplete = true;
  await analyze(addressFile.id).expect(201);
  const partial = (await request(app).get(`${url}/checklist`).set(auth).expect(200)).body.data;
  assert.equal(partial.requirements[1].status, 'incomplete');
  assert.equal(partial.is_complete, false);
  timeout = true;
  await analyze(idFile.id).expect(504);
  const list = (await request(app).get(`${url}/analyses`).set(auth).expect(200)).body.data;
  assert.equal(list[0].error_code, 'ANALYSIS_TIMEOUT');
  assert.equal(list[0].normalized_result, null);
  assert.equal(list.length, 4);
  const failed = (await request(app).get(`${url}/checklist`).set(auth).expect(200)).body.data;
  assert.equal(failed.requirements[0].status, 'uncertain');
  assert.match(failed.requirements[0].reason, /failed/);
  await files.deleteFile(owner, id, addressFile.id);
  assert.equal((await analyses.list(owner, id)).length, 2);
});

test('ownership, unsupported files and invalid provider results are handled without exposing data', async () => {
  const { id, upload, url } = await setup();
  const file = await upload();
  const pdf = await upload('%PDF-1.7', 'application/pdf');
  let calls = 0;
  const app = makeApp(input => {
    calls += 1;
    return extraction({ ...input, uploadedFileId: randomUUID() }, 'Passport');
  });
  const analyze = (fileId, headers = auth) => request(app).post(`${url}/analyses`).set(headers).send({ file_id: fileId });
  await analyze(file.id, {}).expect(401);
  await analyze(file.id, { Authorization: 'Bearer stranger' }).expect(404);
  await request(app).get(`${url}/checklist`).set('Authorization', 'Bearer stranger').expect(404);
  await analyze('not-a-uuid').expect(400);
  await analyze(randomUUID()).expect(404);
  await analyze(pdf.id).expect(415);
  assert.equal(calls, 0);
  const failure = await analyze(file.id).expect(502);
  assert.equal(failure.body.error.code, 'INVALID_ANALYSIS');
  const [stored] = await analyses.list(owner, id);
  assert.equal(stored.result, null);
  assert.equal(stored.status, 'failed');
  await client.query("UPDATE applications SET status = 'submitted' WHERE id = $1", [id]);
  await analyze(file.id).expect(409);
  assert.equal(calls, 1);
});
