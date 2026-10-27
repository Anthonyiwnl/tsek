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
});
test('empty list and API failure have distinct recovery states', async () => {
  const api = makeApi(); api.list.mockRejectedValueOnce(new ApiError(503, '', '')).mockResolvedValueOnce([]); show(api);
  expect((await screen.findByRole('alert')).textContent).toContain('unavailable');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'No applications yet' })).toBeTruthy();
});
test('a late list response cannot replace the selected detail view', async () => {
  let resolve: (data: unknown) => void = () => {};
  const api = makeApi(); api.list.mockImplementation(() => new Promise(r => { resolve = r; })); show(api);
  window.location.hash = '/applications/app-1'; window.dispatchEvent(new HashChangeEvent('hashchange'));
  await screen.findByRole('heading', { name: 'Barangay Clearance' }); resolve([{ ...app, document_type_name: 'Stale result' }]);
  await waitFor(() => expect(screen.queryByText('Stale result')).toBeNull());
});
