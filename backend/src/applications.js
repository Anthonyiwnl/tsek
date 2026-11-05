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
    async list(ownerId) {
      const { rows } = await db.query(`
        SELECT ${applicationColumns}
        FROM public.applications a
        JOIN public.document_types dt ON dt.id = a.document_type_id
        WHERE a.owner_id = $1
        ORDER BY a.updated_at DESC, a.id
      `, [ownerId]);
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

    async update(ownerId, id, changes) {
      const fields = [];
      const values = [id, ownerId];
      if (Object.hasOwn(changes, 'document_type_id')) {
        values.push(changes.document_type_id);
        fields.push(`document_type_id = $${values.length}`);
      }
      if (Object.hasOwn(changes, 'purpose')) {
        values.push(changes.purpose);
        fields.push(`purpose = $${values.length}`);
      }
      fields.push('updated_at = now()');
      const typeCondition = Object.hasOwn(changes, 'document_type_id')
        ? `AND EXISTS (
            SELECT 1 FROM public.document_types dt
            WHERE dt.id = $3 AND dt.is_active = true
          )`
        : '';
      const { rows } = await db.query(`
        UPDATE public.applications AS a
        SET ${fields.join(', ')}
        WHERE a.id = $1 AND a.owner_id = $2 AND a.status = 'draft'
        ${typeCondition}
        RETURNING a.id
      `, values);
      if (!rows[0]) {
        const current = await get(ownerId, id);
        return {
          updated: false,
          current,
        };
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
