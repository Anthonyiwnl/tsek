import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Workspace from '../src/ApplicationWorkspace';
import { ApiError } from '../src/application-api.js';

const app = { id: 'app-1', document_type_id: 'service-1', document_type_name: 'Barangay Clearance', purpose: 'Employment', status: 'draft', updated_at: '2026-10-27T00:00:00Z' };
function makeApi() {
  return {
    list: vi.fn().mockResolvedValue([app]), get: vi.fn().mockResolvedValue(app), services: vi.fn().mockResolvedValue([{ id: 'service-1', name: 'Barangay Clearance' }]),
    create: vi.fn().mockResolvedValue(app), update: vi.fn().mockResolvedValue(app), remove: vi.fn().mockResolvedValue(null),
    files: vi.fn().mockResolvedValue([]), upload: vi.fn().mockResolvedValue({ id: 'file-1' }), analyses: vi.fn().mockResolvedValue([]), analyze: vi.fn().mockResolvedValue({}),
    checklist: vi.fn().mockResolvedValue({ is_complete: false, requirements: [{ id: 'req', name: 'Proof of residency', is_required: true, status: 'uncertain', reason: 'No matching analyzed document is available.' }] }),
  };
}
beforeEach(() => { window.location.hash = '/applications'; });
const show = (api: ReturnType<typeof makeApi>) => render(<Workspace api={api} name="Test citizen" onSignOut={() => {}} />);
test('loads real response records, filters, and opens bookmarkable details', async () => {
  const api = makeApi(); show(api); expect(screen.getByRole('status').textContent).toContain('Loading');
  await userEvent.click(await screen.findByRole('button', { name: 'View application' }));
  await screen.findByRole('heading', { name: 'Barangay Clearance' });
  expect(window.location.hash).toBe('#/applications/app-1'); expect(api.get).toHaveBeenCalledWith('app-1', expect.any(AbortSignal));
  expect(await screen.findByText('No documents uploaded yet.')).toBeTruthy();
});
test('empty list and API failure have distinct recovery states', async () => {
  const api = makeApi(); api.list.mockRejectedValueOnce(new ApiError(503, '', '')).mockResolvedValueOnce([]); show(api);
  expect((await screen.findByRole('alert')).textContent).toContain('unavailable');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'No applications yet' })).toBeTruthy();
});
test('editing sends validated fields, then re-reads persisted details', async () => {
  window.location.hash = '/applications/app-1'; const api = makeApi(); show(api);
  await userEvent.click(await screen.findByRole('button', { name: 'Edit draft' }));
  const purpose = await screen.findByLabelText('Purpose'); await userEvent.clear(purpose); await userEvent.type(purpose, 'Updated purpose');
  api.get.mockResolvedValue({ ...app, purpose: 'Updated purpose' });
  await userEvent.click(screen.getByRole('button', { name: 'Save application' }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith('app-1', { document_type_id: 'service-1', purpose: 'Updated purpose' }));
  expect(await screen.findByText('Updated purpose')).toBeTruthy();
});
test('delete cancellation sends nothing; failed deletion keeps the record; success re-fetches list', async () => {
  window.location.hash = '/applications/app-1'; const api = makeApi(); show(api);
  await userEvent.click(await screen.findByRole('button', { name: 'Delete draft' }));
  await userEvent.click(screen.getByRole('button', { name: 'Keep application' })); expect(api.remove).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
  api.remove.mockRejectedValueOnce(new ApiError(409, '', ''));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
  expect((await screen.findByRole('alert')).textContent).toContain('no longer editable'); expect(window.location.hash).toContain('app-1');
  api.list.mockResolvedValue([]); await userEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
  expect(await screen.findByRole('heading', { name: 'No applications yet' })).toBeTruthy();
});
test('non-draft application has no mutation buttons and missing records show a recovery message', async () => {
  window.location.hash = '/applications/app-1'; const api = makeApi(); api.get.mockResolvedValue({ ...app, status: 'submitted' }); show(api);
  await screen.findByText('This application is read-only. Only drafts can be edited or deleted.');
  expect(screen.queryByRole('button', { name: 'Edit draft' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Delete draft' })).toBeNull();
  api.get.mockRejectedValue(new ApiError(404, '', '')); await userEvent.click(screen.getByRole('button', { name: 'Refresh application' }));
  expect((await screen.findByRole('alert')).textContent).toContain('record is unavailable');
});
test('upload stays separate from analysis and failed analysis can be retried', async () => {
  window.location.hash = '/applications/app-1'; const api = makeApi(); show(api);
  const chooser = await screen.findByLabelText('Choose a document');
  const file = new File(['Synthetic residency text'], 'sample.txt', { type: 'text/plain' });
  await userEvent.upload(chooser, file);
  api.files.mockResolvedValue([{ id: 'file-1', original_name: 'sample.txt', media_type: 'text/plain', size: 24 }]);
  await userEvent.click(screen.getByRole('button', { name: 'Upload document' }));
  expect(await screen.findByText('sample.txt')).toBeTruthy(); expect(api.analyze).not.toHaveBeenCalled();
  api.analyze.mockRejectedValueOnce(new ApiError(503, 'AI_UNAVAILABLE', ''));
  api.analyses.mockResolvedValue([{ id: 'result-1', file_id: 'file-1', status: 'failed', error_code: 'AI_UNAVAILABLE', normalized_result: null }]);
  await userEvent.click(screen.getByRole('button', { name: 'Analyze document' }));
  expect(await screen.findByRole('button', { name: 'Retry analysis' })).toBeTruthy();
  api.analyses.mockResolvedValue([{ id: 'result-2', file_id: 'file-1', status: 'completed', error_code: null, normalized_result: { detected_document_type: 'Wrong service', document_type_match: false, extracted_fields: { full_name: null }, requirements: [{ id: 'req', name: 'Proof of residency', status: 'uncertain', reason: 'Address unreadable' }] } }]);
  await userEvent.click(screen.getByRole('button', { name: 'Retry analysis' }));
  expect(await screen.findByText('Needs review')).toBeTruthy(); expect(await screen.findByText('Not readable / not provided')).toBeTruthy();
  expect(screen.getByText('This document does not match the selected service. Check the document before continuing.')).toBeTruthy();
});
test('a late list response cannot replace the selected detail view', async () => {
  let resolve: (data: unknown) => void = () => {};
  const api = makeApi(); api.list.mockImplementation(() => new Promise(r => { resolve = r; })); show(api);
  window.location.hash = '/applications/app-1'; window.dispatchEvent(new HashChangeEvent('hashchange'));
  await screen.findByRole('heading', { name: 'Barangay Clearance' }); resolve([{ ...app, document_type_name: 'Stale result' }]);
  await waitFor(() => expect(screen.queryByText('Stale result')).toBeNull());
});
