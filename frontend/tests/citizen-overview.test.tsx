import React from 'react';
import { expect, test, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CitizenOverview from '../src/CitizenOverview';
import { ApiError } from '../src/application-api.js';

const application = { id: '2026abcd-1234-4abc-9def-0123456789ab', document_type_name: 'Saved service', purpose: 'Employment', status: 'draft', updated_at: '2026-11-12T00:00:00Z' };
const apiWith = (list: ReturnType<typeof vi.fn>) => ({ list }) as unknown as React.ComponentProps<typeof CitizenOverview>['api'];
const overview = (api: ReturnType<typeof apiWith>) => <CitizenOverview api={api} create={() => {}} />;

test('overview uses one API list and searches real records by reference', async () => {
  const list = vi.fn().mockResolvedValue([application]);
  render(overview(apiWith(list)));
  expect(screen.getByRole('status').textContent).toContain('Loading');
  expect(await screen.findByRole('heading', { name: 'Saved service' })).toBeTruthy();
  expect(screen.getByText('Reference: TSK-2026AB')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'View application' }).getAttribute('href')).toBe('#/applications/' + encodeURIComponent(application.id));
  expect(list).toHaveBeenCalledTimes(1);
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

test('overview distinguishes failed and empty responses and supports retry', async () => {
  const list = vi.fn().mockRejectedValueOnce(new ApiError(503, '', '')).mockResolvedValue([]);
  render(overview(apiWith(list)));
  expect((await screen.findByRole('alert')).textContent).toContain('unavailable');
  expect(screen.queryByRole('region', { name: 'Application summary' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'No applications yet' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Needs attention' })).toBeNull();
});

test('late overview response is ignored after account change', async () => {
  let finish: (value: unknown) => void = () => {};
  const original = apiWith(vi.fn(() => new Promise(resolve => { finish = resolve; })));
  const next = apiWith(vi.fn().mockResolvedValue([]));
  const view = render(overview(original));
  view.rerender(overview(next));
  await screen.findByRole('heading', { name: 'No applications yet' });
  await act(async () => finish([application]));
  expect(screen.queryByText('Saved service')).toBeNull();
});


test('refresh drops a missing status filter in both the control and rows', async () => {
  const list = vi.fn().mockResolvedValueOnce([application]).mockResolvedValue([{ ...application, status: 'submitted' }]);
  render(overview(apiWith(list)));
  await screen.findByRole('heading', { name: 'Saved service' });
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'draft');
  await userEvent.click(screen.getByRole('button', { name: 'Refresh applications' }));
  await screen.findByRole('heading', { name: 'Saved service' });
  expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('');
  expect(screen.queryByRole('option', { name: 'Draft' })).toBeNull();
  expect(screen.queryByText('No applications match your search or status filter.')).toBeNull();
  expect(screen.getByRole('link', { name: 'View application' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Needs attention' })).toBeNull();
});

test('refresh preserves a status filter that still exists', async () => {
  const list = vi.fn().mockResolvedValue([application, { ...application, id: 'other', document_type_name: 'Other service', status: 'submitted' }]);
  render(overview(apiWith(list)));
  await screen.findByRole('heading', { name: 'Saved service' });
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'draft');
  await userEvent.click(screen.getByRole('button', { name: 'Refresh applications' }));
  await screen.findByRole('heading', { name: 'Saved service' });
  expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('draft');
  expect(screen.queryByRole('heading', { name: 'Other service' })).toBeNull();
});

test('the attention ticket and summary use the full list while Status filters the records', async () => {
  const list = vi.fn().mockResolvedValue([
    { ...application, id: 'submitted', document_type_name: 'Submitted service', status: 'submitted' },
    application,
    { ...application, id: 'older', updated_at: '2026-11-10T00:00:00Z' },
    { ...application, id: 'approved', document_type_name: 'Approved service', status: 'approved' },
    { ...application, id: 'rejected', document_type_name: 'Rejected service', status: 'rejected' },
  ]);
  render(overview(apiWith(list)));
  const attention = await screen.findByRole('region', { name: 'Needs attention' });
  expect(within(attention).getByRole('link', { name: 'Continue draft' }).getAttribute('href')).toBe('#/applications/' + application.id);
  const summary = screen.getByRole('region', { name: 'Application summary' });
  const assertCounts = () => expect(Array.from(summary.querySelectorAll('dt'), term => [
    term.textContent, term.nextElementSibling?.textContent,
  ])).toEqual([['Saved applications', '5'], ['Drafts', '2'], ['Awaiting review', '1'], ['Approved', '1'], ['Not approved', '1']]);
  assertCounts();

  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status', exact: true }), 'submitted');
  const records = within(screen.getByRole('region', { name: 'Saved applications' }));
  expect(records.getByRole('heading', { name: 'Submitted service' })).toBeTruthy();
  expect(records.queryByRole('heading', { name: 'Saved service' })).toBeNull();
  expect(screen.getByRole('region', { name: 'Needs attention' })).toBe(attention);
  assertCounts();
  expect(list).toHaveBeenCalledTimes(1);
});
