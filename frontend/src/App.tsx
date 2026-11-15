import { lazy, Suspense, useEffect, useState } from 'react';
import { Icon, Button, Brand, Badge, LogoImage } from './DesignUI';
import './App.css';
const AuthenticatedWorkspace = lazy(() => import('./AuthenticatedWorkspace'));

/** Render the public introduction, service previews, and demo entry links. */
function Landing() {
  return (
    <main className="landing">
      <nav className="public-nav">
        <Brand />
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#services">Services</a>
          <a href="#trust">Privacy</a>
        </div>
        <div className="nav-actions">
          <Button variant="ghost" onClick={() => { window.location.hash = "/applications"; }}>
            Log in
          </Button>
          <Button onClick={() => { window.location.hash = "/applications"; }}>
            Get started <Icon name="arrow" size={17} />
          </Button>
        </div>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Icon name="spark" size={16} /> AI-assisted document preparation
          </div>
          <h1>
            Your barangay requirements, <em>checked before you go.</em>
          </h1>
          <p>
            Upload your documents, check your requirements, and prepare your
            barangay application with clear, AI-assisted guidance.
          </p>
          <div className="hero-actions">
            <Button onClick={() => { window.location.hash = "/applications"; }}>
              Check my requirements <Icon name="arrow" size={18} />
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                document
                  .querySelector("#how")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              See how it works
            </Button>
          </div>
          <div className="trust-line">
            <Icon name="shield" size={18} />
            <span>Your files stay private and are never shared publicly.</span>
          </div>
        </div>
        <div className="hero-product">
          <div className="product-top">
            <span className="mini-brand">
              <LogoImage />
              TSEK
            </span>
            <Badge tone="success">Requirements complete</Badge>
          </div>
          <div className="doc-preview">
            <div className="document-sheet">
              <div className="doc-head">
                <div className="avatar-line" />
                <div>
                  <b>PHILIPPINE IDENTIFICATION CARD</b>
                  <span>Demo document preview</span>
                </div>
              </div>
              <div className="photo-placeholder" />
              <div className="fake-lines">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="analysis-card">
              <div className="analysis-title">
                <span className="spark-box">
                  <Icon name="spark" size={17} />
                </span>
                <div>
                  <b>Information extracted</b>
                  <small>AI-assisted reading complete</small>
                </div>
              </div>
              <div className="field">
                <span>Document type</span>
                <b>PhilSys ID</b>
                <Icon name="check" size={17} />
              </div>
              <div className="field">
                <span>Full name</span>
                <b>Alex D. Reyes</b>
                <Icon name="check" size={17} />
              </div>
              <div className="field">
                <span>Address</span>
                <b>Quezon City</b>
                <Icon name="check" size={17} />
              </div>
            </div>
          </div>
          <div className="progress-card">
            <span className="success-icon">
              <Icon name="check" size={18} />
            </span>
            <div>
              <b>2 of 2 requirements ready</b>
              <span>You can submit for barangay review.</span>
            </div>
            <Icon name="chevron" size={18} />
          </div>
        </div>
      </section>
      <section className="steps" id="how">
        <div className="section-heading">
          <span>Simple and guided</span>
          <h2>Ready in three clear steps</h2>
          <p>TSEK helps you prepare—not replace—official barangay review.</p>
        </div>
        <div className="step-grid">
          {[
            [
              "01",
              "Choose a service",
              "Select the certificate you need and see its requirements.",
            ],
            [
              "02",
              "Upload your documents",
              "Upload a plain-text document to extract information and check requirements.",
            ],
            [
              "03",
              "Check before you go",
              "Review missing items and prepare your application for barangay review.",
            ],
          ].map(([n, t, d]) => (
            <article className="step-card" key={n}>
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="service-section" id="services">
        <div>
          <span className="section-kicker">Available services</span>
          <h2>One place to prepare essential barangay documents</h2>
        </div>
        <div className="service-list">
          {[
            "Barangay Clearance",
            "Certificate of Residency",
            "Certificate of Indigency",
          ].map((x, i) => (
            <div className="service-row" key={x}>
              <span className="service-icon">
                <Icon name={i === 0 ? "shield" : "file"} />
              </span>
              <div>
                <b>{x}</b>
                <small>
                  {i === 0
                    ? "For employment and local transactions"
                    : i === 1
                      ? "Proof that you live in the barangay"
                      : "Support for social assistance applications"}
                </small>
              </div>
              <Icon name="arrow" />
            </div>
          ))}
        </div>
      </section>
      <section className="privacy-panel" id="trust">
        <div className="privacy-icon">
          <Icon name="shield" size={28} />
        </div>
        <div>
          <span className="section-kicker">Built with care</span>
          <h2>Your documents deserve respectful handling.</h2>
          <p>
            TSEK only displays the information needed to help prepare your
            application. AI reads available information; it does not
            authenticate identity, detect forgery, or grant official approval.
          </p>
        </div>
        <Button variant="secondary" onClick={() => { window.location.hash = "/applications"; }}>
          Start securely
        </Button>
      </section>
      <footer>
        <Brand light />
        <p>Smart document preparation for Filipino citizens.</p>
        <span>Prototype experience · Not an official government service</span>
      </footer>
    </main>
  );
}


export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const changed = () => setHash(window.location.hash);
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  if (/^#\/(applications(?:\/[^/]+)?|dashboard|admin(?:\/(?:overview|applications|queue))?)$/.test(hash)) {
    const view = hash.startsWith('#/admin') ? 'admin' : hash === '#/dashboard' ? 'dashboard' : 'applications';
    return <Suspense fallback={<p role="status">Loading workspace...</p>}><AuthenticatedWorkspace view={view} /></Suspense>;
  }
  return <Landing />;
}
