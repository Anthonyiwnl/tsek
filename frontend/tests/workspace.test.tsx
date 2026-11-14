import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Workspace from '../src/ApplicationWorkspace';
import { ApiError } from '../src/application-api.js';

const app = { id: 'app-1', document_type_id: 'service-1', document_type_name: 'Barangay Clearance', purpose: 'Employment', status: 'draft', updated_at: '2026-10-27T00:00:00Z' };
function makeApi() {
  return {
    list: vi.fn().mockResolvedValue([app]), get: vi.fn().mockResolvedValue(app), services: vi.fn().mockResolvedValue([{ id: 'service-1', name: 'Barangay Clearance' }]),
    create: vi.fn().mockResolvedValue(app), update: vi.fn().mockResolvedValue(app), remove: vi.fn().mockResolvedValue(null),
    replace: vi.fn().mockResolvedValue({ id: 'file-2' }),
    files: vi.fn().mockResolvedValue([]), upload: vi.fn().mockResolvedValue({ id: 'file-1' }), analyses: vi.fn().mockResolvedValue([]), analyze: vi.fn().mockResolvedValue({}),
    checklist: vi.fn().mockResolvedValue({ is_complete: false, requirements: [{ id: 'req', name: 'Proof of residency', is_required: true, status: 'uncertain', reason: 'No matching analyzed document is available.' }] }),
  };
}
beforeEach(() => { window.location.hash = '/applications'; });
const show = (api: ReturnType<typeof makeApi>) => render(<Workspace api={api} name="Test citizen" onSignOut={() => {}} />);

