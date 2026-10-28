const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_PORT = 3000;
const DEFAULT_TIMEOUT_MS = 10000;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Read provider settings and the release commit supplied by the hosting platform. */
export function loadConfig(env = process.env) {
  return {
    port: positiveInteger(env.PORT, DEFAULT_PORT),
    timeoutMs: positiveInteger(env.OPENAI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    openAiApiKey: env.OPENAI_API_KEY?.trim() || '',
    openAiModel: env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    frontendUrl: env.FRONTEND_URL?.trim() || '',
    commit: env.RENDER_GIT_COMMIT?.trim() || null,
  };
}

/**
 * Validate a PostgreSQL URL, requiring verified remote TLS and upgrading sslmode=require.
 * Migration mode prefers a direct URL and rejects Neon pooler hosts.
 * @param {object} [env=process.env] - Database connection environment variables.
 * @param {object} [options={}] - Connection options.
 * @param {boolean} [options.migration=false] - Select a connection for database scripts.
 * @returns {string} The validated connection string.
 */
export function databaseUrl(env = process.env, { migration = false } = {}) {
  const value = migration ? env.DIRECT_DATABASE_URL || env.DATABASE_URL_UNPOOLED || env.DATABASE_URL : env.DATABASE_URL;
  if (!value) throw new Error('Set DATABASE_URL (and optionally DIRECT_DATABASE_URL or DATABASE_URL_UNPOOLED) in .env.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Database URL must be a valid PostgreSQL URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
    throw new Error('Database URL must include a PostgreSQL host and database name.');
  }
  if (migration && url.hostname.includes('-pooler.')) {
    throw new Error('Use a direct Neon connection in DIRECT_DATABASE_URL or DATABASE_URL_UNPOOLED for database scripts.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!local && url.searchParams.get('sslmode') === 'require') url.searchParams.set('sslmode', 'verify-full');
  if (!local && url.searchParams.get('sslmode') !== 'verify-full') {
    throw new Error('Remote database URLs must use sslmode=verify-full for verified TLS.');
  }
  return local ? value : url.toString();
}

/** Read and validate the HTTP port and allowed frontend origin. */
export function serverConfig(env = process.env) {
  const port = Number(env.PORT || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  const origin = env.FRONTEND_URL || 'http://localhost:5173';
  let url;
  try { url = new URL(origin); } catch { throw new Error('FRONTEND_URL must be an HTTP(S) origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
    throw new Error('FRONTEND_URL must be an HTTP(S) origin without a trailing slash or path.');
  }
  return { port, origin };
}

export { DEFAULT_MODEL, DEFAULT_PORT, DEFAULT_TIMEOUT_MS };
