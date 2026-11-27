// Development-only fixture; excluded from the production entry point.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/tokens.css';
import '../../src/index.css';
import '../../src/App.css';
import Workspace from '../../src/ApplicationWorkspace';
const status = new URLSearchParams(location.search).get('status') || 'draft';
const params = new URLSearchParams(location.search);
const app = { id: '7c21a400-0000-4000-8000-000000000000', document_type_id: 'clearance', document_type_name: 'Barangay Clearance', purpose: 'Requirement for my new job', status, updated_at: '2026-11-17T10:00:00Z' };
const api = {
  me: async () => ({ role: 'citizen' }),
  list: async () => [app], services: async () => [{ id: 'clearance', name: 'Barangay Clearance' }],
  create: async (body: Partial<typeof app>) => Object.assign(app, body),
  update: async (_id: string, body: Partial<typeof app>) => Object.assign(app, body),
  remove: async () => {},
  get: async () => app,
  files: async () => params.has('documents') ? [{ id: 'sample', original_name: 'synthetic-proof-of-residency-with-a-long-document-name.txt', media_type: 'text/plain', size: 1200 }] : [],
  analyses: async () => params.has('documents') ? [{ id: 'analysis', file_id: 'sample', document_type_id: 'clearance', status: 'completed', error_code: null, normalized_result: { detected_document_type: 'Barangay Clearance', document_type_match: true, extracted_fields: { full_name: 'Demo Citizen', address: 'Synthetic address for layout testing only' }, requirements: [{ id: 'id', name: 'Valid government ID', status: 'complete', reason: 'Readable synthetic document.', is_required: true }] } }] : [], reviews: async () => [],
  checklist: async () => ({ is_complete: false, requirements: [
    { id: 'id', name: 'Valid government ID', is_required: true, status: 'complete', reason: 'Name and address are readable.' },
    { id: 'residency', name: 'Proof of residency', is_required: true, status: 'uncertain', reason: 'Your bill says Zone 5, but your ID says Zone 4. Upload a bill with your current address.' },
    { id: 'cedula', name: 'Community tax certificate (cedula)', is_required: false, status: 'uncertain', reason: 'If applicable — only if your barangay asks for it.' },
  ] }),
};
if (params.has('ready')) {
  const checklist = api.checklist;
  api.checklist = async () => { const saved = await checklist(); return { is_complete: true, requirements: saved.requirements.map(row => row.is_required ? { ...row, status: 'complete' } : row) }; };
}
if (params.get('state') === 'empty') api.list = async () => [];
if (params.get('state') === 'error') {
  api.list = api.get = async () => { throw new Error('Synthetic preview failure'); };
}
if (params.get('state') === 'loading') {
  api.list = () => new Promise(() => {});
  api.get = () => new Promise(() => {});
}
location.hash = new URLSearchParams(location.search).has('list') ? '/applications' : '/applications/' + app.id;
createRoot(document.getElementById('root')!).render(<><p style={{ padding: '8px 40px', background: 'var(--warning-tint)', color: 'var(--warning-text)' }}>Development preview · Synthetic records only</p><Workspace api={api as unknown as React.ComponentProps<typeof Workspace>['api']} name="Demo citizen" onSignOut={() => { location.href = '/'; }} /></>);
