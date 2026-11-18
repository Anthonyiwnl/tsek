import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

const userId = 'abcdef12-0000-4000-8000-000000000001';
const otherUserId = 'abcdef12-0000-4000-8000-000000000002';
const applicationId = '12345678-0000-4000-8000-000000000001';
const typeId = '12345678-0000-4000-8000-000000000002';
const fileId = '12345678-0000-4000-8000-000000000003';
const catalogue = { list: async () => [], ready: async () => {} };

test('the IP limit runs before auth, resets, and exempts liveness and readiness', async () => {
  let now = 0;
  let verifications = 0;
  const origin = 'https://tsek.example';
  const app = createApp({ catalogue, origin, env: {}, rateLimitOptions: { ipLimit: 2, now: () => now },
    verifyToken: async () => { verifications += 1; return userId; } });
  await request(app).get('/api/document-types').expect(200);
  await request(app).options('/api/applications').set('Origin', origin).expect(204);
  now = 1_100;
  const limited = await request(app).get('/api/me').set('Authorization', 'Bearer valid').set('Origin', origin)
    .expect('Access-Control-Allow-Origin', origin).expect('Retry-After', '59').expect(429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  assert.equal(verifications, 0);
  await request(app).get('/not-a-route').expect(429);
  await request(app).post('/health').expect(429);
  await request(app).get('/health?monitor=1').expect(200);
  await request(app).head('/health/ready').expect(200);
  now = 60_000;
  await request(app).get('/health/ready/').expect(200);
  await request(app).get('/api/document-types').expect(200);
  await request(app).get('/api/document-types').expect(200);
  await request(app).get('/api/document-types').expect(429);
});

test('Render uses the edge client address or the closest forwarding hop, and local requests use the socket', async () => {
  const render = createApp({ catalogue, env: { RENDER: 'true', RENDER_SERVICE_TYPE: 'web' }, rateLimitOptions: { ipLimit: 1 } });
  const edgeRequest = (client, forwarded) => request(render).get('/api/document-types')
    .set('CF-Connecting-IP', client).set('X-Forwarded-For', forwarded);
  await edgeRequest('203.0.113.1', '192.0.2.10, 198.51.100.1').expect(200);
  await edgeRequest('203.0.113.1', '192.0.2.11, 198.51.100.2').expect(429);
  await edgeRequest('203.0.113.2', '192.0.2.10, 198.51.100.1').expect(200);
  await edgeRequest('203.0.113.2, 203.0.113.1', '198.51.100.1').expect(200);
  await request(render).get('/api/document-types').set('X-Forwarded-For', '192.0.2.11, 198.51.100.1').expect(429);
  await request(render).get('/api/document-types').set('X-Forwarded-For', '198.51.100.2').expect(200);
  await request(render).get('/api/document-types').set('X-Forwarded-For', '2001:0db8:0000::1').expect(200);
  await request(render).get('/api/document-types').set('X-Forwarded-For', '2001:db8::1').expect(429);

  const local = createApp({ catalogue, env: {}, rateLimitOptions: { ipLimit: 1 } });
  await request(local).get('/api/document-types').set('X-Forwarded-For', '198.51.100.1').set('CF-Connecting-IP', '203.0.113.1').expect(200);
  await request(local).get('/api/document-types').set('X-Forwarded-For', '198.51.100.2').set('CF-Connecting-IP', '203.0.113.2').expect(429);
});

test('the write limit follows a verified user across IPs, methods, and API routes', async () => {
  let creates = 0;
  let now = 0;
  const app = createApp({ catalogue, env: { RENDER: 'true' }, rateLimitOptions: { writeLimit: 2, now: () => now },
    verifyToken: async token => ({ first: userId, second: userId.toUpperCase(), other: otherUserId })[token],
    applications: { create: async () => { creates += 1; return { id: applicationId }; } },
    staff: { role: async () => 'staff' } });
  const create = (token, ip) => request(app).post('/api/applications').set('Authorization', `Bearer ${token}`)
    .set('X-Forwarded-For', ip).send({ document_type_id: typeId });
  await create('first', '198.51.100.1').expect(201);
  await create('second', '198.51.100.2').expect(201);
  const limited = await request(app).post(`/api/admin/applications/${applicationId}/reviews`)
    .set('Authorization', 'Bearer first').expect('Retry-After', '60').expect(429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  await request(app).get('/api/me').set('Authorization', 'Bearer first').expect(200);
  await create('other', '198.51.100.1').expect(201);
  now = 60_000;
  await create('first', '198.51.100.1').expect(201);
  assert.equal(creates, 4);
});

test('uploads and replacements share a stricter limit before touching file storage', async () => {
  let now = 0;
  let storageReads = 0;
  const app = createApp({ catalogue, env: {}, rateLimitOptions: { uploadLimit: 1, now: () => now },
    verifyToken: async () => userId,
    applicationFiles: {
      getApplication: async () => { storageReads += 1; return { status: 'draft' }; },
      createFile: async () => ({ id: fileId }),
      replaceFile: async () => ({ id: fileId }),
    } });
  const filesPath = `/api/applications/${applicationId}/files`;
  const signUpload = req => req.set('Authorization', 'Bearer valid').set('Content-Type', 'text/plain')
    .set('Content-Disposition', 'attachment; filename="sample.txt"').send('Synthetic document');
  await signUpload(request(app).post(filesPath)).expect(201);
  const limited = await signUpload(request(app).put(`${filesPath}/${fileId}`)).expect('Retry-After', '60').expect(429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  assert.equal(storageReads, 1);
  now = 60_000;
  await signUpload(request(app).put(`${filesPath}/${fileId}`)).expect(201);
  assert.equal(storageReads, 2);
});
