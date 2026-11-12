import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { migrate, seed } from '../scripts/database-tasks.js';
import { createApp } from '../src/app.js';
import { applicationFilesRepository } from '../src/application-files.js';
import { applicationAnalysesRepository } from '../src/application-analyses.js';
import { applicationsRepository } from '../src/applications.js';
import { catalogueRepository } from '../src/catalogue.js';
import { deriveAnalysisDecisions, OBSERVATION_FIELDS } from '../src/analysis.js';
import { createDocumentExtractor } from '../src/extraction.js';
import fixture from './fixtures/analysis/valid.json' with { type: 'json' };
import evaluation from './fixtures/document-evaluation-v1/expected.json' with { type: 'json' };

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
  files = applicationFilesRepository(client, (work) => db.transaction(work));
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

test('replacement preserves the application/file link, excludes old results, rejects stale retries and recovers after failure', async () => {
  const { id, upload, url } = await setup();
  const file = await upload('Passport');
  let timeout = false;
  const app = makeApp(input => timeout ? { outcome: 'timeout' } : extraction(input, input.text));
  const analyze = () => request(app).post(`${url}/analyses`).set(auth).send({ file_id: file.id });
  await analyze().expect(201);
  const replace = (revision, contents = 'Utility bill') => request(app).put(`${url}/files/${file.id}`)
    .set(auth).set('If-Match', `"${revision}"`).set('Content-Type', 'text/plain')
    .set('Content-Disposition', 'attachment; filename="replacement.txt"').send(contents);
  await replace(1, '').expect(400);
  assert.equal((await files.getFile(owner, id, file.id)).revision, 1);
  const saved = (await replace(1).expect(200)).body.data;
  assert.equal(saved.id, file.id);
  assert.equal(saved.application_id, id);
  assert.equal(saved.revision, 2);
  await replace(1, 'Passport').expect(409);
  assert.equal((await files.listFiles(owner, id)).length, 1);
  const pending = (await request(app).get(`${url}/checklist`).set(auth).expect(200)).body.data;
  assert.equal(pending.requirements[0].status, 'uncertain');
  assert.equal((await analyses.list(owner, id))[0].is_current, false);
  timeout = true;
  await analyze().expect(504);
  assert.equal((await files.getFile(owner, id, file.id)).revision, 2);
  timeout = false;
  await analyze().expect(201);
  const checklist = (await request(app).get(`${url}/checklist`).set(auth).expect(200)).body.data;
  assert.equal(checklist.requirements[0].status, 'uncertain');
  assert.equal(checklist.requirements[1].status, 'complete');
  assert.equal((await analyses.list(owner, id)).filter(row => row.is_current).length, 1);
});

test('an older analysis finishing after replacement or a newer retry cannot become current', async () => {
  const { upload, url } = await setup();
  const file = await upload('Passport');
  let finish;
  let started;
  const waiting = new Promise(resolve => { started = resolve; });
  let calls = 0;
  const app = makeApp(input => {
    calls++;
    if (calls === 1) { started(); return new Promise(resolve => { finish = () => resolve(extraction(input, 'Passport')); }); }
    return extraction(input, 'Utility bill');
  });
  const old = request(app).post(`${url}/analyses`).set(auth).send({ file_id: file.id }).then(response => response);
  await waiting;
  await request(app).put(`${url}/files/${file.id}`).set(auth).set('If-Match', '"1"')
    .set('Content-Type', 'text/plain').set('Content-Disposition', 'attachment; filename="new.txt"').send('Utility bill').expect(200);
  await request(app).post(`${url}/analyses`).set(auth).send({ file_id: file.id }).expect(201);
  finish();
  assert.equal((await old).status, 409);
  const checklist = (await request(app).get(`${url}/checklist`).set(auth).expect(200)).body.data;
  assert.equal(checklist.requirements[0].status, 'uncertain');
  assert.equal(checklist.requirements[1].status, 'complete');
});

