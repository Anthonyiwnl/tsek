import { useState } from 'react';
import { Button } from './DesignUI';

/** Supports both verification links and email codes, depending on Neon settings. */
export default function AuthVerification({ email, busy, error, notice, onVerify, onResend, onContinue, onBack }: {
  email: string; busy: boolean; error: string; notice: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onContinue: () => Promise<void>;
  onBack: () => void;
}) {
  const [code, setCode] = useState('');
  return <form className="auth-form auth-verification" onSubmit={event => { event.preventDefault(); void onVerify(code.trim()); }} aria-busy={busy}>
    <div className="auth-form-heading"><h1 id="auth-title">Check your inbox</h1><p>Complete any email verification for <strong>{email}</strong>. Follow the link in your email, or enter the code if one was provided.</p></div>
    <div className="auth-field"><label htmlFor="auth-code">Email verification code</label><div className="auth-input"><img src="/auth/email.svg" alt="" /><input id="auth-code" name="code" autoComplete="one-time-code" required maxLength={128} placeholder="Enter your email code" value={code} onChange={event => setCode(event.target.value)} disabled={busy} /></div></div>
    {error && <p className="auth-message auth-error" role="alert">{error}</p>}
    {notice && <p className="auth-message" role="status">{notice}</p>}
    <Button type="submit" className="auth-submit" disabled={busy}>{busy ? 'Please wait...' : 'Verify email code'}</Button>
    <Button variant="secondary" disabled={busy} onClick={() => void onContinue()}>I have verified my email</Button>
    <Button variant="ghost" disabled={busy} onClick={() => void onResend()}>Send a new verification code</Button>
    <button className="auth-inline-action" type="button" disabled={busy} onClick={onBack}>Back to sign in</button>
  </form>;
}
