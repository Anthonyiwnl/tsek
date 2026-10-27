import { Badge, Button, FigmaIcon } from "./DesignUI";

import { demoApplications } from "./demoApplications";

/** Approved Figma overview; all displayed application records are illustrative. */
export default function CitizenDashboard({
  onNew,
  onApplications,
}: {
  onNew: () => void;
  onApplications: () => void;
}) {
  return (
    <div className="page citizen-overview">
      <div className="overview-heading">
        <div>
          <h1>Good morning, Alex</h1>
          <p>Your next barangay visit starts with a clear checklist.</p>
        </div>
        <Button onClick={onNew}>+&nbsp; New application</Button>
      </div>
      <section
        className="overview-metrics"
        aria-label="Sample application summary"
      >
        <article className="next-step-card">
          <span>YOUR NEXT STEP</span>
          <h2>One document to go.</h2>
          <p>Replace your blurry proof of address.</p>
          <button onClick={onNew}>
            Continue application <span aria-hidden="true">→</span>
          </button>
        </article>
        <article className="overview-stat">
          <p>Active applications</p>
          <strong>03</strong>
          <small>Across all services</small>
        </article>
        <article className="overview-stat">
          <p>Ready for review</p>
          <strong className="success-text">02</strong>
          <small>Requirements complete</small>
        </article>
        <article className="overview-stat">
          <p>Needs attention</p>
          <strong className="warning-text">01</strong>
          <small>A quick fix is needed</small>
        </article>
      </section>
      <div className="overview-middle">
        <section className="overview-panel readiness-panel">
          <div className="overview-panel-title">
            <h2>Application readiness</h2>
            <button onClick={onApplications}>View all →</button>
          </div>
          {demoApplications.map((a) => (
            <div className="readiness-row" key={a.ref}>
              <div>
                <h3>{a.name}</h3>
                <p>{a.readiness}</p>
              </div>
              <div
                className={`readiness-track ${a.progress === 100 ? "complete" : ""}`}
                role="progressbar"
                aria-label={`${a.name} requirements ready`}
                aria-valuenow={a.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${a.progress}%` }} />
              </div>
              <Badge tone={a.progress === 100 ? "success" : "warning"}>
                {a.progress === 100 ? "Ready" : "Needs correction"}
              </Badge>
            </div>
          ))}
        </section>
        <aside className="overview-guidance">
          <FigmaIcon name="sparkLight" />
          <h2>Let’s get you ready.</h2>
          <p>
            Your address document is difficult to read. Upload a brighter photo
            with all four corners visible.
          </p>
          <Button variant="secondary" onClick={onNew}>
            Fix my document →
          </Button>
          <small>Example AI guidance · Final review by barangay staff</small>
        </aside>
      </div>
      <section className="overview-panel recent-panel">
        <div className="overview-panel-title">
          <h2>Recent applications</h2>
          <button onClick={onApplications}>All applications →</button>
        </div>
        <div className="overview-table-wrap">
          <table className="overview-table">
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Reference</th>
                <th scope="col">Last updated</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {demoApplications.map((a) => (
                <tr key={a.ref}>
                  <th scope="row">{a.name}</th>
                  <td>{a.ref}</td>
                  <td>{a.updated}</td>
                  <td>
                    <Badge tone={a.tone}>
                      {a.status === "Ready for review" ? "Ready" : a.status}
                    </Badge>
                  </td>
                  <td>
                    <button
                      aria-label={`Open ${a.name}`}
                      onClick={onApplications}
                    >
                      Open →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="overview-footnote">
        <FigmaIcon name="shieldSmall" /> Demo data shown. Files stay in your
        browser. TSEK assists preparation; barangay staff make the final
        decision.
      </p>
    </div>
  );
}
