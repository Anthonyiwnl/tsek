import { useState } from 'react';
import { Badge, Brand, Button } from './DesignUI';
import { createApplicationApi, errorMessage } from './application-api.js';
import { useResource } from './useResource';
import './workspace.css';

type Application = { id: string; document_type_name: string; purpose: string; status: string; updated_at: string };

/** Summaries and records come only from the authenticated, owner-scoped API. */
export default function CitizenDashboard({ api, name, admin = false, onSignOut }: {
  api: ReturnType<typeof createApplicationApi>; name: string; admin?: boolean; onSignOut: () => void;
}) {
  const resource = useResource<Application[]>(signal => api.list(signal), [api]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const rows = resource.data?.filter(row => (!status || row.status === status)
    && `${row.id} ${row.document_type_name} ${row.purpose}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="workspace-shell">
    <header className="workspace-header"><Brand /><a href="#/applications">My applications</a>
      <a href={admin ? '#/dashboard' : '#/admin'}>{admin ? 'Dashboard' : 'Admin records'}</a>
      <span>Signed in as {name}</span><Button variant="secondary" onClick={onSignOut}>Sign out</Button></header>
    <main className="workspace-main">
      <div className="workspace-title"><div><h1>{admin ? 'Application records' : `Welcome, ${name}`}</h1>
        <p>{admin ? 'Records available to your signed-in account. Staff-wide queues and review actions are not available yet.' : 'Your saved barangay applications and their current status.'}</p></div>
        <Button variant="secondary" onClick={resource.refresh} disabled={resource.loading}>Refresh applications</Button></div>
      <div className="workspace-toolbar"><label>Search applications<input type="search" placeholder="Service, purpose, or reference" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>
          {[...new Set(resource.data?.map(row => row.status))].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
      {resource.loading && <p role="status">Loading applications...</p>}
      {Boolean(resource.error) && <div className="workspace-error" role="alert"><p>{errorMessage(resource.error)}</p><Button variant="secondary" onClick={resource.refresh}>Try again</Button></div>}
      {!resource.loading && resource.data && <>
        <p>{resource.data.length} saved applications · {resource.data.filter(row => row.status === 'draft').length} drafts</p>
        {resource.data.length === 0 ? <section className="workspace-card"><h2>No applications yet</h2><p>Create an application to begin preparing your documents.</p><a href="#/applications">Go to applications</a></section>
          : rows?.length === 0 ? <p role="status">No applications match your search or status filter.</p>
          : <section aria-label="Saved applications" className="application-grid">{rows?.map(row => <article key={row.id} className="workspace-card">
            <h2>{row.document_type_name}</h2><Badge tone={row.status === 'draft' ? 'neutral' : 'info'}>{row.status}</Badge>
            <p>{row.purpose}</p><small>Reference: {row.id}</small><small>Updated {new Date(row.updated_at).toLocaleString()}</small>
            <a href={'#/applications/' + encodeURIComponent(row.id)}>Open application</a>
          </article>)}</section>}
      </>}
      <p>AI assists preparation. Barangay staff make the final decision.</p>
    </main>
  </div>;
}
