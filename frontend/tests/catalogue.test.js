import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalogue } from '../src/catalogue.js';

const type = { id: 'type-1', name: 'Database service', description: null };
const detail = { ...type, requirements: [
  { id: 'req-1', name: 'Proof of address', is_required: true },
  { id: 'req-2', name: 'Conditional letter', is_required: false },
] };
const reply = data => new Response(JSON.stringify({ data }));

test('loads catalogue and requirements through the real backend response contract', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const result = await loadCatalogue('/api/document-types/', signal, async (url, options) => {
    calls.push(url);
    assert.equal(options.signal, signal);
    assert.equal(options.cache, 'no-store');
    return reply(url.endsWith('/requirements') ? detail : [type]);
  });
  assert.deepEqual(calls, ['/api/document-types', '/api/document-types/type-1/requirements']);
  assert.equal(result[0].description, '');
  assert.deepEqual(result[0].requirements, detail.requirements);
});

test('empty catalogue makes no detail requests', async () => {
  let calls = 0;
  assert.deepEqual(await loadCatalogue('/api/document-types', undefined, async () => {
    calls++; return reply([]);
  }), []);
  assert.equal(calls, 1);
});

test('empty requirements remain empty without fixture fallback', async () => {
  const result = await loadCatalogue('/types', undefined, async url =>
    reply(url === '/types' ? [type] : { ...detail, requirements: [] }));
  assert.deepEqual(result[0].requirements, []);
});

test('HTTP failures and malformed catalogue responses reject', async () => {
  for (const response of [new Response('', { status: 503 }), reply(null), reply([type, type]), reply([null])]) {
    await assert.rejects(loadCatalogue('/types', undefined, async () => response));
  }
});

test('rejects failed, mismatched, duplicate, or malformed requirements', async () => {
  for (const response of [new Response('', { status: 404 }), reply({ ...detail, id: 'wrong' }),
    reply({ ...detail, requirements: [detail.requirements[0], detail.requirements[0]] }),
    reply({ ...detail, requirements: [{ id: 'x', name: 'Missing required flag' }] })]) {
    await assert.rejects(loadCatalogue('/types', undefined, async url => url === '/types' ? reply([type]) : response));
  }
});

test('aborted requests do not become a successful catalogue', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadCatalogue('/types', controller.signal, async (_url, { signal }) => {
    signal.throwIfAborted();
  }), { name: 'AbortError' });
});
