import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseUrl, serverConfig } from '../src/config.js';

test('configuration rejects missing URLs, insecure remote TLS, pooled migrations, and invalid ports', () => {
  assert.throws(() => databaseUrl({}), /Set DATABASE_URL/);
  assert.throws(() => databaseUrl({ DATABASE_URL: 'postgres://remote/db?sslmode=disable' }), /verify-full/);
  assert.throws(() => databaseUrl({ DATABASE_URL: 'postgres://ep-test-pooler.region.neon.tech/db?sslmode=verify-full' }, { migration: true }), /direct Neon/);
  assert.equal(databaseUrl({ DATABASE_URL: 'postgres://localhost/tsek' }), 'postgres://localhost/tsek');
  assert.throws(() => serverConfig({ PORT: 'invalid' }), /PORT/);
  assert.throws(() => serverConfig({ FRONTEND_URL: 'https://example.com/path' }), /origin/);
});

test('Neon URL handling upgrades TLS and selects a direct migration connection', () => {
  const pooled = databaseUrl({
    DATABASE_URL: 'postgres://ep-test-pooler.region.aws.neon.tech/db?sslmode=require&channel_binding=require',
  });
  const pooledUrl = new URL(pooled);
  assert.equal(pooledUrl.searchParams.get('sslmode'), 'verify-full');
  assert.equal(pooledUrl.searchParams.get('channel_binding'), 'require');

  const direct = 'postgres://ep-test.region.aws.neon.tech/db?sslmode=verify-full';
  assert.equal(databaseUrl({
    DATABASE_URL: 'postgres://ep-test-pooler.region.aws.neon.tech/db?sslmode=verify-full',
    DATABASE_URL_UNPOOLED: direct,
  }, { migration: true }), direct);
});
