import { useCopy } from './i18n';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createAuthClient } from '@neondatabase/auth';
import { Brand, Button } from './DesignUI';
import QueueAuthForm from './QueueAuthForm';
import './PublicPages.css';
import { createApplicationApi } from './application-api.js';
import ApplicationWorkspace from './ApplicationWorkspace';
import StaffDashboard from './StaffDashboard';

const url = import.meta.env.VITE_NEON_AUTH_URL;
// Neon includes emailOTPClient at runtime but omits these public types in this SDK.
type OtpClient = { emailOtp: {
  verifyEmail(input: { email: string; otp: string }): Promise<{ error?: unknown }>;
  sendVerificationOtp(input: { email: string; type: 'email-verification' }): Promise<{ error?: unknown }>;
} };
const auth = url ? createAuthClient(url) : null;
type User = { id: string; name?: string; email: string };

export default function AuthenticatedWorkspace({ view = 'applications', authMode = 'login' }: { view?: 'applications' | 'admin'; authMode?: 'login' | 'signup' }) {
  const { t, source } = useCopy();
  const [{ user, error }, dispatch] = useReducer((state: { user: User | null; error: string }, action: { type: 'user'; user: User | null } | { type: 'error'; error: string } | { type: 'unauthorized'; userId: string | undefined }) => {
    if (action.type === 'user') return { ...state, user: action.user };
    if (action.type === 'error') return { ...state, error: action.error };
    return state.user?.id === action.userId ? { user: null, error: t('your_session_expired_sign_in_again') } : state;
  }, { user: null, error: '' });
  const setUser = useCallback((user: User | null) => dispatch({ type: 'user', user }), []);
  const setError = useCallback((error: string) => dispatch({ type: 'error', error }), []);
  const [loading, setLoading] = useState(!!auth);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(authMode);
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
      if (response.error) setError(t('unable_to_restore_your_session_please_sign_in_again'));
      setUser(response.data?.user || null);
    }).catch(() => { if (active) setError(t('unable_to_reach_sign_in_please_try_again')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setUser, setError]);
  useEffect(() => {
    if (user && /^#\/(login|signup)$/.test(window.location.hash)) {
      window.history.replaceState(window.history.state, '', '#/applications');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, [user]);
  if (loading) return <main className="workspace-login"><Brand /><p role="status">{t('restoring_your_session')}</p></main>;
  const signOut = async () => {
    if (busy) return; setBusy(true);
    try { const response = await auth!.signOut(); if (response.error) throw new Error(); setUser(null); }
    catch { setUser(null); setError(t('sign_out_could_not_be_confirmed_retry_signing_out_before_using_a')); }
    finally { setBusy(false); }
  };
  if (user) return view === 'admin'
    ? <StaffDashboard key={user.id} api={api} name={user.name || user.email} onSignOut={signOut} />
    : <ApplicationWorkspace key={user.id} api={api} name={user.name || user.email} onSignOut={signOut} />;
  const submit = async ({ name, email, password }: { name: string; email: string; password: string }) => {
      if (!auth || busy || submitting.current) return;
      if (mode === 'signup' && !name.trim()) { setError(t('enter_your_full_name')); return; }
      submitting.current = true; setBusy(true); setError(''); setNotice('');
      try {
        const response = mode === 'signup'
          ? await auth.signUp.email({ name, email, password })
          : await auth.signIn.email({ email, password });
        if (response.error) { setError(mode === 'signup'
          ? t('could_not_create_your_account_check_your_details_or_sign_in_if_yo')
          : t('sign_in_failed_check_your_email_and_password_or_try_again_later')); return; }
        const session = await auth.getSession();
        if (session.error || !session.data?.user) {
          if (mode === 'signup') {
            setVerificationEmail(email);
          } else setError(t('no_active_session_was_returned_check_your_email_verification_and'));
          return;
        }
        setUser(session.data.user);
      } catch (cause) {
        const invalidCredentials = typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 401;
        setError(mode === 'signup' ? t('unable_to_create_your_account_check_your_connection_and_try_again') : invalidCredentials
          ? t('sign_in_failed_check_your_email_and_password_or_try_again_later')
          : t('unable_to_reach_sign_in_check_your_connection_and_try_again'));
      }
      finally { submitting.current = false; setBusy(false); }
  };
  const changeMode = (mode: 'login' | 'signup') => {
    if (busy) return;
    setError(''); setNotice(''); setVerificationEmail('');
    setMode(mode);
  };
  const verify = async (action: 'code' | 'resend' | 'continue', code = '') => {
    if (!auth || busy || submitting.current || !verificationEmail) return;
    submitting.current = true; setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'resend') {
        const response = await (auth as unknown as OtpClient).emailOtp.sendVerificationOtp({ email: verificationEmail, type: 'email-verification' });
        if (response.error) { setError(t('could_not_request_a_code_check_your_connection_and_try_again_shor')); return; }
        setNotice(t('check_your_inbox_and_spam_folder_for_a_new_verification_code')); return;
      }
      if (action === 'code') {
        const response = await (auth as unknown as OtpClient).emailOtp.verifyEmail({ email: verificationEmail, otp: code });
        if (response.error) { setError(t('could_not_verify_this_code_check_it_or_request_a_new_one')); return; }
      }
      const session = await auth.getSession();
      if (session.error) { setError(t('unable_to_confirm_your_session_try_again')); return; }
      if (session.data?.user) { setUser(session.data.user); setVerificationEmail(''); }
      else { setVerificationEmail(''); setNotice(t('sign_in_to_continue_after_completing_your_email_verification')); setMode('login'); }
    } catch { setError(t('unable_to_complete_email_verification_check_your_connection_and_t')); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <QueueAuthForm mode={mode} busy={busy} configured={!!auth} error={error} notice={notice}
    verificationEmail={verificationEmail} onSubmit={submit} onModeChange={changeMode} onVerify={verify}
    recovery={auth && [t('sign_out_could_not_be_confirmed_retry_signing_out_before_using_a'), t('sign_out_could_not_be_confirmed_please_try_again')].includes(source(error)) && <Button variant="secondary" disabled={busy} onClick={async () => {
      if (busy) return; setBusy(true);
      try { const result = await auth.signOut(); setError(result.error ? t('sign_out_could_not_be_confirmed_please_try_again') : t('signed_out')); }
      catch { setError(t('sign_out_could_not_be_confirmed_please_try_again')); }
      finally { setBusy(false); }
    }}>{busy ? t('signing_out') : t('retry_sign_out')}</Button>} />;
}
