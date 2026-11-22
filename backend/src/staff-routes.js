import express from 'express';
import { applicationChecklist } from './application-analyses.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });

export function registerStaffRoutes(app, { authenticate, staff, applications, applicationFiles, applicationAnalyses, catalogue }) {
  const available = (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (!staff) return fail(res, 503, 'STAFF_UNAVAILABLE', 'Staff access is not configured.');
    next();
  };
  const requireStaff = async (req, res, next) => {
    const role = await staff.role(req.userId);
    if (!['staff', 'admin'].includes(role)) return fail(res, 403, 'STAFF_REQUIRED', 'A staff account is required.');
    next();
  };
  const validId = (req, res, next) => {
    if (!uuid.test(req.params.id) || (req.params.fileId && !uuid.test(req.params.fileId))) {
      return fail(res, 400, 'INVALID_ID', 'A valid UUID is required.');
    }
    next();
  };
  app.get('/api/me', authenticate, available, async (req, res) => {
    res.json({ data: { id: req.userId, role: await staff.role(req.userId) } });
  });
  app.post('/api/applications/:id/submit', authenticate, available, validId, async (req, res) => {
    if (!applications) return fail(res, 503, 'APPLICATIONS_UNAVAILABLE', 'Applications are unavailable.');
    if (!await applications.get(req.userId, req.params.id)) return fail(res, 404, 'NOT_FOUND', 'Application not found.');
    const submitted = await staff.submit(req.userId, req.params.id);
    if (!submitted) return fail(res, 409, 'SUBMISSION_NOT_READY', 'Submit a draft with a purpose, an active service, and at least one uploaded document.');
    res.json({ data: submitted });
  });
  app.get('/api/applications/:id/reviews', authenticate, available, validId, async (req, res) => {
    if (!applications) return fail(res, 503, 'APPLICATIONS_UNAVAILABLE', 'Applications are unavailable.');
    if (!await applications.get(req.userId, req.params.id)) return fail(res, 404, 'NOT_FOUND', 'Application not found.');
    res.json({ data: await staff.reviews(req.params.id) });
  });
  app.use('/api/admin', authenticate, available, requireStaff);
  app.get('/api/admin/applications', async (req, res) => {
    const { status = 'submitted', search = '', limit = '25', offset = '0' } = req.query;
    if (Object.keys(req.query).some(key => !['status', 'search', 'limit', 'offset'].includes(key))
      || !['', 'submitted', 'approved', 'rejected'].includes(status)
      || typeof search !== 'string' || search.length > 200
      || typeof limit !== 'string' || !/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100
      || typeof offset !== 'string' || !/^\d+$/.test(offset) || !Number.isSafeInteger(Number(offset))) {
      return fail(res, 400, 'INVALID_QUERY', 'Use a valid status, search, limit (1–100), and offset.');
    }
    const result = await staff.list({ status, search: search.trim(), limit: Number(limit), offset: Number(offset) });
    res.json({ data: result.rows, hasMore: result.hasMore });
  });
  app.get('/api/admin/applications/:id', validId, async (req, res) => {
    if (!applicationFiles || !applicationAnalyses) return fail(res, 503, 'STAFF_UNAVAILABLE', 'Document review is unavailable.');
    const record = await staff.get(req.params.id);
    if (!record) return fail(res, 404, 'NOT_FOUND', 'Submitted application not found.');
    const { owner_id: owner, ...application } = record;
    const [files, analyses, requirements, reviews] = await Promise.all([
      applicationFiles.listFiles(owner, record.id),
      applicationAnalyses.latest(owner, record.id, record.document_type_id),
      catalogue.requirements(record.document_type_id), staff.reviews(record.id),
    ]);
    if (!requirements) return fail(res, 503, 'STAFF_UNAVAILABLE', 'Requirements are unavailable.');
    res.json({ data: { application, files, checklist: applicationChecklist(requirements.requirements, analyses), reviews } });
  });
  app.get('/api/admin/applications/:id/files/:fileId', validId, async (req, res) => {
    if (!applicationFiles) return fail(res, 503, 'FILES_UNAVAILABLE', 'Files are unavailable.');
    const record = await staff.get(req.params.id);
    if (!record) return fail(res, 404, 'NOT_FOUND', 'Submitted application not found.');
    const file = await applicationFiles.getFile(record.owner_id, record.id, req.params.fileId);
    if (!file) return fail(res, 404, 'NOT_FOUND', 'File not found.');
    const safeName = encodeURIComponent(file.original_name).replace(/['()]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    res.set({ 'Content-Type': file.media_type, 'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename*=UTF-8''${safeName}`, 'X-Content-Type-Options': 'nosniff' }).send(Buffer.from(file.content));
  });
  app.post('/api/admin/applications/:id/reviews', validId, express.json({ limit: '16kb' }), async (req, res) => {
    const body = req.body;
    if (!body || Array.isArray(body) || Object.keys(body).some(key => !['decision', 'note'].includes(key))
      || !['approved', 'rejected'].includes(body.decision) || typeof body.note !== 'string'
      || !body.note.trim() || body.note.trim().length > 2000) {
      return fail(res, 400, 'INVALID_BODY', 'Provide an approve/reject decision and a note of 1–2000 characters.');
    }
    const application = await staff.get(req.params.id);
    if (!application) return fail(res, 404, 'NOT_FOUND', 'Submitted application not found.');
    if (application.owner_id === req.userId) return fail(res, 403, 'SELF_REVIEW_FORBIDDEN', 'Another staff member must review your application.');
    const review = await staff.review(req.userId, req.params.id, body.decision, body.note.trim());
    if (!review) return fail(res, 409, 'REVIEW_CONFLICT', 'This application was already reviewed or your access changed. Refresh before continuing.');
    res.status(201).json({ data: review });
  });
}
