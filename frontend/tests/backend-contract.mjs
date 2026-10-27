// Optional integration check against a local checkout of the unmerged backend.
// Uses embedded PostgreSQL, synthetic identity and a stub provider; never Neon/OpenAI.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApplicationApi } from '../src/application-api.js';

if (!process.argv[2]) throw new Error('Pass the path to the backend directory from PR #45.');
const root = resolve(process.argv[2]);
const backendRequire = createRequire(resolve(root, 'package.json'));
const { PGlite } = backendRequire('@electric-sql/pglite');
const source = (name) => import(pathToFileURL(resolve(root, name)).href);
const { migrate, seed } = await source('scripts/database-tasks.js');
const { createApp } = await source('src/app.js');
const { catalogueRepository } = await source('src/catalogue.js');
const { applicationsRepository } = await source('src/applications.js');
const { privateDataRepository } = await source('src/private-data.js');
const { ProviderError } = await source('src/provider.js');
const interactive = process.argv.includes('--serve');
const db = new PGlite();
const client = { query: (sql, params) => params || !sql.includes(';') ? db.query(sql, params) : db.exec(sql).then(rows => rows.at(-1)) };
const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
await migrate(client); await seed(client);
const catalogue = catalogueRepository(client);
let providerFails = !interactive;
const analysisProvider = async () => {
  if (providerFails) throw new ProviderError('Synthetic failure', 'AI_PROVIDER_ERROR');
  const [service] = await catalogue.list();
  const detail = await catalogue.requirements(service.id);
  return { model: 'synthetic-test', result: JSON.stringify({ detected_document_type: service.name, extracted_fields: { full_name: 'Synthetic Citizen' }, requirements: detail.requirements.map(r => ({ requirement_id: r.id, status: 'complete', reason: 'Synthetic test evidence' })) }) };
};
const server = createApp({ catalogue, applications: applicationsRepository(client), privateData: privateDataRepository(client), analysisProvider,
  verifyToken: async token => { if (![owner, other].includes(token)) throw new Error('Invalid test token'); return token; }, logger: { error() {} },
}).listen(interactive ? 4319 : 0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const api = createApplicationApi({ base, getToken: async () => owner });
try {
  if (interactive) {
    const [service] = await api.services();
    await api.create({ document_type_id: service.id, purpose: 'Synthetic browser verification' });
    console.log('Synthetic local backend ready on 127.0.0.1:4319. No Neon or OpenAI connection.');
    await new Promise(() => {});
  }
  assert.deepEqual(await api.list(), []);
  const [service] = await api.services();
  const app = await api.create({ document_type_id: service.id, purpose: 'Synthetic frontend test' });
  assert.equal((await api.list())[0].id, app.id);
  await api.update(app.id, { purpose: 'Persisted change' });
  assert.equal((await api.get(app.id)).purpose, 'Persisted change');
  const stranger = createApplicationApi({ base, getToken: async () => other });
  assert.deepEqual(await stranger.list(), []);
  await assert.rejects(stranger.get(app.id), { status: 404 });
  const file = await api.upload(app.id, new File(['Synthetic text only'], 'sample.txt', { type: 'text/plain' }));
  assert.equal((await api.files(app.id))[0].id, file.id);
  await assert.rejects(api.analyze(app.id, file.id), { status: 502 });
  assert.equal((await api.analyses(app.id))[0].status, 'failed');
  providerFails = false;
  const analysis = await api.analyze(app.id, file.id);
  assert.equal(analysis.status, 'completed');
  assert.equal(analysis.normalized_result.extracted_fields.full_name, 'Synthetic Citizen');
  assert.equal((await api.checklist(app.id)).is_complete, true);
  await client.query("UPDATE applications SET status = 'submitted' WHERE id = $1", [app.id]);
  await assert.rejects(api.update(app.id, { purpose: 'Forbidden' }), { status: 409 });
  await assert.rejects(api.remove(app.id), { status: 409 });
  await client.query("UPDATE applications SET status = 'draft' WHERE id = $1", [app.id]);
  await api.remove(app.id); assert.deepEqual(await api.list(), []);
  await assert.rejects(api.get(app.id), { status: 404 });
  console.log('PASS: real HTTP + embedded PostgreSQL create/list/detail/edit, ownership, raw upload, analysis failure/retry, checklist, draft-only deletion.');
} finally { await new Promise(resolve => server.close(resolve)); await db.close(); }