test('replacement is owner-scoped, draft-only, validates revision, and works at the upload limit', async () => {
  const { id, upload, url } = await setup();
  const file = await upload();
  for (let i = 1; i < 10; i++) await upload();
  const app = makeApp(input => extraction(input, 'Passport'));
  const put = (token, revision = '1') => request(app).put(`${url}/files/${file.id}`)
    .set('Authorization', `Bearer ${token}`).set('If-Match', `"${revision}"`)
    .set('Content-Type', 'text/plain').set('Content-Disposition', 'attachment; filename="new.txt"').send('Passport');
  await put('stranger').expect(404);
  await put('owner', '0').expect(400);
  await put('owner').expect(200);
  assert.equal((await files.listFiles(owner, id)).length, 10);
  await client.query("UPDATE public.applications SET status = 'submitted' WHERE id = $1", [id]);
  await put('owner', '2').expect(409);
  assert.equal((await files.getFile(owner, id, file.id)).revision, 2);
});

test('out-of-order retries of the same file keep only the newest attempt current', async () => {
  const { upload, url } = await setup();
  const file = await upload('Passport');
  let finish;
  let started;
  const waiting = new Promise(resolve => { started = resolve; });
  let calls = 0;
  const app = makeApp(input => {
    if (++calls === 1) { started(); return new Promise(resolve => { finish = () => resolve(extraction(input, 'Passport')); }); }
    return { outcome: 'timeout' };
  });
  const analyze = () => request(app).post(`${url}/analyses`).set(auth).send({ file_id: file.id });
  const old = analyze().then(response => response);
  await waiting;
  await analyze().expect(504);
  finish();
  assert.equal((await old).status, 409);
  const checklist = (await request(app).get(`${url}/checklist`).set(auth).expect(200)).body.data;
  assert.equal(checklist.requirements[0].status, 'uncertain');
  assert.match(checklist.requirements[0].reason, /failed/);
});

test('browser replacement preflight permits PUT and the revision precondition', async () => {
  const app = makeApp(() => { throw new Error('Preflight must not call the provider'); });
  const response = await request(app).options(`/api/applications/${owner}/files/${stranger}`)
    .set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'PUT')
    .set('Access-Control-Request-Headers', 'authorization,content-type,content-disposition,if-match').expect(204);
  assert.match(response.headers['access-control-allow-methods'], /PUT/);
  assert.match(response.headers['access-control-allow-headers'], /If-Match/i);
});

test('a real upload flows through the document extractor and is saved for the checklist', async () => {
  const { id, url } = await setup();
  const observations = structuredClone(fixture.observations);
  observations.documentType.value = 'Passport';
  const text = [observations.documentType.value, observations.applicantName.value, observations.address.value].join('\n');
  let providerInput;
  const extractDocument = createDocumentExtractor({
    env: { OPENAI_API_KEY: 'test-placeholder', OPENAI_MODEL: 'test-model' },
    fetchImpl: async (_url, { body }) => {
      const { messages } = JSON.parse(body);
      providerInput = messages.find(({ role }) => role === 'user')?.content;
      return Response.json({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(observations) } }],
      });
    },
  });
  const app = makeApp(extractDocument);
  const uploaded = await request(app).post(`${url}/files`).set(auth)
    .set('Content-Type', 'text/plain')
    .set('Content-Disposition', 'attachment; filename="passport.txt"')
    .send(text).expect(201);
  const fileId = uploaded.body.data.id;
  const created = await request(app).post(`${url}/analyses`).set(auth).send({ file_id: fileId }).expect(201);
  assert.equal(providerInput, text);
  assert.deepEqual(created.body.data.result.source, { applicationId: id, uploadedFileId: fileId });
  assert.equal(created.body.data.metadata.model, 'test-model');
  assert.equal(created.body.data.normalized_result.requirements[0].name, 'Valid government-issued ID');
  assert.equal(created.body.data.normalized_result.requirements[0].is_required, true);
  assert.equal(created.body.data.normalized_result.requirements[0].status, 'complete');

  const persisted = await request(app).get(`${url}/analyses`).set(auth).expect(200);
  assert.deepEqual(persisted.body.data, [{ ...created.body.data, is_current: true }]);
  const checklist = await request(app).get(`${url}/checklist`).set(auth).expect(200);
  assert.equal(checklist.body.data.requirements[0].file_id, fileId);
  assert.equal(checklist.body.data.requirements[0].status, 'complete');
  assert.equal(checklist.body.data.is_complete, false);
});

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

