const applicationColumns = `
  a.id, a.document_type_id, dt.name AS document_type_name,
  a.purpose, a.status, a.created_at, a.updated_at
`;

export function applicationsRepository(db) {
  async function get(ownerId, id) {
    const { rows } = await db.query(`
      SELECT ${applicationColumns}
      FROM public.applications a
      JOIN public.document_types dt ON dt.id = a.document_type_id
      WHERE a.owner_id = $1 AND a.id = $2
    `, [ownerId, id]);
    return rows[0] ?? null;
  }

  return {
    async list(ownerId, { limit = 50, offset = 0 } = {}) {
      const { rows } = await db.query(`
        SELECT ${applicationColumns}
        FROM public.applications a
        JOIN public.document_types dt ON dt.id = a.document_type_id
        WHERE a.owner_id = $1
        ORDER BY a.updated_at DESC, a.id LIMIT $2 OFFSET $3
      `, [ownerId, limit, offset]);
      return rows;
    },

    get,

    async create(ownerId, documentTypeId, purpose) {
      const { rows } = await db.query(`
        INSERT INTO public.applications (owner_id, document_type_id, purpose)
        SELECT $1, dt.id, $3
        FROM public.document_types dt
        WHERE dt.id = $2 AND dt.is_active = true
        RETURNING id
      `, [ownerId, documentTypeId, purpose]);
      return rows[0] ? get(ownerId, rows[0].id) : null;
    },

  };
}
