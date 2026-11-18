import { lazy, Suspense, useEffect, useState } from 'react';
import { Icon, Button, Brand, type IconName } from './DesignUI';
import PublicTicket from './PublicTicket';
import './App.css';
import './PublicPages.css';
const AuthenticatedWorkspace = lazy(() => import('./AuthenticatedWorkspace'));
const PasswordSetup = lazy(() => import('./PasswordSetup'));

/** Public Queue Ticket introduction; entry actions use the existing session gate. */
function Landing() {
  const start = () => { window.location.hash = '/applications'; };
  return <main className="queue-public">
    <div className="queue-public-dark">
      <nav className="queue-public-nav queue-width" aria-label="Main navigation">
        <Brand light />
        <div className="queue-nav-links"><a href="#how">How it works</a><a href="#services">Services</a><a href="#trust">Privacy</a><a href="#faq">FAQ</a></div>
        <div className="queue-nav-actions"><Button className="queue-outline" onClick={start}>Log in</Button><Button className="queue-cta" iconRight="arrow" onClick={start}>Get started</Button></div>
      </nav>
      <section className="queue-hero queue-width">
        <div className="queue-hero-copy">
          <span className="queue-intro"><Icon name="file" size={16} />Barangay papers, checked before you go</span>
          <h1>Every requirement checked before your ticket says <em>READY.</em></h1>
          <p>Prepare your barangay clearance, residency or indigency papers online. TSEK checks each document first, so your trip to the barangay hall isn’t wasted.</p>
          <div className="queue-hero-actions"><Button size="lg" className="queue-cta" iconRight="arrow" onClick={start}>Prepare my documents</Button><Button size="lg" className="queue-outline" onClick={start}>Track a ticket</Button></div>
          <p className="queue-reference"><Icon name="help" size={16} />Your TSEK number is a reference for your application — not a place in the barangay queue.</p>
        </div>
        <div className="queue-hero-ticket"><span className="queue-ready-label">● &nbsp;Ready for barangay review</span><PublicTicket /></div>
      </section>
    </div>
    <div className="queue-width queue-public-content">
      <section id="how" className="queue-how">
        <div className="queue-section-heading"><div><span className="queue-kicker">How it works</span><h2>Like a queue board — you always know what’s next.</h2></div><p>Every ticket moves through the same steps. TSEK shows where yours is and what you need to do.</p></div>
        <div className="queue-board" role="table" aria-label="How it works">
          <div className="queue-board-head" role="row"><span role="columnheader">Step</span><span role="columnheader">What happens</span><span role="columnheader">Example status</span></div>
          {[
            ['01', 'Choose a service', 'Pick the certificate you need and see exactly what to bring', 'Done'],
            ['02', 'Upload documents', 'A file for each requirement — replace any of them while it’s a draft', 'Done'],
            ['03', 'TSEK check', 'TSEK reads each file and flags anything missing or mismatched', 'In progress'],
            ['04', 'Barangay review', 'Submit when ready. Staff check your documents and leave a note', 'Next'],
          ].map(([number, title, copy, status]) => <div className="queue-board-row" role="row" key={number}><span className="queue-step" role="cell">{number}</span><div role="cell"><h3>{title}</h3><p>{copy}</p></div><div role="cell"><span className={`queue-example-status ${status === 'Done' ? 'is-done' : status === 'Next' ? 'is-next' : 'is-progress'}`}>{status !== 'Next' && <span aria-hidden="true">● </span>}{status}</span></div></div>)}
        </div>
      </section>
      <section id="services" className="queue-services"><h2>Pick your ticket</h2><div className="queue-service-grid">
        {[
          ['shield', 'Barangay Clearance', 'For employment and local transactions', 'Valid ID · Proof of residency · Cedula (if applicable)'],
          ['home', 'Certificate of Residency', 'Proof that you live in the barangay', 'Valid ID · Proof of residency'],
          ['file', 'Certificate of Indigency', 'Support for social assistance applications', 'Valid ID · Proof of residency · Purpose'],
        ].map(([icon, title, copy, requirements], index) => <article className="queue-service" key={title}><div className="queue-service-stub"><Icon name={icon as IconName} size={28} /><b>0{index + 1}</b></div><div className="queue-service-copy"><h3>{title}</h3><p>{copy}</p><small>{requirements}</small><a href="#/applications">Start this ticket <Icon name="arrow" size={16} /></a></div></article>)}
      </div></section>
      <section id="trust" className="queue-trust" aria-label="Privacy and document checks">
        {[
          ['shield', 'Private until you submit', 'Only you can see your documents. Submitting shares them with barangay staff for review.'],
          ['spark', 'AI reads, staff decide', 'TSEK reads your files and flags problems. It doesn’t verify identity, detect forgery or approve anything.'],
          ['check', 'Plain-language checks', 'Every flag says what’s wrong and what to do next — no guessing at the counter.'],
        ].map(([icon, title, copy]) => <article key={title}><span><Icon name={icon as IconName} size={24} /></span><h3>{title}</h3><p>{copy}</p></article>)}
      </section>
      <section id="faq" className="queue-faq"><h2>Common questions</h2>
        {[
          ['Is my TSEK number a queue number?', 'No. It’s a reference for your application so you and barangay staff can find it. TSEK doesn’t reserve a place in line.'],
          ['Which files can I upload?', 'Plain-text (.txt) files up to 2 MiB for now. PDF and photo checks aren’t available yet.'],
          ['Does TSEK approve my application?', 'No. TSEK reads your files and flags problems. Barangay staff review your submitted documents and make the decision.'],
          ['Who can see my documents?', 'Only you can see your documents until you submit. Submitting shares them with barangay staff for review.'],
        ].map(([question, answer], index) => <details key={question} open={index < 2}><summary>{question}<Icon name="plus" size={20} /></summary><p>{answer}</p></details>)}
      </section>
    </div>
    <footer className="queue-footer"><div className="queue-width"><div className="queue-footer-top"><div><Brand light /><p>Smart document preparation for Filipino citizens. TSEK only shows what’s needed to prepare your application.</p></div><Button className="queue-cta" iconRight="arrow" onClick={start}>Prepare my documents</Button></div><div className="queue-footer-bottom"><span>Prototype · Not an official government service</span><span>CSP221A · University of St. La Salle</span></div></div></footer>
  </main>;
}

export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const changed = () => setHash(window.location.hash);
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  if (hash === '#/password-setup') return <Suspense fallback={<p role="status">Loading password setup...</p>}><PasswordSetup /></Suspense>;
  if (/^#\/(applications(?:\/[^/]+)?|dashboard|admin(?:\/(?:overview|applications|queue))?)$/.test(hash)) {
    const view = hash.startsWith('#/admin') ? 'admin' : hash === '#/dashboard' ? 'dashboard' : 'applications';
    return <Suspense fallback={<p role="status">Loading workspace...</p>}><AuthenticatedWorkspace view={view} /></Suspense>;
  }
  return <Landing />;
}
