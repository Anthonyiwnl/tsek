import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import NewApplication from '../src/NewApplication';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
test('a pending catalogue request reaches a recoverable deadline', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))));
  render(<NewApplication onExit={() => {}} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});
