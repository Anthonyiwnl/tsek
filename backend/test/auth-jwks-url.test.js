import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNeonTokenVerifier } from '../src/auth.js';

test('Neon Auth rejects a remote HTTP JWKS override even when its base URL is local', () => {
  assert.throws(() => createNeonTokenVerifier({
    NEON_AUTH_BASE_URL: 'http://localhost:3000/auth',
    NEON_AUTH_JWKS_URL: 'http://remote.example/keys',
  }), /NEON_AUTH_JWKS_URL must use HTTPS/);
});

test('Neon Auth permits loopback HTTP and remote HTTPS for the JWKS URL', () => {
  for (const url of ['http://localhost/keys', 'http://127.0.0.1/keys',
    'http://[::1]/keys', 'https://remote.example/keys']) {
    assert.equal(typeof createNeonTokenVerifier({
      NEON_AUTH_BASE_URL: 'https://auth.example/auth',
      NEON_AUTH_JWKS_URL: url,
    }), 'function');
  }
});
