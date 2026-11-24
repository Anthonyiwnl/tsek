import { createApp } from './app.js';
import { createPool } from './db.js';
import { loadConfig, serverConfig } from './config.js';
import { catalogueRepository } from './catalogue.js';
import { applicationsRepository } from './applications.js';
import { applicationFilesRepository } from './application-files.js';
import { applicationAnalysesRepository } from './application-analyses.js';
import { createDocumentExtractor } from './extraction.js';
import { createNeonTokenVerifier } from './auth.js';
import { createAiRequestBudget } from './ai-request-budget.js';
import { staffRepository } from './staff.js';
import { createTelemetryLogger, createTelemetryRecorder } from './telemetry.js';
import { metricsRepository } from './metrics.js';

const { port, origin } = serverConfig();
// Render sets RENDER=true. A hosted backend outside production mode is a
// misconfiguration ("debug mode"): say so loudly in the deploy logs.
if (process.env.RENDER === 'true' && process.env.NODE_ENV !== 'production') {
  console.error('NODE_ENV is not "production" on Render. Set NODE_ENV=production for this service (docs/CI_CD.md).');
}
const { aiVerifyEnabled, openAiApiKey } = loadConfig();
const pool = createPool();
// Copies request and AI log lines into PostgreSQL for the operations dashboard.
const telemetry = createTelemetryRecorder({ pool });
const logger = createTelemetryLogger(console, telemetry);
const poolStats = () => ({
  total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: pool.options.max,
});
const verifyToken = process.env.NEON_AUTH_BASE_URL
  ? createNeonTokenVerifier()
  : undefined;
const server = createApp({
  catalogue: catalogueRepository(pool),
  applications: applicationsRepository(pool),
  staff: staffRepository(pool),
  applicationFiles: applicationFilesRepository(pool),
  applicationAnalyses: applicationAnalysesRepository(pool),
  consumeAiBudget: createAiRequestBudget(pool),
  extractDocument: aiVerifyEnabled && openAiApiKey ? createDocumentExtractor({ logger }) : undefined,
  metrics: metricsRepository(pool, { poolStats }),
  verifyToken,
  origin,
  logger,
}).listen(port, () => {
  console.log(`TSEK API listening on port ${port}`);
});
server.on('error', async () => {
  console.error('HTTP server failed to start. Check PORT and whether it is already in use.');
  await telemetry.close();
  await pool.end();
  process.exitCode = 1;
});
let stopping = false;
/**
 * Stop accepting requests and close the database pool after pending requests finish.
 * Ignore repeat signals and force exit if shutdown exceeds ten seconds.
 */
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(async () => {
    await telemetry.close();
    await pool.end();
    clearTimeout(timeout);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
