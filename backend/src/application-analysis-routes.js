import express from 'express';
import { validateDocumentAnalysis } from './analysis.js';
import { applicationChecklist, normalizeApplicationAnalysis } from './application-analyses.js';
import { withSpan } from './tracing.js';
import { inspectDocumentMedia, documentMediaTypes } from './document-media.js';
import { documentText, documentLengthMessage, maxDocumentCharacters } from './document-text.js';

const failureResponses = {
  timeout: [504, 'ANALYSIS_TIMEOUT', 'Document analysis timed out.'],
  provider_failure: [502, 'ANALYSIS_PROVIDER_FAILURE', 'The analysis provider could not process the document.'],
  malformed_output: [502, 'INVALID_ANALYSIS', 'The analysis result did not match the expected contract.'],
};

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

export function registerApplicationAnalysisRoutes(app, {
  authenticate, applicationFiles, applicationAnalyses, catalogue, extractDocument, admitAiRequest, providerOutcome, uuid,
  mediaEnabled = false,
}) {
  const scope = async (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (!uuid.test(req.params.id)) return sendError(res, 400, 'INVALID_ID', 'Application ID must be a UUID.');
    if (!applicationFiles || !applicationAnalyses) {
      return sendError(res, 503, 'ANALYSES_UNAVAILABLE', 'Application analysis storage is not configured.');
    }
    const application = await applicationFiles.getApplication(req.userId, req.params.id);
    if (!application) return sendError(res, 404, 'NOT_FOUND', 'Application not found.');
    res.locals.application = application;
    next();
  };

  app.get('/api/applications/:id/analyses', authenticate, scope, async (req, res) => {
    res.json({ data: await applicationAnalyses.list(req.userId, res.locals.application.id) });
  });

  app.get('/api/applications/:id/checklist', authenticate, scope, async (req, res) => {
    const application = res.locals.application;
    const type = await catalogue.requirements(application.document_type_id);
    if (!type) return sendError(res, 422, 'REQUIREMENTS_UNAVAILABLE', 'Application requirements are unavailable.');
    const rows = await applicationAnalyses.latest(req.userId, application.id, application.document_type_id);
    res.json({ data: {
      application_id: application.id,
      document_type_id: type.id,
      document_type_name: type.name,
      ...applicationChecklist(type.requirements, rows),
    } });
  });

  app.post('/api/applications/:id/analyses', authenticate, scope, express.json({ limit: '4kb' }), async (req, res) => {
    const application = res.locals.application;
    if (application.status !== 'draft') {
      return sendError(res, 409, 'APPLICATION_NOT_EDITABLE', 'Files can only be analyzed for draft applications.');
    }
    if (typeof req.body?.file_id !== 'string' || !uuid.test(req.body.file_id) || Object.keys(req.body).length !== 1) {
      return sendError(res, 400, 'INVALID_BODY', 'Provide a file_id UUID.');
    }
    const file = await applicationFiles.getFile(req.userId, application.id, req.body.file_id);
    if (!file) return sendError(res, 404, 'NOT_FOUND', 'File not found.');
    const media = documentMediaTypes.has(file.media_type) && mediaEnabled;
    if (file.media_type !== 'text/plain' && !media) {
      return sendError(res, 415, 'TEXT_EXTRACTION_UNAVAILABLE', 'Analysis currently supports plain text files only.');
    }
    let decoded = { text: null, characterCount: 0 };
    try { if (!media) decoded = documentText(Buffer.from(file.content)); }
    catch { return sendError(res, 422, 'INVALID_DOCUMENT_TEXT', 'Upload readable UTF-8 document text.'); }
    const { text, characterCount } = decoded;
    if (!media && (!text || characterCount > maxDocumentCharacters)) {
      return res.status(422).json({ error: {
        code: 'INVALID_DOCUMENT_LENGTH', message: documentLengthMessage(characterCount), characterCount,
      } });
    }
    if (media) {
      const inspected = await inspectDocumentMedia(Buffer.from(file.content), file.media_type);
      if (!inspected.valid) return sendError(res, inspected.busy ? 503 : 422, inspected.busy ? 'MEDIA_VALIDATION_BUSY' : 'INVALID_DOCUMENT_MEDIA', 'The document is invalid or exceeds the image/page limits.');
    }
    if (!extractDocument) return sendError(res, 503, 'ANALYSES_UNAVAILABLE', 'Document extraction is unavailable.');
    const type = await catalogue.requirements(application.document_type_id);
    if (!type) return sendError(res, 422, 'REQUIREMENTS_UNAVAILABLE', 'Application requirements are unavailable.');
    const ticket = await admitAiRequest(req, res);
    if (!ticket) return;

    let extraction;
    try {
      extraction = await withSpan('ai.extract', {}, () => extractDocument({
        ...(media ? { content: Buffer.from(file.content), mediaType: file.media_type } : { text }),
        applicationId: application.id, uploadedFileId: file.id, requestId: req.requestId,
      }));
    } finally {
      // Tell the circuit breaker whether the provider answered; a malformed reply still means it is up.
      ticket.finish(extraction ? providerOutcome(extraction.outcome === 'success' ? null : extraction.code) : 'neutral');
    }
    const result = extraction?.analysis;
    const valid = await withSpan('ai.validate', {}, async () => extraction?.outcome === 'success'
      && validateDocumentAnalysis(result).valid
      && result.source.applicationId === application.id && result.source.uploadedFileId === file.id);
    const failure = Object.hasOwn(failureResponses, extraction?.outcome)
      ? failureResponses[extraction.outcome] : failureResponses.malformed_output;
    const stored = await applicationAnalyses.create(req.userId, application.id, file.id, type.id, {
      status: valid ? 'completed' : 'failed',
      result: valid ? result : null,
      normalizedResult: valid ? { ...normalizeApplicationAnalysis(result, type.requirements), ...(media ? { requires_staff_review: true } : {}) } : null,
      errorCode: valid ? null : failure[1],
      metadata: extraction?.metadata ?? null,
    });
    if (!stored) return sendError(res, 409, 'APPLICATION_CHANGED', 'The application or file changed during analysis.');
    if (!valid) return sendError(res, ...failure);
    res.status(201).json({ data: stored });
  });
}
