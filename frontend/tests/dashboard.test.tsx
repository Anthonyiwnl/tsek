import React from 'react';
import { expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CitizenDashboard from '../src/CitizenDashboard';
import { ApiError } from '../src/application-api.js';

const application = { id: 'saved-123', document_type_name: 'Saved service', purpose: 'Employment', status: 'draft', updated_at: '2026-11-12T00:00:00Z' };
const apiWith = (list: ReturnType<typeof vi.fn>) => ({ list }) as unknown as React.ComponentProps<typeof CitizenDashboard>['api'];

test.each([false, true])('dashboard uses API records and filters real rows (admin=%s)', async admin => {
  const list = vi.fn().mockResolvedValue([application]);
  render(<CitizenDashboard api={apiWith(list)} name="Signed-in citizen" admin={admin} onSignOut={() => {}} />);
  expect(screen.getByRole('status').textContent).toContain('Loading');
  expect(await screen.findByRole('heading', { name: 'Saved service' })).toBeTruthy();
  expect(screen.getByText('1 saved applications · 1 drafts')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open application' }).getAttribute('href')).toBe('#/applications/saved-123');
  expect(list).toHaveBeenCalledWith(expect.any(AbortSignal));
  await userEvent.type(screen.getByLabelText('Search applications'), 'missing');
  expect(screen.getByRole('status').textContent).toContain('No applications match');
  expect(screen.queryByText(/Alex|blurry|TSK-2026/)).toBeNull();
});

test('dashboard distinguishes failed and empty responses and supports retry', async () => {
  const list = vi.fn().mockRejectedValueOnce(new ApiError(503, '', '')).mockResolvedValue([]);
  render(<CitizenDashboard api={apiWith(list)} name="Citizen" onSignOut={() => {}} />);
  expect((await screen.findByRole('alert')).textContent).toContain('unavailable');
  expect(screen.queryByText('0 saved applications · 0 drafts')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'No applications yet' })).toBeTruthy();
});

test('late dashboard response is ignored after account change', async () => {
  let finish: (value: unknown) => void = () => {};
  const original = apiWith(vi.fn(() => new Promise(resolve => { finish = resolve; })));
  const next = apiWith(vi.fn().mockResolvedValue([]));
  const view = render(<CitizenDashboard api={original} name="Original" onSignOut={() => {}} />);
  view.rerender(<CitizenDashboard api={next} name="Next" onSignOut={() => {}} />);
  await screen.findByRole('heading', { name: 'No applications yet' });
  await act(async () => finish([application]));
  expect(screen.queryByText('Saved service')).toBeNull();
});
