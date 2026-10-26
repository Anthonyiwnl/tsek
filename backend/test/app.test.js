import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestContext } from './_helpers.js';

let context;

before(async () => { context = await createTestContext(); });
after(async () => { await context?.db.close(); });

test('database failure is sanitized and readiness differs from liveness', async () => {
  const fail = async () => { throw new Error('secret connection string'); };
  const loggedErrors = [];
  const broken = createApp({ catalogue: { list: fail, ready: fail }, logger: { error(error) { loggedErrors.push(error); } } });
  const response = await request(broken).get('/api/document-types').expect(500);
  assert.equal(response.body.error.code, 'INTERNAL_ERROR');
  assert.ok(!response.text.includes('secret'));
  await request(broken).get('/health').expect(200);
  await request(broken).get('/health/ready').expect(503);
  assert.deepEqual(loggedErrors.map(({ event }) => event), ['request_failed', 'readiness_check_failed']);
  assert.ok(!JSON.stringify(loggedErrors).includes('secret'));
  await request(context.app).get('/health/ready').expect(200);
});

test('API includes security headers and configured CORS origin', async () => {
  const response = await request(context.app).get('/health').set('Origin', 'http://localhost:5173').expect(200);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-powered-by'], undefined);
});
