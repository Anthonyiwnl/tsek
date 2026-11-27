import PrintSummary from './PrintSummary';
import { formatDateTime } from './date-time';
import AppHeader from './AppHeader';
import ApplicationTracker from './ApplicationTracker';
import CitizenOverview from './CitizenOverview';
import './ticket.css';
import { useEffect, useId, useRef, useState } from 'react';
import { Badge, Button, Icon } from './DesignUI';
import Modal from './Modal';
import { useResource } from './useResource';
import { toReference } from './reference';
import { ApiError, createApplicationApi, errorMessage, validateUpload, validateUploadText } from './application-api.js';
import './workspace.css';
import './application-modals.css';

type Api = ReturnType<typeof createApplicationApi>;
type Application = { id: string; document_type_id: string; document_type_name: string; purpose: string; status: string; updated_at: string };
type Service = { id: string; name: string };
type SavedFile = { id: string; original_name: string; media_type: string; size: number; character_count?: number | null };
type SavedFiles = ReturnType<typeof useResource<SavedFile[] | null>>;
type Decision = { id: string; name: string; status: string; reason: string; is_required: boolean };
type Analysis = { id: string; document_type_id: string; file_id: string; status: string; error_code: string | null; normalized_result: null | { detected_document_type: string | null; document_type_match: boolean; extracted_fields: Record<string, string | null>; requirements: Decision[] } };
type Checklist = { is_complete: boolean; requirements: Decision[] };

function requirementLabel(status: string) {
  switch (status) {
    case 'complete': return 'Complete';
    case 'incomplete': return 'Missing details';
    default: return 'Needs a check';
  }
}

function latestAnalysis(analyses: Analysis[] | null, fileId: string, serviceId: string) {
  return analyses?.find(item => item.file_id === fileId && item.document_type_id === serviceId);
}

const extractedFieldLabels = new Map([
  ['applicant_name', 'Full name'],
  ['full_name', 'Full name'],
  ['address', 'Address'],
]);

function extractedFieldLabel(key: string) {
  const knownLabel = extractedFieldLabels.get(key);
  if (knownLabel) return knownLabel;
  const label = key.replace(/_+/g, ' ').trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Extracted field';
}

function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div className="workspace-error" role="alert"><p>{errorMessage(error)}</p>{retry && <Button variant="secondary" onClick={retry}>Try again</Button>}</div>;
}

