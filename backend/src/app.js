import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create the catalogue API with health checks and sanitized error responses.
 * @param {object} options - Application dependencies and HTTP configuration.
 * @param {object} options.catalogue - Repository with list, requirements, and ready methods.
 * @param {string} [options.origin='http://localhost:5173'] - Allowed browser origin.
 * @param {object} [options.logger=console] - Logger with an error method.
 * @returns {import('express').Express} The configured application, without a listener.
 */
export function createApp({ catalogue, origin = 'http://localhost:5173', logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin, methods: ['GET', 'HEAD', 'OPTIONS'] }));
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });
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
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }));
  app.use((error, req, res, _next) => {
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
