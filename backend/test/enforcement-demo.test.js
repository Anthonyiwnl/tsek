// Temporary: proves a failing API test fails the required check (#23). Reverted in the next commit.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('enforcement demo: this test fails on purpose', () => {
  assert.equal(1, 2);
});