test('refresh keeps the record while pending and removes it on a 404', async () => {
  window.location.hash = '/applications/app-1';
  const api = makeApi(); show(api);
  await screen.findByRole('heading', { name: 'Barangay Clearance' });
  let reject: (error: unknown) => void = () => {};
  api.get.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  await userEvent.click(screen.getByRole('button', { name: 'Refresh application' }));
  expect(screen.getByRole('heading', { name: 'Barangay Clearance' })).toBeTruthy();
  reject(new ApiError(404, '', ''));
  await screen.findByRole('alert');
  expect(screen.queryByRole('heading', { name: 'Barangay Clearance' })).toBeNull();
});
test('loads real response records, filters, and opens bookmarkable details', async () => {
  const api = makeApi(); show(api); expect(screen.getByRole('status').textContent).toContain('Loading');
  await userEvent.click(await screen.findByRole('button', { name: 'View application' }));
  await screen.findByRole('heading', { name: 'Barangay Clearance' });
  expect(window.location.hash).toBe('#/applications/app-1'); expect(api.get).toHaveBeenCalledWith('app-1', expect.any(AbortSignal));
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
test('a late list response cannot replace the selected detail view', async () => {
  let resolve: (data: unknown) => void = () => {};
  const api = makeApi(); api.list.mockImplementation(() => new Promise(r => { resolve = r; })); show(api);
  window.location.hash = '/applications/app-1'; window.dispatchEvent(new HashChangeEvent('hashchange'));
  await screen.findByRole('heading', { name: 'Barangay Clearance' }); resolve([{ ...app, document_type_name: 'Stale result' }]);
  await waitFor(() => expect(screen.queryByText('Stale result')).toBeNull());
});

test.each([422, 409, 0])('failed save preserves the form and clears only validation guidance (%s)', async status => {
  window.location.hash = '/applications/app-1';
  const api = makeApi(); api.update.mockRejectedValue(new ApiError(status, status === 0 ? 'NETWORK' : '', '')); show(api);
  await userEvent.click(await screen.findByRole('button', { name: 'Edit draft' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save application' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('heading', { name: 'Edit draft' })).toBeTruthy();
  await userEvent.type(screen.getByLabelText('Purpose'), ' changed');
  expect(screen.queryByRole('alert') !== null).toBe(status !== 422);
});

test('pending draft save disables submission until completion', async () => {
  window.location.hash = '/applications/app-1';
  const api = makeApi(); let finish: (value: unknown) => void = () => {};
  api.update.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); show(api);
  await userEvent.click(await screen.findByRole('button', { name: 'Edit draft' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save application' }));
  expect((screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement).disabled).toBe(true);
  finish(app);
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit draft' })).toBeNull());
  expect(api.update).toHaveBeenCalledTimes(1);
});


test('editing waits for refreshed fields before opening the draft form', async () => {
  window.location.hash = '/applications/app-1';
  const api = makeApi(); show(api);
  await screen.findByRole('button', { name: 'Edit draft' });
  let finish: (value: unknown) => void = () => {};
  api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await userEvent.click(screen.getByRole('button', { name: 'Refresh application' }));
  const edit = screen.getByRole('button', { name: 'Edit draft' }) as HTMLButtonElement;
  expect(edit.disabled).toBe(true);
  await userEvent.click(edit);
  expect(screen.queryByRole('dialog')).toBeNull();
  await act(async () => finish({ ...app, purpose: 'Refreshed purpose' }));
  expect(edit.disabled).toBe(false);
  await userEvent.click(edit);
  expect((screen.getByLabelText('Purpose') as HTMLTextAreaElement).value).toBe('Refreshed purpose');
});

test('upload stays separate from analysis and failed analysis can be retried', async () => {
  window.location.hash = '/applications/app-1'; const api = makeApi(); show(api);
  const chooser = await screen.findByLabelText('Choose a document');
  const file = new File(['Synthetic residency text'], 'sample.txt', { type: 'text/plain' });
  await userEvent.upload(chooser, file);
  api.files.mockResolvedValue([{ id: 'file-1', original_name: 'sample.txt', media_type: 'text/plain', size: 24 }]);
  await userEvent.click(screen.getByRole('button', { name: 'Upload document' }));
  expect(await screen.findByText('sample.txt')).toBeTruthy(); expect(api.analyze).not.toHaveBeenCalled();
  api.analyze.mockRejectedValueOnce(new ApiError(502, 'AI_PROVIDER_ERROR', ''));
  api.analyses.mockResolvedValue([{ id: 'result-1', file_id: 'file-1', status: 'failed', error_code: 'AI_PROVIDER_ERROR', normalized_result: null }]);
  await userEvent.click(screen.getByRole('button', { name: 'Analyze document' }));
  expect(await screen.findByRole('button', { name: 'Retry analysis' })).toBeTruthy();
  expect(screen.getAllByText('The analysis service could not process this document. Try again later.')[0]).toBeTruthy();
  api.analyses.mockResolvedValue([{ id: 'result-2', file_id: 'file-1', status: 'completed', error_code: null, normalized_result: { detected_document_type: 'Wrong service', document_type_match: false, extracted_fields: { full_name: null }, requirements: [{ id: 'req', name: 'Proof of residency', status: 'uncertain', reason: 'Address unreadable' }] } }]);
  await userEvent.click(screen.getByRole('button', { name: 'Retry analysis' }));
  expect(await screen.findByText('Needs review')).toBeTruthy(); expect(await screen.findByText('Not readable / not provided')).toBeTruthy();
  expect(screen.getByText('This document does not match the selected service. Check the document before continuing.')).toBeTruthy();
});
test.each([
  ['ANALYSES_UNAVAILABLE', 503, 'AI unavailable. Your document is saved. Try analysis again later.'],
  ['AI_TIMEOUT', 504, 'Analysis timed out. Refresh results before retrying.'],
  ['AI_INVALID_RESPONSE', 502, 'Analysis returned an unreadable result. No successful result was saved. Try again later.'],
  ['INVALID_DOCUMENT_TEXT', 400, 'Upload a readable UTF-8 text file containing non-empty text, then analyze the new file.'],
])('%s shows corrective guidance and refreshes failed analysis without automatic retry', async (code, status, message) => {
  window.location.hash = '/applications/app-1';
  const api = makeApi();
  api.files.mockResolvedValue([{ id: 'file-1', original_name: 'sample.txt', media_type: 'text/plain', size: 24 }]);
  show(api);
  const analyze = await screen.findByRole('button', { name: 'Analyze document' });
  await waitFor(() => expect((analyze as HTMLButtonElement).disabled).toBe(false));
  const readsBefore = api.analyses.mock.calls.length;
  api.analyze.mockRejectedValueOnce(new ApiError(status, code, ''));
  api.analyses.mockResolvedValue([{ id: 'result-1', file_id: 'file-1', status: 'failed', error_code: code, normalized_result: null }]);
  await userEvent.click(analyze);
  expect((await screen.findAllByText(message))[0]).toBeTruthy();
  expect(await screen.findByText('Failed', { exact: true })).toBeTruthy();
  expect(api.analyses.mock.calls.length).toBeGreaterThan(readsBefore);
  const retry = await screen.findByRole('button', { name: 'Retry analysis' });
  await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false));
  expect(api.analyze).toHaveBeenCalledTimes(1);
  await userEvent.click(retry);
  await waitFor(() => expect(api.analyze).toHaveBeenCalledTimes(2));
});

test.each([
  [null, 'Needs review'],
  ['', 'Needs review'],
  ['Test Citizen', 'Completed'],
])('extracted field %s produces status %s when all requirements match', async (value, expectedStatus) => {
  window.location.hash = '/applications/app-1';
  const api = makeApi();
  api.files.mockResolvedValue([{ id: 'file-1', original_name: 'sample.txt', media_type: 'text/plain', size: 24 }]);
  api.analyses.mockResolvedValue([{ id: 'result-1', file_id: 'file-1', status: 'completed', error_code: null,
    normalized_result: { detected_document_type: 'Barangay Clearance', document_type_match: true,
      extracted_fields: { full_name: value }, requirements: [{ id: 'req', name: 'Proof of residency', status: 'complete', reason: 'Verified' }] } }]);
  show(api);
  expect(await screen.findByText(expectedStatus, { exact: true })).toBeTruthy();
  if (!value) {
    expect(screen.getByText('Not readable / not provided')).toBeTruthy();
    expect(screen.queryByText('Completed', { exact: true })).toBeNull();
  }
});



test('file status distinguishes pending analysis reads, failed reads, and no analysis', async () => {
  window.location.hash = '/applications/app-1'; const api = makeApi();
  api.files.mockResolvedValue([{ id: 'file-1', original_name: 'sample.txt', media_type: 'text/plain', size: 24 }]);
  let reject: (reason: unknown) => void = () => {};
  api.analyses.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  show(api); await screen.findByText('sample.txt');
  expect(screen.getByText('Loading analysis', { exact: true })).toBeTruthy();
  expect(screen.queryByText('Not analyzed', { exact: true })).toBeNull();
  await act(async () => reject(new ApiError(503, '', '')));
  expect(screen.getByText('Analysis unavailable', { exact: true })).toBeTruthy();
  expect(screen.queryByText('Not analyzed', { exact: true })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Not analyzed', { exact: true })).toBeTruthy();
});

test.each([
  ['INVALID_DOCUMENT_TEXT', 'Upload a readable UTF-8 text file containing non-empty text, then analyze the new file.'],
  ['AI_TIMEOUT', 'Analysis timed out. Refresh results before retrying.'],
  ['AI_PROVIDER_ERROR', 'The analysis service could not process this document. Try again later.'],
  ['ANALYSIS_TIMEOUT', 'Analysis timed out. Refresh results before retrying.'],
  ['ANALYSIS_PROVIDER_FAILURE', 'The analysis service could not process this document. Try again later.'],
  ['INVALID_ANALYSIS', 'Analysis returned an unreadable result. No successful result was saved. Try again later.'],
  ['INVALID_EXTRACTION_INPUT', 'Upload a plain-text file containing 1 to 10,000 text characters, then analyze the new file.'],
  ['UNKNOWN_CODE', 'The request could not be completed. Refresh and try again.'],
])('reopened applications show persisted %s recovery instructions', async (code, message) => {
  window.location.hash = '/applications/app-1'; const api = makeApi();
  api.files.mockResolvedValue([{ id: 'file-1', original_name: 'sample.txt', media_type: 'text/plain', size: 24 }]);
  api.analyses.mockResolvedValue([{ id: 'result-1', file_id: 'file-1', status: 'failed', error_code: code, normalized_result: null }]);
  show(api); expect(await screen.findByText(message)).toBeTruthy();
  expect(api.analyze).not.toHaveBeenCalled();
});

test.each([true, false])('an empty checklist never claims completion or missing requirements (%s)', async complete => {
  window.location.hash = '/applications/app-1'; const api = makeApi();
  api.checklist.mockResolvedValue({ is_complete: complete, requirements: [] }); show(api);
  expect(await screen.findByText('No requirements available.')).toBeTruthy();
  expect(screen.queryByText('All required items are complete according to saved analysis.')).toBeNull();
  expect(screen.queryByText('Some required items need attention.')).toBeNull();
});


test.each([true, false])('synthetic create-upload-analyze-reopen journey retains checklist outcome (complete=%s)', async complete => {
  const api = makeApi();
  api.list.mockResolvedValue([]);
  show(api);
  await screen.findByRole('heading', { name: 'No applications yet' });
  await userEvent.click(screen.getByRole('button', { name: 'New application' }));
  await screen.findByRole('option', { name: 'Barangay Clearance' });
  await userEvent.selectOptions(screen.getByLabelText('Service'), 'service-1');
  await userEvent.type(screen.getByLabelText('Purpose'), 'Synthetic journey verification');
  await userEvent.click(screen.getByRole('button', { name: 'Save application' }));
  const chooser = await screen.findByLabelText('Choose a document');
  const file = new File(['Synthetic citizen residency document'], 'journey.txt', { type: 'text/plain' });
  await userEvent.upload(chooser, file);
  api.upload.mockRejectedValueOnce(new ApiError(503, '', ''));
  await userEvent.click(screen.getByRole('button', { name: 'Upload document' }));
  expect((await screen.findByRole('alert')).textContent).toContain('temporarily unavailable');
  expect((chooser as HTMLInputElement).files?.[0]).toBe(file);
  api.files.mockResolvedValue([{ id: 'file-1', original_name: file.name, media_type: file.type, size: file.size }]);
  await userEvent.click(screen.getByRole('button', { name: 'Upload document' }));
  await screen.findByText(file.name);
  expect(api.analyze).not.toHaveBeenCalled();
  const requirement = { id: 'req', name: 'Proof of residency', is_required: true,
    status: complete ? 'complete' : 'missing', reason: complete ? 'Address verified' : 'Address not provided' };
  api.analyses.mockResolvedValue([{ id: 'result-1', file_id: 'file-1', status: 'completed', error_code: null,
    normalized_result: { detected_document_type: 'Barangay Clearance', document_type_match: true,
      extracted_fields: { address: complete ? 'Synthetic address' : null }, requirements: [requirement] } }]);
  api.checklist.mockResolvedValue({ is_complete: complete, requirements: [requirement] });
  await userEvent.click(screen.getByRole('button', { name: 'Analyze document' }));
  const outcome = complete ? 'All required items are complete according to saved analysis.' : 'Some required items need attention.';
  await screen.findByText(outcome);
  expect(screen.getByText(complete ? 'Completed' : 'Needs review', { exact: true })).toBeTruthy();
  api.list.mockResolvedValue([app]);
  await userEvent.click(screen.getByRole('button', { name: 'Back to applications' }));
  await userEvent.click(await screen.findByRole('button', { name: 'View application' }));
  expect(await screen.findByText(outcome)).toBeTruthy();
  expect(api.analyze).toHaveBeenCalledTimes(1);
});

test('draft dialog supports keyboard navigation and restores focus on cancel', async () => {
  const api = makeApi(); show(api);
  const create = screen.getByRole('button', { name: 'New application' });
  create.focus();
  await userEvent.keyboard('{Enter}');
  await screen.findByRole('option', { name: 'Barangay Clearance' });
  // Supply visibility because jsdom has no layout; native trapping still needs browser QA.
  screen.getByRole('dialog').querySelectorAll('select, textarea, button').forEach(element => {
    vi.spyOn(element, 'getClientRects').mockReturnValue([new DOMRect(0, 0, 100, 30)] as unknown as DOMRectList);
  });
  screen.getByLabelText('Purpose').focus();
  await userEvent.type(screen.getByLabelText('Purpose'), 'Synthetic keyboard check');
  await userEvent.tab();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  await userEvent.keyboard('{Enter}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(create);
  expect(api.create).not.toHaveBeenCalled();
});


test.each([false, true])('replacement saves new identity and reanalyzes; unavailable=%s', async unavailable => {
  window.location.hash = '/applications/app-1'; const api = makeApi();
  api.files.mockResolvedValue([{ id: 'file-1', original_name: 'old.txt', media_type: 'text/plain', size: 20 }]);
  show(api);
  await userEvent.click(await screen.findByRole('button', { name: 'Replace old.txt' }));
  const file = new File(['Updated residency text'], 'new.txt', { type: 'text/plain' });
  await userEvent.upload(screen.getByLabelText('Choose a document'), file);
  api.files.mockResolvedValue([{ id: 'file-2', original_name: 'new.txt', media_type: 'text/plain', size: 22 }]);
  if (unavailable) api.analyze.mockRejectedValueOnce(new ApiError(503, 'ANALYSES_UNAVAILABLE', ''));
  await userEvent.click(screen.getByRole('button', { name: 'Replace and reanalyze' }));
  await waitFor(() => expect(api.analyze).toHaveBeenCalledWith('app-1', 'file-2'));
  expect(api.replace).toHaveBeenCalledWith('app-1', 'file-1', file);
  expect(api.upload).not.toHaveBeenCalled();
  expect(await screen.findByText('new.txt')).toBeTruthy();
  expect(screen.queryByText('old.txt')).toBeNull();
  if (unavailable) expect((await screen.findByRole('alert')).textContent).toContain('AI unavailable');
});

test('failed replacement retains original and does not analyze', async () => {
  window.location.hash = '/applications/app-1'; const api = makeApi();
  api.files.mockResolvedValue([{ id: 'file-1', original_name: 'old.txt', media_type: 'text/plain', size: 20 }]);
  api.replace.mockRejectedValue(new ApiError(413, '', '')); show(api);
  await userEvent.click(await screen.findByRole('button', { name: 'Replace old.txt' }));
  await userEvent.upload(screen.getByLabelText('Choose a document'), new File(['text'], 'new.txt', { type: 'text/plain' }));
  await userEvent.click(screen.getByRole('button', { name: 'Replace and reanalyze' }));
  expect((await screen.findByRole('alert')).textContent).toContain('too large');
  expect(api.analyze).not.toHaveBeenCalled(); expect(screen.getByText('old.txt')).toBeTruthy();
});
