import { useEffect, useRef, useState } from 'react';
import { Badge, Brand, Button } from './DesignUI';
import Modal from './Modal';
import { createApplicationApi, errorMessage } from './application-api.js';
import './workspace.css';

type Api = ReturnType<typeof createApplicationApi>;
type Application = { id: string; document_type_id: string; document_type_name: string; purpose: string; status: string; updated_at: string };
type Service = { id: string; name: string };
function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div className="workspace-error" role="alert"><p>{errorMessage(error)}</p>{retry && <Button variant="secondary" onClick={retry}>Try again</Button>}</div>;
}

/** Fetch a fresh resource for each identity or route; late responses cannot replace newer data. */
function useResource<T>(load: (signal: AbortSignal) => Promise<T>, dependencies: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [identity, route] = dependencies;
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    // Reset external resource state before starting a request for this identity.
    // oxlint-disable-next-line react/set-state-in-effect
    setData(null); setError(null); setLoading(true);
    loadRef.current(controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // The caller supplies the identity and route that determine this resource.
  }, [identity, route, version]);
  return { data, error, loading, refresh: () => setVersion(v => v + 1) };
}

function ApplicationForm({ api, current, onSaved, close }: { api: Api; current: Application; onSaved: (app: Application) => void; close: () => void }) {
  const services = useResource<Service[]>(signal => api.services(signal), [api]);
  const [purpose, setPurpose] = useState(current.purpose);
  const [service, setService] = useState(current.document_type_id);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState<unknown>(null);
  return <Modal labelledBy="application-form-title" onClose={() => { if (!locked.current) close(); }}>
    <h2 id="application-form-title">Edit draft</h2>
    <form className="workspace-form" onSubmit={async event => {
      event.preventDefault(); if (locked.current) return;
      locked.current = true; setBusy(true); setError(null);
      try {
        const body = { document_type_id: service, purpose: purpose.trim() };
        onSaved(await api.update(current.id, body));
      } catch (reason) { setError(reason); }
      finally { locked.current = false; setBusy(false); }
    }}>
      {services.loading && <p role="status">Loading services...</p>}
      {Boolean(services.error) && <ErrorNotice error={services.error} retry={services.refresh} />}
      <label>Service<select required value={service} onChange={e => setService(e.target.value)} disabled={busy || services.loading}>
        <option value="">Choose a service</option>{services.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      {services.data?.length === 0 && <p>No services are available. Try again later.</p>}
      <label>Purpose<textarea required maxLength={200} value={purpose} onChange={e => setPurpose(e.target.value)} disabled={busy} /></label>
      <small>{purpose.length}/200 characters</small>
      {Boolean(error) && <ErrorNotice error={error} />}
      <div className="workspace-actions"><Button type="button" variant="secondary" disabled={busy} onClick={close}>Cancel</Button>
        <Button type="submit" disabled={busy || !purpose.trim() || !services.data?.some(item => item.id === service)}>{busy ? 'Saving...' : 'Save application'}</Button></div>
    </form>
  </Modal>;
}

function ApplicationList({ api, open }: { api: Api; open: (id: string) => void }) {
  const resource = useResource<Application[]>(signal => api.list(signal), [api]);
  const [search, setSearch] = useState('');
  const rows = resource.data?.filter(app => `${app.document_type_name} ${app.purpose} ${app.id}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <div className="workspace-title"><div><span className="section-kicker">Your workspace</span><h1>My applications</h1><p>Your saved applications, in one place.</p></div></div>
    <div className="workspace-toolbar"><label>Search applications<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Service, purpose, or reference" /></label><Button variant="secondary" onClick={resource.refresh}>Refresh applications</Button></div>
    {resource.loading && <p role="status">Loading your applications...</p>}
    {Boolean(resource.error) && <ErrorNotice error={resource.error} retry={resource.refresh} />}
    {resource.data?.length === 0 && <section className="workspace-card"><h2>No applications yet</h2><p>Your saved applications will appear here.</p></section>}
    {!!resource.data?.length && rows?.length === 0 && <p role="status">No applications match your search.</p>}
    <div className="application-grid">{rows?.map(app => <article className="workspace-card" key={app.id}>
      <Badge tone={app.status === 'draft' ? 'neutral' : 'info'}>{app.status}</Badge><h2>{app.document_type_name}</h2>
      <p>{app.purpose}</p><small>Reference: {app.id}</small><small>Updated {new Date(app.updated_at).toLocaleString()}</small>
      <Button variant="secondary" onClick={() => open(app.id)}>View application</Button>
    </article>)}</div>
  </>;
}

function ApplicationDetails({ api, id, back }: { api: Api; id: string; back: () => void }) {
  const resource = useResource<Application>(signal => api.get(id, signal), [api, id]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const app = resource.data;
  return <><Button variant="secondary" disabled={busy} onClick={back}>Back to applications</Button>
    {resource.loading && <p role="status">Loading application...</p>}
    {Boolean(resource.error) && <ErrorNotice error={resource.error} retry={resource.refresh} />}
    {notice && <p role="status">{notice}</p>}
    {app && <><section className="workspace-card"><div className="workspace-title"><div><span className="section-kicker">Application details</span><h1>{app.document_type_name}</h1></div><Badge tone="info">{app.status}</Badge></div>
      <p>{app.purpose}</p><small>Reference: {app.id}</small>
      <div className="workspace-actions"><Button variant="secondary" onClick={resource.refresh}>Refresh application</Button>
        {app.status === 'draft' && <><Button onClick={() => setEditing(true)}>Edit draft</Button><Button variant="danger" onClick={() => setDeleting(true)}>Delete draft</Button></>}</div>
      {app.status !== 'draft' && <p>This application is read-only. Only drafts can be edited or deleted.</p>}
    </section>
      {editing && <ApplicationForm api={api} current={app} close={() => setEditing(false)} onSaved={() => { setEditing(false); setNotice('Application saved.'); resource.refresh(); }} />}
      {deleting && <Modal labelledBy="delete-application-title" onClose={() => { if (!locked.current) setDeleting(false); }}>
        <h2 id="delete-application-title">Delete this draft?</h2><p>This permanently removes the saved application and its documents. This cannot be undone.</p>
        {Boolean(error) && <ErrorNotice error={error} />}
        <div className="workspace-actions"><Button variant="secondary" disabled={busy} onClick={() => { setDeleting(false); setError(null); }}>Keep application</Button><Button variant="danger" disabled={busy} onClick={async () => {
          if (locked.current) return; locked.current = true; setBusy(true); setError(null);
          try { await api.remove(id); back(); } catch (reason) { setError(reason); } finally { locked.current = false; setBusy(false); }
        }}>{busy ? 'Deleting...' : 'Confirm deletion'}</Button></div>
      </Modal>}
    </>}
  </>;
}

/** This screen receives a verified session's API client; no mock application records are used. */
export default function ApplicationWorkspace({ api, name, onSignOut }: { api: Api; name: string; onSignOut: () => void }) {
  const readId = () => /^#\/applications\/([^/]+)$/.exec(window.location.hash)?.[1] || '';
  const [id, setId] = useState(readId);
  useEffect(() => { const changed = () => setId(readId()); window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, []);
  const open = (value: string) => { window.location.hash = '/applications/' + encodeURIComponent(value); setId(value); };
  const back = () => { window.location.hash = '/applications'; setId(''); };
  return <div className="workspace-shell"><header className="workspace-header"><Brand /><span>Signed in as {name}</span><Button variant="secondary" onClick={onSignOut}>Sign out</Button></header>
    <main className="workspace-main">{id ? <ApplicationDetails key={id} api={api} id={id} back={back} /> : <ApplicationList api={api} open={open} />}</main>
  </div>;
}
