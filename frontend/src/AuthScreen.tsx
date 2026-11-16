import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from './DesignUI';
import './auth-screen.css';

export type AuthMode = 'login' | 'signup';
export type AuthCredentials = { name: string; email: string; password: string };

function AuthBrand() {
  return <a className="auth-brand" href="#/" aria-label="TSEK home"><img src="/auth/brand-mark.svg" alt="" /><span>tsek</span></a>;
}

/** The same form moves across the card, so hidden fields never remain focusable. */
export default function AuthScreen({ mode, busy, configured, error, notice, onSubmit, onModeChange, recovery, verification }: {
  mode: AuthMode;
  busy: boolean;
  configured: boolean;
  error: string;
  notice: string;
  onSubmit: (credentials: AuthCredentials) => Promise<void>;
  onModeChange: (mode: AuthMode) => void;
  recovery?: ReactNode;
  verification?: ReactNode;
}) {
  const signup = mode === 'signup';
  const [showPassword, setShowPassword] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const switchMode = () => {
    if (busy) return;
    setShowPassword(false);
    // Do not carry a password across sign-in and account creation.
    const password = form.current?.elements.namedItem('password') as HTMLInputElement | null;
    if (password) password.value = '';
    onModeChange(signup ? 'login' : 'signup');
    title.current?.focus({ preventScroll: true });
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !configured) return;
    const data = new FormData(event.currentTarget);
    await onSubmit({ name: String(data.get('name') || '').trim(), email: String(data.get('email') || '').trim().toLowerCase(), password: String(data.get('password') || '') });
    const password = form.current?.elements.namedItem('password') as HTMLInputElement | null;
    if (password) password.value = '';
    setShowPassword(false);
  };
  const switchLabel = signup ? 'Already registered? Sign in' : 'New to TSEK? Create an account';
  return <div className={`auth-screen${signup ? ' is-signup' : ''}`}>
    <div className="auth-backdrop" aria-hidden="true">
      <img className="auth-ambient" src="/auth/ambient.svg" alt="" />
      <div className="auth-circuits"><img src="/auth/circuits.svg" alt="" /><img className="auth-circuit-nodes" src="/auth/circuit-nodes.svg" alt="" /></div>
    </div>
    <header className="auth-header"><AuthBrand /><span>Smart document verification</span></header>
    <main className="auth-card">
      <section className="auth-form-panel" aria-labelledby="auth-title">
        {verification || <form ref={form} className="auth-form" onSubmit={submit} aria-busy={busy}>
          <div className="auth-form-heading"><h1 id="auth-title" tabIndex={-1} ref={title}>{signup ? 'Create your account' : 'Sign in'}</h1><p>{signup ? 'One account. A smoother barangay visit.' : 'Continue to your applications.'}</p></div>
          {!configured && <p className="auth-message" role="status">Sign-in is not configured for this deployment. Please contact the project team.</p>}
          {signup && <div className="auth-field"><label htmlFor="auth-name">Full name</label><div className="auth-input"><img src="/auth/person.svg" alt="" /><input id="auth-name" name="name" autoComplete="name" placeholder="Enter your full name" required maxLength={100} disabled={busy || !configured} /></div></div>}
          <div className="auth-field"><label htmlFor="auth-email">Email address</label><div className="auth-input"><img src="/auth/email.svg" alt="" /><input id="auth-email" name="email" type="email" autoComplete={signup ? 'email' : 'username'} placeholder="you@example.com" required maxLength={254} disabled={busy || !configured} /></div></div>
          <div className="auth-field"><label htmlFor="auth-password">Password</label><div className="auth-input"><img src="/auth/lock.svg" alt="" /><input key={mode} id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} placeholder={signup ? 'Create a strong password' : 'Enter your password'} required minLength={signup ? 12 : undefined} maxLength={128} aria-describedby={signup ? 'auth-password-help' : undefined} disabled={busy || !configured} /><button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} disabled={busy || !configured}><img src="/auth/eye.svg" alt="" /></button></div>{signup && <small id="auth-password-help">Use at least 12 characters.</small>}</div>
          {!signup && <a className="auth-forgot" href="#/password-setup">Forgot password?</a>}
          {error && <p className="auth-message auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-message" role="status">{notice}</p>}
          <Button className="auth-submit" type="submit" disabled={busy || !configured}>{busy ? (signup ? 'Creating account...' : 'Signing in...') : (signup ? 'Create account' : 'Sign in')}</Button>
          {recovery}
          <button className="auth-mobile-switch" type="button" onClick={switchMode} disabled={busy}>{switchLabel}</button>
          {signup && <p className="auth-policy">Learn how TSEK handles your documents in our <a href="#trust">privacy information</a>.</p>}
        </form>}
      </section>
      <aside className="auth-welcome" aria-label="Welcome to TSEK">
        <div className="auth-mobile-brand"><AuthBrand /></div>
        <h2>{signup ? <>Hello,<br />neighbor.</> : <>Welcome<br />back.</>}</h2>
        <p className="auth-welcome-copy">{signup ? <>Check your documents before you go.<br />Start your application with confidence.</> : <>Your next barangay visit starts here.<br />Check requirements, upload documents, and follow your application in one place.</>}</p>
        <p className="auth-mobile-copy">A smoother barangay visit starts here.</p>
        <div className="auth-document" aria-hidden="true"><img src="/auth/document-check.svg" alt="" /></div>
        <Button className="auth-switch" variant="secondary" onClick={switchMode} disabled={busy}>{switchLabel}</Button>
        <p className="auth-tagline">Built for your barangay. Designed for you.</p>
        <div className="auth-desktop-edge" aria-hidden="true"><img src={signup ? '/auth/edge-signup.svg' : '/auth/edge-login.svg'} alt="" /></div>
        <div className="auth-mobile-badge" aria-hidden="true"><img src="/auth/mobile-circle.svg" alt="" /><img src="/auth/mobile-check.svg" alt="" /></div>
        <div className="auth-mobile-edge" aria-hidden="true"><img src="/auth/mobile-edge.svg" alt="" /></div>
      </aside>
    </main>
    <footer className="auth-footer"><span>TSEK / Smart Document Verification &amp; Requirements Checker</span><a href="#/">Back to home</a></footer>
  </div>;
}
