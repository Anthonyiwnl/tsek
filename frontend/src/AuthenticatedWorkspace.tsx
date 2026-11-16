import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createAuthClient } from '@neondatabase/auth';
import { Brand, Button } from './DesignUI';
import { createApplicationApi } from './application-api.js';
import ApplicationWorkspace from './ApplicationWorkspace';
import CitizenDashboard from './CitizenDashboard';
import StaffDashboard from './StaffDashboard';
import AuthScreen, { type AuthCredentials, type AuthMode } from './AuthScreen';
import AuthVerification from './AuthVerification';

const url = import.meta.env.VITE_NEON_AUTH_URL;
// Neon includes emailOTPClient at runtime but omits these public types in this SDK.
type OtpClient = { emailOtp: {
  verifyEmail(input: { email: string; otp: string }): Promise<{ error?: unknown }>;
  sendVerificationOtp(input: { email: string; type: 'email-verification' }): Promise<{ error?: unknown }>;
} };
const auth = url ? createAuthClient(url) : null;
type User = { id: string; name?: string; email: string };

export default function AuthenticatedWorkspace({ view = 'applications', authMode = 'login' }: { view?: 'applications' | 'dashboard' | 'admin'; authMode?: AuthMode }) {
  const [{ user, error }, dispatch] = useReducer((state: { user: User | null; error: string }, action: { type: 'user'; user: User | null } | { type: 'error'; error: string } | { type: 'unauthorized'; userId: string | undefined }) => {
    if (action.type === 'user') return { ...state, user: action.user };
    if (action.type === 'error') return { ...state, error: action.error };
    return state.user?.id === action.userId ? { user: null, error: 'Your session expired. Sign in again.' } : state;
  }, { user: null, error: '' });
  const setUser = useCallback((user: User | null) => dispatch({ type: 'user', user }), []);
  const setError = useCallback((error: string) => dispatch({ type: 'error', error }), []);
  const [loading, setLoading] = useState(!!auth);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const submitting = useRef(false);
  const expectedUserId = user?.id;
  const api = useMemo(() => createApplicationApi({
    base: import.meta.env.VITE_API_BASE_URL || '/api',
    getToken: async () => {
      if (!auth || !expectedUserId) return null;
      const session = await auth.getSession();
      if (session.error) throw new Error('Unable to verify your session. Try again.');
      if (session.data?.user.id !== expectedUserId) return null;
      const currentSession = await auth.getSession();
      if (currentSession.error) throw new Error('Unable to verify your session. Try again.');
      if (currentSession.data?.user.id !== expectedUserId) return null;
      // Neon injects the signed JWT into session.token. A raw /token request
      // can be satisfied by the SDK session cache with a session-shaped body.
      return currentSession.data?.session?.token || null;
    },
    onUnauthorized: () => dispatch({ type: 'unauthorized', userId: expectedUserId }),
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
  }, [setUser, setError]);
  if (loading) return <main className="workspace-login"><Brand /><p role="status">Restoring your session...</p></main>;
  const signOut = async () => {
    if (busy) return; setBusy(true);
    try { const response = await auth!.signOut(); if (response.error) throw new Error(); setUser(null); }
    catch { setUser(null); setError('Sign-out could not be confirmed. Retry signing out before using a shared device.'); }
    finally { setBusy(false); }
  };
  if (user) return view === 'applications'
    ? <ApplicationWorkspace key={user.id} api={api} name={user.name || user.email} onSignOut={signOut} />
    : view === 'admin'
      ? <StaffDashboard key={user.id} api={api} name={user.name || user.email} onSignOut={signOut} />
      : <CitizenDashboard key={user.id} api={api} name={user.name || user.email} onSignOut={signOut} />;
  const submit = async ({ name, email, password }: AuthCredentials) => {
      if (!auth || busy || submitting.current) return;
      if (authMode === 'signup' && !name.trim()) { setError('Enter your full name.'); return; }
      submitting.current = true; setBusy(true); setError(''); setNotice('');
      try {
        const response = authMode === 'signup'
          ? await auth.signUp.email({ name, email, password })
          : await auth.signIn.email({ email, password });
        if (response.error) { setError(authMode === 'signup'
          ? 'Could not create your account. Check your details, or sign in if you already have an account.'
          : 'Sign-in failed. Check your email and password, or try again later.'); return; }
        const session = await auth.getSession();
        if (session.error || !session.data?.user) {
          if (authMode === 'signup') {
            setVerificationEmail(email);
          } else setError('No active session was returned. Check your email verification and try again.');
          return;
        }
        setUser(session.data.user);
      } catch (cause) {
        const invalidCredentials = typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 401;
        setError(authMode === 'signup' ? 'Unable to create your account. Check your connection and try again, or sign in if your account was already created.' : invalidCredentials
          ? 'Sign-in failed. Check your email and password, or try again later.'
          : 'Unable to reach sign-in. Check your connection and try again.');
      }
      finally { submitting.current = false; setBusy(false); }
  };
  const changeMode = (mode: AuthMode) => {
    if (busy) return;
    setError(''); setNotice(''); setVerificationEmail('');
    window.location.hash = mode === 'signup' ? '/signup' : '/login';
  };
  const verify = async (action: 'code' | 'resend' | 'continue', code = '') => {
    if (!auth || busy || submitting.current || !verificationEmail) return;
    submitting.current = true; setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'resend') {
        const response = await (auth as unknown as OtpClient).emailOtp.sendVerificationOtp({ email: verificationEmail, type: 'email-verification' });
        if (response.error) { setError('Could not request a code. Check your connection and try again shortly.'); return; }
        setNotice('Check your inbox and spam folder for a new verification code.'); return;
      }
      if (action === 'code') {
        const response = await (auth as unknown as OtpClient).emailOtp.verifyEmail({ email: verificationEmail, otp: code });
        if (response.error) { setError('Could not verify this code. Check it or request a new one.'); return; }
      }
      const session = await auth.getSession();
      if (session.error) { setError('Unable to confirm your session. Try again.'); return; }
      if (session.data?.user) { setUser(session.data.user); setVerificationEmail(''); }
      else { setVerificationEmail(''); setNotice('Sign in to continue after completing your email verification.'); window.location.hash = '/login'; }
    } catch { setError('Unable to complete email verification. Check your connection and try again.'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <AuthScreen mode={authMode} busy={busy} configured={!!auth} error={error} notice={notice} onSubmit={submit}
    onModeChange={changeMode}
    verification={verificationEmail && <AuthVerification email={verificationEmail} busy={busy} error={error} notice={notice}
      onVerify={code => verify('code', code)} onResend={() => verify('resend')} onContinue={() => verify('continue')} onBack={() => changeMode('login')} />}
    recovery={auth && error.includes('Sign-out') && <Button variant="secondary" disabled={busy} onClick={async () => {
      if (busy) return; setBusy(true);
      try { const result = await auth.signOut(); setError(result.error ? 'Sign-out could not be confirmed. Please try again.' : 'Signed out.'); }
      catch { setError('Sign-out could not be confirmed. Please try again.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Signing out...' : 'Retry sign out'}</Button>} />;
}
