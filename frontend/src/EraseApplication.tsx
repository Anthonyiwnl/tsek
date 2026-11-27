import { useRef, useState } from 'react';
import { Button } from './DesignUI';
import Modal from './Modal';

export default function EraseApplication({ erase, onDeleted }: { erase: () => Promise<unknown>; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  return <><Button variant="danger" onClick={() => setOpen(true)}>Delete my application and files</Button>
    {open && <Modal labelledBy="erase-title" onClose={() => { if (!busy) setOpen(false); }}><h2 id="erase-title">Permanently delete this application?</h2>
      <p>This removes your application, uploaded files, analyses and associated staff notes, including submitted and decided applications. It cannot be undone.</p>
      {error && <p role="alert">{error}</p>}
      <Button disabled={busy} variant="secondary" onClick={() => setOpen(false)}>Keep my data</Button>
      <Button disabled={busy} variant="danger" onClick={async () => {
        if (locked.current) return; locked.current = true; setBusy(true); setError('');
        try { await erase(); onDeleted(); } catch { setError('Deletion failed. Your data was not confirmed deleted. Please try again.'); }
        finally { locked.current = false; setBusy(false); }
      }}>Confirm permanent deletion</Button>
    </Modal>}
  </>;
}
