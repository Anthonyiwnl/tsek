import { useEffect, useRef, useState } from 'react';
import { Badge, Brand, Button } from './DesignUI';
import { createApplicationApi, errorMessage } from './application-api.js';
import './workspace.css';

type Api = ReturnType<typeof createApplicationApi>;
type Application = { id: string; document_type_id: string; document_type_name: string; purpose: string; status: string; updated_at: string };
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
  const app = resource.data;
  return <><Button variant="secondary" onClick={back}>Back to applications</Button>
    {resource.loading && <p role="status">Loading application...</p>}
    {Boolean(resource.error) && <ErrorNotice error={resource.error} retry={resource.refresh} />}
    {app && <section className="workspace-card"><div className="workspace-title"><div><span className="section-kicker">Application details</span><h1>{app.document_type_name}</h1></div><Badge tone="info">{app.status}</Badge></div>
      <p>{app.purpose}</p><small>Reference: {app.id}</small>
      <Button variant="secondary" onClick={resource.refresh}>Refresh application</Button>
    </section>}
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
