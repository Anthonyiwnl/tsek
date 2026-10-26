import { useEffect, useState } from "react";
import { applicationsApi } from "./application-api";
import type {
  ApplicationRecord,
  DocumentType,
} from "./applications-api.js";
import { Badge, Button, Icon } from "./DesignUI";

type Props = {
  initialCreate?: boolean;
  onCancelCreate?: () => void;
};

function errorMessage(error: unknown) {
  if (error instanceof Error && error.name === "ApplicationsApiError") {
    return error.message;
  }
  if (error instanceof Error && error.message === "Your session has no usable JWT. Sign out and sign in again.") {
    return error.message;
  }
  return "Could not reach the application service. Check your connection and try again.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ApplicationsManager({
  initialCreate = false,
  onCancelCreate,
}: Props) {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState("");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(initialCreate);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [purpose, setPurpose] = useState("");
  const [detail, setDetail] = useState<ApplicationRecord | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void applicationsApi
      .list()
      .then((records) => {
        if (active) setApplications(records);
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void applicationsApi.catalogue()
      .then((types) => {
        if (active) {
          setDocumentTypes(types);
          setSelectedType((current) => current || types[0]?.id || "");
        }
      })
      .catch((requestError: unknown) => {
        if (active) setCatalogueError(errorMessage(requestError));
      });
    return () => {
      active = false;
    };
  }, []);

  function openCreate() {
    setEditingId(null);
    setPurpose("");
    setSelectedType(documentTypes[0]?.id || "");
    setError("");
    setFormOpen(true);
    setDetail(null);
  }

  function openEdit(application: ApplicationRecord) {
    setEditingId(application.id);
    setSelectedType(application.document_type_id);
    setPurpose(application.purpose);
    setError("");
    setFormOpen(true);
    setDetail(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const changes: { document_type_id?: string; purpose: string } = {
        purpose: purpose.trim(),
      };
      if (editingId) {
        const original = applications.find(
          (application) => application.id === editingId,
        );
        if (original?.document_type_id !== selectedType) {
          changes.document_type_id = selectedType;
        }
        const updated = await applicationsApi.update(editingId, changes);
        setApplications((current) =>
          current.map((application) =>
            application.id === updated.id ? updated : application,
          ),
        );
      } else {
        const created = await applicationsApi.create({
          document_type_id: selectedType,
          purpose: changes.purpose,
        });
        setApplications((current) => [created, ...current]);
      }
      setFormOpen(false);
      setEditingId(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function view(applicationId: string) {
    setError("");
    setBusy(true);
    try {
      setDetail(await applicationsApi.get(applicationId));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function remove(application: ApplicationRecord) {
    if (!window.confirm(`Delete the draft for ${application.document_type_name}?`)) {
      return;
    }
    setError("");
    setBusy(true);
    try {
      await applicationsApi.remove(application.id);
      setApplications((current) =>
        current.filter((item) => item.id !== application.id),
      );
      if (detail?.id === application.id) setDetail(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page application-manager">
      <div className="page-title">
        <div>
          <span className="section-kicker">Your account</span>
          <h1>{initialCreate ? "New application" : "My applications"}</h1>
          <p>Application records are saved to your account.</p>
        </div>
        {!initialCreate && (
          <Button onClick={openCreate}>
            <Icon name="plus" size={18} /> New application
          </Button>
        )}
      </div>

      {(error || catalogueError) && (
        <p className="api-feedback error" role="alert">
          {error || catalogueError}
        </p>
      )}

      {formOpen && (
        <form className="application-record-form" onSubmit={submit}>
          <div>
            <span className="section-kicker">
              {editingId ? "Edit draft" : "Create an application"}
            </span>
            <h2>{editingId ? "Update application details" : "Application details"}</h2>
          </div>
          <label>
            Service
            <select
              required
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
              disabled={busy || documentTypes.length === 0}
            >
              <option value="" disabled>
                Select a service
              </option>
              {documentTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Purpose (optional)
            <input
              maxLength={200}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="e.g. Employment requirements"
              disabled={busy}
            />
          </label>
          <div className="application-form-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
                onCancelCreate?.();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !selectedType || Boolean(catalogueError)}
            >
              {busy ? "Saving…" : editingId ? "Save changes" : "Create draft"}
            </Button>
          </div>
          <p className="application-storage-note">
            This saves the application record. Document uploads and AI checks
            are not connected yet.
          </p>
        </form>
      )}

      {detail && (
        <section className="application-detail" aria-live="polite">
          <div>
            <span className="section-kicker">Application details</span>
            <h2>{detail.document_type_name}</h2>
          </div>
          <Badge tone={detail.status === "draft" ? "neutral" : "success"}>
            {detail.status}
          </Badge>
          <p>Purpose: {detail.purpose || "Not specified"}</p>
          <small>Updated {formatDate(detail.updated_at)}</small>
          <Button
            variant="ghost"
            onClick={() => setDetail(null)}
            aria-label="Close application details"
          >
            Close
          </Button>
        </section>
      )}

      {!initialCreate && (
        <section className="applications-table" aria-busy={loading || busy}>
          <div className="table-head">
            <span>Application</span>
            <span>Status</span>
            <span>Purpose</span>
            <span>Last updated</span>
            <span>Actions</span>
          </div>
          {loading ? (
            <p className="api-feedback" role="status">
              Loading your applications…
            </p>
          ) : applications.length === 0 ? (
            <p className="api-feedback">
              No applications yet. Create a draft to get started.
            </p>
          ) : (
            applications.map((application) => (
              <div className="table-row" key={application.id}>
                <div className="app-name">
                  <span className="app-icon">
                    <Icon name="file" />
                  </span>
                  <div>
                    <b>{application.document_type_name}</b>
                    <small>{application.id}</small>
                  </div>
                </div>
                <Badge tone={application.status === "draft" ? "neutral" : "success"}>
                  {application.status}
                </Badge>
                <span className="application-purpose">
                  {application.purpose || "Not specified"}
                </span>
                <span>{formatDate(application.updated_at)}</span>
                <div className="row-actions">
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void view(application.id)}
                  >
                    View
                  </Button>
                  {application.status === "draft" && (
                    <>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => openEdit(application)}
                      >
                        Edit
                      </Button>
                      <button
                        className="delete-button"
                        aria-label={`Delete ${application.document_type_name} draft`}
                        disabled={busy}
                        onClick={() => void remove(application)}
                      >
                        <Icon name="trash" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
