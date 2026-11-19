// Development-only visual fixture. Not imported by the app or production build.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/tokens.css';
import '../../src/index.css';
import StaffDashboard from '../../src/StaffDashboard';

const applications = [
  { id: '11111111-1111-4111-8111-111111111111', document_type_name: 'Barangay Clearance', purpose: 'Employment requirements', status: 'submitted', updated_at: '2026-11-15T00:30:00Z' },
  { id: '22222222-2222-4222-8222-222222222222', document_type_name: 'Certificate of Residency', purpose: 'School enrollment', status: 'submitted', updated_at: '2026-11-15T02:15:00Z' },
];
const reviews: Record<string, { id: string; decision: string; note: string; created_at: string }[]> = {};
const api = {
  me: async () => ({ role: 'admin' }),
  staffList: async ({ status, search }: { status: string; search: string }) => ({ data: applications.filter(app => (!status || app.status === status) && `${app.document_type_name} ${app.purpose}`.toLowerCase().includes(search.toLowerCase())), hasMore: false }),
  staffGet: async (id: string) => ({ application: applications.find(app => app.id === id), files: [{ id: 'sample-file', original_name: 'sample-proof-of-residency.txt', size: 128 }],
    checklist: { is_complete: false, requirements: [
      { id: 'id', name: 'Valid government-issued ID', is_required: true, status: 'complete', reason: 'The document matches this requirement and the extracted fields are complete.' },
      { id: 'residency', name: 'Proof of residency', is_required: true, status: 'uncertain', reason: 'No matching analyzed document is available.' },
    ] }, reviews: reviews[id] || [] }),
  staffDownload: async () => new Blob(['Synthetic sample document. No personal data.'], { type: 'text/plain' }),
  staffReview: async (id: string, data: { decision: string; note: string }) => {
    const app = applications.find(app => app.id === id)!; app.status = data.decision;
    reviews[id] = [{ ...data, id: 'sample-review', created_at: new Date().toISOString() }];
  },
};
createRoot(document.getElementById('root')!).render(<><p style={{ padding: '12px 24px', margin: 0, background: '#fff1cc', color: '#594600' }}>Development preview · Synthetic records only · No real account access</p><StaffDashboard api={api as unknown as React.ComponentProps<typeof StaffDashboard>['api']} name="Demo staff" onSignOut={() => { window.location.href = '/'; }} /></>);
