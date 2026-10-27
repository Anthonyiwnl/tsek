export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorMessage(error) {
  if (!(error instanceof ApiError)) return 'Unable to connect. Check your connection and try again.';
  const messages = {
    401: 'Your session expired. Sign in again to continue.',
    403: 'You do not have permission to perform this action.',
    404: 'This record is unavailable. It may have been removed or belong to another account.',
    409: 'This application is no longer editable. Refresh to see its current status.',
    413: 'This file is too large for this operation.',
    415: 'This file type is not supported for this operation.',
    422: 'The selected service or its requirements are no longer available.',
    429: 'The analysis limit has been reached. Please try again later.',
    503: 'This service is temporarily unavailable. Your saved records are unchanged.',
  };
  if (error.code === 'TIMEOUT') return 'The request timed out. Refresh before retrying; the server may have saved it.';
  if (error.code === 'NETWORK') return 'Connection lost. Refresh before retrying; the server may have saved your changes.';
  return messages[error.status] || 'The request could not be completed. Refresh and try again.';
}

/** Owner identity is supplied only by the backend-verified bearer token. */
export function createApplicationApi({ getToken, base = '/api', fetchImpl = fetch, onUnauthorized = () => {} }) {
  const root = base.replace(/\/$/, '');
  const segment = (id) => encodeURIComponent(id);
  async function request(path, { method = 'GET', data, signal } = {}) {
    const token = await getToken();
    if (!token) { onUnauthorized(); throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in required'); }
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
    try {
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
      if (data !== undefined) headers['Content-Type'] = 'application/json';

      const response = await fetchImpl(root + path, {
        method, headers, body: (data === undefined ? undefined : JSON.stringify(data)),
        signal: controller.signal, cache: 'no-store', redirect: 'error',
      });
      if (response.status === 401) onUnauthorized();
      if (response.status === 204 && response.ok) return null;
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(response.status, payload?.error?.code || 'REQUEST_FAILED', 'Request failed');
      if (!payload || !Object.hasOwn(payload, 'data')) throw new ApiError(502, 'INVALID_RESPONSE', 'Invalid response');
      return payload.data;
    } catch (error) {
      if (timedOut) throw new ApiError(0, 'TIMEOUT', 'Request timed out');
      if (signal?.aborted || error instanceof ApiError) throw error;
      throw new ApiError(0, 'NETWORK', 'Connection lost');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  const appPath = (id) => '/applications/' + segment(id);
  return {
    list: (signal) => request('/applications', { signal }),
    get: (id, signal) => request(appPath(id), { signal }),
    services: (signal) => request('/document-types', { signal }),
    update: (id, data) => request(appPath(id), { method: 'PATCH', data }),
    remove: (id) => request(appPath(id), { method: 'DELETE' }),
  };
}
