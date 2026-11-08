async function uploadTransaction(pool, work) {
  const client = await pool.connect();
  let rollbackError;
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (failure) {
      rollbackError = failure;
    }
    throw error;
  } finally {
    client.release(rollbackError);
  }
}

export function applicationFilesRepository(db, transaction = (work) => uploadTransaction(db, work)) {
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
        SELECT id, application_id, original_name, media_type, revision, analysis_generation, octet_length(content) AS size, created_at
        FROM public.application_files
        WHERE owner_id = $1 AND application_id = $2
        ORDER BY created_at, id
      `, [ownerId, applicationId]);
      return rows;
    },

    async createFile(ownerId, applicationId, file) {
      return transaction(async (client) => {
        // Lock first so the next statement counts any upload that committed while we waited.
        const { rows: drafts } = await client.query(`
          SELECT id FROM public.applications
          WHERE owner_id = $1 AND id = $2 AND status = 'draft'
          FOR NO KEY UPDATE
        `, [ownerId, applicationId]);
        if (!drafts.length) return null;
        const { rows } = await client.query(`
          INSERT INTO public.application_files
            (owner_id, application_id, original_name, media_type, content)
          SELECT a.owner_id, a.id, $3, $4, $5
          FROM public.applications a
          WHERE a.owner_id = $1 AND a.id = $2 AND a.status = 'draft'
            AND (SELECT count(*) FROM public.application_files f
              WHERE f.application_id = a.id AND f.owner_id = a.owner_id) < 10
          RETURNING id, application_id, original_name, media_type, revision, analysis_generation,
            octet_length(content) AS size, created_at
        `, [ownerId, applicationId, file.originalName, file.mediaType, file.content]);
        return rows[0] ?? null;
      });
    },

    async replaceFile(ownerId, applicationId, fileId, revision, file) {
      const { rows } = await db.query(`
        WITH draft AS MATERIALIZED (
          SELECT id, owner_id FROM public.applications
          WHERE owner_id = $1 AND id = $2 AND status = 'draft' FOR SHARE
        )
        UPDATE public.application_files f
        SET original_name = $5, media_type = $6, content = $7,
          revision = revision + 1, analysis_generation = analysis_generation + 1
        FROM draft
        WHERE f.owner_id = draft.owner_id AND f.application_id = draft.id
          AND f.id = $3 AND f.revision = $4
        RETURNING f.id, f.application_id, f.original_name, f.media_type,
          f.revision, f.analysis_generation, octet_length(f.content) AS size, f.created_at
      `, [ownerId, applicationId, fileId, revision, file.originalName, file.mediaType, file.content]);
      return rows[0] ?? null;
    },

    async getFile(ownerId, applicationId, fileId) {
      const { rows } = await db.query(`
        SELECT id, application_id, original_name, media_type, revision, analysis_generation,
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
