export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorMessage(error) {
  if (!(error instanceof ApiError)) return 'Unable to connect. Check your connection and try again.';
  const providerMessages = {
    AI_INVALID_RESPONSE: 'Analysis returned an unreadable result. No successful result was saved. Try again later.',
    AI_TIMEOUT: 'Analysis timed out. Refresh results before retrying.',
    AI_PROVIDER_ERROR: 'The analysis service could not process this document. Try again later.',
    TEXT_EXTRACTION_UNAVAILABLE: 'Analysis currently supports plain-text files only. PDF and image extraction is not available yet.',
  };
  if (providerMessages[error.code]) return providerMessages[error.code];
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

export function validateUpload(file) {
  if (!file || !file.size) return 'Choose a non-empty file.';
  if (file.size > 2 * 1024 * 1024) return 'Choose a file no larger than 2 MiB.';
  if (!['text/plain', 'application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return 'Choose a TXT, PDF, JPEG, or PNG file.';
  return '';
}

/** Owner identity is supplied only by the backend-verified bearer token. */
export function createApplicationApi({ getToken, base = '/api', fetchImpl = fetch, onUnauthorized = () => {} }) {
  const root = base.replace(/\/$/, '');
  const segment = (id) => encodeURIComponent(id);
  async function request(path, { method = 'GET', data, file, signal } = {}) {
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
      if (file) {
        headers['Content-Type'] = file.type;
        // The backend accepts quoted ASCII filenames, not RFC 5987 headers.
        const name = file.name.replace(/[^\x20-\x7e]|["\\/]/g, '_').slice(0, 128).trim() || 'document';
        headers['Content-Disposition'] = `attachment; filename="${name}"`;
      }
      const response = await fetchImpl(root + path, {
        method, headers, body: file || (data === undefined ? undefined : JSON.stringify(data)),
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
    create: (data) => request('/applications', { method: 'POST', data }),
    update: (id, data) => request(appPath(id), { method: 'PATCH', data }),
    remove: (id) => request(appPath(id), { method: 'DELETE' }),
    files: (id, signal) => request(appPath(id) + '/files', { signal }),
    upload: (id, file) => request(appPath(id) + '/files', { method: 'POST', file }),
    analyses: (id, signal) => request(appPath(id) + '/analyses', { signal }),
    analyze: (id, fileId) => request(appPath(id) + '/analyses', { method: 'POST', data: { file_id: fileId } }),
    checklist: (id, signal) => request(appPath(id) + '/checklist', { signal }),
  };
}
