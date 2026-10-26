import { useEffect, useState } from "react";
import { Badge, Button, Icon } from "./DesignUI";
import { loadCatalogue } from "./catalogue.js";

type Requirement = { id: string; name: string; is_required: boolean };
type Service = {
  id: string;
  name: string;
  description: string;
  requirements: Requirement[];
};
const endpoint = import.meta.env.VITE_CATALOGUE_ENDPOINT || "/api/document-types";

/** Render progress through the five checklist steps and mark the current step. */
function Stepper({ step }: { step: number }) {
  return (
    <div className="stepper" aria-label={`Step ${step} of 5`}>
      {[
        "Select service",
        "Requirements",
        "Choose files",
        "Review checklist",
        "Results",
      ].map((name, index) => (
        <div
          className={
            index + 1 === step ? "current" : index + 1 < step ? "done" : ""
          }
          key={name}
          aria-current={index + 1 === step ? "step" : undefined}
        >
          <span>
            {index + 1 < step ? <Icon name="check" size={15} /> : index + 1}
          </span>
          <b>{name}</b>
        </div>
      ))}
    </div>
  );
}

/** Guide service selection and local file checks without uploading or saving documents. */
export default function NewApplication({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState("");
  const [files, setFiles] = useState<Record<string, File>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [purpose, setPurpose] = useState("");
  const [checking, setChecking] = useState(false);
  const service = services.find((item) => item.id === selected);
  const count =
    service?.requirements.filter((item) => files[item.id]).length || 0;
  const missing = service?.requirements.filter((item) => item.is_required && !files[item.id]) || [];

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);
    /** Reset the checklist, fetch and validate service definitions, and update the loading state. */
    async function load() {
      setStatus("loading");
      setStep(1);
      setSelected("");
      setServices([]);
      setFiles({});
      setErrors({});
      setChecking(false);
      try {
        const catalogue = await loadCatalogue(endpoint, controller.signal);
        if (controller.signal.aborted) return;
        setServices(catalogue);
        setStatus(catalogue.length ? "ready" : "empty");
      } catch (error) {
        if (
          !(error instanceof DOMException && error.name === "AbortError") ||
          timedOut
        )
          setStatus("error");
      } finally {
        clearTimeout(timer);
      }
    }
    load();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  useEffect(() => {
    if (!checking) return;
    const timer = setTimeout(() => {
      setChecking(false);
      setStep(5);
    }, 700);
    return () => clearTimeout(timer);
  }, [checking]);

  /** Validate a selected file type and size, retaining valid files locally by requirement ID. */
  function attach(id: string, file?: File) {
    if (!file) return;
    // Use the extension only when MIME metadata is absent; it does not verify contents.
    const supportedType =
      ["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
      (file.type === "" && /\.(pdf|jpe?g|png)$/i.test(file.name));
    const message = !supportedType
      ? "Choose a PDF, JPG, or PNG file."
      : file.size > 5 * 1024 * 1024
        ? "Choose a file no larger than 5 MB."
        : file.size === 0
          ? "This file is empty. Choose another file."
          : "";
    setErrors((previous) => ({ ...previous, [id]: message }));
    if (!message) setFiles((previous) => ({ ...previous, [id]: file }));
  }
  /** Remove a requirement's local file selection and clear its validation error. */
  function remove(id: string) {
    setFiles((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setErrors((previous) => ({ ...previous, [id]: "" }));
  }
  /** Return to the previous checklist step, or exit when already on the first step. */
  const back = () => (step === 1 ? onExit() : setStep((value) => value - 1));
  return (
    <div className="page wizard-page">
      <div className="wizard-heading">
        <button className="back-circle" aria-label="Go back" onClick={back}>
          ←
        </button>
        <div>
          <span className="section-kicker">New application</span>
          <h1>{step === 1 ? "What do you need?" : service?.name}</h1>
          <p>
            Requirements from the service catalogue. Confirm any special conditions with your barangay.
          </p>
        </div>
        <Badge tone="neutral">Browser session only</Badge>
      </div>
      <Stepper step={step} />
      <section
        className="wizard-panel"
        aria-busy={status === "loading" || checking}
      >
        {step === 1 && (
          <>
            <div className="section-heading left">
              <h2>Select a barangay service</h2>
              <p>Choose one to see the documents you may need.</p>
            </div>
            <div aria-live="polite">
              {status === "loading" && (
                <div className="api-state" role="status">
                  <span className="loading-spinner" />
                  Loading available services…
                </div>
              )}
              {status === "empty" && (
                <div className="api-state">
                  <Icon name="folder" size={34} />
                  <h3>No services available yet</h3>
                  <p>Please check back later.</p>
                  <Button
                    variant="secondary"
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    Refresh services
                  </Button>
                </div>
              )}
              {status === "error" && (
                <div className="api-state" role="alert">
                  <Icon name="warning" size={34} />
                  <h3>Services couldn’t load</h3>
                  <p>Check your connection and try again.</p>
                  <Button onClick={() => setAttempt((value) => value + 1)}>
                    Try again
                  </Button>
                </div>
              )}
            </div>
            {status === "ready" && (
              <div className="select-services">
                {services.map((item, index) => (
                  <button
                    className={selected === item.id ? "selected" : ""}
                    key={item.id}
                    aria-pressed={selected === item.id}
                    onClick={() => {
                      setSelected(item.id);
                      setFiles({});
                      setErrors({});
                      setPurpose("");
                    }}
                  >
                    <span className="quick-icon">
                      <Icon name={index === 0 ? "shield" : "file"} />
                    </span>
                    <div>
                      <b>{item.name}</b>
                      <p>{item.description}</p>
                      <small>
                        {item.requirements.length} requirements
                      </small>
                    </div>
                    <span className="radio">
                      {selected === item.id && <i />}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {step === 2 && service && (
          <>
            <div className="section-heading left">
              <h2>Review the requirements</h2>
              <p>Have these ready before you continue.</p>
            </div>
            {service.requirements.length === 0 && (
              <p role="status">No requirements are listed for this service yet. Confirm with your barangay before proceeding.</p>
            )}
            <div className="requirements">
              {service.requirements.map((req) => (
                <div className="requirement" key={req.id}>
                  <span className="req-check">
                    <Icon name="check" />
                  </span>
                  <div>
                    <div>
                      <b>{req.name}</b>
                      <Badge tone="info">{req.is_required ? "Required" : "Optional / conditional"}</Badge>
                    </div>
                    <p>Prepare a clear PDF, JPG, or PNG file.</p>
                  </div>
                </div>
              ))}
            </div>
            <label className="purpose-field">
              Purpose of request (optional)
              <input
                maxLength={200}
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                placeholder="e.g. Employment requirements"
              />
            </label>
            <div className="note">
              <Icon name="help" />
              <p>
                <b>Clear files work best.</b> Files can be up to 5 MB. This demo
                checks file selection only; it does not verify document
                contents.
              </p>
            </div>
          </>
        )}
        {step === 3 && service && (
          <>
            <div className="section-heading left">
              <h2>Prepare your documents</h2>
              <p>
                Select a file for each requirement. Your files stay in this
                browser and are not uploaded.
              </p>
            </div>
            <div className="upload-layout">
              <div className="local-file-list">
                {service.requirements.map((req) => (
                  <section className="local-file-card" key={req.id}>
                    <div className="local-file-heading">
                      <span className="app-icon">
                        <Icon name="file" />
                      </span>
                      <h3>{req.name}</h3>
                      <Badge tone={files[req.id] ? "success" : "warning"}>
                        {files[req.id] ? "Selected" : req.is_required ? "Missing" : "Optional / conditional"}
                      </Badge>
                    </div>
                    {files[req.id] && (
                      <div className="local-file-detail">
                        <span>
                          {files[req.id].name} ·{" "}
                          {Math.max(1, Math.round(files[req.id].size / 1024))}{" "}
                          KB
                        </span>
                        <button
                          className="text-button"
                          aria-label={`Remove ${req.name}`}
                          onClick={() => remove(req.id)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <label
                      htmlFor={`file-${req.id}`}
                      className="local-file-label"
                    >
                      {files[req.id] ? "Replace file" : "Choose file"}
                      <small>PDF, JPG, or PNG · Maximum 5 MB</small>
                    </label>
                    <input
                      id={`file-${req.id}`}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      aria-describedby={`hint-${req.id}`}
                      onChange={(event) => {
                        attach(req.id, event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                    <p
                      id={`hint-${req.id}`}
                      className={errors[req.id] ? "file-error" : "sr-only"}
                      role={errors[req.id] ? "alert" : undefined}
                    >
                      {errors[req.id] || "PDF, JPG, or PNG, up to 5 MB."}
                    </p>
                  </section>
                ))}
              </div>
              <div className="upload-side">
                <div className="side-title">
                  <h3>File checklist</h3>
                  <span role="status">
                    {count} of {service.requirements.length}
                  </span>
                </div>
                {service.requirements.map((req, index) => (
                  <div
                    className={`check-item ${files[req.id] ? "complete" : ""}`}
                    key={req.id}
                  >
                    {files[req.id] ? (
                      <Icon name="check" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                    <div>
                      <b>{req.name}</b>
                      <small>
                        {files[req.id]
                          ? "Selected in this browser"
                          : req.is_required ? "Still needed" : "Optional / conditional"}
                      </small>
                    </div>
                  </div>
                ))}
                <div className="privacy-tip">
                  <Icon name="shield" />
                  <p>
                    Files and purpose text stay on your device. Refreshing or
                    leaving this checklist clears them.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
        {step === 4 && service && (
          <div className="review-grid">
            <div>
              <div className="section-heading left">
                <h2>Review your checklist</h2>
                <p>Check the files you have selected.</p>
              </div>
              {purpose && <p className="purpose-summary">Purpose: {purpose}</p>}
              {service.requirements.map((req) => (
                <div
                  className={`review-doc ${!files[req.id] ? "missing" : ""}`}
                  key={req.id}
                >
                  <span className="app-icon">
                    <Icon name={files[req.id] ? "file" : "warning"} />
                  </span>
                  <div>
                    <b>{req.name}</b>
                    <span>{files[req.id]?.name || "No file selected"}</span>
                  </div>
                  <Badge tone={files[req.id] ? "success" : "warning"}>
                    {files[req.id] ? "Selected" : req.is_required ? "Missing" : "Optional / conditional"}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="what-happens">
              <span className="spark-box">
                <Icon name="check" />
              </span>
              <h3>What happens next?</h3>
              <ol>
                <li>Count the files selected.</li>
                <li>Identify missing requirements.</li>
                <li>Show your next steps.</li>
              </ol>
              <p>
                This checks file presence only. AI reading, document
                verification, and database storage are not connected yet.
              </p>
            </div>
          </div>
        )}
        {step === 5 && service && (
          <div className="results" aria-live="polite">
            <span className="result-mark">
              <Icon name={missing.length ? "warning" : "check"} size={28} />
            </span>
            <Badge tone={missing.length ? "warning" : "success"}>
              {missing.length
                ? `${missing.length} item${missing.length === 1 ? "" : "s"} still needed`
                : "All files selected"}
            </Badge>
            <h2>
              {missing.length
                ? "A few things still need your attention."
                : "Your required files are selected."}
            </h2>
            <p>
              {missing.length
                ? "Add the missing files before preparing your barangay visit."
                : "All required items have a file selected. Confirm your official requirements with your barangay."}
            </p>
            <div className="result-list">
              {service.requirements.map((req) => (
                <div key={req.id}>
                  <Icon name={files[req.id] ? "check" : "warning"} />
                  <span>
                    <b>{req.name}</b>
                    <small>{files[req.id]?.name || "No file selected"}</small>
                  </span>
                  <Badge tone={files[req.id] ? "success" : "warning"}>
                    {files[req.id] ? "Selected" : req.is_required ? "Missing" : "Optional / conditional"}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="result-note">
              <Icon name="shield" />
              <p>
                Document contents, authenticity, and eligibility have not been
                verified. Nothing has been submitted or saved to a database.
              </p>
            </div>
          </div>
        )}
        {checking && (
          <p className="checking-status" role="status">
            Reviewing your checklist…
          </p>
        )}
        <div className="wizard-actions">
          <Button variant="ghost" disabled={checking} onClick={back}>
            {step === 1 ? "Back to dashboard" : "Back"}
          </Button>
          {step < 5 ? (
            <Button
              disabled={!service || (step >= 2 && service.requirements.length === 0) || checking}
              onClick={() =>
                step === 4 ? setChecking(true) : setStep((value) => value + 1)
              }
            >
              {checking
                ? "Reviewing…"
                : step === 4
                  ? "Review my checklist"
                  : "Continue"}
              <Icon name="arrow" size={17} />
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep(3)}>
                Manage files
              </Button>
              <Button onClick={onExit}>Back to dashboard</Button>
            </>
          )}
        </div>
      </section>

    </div>
  );
}
