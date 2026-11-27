import { useCopy, LanguageSwitch } from './i18n';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Icon, Button, Brand, type IconName } from './DesignUI';
import PublicTicket from './PublicTicket';
import './App.css';
import './PublicPages.css';
const AuthenticatedWorkspace = lazy(() => import('./AuthenticatedWorkspace'));
const PasswordSetup = lazy(() => import('./PasswordSetup'));

/** Public Queue Ticket introduction; entry actions use the existing session gate. */
function Landing() {
  const { t } = useCopy();
  const menu = useRef<HTMLDetailsElement>(null);
  const start = () => { window.location.hash = '/applications'; };
  return <main className="queue-public">
    <div className="queue-public-dark">
      <nav className="queue-public-nav queue-width" aria-label={t('main_navigation')}>
        <Brand light /><LanguageSwitch />
        <div className="queue-nav-links"><a href="#how">{t('how_it_works')}</a><a href="#services">{t('services')}</a><a href="#trust">{t('privacy')}</a><a href="#faq">{t('faq')}</a></div>
        <div className="queue-nav-actions"><Button className="queue-outline" onClick={start}>{t('log_in')}</Button><Button className="queue-cta" iconRight="arrow" onClick={start}>{t('get_started')}</Button></div>
        <details className="queue-mobile-menu" ref={menu} onKeyDown={event => {
          if (event.key === 'Escape' && menu.current?.open) { menu.current.open = false; menu.current.querySelector('summary')?.focus(); }
        }}>
          <summary aria-label={t('navigation_menu')}><Icon name="menu" /></summary>
          <div onClick={event => { if ((event.target as HTMLElement).closest('a') && menu.current) menu.current.open = false; }}>
            <a href="#how">{t('how_it_works')}</a><a href="#services">{t('services')}</a><a href="#trust">{t('privacy')}</a><a href="#faq">{t('faq')}</a><a href="#/applications">{t('log_in_get_started')}</a>
          </div>
        </details>
      </nav>
      <section className="queue-hero queue-width">
        <div className="queue-hero-copy">
          <span className="queue-intro"><Icon name="file" size={16} />{t('barangay_papers_checked_before_you_go')}</span>
          <h1>{t('every_requirement_checked_before_your_ticket_says')} <em>{t('ready')}</em></h1>
          <p>{t('prepare_your_barangay_clearance_residency_or_indigency_papers_onl')}</p>
          <div className="queue-hero-actions"><Button size="lg" className="queue-cta" iconRight="arrow" onClick={start}>{t('prepare_my_documents')}</Button><Button size="lg" className="queue-outline" onClick={start}>{t('track_a_ticket')}</Button></div>
          <p className="queue-reference"><Icon name="help" size={16} />{t('your_tsek_number_is_a_reference_for_your_application_not_a_place')}</p>
        </div>
        <div className="queue-hero-ticket"><span className="queue-ready-label">{t('ready_for_barangay_review')}</span><PublicTicket /></div>
      </section>
    </div>
    <div className="queue-width queue-public-content">
      <section id="how" className="queue-how">
        <div className="queue-section-heading"><div><span className="queue-kicker">{t('how_it_works')}</span><h2>{t('like_a_queue_board_you_always_know_what_s_next')}</h2></div><p>{t('every_ticket_moves_through_the_same_steps_tsek_shows_where_yours')}</p></div>
        <div className="queue-board" role="table" aria-label={t('how_it_works')}>
          <div className="queue-board-head" role="row"><span role="columnheader">{t('step')}</span><span role="columnheader">{t('what_happens')}</span><span role="columnheader">{t('example_status')}</span></div>
          {[
            ['01', t('choose_a_service'), t('pick_the_certificate_you_need_and_see_exactly_what_to_bring'), t('done')],
            ['02', t('upload_documents'), t('a_file_for_each_requirement_replace_any_of_them_while_it_s_a_draf'), t('done')],
            ['03', t('tsek_check'), t('tsek_reads_each_file_and_flags_anything_missing_or_mismatched'), t('in_progress')],
            ['04', t('barangay_review'), t('submit_when_ready_staff_check_your_documents_and_leave_a_note'), t('next')],
          ].map(([number, title, copy, status]) => <div className="queue-board-row" role="row" key={number}><span className="queue-step" role="cell">{number}</span><div role="cell"><h3>{title}</h3><p>{copy}</p></div><div role="cell"><span className={`queue-example-status ${status === t('done') ? 'is-done' : status === t('next') ? 'is-next' : 'is-progress'}`}>{status !== t('next') && <span aria-hidden="true">● </span>}{status}</span></div></div>)}
        </div>
      </section>
      <section id="services" className="queue-services"><h2>{t('pick_your_ticket')}</h2><div className="queue-service-grid">
        {[
          ['shield', t('barangay_clearance'), t('for_employment_and_local_transactions'), t('valid_id_proof_of_residency_cedula_if_applicable')],
          ['home', t('certificate_of_residency'), t('proof_that_you_live_in_the_barangay'), t('valid_id_proof_of_residency_cedula_if_applicable')],
          ['file', t('certificate_of_indigency'), t('support_for_social_assistance_applications'), t('valid_id_proof_of_residency_cedula_if_applicable')],
        ].map(([icon, title, copy, requirements], index) => <article className="queue-service" key={title}><div className="queue-service-stub"><Icon name={icon as IconName} size={28} /><b>0{index + 1}</b></div><div className="queue-service-copy"><h3>{title}</h3><p>{copy}</p><small>{requirements}</small><a href="#/applications">{t('start_this_ticket')} <Icon name="arrow" size={16} /></a></div></article>)}
      </div></section>
      <section id="trust" className="queue-trust" aria-label={t('privacy_and_document_checks')}>
        {[
          ['shield', t('private_until_you_submit'), t('only_you_can_see_your_documents_submitting_shares_them_with_baran')],
          ['spark', t('ai_reads_staff_decide'), t('tsek_reads_your_files_and_flags_problems_it_doesn_t_verify_identi')],
          ['check', t('plain_language_checks'), t('every_flag_says_what_s_wrong_and_what_to_do_next_no_guessing_at_t')],
        ].map(([icon, title, copy]) => <article key={title}><span><Icon name={icon as IconName} size={24} /></span><h3>{title}</h3><p>{copy}</p></article>)}
      </section>
      <section id="faq" className="queue-faq"><h2>{t('common_questions')}</h2>
        {[
          [t('is_my_tsek_number_a_queue_number'), t('no_it_s_a_reference_for_your_application_so_you_and_barangay_staf')],
          [t('which_files_can_i_upload'), t('plain_text_txt_files_up_to_2_mib_for_now_pdf_and_photo_checks_are')],
          [t('does_tsek_approve_my_application'), t('no_tsek_reads_your_files_and_flags_problems_barangay_staff_review')],
          [t('who_can_see_my_documents'), t('only_you_can_see_your_documents_until_you_submit_submitting_share')],
        ].map(([question, answer], index) => <details key={question} open={index < 2}><summary>{question}<Icon name="plus" size={20} /></summary><p>{answer}</p></details>)}
      </section>
    </div>
    <footer className="queue-footer"><div className="queue-width"><div className="queue-footer-top"><div><Brand light /><p>{t('smart_document_preparation_for_filipino_citizens_tsek_only_shows')}</p></div><Button className="queue-cta" iconRight="arrow" onClick={start}>{t('prepare_my_documents')}</Button></div><div className="queue-footer-bottom"><span>{t('prototype_not_an_official_government_service')}</span><span>{t('csp221a_university_of_st_la_salle')}</span></div></div></footer>
  </main>;
}

export default function App() {
  const { t } = useCopy();
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const replaceLegacyDashboard = () => {
      if (window.location.hash === '#/dashboard') {
        window.history.replaceState(window.history.state, '', '#/applications');
      }
    };
    const changed = () => {
      replaceLegacyDashboard();
      setHash(window.location.hash);
    };
    window.addEventListener('hashchange', changed);
    replaceLegacyDashboard();
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  if (hash === '#/password-setup') return <Suspense fallback={<p role="status">{t('loading_password_setup')}</p>}><PasswordSetup /></Suspense>;
  if (/^#\/(login|signup|applications(?:\/[^/]+)?|dashboard|admin(?:\/(?:overview|applications|queue))?)$/.test(hash)) {
    const view = hash.startsWith('#/admin') ? 'admin' : 'applications';
    return <Suspense fallback={<p role="status">{t('loading_workspace')}</p>}><AuthenticatedWorkspace key={hash === '#/signup' ? 'signup' : 'login'} view={view} authMode={hash === '#/signup' ? 'signup' : 'login'} /></Suspense>;
  }
  return <Landing />;
}
