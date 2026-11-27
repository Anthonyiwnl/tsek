import RouteLink from './RouteLink';
import { passwordSetupHref } from './routing';
import { useRef, useState, type ReactNode } from 'react';
import { Brand, Button, Icon } from './DesignUI';
import PublicTicket from './PublicTicket';

export default function QueueAuthForm({ mode, busy, configured, error, notice, verificationEmail, onSubmit, onModeChange, onVerify, recovery }: {
  mode: 'login' | 'signup'; busy: boolean; configured: boolean; error: string; notice: string; verificationEmail: string;
  onSubmit: (credentials: { name: string; email: string; password: string }) => Promise<void>;
  onModeChange: (mode: 'login' | 'signup') => void;
  onVerify: (action: 'code' | 'resend' | 'continue', code?: string) => Promise<void>;
  recovery: ReactNode;
}) {
  const signup = mode === 'signup';
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const clearPassword = () => {
    const input = form.current?.elements.namedItem('password') as HTMLInputElement | null;
    if (input) input.value = '';
    setShowPassword(false);
  };
  const changeMode = () => {
    if (busy) return;
    clearPassword(); setCode('');
    onModeChange(verificationEmail || signup ? 'login' : 'signup');
    heading.current?.focus();
  };
  return <div className="queue-sign-in">
    <aside className="queue-sign-in-aside" aria-label="Welcome to TSEK">
      <Brand light />
      <div className="queue-sign-in-welcome"><PublicTicket compact /><h2>{signup ? 'Your next visit starts here.' : 'Welcome back.'}</h2><p>{signup ? 'Create an account to prepare your documents and follow your applications.' : 'Pick up your tickets where you left off. Your documents stay private until you submit them.'}</p></div>
      <small>Prototype · Not an official government service</small>
    </aside>
    <main className="queue-sign-in-main"><div className="queue-sign-in-card">
      <h1 ref={heading} tabIndex={-1}>{verificationEmail ? 'Check your inbox' : signup ? 'Create your account' : 'Sign in to your applications'}</h1>
      <p>{verificationEmail ? <>Follow the verification link sent to <strong>{verificationEmail}</strong>, or enter the email code if one was provided.</> : signup ? 'One account for your barangay applications.' : 'Access your saved applications and private documents.'}</p>
      {error && <p className="queue-auth-error" role="alert"><Icon name="warning" size={18} /><span>{error}</span></p>}
      {notice && <p role="status">{notice}</p>}
      {!configured ? <p role="status">Sign-in is not configured for this deployment. Please contact the project team.</p>
        : verificationEmail ? <form className="queue-sign-in-form" aria-busy={busy} onSubmit={event => { event.preventDefault(); if (!busy && code.trim()) void onVerify('code', code.trim()).finally(() => setCode('')); }}>
          <label>Email verification code<input name="code" autoComplete="one-time-code" required maxLength={128} value={code} onChange={event => setCode(event.target.value)} disabled={busy} /></label>
          <Button type="submit" size="lg" disabled={busy}>{busy ? 'Please wait...' : 'Verify email code'}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => { setCode(''); void onVerify('continue'); }}>I have verified my email</Button>
          <Button variant="ghost" disabled={busy} onClick={() => { setCode(''); void onVerify('resend'); }}>Send a new verification code</Button>
        </form>
        : <form ref={form} className="queue-sign-in-form" aria-busy={busy} onSubmit={async event => {
          event.preventDefault(); if (busy) return;
          const data = new FormData(event.currentTarget);
          try { await onSubmit({ name: String(data.get('name') || '').trim(), email: String(data.get('email') || '').trim().toLowerCase(), password: String(data.get('password') || '') }); }
          finally { clearPassword(); }
        }}>
          {signup && <label>Full name<input name="name" autoComplete="name" required maxLength={100} disabled={busy} /></label>}
          <label>Email<input name="email" type="email" autoComplete={signup ? 'email' : 'username'} required maxLength={254} disabled={busy} aria-invalid={error.startsWith('Sign-in failed.') || undefined} /></label>
          <label>Password<input key={mode} name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 12 : undefined} maxLength={128} disabled={busy} aria-describedby={signup ? 'queue-password-help' : undefined} aria-invalid={error.startsWith('Sign-in failed.') || undefined} /></label>
          {signup && <small id="queue-password-help">Use at least 12 characters.</small>}
          <button className="queue-auth-action" type="button" aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide password' : 'Show password'}</button>
          <Button type="submit" size="lg" iconRight="arrow" disabled={busy}>{busy ? (signup ? 'Creating account...' : 'Signing in...') : (signup ? 'Create account' : 'Sign in')}</Button>
        </form>}
      {recovery}
      <div className="queue-auth-links">
        {configured && <button className="queue-auth-action" type="button" disabled={busy} onClick={changeMode}>{verificationEmail ? 'Back to sign in' : signup ? 'Already registered? Sign in' : 'New to TSEK? Create an account'}</button>}
        {configured && <RouteLink href={passwordSetupHref()}>Set or reset your password</RouteLink>}
        <RouteLink href="/"><span className="queue-back-icon"><Icon name="chevron" size={16} /></span>Back to home</RouteLink>
      </div>
      {signup && <p className="queue-auth-privacy">Your documents stay private until you submit them for barangay review. <RouteLink href="/#trust">How TSEK handles your information</RouteLink></p>}
    </div></main>
  </div>;
}
