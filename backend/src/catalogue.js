export function catalogueRepository(db) {
  return {
    async list() {
      const { rows } = await db.query(`
        SELECT id, name, description FROM public.document_types
        WHERE is_active = true ORDER BY name, id
      `);
      return rows;
    },
    async requirements(id) {
      const { rows } = await db.query(`
        SELECT dt.id, dt.name, dt.description,
          COALESCE(jsonb_agg(jsonb_build_object(
            'id', dr.id, 'name', dr.name, 'description', dr.description,
            'accepted_document_types', dr.accepted_document_types,
            'is_required', dr.is_required, 'sort_order', dr.sort_order
          ) ORDER BY dr.sort_order, dr.name, dr.id)
          FILTER (WHERE dr.id IS NOT NULL), '[]'::jsonb) AS requirements
        FROM public.document_types dt
        LEFT JOIN public.document_requirements dr ON dr.document_type_id = dt.id
        WHERE dt.id = $1 AND dt.is_active = true
        GROUP BY dt.id
      `, [id]);
      return rows[0] ?? null;
    },
    async services() {
      const { rows } = await db.query(`
        SELECT dt.id, dt.name, COALESCE(dt.description, '') AS description,
          COALESCE(jsonb_agg(jsonb_build_object(
            'id', dr.id, 'name', dr.name, 'is_required', dr.is_required
          ) ORDER BY dr.sort_order, dr.name, dr.id)
          FILTER (WHERE dr.id IS NOT NULL), '[]'::jsonb) AS requirements
        FROM public.document_types dt
        LEFT JOIN public.document_requirements dr ON dr.document_type_id = dt.id
        WHERE dt.is_active = true
        GROUP BY dt.id ORDER BY dt.name, dt.id
      `);
      return rows;
    },
    async ready() { await db.query('SELECT 1'); },
  };
}
