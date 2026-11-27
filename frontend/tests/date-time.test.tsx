import { expect, test } from 'vitest';
import { formatDateTime } from '../src/date-time';

test('displayed timestamps retain the local date and minute but omit seconds', () => {
  const first = '2026-11-27T03:14:01Z';
  const later = '2026-11-27T03:14:59Z';
  expect(formatDateTime(first)).toBe(formatDateTime(later));
  expect(formatDateTime(first)).not.toBe(formatDateTime('2026-11-27T03:15:01Z'));
  expect(formatDateTime(first)).not.toBe(formatDateTime('2026-11-28T03:14:01Z'));
});
