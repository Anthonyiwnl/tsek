import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { requireUser } from './auth.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const applicationFields = new Set(['document_type_id', 'purpose']);

function invalidBody(res) {
  return res.status(400).json({
    error: { code: 'INVALID_BODY', message: 'Request body must contain valid application fields.' },
  });
}

export function createApp({
  catalogue,
  applications,
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
  app.get('/api/applications', authenticate, applicationsAvailable, async (req, res) => {
    res.json({ data: await applications.list(req.userId) });
  });
  app.post('/api/applications', authenticate, applicationsAvailable, async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some(key => !['document_type_id', 'purpose'].includes(key))
      || !uuid.test(body.document_type_id || '')
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
        && !uuid.test(body.document_type_id || ''))
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
