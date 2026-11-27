export class ApiError extends Error {
  constructor(status, code, message, characterCount = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.characterCount = characterCount;
  }
}

const analysisUnavailableMessage = 'The analysis service could not process this document. Try again later.';

export function errorMessage(error) {
  if (!(error instanceof ApiError)) return 'Unable to connect. Check your connection and try again.';
  if (error.code === 'INVALID_DOCUMENT_LENGTH') return documentLengthMessage(error.characterCount);
  const codeMessages = {
    INVALID_DOCUMENT_MEDIA: 'Choose a readable JPEG/PNG up to 4 megapixels or an unencrypted PDF with 1–3 pages, no larger than 2 MiB.',
    MEDIA_VALIDATION_BUSY: 'Document checks are busy. Please try again shortly.',
    STAFF_REQUIRED: 'Staff access is required. Ask your project administrator to assign your account.',
    SELF_REVIEW_FORBIDDEN: 'Another staff member must review your application. You cannot approve or reject your own submission.',
    REVIEW_CONFLICT: 'Another reviewer has already decided this application, or your access changed. Refresh to see the latest record.',
    SUBMISSION_NOT_READY: 'Submit a draft with a purpose, an active service, and at least one uploaded document.',
    ANALYSES_UNAVAILABLE: analysisUnavailableMessage,
    ANALYSIS_TIMEOUT: analysisUnavailableMessage,
    ANALYSIS_PROVIDER_FAILURE: analysisUnavailableMessage,
    INVALID_ANALYSIS: analysisUnavailableMessage,
    INVALID_EXTRACTION_INPUT: 'Upload a plain-text file containing 1 to 10,000 text characters, then analyze the new file.',
    FILE_LIMIT_REACHED: 'This application already has 10 files. Remove an unneeded file before uploading another.',
    APPLICATION_CHANGED: 'The application or file changed during analysis. Refresh before trying again.',

    AI_INVALID_RESPONSE: analysisUnavailableMessage,
    AI_TIMEOUT: analysisUnavailableMessage,
    AI_PROVIDER_ERROR: analysisUnavailableMessage,
    TEXT_EXTRACTION_UNAVAILABLE: 'Analysis currently supports plain-text files only. PDF and image extraction is not available yet.',
    INVALID_DOCUMENT_TEXT: 'Upload a readable UTF-8 text file containing non-empty text, then analyze the new file.',
  };
  if (Object.hasOwn(codeMessages, error.code)) return codeMessages[error.code];
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
  if (!file) return 'Choose a file to upload.';
  if (!file.size) return documentLengthMessage(0);
  if (file.size > 2 * 1024 * 1024) return 'Choose a file no larger than 2 MiB.';
  const media = import.meta.env?.VITE_DOCUMENT_MEDIA_ENABLED === 'true';
  const formats = { txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };
  const extension = /\.([a-z]+)$/i.exec(file.name || '')?.[1]?.toLowerCase();
  if (media && formats[extension] && (!file.type || file.type === formats[extension])) return '';
  if (!/\.txt$/i.test(file.name || '') || !['', 'text/plain'].includes(file.type)) return media ? 'Choose a .txt, JPEG, PNG or PDF file.' : 'Choose a plain-text (.txt) file. PDF and image analysis is not available yet.';
  return '';
}

function documentLengthMessage(count) {
  const value = Number.isSafeInteger(count) && count >= 0 ? `This file contains ${count.toLocaleString('en-US')} characters. ` : '';
  return `${value}Use a text file with 1 to 10,000 characters and non-whitespace document text.`;
}

export async function validateUploadText(file) {
  if (!/\.txt$/i.test(file.name || '')) return '';
  try {
    const buffer = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsArrayBuffer(file);
    });
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
    const count = [...text].length;
    return !text.trim() || count > 10_000 ? documentLengthMessage(count) : '';
  } catch { return 'Choose a readable UTF-8 plain-text file.'; }
}

