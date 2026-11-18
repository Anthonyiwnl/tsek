import { expect, test } from 'vitest';
import { toReference } from '../src/reference';

test.each([
  ['2026abcd-1234-4abc-9def-0123456789ab', 'TSK-2026AB'],
  ['abcdef12-3456-4abc-9def-0123456789ab', 'TSK-ABCDEF'],
])('formats %s as a short uppercase reference', (id, expected) => {
  expect(toReference(id)).toBe(expected);
});
