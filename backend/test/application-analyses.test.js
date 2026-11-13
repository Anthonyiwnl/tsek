import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { migrate, seed } from '../scripts/database-tasks.js';
import { createApp } from '../src/app.js';
import { applicationFilesRepository } from '../src/application-files.js';
import { applicationAnalysesRepository, normalizeApplicationAnalysis } from '../src/application-analyses.js';
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

function makeApp(extractDocument, options = {}) {
  return createApp({
    env: {}, catalogue, applications, applicationFiles: files, applicationAnalyses: analyses, extractDocument,
    verifyToken: async (token) => token === 'owner' ? owner : stranger,
    consumeAiBudget: async () => ({ allowed: true }),
    logger: { error() {} },
    ...options,
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

test('both PhilSys titles match the same type without matching other government IDs', () => {
  const requirements = ['PhilSys ID', 'Passport', "Driver's License"].map(name => ({
    name, accepted_document_types: [name],
  }));
  for (const [title, expected] of [
    ['Philippine Identification Card', 'PhilSys ID'],
    ['PhilSys ID', 'PhilSys ID'],
    ['Passport', 'Passport'],
    ["Driver's License", "Driver's License"],
  ]) {
    const { analysis } = extraction({}, title);
    const result = normalizeApplicationAnalysis(analysis, requirements);
    assert.equal(result.detected_document_type, title);
    assert.deepEqual(result.requirements.filter(item => item.matches).map(item => item.name), [expected]);
  }
});

test('the checklist matches a PhilSys analysis saved before the alias was supported', async () => {
  const { id, upload, url } = await setup();
  const file = await upload();
  const { document_type_id: typeId } = await files.getApplication(owner, id);
  const { requirements } = await catalogue.requirements(typeId);
  const { analysis } = extraction({ applicationId: id, uploadedFileId: file.id }, 'PHILIPPINE IDENTIFICATION CARD');
  const oldRequirements = requirements.map(requirement => ({
    ...requirement, accepted_document_types: requirement.accepted_document_types.filter(type => type !== 'PhilSys ID'),
  }));
  const stored = await analyses.create(owner, id, file.id, typeId, {
    status: 'completed', result: analysis, normalizedResult: normalizeApplicationAnalysis(analysis, oldRequirements),
  });
  assert.equal(stored.normalized_result.document_type_match, false);

  const checklist = (await request(makeApp()).get(`${url}/checklist`).set(auth).expect(200)).body.data;
  const idRequirement = checklist.requirements.find(item => item.name === 'Valid government-issued ID');
  assert.equal(idRequirement.status, 'complete');
  assert.equal(idRequirement.file_id, file.id);
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
  assert.deepEqual(persisted.body.data, [created.body.data]);
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
  const model = 'gpt-4.1-mini-2025-04-14';
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
        env: { OPENAI_API_KEY: 'mock-placeholder', OPENAI_MODEL: model, OPENAI_TIMEOUT_MS: '10000' },
        fetchImpl: async (_url, { body }) => {
          const providerRequest = JSON.parse(body);
          const { messages } = providerRequest;
          assert.equal(providerRequest.model, model);
          assert.equal(providerRequest.temperature, 0);
          assert.equal(providerRequest.max_tokens, 1000);
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
      assert.equal(metadata.timeoutMs, 10000);
      assert.deepEqual(actual, sample.expected);
      assert.equal(checklistResult, sample.checklist.systemWillSay);
      for (const requirement of checklist.body.data.requirements.filter(item => !item.file_id)) {
        assert.equal(requirement.status, 'uncertain');
      }
      const persisted = await request(app).get(`${url}/analyses`).set(auth).expect(200);
      assert.deepEqual(persisted.body.data, [created.body.data]);
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

test('verification and analysis use the same verified owner quota', async () => {
  const { upload, url } = await setup();
  const file = await upload('Passport');
  const charges = [];
  let verifications = 0;
  let extractions = 0;
  let extractionRequestId;
  const app = makeApp((input) => {
    extractions += 1;
    extractionRequestId = input.requestId;
    return extraction(input, 'Passport');
  }, {
    env: { AI_VERIFY_ENABLED: 'true' },
    provider: async () => {
      verifications += 1;
      return { model: 'synthetic', result: 'verified' };
    },
    consumeAiBudget: async (userId) => {
      charges.push(userId);
      return charges.length <= 2 ? { allowed: true } : { allowed: false, retryAfterSeconds: 45 };
    },
  });
  const verify = () => request(app).post('/api/verify').set(auth).send({ input: 'Passport' });
  const analyze = (id) => request(app).post(`${url}/analyses`).set(auth).send({ file_id: id });
  await analyze(randomUUID()).expect(404);
  await verify().expect(200);
  const created = await analyze(file.id).expect(201);
  assert.equal(extractionRequestId, created.headers['x-request-id']);
  for (const response of [await verify().expect(429), await analyze(file.id).expect(429)]) {
    assert.equal(response.headers['retry-after'], '45');
    assert.match(response.headers['access-control-expose-headers'], /Retry-After/i);
    assert.equal(response.body.error.code, 'AI_RATE_LIMITED');
  }
  assert.deepEqual(charges, [owner, owner, owner, owner]);
  assert.equal(verifications, 1);
  assert.equal(extractions, 1);
  const list = await request(app).get(`${url}/analyses`).set(auth).expect(200);
  assert.deepEqual(list.body.data, [created.body.data]);
});