/** Owner identity is supplied only by the backend-verified bearer token. */
export function createApplicationApi({ getToken, base = '/api', fetchImpl = fetch, onUnauthorized = () => {} }) {
  const root = base.replace(/\/$/, '');
  async function request(path, { method = 'GET', data, file, signal, envelope = false, blob = false } = {}) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
    let rejectAbort;
    const aborted = new Promise((_, reject) => { rejectAbort = () => reject(controller.signal.reason); });
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
    try {
      controller.signal.throwIfAborted();
      const token = await Promise.race([getToken(), aborted]);
      controller.signal.throwIfAborted();
      if (!token) { onUnauthorized(); throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in required'); }
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
      if (data !== undefined) headers['Content-Type'] = 'application/json';
      if (file) {
        const types = { txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };
        headers['Content-Type'] = file.type || types[/\.([a-z]+)$/i.exec(file.name)?.[1]?.toLowerCase()] || 'application/octet-stream';
        // The backend accepts quoted ASCII filenames, not RFC 5987 headers.
        const name = file.name.replace(/[^\x20-\x7e]|["\\/]/g, '_').slice(0, 128).trim() || 'document';
        headers['Content-Disposition'] = `attachment; filename="${name}"`;
      }
      const response = await fetchImpl(root + path, {
        method, headers, body: file || (data === undefined ? undefined : JSON.stringify(data)),
        signal: controller.signal, cache: 'no-store', redirect: 'error',
      });
      signal?.throwIfAborted();
      if (response.status === 401) onUnauthorized();
      if (response.status === 204 && response.ok) return null;
      if (blob && response.ok) return await response.blob();
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(response.status, response.status === 503 && /\/(analyses|checklist)$/.test(path) ? 'ANALYSES_UNAVAILABLE' : payload?.error?.code || 'REQUEST_FAILED', 'Request failed', payload?.error?.characterCount);
      if (!payload || !Object.hasOwn(payload, 'data')) throw new ApiError(502, 'INVALID_RESPONSE', 'Invalid response');
      return envelope ? payload : payload.data;
    } catch (error) {
      if (timedOut) throw new ApiError(0, 'TIMEOUT', 'Request timed out');
      if (signal?.aborted || error instanceof ApiError) throw error;
      throw new ApiError(0, 'NETWORK', 'Connection lost');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); controller.signal.removeEventListener('abort', rejectAbort); }
  }
  return {
    me: (signal) => request('/me', { signal }),
    submit: (id) => request('/applications/' + encodeURIComponent(id) + '/submit', { method: 'POST' }),
    reviews: (id, signal) => request('/applications/' + encodeURIComponent(id) + '/reviews', { signal }),
    staffList: (query, signal) => request('/admin/applications?' + new URLSearchParams(query), { signal, envelope: true }),
    staffGet: (id, signal) => request('/admin/applications/' + encodeURIComponent(id), { signal }),
    staffReview: (id, data) => request('/admin/applications/' + encodeURIComponent(id) + '/reviews', { method: 'POST', data }),
    staffDownload: (id, fileId) => request('/admin/applications/' + encodeURIComponent(id) + '/files/' + encodeURIComponent(fileId), { blob: true }),
    list: async (signal) => {
      const rows = [];
      let more = true;
      while (more) {
        const page = await request('/applications?limit=100&offset=' + rows.length, { signal, envelope: true });
        if (!Array.isArray(page.data) || typeof page.hasMore !== 'boolean' || (page.hasMore && page.data.length === 0)) throw new ApiError(502, 'INVALID_RESPONSE', 'Invalid application page');
        rows.push(...page.data);
        more = page.hasMore;
      }
      return rows;
    },
    get: (id, signal) => request('/applications/' + encodeURIComponent(id), { signal }),
    services: (signal) => request('/document-types', { signal }),
    update: (id, data) => request('/applications/' + encodeURIComponent(id), { method: 'PATCH', data }),
    remove: (id) => request('/applications/' + encodeURIComponent(id), { method: 'DELETE' }),
    create: (data) => request('/applications', { method: 'POST', data }),
    files: (id, signal) => request(('/applications/' + encodeURIComponent(id)) + '/files', { signal }),
    upload: (id, file) => request(('/applications/' + encodeURIComponent(id)) + '/files', { method: 'POST', file }),
    replace: (id, fileId, file) => request('/applications/' + encodeURIComponent(id) + '/files/' + encodeURIComponent(fileId), { method: 'PUT', file }),
    analyses: (id, signal) => request(('/applications/' + encodeURIComponent(id)) + '/analyses', { signal }),
    analyze: (id, fileId) => request(('/applications/' + encodeURIComponent(id)) + '/analyses', { method: 'POST', data: { file_id: fileId } }),
    checklist: (id, signal) => request(('/applications/' + encodeURIComponent(id)) + '/checklist', { signal }),
  };
}
