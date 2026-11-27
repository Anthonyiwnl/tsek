import RouteLink from './RouteLink';
import { signInHref } from './routing';
import { useRef, useState } from 'react';
import { createAuthClient } from '@neondatabase/auth';
import { Brand, Button } from './DesignUI';
import './workspace.css';
import './password-setup.css';

const url = import.meta.env.VITE_NEON_AUTH_URL;
type OtpResult = { error?: unknown };
// Neon installs emailOTPClient at runtime; this SDK version omits its public types.
type OtpClient = { emailOtp: {
  requestPasswordReset(input: { email: string }): Promise<OtpResult>;
  resetPassword(input: { email: string; otp: string; password: string }): Promise<OtpResult>;
} };
const auth = url ? createAuthClient(url) as unknown as OtpClient : null;

/** Verify inbox ownership through Neon before setting an existing account's password. */
export default function PasswordSetup() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [step, setStep] = useState<'email' | 'password' | 'done'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const clearSecrets = () => { setCode(''); setPassword(''); setConfirmation(''); };
  const requestCode = async () => {
    if (!auth || pending.current) return;
    clearSecrets();
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await auth.emailOtp.requestPasswordReset({ email: email.trim().toLowerCase() });
      if (result.error) throw new Error();
      clearSecrets(); setStep('password');
    } catch { setError('Could not request a code. Check your connection and try again shortly.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const save = async () => {
    if (!auth || pending.current) return;
    if (password !== confirmation) { setError('Passwords do not match. Enter the same password in both fields.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await auth.emailOtp.resetPassword({ email: email.trim().toLowerCase(), otp: code.trim(), password });
      if (result.error) throw new Error();
      clearSecrets(); setStep('done');
    } catch { setError('Could not set your password. Check the code and your connection, or request a new code if it expired.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <div className="workspace-shell password-setup-shell"><main className="workspace-card workspace-login password-setup">
    <Brand /><h1>{step === 'done' ? 'Your password is ready' : 'Set or reset your password'}</h1>
    {!auth ? <p role="status">Password setup is not configured. Please contact the project team.</p>
      : step === 'done' ? <p role="status">Sign in with your email and new password. Your existing account access stays the same.</p>
      : step === 'email' ? <><p>Enter your TSEK account email. We’ll send a code so you can choose a password privately.</p>
        <form className="workspace-form" onSubmit={event => { event.preventDefault(); void requestCode(); }}>
          <label>Email<input type="email" autoComplete="username" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
          <Button type="submit" disabled={busy}>{busy ? 'Requesting code...' : 'Send verification code'}</Button>
        </form></>
      : <><p>If an account exists for <strong>{email.trim().toLowerCase()}</strong>, a code has been sent. Check your inbox and spam folder.</p>
        <form className="workspace-form" onSubmit={event => { event.preventDefault(); void save(); }}>
          <label>Email code<input autoComplete="one-time-code" required maxLength={128} value={code} disabled={busy} onChange={event => setCode(event.target.value)} /></label>
          <label>New password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
          <p>Use at least 12 characters. Keep your password and email code private.</p>
          <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></label>
          <Button type="submit" disabled={busy}>{busy ? 'Setting password...' : 'Set password'}</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void requestCode()}>Request a new code</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => { clearSecrets(); setError(''); setStep('email'); }}>Use another email</Button>
        </form></>}
    {error && <p role="alert">{error}</p>}
    <RouteLink href={signInHref()}>Back to sign in</RouteLink>
  </main></div>;
}
