export function applicationFilesRepository(db) {
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
        FOR SHARE OF a
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
        WITH draft AS MATERIALIZED (
          SELECT id, owner_id FROM public.applications
          WHERE owner_id = $1 AND id = $2 AND status = 'draft'
          FOR SHARE
        )
        DELETE FROM public.application_files f
        USING draft
        WHERE f.owner_id = draft.owner_id AND f.application_id = draft.id AND f.id = $3
        RETURNING f.id
      `, [ownerId, applicationId, fileId]);
      return Boolean(rows[0]);
    },
  };
}
