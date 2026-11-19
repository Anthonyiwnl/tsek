import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Workspace from '../src/ApplicationWorkspace';
import StaffDashboard from '../src/StaffDashboard';
import { accessibilityViolations } from './a11y';

const app = { id: 'app-1', document_type_id: 'service-1', document_type_name: 'Barangay Clearance', purpose: 'Employment', status: 'draft', updated_at: '2026-10-27T00:00:00Z' };
function citizenApi() {
  return {
    submit: vi.fn(), reviews: vi.fn().mockResolvedValue([]),
    me: vi.fn(), staffList: vi.fn(), staffGet: vi.fn(), staffReview: vi.fn(), staffDownload: vi.fn(),
    list: vi.fn().mockResolvedValue([app]), get: vi.fn().mockResolvedValue(app), services: vi.fn().mockResolvedValue([{ id: 'service-1', name: 'Barangay Clearance' }]),
    create: vi.fn(), update: vi.fn(), remove: vi.fn(), replace: vi.fn(), upload: vi.fn(), analyze: vi.fn(),
    files: vi.fn().mockResolvedValue([{ id: 'file-1', original_name: 'sample.txt', size: 512, media_type: 'text/plain' }]),
    analyses: vi.fn().mockResolvedValue([]),
    checklist: vi.fn().mockResolvedValue({ is_complete: false, requirements: [{ id: 'req', name: 'Proof of residency', is_required: true, status: 'uncertain', reason: 'No matching analyzed document is available.' }] }),
  };
}
const submitted = { id: 'application-1', document_type_name: 'Barangay Clearance', purpose: 'Employment', status: 'submitted', updated_at: '2026-11-15T10:00:00Z' };
function staffApi() {
  return { me: vi.fn().mockResolvedValue({ role: 'staff' }),
    staffList: vi.fn().mockResolvedValue({ data: [submitted], hasMore: false }),
    staffGet: vi.fn().mockResolvedValue({ application: submitted, files: [], checklist: { requirements: [], is_complete: false }, reviews: [] }),
    staffReview: vi.fn(), staffDownload: vi.fn(),
  };
}
const showCitizen = () => render(<Workspace api={citizenApi()} name="Test citizen" onSignOut={() => {}} />);
const showStaff = () => render(<StaffDashboard api={staffApi() as unknown as React.ComponentProps<typeof StaffDashboard>['api']} name="Test staff" onSignOut={() => {}} />);

beforeEach(() => { window.location.hash = '/applications'; });

test('My applications has no accessibility violations', async () => {
  showCitizen();
  await screen.findByRole('link', { name: 'View application' });
  expect(await accessibilityViolations()).toEqual([]);
});

test('new application modal has no accessibility violations', async () => {
  showCitizen();
  await userEvent.click(await screen.findByRole('button', { name: 'New application' }));
  await screen.findByRole('button', { name: 'Save application' });
  expect(await accessibilityViolations()).toEqual([]);
});

test('application page with documents and checklist has no accessibility violations', async () => {
  window.location.hash = '/applications/app-1';
  showCitizen();
  await screen.findByRole('heading', { name: 'Barangay Clearance' });
  await screen.findByText('Proof of residency');
  expect(await accessibilityViolations()).toEqual([]);
});

test.each([
  ['submitted', 'Waiting for barangay staff', null],
  ['approved', 'Approved', 'Approved by barangay staff.'],
  ['rejected', 'Not approved', 'Please submit a clearer document.'],
])('read-only %s application state has no accessibility violations', async (status, heading, note) => {
  window.location.hash = '/applications/app-1';
  const api = citizenApi();
  api.get.mockResolvedValue({ ...app, status });
  if (note) api.reviews.mockResolvedValue([{ id: 'review-1', decision: status === 'approved' ? 'approved' : 'rejected', note, created_at: '2026-11-17T10:30:00Z' }]);
  render(<Workspace api={api as unknown as React.ComponentProps<typeof Workspace>['api']} name="Test citizen" onSignOut={() => {}} />);
  await screen.findByRole('heading', { name: heading });
  expect(await accessibilityViolations()).toEqual([]);
});

test('staff queue and review screen have no accessibility violations', async () => {
  window.location.hash = '/admin';
  showStaff();
  const open = await screen.findByRole('button', { name: /Open application/ });
  expect(await accessibilityViolations()).toEqual([]);
  await userEvent.click(open);
  await screen.findByRole('button', { name: 'Record decision' });
  expect(await accessibilityViolations()).toEqual([]);
});
