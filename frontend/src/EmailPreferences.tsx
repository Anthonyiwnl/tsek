import { useState } from 'react';
import { Button } from './DesignUI';
import Modal from './Modal';
import { ApiError } from './application-api.js';

export default function EmailPreferences({ load, save }: { load: () => Promise<{ enabled: boolean }>; save: (enabled: boolean) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  return <><Button variant="secondary" onClick={async () => {
    setOpen(true); setBusy(true); setError('');
    try { setEnabled((await load()).enabled); } catch { setError('Email preferences are unavailable.'); }
    finally { setBusy(false); }
  }}>Email preferences</Button>
    {open && <Modal labelledBy="email-preferences-title" onClose={() => { if (!busy) setOpen(false); }}>
      <h2 id="email-preferences-title">Decision emails</h2><p>Receive the decision, staff note and application link at your verified sign-in email. Uploaded documents are never attached.</p>
      {error && <p role="alert">{error}</p>}
      <label><input type="checkbox" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)} />Email me when staff decide on my application</label>
      <Button disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { await save(enabled); setOpen(false); }
        catch (reason) { setError(reason instanceof ApiError && reason.code === 'VERIFIED_EMAIL_REQUIRED' ? 'Verify your sign-in email and sign in again before enabling decision emails.' : 'Unable to save email preferences. Try again.'); }
        finally { setBusy(false); }
      }}>Save email preferences</Button>
    </Modal>}
  </>;
}
