import React from 'react';
import { expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffDashboard from '../src/StaffDashboard';
import { ApiError } from '../src/application-api.js';

const application = { id: 'application-1', document_type_name: 'Barangay Clearance', purpose: 'Employment', status: 'submitted', updated_at: '2026-11-15T10:00:00Z' };
function makeApi() {
  return { me: vi.fn().mockResolvedValue({ role: 'staff' }),
    staffList: vi.fn().mockResolvedValue({ data: [application], hasMore: false }),
    staffGet: vi.fn().mockResolvedValue({ application, files: [], checklist: { requirements: [], is_complete: false }, reviews: [] }),
    staffReview: vi.fn().mockResolvedValue({}), staffDownload: vi.fn(),
  };
}
const show = (api: ReturnType<typeof makeApi>) => render(<StaffDashboard api={api as unknown as React.ComponentProps<typeof StaffDashboard>['api']} name="Test staff" onSignOut={() => {}} />);

test('citizen role and failed access check never request shared records', async () => {
  const api = makeApi(); api.me.mockResolvedValue({ role: 'citizen' }); show(api);
  await screen.findByRole('heading', { name: 'Staff access required' });
  expect(api.staffList).not.toHaveBeenCalled();
  api.me.mockRejectedValue(new ApiError(503, '', ''));
  await userEvent.click(screen.getByRole('button', { name: 'Check access again' }));
  await screen.findByRole('alert');
  expect(api.staffList).not.toHaveBeenCalled();
});

test('queue searches and paginates on the server, clears rows when access is revoked', async () => {
  const api = makeApi(); api.staffList.mockResolvedValue({ data: [application], hasMore: true }); show(api);
  await screen.findByText('Barangay Clearance');
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText('Page 2');
  expect(api.staffList).toHaveBeenLastCalledWith(expect.objectContaining({ offset: '25' }), expect.any(AbortSignal));
  await userEvent.type(screen.getByLabelText('Search applications'), 'Employment');
  await userEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
  await screen.findByText('Page 1');
  expect(api.staffList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Employment', offset: '0' }), expect.any(AbortSignal));
  api.staffList.mockRejectedValue(new ApiError(403, 'STAFF_REQUIRED', ''));
  await userEvent.click(screen.getByRole('button', { name: 'Refresh queue' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('Barangay Clearance')).toBeNull();
});

test('decision requires a note and confirmation, prevents double saves and refreshes recorded outcome', async () => {
  const api = makeApi(); show(api);
  await userEvent.click(await screen.findByRole('button', { name: 'Open application' }));
  const save = await screen.findByRole('button', { name: 'Record decision' });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  await userEvent.selectOptions(screen.getByLabelText('Decision'), 'rejected');
  await userEvent.type(screen.getByLabelText('Note to applicant'), 'Please upload a current document.');
  expect((save as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole('checkbox'));
  let finish: (value: unknown) => void = () => {};
  api.staffReview.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await userEvent.click(save);
  expect((screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.staffReview).toHaveBeenCalledTimes(1);
  expect(api.staffReview).toHaveBeenCalledWith('application-1', { decision: 'rejected', note: 'Please upload a current document.' });
  api.staffGet.mockResolvedValue({ application: { ...application, status: 'rejected' }, files: [], checklist: { requirements: [], is_complete: false }, reviews: [] });
  await act(async () => finish({}));
  await screen.findByText('This application has a recorded decision and is read-only.');
  expect(screen.queryByRole('button', { name: 'Record decision' })).toBeNull();
});

test('queue has separate error and empty states with retry', async () => {
  const api = makeApi(); api.staffList.mockRejectedValueOnce(new ApiError(503, '', '')).mockResolvedValue({ data: [], hasMore: false }); show(api);
  await screen.findByRole('alert');
  expect(screen.queryByText('No applications in this view')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByRole('heading', { name: 'No applications in this view' });
});

test('review conflict keeps the note and requires a fresh record', async () => {
  const api = makeApi(); api.staffReview.mockRejectedValue(new ApiError(409, 'REVIEW_CONFLICT', '')); show(api);
  await userEvent.click(await screen.findByRole('button', { name: 'Open application' }));
  await userEvent.selectOptions(await screen.findByLabelText('Decision'), 'approved');
  await userEvent.type(screen.getByLabelText('Note to applicant'), 'Documents checked.');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Record decision' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Another reviewer');
  expect((await screen.findByLabelText('Note to applicant') as HTMLTextAreaElement).value).toBe('Documents checked.');
  expect(api.staffGet).toHaveBeenCalledTimes(2);
});