function ApplicationForm({ api, current, initialService = '', onSaved, close }: { api: Api; initialService?: string; current?: Application; onSaved: (app: Application) => void; close: () => void }) {
  const services = useResource<Service[]>(signal => api.services(signal), [api]);
  const [purpose, setPurpose] = useState(current?.purpose || '');
  const [selectedService, setService] = useState<string | null>(current?.document_type_id ?? null);
  // Resolve the public service name against current catalogue IDs, never a hard-coded UUID.
  const service = selectedService ?? services.data?.find(item => item.id === initialService || item.name === initialService)?.id ?? '';
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [error, setError] = useState<unknown>(null);
  const [touched, setTouched] = useState({ service: false, purpose: false });
  const serviceError = error instanceof ApiError && error.status === 422 ? errorMessage(error) : touched.service && !services.data?.some(item => item.id === service) ? 'Choose a service.' : '';
  const purposeError = touched.purpose && !purpose.trim() ? 'Enter a purpose for your application.' : '';
  return <Modal className="application-modal" labelledBy="application-form-title" onClose={() => { if (!locked.current) close(); }}>
    <header className="application-modal-heading">
      <div><h2 id="application-form-title"><img src="/figma/modals/ticket.svg" alt="" />{current ? 'Edit draft' : 'New application'}</h2>
        <p>Choose a barangay document and describe why you need it. Your application will be saved as a draft.</p></div>
      <button className="application-modal-close" type="button" aria-label="Close dialog" disabled={busy} onClick={close}><img src="/figma/modals/close.svg" alt="" /></button>
    </header>
    <form className="workspace-form" noValidate onSubmit={async event => {
      event.preventDefault();
      if (locked.current) return;
      setTouched({ service: true, purpose: true });
      const validService = services.data?.some(item => item.id === service);
      if (!validService || !purpose.trim()) {
        document.getElementById(!validService ? 'application-service' : 'application-purpose')?.focus();
        return;
      }
      locked.current = true; setBusy(true); setError(null);
      try {
        const body = { document_type_id: service, purpose: purpose.trim() };
        const route = window.location.hash;
        const saved = current ? await api.update(current.id, body) : await api.create(body);
        if (active.current && window.location.hash === route) onSaved(saved);
      } catch (reason) { setError(reason); }
      finally { locked.current = false; setBusy(false); }
    }}>
      {services.loading && <p role="status">Loading services...</p>}
      {Boolean(services.error) && <ErrorNotice error={services.error} retry={services.refresh} />}
      <div className="application-field"><label htmlFor="application-service">Service</label><div className="application-select"><select id="application-service" required aria-invalid={Boolean(serviceError)} aria-describedby={serviceError ? "application-service-error" : undefined} onBlur={() => setTouched(value => ({ ...value, service: true }))} value={service} onChange={e => { setService(e.target.value); if (error instanceof ApiError && error.status === 422) setError(null); }} disabled={busy || services.loading}>
        <option value="">Choose a service</option>{services.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select><img src="/figma/modals/chevron.svg" alt="" /></div>
      {serviceError && <p className="application-field-error" id="application-service-error" role="alert">{serviceError}</p>}</div>
      {services.data?.length === 0 && <p>No services are available. Try again later.</p>}
      <div className="application-field"><label htmlFor="application-purpose">Purpose</label><textarea id="application-purpose" required aria-invalid={Boolean(purposeError)} aria-describedby={`application-purpose-count${purposeError ? " application-purpose-error" : ""}`} onBlur={() => setTouched(value => ({ ...value, purpose: true }))} maxLength={200} value={purpose} onChange={e => { setPurpose(e.target.value); if (error instanceof ApiError && error.status === 422) setError(null); }} disabled={busy} />
      <small id="application-purpose-count">{purpose.length}/200 characters</small>
      {purposeError && <p className="application-field-error" id="application-purpose-error" role="alert">{purposeError}</p>}</div>
      {Boolean(error) && !(error instanceof ApiError && error.status === 422) && <ErrorNotice error={error} />}
      {!current && <aside className="application-modal-note"><img src="/figma/modals/info.svg" alt="" /><p>You’ll add documents after saving. Your TSEK number is created when you save.</p></aside>}
      <div className="workspace-actions"><Button type="button" variant="secondary" disabled={busy} onClick={close}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save application'}<img src="/figma/modals/arrow.svg" alt="" /></Button></div>
    </form>
  </Modal>;
}

function DocumentAnalysis({ result }: { result: NonNullable<Analysis['normalized_result']> }) {
  const [expanded, setExpanded] = useState(false);
  const resultsId = useId();
  return <>
    {!result.document_type_match && <p className="analysis-mismatch" role="alert">This document does not match the selected service. Check the document before continuing.</p>}
    <button type="button" className="analysis-toggle" aria-expanded={expanded} aria-controls={resultsId}
      onClick={() => setExpanded(value => !value)}>
      Show what TSEK read <Icon name="chevron" size={18} />
    </button>
    <div className="analysis-results" id={resultsId} hidden={!expanded}>
      <p><strong>Detected document:</strong> {result.detected_document_type || 'Not identified'}</p>
      <h4>Extracted fields</h4>
      <dl>{Object.entries(result.extracted_fields).map(([name, value]) => <div key={name}>
        <dt>{extractedFieldLabel(name)}</dt><dd>{value || 'Not readable / not provided'}</dd>
      </div>)}</dl>
      <ul>{result.requirements.map(item => <li key={item.id}><strong>{item.name}: {requirementLabel(item.status)}</strong><p>{item.reason}</p></li>)}</ul>
    </div>
  </>;
}

function DocumentPanel({ api, application, files, analyses, refreshChecklist, onProcessingChange }: {
  api: Api; application: Application; files: SavedFiles; analyses: ReturnType<typeof useResource<Analysis[] | null>>;
  refreshChecklist: () => void; onProcessingChange: (busy: boolean) => void;
}) {
  const { id } = application;
  const [replacing, setReplacing] = useState<SavedFile | null>(null);
  const [chosen, setChosen] = useState<File | null>(null);
  const [validation, setValidation] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const locked = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const validationId = useId();
  const editable = application.status === 'draft';
  useEffect(() => { if (validation && !busy) input.current?.focus(); }, [validation, busy]);
  const refresh = () => { files.refresh(); analyses.refresh(); refreshChecklist(); };
  async function perform(key: string, task: () => Promise<unknown>, success: string) {
    if (locked.current) return;
    locked.current = true; onProcessingChange(true); setBusy(key); setError(null); setNotice('');
    let refreshNeeded = true;
    try { refreshNeeded = await task() !== false; if (refreshNeeded) setNotice(success); }
    catch (reason) { setError(reason); }
    finally { locked.current = false; setBusy(''); onProcessingChange(false); if (refreshNeeded) refresh(); }
  }
  return <section className="workspace-card document-panel"><div className="workspace-title"><h2>Documents and analysis</h2><Button variant="secondary" disabled={!!busy} onClick={refresh}>Refresh documents</Button></div>
    <p>{editable ? 'Upload a plain-text (.txt) file up to 2 MiB, containing 1 to 10,000 characters. PDF and image analysis is not available yet.' : "Documents cannot be changed after submitting."}</p>
    {editable && <form className="workspace-form" onSubmit={event => {
      event.preventDefault(); const problem = validateUpload(chosen); setValidation(problem);
      if (problem || !chosen) { input.current?.focus(); return; }
      void perform('upload', async () => {
        const textProblem = await validateUploadText(chosen); setValidation(textProblem);
        if (textProblem) return false;
        const file = replacing ? await api.replace(id, replacing.id, chosen) : await api.upload(id, chosen);
        const shouldAnalyze = !!replacing; setReplacing(null); setChosen(null); if (input.current) input.current.value = '';
        if (shouldAnalyze) { refresh(); setBusy(file.id); await api.analyze(id, file.id); } }, replacing ? 'Document replaced and analysis finished. Review the updated checklist below.' : 'File uploaded and saved. Choose Analyze to request extraction.');
    }}>
      {replacing && <p>Replacing {replacing.original_name}. Its previous analysis will be removed when the new file is saved.</p>}
      <label>Choose a document<input ref={input} type="file" accept=".txt,text/plain" disabled={!!busy}
        aria-invalid={validation ? true : undefined} aria-describedby={validation ? validationId : undefined}
        onChange={e => { setChosen(e.target.files?.[0] || null); setValidation(''); }} /></label>
      {validation && <p id={validationId} className="workspace-field-error" role="alert">{validation}</p>}
      <Button type="submit" disabled={!!busy}>{busy === 'upload' ? 'Uploading...' : replacing ? 'Replace and reanalyze' : 'Upload document'}</Button>
      {replacing && <Button type="button" variant="secondary" disabled={!!busy} onClick={() => { setReplacing(null); setChosen(null); setValidation(''); if (input.current) input.current.value = ''; }}>Cancel replacement</Button>}
    </form>}
    {busy && <p role="status">{busy === 'upload' ? 'Uploading document. Please wait.' : 'Processing analysis. Please wait.'}</p>}
    {notice && <p className="motion-notice" key={notice} role="status">{notice}</p>}{Boolean(error) && <ErrorNotice error={error} />}
    {files.loading && <p role="status">Loading saved documents...</p>}{Boolean(files.error) && <ErrorNotice error={files.error} retry={files.refresh} />}
    {files.data?.length === 0 && <p>No documents uploaded yet.</p>}
    <ul className="saved-files">{files.data?.map(file => {
      const result = latestAnalysis(analyses.data, file.id, application.document_type_id);
      const normalized = result?.normalized_result;
      const needsReview = normalized && (!normalized.document_type_match || Object.values(normalized.extracted_fields).some(value => !value) || normalized.requirements.some(item => item.status !== 'complete'));
      const tooLong = typeof file.character_count === 'number' && file.character_count > 10_000;
      const canAnalyze = file.media_type === 'text/plain' && !tooLong;
      return <li key={file.id}><div className="workspace-title"><div><h3>{file.original_name}</h3><small>{Math.ceil(file.size / 1024)} KB</small></div>
        <Badge tone={tooLong || result?.status === 'failed' || needsReview ? 'warning' : 'neutral'}>{tooLong ? 'Too long to analyse' : busy === file.id ? 'Analyzing' : analyses.loading ? 'Loading analysis' : analyses.error ? 'Analysis unavailable' : result?.status === 'completed' ? needsReview ? 'Needs review' : 'Completed' : result?.status === 'failed' ? 'Analysis failed' : result?.status === 'pending' ? 'Analysis in progress' : 'Not analyzed'}</Badge></div>
        {editable && <Button variant="secondary" disabled={!!busy || !canAnalyze || result?.status === 'pending' || analyses.loading || !!analyses.error} onClick={() => void perform(file.id, () => api.analyze(id, file.id), 'Analysis finished. Results below come from the backend.')}>
          {result?.status === 'failed' ? 'Retry analysis' : result?.status === 'completed' ? 'Reanalyze document' : 'Analyze document'}</Button>}
        {editable && <Button variant="secondary" disabled={!!busy} onClick={() => { setReplacing(file); setChosen(null); setValidation(''); if (input.current) { input.current.value = ''; input.current.focus(); } }}>Replace {file.original_name}</Button>}
        {tooLong ? <p role="alert">Too long to analyse — replace this file. It contains {file.character_count?.toLocaleString('en-US')} characters; the limit is 10,000.</p>
          : !canAnalyze && <p>Saved successfully. Analysis requires a plain-text file containing 1 to 10,000 characters.</p>}
        {result?.status === 'failed' && <p role="alert">{errorMessage(new ApiError(0, result.error_code || 'ANALYSIS_FAILED', ''))}</p>}
        {!busy && !analyses.loading && result?.status === 'completed' && normalized && <>
          {needsReview && normalized.requirements.some(item => item.status === 'complete') && <p>This file can complete some requirements even when other details need review. The checklist combines results from all uploaded files.</p>}
          <DocumentAnalysis key={result.id} result={normalized} />
        </>}
      </li>;
    })}</ul>
    {analyses.loading && <p role="status">Loading analysis results...</p>}{Boolean(analyses.error) && <ErrorNotice error={analyses.error} retry={analyses.refresh} />}

  </section>;
}

function RequirementChecklist({ checklist, processing, missingUpload }: {
  checklist: ReturnType<typeof useResource<Checklist | null>>; processing: boolean; missingUpload: boolean;
}) {
  const data = !processing && !checklist.loading && !checklist.error ? checklist.data : null;
  const rows = useRef<HTMLUListElement>(null);
  const previousStatuses = useRef(new Map<string, string>());
  useEffect(() => {
    if (!data) return;
    for (const row of rows.current?.querySelectorAll<HTMLElement>('[data-requirement-id]') || []) {
      const id = row.dataset.requirementId!;
      const status = row.dataset.requirementStatus!;
      const previous = previousStatuses.current.get(id);
      if (previous && previous !== 'complete' && status === 'complete') row.classList.add('motion-ready');
      previousStatuses.current.set(id, status);
    }
  }, [data]);
  const required = data?.requirements.filter(item => item.is_required) || [];
  const complete = required.filter(item => item.status === 'complete').length;
  return <section className="workspace-card requirement-checklist" aria-labelledby="checklist-title">
    <div className="checklist-heading"><h2 id="checklist-title">Requirement checklist</h2>
      {required.length > 0 && <span>{Math.round(complete / required.length * 100)}%</span>}</div>
    {checklist.loading && <p role="status">Loading checklist...</p>}
    {Boolean(checklist.error) && <ErrorNotice error={checklist.error} retry={checklist.refresh} />}
    {data && (data.requirements.length === 0 ? <p>No requirements available.</p> : <>
      <p>{missingUpload ? 'Upload a document to start checking your requirements.' : data.is_complete ? 'All required items are complete according to saved analysis.' : 'Some required items need attention.'}</p>
      {required.length > 0 && <div className="requirement-progress" role="img" aria-label={`${complete} of ${required.length} required items complete`}>
        {required.map(item => <span key={item.id} className={item.status === 'complete' ? 'is-complete' : ''} />)}
      </div>}
      <ul className="requirement-rows" ref={rows}>{data.requirements.map(item => {
        const tone = missingUpload ? 'neutral' : item.status === 'complete' ? 'success' : item.is_required ? 'warning' : 'neutral';
        return <li key={item.id} data-requirement-id={item.id} data-requirement-status={item.status} onAnimationEnd={event => { if (event.target === event.currentTarget) event.currentTarget.classList.remove('motion-ready'); }} className={`requirement-row requirement-${tone}${item.is_required ? '' : ' requirement-optional'}`}>
          <span className="requirement-icon"><img src={`/figma/ticket/${tone === 'success' ? 'check' : tone === 'warning' ? 'warning' : 'file'}.svg`} alt="" /></span>
          <div className="requirement-copy"><strong>{item.name}</strong> <small>{item.is_required ? 'Required' : 'Optional'}</small>{!missingUpload && <p>{item.reason}</p>}</div>
          <Badge tone={tone}>{missingUpload ? 'Not uploaded yet' : requirementLabel(item.status)}</Badge>
        </li>;
      })}</ul>
      <small>AI results assist preparation and do not grant official approval.</small>
    </>)}
  </section>;
}

function SubmissionPanel({ api, application, missingUpload, checklist, processing, onSubmitted }: {
  api: Api; application: Application; missingUpload: boolean; checklist: ReturnType<typeof useResource<Checklist | null>>;
  processing: boolean; onSubmitted: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const confirmation = useRef<HTMLInputElement>(null);
  const validationId = useId();
  const warningTitleId = useId();
  const readinessId = useId();
  const [validation, setValidation] = useState<'confirmation' | 'upload' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [showWarning, setShowWarning] = useState(false);
  const confirmationError = validation === 'confirmation';
  const checkReady = !processing && !checklist.loading && !checklist.error && checklist.data !== null;
  const checkUnavailable = !checkReady && !processing && !checklist.loading;
  const unfinished = checkReady ? checklist.data?.requirements.filter(item => item.is_required && item.status !== 'complete') ?? [] : [];
  async function submit(confirmIncomplete: boolean) {
    if (locked.current || !checkReady) return;
    locked.current = true; setBusy(true); setError(null);
    try { await api.submit(application.id, confirmIncomplete); onSubmitted(); }
    catch (reason) {
      setError(reason);
      if (reason instanceof ApiError && reason.code === 'CHECKLIST_CONFIRMATION_REQUIRED') checklist.refresh();
    } finally { locked.current = false; setBusy(false); setShowWarning(false); }
  }
  return <section className="workspace-card"><h2>Submit for barangay review</h2>
    <p>Submitting shares this application and its documents with barangay staff. You cannot edit or delete it afterward. Upload at least one document before submitting.</p>
    <label><input ref={confirmation} type="checkbox" checked={confirmed} disabled={busy}
      aria-invalid={confirmationError ? true : undefined} aria-describedby={confirmationError ? validationId : undefined}
      onChange={event => {
        setConfirmed(event.target.checked);
        if (confirmationError) setValidation(null);
      }} /> I am ready to share these documents for staff review.</label>
    {confirmationError && <p id={validationId} className="workspace-field-error" role="alert">Confirm that you are ready to share your documents before submitting.</p>}
    {validation === 'upload' && missingUpload && <p className="workspace-field-error" role="alert">Upload at least one document before submitting for review.</p>}
    {Boolean(error) && <ErrorNotice error={error} />}
    {!checkReady && <p id={readinessId} role="status">{checkUnavailable
      ? 'Reload the checklist before submitting.'
      : 'Wait for the requirement checks to finish before submitting.'}</p>}
    {checkUnavailable && <Button variant="secondary" onClick={checklist.refresh}>Reload checklist</Button>}
    <Button disabled={busy || !checkReady} aria-describedby={checkReady ? undefined : readinessId} onClick={() => {
      if (locked.current) return;
      setError(null);
      if (!confirmed) {
        setValidation('confirmation');
        confirmation.current?.focus();
        return;
      }
      if (missingUpload) {
        setValidation('upload');
        return;
      }
      setValidation(null);
      if (unfinished.length) setShowWarning(true);
      else void submit(false);
    }}>{busy ? 'Submitting...' : 'Submit for review'}</Button>
    {showWarning && <Modal className="application-modal" labelledBy={warningTitleId} onClose={() => { if (!locked.current) setShowWarning(false); }}>
      <h2 id={warningTitleId}>Submit anyway?</h2>
      <p>These required items still need attention:</p>
      <ul>{unfinished.map(item => <li key={item.id}>{item.name}</li>)}</ul>
      <div className="workspace-actions">
        <Button variant="secondary" disabled={busy} onClick={() => setShowWarning(false)}>Keep editing</Button>
        <Button disabled={busy || !checkReady || unfinished.length === 0} onClick={() => void submit(true)}>{busy ? 'Submitting...' : 'Submit anyway'}</Button>
      </div>
    </Modal>}
  </section>;
}

function ReviewHistory({ api, id, status, onNewApplication }: { api: Api; id: string; status: string; onNewApplication: () => void }) {
  const resource = useResource<{ id: string; decision: string; note: string; created_at: string }[]>(signal => api.reviews(id, signal), [api, id]);
  const latestReview = resource.data?.[resource.data.length - 1];
  const state = status === 'submitted' ? 'awaiting' : status === 'approved' ? 'approved' : 'rejected';
  const heading = state === 'awaiting' ? 'Waiting for barangay staff' : state === 'approved' ? 'Approved' : 'Not approved';
  return <section className={`workspace-card review-state review-state--${state}`} aria-labelledby="staff-decision-title">
    <div className="review-state-heading"><span className="review-state-icon"><Icon name={state === 'awaiting' ? 'clock' : state === 'approved' ? 'check' : 'warning'} size={22} /></span><div><span className="section-kicker">Barangay review</span><h2 id="staff-decision-title">{heading}</h2></div></div>
    {resource.loading && <p role="status">Loading staff decision...</p>}
    {Boolean(resource.error) && <ErrorNotice error={resource.error} retry={resource.refresh} />}
    {!resource.loading && !resource.error && state === 'awaiting' && resource.data?.length === 0 && <p className="review-state-copy">Your application is awaiting staff review.</p>}
    {!resource.loading && !resource.error && state !== 'awaiting' && latestReview && <div className="staff-decision-note"><p>{latestReview.note}</p><small>Staff note · <time dateTime={latestReview.created_at}>{formatDateTime(latestReview.created_at)}</time></small></div>}
    {!resource.loading && !resource.error && state !== 'awaiting' && !latestReview && <p className="review-state-copy" role="status">Staff decision details are temporarily unavailable. Refresh staff decision.</p>}
    <div className="review-state-actions">{state === 'rejected' && <Button onClick={onNewApplication}>New application</Button>}<Button variant="secondary" onClick={resource.refresh} disabled={resource.loading}>Refresh staff decision</Button></div>
    <p className="review-state-footnote">The decision is made by barangay staff. TSEK&apos;s checks only help you prepare.</p>
  </section>;
}

function ApplicationDetails({ api, id, name, back, onDeleted, onNewApplication }: { api: Api; id: string; name: string; back: () => void; onDeleted: () => void; onNewApplication: () => void }) {
  const resource = useResource<Application>(signal => api.get(id, signal), [api, id]);
  const app = resource.data;
  const files = useResource<SavedFile[] | null>(signal => app ? api.files(id, signal) : Promise.resolve(null), [api, JSON.stringify([id, app?.document_type_id, app?.status])]);
  const analyses = useResource<Analysis[] | null>(signal => app ? api.analyses(id, signal) : Promise.resolve(null), [api, JSON.stringify([id, app?.document_type_id, app?.status])]);
  const checklist = useResource<Checklist | null>(signal => resource.data ? api.checklist(id, signal) : Promise.resolve(null), [api, JSON.stringify([id, resource.data?.document_type_id, resource.data?.status])]);
  const [processing, setProcessing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const missingUpload = !processing && !files.loading && !files.error && files.data?.length === 0;
  const fileCount = files.loading || files.error ? null : files.data?.length ?? null;
  const currentAnalyses = app && fileCount !== null && !analyses.loading && !analyses.error
    ? files.data?.map(file => latestAnalysis(analyses.data, file.id, app.document_type_id)) ?? []
    : [];
  return <><Button className="ticket-back" variant="ghost" disabled={busy} onClick={back}>Back to applications</Button>
    {resource.loading && <p role="status">Loading application...</p>}
    {Boolean(resource.error) && <ErrorNotice error={resource.error} retry={resource.refresh} />}
    {notice && <p className="motion-notice" key={notice} role="status">{notice}</p>}
    {app && <><section className="ticket-header" aria-label="Application details">
      <div className="ticket-body"><h1>{app.document_type_name}</h1><p className="ticket-reference">Reference: {toReference(app.id)}</p>
        <p>{app.purpose}</p><small>Updated {formatDateTime(app.updated_at)}</small>
        {app.status !== 'draft' && <p>This application is read-only. Only drafts can be edited or deleted.</p>}
      </div>
      <div className="ticket-stub"><Badge className={app.status === 'approved' ? 'approval-stamp' : ''} tone={app.status === 'approved' ? 'success' : app.status === 'rejected' ? 'error' : app.status === 'submitted' ? 'info' : 'neutral'}>{app.status === 'submitted' ? 'Awaiting review' : app.status === 'rejected' ? 'Not approved' : app.status === 'approved' ? 'Approved' : 'Draft'}</Badge>
        <div className="workspace-actions">{app.status === 'draft' && <><Button size="sm" variant="secondary" iconLeft="file" disabled={resource.loading} onClick={() => setEditing(true)}>Edit draft</Button><Button size="sm" variant="ghost" iconLeft="trash" onClick={() => setDeleting(true)}>Delete draft</Button></>}</div>
        <Button size="sm" variant="ghost" onClick={() => { resource.refresh(); checklist.refresh(); }}>Refresh application</Button>
      </div>
      <img className="ticket-notch ticket-notch-top" src="/figma/ticket/notch.svg" alt="" /><img className="ticket-notch ticket-notch-bottom" src="/figma/ticket/notch.svg" alt="" />
    </section>
      {!processing && !resource.loading && !resource.error && !checklist.loading && !checklist.error && checklist.data?.is_complete && app.status !== 'rejected' && <PrintSummary reference={toReference(app.id)} service={app.document_type_name} name={name} requirements={checklist.data.requirements} />}
      <ApplicationTracker status={app.status} fileCount={fileCount} checkedCount={currentAnalyses.filter(result => result?.status === 'completed').length}
        checking={processing || currentAnalyses.some(result => result?.status === 'pending')}
        loading={files.loading || analyses.loading}
        failed={currentAnalyses.some(result => result?.status === 'failed')}
        unavailable={Boolean(files.error || analyses.error)}
        ready={!processing && !!fileCount && !checklist.loading && !checklist.error && checklist.data?.is_complete === true} />
      <div className="ticket-columns"><div className="ticket-stack">
        <RequirementChecklist checklist={checklist} processing={processing} missingUpload={missingUpload} />
        <DocumentPanel key={app.id + app.document_type_id + app.status} api={api} application={app} files={files} analyses={analyses} refreshChecklist={checklist.refresh} onProcessingChange={setProcessing} />
      </div><div className="ticket-sidebar">
      {app.status === 'draft'
        ? <SubmissionPanel api={api} application={app} missingUpload={missingUpload} checklist={checklist} processing={processing} onSubmitted={() => { setNotice('Application submitted for staff review.'); resource.refresh(); }} />
        : <ReviewHistory key={app.status} api={api} id={app.id} status={app.status} onNewApplication={onNewApplication} />}
      </div></div>
      {editing && <ApplicationForm api={api} current={app} close={() => setEditing(false)} onSaved={() => { setEditing(false); setNotice('Application saved.'); resource.refresh(); }} />}
      {deleting && <Modal className="application-modal delete-draft-modal" labelledBy="delete-application-title" onClose={() => { if (!locked.current) setDeleting(false); }}>
        <span className="delete-draft-icon"><img src="/figma/modals/trash.svg" alt="" /></span>
        <h2 id="delete-application-title">Delete this draft?</h2><p>This permanently removes the saved application and its documents. This cannot be undone.</p>
        {Boolean(error) && <ErrorNotice error={error} />}
        <div className="workspace-actions"><Button variant="secondary" disabled={busy} onClick={() => { setDeleting(false); setError(null); }}>Keep application</Button><Button variant="danger" disabled={busy} onClick={async () => {
          if (locked.current) return; locked.current = true; setBusy(true); setError(null);
          try { await api.remove(id); onDeleted(); } catch (reason) { setError(reason); } finally { locked.current = false; setBusy(false); }
        }}><img src="/figma/modals/trash-white.svg" alt="" />{busy ? 'Deleting...' : 'Confirm deletion'}</Button></div>
      </Modal>}
    </>}
  </>;
}

/** Authenticated list and bookmarkable details share the creation session. */
export default function ApplicationWorkspace({ api, name, onSignOut }: { api: Api; name: string; onSignOut: () => void }) {
  const identity = useResource<{ role: string }>(async signal => api.me(signal), [api]);
  const canViewAdmin = !identity.loading && !identity.error && ['staff', 'admin'].includes(identity.data?.role || '');
  const readRoute = () => {
    const [path, query = ''] = window.location.hash.split('?');
    const creating = path === '#/applications/new';
    return { id: creating ? '' : /^#\/applications\/([^/]+)$/.exec(path)?.[1] || '', creating,
      service: creating ? new URLSearchParams(query).get('service') || '' : '' };
  };
  const [route, setRoute] = useState(readRoute);
  const { id, creating, service: initialService } = route;
  const setId = (id: string) => setRoute(current => ({ ...current, id }));
  const setCreating = (creating: boolean) => setRoute(current => ({ ...current, creating, service: '' }));
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => { const changed = () => { const next = readRoute(); setRoute(next); setNotice(current => current?.id === next.id ? current : null); }; window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, []);
  const open = (value: string) => { window.location.hash = '/applications/' + encodeURIComponent(value); setId(value); };
  const back = () => { window.location.hash = '/applications'; setId(''); };
  const closeCreate = () => { setCreating(false); if (window.location.hash.split('?')[0] === '#/applications/new') back(); };
  return <div className="workspace-shell"><AppHeader name={name} links={[{ href: '#/applications', label: 'My applications' }, ...(canViewAdmin ? [{ href: '#/admin', label: 'Admin records' }] : [])]} onSignOut={onSignOut} />
    <main className={`workspace-main${id ? ' ticket-main' : ''}`}>{notice?.id === id && <div className="motion-notice" key={notice.text} role="status">{notice.text}</div>}
      {id ? <ApplicationDetails key={id} api={api} id={id} name={name} back={() => { setNotice(null); back(); }} onDeleted={() => { setNotice({ id: '', text: 'Application deleted successfully.' }); back(); }} onNewApplication={() => setCreating(true)} /> : <CitizenOverview api={api} create={() => setCreating(true)} />}
      {creating && <ApplicationForm key={initialService} api={api} initialService={initialService} close={closeCreate} onSaved={app => { setCreating(false); setNotice({ id: app.id, text: 'Application created successfully.' }); open(app.id); }} />}
    </main></div>;
}
