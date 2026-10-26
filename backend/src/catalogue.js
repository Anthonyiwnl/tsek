/**
 * Create read operations for the public document catalogue.
 * @param {object} db - Database client or pool exposing a PostgreSQL query method.
 * @returns {object} Catalogue queries and a database readiness probe.
 */
export function catalogueRepository(db) {
  return {
    /** Return active document types ordered by name and ID. */
    async list() {
      const { rows } = await db.query(`
        SELECT id, name, description FROM public.document_types
        WHERE is_active = true ORDER BY name, id
      `);
      return rows;
    },
    /**
     * Return an active type with ordered requirements, or null if missing or inactive.
     * @param {string} id - Document type UUID.
     * @returns {Promise<object|null>} The type, with an empty requirements array when none exist.
     */
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
    /** Return active types with requirement summaries and empty strings for null descriptions. */
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
    /** Probe database connectivity, rejecting if the query fails. */
    async ready() { await db.query('SELECT 1'); },
  };
}
