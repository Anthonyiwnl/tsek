import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Workspace from '../src/ApplicationWorkspace';
import { ApiError } from '../src/application-api.js';
const app = { id: 'app-1', document_type_id: 'service-1', document_type_name: 'Barangay Clearance', purpose: 'Employment', status: 'draft', updated_at: '2026-11-07T00:00:00Z' };
const makeApi = () => ({ list: vi.fn().mockResolvedValue([app]), get: vi.fn().mockResolvedValue(app), services: vi.fn().mockResolvedValue([{ id: 'service-1', name: 'Barangay Clearance' }]), files: vi.fn().mockResolvedValue([]), analyses: vi.fn().mockResolvedValue([]), checklist: vi.fn().mockResolvedValue({ requirements: [], is_complete: false }), create: vi.fn().mockResolvedValue(app), update: vi.fn().mockResolvedValue(app), remove: vi.fn().mockResolvedValue(undefined) });
beforeEach(() => { window.history.replaceState(null, '', '/applications'); });
function renderWorkspace(api = makeApi()) { render(<Workspace api={api} name="Citizen" onSignOut={() => {}} />); return api; }

test('create dialog contains keyboard focus and restores its opening button on cancellation', async () => {
  renderWorkspace();
  const opener = screen.getByRole('button', { name: 'New application' });
  await userEvent.click(opener);
  const dialog = screen.getByRole('dialog');
  expect(dialog.contains(document.activeElement)).toBe(true);
  await screen.findByRole('option', { name: 'Barangay Clearance' });
  await userEvent.selectOptions(screen.getByLabelText('Service'), 'service-1');
  await userEvent.type(screen.getByLabelText('Purpose'), 'Employment');
  const rects = vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 10, height: 10 }] as unknown as DOMRectList);
  const first = screen.getByRole('button', { name: 'Close dialog' });
  const last = screen.getByRole('button', { name: 'Save application' });
  last.focus(); await userEvent.tab(); expect(document.activeElement).toBe(first);
  await userEvent.tab({ shift: true }); expect(document.activeElement).toBe(last);
  rects.mockRestore();
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(opener);
});

test('field validation and rejected service messages describe their fields', async () => {
  const api = makeApi(); api.create.mockRejectedValue(new ApiError(422, 'INVALID_SERVICE', ''));
  renderWorkspace(api); await userEvent.click(screen.getByRole('button', { name: 'New application' }));
  await screen.findByRole('option', { name: 'Barangay Clearance' });
  const service = screen.getByLabelText('Service'); const purpose = screen.getByLabelText('Purpose');
  fireEvent.blur(service); fireEvent.blur(purpose);
  expect(service.getAttribute('aria-describedby')).toBe('application-service-error');
  expect(document.getElementById('application-service-error')?.textContent).toBe('Choose a service.');
  expect(purpose.getAttribute('aria-describedby')).toContain('application-purpose-error');
  await userEvent.selectOptions(service, 'service-1'); await userEvent.type(purpose, 'Employment');
  expect(purpose.getAttribute('aria-invalid')).toBe('false');
  await userEvent.click(screen.getByRole('button', { name: 'Save application' }));
  await screen.findByText('The selected service or its requirements are no longer available.');
  expect(service.getAttribute('aria-invalid')).toBe('true');
  expect(service.getAttribute('aria-describedby')).toBe('application-service-error');
});

test.each(['Edit draft', 'Delete draft'])('%s restores focus and cannot close during a mutation', async action => {
  window.history.replaceState(null, '', '/applications/app-1');
  const api = makeApi(); let reject: (error: Error) => void = () => {};
  const pending = vi.fn(() => new Promise((_resolve, fail) => { reject = fail; }));
  if (action === 'Edit draft') api.update = pending; else api.remove = pending;
  renderWorkspace(api); const opener = await screen.findByRole('button', { name: action });
  await userEvent.click(opener);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(document.activeElement).toBe(opener);
  await userEvent.click(opener);
  if (action === 'Edit draft') await screen.findByRole('option', { name: 'Barangay Clearance' });
  await userEvent.click(screen.getByRole('button', { name: action === 'Edit draft' ? 'Save application' : 'Confirm deletion' }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.getByRole('dialog')).toBeTruthy(); expect(pending).toHaveBeenCalledTimes(1);
  reject(new ApiError(0, 'NETWORK', ''));
  await screen.findByRole('alert');
  await userEvent.click(screen.getByRole('button', { name: action === 'Edit draft' ? 'Cancel' : 'Keep application' }));
  await waitFor(() => expect(document.activeElement).toBe(opener));
});
