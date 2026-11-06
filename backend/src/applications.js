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
        SELECT ${applicationColumns},
          EXISTS (
            SELECT 1
            FROM public.applications more
            WHERE more.owner_id = $1
            ORDER BY more.updated_at DESC, more.id
            OFFSET ($2::integer + $3::integer)
            LIMIT 1
          ) AS has_more
        FROM public.applications a
        JOIN public.document_types dt ON dt.id = a.document_type_id
        WHERE a.owner_id = $1
        ORDER BY a.updated_at DESC, a.id
        LIMIT $2 OFFSET $3
      `, [ownerId, limit, offset]);
      return {
        rows: rows.map(({ has_more: _hasMore, ...application }) => application),
        hasMore: rows[0]?.has_more ?? false,
      };
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

    async update(ownerId, id, changes) {
      const values = [id, ownerId];
      const assignments = [];
      if (Object.hasOwn(changes, 'document_type_id')) {
        values.push(changes.document_type_id);
        assignments.push(`document_type_id = $${values.length}`);
      }
      if (Object.hasOwn(changes, 'purpose')) {
        values.push(changes.purpose);
        assignments.push(`purpose = $${values.length}`);
      }
      assignments.push('updated_at = now()');

      const activeDocumentType = Object.hasOwn(changes, 'document_type_id')
        ? `AND EXISTS (
            SELECT 1 FROM public.document_types dt
            WHERE dt.id = $3 AND dt.is_active = true
          )`
        : '';
      const { rows } = await db.query(`
        UPDATE public.applications AS a
        SET ${assignments.join(', ')}
        WHERE a.id = $1 AND a.owner_id = $2 AND a.status = 'draft'
        ${activeDocumentType}
        RETURNING a.id
      `, values);
      if (!rows[0]) {
        return { updated: false, current: await get(ownerId, id) };
      }
      return { updated: true, application: await get(ownerId, id) };
    },

    async deleteDraft(ownerId, id) {
      const { rows } = await db.query(`
        DELETE FROM public.applications
        WHERE owner_id = $1 AND id = $2 AND status = 'draft'
        RETURNING id
      `, [ownerId, id]);
      if (rows[0]) return { deleted: true };
      const current = await get(ownerId, id);
      return current ? { deleted: false, current } : null;
    },

  };
}
