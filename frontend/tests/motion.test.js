import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('../src/', import.meta.url);
const css = readFileSync(new URL('motion.css', root), 'utf8');
const tokens = readFileSync(new URL('tokens.css', root), 'utf8');
test('motion uses the specified duration budget and only compositor properties in keyframes', () => {
  for (const [name, value] of [['fast', 120], ['base', 200], ['slow', 320]]) assert.match(tokens, new RegExp(`--motion-${name}: ${value}ms`));
  const frames = [...css.matchAll(/(?:from|to)\s*\{([^}]+)\}/g)];
  assert.ok(frames.length >= 14);
  for (const [, body] of frames) for (const declaration of body.split(';').filter(x => x.trim())) {
    assert.ok(['transform', 'opacity'].includes(declaration.split(':')[0].trim()), declaration);
  }
  assert.doesNotMatch(css, /infinite|animation-delay|pointer-events:\s*auto/);
});
test('one global reduced-motion rule covers elements, generated content and dialog backdrops', () => {
  const styles = readdirSync(root).filter(x => x.endsWith('.css')).map(x => readFileSync(new URL(x, root), 'utf8')).join('\n');
  assert.equal([...styles.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g)].length, 1);
  assert.match(css, /\*, \*::before, \*::after, \*::backdrop/);
  assert.match(css, /animation: none !important/);
  assert.match(css, /transition: none !important/);
  assert.match(css, /scroll-behavior: auto !important/);
});
