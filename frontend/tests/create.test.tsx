import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApplicationWorkspace from '../src/ApplicationWorkspace';
import { ApiError } from '../src/application-api.js';
const saved = { id: 'app-1', document_type_id: 'service-1', document_type_name: 'Barangay Clearance', purpose: 'Employment', status: 'draft', updated_at: '2026-11-07T00:00:00Z' };
const makeApi = () => ({ services: vi.fn().mockResolvedValue([{ id: 'service-1', name: 'Barangay Clearance' }]), create: vi.fn().mockResolvedValue(saved) });
beforeEach(() => { window.location.hash = '/applications'; });
async function fill(api = makeApi()) {
  render(<ApplicationWorkspace api={api} name="Test Citizen" onSignOut={() => {}} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'New application' }));
  await screen.findByRole('option', { name: 'Barangay Clearance' });
  await userEvent.selectOptions(screen.getByLabelText('Service'), 'service-1');
  await userEvent.type(screen.getByLabelText('Purpose'), 'Employment');
  return api;
}
test('creates a draft and displays the saved reference', async () => {
  const api = await fill(); await userEvent.click(screen.getByRole('button', { name: 'Save application' }));
  expect(await screen.findByText('Application created successfully.')).toBeTruthy();
  expect(screen.getByText('Reference: app-1')).toBeTruthy();
  expect(api.create).toHaveBeenCalledWith({ document_type_id: 'service-1', purpose: 'Employment' });
});
test('failed create retains input and does not retry automatically', async () => {
  const api = makeApi(); api.create.mockRejectedValue(new ApiError(0, 'NETWORK', ''));
  await fill(api); await userEvent.click(screen.getByRole('button', { name: 'Save application' }));
  await screen.findByRole('alert'); expect((screen.getByLabelText('Purpose') as HTMLTextAreaElement).value).toBe('Employment');
  expect(api.create).toHaveBeenCalledTimes(1);
});
test('a pending save blocks duplicate submissions', async () => {
  const api = makeApi(); let finish: (value: unknown) => void = () => {};
  api.create.mockImplementation(() => new Promise(resolve => { finish = resolve; })); await fill(api);
  await userEvent.click(screen.getByRole('button', { name: 'Save application' }));
  expect((screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement).disabled).toBe(true);
  finish(saved); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(api.create).toHaveBeenCalledTimes(1);
});
