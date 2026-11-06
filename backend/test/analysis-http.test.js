import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { createApp } from '../src/app.js';

const fixtureDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'analysis');
const analysisPath = '/api/analyses/validate';
const token = 'analysis-test-token';
const app = createApp({
  catalogue: { list: async () => [], requirements: async () => null, ready: async () => {} },
  verifyToken: async suppliedToken => {
    if (suppliedToken !== token) throw new Error('Invalid test token');
    return '00000000-0000-4000-8000-000000000001';
  },
  env: {},
  logger: { error() {} },
});

function postAnalysis() {
  return request(app).post(analysisPath).auth(token, { type: 'bearer' });
}

function readFixture(name) {
  return fs.readFileSync(path.join(fixtureDirectory, name), 'utf8');
}

test('requires a bearer token before parsing the analysis request', async () => {
  await request(app).post(analysisPath)
    .set('Content-Type', 'application/json').send('{"response":')
    .expect(401, { error: {
      code: 'MISSING_BEARER_TOKEN',
      message: 'A bearer token is required.',
    } });
});

test('validates a document analysis object over HTTP', async () => {
  await postAnalysis()
    .send({ response: JSON.parse(readFixture('valid.json')) })
    .expect(200, { valid: true, errors: [] });
});

test('validates a raw JSON string and reports malformed and invalid analysis responses', async (t) => {
  await t.test('raw JSON', async () => {
    await postAnalysis().send({ response: readFixture('valid.json') })
      .expect(200, { valid: true, errors: [] });
  });
  await t.test('malformed JSON', async () => {
    await postAnalysis().send({ response: readFixture('malformed-response.txt') })
      .expect(422).expect(({ body }) => assert.equal(body.errors[0].code, 'MALFORMED_JSON'));
  });
  await t.test('wrong observation type', async () => {
    await postAnalysis().send({ response: JSON.parse(readFixture('wrong-type.json')) })
      .expect(422).expect(({ body }) => {
        assert.equal(body.valid, false);
        assert.deepEqual(Object.keys(body).sort(), ['errors', 'valid']);
      });
  });
});

test('requires a response property', async () => {
  await postAnalysis().send({})
    .expect(400, { error: {
      code: 'INVALID_INPUT',
      message: 'The response field must contain an analysis object or JSON string.',
    } });
});

for (const body of ['[]', 'null', '42', '"text"']) {
  test(`rejects a non-object request body: ${body}`, async () => {
    await postAnalysis()
      .set('Content-Type', 'application/json').send(body)
      .expect(400, { error: {
        code: 'INVALID_INPUT',
        message: 'The response field must contain an analysis object or JSON string.',
      } });
  });
}

test('rejects malformed request JSON', async () => {
  await postAnalysis()
    .set('Content-Type', 'application/json').send('{"response":')
    .expect(400, { error: {
      code: 'INVALID_JSON',
      message: 'Request body must be valid JSON.',
    } });
});

for (const response of [42, null, []]) {
  test(`returns 422 for an invalid analysis value: ${JSON.stringify(response)}`, async () => {
    await postAnalysis().send({ response })
      .expect(422).expect(({ body }) => {
        assert.equal(body.valid, false);
        assert.equal(body.errors[0].code, 'INVALID_ANALYSIS');
      });
  });
}
