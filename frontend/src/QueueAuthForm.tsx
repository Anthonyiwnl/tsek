import { useCopy, LanguageSwitch } from './i18n';
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
  const { t, source } = useCopy();
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
    <aside className="queue-sign-in-aside" aria-label={t('welcome_to_tsek')}>
      <Brand light />
      <div className="queue-sign-in-welcome"><PublicTicket compact /><h2>{signup ? t('your_next_visit_starts_here') : t('welcome_back')}</h2><p>{signup ? t('create_an_account_to_prepare_your_documents_and_follow_your_appli') : t('pick_up_your_tickets_where_you_left_off_your_documents_stay_priva')}</p></div>
      <small>{t('prototype_not_an_official_government_service')}</small>
    </aside>
    <main className="queue-sign-in-main"><LanguageSwitch /><div className="queue-sign-in-card">
      <h1 ref={heading} tabIndex={-1}>{verificationEmail ? t('check_your_inbox') : signup ? t('create_your_account') : t('sign_in_to_your_applications')}</h1>
      <p>{verificationEmail ? <>{t('follow_the_verification_link_sent_to')} <strong>{verificationEmail}</strong>{t('or_enter_the_email_code_if_one_was_provided')}</> : signup ? t('one_account_for_your_barangay_applications') : t('access_your_saved_applications_and_private_documents')}</p>
      {error && <p className="queue-auth-error" role="alert"><Icon name="warning" size={18} /><span>{source(error)}</span></p>}
      {notice && <p role="status">{source(notice)}</p>}
      {!configured ? <p role="status">{t('sign_in_is_not_configured_for_this_deployment_please_contact_the')}</p>
        : verificationEmail ? <form className="queue-sign-in-form" aria-busy={busy} onSubmit={event => { event.preventDefault(); if (!busy && code.trim()) void onVerify('code', code.trim()).finally(() => setCode('')); }}>
          <label>{t('email_verification_code')}<input name="code" autoComplete="one-time-code" required maxLength={128} value={code} onChange={event => setCode(event.target.value)} disabled={busy} /></label>
          <Button type="submit" size="lg" disabled={busy}>{busy ? t('please_wait') : t('verify_email_code')}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => { setCode(''); void onVerify('continue'); }}>{t('i_have_verified_my_email')}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => { setCode(''); void onVerify('resend'); }}>{t('send_a_new_verification_code')}</Button>
        </form>
        : <form ref={form} className="queue-sign-in-form" aria-busy={busy} onSubmit={async event => {
          event.preventDefault(); if (busy) return;
          const data = new FormData(event.currentTarget);
          try { await onSubmit({ name: String(data.get('name') || '').trim(), email: String(data.get('email') || '').trim().toLowerCase(), password: String(data.get('password') || '') }); }
          finally { clearPassword(); }
        }}>
          {signup && <label>{t('full_name')}<input name="name" autoComplete="name" required maxLength={100} disabled={busy} /></label>}
          <label>{t('email')}<input name="email" type="email" autoComplete={signup ? 'email' : 'username'} required maxLength={254} disabled={busy} aria-invalid={source(error) === t('sign_in_failed_check_your_email_and_password_or_try_again_later') || undefined} /></label>
          <label>{t('password')}<input key={mode} name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 12 : undefined} maxLength={128} disabled={busy} aria-describedby={signup ? 'queue-password-help' : undefined} aria-invalid={source(error) === t('sign_in_failed_check_your_email_and_password_or_try_again_later') || undefined} /></label>
          {signup && <small id="queue-password-help">{t('use_at_least_12_characters')}</small>}
          <button className="queue-auth-action" type="button" aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword(value => !value)}>{showPassword ? t('hide_password') : t('show_password')}</button>
          <Button type="submit" size="lg" iconRight="arrow" disabled={busy}>{busy ? (signup ? t('creating_account') : t('signing_in')) : (signup ? t('create_account') : t('sign_in'))}</Button>
        </form>}
      {recovery}
      <div className="queue-auth-links">
        {configured && <button className="queue-auth-action" type="button" disabled={busy} onClick={changeMode}>{verificationEmail ? t('back_to_sign_in') : signup ? t('already_registered_sign_in') : t('new_to_tsek_create_an_account')}</button>}
        {configured && <a href="#/password-setup">{t('set_or_reset_your_password')}</a>}
        <a href="#/"><span className="queue-back-icon"><Icon name="chevron" size={16} /></span>{t('back_to_home')}</a>
      </div>
      {signup && <p className="queue-auth-privacy">{t('your_documents_stay_private_until_you_submit_them_for_barangay_re')} <a href="#trust">{t('how_tsek_handles_your_information')}</a></p>}
    </div></main>
  </div>;
}
