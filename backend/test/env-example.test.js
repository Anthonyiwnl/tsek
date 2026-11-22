import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
// Set by the host, never by us.
const platform = new Set(['RENDER', 'RENDER_GIT_COMMIT']);

function sources(directory) {
  return readdirSync(new URL(directory, root), { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return sources(`${directory}${entry.name}/`);
    return entry.name.endsWith('.js') ? [readFileSync(new URL(`${directory}${entry.name}`, root), 'utf8')] : [];
  });
}

const read = new Set(['src/', 'scripts/'].flatMap(sources)
  .flatMap((code) => [...code.matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g)].map(([, name]) => name)));
const documented = new Set([...readFileSync(new URL('.env.example', root), 'utf8')
  .matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map(([, name]) => name));

test('every variable the backend reads is in backend/.env.example', () => {
  const missing = [...read].filter((name) => !documented.has(name) && !platform.has(name));
  assert.deepEqual(missing, [], 'add these to backend/.env.example with a comment');
});

test('backend/.env.example lists no variable the backend never reads', () => {
  // NODE_ENV is read by Express, not by our code.
  const unused = [...documented].filter((name) => !read.has(name) && name !== 'NODE_ENV');
  assert.deepEqual(unused, [], 'remove these from backend/.env.example (and from Render)');
});
