import { useEffect, useRef, useState } from 'react';
import { Brand, Button } from './DesignUI';
import Modal from './Modal';
import { ApiError, createApplicationApi, errorMessage } from './application-api.js';
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
  const previous = useRef({ identity, route });
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    // Reset external resource state before starting a request for this identity.
    // oxlint-disable-next-line react/set-state-in-effect
    if (previous.current.identity !== identity || previous.current.route !== route) setData(null);
    previous.current = { identity, route };
    // Reset the request indicators while retaining a same-resource refresh.
    // oxlint-disable-next-line react/set-state-in-effect
    setError(null); setLoading(true);
    loadRef.current(controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(reason => { if (!controller.signal.aborted) { setData(null); setError(reason); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // The caller supplies the identity and route that determine this resource.
  }, [identity, route, version]);
  return { data, error, loading, refresh: () => setVersion(v => v + 1) };
}

function ApplicationForm({ api, onSaved, close }: { api: Api; onSaved: (app: Application) => void; close: () => void }) {
  const services = useResource<Service[]>(signal => api.services(signal), [api]);
  const [purpose, setPurpose] = useState('');
  const [service, setService] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState<unknown>(null);
  return <Modal labelledBy="application-form-title" onClose={() => { if (!locked.current) close(); }}>
    <h2 id="application-form-title">New application</h2>
    <p>Choose a barangay document and describe why you need it. Your application will be saved as a draft.</p>
    <form className="workspace-form" onSubmit={async event => {
      event.preventDefault(); if (locked.current || !purpose.trim() || !services.data?.some(item => item.id === service)) return;
      locked.current = true; setBusy(true); setError(null);
      try {
        const body = { document_type_id: service, purpose: purpose.trim() };
        onSaved(await api.create(body));
      } catch (reason) { setError(reason); }
      finally { locked.current = false; setBusy(false); }
    }}>
      {services.loading && <p role="status">Loading services...</p>}
      {Boolean(services.error) && <ErrorNotice error={services.error} retry={services.refresh} />}
      <label>Service<select required value={service} onChange={e => { setService(e.target.value); if (error instanceof ApiError && error.status === 422) setError(null); }} disabled={busy || services.loading}>
        <option value="">Choose a service</option>{services.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      {services.data?.length === 0 && <p>No services are available. Try again later.</p>}
      <label>Purpose<textarea required maxLength={200} value={purpose} onChange={e => { setPurpose(e.target.value); if (error instanceof ApiError && error.status === 422) setError(null); }} disabled={busy} /></label>
      <small>{purpose.length}/200 characters</small>
      {Boolean(error) && <ErrorNotice error={error} />}
      <div className="workspace-actions"><Button type="button" variant="secondary" disabled={busy} onClick={close}>Cancel</Button>
        <Button type="submit" disabled={busy || !purpose.trim() || !services.data?.some(item => item.id === service)}>{busy ? 'Saving...' : 'Save application'}</Button></div>
    </form>
  </Modal>;
}

export default function ApplicationWorkspace({ api, name, onSignOut }: { api: Api; name: string; onSignOut: () => void }) {
  const [creating, setCreating] = useState(true);
  const [saved, setSaved] = useState<Application | null>(null);
  return <div className="workspace-shell"><header className="workspace-header"><Brand /><span>Signed in as {name}</span><Button variant="secondary" onClick={onSignOut}>Sign out</Button></header>
    <main className="workspace-main"><h1>My applications</h1><Button onClick={() => setCreating(true)}>New application</Button>
      {saved && <section className="workspace-card"><p role="status">Application created successfully.</p><h2>{saved.document_type_name}</h2><p>{saved.purpose}</p><p>Reference: {saved.id}</p><p>Status: {saved.status}</p></section>}
      {creating && <ApplicationForm api={api} close={() => setCreating(false)} onSaved={app => { setSaved(app); setCreating(false); }} />}
    </main></div>;
}
