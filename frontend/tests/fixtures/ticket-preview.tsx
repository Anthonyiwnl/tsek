// Development-only fixture; excluded from the production entry point.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/tokens.css';
import '../../src/index.css';
import Workspace from '../../src/ApplicationWorkspace';
const status = new URLSearchParams(location.search).get('status') || 'draft';
const app = { id: '7c21a400-0000-4000-8000-000000000000', document_type_id: 'clearance', document_type_name: 'Barangay Clearance', purpose: 'Requirement for my new job', status, updated_at: '2026-11-17T10:00:00Z' };
const api = {
  list: async () => [app], services: async () => [{ id: 'clearance', name: 'Barangay Clearance' }],
  create: async (body: Partial<typeof app>) => Object.assign(app, body),
  update: async (_id: string, body: Partial<typeof app>) => Object.assign(app, body),
  remove: async () => {},
  get: async () => app, files: async () => [], analyses: async () => [], reviews: async () => [],
  checklist: async () => ({ is_complete: false, requirements: [
    { id: 'id', name: 'Valid government ID', is_required: true, status: 'complete', reason: 'Name and address are readable.' },
    { id: 'residency', name: 'Proof of residency', is_required: true, status: 'uncertain', reason: 'Your bill says Zone 5, but your ID says Zone 4. Upload a bill with your current address.' },
    { id: 'cedula', name: 'Community tax certificate (cedula)', is_required: false, status: 'uncertain', reason: 'If applicable — only if your barangay asks for it.' },
  ] }),
};
location.hash = new URLSearchParams(location.search).has('list') ? '/applications' : '/applications/' + app.id;
createRoot(document.getElementById('root')!).render(<><p style={{ padding: '8px 40px', background: 'var(--warning-tint)', color: 'var(--warning-text)' }}>Development preview · Synthetic records only</p><Workspace api={api as unknown as React.ComponentProps<typeof Workspace>['api']} name="Demo citizen" onSignOut={() => { location.href = '/'; }} /></>);
