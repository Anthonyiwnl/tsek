import { useRef, useState } from 'react';
import { Button } from './DesignUI';

export default function RequirementReviewForm({ aiStatus, save }: { aiStatus: string; save: (status: string, reason: string) => Promise<unknown> }) {
  const [status, setStatus] = useState(aiStatus);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const differs = status !== aiStatus;
  if (saved) return <p role="status">Requirement review recorded.</p>;
  return <form className="workspace-form" onSubmit={async event => {
    event.preventDefault(); if (locked.current) return;
    if (differs && !reason.trim()) { setError('Explain why you disagree with the AI check.'); return; }
    locked.current = true; setBusy(true); setError('');
    try { await save(status, reason.trim()); setSaved(true); }
    catch { setError('Unable to record requirement review. Refresh the application before trying again.'); }
    finally { locked.current = false; setBusy(false); }
  }}>
    <label>Your requirement decision<select value={status} disabled={busy} onChange={event => setStatus(event.target.value)}>
      <option value="complete">Complete</option><option value="incomplete">Incomplete</option><option value="uncertain">Uncertain</option>
    </select></label>
    <label>Reason {differs ? '(required)' : '(optional)'}<textarea value={reason} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
    <small>Explain the rule you applied. Do not copy names, addresses, ID numbers or document text.</small>
    {error && <p role="alert">{error}</p>}
    <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Record requirement review'}</Button>
  </form>;
}
