export function privateDataRepository(db) {
  return {
    async getApplication(ownerId, applicationId) {
      const { rows } = await db.query(`
        SELECT id, document_type_id, status
        FROM public.applications
        WHERE owner_id = $1 AND id = $2
      `, [ownerId, applicationId]);
      return rows[0] ?? null;
    },

    async listFiles(ownerId, applicationId) {
      const { rows } = await db.query(`
        SELECT id, application_id, original_name, media_type, octet_length(content) AS size, created_at
        FROM public.application_files
        WHERE owner_id = $1 AND application_id = $2
        ORDER BY created_at, id
      `, [ownerId, applicationId]);
      return rows;
    },

    async createFile(ownerId, applicationId, file) {
      const { rows } = await db.query(`
        INSERT INTO public.application_files
          (owner_id, application_id, original_name, media_type, content)
        SELECT $1, a.id, $3, $4, $5
        FROM public.applications a
        WHERE a.owner_id = $1 AND a.id = $2 AND a.status = 'draft'
        RETURNING id, application_id, original_name, media_type,
          octet_length(content) AS size, created_at
      `, [ownerId, applicationId, file.originalName, file.mediaType, file.content]);
      return rows[0] ?? null;
    },

    async getFile(ownerId, applicationId, fileId) {
      const { rows } = await db.query(`
        SELECT id, application_id, original_name, media_type,
          octet_length(content) AS size, content, created_at
        FROM public.application_files
        WHERE owner_id = $1 AND application_id = $2 AND id = $3
      `, [ownerId, applicationId, fileId]);
      return rows[0] ?? null;
    },

    async deleteFile(ownerId, applicationId, fileId) {
      const { rows } = await db.query(`
        DELETE FROM public.application_files f
        USING public.applications a
        WHERE f.owner_id = $1 AND f.application_id = $2 AND f.id = $3
          AND a.id = f.application_id AND a.owner_id = f.owner_id AND a.status = 'draft'
        RETURNING f.id
      `, [ownerId, applicationId, fileId]);
      return Boolean(rows[0]);
    },

    async getAnalysisFile(ownerId, applicationId, fileId) {
      const { rows } = await db.query(`
        SELECT f.id, f.original_name, f.media_type, f.content, a.document_type_id
        FROM public.application_files f
        JOIN public.applications a ON a.id = f.application_id AND a.owner_id = f.owner_id
        WHERE f.owner_id = $1 AND f.application_id = $2 AND f.id = $3
          AND a.status = 'draft'
      `, [ownerId, applicationId, fileId]);
      return rows[0] ?? null;
    },

    async createAnalysis(ownerId, applicationId, fileId, model, maxPerHour) {
      const { rows } = await db.query(`
        WITH owner_lock AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(hashtextextended($1::uuid::text, 86947))
        ), eligible AS MATERIALIZED (
          SELECT a.id
          FROM public.applications a
          JOIN public.application_files f ON f.application_id = a.id AND f.owner_id = a.owner_id
          CROSS JOIN owner_lock
          WHERE a.owner_id = $1 AND a.id = $2 AND a.status = 'draft' AND f.id = $3
            AND (SELECT count(*) FROM public.application_analyses recent
              WHERE recent.owner_id = $1 AND recent.created_at > now() - interval '1 hour') < $5
        )
        INSERT INTO public.application_analyses
          (owner_id, application_id, file_id, model)
        SELECT $1, eligible.id, $3, $4 FROM eligible
        RETURNING id, application_id, file_id, model, status, result, error_code,
          created_at, completed_at
      `, [ownerId, applicationId, fileId, model, maxPerHour]);
      return rows[0] ?? null;
    },

    async completeAnalysis(ownerId, analysisId, result) {
      const { rows } = await db.query(`
        UPDATE public.application_analyses
        SET status = 'completed', result = $3, completed_at = now()
        WHERE owner_id = $1 AND id = $2 AND status = 'pending'
        RETURNING id, application_id, file_id, model, status, result, error_code,
          created_at, completed_at
      `, [ownerId, analysisId, result]);
      return rows[0] ?? null;
    },

    async failAnalysis(ownerId, analysisId, errorCode) {
      const { rows } = await db.query(`
        UPDATE public.application_analyses
        SET status = 'failed', error_code = $3, completed_at = now()
        WHERE owner_id = $1 AND id = $2 AND status = 'pending'
        RETURNING id, application_id, file_id, model, status, result, error_code,
          created_at, completed_at
      `, [ownerId, analysisId, errorCode]);
      return rows[0] ?? null;
    },

    async listAnalyses(ownerId, applicationId) {
      const { rows } = await db.query(`
        SELECT id, application_id, file_id, model, status, result, error_code,
          created_at, completed_at
        FROM public.application_analyses
        WHERE owner_id = $1 AND application_id = $2
        ORDER BY created_at DESC, id
      `, [ownerId, applicationId]);
      return rows;
    },

    async getAnalysis(ownerId, applicationId, analysisId) {
      const { rows } = await db.query(`
        SELECT id, application_id, file_id, model, status, result, error_code,
          created_at, completed_at
        FROM public.application_analyses
        WHERE owner_id = $1 AND application_id = $2 AND id = $3
      `, [ownerId, applicationId, analysisId]);
      return rows[0] ?? null;
    },
  };
}
