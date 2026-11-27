import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Workspace from '../src/ApplicationWorkspace';
import StaffDashboard from '../src/StaffDashboard';
import { accessibilityViolations } from './a11y';

const app = { id: 'app-1', document_type_id: 'service-1', document_type_name: 'Barangay Clearance', purpose: 'Employment', status: 'draft', updated_at: '2026-10-27T00:00:00Z' };
const sourceLine = '<b>Account holder:</b> Sara Reyes';
const checklist = { is_complete: false, requirements: [
  { id: 'residency', name: 'Proof of residency', is_required: true, status: 'incomplete', reason: 'Address is missing.', evidence_lines: ['STATEMENT OF ACCOUNT', sourceLine] },
  { id: 'identity', name: 'Government ID', is_required: true, status: 'complete', reason: 'Document matches.' },
  { id: 'cedula', name: 'Cedula', is_required: false, status: 'uncertain', reason: 'No matching analyzed document is available.' },
] };
function citizenApi() {
  return {
    submit: vi.fn(), reviews: vi.fn().mockResolvedValue([]),
    me: vi.fn(), staffList: vi.fn(), staffGet: vi.fn(), staffReview: vi.fn(), staffDownload: vi.fn(),
    list: vi.fn().mockResolvedValue([app]), get: vi.fn().mockResolvedValue(app), services: vi.fn().mockResolvedValue([{ id: 'service-1', name: 'Barangay Clearance' }]),
    create: vi.fn(), update: vi.fn(), remove: vi.fn(), replace: vi.fn(), upload: vi.fn(), analyze: vi.fn(),
    files: vi.fn().mockResolvedValue([{ id: 'file-1', original_name: 'sample.txt', size: 512, media_type: 'text/plain' }]),
    analyses: vi.fn().mockResolvedValue([]),
    checklist: vi.fn().mockResolvedValue(checklist),
  };
}
const submitted = { id: 'application-1', document_type_name: 'Barangay Clearance', purpose: 'Employment', status: 'submitted', updated_at: '2026-11-15T10:00:00Z' };
function staffApi() {
  return { me: vi.fn().mockResolvedValue({ role: 'staff' }),
    staffList: vi.fn().mockResolvedValue({ data: [submitted], hasMore: false }),
    staffGet: vi.fn().mockResolvedValue({ application: submitted, files: [], checklist, reviews: [] }),
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
  const summary = screen.getByLabelText('Why was this flagged? Proof of residency');
  const details = summary.closest('details') as HTMLDetailsElement;
  expect(details.open).toBe(false);
  expect(screen.queryByLabelText('Why was this flagged? Government ID')).toBeNull();
  await userEvent.click(summary);
  expect(details.open).toBe(true);
  expect(document.activeElement).toBe(summary);
  expect(details.querySelector('blockquote')?.textContent).toBe(`STATEMENT OF ACCOUNT\n${sourceLine}`);
  expect(details.querySelector('b')).toBeNull();
  const empty = screen.getByLabelText('Why was this flagged? Cedula');
  await userEvent.tab();
  expect(document.activeElement).toBe(empty);
  await userEvent.click(empty);
  expect(empty.closest('details')?.open).toBe(true);
  expect(screen.getByText('No evidence was returned for this requirement.')).toBeTruthy();
  expect(await accessibilityViolations()).toEqual([]);
});

test('document disclosure and inline validation have no accessibility violations', async () => {
  window.location.hash = '/applications/app-1';
  const api = citizenApi();
  api.analyses.mockResolvedValue([{
    id: 'result-1', document_type_id: 'service-1', file_id: 'file-1', status: 'completed', error_code: null,
    normalized_result: { detected_document_type: 'Other service', document_type_match: false,
      extracted_fields: { full_name: 'Test citizen' }, requirements: [
        { id: 'document-check', name: 'Document check', status: 'uncertain', reason: 'Wrong document type.', evidence_lines: ['Title: Other service'] },
      ] },
  }]);
  render(<Workspace api={api} name="Test citizen" onSignOut={() => {}} />);
  const toggle = await screen.findByRole('button', { name: 'Show what TSEK read' });
  await userEvent.click(screen.getByRole('button', { name: 'Upload document' }));
  await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  expect(await accessibilityViolations()).toEqual([]);
  await userEvent.click(toggle);
  const flagged = screen.getByLabelText('Why was this flagged? Document check');
  await userEvent.click(flagged);
  expect(flagged.closest('details')?.querySelector('blockquote')?.textContent).toBe('Title: Other service');
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
  await userEvent.click(screen.getByLabelText('Why was this flagged? Proof of residency'));
  expect(screen.getByRole('blockquote').textContent).toContain(sourceLine);
  expect(await accessibilityViolations()).toEqual([]);
});
