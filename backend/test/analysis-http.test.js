import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { createApp } from '../src/app.js';

const fixtureDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'analysis');
const app = createApp({
  catalogue: { list: async () => [], requirements: async () => null, ready: async () => {} },
  env: {},
  logger: { error() {} },
});

function readFixture(name) {
  return fs.readFileSync(path.join(fixtureDirectory, name), 'utf8');
}

test('validates a document analysis object over HTTP', async () => {
  await request(app)
    .post('/api/analyses/validate')
    .send({ response: JSON.parse(readFixture('valid.json')) })
    .expect(200)
    .expect(({ body }) => {
      assert.equal(body.valid, true);
      assert.deepEqual(body.errors, []);
    });
});

test('validates a raw JSON string and reports malformed and invalid analysis responses', async (t) => {
  await t.test('raw JSON', async () => {
    await request(app).post('/api/analyses/validate').send({ response: readFixture('valid.json') })
      .expect(200).expect(({ body }) => assert.equal(body.valid, true));
  });
  await t.test('malformed JSON', async () => {
    await request(app).post('/api/analyses/validate').send({ response: readFixture('malformed-response.txt') })
      .expect(422).expect(({ body }) => assert.equal(body.errors[0].code, 'MALFORMED_JSON'));
  });
  await t.test('wrong observation type', async () => {
    await request(app).post('/api/analyses/validate').send({ response: JSON.parse(readFixture('wrong-type.json')) })
      .expect(422).expect(({ body }) => assert.equal(body.valid, false));
  });
});

test('requires a response property', async () => {
  await request(app).post('/api/analyses/validate').send({})
    .expect(400, { error: {
      code: 'INVALID_INPUT',
      message: 'The response field must contain an analysis object or JSON string.',
    } });
});
