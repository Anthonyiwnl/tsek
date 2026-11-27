import { useState } from 'react';
import { Button } from './DesignUI';
import Modal from './Modal';

export type Privacy = { enabled: boolean; retentionDays: number | null; version: string; consented?: boolean };
export function PrivacyNotice({ policy }: { policy: Privacy }) {
  return <div><p>TSEK collects your account identifier, application purpose, uploaded documents and analysis results to help prepare and review your barangay application.</p>
    <p>Your documents are private to your account until you submit them to authorised barangay staff. When you request analysis, document content is sent to our AI provider. AI checks assist staff and do not grant official approval.</p>
    <p>{policy.enabled ? `Uploaded files and linked analysis contents are automatically removed ${policy.retentionDays} days after a staff decision. The application and staff decision remain until you request deletion.` : 'Automatic retention is not enabled for this deployment. Do not upload real personal documents to this prototype.'}</p>
    <p>You can request deletion of your own application, files and associated review notes. Deletion is permanent. Contact the project team through the repository issue tracker for privacy questions; never post documents or personal details there.</p>
  </div>;
}
export default function PrivacyNoticeLink() {
  const [open, setOpen] = useState(false);
  const [policy, setPolicy] = useState<Privacy | null>(null);
  const [error, setError] = useState('');
  return <><Button variant="ghost" onClick={async () => {
    setOpen(true); setPolicy(null); setError('');
    try {
      const response = await fetch((import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '') + '/privacy', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || typeof payload?.data?.enabled !== 'boolean') throw new Error('Invalid privacy response');
      setPolicy(payload.data);
    } catch { setError('Privacy notice is unavailable. Please try again before uploading.'); }
  }}>Privacy notice</Button>{open && <Modal labelledBy="privacy-title" onClose={() => setOpen(false)}><h2 id="privacy-title">Your privacy</h2>
    {policy ? <PrivacyNotice policy={policy} /> : error ? <p role="alert">{error}</p> : <p role="status">Loading privacy notice...</p>}
    <Button onClick={() => setOpen(false)}>Close privacy notice</Button>
  </Modal>}</>;
}
