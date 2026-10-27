import { useState } from "react";
import { Icon, Button, Brand, Badge, LogoImage, type IconName } from "./DesignUI";
import NewApplication from "./NewApplication";
type Page =
  | "landing"
  | "login"
  | "dashboard"
  | "new"
  | "applications"
  | "documents"
  | "notifications"
  | "settings"
  | "admin";

/** Render the public introduction, service previews, and demo entry links. */
function Landing({ navigate }: { navigate: (p: Page) => void }) {
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
          <Button variant="ghost" onClick={() => navigate("login")}>
            Log in
          </Button>
          <Button onClick={() => navigate("login")}>
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
            <Button onClick={() => navigate("login")}>
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
              "Select the certificate you need and see its demo requirements.",
            ],
            [
              "02",
              "Upload your documents",
              "Add a clear photo or PDF. We'll guide you if something is hard to read.",
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
        <Button variant="secondary" onClick={() => navigate("login")}>
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

/** Render the demo entry form and account registration preview without authentication. */
function Login({ navigate }: { navigate: (p: Page) => void }) {
  const [show, setShow] = useState(false);
  const [register, setRegister] = useState(false);
  return (
    <main className="auth-page">
      <section className="auth-art">
        <Brand light />
        <div className="auth-message">
          <span className="eyebrow dark">
            <Icon name="shield" size={16} /> Clear. Private. Helpful.
          </span>
          <h1>Prepare with confidence before visiting your barangay.</h1>
          <p>
            Get simple guidance on your documents and requirements in one secure
            workspace.
          </p>
        </div>
        <div className="auth-mini-card">
          <span className="success-icon">
            <Icon name="check" />
          </span>
          <div>
            <b>Clear next steps</b>
            <small>Know what is ready and what needs attention.</small>
          </div>
        </div>
      </section>
      <section className="auth-form-wrap">
        <button
          className="text-button back-link"
          onClick={() => navigate("landing")}
        >
          ← Back to home
        </button>
        <form
          className="auth-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <div>
            <span className="section-kicker">
              {register ? "Preview account setup" : "Welcome back"}
            </span>
            <h2>
              {register
                ? "Start checking your requirements"
                : "Explore the TSEK demo"}
            </h2>
            <p>
              {register
                ? "It only takes a minute to get started."
                : "No account or password is needed. Sample records only."}
            </p>
          </div>
          {register && (
            <label>
              Full name
              <input disabled placeholder="Sample citizen account" />
            </label>
          )}
          <label>
            Email address
            <input
              required
              type="email"
              disabled
              placeholder="Demo account — no email needed"
            />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                required
                type={show ? "text" : "password"}
                disabled
                placeholder="Demo only — do not enter a password"
              />
              <button
                type="button"
                aria-label="Show password"
                onClick={() => setShow(!show)}
              >
                <Icon name="eye" />
              </button>
            </div>
          </label>
          {register && (
            <label>
              Confirm password
              <input
                required
                type="password"
                disabled
                placeholder="Not available in demo"
              />
            </label>
          )}
          <div className="form-meta">
            {register ? (
              <label className="checkbox">
                <input type="checkbox" disabled /> Registration is not connected
                in this demo.
              </label>
            ) : (
              <>
                <label className="checkbox">
                  <input type="checkbox" /> Remember me
                </label>
                <button className="text-button" type="button">
                  Forgot password?
                </button>
              </>
            )}
          </div>
          <Button type="submit" className="full">
            {register ? "Preview dashboard" : "Continue to demo"}{" "}
            <Icon name="arrow" size={18} />
          </Button>
          {!register && (
            <Button
              variant="secondary"
              className="full"
              onClick={() => navigate("admin")}
            >
              <Icon name="shield" size={18} /> Continue as barangay
              administrator
            </Button>
          )}
          <p className="switch-auth">
            {register ? "Already have an account?" : "New to TSEK?"}{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => setRegister(!register)}
            >
              {register ? "Log in" : "Create an account"}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}

const applications = [
  {
    name: "Barangay Clearance",
    ref: "TSK-2025-0428",
    updated: "Today, 9:32 AM",
    status: "Needs correction",
    tone: "error" as const,
    progress: 67,
  },
  {
    name: "Certificate of Residency",
    ref: "TSK-2025-0311",
    updated: "May 19, 2025",
    status: "Ready for review",
    tone: "success" as const,
    progress: 100,
  },
  {
    name: "Certificate of Indigency",
    ref: "TSK-2025-0227",
    updated: "May 17, 2025",
    status: "Draft",
    tone: "neutral" as const,
    progress: 32,
  },
];

/** Render citizen navigation with mobile visibility and a logout confirmation. */
function Sidebar({
  page,
  navigate,
  mobileOpen,
  close,
}: {
  page: Page;
  navigate: (p: Page) => void;
  mobileOpen: boolean;
  close: () => void;
}) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const items: [Page, IconName, string][] = [
    ["dashboard", "home", "Dashboard"],
    ["new", "plus", "New application"],
    ["applications", "file", "My applications"],
    ["documents", "folder", "My documents"],
    ["notifications", "bell", "Notifications"],
  ];
  return (
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="side-head">
        <Brand light />
        <button className="sidebar-close" onClick={close}>
          ×
        </button>
      </div>
      <nav>
        {items.map(([p, i, l]) => (
          <button
            key={p}
            className={page === p ? "active" : ""}
            onClick={() => {
              navigate(p);
              close();
            }}
          >
            <Icon name={i} />
            <span>{l}</span>
            {p === "notifications" && <i>2</i>}
          </button>
        ))}
      </nav>
      <div className="side-bottom">
        <button>
          <Icon name="help" />
          <span>Help center</span>
        </button>
        <button
          onClick={() => navigate("settings")}
          className={page === "settings" ? "active" : ""}
        >
          <Icon name="settings" />
          <span>Settings</span>
        </button>
        <button className="logout-nav" onClick={() => setLogoutOpen(true)}>
          <Icon name="logout" />
          <span>Log out</span>
        </button>
        <div className="profile">
          <span>AR</span>
          <div>
            <b>Alex Reyes</b>
            <small>Citizen account</small>
          </div>
          <Icon name="chevron" size={16} />
        </div>
      </div>
      {logoutOpen && (
        <div className="modal-backdrop">
          <div className="modal logout-modal">
            <span className="modal-icon">
              <Icon name="logout" />
            </span>
            <h2>Log out of TSEK?</h2>
            <p>
              This demo session will close. No drafts are saved to a database.
            </p>
            <div>
              <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
                Stay logged in
              </Button>
              <Button onClick={() => navigate("login")}>Log out</Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

/** Render the current citizen page title, menu trigger, and notification shortcut. */
function Topbar({
  page,
  openMenu,
  navigate,
}: {
  page: Page;
  openMenu: () => void;
  navigate: (p: Page) => void;
}) {
  const labels: Record<string, string> = {
    dashboard: "Dashboard",
    new: "New application",
    applications: "My applications",
    documents: "My documents",
    notifications: "Notifications",
    settings: "Settings",
  };
  return (
    <header className="topbar">
      <button
        className="mobile-menu"
        aria-label="Open navigation menu"
        onClick={openMenu}
      >
        <Icon name="menu" />
      </button>
      <div className="breadcrumb">
        <span>TSEK</span>
        <Icon name="chevron" size={14} />
        <b>{labels[page]}</b>
      </div>
      <div className="top-actions">
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder="Search applications" />
        </div>
        <button
          className="icon-button"
          aria-label="Open notifications"
          onClick={() => navigate("notifications")}
        >
          <Icon name="bell" />
          <i />
        </button>
        <span className="top-avatar">AR</span>
      </div>
    </header>
  );
}

/** Render sample citizen activity and shortcuts to the application checklist. */
function Dashboard({ navigate }: { navigate: (p: Page) => void }) {
  return (
    <div className="page dashboard">
      <section className="welcome">
        <div className="welcome-copy">
          <span>Tuesday, 20 May</span>
          <h1>Good morning, Alex.</h1>
          <p>Let’s continue where you left off.</p>
        </div>
        <div className="welcome-next">
          <span className="next-icon">
            <Icon name="warning" size={18} />
          </span>
          <div>
            <small>Your next step</small>
            <b>Replace one unclear document</b>
            <button onClick={() => navigate("new")}>
              Open application <Icon name="arrow" size={15} />
            </button>
          </div>
        </div>
        <Button onClick={() => navigate("new")}>
          <Icon name="plus" size={18} /> New application
        </Button>
      </section>
      <section className="summary-grid">
        {[
          ["Total applications", "3", "file", "info"],
          ["Draft applications", "1", "clock", "neutral"],
          ["Needs attention", "1", "warning", "error"],
          ["Ready for review", "1", "check", "success"],
        ].map(([l, n, i, t]) => (
          <article className="summary-card" key={l}>
            <span className={`summary-icon ${t}`}>
              <Icon name={i as IconName} />
            </span>
            <div>
              <b>{n}</b>
              <span>{l}</span>
            </div>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="panel recent">
          <div className="panel-title">
            <div>
              <h2>Recent applications</h2>
              <p>Continue where you left off.</p>
            </div>
            <button
              className="text-button"
              onClick={() => navigate("applications")}
            >
              View all <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="application-list">
            {applications.map((a, i) => (
              <button
                className="application-row"
                key={a.ref}
                onClick={() => navigate(i === 2 ? "new" : "applications")}
              >
                <span className="app-icon">
                  <Icon name="file" />
                </span>
                <div className="app-row-content">
                  <b>{a.name}</b>
                  <span>
                    {a.ref} · Updated {a.updated}
                  </span>
                  <div className="mini-progress">
                    <i style={{ width: `${a.progress}%` }} />
                  </div>
                </div>
                <Badge tone={a.tone}>{a.status}</Badge>
                <Icon name="chevron" size={18} />
              </button>
            ))}
          </div>
        </section>
        <section className="attention-card">
          <div className="attention-top">
            <span>
              <Icon name="warning" />
            </span>
            <Badge tone="error">Action needed</Badge>
          </div>
          <h2>One document needs a clearer copy</h2>
          <p>We couldn't clearly read the name on your proof of residency.</p>
          <div className="attention-file">
            <span className="app-icon">
              <Icon name="file" />
            </span>
            <div>
              <b>Utility_bill_may.pdf</b>
              <small>Barangay Clearance</small>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate("new")}>
            Replace document <Icon name="arrow" size={17} />
          </Button>
        </section>
      </div>
      <section className="quick-section">
        <div className="panel-title">
          <div>
            <h2>Start with a service</h2>
            <p>See demo requirements before creating an application.</p>
          </div>
        </div>
        <div className="quick-grid">
          {[
            "Barangay Clearance",
            "Certificate of Residency",
            "Certificate of Indigency",
          ].map((x, i) => (
            <button
              className="quick-card"
              key={x}
              onClick={() => navigate("new")}
            >
              <span className={`quick-icon q${i}`}>
                <Icon name={i === 0 ? "shield" : "file"} />
              </span>
              <div>
                <b>{x}</b>
                <span>
                  {i === 0
                    ? "2 required documents"
                    : i === 1
                      ? "2 required documents"
                      : "3 required documents"}
                </span>
              </div>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Render sample applications with a local draft deletion confirmation. */
function Applications({ navigate }: { navigate: (p: Page) => void }) {
  const [deleted, setDeleted] = useState(false);
  const [modal, setModal] = useState(false);
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="section-kicker">Workspace</span>
          <h1>My applications</h1>
          <p>Track progress, fix issues, and continue drafts.</p>
        </div>
        <Button onClick={() => navigate("new")}>
          <Icon name="plus" size={18} /> New application
        </Button>
      </div>
      <div className="toolbar">
        <div className="search wide">
          <Icon name="search" />
          <input placeholder="Search by service or reference" />
        </div>
        <div className="tabs">
          <button className="active">
            All <span>3</span>
          </button>
          <button>Drafts</button>
          <button>Needs attention</button>
          <button>Ready</button>
        </div>
      </div>
      <section className="applications-table">
        <div className="table-head">
          <span>Application</span>
          <span>Status</span>
          <span>Progress</span>
          <span>Last updated</span>
          <span>Action</span>
        </div>
        {applications
          .filter((_, i) => !(deleted && i === 2))
          .map((a, i) => (
            <div className="table-row" key={a.ref}>
              <div className="app-name">
                <span className="app-icon">
                  <Icon name="file" />
                </span>
                <div>
                  <b>{a.name}</b>
                  <small>{a.ref}</small>
                </div>
              </div>
              <Badge tone={a.tone}>{a.status}</Badge>
              <div className="table-progress">
                <span>
                  <i style={{ width: `${a.progress}%` }} />
                </span>
                <b>{a.progress}%</b>
              </div>
              <span>{a.updated}</span>
              <div className="row-actions">
                <Button
                  variant="secondary"
                  onClick={() => (i === 2 ? navigate("new") : navigate("new"))}
                >
                  {i === 2 ? "Continue" : "View"}
                </Button>
                {i === 2 && (
                  <button
                    className="delete-button"
                    aria-label="Delete draft"
                    onClick={() => setModal(true)}
                  >
                    <Icon name="trash" />
                  </button>
                )}
              </div>
            </div>
          ))}
      </section>
      {modal && (
        <div className="modal-backdrop">
          <div className="modal">
            <span className="modal-icon">
              <Icon name="trash" />
            </span>
            <h2>Delete this draft?</h2>
            <p>
              Certificate of Indigency and its uploaded demo files will be
              removed. This cannot be undone.
            </p>
            <div>
              <Button variant="secondary" onClick={() => setModal(false)}>
                Keep draft
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setDeleted(true);
                  setModal(false);
                }}
              >
                Delete draft
              </Button>
            </div>
          </div>
        </div>
      )}
      {deleted && (
        <div className="toast">
          <span>
            <Icon name="check" />
          </span>
          <div>
            <b>Draft deleted</b>
            <small>The application was removed.</small>
          </div>
        </div>
      )}
    </div>
  );
}

/** Render the sample document library and its illustrative document statuses. */
function Documents() {
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="section-kicker">Private files</span>
          <h1>My documents</h1>
          <p>Manage files connected to your applications.</p>
        </div>
      </div>
      <div className="toolbar">
        <div className="search wide">
          <Icon name="search" />
          <input placeholder="Search documents" />
        </div>
        <Button variant="secondary">
          All document types <Icon name="chevron" size={16} />
        </Button>
      </div>
      <div className="document-grid">
        {[
          [
            "PhilSys_ID.jpg",
            "Government ID",
            "Barangay Clearance",
            "Extraction complete",
            "success",
          ],
          [
            "Utility_bill_may.pdf",
            "Proof of residency",
            "Barangay Clearance",
            "Needs clearer copy",
            "error",
          ],
          [
            "Cedula_2025.pdf",
            "Cedula",
            "Certificate of Residency",
            "Checked",
            "success",
          ],
        ].map(([n, c, a, s, t], i) => (
          <article className="document-card" key={n}>
            <div className="doc-card-preview">
              <div className="paper">
                <Icon name="file" size={32} />
                <span>{i === 1 ? "PDF" : "JPG"}</span>
              </div>
              <Badge tone={t as "success" | "error"}>{s}</Badge>
            </div>
            <div className="doc-card-body">
              <b>{n}</b>
              <span>{c}</span>
              <dl>
                <div>
                  <dt>Related to</dt>
                  <dd>{a}</dd>
                </div>
                <div>
                  <dt>Uploaded</dt>
                  <dd>May {20 - i}, 2025</dd>
                </div>
              </dl>
              <Button variant="secondary">View document</Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/** Render sample activity notices with links to the relevant citizen pages. */
function Notifications({ navigate }: { navigate: (p: Page) => void }) {
  return (
    <div className="page narrow-page">
      <div className="page-title">
        <div>
          <span className="section-kicker">Updates</span>
          <h1>Notifications</h1>
          <p>Important activity from your applications.</p>
        </div>
        <button className="text-button">Mark all as read</button>
      </div>
      <section className="notification-panel">
        {[
          [
            "warning",
            "Clearer document needed",
            "We couldn't clearly read the name on your proof of residency.",
            "10 minutes ago",
            true,
          ],
          [
            "spark",
            "Extraction complete",
            "Information was extracted from your PhilSys ID. Please review it.",
            "Today, 9:31 AM",
            true,
          ],
          [
            "check",
            "Requirements ready",
            "Certificate of Residency is ready to submit for barangay review.",
            "Yesterday, 4:12 PM",
            false,
          ],
          [
            "file",
            "Draft saved",
            "Your Certificate of Indigency draft was saved.",
            "May 17, 2025",
            false,
          ],
        ].map(([icon, title, desc, time, unread]) => (
          <button
            className={`notification ${unread ? "unread" : ""}`}
            key={title as string}
            onClick={() =>
              navigate(icon === "warning" ? "new" : "applications")
            }
          >
            <span className={`notification-icon ${icon}`}>
              <Icon name={icon as IconName} />
            </span>
            <div>
              <b>{title}</b>
              <p>{desc}</p>
              <small>{time}</small>
            </div>
            <Icon name="chevron" />
          </button>
        ))}
      </section>
    </div>
  );
}

/** Render the profile preview with a local email notification toggle. */
function Settings() {
  const [email, setEmail] = useState(true);
  return (
    <div className="page settings-page">
      <div className="page-title">
        <div>
          <span className="section-kicker">Account</span>
          <h1>Profile and settings</h1>
          <p>Manage your personal details and preferences.</p>
        </div>
      </div>
      <div className="settings-layout">
        <nav>
          <button className="active">Personal information</button>
          <button>Security</button>
          <button>Notifications</button>
          <button>Privacy & documents</button>
        </nav>
        <div>
          <section className="settings-card">
            <h2>Personal information</h2>
            <p>Keep your account details up to date.</p>
            <div className="settings-avatar">
              <span>AR</span>
              <div>
                <b>Alex Reyes</b>
                <small>Citizen account</small>
              </div>
              <Button variant="secondary">Change photo</Button>
            </div>
            <div className="form-grid">
              <label>
                Full name
                <input defaultValue="Alex D. Reyes" />
              </label>
              <label>
                Email address
                <input defaultValue="alex.reyes@example.com" />
              </label>
              <label>
                Mobile number
                <input defaultValue="+63 917 123 4567" />
              </label>
              <label>
                City / Municipality
                <input defaultValue="Quezon City" />
              </label>
            </div>
            <div className="save-row">
              <Button>Save changes</Button>
            </div>
          </section>
          <section className="settings-card">
            <h2>Notification preferences</h2>
            <div className="toggle-row">
              <div>
                <b>Application updates</b>
                <p>
                  Updates about checks, missing documents, and review status.
                </p>
              </div>
              <button
                className={`toggle ${email ? "on" : ""}`}
                onClick={() => setEmail(!email)}
                aria-label="Toggle notifications"
              >
                <i />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

type AdminPage =
  | "overview"
  | "applications"
  | "queue"
  | "review"
  | "verification"
  | "requirements"
  | "residents"
  | "notifications"
  | "logs"
  | "settings";

const adminApplications = [
  {
    ref: "TSK-2025-0432",
    applicant: "Maria Santos",
    service: "Barangay Clearance",
    date: "Today, 8:42 AM",
    requirement: "Complete",
    status: "Pending review",
    tone: "warning" as const,
  },
  {
    ref: "TSK-2025-0431",
    applicant: "Jose Ramirez",
    service: "Certificate of Residency",
    date: "Yesterday, 4:15 PM",
    requirement: "Needs checking",
    status: "Under review",
    tone: "info" as const,
  },
  {
    ref: "TSK-2025-0429",
    applicant: "Ana Villanueva",
    service: "Certificate of Indigency",
    date: "May 19, 2:05 PM",
    requirement: "Incomplete",
    status: "Needs correction",
    tone: "error" as const,
  },
  {
    ref: "TSK-2025-0426",
    applicant: "Carlo Mendoza",
    service: "Barangay Clearance",
    date: "May 19, 10:21 AM",
    requirement: "Complete",
    status: "Approved",
    tone: "success" as const,
  },
];

/** Render administrator navigation with collapsible and mobile menu controls. */
function AdminSidebar({
  page,
  setPage,
  collapsed,
  setCollapsed,
  mobileOpen,
  close,
  exit,
}: {
  page: AdminPage;
  setPage: (p: AdminPage) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  close: () => void;
  exit: () => void;
}) {
  const items: [AdminPage, IconName, string][] = [
    ["overview", "home", "Dashboard"],
    ["applications", "file", "Applications"],
    ["queue", "clock", "Review queue"],
    ["verification", "shield", "Document verification"],
    ["requirements", "folder", "Requirements"],
    ["residents", "eye", "Residents"],
    ["notifications", "bell", "Notifications"],
    ["logs", "clock", "Activity logs"],
    ["settings", "settings", "Settings"],
  ];
  return (
    <aside
      className={`admin-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "open" : ""}`}
    >
      <div className="admin-side-brand">
        <Brand light />
        <button onClick={close}>×</button>
      </div>
      <div className="role-label">
        <span>BRGY</span>
        <div>
          <b>Administrator portal</b>
          <small>Demo workspace</small>
        </div>
      </div>
      <nav>
        {items.map(([p, i, l]) => (
          <button
            title={l}
            className={page === p ? "active" : ""}
            key={p}
            onClick={() => {
              setPage(p);
              close();
            }}
          >
            <Icon name={i} />
            <span>{l}</span>
            {p === "queue" && <i>8</i>}
          </button>
        ))}
      </nav>
      <div className="admin-side-bottom">
        <button onClick={() => setCollapsed(!collapsed)}>
          <Icon name="menu" />
          <span>{collapsed ? "Expand" : "Collapse sidebar"}</span>
        </button>
        <button onClick={exit}>
          <Icon name="logout" />
          <span>Return to citizen portal</span>
        </button>
      </div>
    </aside>
  );
}

/** Render the administrator page title, menu trigger, and notification shortcut. */
function AdminTopbar({
  title,
  openMenu,
  setPage,
}: {
  title: string;
  openMenu: () => void;
  setPage: (p: AdminPage) => void;
}) {
  return (
    <header className="admin-topbar">
      <button
        className="mobile-menu"
        aria-label="Open navigation menu"
        onClick={openMenu}
      >
        <Icon name="menu" />
      </button>
      <div>
        <span>Barangay Administrator</span>
        <h1>{title}</h1>
      </div>
      <div className="top-actions">
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder="Search records" />
        </div>
        <button
          className="icon-button"
          aria-label="Open notifications"
          onClick={() => setPage("notifications")}
        >
          <Icon name="bell" />
          <i />
        </button>
        <div className="admin-profile">
          <span>MD</span>
          <div>
            <b>Marites Dela Cruz</b>
            <small>Barangay Administrator</small>
          </div>
        </div>
      </div>
    </header>
  );
}

/** Render sample application rows, optionally shortened, with a review callback. */
function AdminTable({
  openReview,
  compact = false,
}: {
  openReview: () => void;
  compact?: boolean;
}) {
  return (
    <div className="admin-table">
      <div className="admin-table-head">
        <span>Application</span>
        <span>Applicant</span>
        <span>Service</span>
        <span>Submitted</span>
        <span>Status</span>
        <span>Action</span>
      </div>
      {adminApplications.slice(0, compact ? 3 : 4).map((a) => (
        <div className="admin-table-row" key={a.ref}>
          <div>
            <b>{a.ref}</b>
            <small>{a.requirement}</small>
          </div>
          <b>{a.applicant}</b>
          <span>{a.service}</span>
          <span>{a.date}</span>
          <Badge tone={a.tone}>{a.status}</Badge>
          <Button variant="secondary" onClick={openReview}>
            {compact ? "Review" : "Open"}
          </Button>
        </div>
      ))}
    </div>
  );
}

/** Render sample administrator metrics, a range selector, and review shortcuts. */
function AdminOverview({ setPage }: { setPage: (p: AdminPage) => void }) {
  const [range, setRange] = useState("7 days");
  return (
    <div className="admin-page">
      <section className="admin-welcome">
        <div>
          <span>Tuesday, 20 May</span>
          <h2>Good morning, Admin!</h2>
          <p>Here’s what’s happening with your barangay applications.</p>
        </div>
        <div className="scope-note">
          <Icon name="shield" />
          <span>Authorized barangay scope</span>
        </div>
      </section>
      <section className="admin-metrics">
        {[
          ["Total applications", "148", "+12 this month", "file"],
          ["Pending review", "8", "Oldest: 2 days", "clock"],
          ["Needs correction", "5", "3 resubmitted", "warning"],
          ["Completed reviews", "135", "91% of submissions", "check"],
        ].map(([t, n, d, i]) => (
          <article key={t}>
            <span>
              <Icon name={i as IconName} />
            </span>
            <div>
              <small>{t}</small>
              <b>{n}</b>
              <em>{d}</em>
            </div>
          </article>
        ))}
      </section>
      <div className="admin-dashboard-grid">
        <section className="admin-panel activity-chart">
          <div className="admin-panel-title">
            <div>
              <h3>Application activity</h3>
              <p>Submitted applications over time</p>
            </div>
            <div className="range-picker">
              {["7 days", "30 days", "90 days"].map((x) => (
                <button
                  className={range === x ? "active" : ""}
                  onClick={() => setRange(x)}
                  key={x}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>
          <div className="bar-chart">
            {[42, 65, 38, 78, 54, 88, 70].map((v, i) => (
              <div key={i}>
                <span style={{ height: `${v}%` }} />
                <small>
                  {["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"][i]}
                </small>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-panel attention-list">
          <div className="admin-panel-title">
            <div>
              <h3>Attention required</h3>
              <p>Items that need staff action</p>
            </div>
          </div>
          {[
            ["8", "Awaiting initial review", "queue"],
            ["3", "Documents need manual checking", "verification"],
            ["2", "Corrections resubmitted", "queue"],
          ].map(([n, t, p]) => (
            <button key={t} onClick={() => setPage(p as AdminPage)}>
              <b>{n}</b>
              <span>{t}</span>
              <Icon name="chevron" />
            </button>
          ))}
        </section>
      </div>
      <section className="admin-panel queue-preview">
        <div className="admin-panel-title">
          <div>
            <h3>Recent review queue</h3>
            <p>Submitted applications awaiting authorized staff action</p>
          </div>
          <button className="text-button" onClick={() => setPage("queue")}>
            View full queue <Icon name="arrow" size={16} />
          </button>
        </div>
        <AdminTable compact openReview={() => setPage("review")} />
      </section>
    </div>
  );
}

/** Render the sample application list or review queue with a demo empty search state. */
function AdminApplicationsPage({
  setPage,
  queue = false,
}: {
  setPage: (p: AdminPage) => void;
  queue?: boolean;
}) {
  const [query, setQuery] = useState("");
  return (
    <div className="admin-page">
      <div className="admin-page-title">
        <div>
          <span className="section-kicker">
            {queue ? "Operations" : "Records"}
          </span>
          <h2>{queue ? "Review queue" : "Applications"}</h2>
          <p>
            {queue
              ? "Process submitted applications in order of submission."
              : "Search and manage authorized barangay applications."}
          </p>
        </div>
        {queue && (
          <div className="queue-count">
            <b>8</b>
            <span>Pending review</span>
          </div>
        )}
      </div>
      <div className="admin-filters">
        <div className="search wide">
          <Icon name="search" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reference or applicant"
          />
        </div>
        <Button variant="secondary">
          All services <Icon name="chevron" size={15} />
        </Button>
        <Button variant="secondary">
          {queue ? "Oldest first" : "All statuses"}{" "}
          <Icon name="chevron" size={15} />
        </Button>
        <Button variant="secondary">
          Date submitted <Icon name="chevron" size={15} />
        </Button>
      </div>
      <div className="filter-summary">
        <span>Showing authorized demo records</span>
        <button className="text-button">
          Export list <small>Proposed</small>
        </button>
      </div>
      {query.toLowerCase() === "none" ? (
        <div className="admin-empty">
          <Icon name="search" size={30} />
          <h3>No applications found</h3>
          <p>Try changing your search or filters.</p>
        </div>
      ) : (
        <AdminTable openReview={() => setPage("review")} />
      )}
      <div className="pagination">
        <Button variant="secondary" disabled>
          Previous
        </Button>
        <span>Page 1 of 6</span>
        <Button variant="secondary">Next</Button>
      </div>
    </div>
  );
}

/** Render a sample document review with decisions held only in component state. */
function AdminReview({ setPage }: { setPage: (p: AdminPage) => void }) {
  const [document, setDocument] = useState("PhilSys ID");
  const [modal, setModal] = useState<
    "correction" | "approve" | "reject" | null
  >(null);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("Under review");
  const [toast, setToast] = useState("");
  /** Update the local review status, close the dialog, and briefly show confirmation. */
  const decide = (next: string) => {
    setStatus(next);
    setModal(null);
    setToast(`Application updated to ${next}`);
    setTimeout(() => setToast(""), 2600);
  };
  return (
    <div className="review-page">
      <div className="review-header">
        <button className="back-circle" onClick={() => setPage("queue")}>
          ←
        </button>
        <div>
          <span className="section-kicker">Application review</span>
          <h2>TSK-2025-0432 · Maria Santos</h2>
        </div>
        <Badge
          tone={
            status === "Approved"
              ? "success"
              : status === "Needs correction"
                ? "error"
                : "info"
          }
        >
          {status}
        </Badge>
      </div>
      <div className="ai-review-notice">
        <Icon name="spark" />
        <p>
          <b>AI-assisted results are preliminary.</b> Final application
          decisions require authorized staff review.
        </p>
      </div>
      <div className="review-workspace">
        <aside className="review-info">
          <section>
            <h3>Application information</h3>
            <dl>
              <div>
                <dt>Service</dt>
                <dd>Barangay Clearance</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>20 May 2025, 8:42 AM</dd>
              </div>
              <div>
                <dt>Applicant</dt>
                <dd>Maria Santos</dd>
              </div>
            </dl>
          </section>
          <section>
            <h3>Requirements</h3>
            {["Valid government ID", "Proof of residency"].map((x, i) => (
              <button
                className={
                  document === (i ? "Proof of Residency" : "PhilSys ID")
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setDocument(i ? "Proof of Residency" : "PhilSys ID")
                }
                key={x}
              >
                <Icon name={i ? "file" : "check"} />
                <span>
                  <b>{x}</b>
                  <small>
                    {i ? "Needs manual check" : "Extraction complete"}
                  </small>
                </span>
              </button>
            ))}
          </section>
          <section className="timeline-mini">
            <h3>Timeline</h3>
            <div>
              <i />
              <span>
                <b>Review opened</b>
                <small>Today, 9:14 AM</small>
              </span>
            </div>
            <div>
              <i />
              <span>
                <b>Application submitted</b>
                <small>Today, 8:42 AM</small>
              </span>
            </div>
          </section>
        </aside>
        <main className="document-viewer">
          <div className="viewer-toolbar">
            <div>
              <b>
                {document === "PhilSys ID"
                  ? "PhilSys_ID.jpg"
                  : "Utility_Bill.pdf"}
              </b>
              <small>Uploaded 20 May 2025</small>
            </div>
            <div>
              <button>−</button>
              <span>100%</span>
              <button>+</button>
            </div>
          </div>
          <div className="document-canvas">
            <div className="review-document">
              <div className="review-doc-head">
                <span>REPUBLIC OF THE PHILIPPINES</span>
                <b>
                  {document === "PhilSys ID"
                    ? "PHILIPPINE IDENTIFICATION CARD"
                    : "RESIDENTIAL UTILITY STATEMENT"}
                </b>
              </div>
              <div className="review-photo" />
              <div className="review-lines">
                <i />
                <i />
                <i />
                <i />
              </div>
              <small>Demonstration document preview</small>
            </div>
          </div>
          <div className="viewer-footer">
            <button>‹ Previous</button>
            <span>Document {document === "PhilSys ID" ? "1" : "2"} of 2</span>
            <button>Next ›</button>
          </div>
        </main>
        <aside className="analysis-review">
          <div className="analysis-tabs">
            <button className="active">Findings</button>
            <button>Notes</button>
          </div>
          <section>
            <div className="analysis-section-title">
              <span className="spark-box">
                <Icon name="spark" />
              </span>
              <div>
                <h3>AI-extracted information</h3>
                <small>Review all values before deciding</small>
              </div>
            </div>
            <dl>
              <div>
                <dt>Detected type</dt>
                <dd>{document}</dd>
              </div>
              <div>
                <dt>Applicant name</dt>
                <dd>Maria L. Santos</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>Brgy. San Isidro, Quezon City</dd>
              </div>
            </dl>
          </section>
          <section>
            <h3>Backend requirement checks</h3>
            <div className="review-check">
              <Icon name="check" />
              <span>
                <b>Document category matches</b>
                <small>Matches configured requirement</small>
              </span>
            </div>
            <div className="review-check warning">
              <Icon name="warning" />
              <span>
                <b>Address needs confirmation</b>
                <small>Unit number was not clearly extracted</small>
              </span>
            </div>
          </section>
          <label>
            Administrator notes
            <textarea placeholder="Add an internal review note…" />
          </label>
          <div className="decision-actions">
            <Button variant="secondary" onClick={() => setModal("correction")}>
              Request correction
            </Button>
            <Button variant="secondary" onClick={() => setModal("reject")}>
              Reject
            </Button>
            <Button onClick={() => setModal("approve")}>
              <Icon name="check" size={17} /> Approve
            </Button>
          </div>
        </aside>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <div className="modal">
            <span
              className={`modal-icon ${modal === "approve" ? "approve" : ""}`}
            >
              <Icon
                name={
                  modal === "approve"
                    ? "check"
                    : modal === "reject"
                      ? "warning"
                      : "file"
                }
              />
            </span>
            <h2>
              {modal === "approve"
                ? "Approve this application?"
                : modal === "reject"
                  ? "Reject this application?"
                  : "Request a correction?"}
            </h2>
            <p>
              {modal === "approve"
                ? "Confirm that authorized staff have reviewed the application and supporting documents."
                : "Provide a clear reason that can guide the citizen’s next action."}
            </p>
            {modal !== "approve" && (
              <label>
                Reason
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain what needs attention…"
                />
              </label>
            )}
            <div>
              <Button variant="secondary" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button
                variant={modal === "reject" ? "danger" : "primary"}
                disabled={modal !== "approve" && !reason.trim()}
                onClick={() =>
                  decide(
                    modal === "approve"
                      ? "Approved"
                      : modal === "reject"
                        ? "Rejected"
                        : "Needs correction",
                  )
                }
              >
                Confirm decision
              </Button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast">
          <Icon name="check" />
          <div>
            <b>Review saved</b>
            <small>{toast}</small>
          </div>
        </div>
      )}
    </div>
  );
}

/** Render sample service requirements with local edit and save feedback. */
function AdminRequirements() {
  const [service, setService] = useState("Barangay Clearance");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="admin-page">
      <div className="admin-page-title">
        <div>
          <span className="section-kicker">Configuration</span>
          <h2>Requirements management</h2>
          <p>
            Manage authorized demo requirements without changing previously
            reviewed records.
          </p>
        </div>
        <Button onClick={() => setEditing(true)}>
          <Icon name="plus" size={17} /> Add requirement
        </Button>
      </div>
      <div className="requirements-admin">
        <aside>
          {[
            "Barangay Clearance",
            "Certificate of Residency",
            "Certificate of Indigency",
          ].map((x) => (
            <button
              className={service === x ? "active" : ""}
              onClick={() => setService(x)}
              key={x}
            >
              <Icon name="file" />
              <span>{x}</span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </aside>
        <section className="admin-panel">
          <div className="admin-panel-title">
            <div>
              <h3>{service}</h3>
              <p>2 required · 1 optional</p>
            </div>
            <Badge tone="info">Demo configuration</Badge>
          </div>
          {[
            [
              "Valid government-issued ID",
              "Required",
              "PhilSys ID, passport, or driver’s license",
            ],
            [
              "Proof of residency",
              "Required",
              "Utility bill, lease document, or cedula",
            ],
            ["Supporting letter", "Optional", "Additional supporting document"],
          ].map(([n, t, d]) => (
            <div className="managed-requirement" key={n}>
              <span className="app-icon">
                <Icon name="file" />
              </span>
              <div>
                <b>{n}</b>
                <p>{d}</p>
              </div>
              <Badge tone={t === "Required" ? "info" : "neutral"}>{t}</Badge>
              <button onClick={() => setEditing(true)}>Edit</button>
            </div>
          ))}
        </section>
      </div>
      {editing && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Edit requirement</h2>
            <label>
              Requirement name
              <input defaultValue="Proof of residency" />
            </label>
            <label>
              Description
              <textarea defaultValue="A recent document showing available address information." />
            </label>
            <label className="checkbox">
              <input type="checkbox" defaultChecked /> Required for this service
            </label>
            <div>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setEditing(false);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2500);
                }}
              >
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
      {saved && (
        <div className="toast">
          <Icon name="check" />
          <div>
            <b>Requirement updated</b>
            <small>Changes apply to new applications.</small>
          </div>
        </div>
      )}
    </div>
  );
}

/** Render the selected administrator directory, activity, or settings preview. */
function AdminDirectory({
  type,
  setPage,
}: {
  type: "verification" | "residents" | "notifications" | "logs" | "settings";
  setPage: (p: AdminPage) => void;
}) {
  const content = {
    verification: [
      "Document verification",
      "Review extraction issues and backend validation results.",
    ],
    residents: [
      "Resident records",
      "Privacy-conscious access to authorized resident records.",
    ],
    notifications: [
      "Notifications",
      "Application updates and operational alerts.",
    ],
    logs: ["Activity logs", "Accountable history of administrator actions."],
    settings: [
      "Administrator settings",
      "Manage your profile, security, and barangay preferences.",
    ],
  }[type];
  if (type === "settings")
    return (
      <div className="admin-page">
        <div className="admin-page-title">
          <div>
            <span className="section-kicker">Account</span>
            <h2>{content[0]}</h2>
            <p>{content[1]}</p>
          </div>
        </div>
        <div className="settings-card admin-settings">
          <h3>Administrator profile</h3>
          <div className="settings-avatar">
            <span>MD</span>
            <div>
              <b>Marites Dela Cruz</b>
              <small>Barangay Administrator · Authorized demo scope</small>
            </div>
            <Button variant="secondary">Update profile</Button>
          </div>
          <div className="form-grid">
            <label>
              Email address
              <input defaultValue="admin@barangay.gov.ph" />
            </label>
            <label>
              Barangay office
              <input defaultValue="Barangay San Isidro" />
            </label>
          </div>
        </div>
        <div className="settings-card">
          <h3>Account security</h3>
          <div className="toggle-row">
            <div>
              <b>Session monitoring</b>
              <p>Review and end active administrator sessions.</p>
            </div>
            <Button variant="secondary">View sessions</Button>
          </div>
        </div>
      </div>
    );
  const rows =
    type === "residents"
      ? [
          ["Maria Santos", "3 applications", "Last activity: Today"],
          ["Jose Ramirez", "1 application", "Last activity: Yesterday"],
          ["Ana Villanueva", "2 applications", "Last activity: May 19"],
        ]
      : type === "logs"
        ? [
            [
              "Application approved",
              "TSK-2025-0426",
              "Marites Dela Cruz · Today, 8:55 AM",
            ],
            [
              "Correction requested",
              "TSK-2025-0429",
              "Marites Dela Cruz · Yesterday, 4:20 PM",
            ],
            [
              "Review opened",
              "TSK-2025-0431",
              "Juan Reyes · Yesterday, 3:48 PM",
            ],
          ]
        : type === "notifications"
          ? [
              ["New application submitted", "TSK-2025-0432", "10 minutes ago"],
              ["Correction resubmitted", "TSK-2025-0429", "1 hour ago"],
              [
                "Document extraction needs review",
                "TSK-2025-0431",
                "Yesterday",
              ],
            ]
          : [
              [
                "Unreadable address field",
                "Utility_Bill.pdf",
                "Needs manual review",
              ],
              [
                "Document type mismatch",
                "Passport_scan.jpg",
                "Open related application",
              ],
              [
                "Extraction complete",
                "PhilSys_ID.jpg",
                "Ready for staff review",
              ],
            ];
  return (
    <div className="admin-page">
      <div className="admin-page-title">
        <div>
          <span className="section-kicker">Authorized workspace</span>
          <h2>{content[0]}</h2>
          <p>{content[1]}</p>
        </div>
      </div>
      <div className="admin-filters">
        <div className="search wide">
          <Icon name="search" />
          <input placeholder={`Search ${content[0].toLowerCase()}`} />
        </div>
        <Button variant="secondary">
          All records <Icon name="chevron" size={15} />
        </Button>
      </div>
      <section className="admin-panel directory-list">
        {rows.map((r) => (
          <button
            key={r[0]}
            onClick={() =>
              type === "residents" ? setPage("applications") : setPage("review")
            }
          >
            <span className="app-icon">
              <Icon
                name={
                  type === "logs"
                    ? "clock"
                    : type === "notifications"
                      ? "bell"
                      : type === "residents"
                        ? "eye"
                        : "file"
                }
              />
            </span>
            <div>
              <b>{r[0]}</b>
              <p>{r[1]}</p>
            </div>
            <span>{r[2]}</span>
            <Icon name="chevron" />
          </button>
        ))}
      </section>
    </div>
  );
}

/** Manage administrator page selection and responsive navigation for the demo. */
function AdminPortal({ exit }: { exit: () => void }) {
  const [page, setPage] = useState<AdminPage>("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const titles: Record<AdminPage, string> = {
    overview: "Dashboard",
    applications: "Applications",
    queue: "Review Queue",
    review: "Application Review",
    verification: "Document Verification",
    requirements: "Requirements Management",
    residents: "Residents",
    notifications: "Notifications",
    logs: "Activity Logs",
    settings: "Settings",
  };
  return (
    <div className={`admin-shell ${collapsed ? "is-collapsed" : ""}`}>
      <AdminSidebar
        page={page}
        setPage={setPage}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        close={() => setMobileOpen(false)}
        exit={exit}
      />
      <div className="admin-main">
        <div className="demo-notice" role="note">
          Administrator design preview · Sample records only. Decisions and
          edits are not saved.
        </div>
        <AdminTopbar
          title={titles[page]}
          openMenu={() => setMobileOpen(true)}
          setPage={setPage}
        />
        {page === "overview" && <AdminOverview setPage={setPage} />}{" "}
        {page === "applications" && <AdminApplicationsPage setPage={setPage} />}{" "}
        {page === "queue" && <AdminApplicationsPage setPage={setPage} queue />}{" "}
        {page === "review" && <AdminReview setPage={setPage} />}{" "}
        {page === "requirements" && <AdminRequirements />}{" "}
        {[
          "verification",
          "residents",
          "notifications",
          "logs",
          "settings",
        ].includes(page) && (
          <AdminDirectory
            type={
              page as
                | "verification"
                | "residents"
                | "notifications"
                | "logs"
                | "settings"
            }
            setPage={setPage}
          />
        )}
      </div>
      {mobileOpen && (
        <div className="side-overlay" onClick={() => setMobileOpen(false)} />
      )}
    </div>
  );
}

/** Manage navigation between public pages and the citizen and administrator demos. */
export default function App() {
  const [page, setPage] = useState<Page>("landing");
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Select a citizen or public page and smoothly scroll to the top. */
  const navigate = (p: Page) => {
    setPage(p);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  if (page === "landing") return <Landing navigate={navigate} />;
  if (page === "login") return <Login navigate={navigate} />;
  if (page === "admin")
    return <AdminPortal exit={() => navigate("dashboard")} />;
  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        navigate={navigate}
        mobileOpen={mobileOpen}
        close={() => setMobileOpen(false)}
      />
      <div className="app-main">
        <div className="demo-notice" role="note">
          Demo workspace · Sample records · Files stay in your browser · No AI
          verification or database storage yet.
        </div>
        <Topbar
          page={page}
          openMenu={() => setMobileOpen(true)}
          navigate={navigate}
        />
        {page === "dashboard" && <Dashboard navigate={navigate} />}{" "}
        {page === "new" && (
          <NewApplication onExit={() => navigate("dashboard")} />
        )}{" "}
        {page === "applications" && <Applications navigate={navigate} />}{" "}
        {page === "documents" && <Documents />}{" "}
        {page === "notifications" && <Notifications navigate={navigate} />}{" "}
        {page === "settings" && <Settings />}
      </div>
      {mobileOpen && (
        <div className="side-overlay" onClick={() => setMobileOpen(false)} />
      )}
    </div>
  );
}

