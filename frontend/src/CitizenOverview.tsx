import { useState } from 'react';
import { Badge, Button, Icon } from './DesignUI';
import { createApplicationApi, errorMessage } from './application-api.js';
import { useResource } from './useResource';
import { toReference } from './reference';
import './citizen-overview.css';

type Application = { id: string; document_type_name: string; purpose: string; status: string; updated_at: string };
const statusDetails = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Awaiting review', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Not approved', tone: 'error' },
} as const;
const detailsFor = (status: string) => Object.hasOwn(statusDetails, status)
  ? statusDetails[status as keyof typeof statusDetails]
  : { label: status, tone: 'neutral' as const };
const applicationHref = (id: string) => '#/applications/' + encodeURIComponent(id);

/** Show the citizen's summary, next draft and saved records from the same API list. */
export default function CitizenOverview({ api, create }: {
  api: ReturnType<typeof createApplicationApi>; create: () => void;
}) {
  const resource = useResource<Application[]>(signal => api.list(signal), [api]);
  const { data } = resource;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const statuses = [...new Set(data?.map(row => row.status))];
  const effectiveStatus = statuses.includes(status) ? status : '';
  const rows = data?.filter(row => (!effectiveStatus || row.status === effectiveStatus)
    && `${row.id} ${toReference(row.id)} ${row.document_type_name} ${row.purpose}`.toLowerCase().includes(query.toLowerCase()));
  // The API returns the most recently updated records first. Only drafts can be continued.
  const nextDraft = data?.find(row => row.status === 'draft');
  return <div className="citizen-overview">
      <div className="workspace-title"><div><span className="section-kicker">Your workspace</span><h1>My applications</h1>
        <p>Your saved barangay applications and their current status.</p></div>
        <Button onClick={create} iconLeft="plus">New application</Button></div>
      {data && <>
        {nextDraft && <section className="overview-attention" aria-labelledby="overview-attention-title">
          <div>
            <h2 id="overview-attention-title"><Icon name="warning" /> Needs attention</h2>
            <p><strong>{nextDraft.document_type_name}</strong> · {toReference(nextDraft.id)}</p>
            <p>Continue preparing your draft before submitting it for staff review.</p>
          </div>
          <a href={applicationHref(nextDraft.id)}>Continue draft</a>
        </section>}
        <section className="workspace-card overview-summary" aria-labelledby="overview-summary-title">
          <h2 id="overview-summary-title">Application summary</h2>
          <dl>
            <div><dt>Saved applications</dt><dd>{data.length}</dd></div>
            {Object.entries(statusDetails).map(([value, detail]) => <div key={value}>
              <dt>{value === 'draft' ? 'Drafts' : detail.label}</dt>
              <dd>{data.filter(row => row.status === value).length}</dd>
            </div>)}
          </dl>
        </section>
      </>}
      <section className="overview-records" aria-labelledby="overview-records-title">
        <h2 id="overview-records-title">Saved applications</h2>
        <div className="workspace-toolbar">
          <label>Search applications<input type="search" placeholder="Service, purpose, or reference" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <label>Status<select value={effectiveStatus} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>
            {statuses.map(value => <option key={value} value={value}>{detailsFor(value).label}</option>)}</select></label>
          <Button variant="secondary" onClick={resource.refresh} disabled={resource.loading}>Refresh applications</Button>
        </div>
        {resource.loading && <p role="status">Loading applications...</p>}
        {Boolean(resource.error) && <div className="workspace-error" role="alert">
          <p>{errorMessage(resource.error)}</p><Button variant="secondary" onClick={resource.refresh}>Try again</Button>
        </div>}
        {!resource.loading && data && <>
          {data.length === 0 ? <div className="workspace-card"><h3>No applications yet</h3><p>Create an application to begin preparing your documents.</p></div>
            : rows?.length === 0 ? <p role="status">No applications match your search or status filter.</p>
            : <div className="application-grid">{rows?.map(row => {
              const { label, tone } = detailsFor(row.status);
              return <article key={row.id} className="workspace-card">
                <div><Badge tone={tone}>{label}</Badge></div>
                <h3>{row.document_type_name}</h3>
                <p>{row.purpose}</p><small>Reference: {toReference(row.id)}</small>
                <small>Updated <time dateTime={row.updated_at}>{new Date(row.updated_at).toLocaleString()}</time></small>
                <a href={applicationHref(row.id)}>View application</a>
              </article>;
            })}</div>}
        </>}
      </section>
      <p>AI assists preparation. Barangay staff make the final decision.</p>
  </div>;
}
