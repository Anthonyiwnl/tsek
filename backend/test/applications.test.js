import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createTestContext, userB } from './_helpers.js';

let context;

before(async () => { context = await createTestContext(); });
after(async () => { await context?.db.close(); });

test('application CRUD requires authentication and scopes every operation to its owner', async () => {
  const unauthenticated = await request(context.app).get('/api/applications').expect(401);
  assert.equal(unauthenticated.body.error.code, 'MISSING_BEARER_TOKEN');

  const created = await request(context.app)
    .post('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .send({ document_type_id: context.documentTypeId, purpose: '  Employment  ' })
    .expect(201);
  const application = created.body.data;
  assert.equal(application.purpose, 'Employment');
  assert.equal(application.status, 'draft');
  assert.equal(application.document_type_name, 'Barangay Clearance');
  assert.equal(created.headers.location, `/api/applications/${application.id}`);

  const ownerList = await request(context.app)
    .get('/api/applications')
    .set('Authorization', 'Bearer user-a')
    .expect(200);
  assert.deepEqual(ownerList.body.data.map(({ id }) => id), [application.id]);
  const otherList = await request(context.app)
    .get('/api/applications')
    .set('Authorization', 'Bearer user-b')
    .expect(200);
  assert.deepEqual(otherList.body.data, []);

  await request(context.app)
    .get(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-b')
    .expect(404);
  await request(context.app)
    .get(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-a')
    .expect(200);

  const updated = await request(context.app)
    .patch(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-a')
    .send({ purpose: '  Housing support  ' })
    .expect(200);
  assert.equal(updated.body.data.purpose, 'Housing support');
  assert.ok(new Date(updated.body.data.updated_at) >= new Date(application.updated_at));

  await request(context.app)
    .delete(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-b')
    .expect(404);
  await request(context.app)
    .delete(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-a')
    .expect(204);
  await request(context.app)
    .get(`/api/applications/${application.id}`)
    .set('Authorization', 'Bearer user-a')
    .expect(404);
});

test('application CRUD validates inputs, service references, and draft-only changes', async () => {
  const authorization = { Authorization: 'Bearer user-a' };
  await request(context.app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: 'not-a-uuid' })
    .expect(400);
  await request(context.app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: '00000000-0000-0000-0000-000000000000' })
    .expect(422);

  const created = await request(context.app)
    .post('/api/applications')
    .set(authorization)
    .send({ document_type_id: context.documentTypeId })
    .expect(201);
  const id = created.body.data.id;
  await request(context.app)
    .patch(`/api/applications/${id}`)
    .set('Authorization', 'Bearer user-b')
    .send({ purpose: 'Attempted cross-user update' })
    .expect(404);
  const ownerRecord = await request(context.app)
    .get(`/api/applications/${id}`)
    .set(authorization)
    .expect(200);
  assert.equal(ownerRecord.body.data.purpose, '');
  const { rows: [otherType] } = await context.client.query(
    "INSERT INTO public.document_types(name) VALUES ('Applications test category') RETURNING id",
  );
  try {
    await request(context.app).patch(`/api/applications/${id}`).set(authorization).send({}).expect(400);
    await request(context.app).patch(`/api/applications/${id}`).set(authorization).send({ owner_id: userB }).expect(400);
    await request(context.app).patch(`/api/applications/${id}`).set(authorization).send({ purpose: 'x'.repeat(201) }).expect(400);
    await request(context.app).patch('/api/applications/not-a-uuid').set(authorization).send({ purpose: 'test' }).expect(400);

    const changedType = await request(context.app)
      .patch(`/api/applications/${id}`)
      .set(authorization)
      .send({ document_type_id: otherType.id })
      .expect(200);
    assert.equal(changedType.body.data.document_type_name, 'Applications test category');
    await context.client.query(
      'UPDATE public.document_types SET is_active = false WHERE id = $1',
      [otherType.id],
    );
    const inactiveType = await request(context.app)
      .patch(`/api/applications/${id}`)
      .set(authorization)
      .send({ document_type_id: otherType.id })
      .expect(422);
    assert.equal(inactiveType.body.error.code, 'INVALID_DOCUMENT_TYPE');

    await context.client.query("UPDATE public.applications SET status = 'submitted' WHERE id = $1", [id]);
    const updated = await request(context.app)
      .patch(`/api/applications/${id}`)
      .set(authorization)
      .send({ purpose: 'cannot change' })
      .expect(409);
    assert.equal(updated.body.error.code, 'APPLICATION_NOT_EDITABLE');
    const deleted = await request(context.app)
      .delete(`/api/applications/${id}`)
      .set(authorization)
      .expect(409);
    assert.equal(deleted.body.error.code, 'APPLICATION_NOT_DELETABLE');
  } finally {
    await context.client.query('DELETE FROM public.applications WHERE id = $1', [id]);
    await context.client.query('DELETE FROM public.document_types WHERE id = $1', [otherType.id]);
  }
});