test(`prepared document evaluation v${evaluation.setVersion} through the analysis and checklist routes`, async (t) => {
  t.diagnostic('Mock mode replays the prewritten observations to evaluate backend processing and checklist rules.');
  for (const sample of evaluation.samples) {
    await t.test(sample.file, async (sampleTest) => {
      const text = (await readFile(new URL(
        `./fixtures/document-evaluation-v1/samples/${sample.file}`, import.meta.url,
      ), 'utf8')).trim();
      const { id, url } = await setup();
      const observations = Object.fromEntries(OBSERVATION_FIELDS.map(field => {
        const value = sample.expected[field];
        return [field, { value, confidence: value === null ? 0 : 0.95 }];
      }));
      observations.readability = { status: sample.expected.readability, confidence: 0.95 };
      let providerInput;
      const extractDocument = createDocumentExtractor({
        env: { OPENAI_API_KEY: 'mock-placeholder' },
        fetchImpl: async (_url, { body }) => {
          const { messages } = JSON.parse(body);
          providerInput = messages.find(({ role }) => role === 'user')?.content;
          return Response.json({
            choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(observations) } }],
          });
        },
      });
      const app = makeApp(extractDocument);
      const uploaded = await request(app).post(`${url}/files`).set(auth)
        .set('Content-Type', 'text/plain')
        .set('Content-Disposition', `attachment; filename="${sample.file}"`)
        .send(text).expect(201);
      const fileId = uploaded.body.data.id;
      const created = await request(app).post(`${url}/analyses`).set(auth).send({ file_id: fileId }).expect(201);
      const { result, metadata } = created.body.data;
      const actual = {
        ...Object.fromEntries(OBSERVATION_FIELDS.map(field => [field, result.observations[field].value])),
        readability: result.observations.readability.status,
        outcome: result.decisions.outcome,
        missingFields: result.decisions.missingInformation.map(({ field }) => field),
      };
      const checklist = await request(app).get(`${url}/checklist`).set(auth).expect(200);
      const supported = checklist.body.data.requirements.filter(requirement => requirement.file_id === fileId);
      const checklistResult = supported.length
        ? supported.map(({ name, status }) => `${name}: ${status}`).join(', ')
        : 'no requirement matched (uncertain)';
      sampleTest.diagnostic(JSON.stringify({
        mode: 'mock', metadata, actual, checklist: checklistResult,
        humanJudgment: sample.checklist.humanJudgment,
      }));
      assert.equal(providerInput, text);
      assert.deepEqual(result.source, { applicationId: id, uploadedFileId: fileId });
      assert.equal(metadata.promptVersion, evaluation.promptVersion);
      assert.equal(metadata.schemaVersion, evaluation.schemaVersion);
      assert.deepEqual(actual, sample.expected);
      assert.equal(checklistResult, sample.checklist.systemWillSay);
      for (const requirement of checklist.body.data.requirements.filter(item => !item.file_id)) {
        assert.equal(requirement.status, 'uncertain');
      }
      const persisted = await request(app).get(`${url}/analyses`).set(auth).expect(200);
      assert.deepEqual(persisted.body.data, [{ ...created.body.data, is_current: true }]);
    });
  }
});

test('ownership, unsupported files and invalid provider results are handled without exposing data', async () => {
  const { id, upload, url } = await setup();
  const file = await upload();
  const pdf = await upload('%PDF-1.7', 'application/pdf');
  const image = await upload('synthetic image fixture', 'image/png');
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
  for (const unsupported of [pdf, image]) {
    const response = await analyze(unsupported.id).expect(415);
    assert.equal(response.body.error.code, 'TEXT_EXTRACTION_UNAVAILABLE');
  }
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
