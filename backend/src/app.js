import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { createOpenAiProvider, ProviderError } from './provider.js';
import { requireUser } from './auth.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const defaultApplicationListLimit = 50;
const maxApplicationListLimit = 100;

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
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
          && (typeof body.purpose !== 'string' || body.purpose.length > 200))) {
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
  if (config.aiVerifyEnabled) {
    const verify = provider || createOpenAiProvider({
      apiKey: config.openAiApiKey,
      model: config.openAiModel,
      timeoutMs: config.timeoutMs,
    });
    app.post('/api/verify', express.json({ limit: '1mb', strict: false }), async (req, res, next) => {
      if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)
        || typeof req.body.input !== 'string' || req.body.input.trim().length === 0
        || req.body.input.trim().length > 10000) {
        return res.status(400).json({ error: {
          code: 'INVALID_INPUT',
          message: 'The input field must be a non-empty string of 10,000 characters or fewer.',
        } });
      }
      try {
        const result = await verify({ input: req.body.input.trim() });
        res.json({ result: result.result, model: result.model });
      } catch (error) {
        if (error instanceof ProviderError) {
          return res.status(error.status).json({ error: { code: error.code, message: error.message } });
        }
        next(error);
      }
    });
  }
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
