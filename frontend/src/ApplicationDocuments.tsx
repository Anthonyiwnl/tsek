import { useEffect, useRef, useState } from 'react';
import { Button } from './DesignUI';
import { createApplicationApi, errorMessage } from './application-api.js';

type Api = ReturnType<typeof createApplicationApi>;
type SavedFile = { id: string; original_name: string; revision: number; analysis_generation: number };
type Analysis = { id: string; file_id: string; file_revision: number; analysis_generation: number; is_current: boolean; status: string; normalized_result?: { extracted_fields: Record<string, string | null> } };
type Checklist = { is_complete: boolean; requirements: { id: string; name: string; status: string; reason: string }[] };

/** Reload all three persisted views together. Never display an old checklist during mutation. */
export default function ApplicationDocuments({ api, id, editable }: { api: Api; id: string; editable: boolean }) {
  const [snapshot, setSnapshot] = useState<{ files: SavedFile[]; analyses: Analysis[]; checklist: Checklist } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<File | null>(null);
  const [target, setTarget] = useState('');
  const [version, setVersion] = useState(0);
  const locked = useRef(false);
  const alive = useRef(true);
  const sequence = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    const request = ++sequence.current;
    // Hide prior results until the persisted file revisions and checklist are reloaded.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true); setSnapshot(null);
    Promise.all([api.files(id, controller.signal), api.analyses(id, controller.signal), api.checklist(id, controller.signal)])
      .then(([files, analyses, checklist]) => { if (!controller.signal.aborted && request === sequence.current) setSnapshot({ files, analyses, checklist }); })
      .catch(reason => { if (!controller.signal.aborted && request === sequence.current) setError(reason); })
      .finally(() => { if (!controller.signal.aborted && request === sequence.current) setLoading(false); });
    return () => controller.abort();
  }, [api, id, version]);

  async function run(fileId?: string) {
    if (locked.current) return;
    if (!fileId && (!selected || selected.type !== 'text/plain' || selected.size < 1 || selected.size > 2097152)) {
      setMessage('Choose a non-empty plain text file up to 2 MB. Analysis supports up to 10,000 text characters.'); return;
    }
    const previous = snapshot?.files.find(file => file.id === target);
    if (!fileId && target && !previous) return;
    locked.current = true; sequence.current++; setBusy(true); setError(null); setMessage('Saving and analyzing document...'); setSnapshot(null);
    try {
      const saved = fileId ? { id: fileId } : previous
        ? await api.replace(id, previous.id, previous.revision, selected)
        : await api.upload(id, selected);
      if (alive.current) setMessage('File saved. Analyzing the latest document...');
      await api.analyze(id, saved.id);
      if (alive.current) { setSelected(null); setTarget(''); setMessage('Analysis complete. Results refreshed from saved documents.'); }
    } catch (reason) { if (alive.current) { setError(reason); setMessage('Refresh documents before retrying if the connection was interrupted.'); } }
    finally {
      locked.current = false;
      if (alive.current) { setBusy(false); setSelected(null); setVersion(value => value + 1); }
    }
  }

  return <section className="workspace-card" aria-label="Application documents">
    <h2>Documents and checklist</h2>
    <p>These checks help you prepare your requirements. They do not approve your application. Plain text analysis is currently supported.</p>
    <Button variant="secondary" disabled={busy || loading} onClick={() => { setError(null); setVersion(value => value + 1); }}>Refresh documents</Button>
    {loading && <p>Loading saved documents and checklist...</p>}
    {message && <p role="status">{message}</p>}
    {Boolean(error) && <p role="alert">{errorMessage(error)}</p>}
    {snapshot && <>
      {snapshot.files.length === 0 && <p>No documents uploaded yet.</p>}
      <ul>{snapshot.files.map(file => {
        const current = snapshot.analyses.find(row => row.file_id === file.id && row.file_revision === file.revision && row.analysis_generation === file.analysis_generation && row.is_current);
        return <li key={file.id}><strong>{file.original_name}</strong> (version {file.revision})
          <p>{current ? current.status === 'completed' ? 'Analysis completed' : 'Analysis failed; retry to refresh the checklist.' : 'Awaiting analysis. Earlier results are not current.'}</p>
          {current?.normalized_result && <dl>{Object.entries(current.normalized_result.extracted_fields).map(([name, value]) => <div key={name}><dt>{name.replaceAll('_', ' ')}</dt><dd>{value || 'Not confirmed'}</dd></div>)}</dl>}
          {editable && <Button variant="secondary" disabled={busy} onClick={() => void run(file.id)}>Analyze {file.original_name} again</Button>}
        </li>;
      })}</ul>
      <h3>{snapshot.checklist.is_complete ? 'Required documents complete' : 'Requirements need attention'}</h3>
      <ul>{snapshot.checklist.requirements.map(item => <li key={item.id}><strong>{item.name}: {item.status}</strong><p>{item.reason}</p></li>)}</ul>
    </>}
    {editable && snapshot && <form className="workspace-form" onSubmit={event => { event.preventDefault(); void run(); }}>
      <label>Document to replace<select value={target} disabled={busy} onChange={event => setTarget(event.target.value)}><option value="">Upload an additional document</option>{snapshot.files.map(file => <option key={file.id} value={file.id}>{file.original_name} (version {file.revision})</option>)}</select></label>
      <label>Plain text document<input key={version} type="file" accept="text/plain,.txt" disabled={busy} onChange={event => setSelected(event.target.files?.[0] || null)} /></label>
      <p>A replacement keeps the application and document link, invalidates earlier results, and starts fresh analysis. If analysis fails, retry it on the saved file.</p>
      <Button type="submit" disabled={busy || !selected}>{target ? 'Replace and analyze' : 'Upload and analyze'}</Button>
    </form>}
  </section>;
}
