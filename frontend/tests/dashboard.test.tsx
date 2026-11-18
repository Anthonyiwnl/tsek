import React from 'react';
import { expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CitizenDashboard from '../src/CitizenDashboard';
import { ApiError } from '../src/application-api.js';

const application = { id: '2026abcd-1234-4abc-9def-0123456789ab', document_type_name: 'Saved service', purpose: 'Employment', status: 'draft', updated_at: '2026-11-12T00:00:00Z' };
const apiWith = (list: ReturnType<typeof vi.fn>) => ({ list }) as unknown as React.ComponentProps<typeof CitizenDashboard>['api'];

test.each([false, true])('dashboard uses API records and filters real rows (admin=%s)', async admin => {
  const list = vi.fn().mockResolvedValue([application]);
  render(<CitizenDashboard api={apiWith(list)} name="Signed-in citizen" admin={admin} onSignOut={() => {}} />);
  expect(screen.getByRole('status').textContent).toContain('Loading');
  expect(await screen.findByRole('heading', { name: 'Saved service' })).toBeTruthy();
  expect(screen.getByText('1 saved applications · 1 drafts')).toBeTruthy();
  expect(screen.getByText('Reference: TSK-2026AB')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open application' }).getAttribute('href')).toBe('#/applications/' + encodeURIComponent(application.id));
  expect(list).toHaveBeenCalledWith(expect.any(AbortSignal));
  const search = screen.getByLabelText('Search applications');
  await userEvent.type(search, 'TSK-2026AB');
  expect(screen.getByRole('heading', { name: 'Saved service' })).toBeTruthy();
  await userEvent.clear(search);
  await userEvent.type(search, 'missing');
  expect(screen.getByRole('status').textContent).toContain('No applications match');
  expect(screen.queryByText(/Alex|blurry/)).toBeNull();
  expect(screen.queryByText('Reference: TSK-2026AB')).toBeNull();
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


test.each([false, true])('refresh drops a missing status filter in both the control and rows (admin=%s)', async admin => {
  const list = vi.fn().mockResolvedValueOnce([application]).mockResolvedValue([{ ...application, status: 'submitted' }]);
  render(<CitizenDashboard api={apiWith(list)} name="Citizen" admin={admin} onSignOut={() => {}} />);
  await screen.findByRole('heading', { name: 'Saved service' });
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'draft');
  await userEvent.click(screen.getByRole('button', { name: 'Refresh applications' }));
  await screen.findByRole('heading', { name: 'Saved service' });
  expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('');
  expect(screen.queryByRole('option', { name: 'draft' })).toBeNull();
  expect(screen.queryByText('No applications match your search or status filter.')).toBeNull();
  expect(screen.getByRole('link', { name: 'Open application' })).toBeTruthy();
});

test('refresh preserves a status filter that still exists', async () => {
  const list = vi.fn().mockResolvedValue([application, { ...application, id: 'other', document_type_name: 'Other service', status: 'submitted' }]);
  render(<CitizenDashboard api={apiWith(list)} name="Citizen" onSignOut={() => {}} />);
  await screen.findByRole('heading', { name: 'Saved service' });
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'draft');
  await userEvent.click(screen.getByRole('button', { name: 'Refresh applications' }));
  await screen.findByRole('heading', { name: 'Saved service' });
  expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('draft');
  expect(screen.queryByRole('heading', { name: 'Other service' })).toBeNull();
});
