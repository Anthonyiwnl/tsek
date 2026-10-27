import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { requireUser } from './auth.js';
import { ProviderError } from './provider.js';
import { computeChecklist, normalizeAnalysisResult } from './analysis.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const applicationFields = new Set(['document_type_id', 'purpose']);
const fileMediaTypes = new Set(['text/plain', 'application/pdf', 'image/jpeg', 'image/png']);
const maxFileBytes = 2 * 1024 * 1024;
const maxAnalysisBytes = 20000;
const maxAnalysesPerHour = 3;

function invalidBody(res) {
  return res.status(400).json({
    error: { code: 'INVALID_BODY', message: 'Request body must contain valid application fields.' },
  });
}

export function createApp({
  catalogue,
  applications,
  privateData,
  analysisProvider,
  verifyToken,
  origin = 'http://localhost:5173',
  logger = console,
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin, methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PATCH', 'DELETE'] }));
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (req, res) => {
    try {
      await catalogue.ready();
      res.json({ status: 'ready' });
    } catch (error) {
      logger.error({
        requestId: req.requestId,
        event: 'readiness_check_failed',
        type: error.name,
        ...(typeof error.code === 'string' ? { code: error.code } : {}),
      });
      res.status(503).json({ status: 'unavailable' });
    }
  });
  app.get('/api/document-types', async (_req, res) => {
    res.json({ data: await catalogue.list() });
  });
  app.get('/api/document-types/:id/requirements', async (req, res) => {
    if (!uuid.test(req.params.id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Document type ID must be a UUID.' } });
    }
    const data = await catalogue.requirements(req.params.id);
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document type not found.' } });
    res.json({ data });
  });
  const authenticate = verifyToken ? requireUser(verifyToken, logger) : (_req, res) => res.status(503).json({
    error: { code: 'AUTH_UNAVAILABLE', message: 'Application authentication is not configured.' },
  });
  const applicationsAvailable = applications
    ? (_req, _res, next) => next()
    : (_req, res) => res.status(503).json({
      error: { code: 'APPLICATIONS_UNAVAILABLE', message: 'Application storage is not configured.' },
    });
  const privateDataAvailable = privateData
    ? (_req, _res, next) => next()
    : (_req, res) => res.status(503).json({
      error: { code: 'PRIVATE_STORAGE_UNAVAILABLE', message: 'Private document storage is not configured.' },
    });
  app.use('/api/applications', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  });
  app.get('/api/applications', authenticate, applicationsAvailable, async (req, res) => {
    res.json({ data: await applications.list(req.userId) });
  });
  app.post('/api/applications', authenticate, applicationsAvailable, async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some(key => !['document_type_id', 'purpose'].includes(key))
      || typeof body.document_type_id !== 'string'
      || !uuid.test(body.document_type_id)
      || (body.purpose !== undefined
        && (typeof body.purpose !== 'string' || body.purpose.length > 200))) {
      return invalidBody(res);
    }
    const application = await applications.create(
      req.userId,
      body.document_type_id,
      body.purpose?.trim() ?? '',
    );
    if (!application) {
      return res.status(422).json({
        error: { code: 'INVALID_DOCUMENT_TYPE', message: 'Document type is missing or inactive.' },
      });
    }
    res.status(201).location(`/api/applications/${application.id}`).json({ data: application });
  });
  app.get('/api/applications/:id', authenticate, applicationsAvailable, async (req, res) => {
    if (!uuid.test(req.params.id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' } });
    }
    const application = await applications.get(req.userId, req.params.id);
    if (!application) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
    }
    res.json({ data: application });
  });
  app.patch('/api/applications/:id', authenticate, applicationsAvailable, async (req, res) => {
    if (!uuid.test(req.params.id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' } });
    }
    const body = req.body;
    const keys = body && typeof body === 'object' && !Array.isArray(body)
      ? Object.keys(body)
      : [];
    if (!keys.length || keys.some(key => !applicationFields.has(key))
      || (Object.hasOwn(body || {}, 'document_type_id')
        && (typeof body.document_type_id !== 'string' || !uuid.test(body.document_type_id)))
      || (Object.hasOwn(body || {}, 'purpose')
        && (typeof body.purpose !== 'string' || body.purpose.length > 200))) {
      return invalidBody(res);
    }
    const changes = { ...body };
    if (Object.hasOwn(changes, 'purpose')) changes.purpose = changes.purpose.trim();
    const result = await applications.update(req.userId, req.params.id, changes);
    if (!result.updated) {
      if (!result.current) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
      }
      if (result.current.status !== 'draft') {
        return res.status(409).json({ error: { code: 'APPLICATION_NOT_EDITABLE', message: 'Only draft applications can be updated.' } });
      }
      return res.status(422).json({
        error: { code: 'INVALID_DOCUMENT_TYPE', message: 'Document type is missing or inactive.' },
      });
    }
    res.json({ data: result.application });
  });
  app.delete('/api/applications/:id', authenticate, applicationsAvailable, async (req, res) => {
    if (!uuid.test(req.params.id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' } });
    }
    const result = await applications.deleteDraft(req.userId, req.params.id);
    if (!result) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
    }
    if (!result.deleted) {
      return res.status(409).json({ error: { code: 'APPLICATION_NOT_DELETABLE', message: 'Only draft applications can be deleted.' } });
    }
    res.status(204).end();
  });
  app.get('/api/applications/:id/files', authenticate, privateDataAvailable, async (req, res) => {
    if (!uuid.test(req.params.id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' } });
    }
    const application = await privateData.getApplication(req.userId, req.params.id);
    if (!application) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
    res.json({ data: await privateData.listFiles(req.userId, req.params.id) });
  });
  app.post('/api/applications/:id/files', authenticate, privateDataAvailable,
    express.raw({ type: () => true, limit: maxFileBytes }), async (req, res) => {
      if (!uuid.test(req.params.id)) {
        return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' } });
      }
      const mediaType = (req.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!fileMediaTypes.has(mediaType)) {
        return res.status(415).json({ error: { code: 'UNSUPPORTED_FILE_TYPE', message: 'Upload a plain text, PDF, JPEG, or PNG file.' } });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: { code: 'INVALID_FILE', message: 'A non-empty raw file body is required.' } });
      }
      const disposition = /^attachment;\s*filename="([^"\r\n]*)"$/i.exec(req.get('content-disposition') || '');
      const rawName = disposition?.[1]?.split(/[\\/]/).at(-1) || '';
      const originalName = [...rawName].filter(char => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127).join('').trim();
      if (!originalName || originalName.length > 128) {
        return res.status(400).json({ error: { code: 'INVALID_FILENAME', message: 'Filename must contain 1 to 128 characters.' } });
      }
      const application = await privateData.getApplication(req.userId, req.params.id);
      if (!application) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
      if (application.status !== 'draft') {
        return res.status(409).json({ error: { code: 'APPLICATION_NOT_EDITABLE', message: 'Files can only be added to draft applications.' } });
      }
      const file = await privateData.createFile(req.userId, req.params.id, {
        originalName,
        mediaType,
        content: req.body,
      });
      if (!file) {
        const current = await privateData.getApplication(req.userId, req.params.id);
        if (!current) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
        return res.status(409).json({ error: { code: 'APPLICATION_NOT_EDITABLE', message: 'Files can only be added to draft applications.' } });
      }
      res.status(201).location(`/api/applications/${req.params.id}/files/${file.id}`).json({ data: file });
    });
  app.get('/api/applications/:id/files/:fileId', authenticate, privateDataAvailable, async (req, res) => {
    if (!uuid.test(req.params.id) || !uuid.test(req.params.fileId)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application and file IDs must be UUIDs.' } });
    }
    const file = await privateData.getFile(req.userId, req.params.id, req.params.fileId);
    if (!file) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
    const safeName = encodeURIComponent(file.original_name).replace(/['()]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    res.set({
      'Content-Type': file.media_type,
      'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename*=UTF-8''${safeName}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    }).send(file.content);
  });
  app.delete('/api/applications/:id/files/:fileId', authenticate, privateDataAvailable, async (req, res) => {
    if (!uuid.test(req.params.id) || !uuid.test(req.params.fileId)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application and file IDs must be UUIDs.' } });
    }
    const application = await privateData.getApplication(req.userId, req.params.id);
    if (!application) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
    if (application.status !== 'draft') {
      return res.status(409).json({ error: { code: 'APPLICATION_NOT_EDITABLE', message: 'Files can only be removed from draft applications.' } });
    }
    if (!await privateData.deleteFile(req.userId, req.params.id, req.params.fileId)) {
      const current = await privateData.getApplication(req.userId, req.params.id);
      if (!current) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
      if (current.status !== 'draft') {
        return res.status(409).json({ error: { code: 'APPLICATION_NOT_EDITABLE', message: 'Files can only be removed from draft applications.' } });
      }
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
    }
    res.status(204).end();
  });
  app.get('/api/applications/:id/analyses', authenticate, privateDataAvailable, async (req, res) => {
    if (!uuid.test(req.params.id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' } });
    }
    const application = await privateData.getApplication(req.userId, req.params.id);
    if (!application) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
    res.json({ data: await privateData.listAnalyses(req.userId, req.params.id) });
  });
  app.get('/api/applications/:id/analyses/:analysisId', authenticate, privateDataAvailable, async (req, res) => {
    if (!uuid.test(req.params.id) || !uuid.test(req.params.analysisId)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application and analysis IDs must be UUIDs.' } });
    }
    const analysis = await privateData.getAnalysis(req.userId, req.params.id, req.params.analysisId);
    if (!analysis) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Analysis not found.' } });
    res.json({ data: analysis });
  });
  app.get('/api/applications/:id/checklist', authenticate, privateDataAvailable, async (req, res) => {
    if (!uuid.test(req.params.id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' } });
    }
    const application = await privateData.getApplication(req.userId, req.params.id);
    if (!application) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
    const documentType = await catalogue.requirements(application.document_type_id);
    if (!documentType) {
      return res.status(422).json({ error: { code: 'REQUIREMENTS_UNAVAILABLE', message: 'Requirements are not available for this application.' } });
    }
    const files = await privateData.listChecklistFiles(req.userId, req.params.id);
    res.json({
      data: {
        application_id: req.params.id,
        document_type_id: application.document_type_id,
        document_type_name: documentType.name,
        ...computeChecklist(documentType.requirements, files),
      },
    });
  });
  app.post('/api/applications/:id/analyses', authenticate, privateDataAvailable, async (req, res) => {
    if (!uuid.test(req.params.id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' } });
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).length !== 1 || !uuid.test(body.file_id || '')) {
      return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'Provide one valid file_id.' } });
    }
    if (typeof analysisProvider !== 'function' || analysisProvider.configured === false) {
      return res.status(503).json({ error: { code: 'AI_UNAVAILABLE', message: 'Document analysis is not configured.' } });
    }
    const application = await privateData.getApplication(req.userId, req.params.id);
    if (!application) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
    if (application.status !== 'draft') {
      return res.status(409).json({ error: { code: 'APPLICATION_NOT_EDITABLE', message: 'Only draft applications can be analyzed.' } });
    }
    const file = await privateData.getAnalysisFile(req.userId, req.params.id, body.file_id);
    if (!file) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
    if (file.media_type !== 'text/plain') {
      return res.status(415).json({ error: { code: 'TEXT_EXTRACTION_UNAVAILABLE', message: 'Analysis currently supports plain text files only.' } });
    }
    const fileContent = Buffer.from(file.content);
    const input = fileContent.toString('utf8');
    if (!Buffer.from(input, 'utf8').equals(fileContent) || !input.trim()) {
      return res.status(400).json({ error: { code: 'INVALID_DOCUMENT_TEXT', message: 'The file must contain valid UTF-8 text.' } });
    }
    if (fileContent.length > maxAnalysisBytes) {
      return res.status(413).json({ error: { code: 'ANALYSIS_INPUT_TOO_LARGE', message: 'Analysis accepts at most 20 KB of text.' } });
    }
    const requirements = await catalogue.requirements(application.document_type_id);
    if (!requirements) {
      return res.status(422).json({ error: { code: 'REQUIREMENTS_UNAVAILABLE', message: 'Requirements are not available for this application.' } });
    }
    const requirementData = requirements.requirements.map(({ id, name, description, is_required }) => ({
      id, name, description, is_required,
    }));
    if (requirementData.length > 50 || JSON.stringify(requirementData).length > 6000) {
      return res.status(413).json({ error: { code: 'ANALYSIS_REQUIREMENTS_TOO_LARGE', message: 'Application requirements exceed the analysis size limit.' } });
    }
    const model = analysisProvider.model || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const pending = await privateData.createAnalysis(
      req.userId, req.params.id, file.id, model, maxAnalysesPerHour,
    );
    if (!pending) {
      const current = await privateData.getApplication(req.userId, req.params.id);
      if (!current) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
      if (current.status !== 'draft') {
        return res.status(409).json({ error: { code: 'APPLICATION_NOT_EDITABLE', message: 'Only draft applications can be analyzed.' } });
      }
      return res.status(429).json({ error: { code: 'ANALYSIS_LIMIT_REACHED', message: 'This account has reached its analysis limit. Try again later.' } });
    }
    try {
      const result = await analysisProvider({
        input,
        requirements: requirementData,
        documentType: requirements.name,
      });
      const normalizedResult = normalizeAnalysisResult(
        result.result,
        requirements.requirements,
        requirements.name,
      );
      const completed = await privateData.completeAnalysis(
        req.userId,
        pending.id,
        result.result,
        normalizedResult,
      );
      if (!completed) throw new Error('Analysis record could not be finalized.');
      return res.status(201).location(`/api/applications/${req.params.id}/analyses/${completed.id}`).json({ data: completed });
    } catch (error) {
      if (error instanceof ProviderError) {
        await privateData.failAnalysis(req.userId, pending.id, error.code);
        return res.status(error.status).json({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }));
  app.use((error, req, res, _next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds the size limit.' },
      });
    }
    logger.error({
      requestId: req.requestId,
      event: 'request_failed',
      type: error.name,
      ...(typeof error.code === 'string' ? { code: error.code } : {}),
    });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to complete the request.', requestId: req.requestId } });
  });
  return app;
}
