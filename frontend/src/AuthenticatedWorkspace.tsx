import { useEffect, useMemo, useState } from 'react';
import { createAuthClient } from '@neondatabase/auth';
import { Brand, Button } from './DesignUI';
import { createApplicationApi } from './application-api.js';
import ApplicationWorkspace from './ApplicationWorkspace';

const url = import.meta.env.VITE_NEON_AUTH_URL;
const auth = url ? createAuthClient(url) : null;
type User = { id: string; name?: string; email: string };

export default function AuthenticatedWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!auth);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const expectedUserId = user?.id;
  const api = useMemo(() => createApplicationApi({
    base: import.meta.env.VITE_API_BASE_URL || '/api',
    getToken: async () => {
      if (!auth || !expectedUserId) return null;
      const session = await auth.getSession();
      if (session.data?.user.id !== expectedUserId) return null;
      const response = await auth.token();
      const currentSession = await auth.getSession();
      if (currentSession.data?.user.id !== expectedUserId) return null;
      return response.data?.token || null;
    },
    onUnauthorized: () => { setUser(null); setError('Your session expired. Sign in again.'); },
  }), [expectedUserId]);
  useEffect(() => {
    let active = true;
    if (!auth) return;
    auth.getSession().then(response => {
      if (!active) return;
      if (response.error) setError('Unable to restore your session. Please sign in again.');
      setUser(response.data?.user || null);
    }).catch(() => { if (active) setError('Unable to reach sign-in. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <main className="workspace-login"><Brand /><p role="status">Restoring your session...</p></main>;
  if (user) return <ApplicationWorkspace key={user.id} api={api} name={user.name || user.email} onSignOut={async () => {
    if (busy) return; setBusy(true);
    try { const response = await auth!.signOut(); if (response.error) throw new Error(); setUser(null); setPassword(''); }
    catch { setUser(null); setError('Sign-out could not be confirmed. Retry signing out before using a shared device.'); }
    finally { setBusy(false); }
  }} />;
  return <div className="workspace-shell"><main className="workspace-card workspace-login"><Brand /><h1>Sign in to your applications</h1>
    <p>Access your saved applications and private documents.</p>
    {!auth ? <p role="status">Sign-in is not configured for this deployment. Please contact the project team.</p> : <form className="workspace-form" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError('');
      try {
        const response = await auth.signIn.email({ email, password });
        if (response.error) { setError('Sign-in failed. Check your email and password, or try again later.'); return; }
        const session = await auth.getSession();
        if (!session.data?.user) { setError('No active session was returned. Check your email verification and try again.'); return; }
        setUser(session.data.user); setPassword('');
      } catch { setError('Unable to reach sign-in. Check your connection and try again.'); }
      finally { setBusy(false); }
    }}><label>Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
      <Button type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</Button></form>}
    {error && <p role="alert">{error}</p>}
    {auth && error.includes('Sign-out') && <Button variant="secondary" disabled={busy} onClick={async () => {
      if (busy) return; setBusy(true);
      try { const result = await auth.signOut(); setError(result.error ? 'Sign-out could not be confirmed. Please try again.' : 'Signed out.'); }
      catch { setError('Sign-out could not be confirmed. Please try again.'); }
      finally { setBusy(false); }
    }}>Retry sign out</Button>}
    <a href="#/">Back to home</a>
  </main></div>;
}
