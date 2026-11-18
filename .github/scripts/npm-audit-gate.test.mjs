import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from './npm-audit-gate.mjs';

const HIGH = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const OTHER = 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc';

function audit(...advisories) {
  const vulnerabilities = {};
  for (const [name, url, severity] of advisories) {
    vulnerabilities[name] = { via: [{ name, url, severity, title: `${name} advisory` }] };
    // A package that is only vulnerable through a dependency lists a string.
    vulnerabilities[`${name}-parent`] = { via: [name] };
  }
  return { vulnerabilities };
}

const exception = {
  advisory: 'GHSA-FC5Q-39XC-VJPF',
  apps: ['frontend'],
  package: 'picomatch',
  reason: 'Build tooling only.',
  issue: 269,
  expires: '2026-12-18',
};

test('an advisory without an exception fails', () => {
  const r = evaluate(audit(['picomatch', HIGH, 'high']), [], '2026-11-18', 'frontend');
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].id, 'GHSA-FC5Q-39XC-VJPF');
});

test('an exception covers only its own advisory', () => {
  const r = evaluate(audit(['picomatch', HIGH, 'high'], ['other', OTHER, 'critical']), [exception], '2026-11-18', 'frontend');
  assert.deepEqual(r.failures.map((f) => f.id), ['GHSA-AAAA-BBBB-CCCC']);
  assert.equal(r.excepted.length, 1);
});

test('an expired exception fails again', () => {
  const r = evaluate(audit(['picomatch', HIGH, 'high']), [exception], '2026-12-19', 'frontend');
  assert.equal(r.failures.length, 1);
  assert.equal(r.expired.length, 1);
});

test('an exception is valid through its expiry date', () => {
  const r = evaluate(audit(['picomatch', HIGH, 'high']), [exception], '2026-12-18', 'frontend');
  assert.equal(r.failures.length, 0);
});

test('moderate and low advisories do not fail', () => {
  const r = evaluate(audit(['x', OTHER, 'moderate']), [], '2026-11-18', 'frontend');
  assert.equal(r.failures.length, 0);
});

test('an exception that matches nothing is reported as unused', () => {
  const r = evaluate({ vulnerabilities: {} }, [exception], '2026-11-18', 'frontend');
  assert.equal(r.unused.length, 1);
  assert.equal(r.failures.length, 0);
});

test('an exception applies only to the apps it lists', () => {
  const r = evaluate(audit(['picomatch', HIGH, 'high']), [exception], '2026-11-18', 'backend');
  assert.equal(r.failures.length, 1);
  assert.equal(r.excepted.length, 0);
  assert.equal(r.unused.length, 0);
});
