import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { createOpenAiProvider, ProviderError } from './provider.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create the catalogue API with health checks and sanitized error responses.
 * @param {object} options - Application dependencies and HTTP configuration.
 * @param {object} options.catalogue - Repository with list, requirements, and ready methods.
 * @param {string} [options.origin='http://localhost:5173'] - Allowed browser origin.
 * @param {object} [options.logger=console] - Logger with an error method.
 * @returns {import('express').Express} The configured application, without a listener.
 */
export function createApp({ catalogue, origin = 'http://localhost:5173', logger = console, provider, env = process.env } = {}) {
  const config = loadConfig(env);
  const verify = provider || createOpenAiProvider({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    timeoutMs: config.timeoutMs,
  });
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin, methods: ['GET', 'HEAD', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });
  app.use(express.json({ limit: '1mb', strict: false }));
  app.get('/health', (_req, res) => res.json({ status: 'ok', commit: config.commit }));
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
  app.post('/api/verify', async (req, res, next) => {
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
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }));
  app.use((error, req, res, _next) => {
    if (error?.type === 'entity.too.large') {
      res.setHeader('Connection', 'close');
      return res.status(413).json({ error: { code: 'REQUEST_TOO_LARGE', message: 'Request body is too large.' } });
    }
    if (error instanceof SyntaxError && error.status === 400) {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } });
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
