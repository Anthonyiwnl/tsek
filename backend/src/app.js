import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { createOpenAiProvider, ProviderError } from './provider.js';
import { validateAnalysisResponse } from './analysis.js';
import { requireUser } from './auth.js';
import { registerApplicationAnalysisRoutes } from './application-analysis-routes.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const defaultApplicationListLimit = 50;
const maxApplicationListLimit = 100;

const fileMediaTypes = new Set(['text/plain', 'application/pdf', 'image/jpeg', 'image/png']);
const maxFileBytes = 2 * 1024 * 1024;

function matchesFileType(content, mediaType) {
  if (mediaType === 'application/pdf') return content.subarray(0, 5).equals(Buffer.from('%PDF-'));
  if (mediaType === 'image/jpeg') return content.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mediaType === 'image/png') {
    return content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  try {
    const value = new TextDecoder('utf-8', { fatal: true }).decode(content);
    for (const character of value) {
      if (character < ' ' && !'\t\r\n\f'.includes(character)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function parseApplicationListPagination(query) {
  const parseValue = (value, fallback) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  };
  const limit = parseValue(query.limit, defaultApplicationListLimit);
  const offset = parseValue(query.offset, 0);
  if (limit === null || limit < 1 || limit > maxApplicationListLimit
    || offset === null) return null;
  return { limit, offset };
}

/**
 * Create the catalogue API with health checks and sanitized error responses.
 * @param {object} options - Application dependencies and HTTP configuration.
 * @param {object} options.catalogue - Repository with list, requirements, and ready methods.
 * @param {string} [options.origin='http://localhost:5173'] - Allowed browser origin.
 * @param {object} [options.logger=console] - Logger with an error method.
 * @param {string|null} [options.commit] - Deployed commit SHA reported by /health. Defaults to Render's RENDER_GIT_COMMIT.
 * @returns {import('express').Express} The configured application, without a listener.
 */
export function createApp({
  catalogue,
  applications,
  applicationFiles,
  applicationAnalyses,
  extractDocument,
  consumeAiBudget,
  verifyToken,
  origin = 'http://localhost:5173',
  logger = console,
  commit = process.env.RENDER_GIT_COMMIT || null,
  provider,
  env = process.env,
} = {}) {
  const config = loadConfig(env);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Content-Disposition'],
    exposedHeaders: ['Location', 'Content-Disposition', 'Retry-After'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }));
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok', commit }));
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
  const authenticate = verifyToken
    ? requireUser(verifyToken, logger)
    : (_req, res) => res.status(503).json({
      error: { code: 'AUTH_UNAVAILABLE', message: 'Application authentication is not configured.' },
    });
  const admitAiRequest = async (req, res) => {
    let admission;
    try {
      if (!consumeAiBudget) throw new Error('AI budget is not configured.');
      admission = await consumeAiBudget(req.userId);
    } catch {
      logger.error({ requestId: req.requestId, event: 'ai_budget_unavailable' });
      res.status(503).json({ error: {
        code: 'AI_BUDGET_UNAVAILABLE', message: 'AI requests are temporarily unavailable. Please try again later.',
      } });
      return false;
    }
    if (admission.allowed) return true;
    res.set('Retry-After', String(admission.retryAfterSeconds)).status(429).json({ error: {
      code: 'AI_RATE_LIMITED', message: 'AI request limit reached. Please try again later.',
    } });
    return false;
  };
  const applicationsAvailable = applications
    ? (_req, _res, next) => next()
    : (_req, res) => res.status(503).json({
      error: { code: 'APPLICATIONS_UNAVAILABLE', message: 'Application storage is not configured.' },
    });
  app.get('/api/applications', authenticate, applicationsAvailable, async (req, res) => {
    const pagination = parseApplicationListPagination(req.query);
    if (!pagination) {
      return res.status(400).json({
        error: { code: 'INVALID_QUERY', message: 'Use a limit from 1 to 100 and a non-negative integer offset.' },
      });
    }
    const { rows, hasMore } = await applications.list(req.userId, {
      limit: pagination.limit,
      offset: pagination.offset,
    });
    res.json({
      data: rows,
      hasMore,
    });
  });
  app.post('/api/applications', authenticate, applicationsAvailable,
    express.json({ limit: '32kb' }), async (req, res) => {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).some(key => !['document_type_id', 'purpose'].includes(key))
        || typeof body.document_type_id !== 'string'
        || !uuid.test(body.document_type_id)
        || (body.purpose !== undefined
          && (typeof body.purpose !== 'string' || body.purpose.trim().length > 200))) {
        return res.status(400).json({
          error: { code: 'INVALID_BODY', message: 'Request body must contain valid application fields.' },
        });
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
      return res.status(400).json({
        error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' },
      });
    }
    const application = await applications.get(req.userId, req.params.id);
    if (!application) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Application not found.' },
      });
    }
    res.json({ data: application });
  });
  app.patch('/api/applications/:id', authenticate, applicationsAvailable,
    express.json({ limit: '32kb' }), async (req, res) => {
      if (!uuid.test(req.params.id)) {
        return res.status(400).json({
          error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' },
        });
      }
      const body = req.body;
      const keys = body && typeof body === 'object' && !Array.isArray(body)
        ? Object.keys(body)
        : [];
      if (!keys.length || keys.some(key => !['document_type_id', 'purpose'].includes(key))
        || (Object.hasOwn(body || {}, 'document_type_id')
          && (typeof body.document_type_id !== 'string' || !uuid.test(body.document_type_id)))
        || (Object.hasOwn(body || {}, 'purpose')
          && (typeof body.purpose !== 'string' || body.purpose.trim().length > 200))) {
        return res.status(400).json({
          error: { code: 'INVALID_BODY', message: 'Request body must contain valid application fields.' },
        });
      }
      const changes = { ...body };
      if (Object.hasOwn(changes, 'purpose')) changes.purpose = changes.purpose.trim();
      const result = await applications.update(req.userId, req.params.id, changes);
      if (!result.updated) {
        if (!result.current) {
          return res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Application not found.' },
          });
        }
        if (result.current.status !== 'draft') {
          return res.status(409).json({
            error: { code: 'APPLICATION_NOT_EDITABLE', message: 'Only draft applications can be updated.' },
          });
        }
        return res.status(422).json({
          error: { code: 'INVALID_DOCUMENT_TYPE', message: 'Document type is missing or inactive.' },
        });
      }
      res.json({ data: result.application });
    });
  app.delete('/api/applications/:id', authenticate, applicationsAvailable, async (req, res) => {
    if (!uuid.test(req.params.id)) {
      return res.status(400).json({
        error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' },
      });
    }
    const result = await applications.deleteDraft(req.userId, req.params.id);
    if (!result) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Application not found.' },
      });
    }
    if (!result.deleted) {
      return res.status(409).json({
        error: { code: 'APPLICATION_NOT_DELETABLE', message: 'Only draft applications can be deleted.' },
      });
    }
    res.status(204).end();
  });
  const applicationFilesAvailable = applicationFiles
    ? (_req, res, next) => {
      res.set('Cache-Control', 'private, no-store');
      next();
    }
    : (_req, res) => res.status(503).json({
      error: { code: 'FILES_UNAVAILABLE', message: 'Application file storage is not configured.' },
    });
  app.get('/api/applications/:id/files', authenticate, applicationFilesAvailable, async (req, res) => {
    if (!uuid.test(req.params.id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' } });
    }
    const application = await applicationFiles.getApplication(req.userId, req.params.id);
    if (!application) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
    res.json({ data: await applicationFiles.listFiles(req.userId, req.params.id) });
  });
  app.post('/api/applications/:id/files', authenticate, applicationFilesAvailable,
    async (req, res, next) => {
      if (!uuid.test(req.params.id)) {
        return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application ID must be a UUID.' } });
      }
      const mediaType = (req.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!fileMediaTypes.has(mediaType)) {
        return res.status(415).json({ error: { code: 'UNSUPPORTED_FILE_TYPE', message: 'Upload a plain text, PDF, JPEG, or PNG file.' } });
      }
      const disposition = /^attachment;\s*filename="([^"\r\n]*)"$/i.exec(req.get('content-disposition') || '');
      const rawName = disposition?.[1]?.split(/[\\/]/).at(-1) || '';
      const originalName = [...rawName].filter(char => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127).join('').trim();
      if (!originalName || originalName.length > 128) {
        return res.status(400).json({ error: { code: 'INVALID_FILENAME', message: 'Filename must contain 1 to 128 characters.' } });
      }
      const application = await applicationFiles.getApplication(req.userId, req.params.id);
      if (!application) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
      if (application.status !== 'draft') {
        return res.status(409).json({ error: { code: 'APPLICATION_NOT_EDITABLE', message: 'Files can only be added to draft applications.' } });
      }
      res.locals.upload = { originalName, mediaType };
      next();
    }, express.raw({ type: () => true, limit: maxFileBytes, inflate: false }), async (req, res) => {
      const { originalName, mediaType } = res.locals.upload;
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: { code: 'INVALID_FILE', message: 'A non-empty raw file body is required.' } });
      }
      if (!matchesFileType(req.body, mediaType)) {
        return res.status(415).json({ error: { code: 'UNSUPPORTED_FILE_TYPE', message: 'The file contents do not match a supported file type.' } });
      }
      const file = await applicationFiles.createFile(req.userId, req.params.id, {
        originalName,
        mediaType,
        content: req.body,
      });
      if (!file) {
        const current = await applicationFiles.getApplication(req.userId, req.params.id);
        if (!current) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found.' } });
        if (current.status !== 'draft') {
          return res.status(409).json({ error: { code: 'APPLICATION_NOT_EDITABLE', message: 'Files can only be added to draft applications.' } });
        }
        return res.status(409).json({ error: { code: 'FILE_LIMIT_REACHED', message: 'An application can have up to 10 files.' } });
      }
      res.status(201).location(`/api/applications/${req.params.id}/files/${file.id}`).json({ data: file });
    });
  app.get('/api/applications/:id/files/:fileId', authenticate, applicationFilesAvailable, async (req, res) => {
    if (!uuid.test(req.params.id) || !uuid.test(req.params.fileId)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application and file IDs must be UUIDs.' } });
    }
    const file = await applicationFiles.getFile(req.userId, req.params.id, req.params.fileId);
    if (!file) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
    const safeName = encodeURIComponent(file.original_name).replace(/['()]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    res.set({
      'Content-Type': file.media_type,
      'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename*=UTF-8''${safeName}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    }).send(Buffer.from(file.content));
  });
  app.delete('/api/applications/:id/files/:fileId', authenticate, applicationFilesAvailable, async (req, res) => {
    if (!uuid.test(req.params.id) || !uuid.test(req.params.fileId)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Application and file IDs must be UUIDs.' } });
    }
    const application = await applicationFiles.getApplication(req.userId, req.params.id);
    if (!application) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
    if (application.status !== 'draft') {
      return res.status(409).json({ error: { code: 'APPLICATION_NOT_EDITABLE', message: 'Files can only be removed from draft applications.' } });
    }
    if (!await applicationFiles.deleteFile(req.userId, req.params.id, req.params.fileId)) {
      const current = await applicationFiles.getApplication(req.userId, req.params.id);
      if (!current) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
      if (current.status !== 'draft') {
        return res.status(409).json({ error: { code: 'APPLICATION_NOT_EDITABLE', message: 'Files can only be removed from draft applications.' } });
      }
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
    }
    res.status(204).end();
  });
  registerApplicationAnalysisRoutes(app, {
    authenticate, applicationFiles, applicationAnalyses, catalogue, extractDocument, admitAiRequest, uuid,
  });
  if (config.aiVerifyEnabled) {
    const verify = provider || createOpenAiProvider({
      apiKey: config.openAiApiKey,
      model: config.openAiModel,
      timeoutMs: config.timeoutMs,
      logger,
    });
    app.post('/api/verify', authenticate, express.json({ limit: '1mb', strict: false }), async (req, res, next) => {
      if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)
        || typeof req.body.input !== 'string' || req.body.input.trim().length === 0
        || req.body.input.trim().length > 10000) {
        return res.status(400).json({ error: {
          code: 'INVALID_INPUT',
          message: 'The input field must be a non-empty string of 10,000 characters or fewer.',
        } });
      }
      res.set('Cache-Control', 'private, no-store');
      if (!await admitAiRequest(req, res)) return;
      try {
        const result = await verify({
          input: req.body.input.trim(), requestId: req.requestId, promptVersion: 'verify.v1',
        });
        res.json({ result: result.result, model: result.model });
      } catch (error) {
        if (error instanceof ProviderError) {
          return res.status(error.status).json({ error: { code: error.code, message: error.message } });
        }
        next(error);
      }
    });
  }
  app.post('/api/analyses/validate', authenticate, express.json({ limit: '1mb', strict: false }), (req, res) => {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)
      || !Object.hasOwn(req.body, 'response')) {
      return res.status(400).json({ error: {
        code: 'INVALID_INPUT',
        message: 'The response field must contain an analysis object or JSON string.',
      } });
    }
    const { valid, errors } = validateAnalysisResponse(req.body.response);
    res.status(valid ? 200 : 422).json({ valid, errors });
  });
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }));
  app.use((error, req, res, _next) => {
    if (error?.type === 'entity.too.large') {
      res.setHeader('Connection', 'close');
      return res.status(413).json({ error: { code: 'REQUEST_TOO_LARGE', message: 'Request body is too large.' } });
    }
    if (error instanceof SyntaxError && error.status === 400) {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } });
    }
    if (typeof error?.type === 'string' && Number.isInteger(error.status)
      && error.status >= 400 && error.status < 500) {
      return res.status(error.status).json({ error: {
        code: error.status === 415 ? 'UNSUPPORTED_MEDIA_TYPE' : 'INVALID_REQUEST_BODY',
        message: error.status === 415
          ? 'Request body uses an unsupported charset or encoding.'
          : 'Request body could not be read.',
      } });
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
