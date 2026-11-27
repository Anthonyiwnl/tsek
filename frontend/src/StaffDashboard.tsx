import { formatDateTime } from './date-time';
import AppHeader from './AppHeader';
import { useRef, useState, type KeyboardEvent } from 'react';
import { Badge, Button, Icon } from './DesignUI';
import RequirementEvidence, { type RequirementDecision } from './RequirementEvidence';
import { toReference } from './reference';
import { ApiError, createApplicationApi, errorMessage } from './application-api.js';
import { useResource } from './useResource';
import './workspace.css';
import './staff.css';

type Api = ReturnType<typeof createApplicationApi>;
type Application = { id: string; document_type_name: string; purpose: string; status: string; updated_at: string };
type Review = { id: string; decision: string; note: string; created_at: string };
type Detail = { application: Application; files: { id: string; original_name: string; size: number }[];
  checklist: { is_complete: boolean; requirements: RequirementDecision[] }; reviews: Review[] };
const labels: Record<string, string> = { submitted: 'Awaiting review', approved: 'Approved', rejected: 'Rejected' };
const statusTabs = [
  { value: '', label: 'All submitted records' },
  { value: 'submitted', label: 'Awaiting review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];
const date = formatDateTime;

function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  return <div className="workspace-error" role="alert"><p>{errorMessage(error)}</p><Button variant="secondary" onClick={retry}>Try again</Button></div>;
}

function ReviewPanel({ api, id, back }: { api: Api; id: string; back: () => void }) {
  const resource = useResource<Detail>(signal => api.staffGet(id, signal), [api, id]);
  const [decision, setDecision] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const record = resource.data;
  const denied = error instanceof ApiError && error.status === 403;
  const refresh = () => { setError(null); resource.refresh(); };
  return <>
    <Button variant="secondary" onClick={back} disabled={busy}>Back to review queue</Button>
    {resource.loading && <p role="status">Loading application and documents...</p>}
    {Boolean(resource.error) && <Failure error={resource.error} retry={resource.refresh} />}
    {Boolean(error) && <Failure error={error} retry={refresh} />}
    {notice && <p className="workspace-success motion-notice" key={notice} role="status">{notice}</p>}
    {!resource.loading && record && !denied && <>
      <div className="workspace-title"><div><h1>{record.application.document_type_name}</h1><p>{record.application.purpose}</p></div>
        <Badge tone={record.application.status === 'rejected' ? 'warning' : 'info'}>{labels[record.application.status]}</Badge></div>
      <p className="staff-reference">Reference: {toReference(id)}<br />Updated {date(record.application.updated_at)}</p>
      <div className="staff-review-layout"><section className="staff-evidence" aria-label="Application evidence">
        <h2>Uploaded documents</h2>
        <p>Open the original documents before recording a decision. AI checks assist your review.</p>
        {record.files.length === 0 ? <p>No documents are attached.</p> : <ul className="staff-documents">{record.files.map(file => <li key={file.id}>
          <div><strong>{file.original_name}</strong><small>{Math.ceil(file.size / 1024)} KB</small></div>
          <Button variant="secondary" disabled={busy} onClick={async () => {
            if (locked.current) return; locked.current = true; setBusy(true); setError(null);
            try {
              const blob = await api.staffDownload(id, file.id);
              const url = URL.createObjectURL(blob); const link = document.createElement('a');
              link.href = url; link.download = file.original_name; link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (reason) { setError(reason); } finally { locked.current = false; setBusy(false); }
          }}>Download {file.original_name}</Button>
        </li>)}</ul>}
        <h2>Requirement checks</h2><p>These are automated preparation checks, not a staff decision.</p>
        {record.checklist.requirements.length === 0 ? <p>No requirements are configured for this service.</p> : <ul className="staff-checklist">{record.checklist.requirements.map(item => <li key={item.id}>
          <div><strong>{item.name}</strong><span>{item.is_required ? 'Required' : 'If applicable'}</span></div>
          <p><strong>{item.status === 'complete' ? 'AI check complete' : 'Needs manual review'}</strong> · {item.reason}</p>
          <RequirementEvidence requirement={item} />
        </li>)}</ul>}
      </section><section className="staff-decision" aria-labelledby="decision-title"><h2 id="decision-title">Staff decision</h2>
        {record.application.status === 'submitted' ? <form className="workspace-form" onSubmit={async event => {
          event.preventDefault(); if (locked.current || !decision || !note.trim() || !confirmed) return;
          locked.current = true; setBusy(true); setError(null); setNotice('');
          try { await api.staffReview(id, { decision, note: note.trim() }); setNotice('Decision recorded. The applicant can view your note.'); setConfirmed(false); }
          catch (reason) { setError(reason); }
          finally { locked.current = false; setBusy(false); resource.refresh(); }
        }}>
          <label>Decision<select required value={decision} disabled={busy} onChange={event => { setDecision(event.target.value); setConfirmed(false); }}>
            <option value="">Choose a decision</option><option value="approved">Approve application</option><option value="rejected">Reject application</option>
          </select></label>
          <label>Note to applicant<textarea required maxLength={2000} disabled={busy} value={note} onChange={event => { setNote(event.target.value); setConfirmed(false); }} placeholder="Explain the decision and any next steps." /></label>
          <small>{note.length}/2000 characters · Visible to the applicant</small>
          <label className="staff-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>I reviewed the documents and confirm this decision. It cannot be changed here.</span></label>
          <Button type="submit" disabled={busy || !confirmed || !decision || !note.trim()}>{busy ? 'Saving...' : 'Record decision'}</Button>
        </form> : <p>This application has a recorded decision and is read-only.</p>}
        {record.reviews.map(review => <div className="staff-review-note" key={review.id}><h3>{labels[review.decision]}</h3><p>{review.note}</p><small>{date(review.created_at)}</small></div>)}
        <Button variant="secondary" disabled={busy} onClick={refresh}>Refresh record</Button>
      </section></div>
    </>}
  </>;
}

function Queue({ api, open }: { api: Api; open: (id: string) => void }) {
  const [status, setStatus] = useState('submitted');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const key = JSON.stringify({ status, filter, offset });
  const resource = useResource<{ data: Application[]; hasMore: boolean }>(signal => api.staffList({ status, search: filter, limit: '25', offset: String(offset) }, signal), [api, key]);
  const selectAdjacentTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = statusTabs.length - 1;
    const next = event.key === 'ArrowRight' ? (index + 1) % statusTabs.length
      : event.key === 'ArrowLeft' ? (index + last) % statusTabs.length
        : event.key === 'Home' ? 0
          : event.key === 'End' ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    setStatus(statusTabs[next].value);
    setOffset(0);
    tabRefs.current[next]?.focus();
  };
  return <>
    <section className="staff-queue" aria-labelledby="staff-queue-title">
      <div className="staff-queue-heading"><div><p className="staff-eyebrow">Staff workspace</p><h1 id="staff-queue-title">Application review queue</h1><p>Review submitted barangay applications, starting with the oldest.</p></div><Button variant="secondary" size="sm" onClick={resource.refresh} disabled={resource.loading}>Refresh queue</Button></div>
      <div className="staff-queue-controls">
        <div className="staff-tabs" role="tablist" aria-label="Application status">
          {statusTabs.map((tab, index) => <button
            key={tab.value || 'all'}
            ref={element => { tabRefs.current[index] = element; }}
            id={`staff-status-tab-${index}`}
            className="staff-tab"
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            aria-controls="staff-queue-panel"
            tabIndex={status === tab.value ? 0 : -1}
            onClick={() => { setStatus(tab.value); setOffset(0); }}
            onKeyDown={event => selectAdjacentTab(event, index)}
          >{tab.label}</button>)}
        </div>
        <form className="staff-search" role="search" onSubmit={event => { event.preventDefault(); setOffset(0); setFilter(search.trim()); }}>
          <label className="staff-search-field"><span className="sr-only">Search applications</span><Icon name="search" size={18} /><input type="search" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search applications" /></label>
          <Button type="submit" size="sm" iconLeft="search">Search</Button>
        </form>
      </div>
      <div id="staff-queue-panel" className="staff-queue-content" role="tabpanel" aria-labelledby={`staff-status-tab-${statusTabs.findIndex(tab => tab.value === status)}`} tabIndex={0}>
        {resource.loading && <p className="staff-loading" role="status">Loading review queue...</p>}
        {Boolean(resource.error) && <Failure error={resource.error} retry={resource.refresh} />}
        {!resource.loading && resource.data && (resource.data.data.length === 0 ? <section className="staff-empty"><h2>No applications in this view</h2><p>Try another status or search. Drafts remain private until the applicant submits them.</p></section> : <div className="staff-table-wrap"><table className="staff-table">
          <caption>Applications {offset + 1}–{offset + resource.data.data.length}</caption>
          <thead><tr><th scope="col">Application</th><th scope="col">Status</th><th scope="col">Updated</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
          <tbody>{resource.data.data.map(app => <tr key={app.id}><td><strong>{app.document_type_name}</strong><p>{app.purpose}</p><small>Reference: {toReference(app.id)}</small></td>
            <td data-label="Status"><Badge tone={app.status === 'rejected' ? 'warning' : app.status === 'approved' ? 'success' : 'info'}>{labels[app.status] ?? app.status}</Badge></td><td data-label="Updated"><time dateTime={app.updated_at}>{date(app.updated_at)}</time></td>
            <td className="staff-row-action"><Button variant="secondary" size="sm" iconRight="arrow" onClick={() => open(app.id)}>Open application</Button></td></tr>)}</tbody>
        </table></div>)}
        <nav className="staff-pagination" aria-label="Queue pages"><Button variant="secondary" size="sm" disabled={!offset || resource.loading} onClick={() => setOffset(value => Math.max(0, value - 25))}>Previous page</Button>
          <span>Page {offset / 25 + 1}</span><Button variant="secondary" size="sm" disabled={!resource.data?.hasMore || resource.loading} onClick={() => setOffset(value => value + 25)}>Next page</Button></nav>
      </div>
    </section>
  </>;
}

export default function StaffDashboard({ api, name, onSignOut }: { api: Api; name: string; onSignOut: () => void }) {
  const identity = useResource<{ role: string }>(signal => api.me(signal), [api]);
  const [id, setId] = useState('');
  const allowed = identity.data && ['staff', 'admin'].includes(identity.data.role);
  return <div className="workspace-shell staff-shell"><AppHeader name={name} links={[{ href: '#/applications', label: 'My applications' }]} onSignOut={onSignOut} />
    <main className="workspace-main">
      {identity.loading && <p role="status">Checking staff access...</p>}
      {Boolean(identity.error) && <Failure error={identity.error} retry={identity.refresh} />}
      {!identity.loading && identity.data && !allowed && <section className="staff-empty"><h1>Staff access required</h1><p>This account has citizen access. Ask your project administrator to assign a staff or admin role.</p><a href="#/applications">Go to my applications</a><Button variant="secondary" onClick={identity.refresh}>Check access again</Button></section>}
      {allowed && (id ? <ReviewPanel key={id} api={api} id={id} back={() => setId('')} /> : <Queue api={api} open={setId} />)}
    </main></div>;
}
