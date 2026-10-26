import assert from 'node:assert/strict';
import test from 'node:test';
import { redactSecrets, runAutomaticChecks } from './ai-review.mjs';

const diffFor = (text) => `+++ b/backend/config.env\n${text.split('\n').map((line) => `+${line}`).join('\n')}`;

test('redacts whole PEM blocks before credential headers, preserving surrounding text', () => {
  for (const label of ['PRIVATE KEY', 'RSA PRIVATE KEY', 'EC PRIVATE KEY', 'ENCRYPTED PRIVATE KEY']) {
    const block = `-----BEGIN ${label}-----\n+synthetic-key-body\n+-----END ${label}-----`;
    assert.equal(redactSecrets(`before\n+${block}\n+after`), 'before\n+[REDACTED]\n+after');
  }
});

test('consumes mismatched END markers until the matching PEM label', () => {
  const block = [
    '-----BEGIN RSA PRIVATE KEY-----',
    'synthetic-key-body',
    '-----END EC PRIVATE KEY-----',
    'remaining-key-body',
    '-----END RSA PRIVATE KEY-----',
  ].join('\n');
  assert.equal(redactSecrets(`${block}\nafter`), '[REDACTED]\nafter');
});

test('redacts unterminated PEM blocks through end of input', () => {
  for (const ending of ['', '\n-----END EC PRIVATE KEY-----\nremaining-key-body\n']) {
    assert.equal(
      redactSecrets(`before\n-----BEGIN RSA PRIVATE KEY-----\nsynthetic-key-body${ending}`),
      'before\n[REDACTED]',
    );
  }
});

test('redacts multiple PEM blocks independently', () => {
  const block = '-----BEGIN PRIVATE KEY-----\nsynthetic-key-body\n-----END PRIVATE KEY-----';
  assert.equal(redactSecrets(`${block}\nbetween\n${block}`), '[REDACTED]\nbetween\n[REDACTED]');
});

test('redacts env-style server secrets without adding automatic detections', () => {
  const assignments = [
    'JWT_SECRET=synthetic-jwt-secret',
    'DATABASE_URL=mysql://synthetic-user:synthetic-password@localhost/test',
    'OPENAI_API_KEY: "synthetic-openai-key"',
    "APP_PASSWORD = 'synthetic-password'",
    'SERVICE_TOKEN=synthetic-token',
    'SERVICE_API_KEY=synthetic-api-key',
  ].join('\n');
  const redacted = redactSecrets(assignments);
  assert.equal(redacted.match(/\[REDACTED\]/g)?.length, 6);
  assert.doesNotMatch(redacted, /synthetic-/);
  assert.deepEqual(runAutomaticChecks(diffFor(assignments)), []);
});

test('existing automatic credential detections still redact and report', () => {
  const fixtures = [
    ['sk-' + 'a'.repeat(24), 'OpenAI API key'],
    ['ghp_' + 'b'.repeat(32), 'GitHub token'],
    ['-----BEGIN PRIVATE KEY-----\nsynthetic-key-body', 'Private key'],
    ['postgres://synthetic-user:synthetic-password@localhost/test', 'Database URL with password'],
  ];
  for (const [credential, name] of fixtures) {
    assert.deepEqual(runAutomaticChecks(diffFor(credential)), [
      { file: 'backend/config.env', problem: `Possible ${name}` },
    ]);
    assert.equal(redactSecrets(credential), '[REDACTED]');
  }
});
