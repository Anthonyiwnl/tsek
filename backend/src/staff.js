// This deployment serves one barangay. Only explicitly assigned staff can read
// submitted records across owners. Citizen repositories retain owner scoping.
import { requirementReviewsRepository } from './requirement-reviews.js';

export function staffRepository(db, transaction = async work => {
  const client = await db.connect();
  let rollbackError;
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (failure) { rollbackError = failure; }
    throw error;
  } finally { client.release(rollbackError); }
}) {
  return {
    requirementReviews: requirementReviewsRepository(db, transaction),
    async role(userId) {
      const { rows } = await db.query('SELECT role FROM public.staff_roles WHERE user_id = $1', [userId]);
      return rows[0]?.role ?? 'citizen';
    },
    async list({ status, search, limit, offset }) {
      const ticketPrefix = /^(?:TSK-)?([0-9a-f]{6})$/i.exec(search)?.[1].toLowerCase() ?? null;
      const { rows } = await db.query(`
        SELECT a.id, a.document_type_id, dt.name AS document_type_name,
          a.purpose, a.status, a.created_at, a.updated_at
        FROM public.applications a JOIN public.document_types dt ON dt.id = a.document_type_id
        WHERE a.status <> 'draft' AND ($1::text = '' OR a.status = $1)
          AND CASE
            WHEN $5::text IS NULL THEN
              $2::text = '' OR strpos(lower(dt.name || ' ' || a.purpose || ' ' || a.id::text), lower($2)) > 0
            ELSE
              left(a.id::text, 6) = $5
              OR (lower($2) = $5 AND strpos(lower(dt.name || ' ' || a.purpose), $5) > 0)
          END
        ORDER BY a.updated_at ASC, a.id ASC LIMIT $3 OFFSET $4
      `, [status, search, limit + 1, offset, ticketPrefix]);
      return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
    },
    async get(id) {
      const { rows } = await db.query(`
        SELECT a.id, a.owner_id, a.document_type_id, dt.name AS document_type_name,
          a.purpose, a.status, a.created_at, a.updated_at
        FROM public.applications a JOIN public.document_types dt ON dt.id = a.document_type_id
        WHERE a.id = $1 AND a.status <> 'draft'
      `, [id]);
      return rows[0] ?? null;
    },
    async reviews(id) {
      const { rows } = await db.query(`SELECT id, decision, note, created_at
        FROM public.application_reviews WHERE application_id = $1 ORDER BY created_at, id`, [id]);
      return rows;
    },
    async history(id, ownerId = null) {
      const { rows } = await db.query(`SELECT h.id, h.event, h.prompt_version, h.created_at,
          CASE WHEN $2::uuid IS NULL THEN h.actor_id ELSE NULL END AS actor_id
        FROM public.application_history h JOIN public.applications a ON a.id = h.application_id
        WHERE a.id = $1 AND ($2::uuid IS NULL OR a.owner_id = $2)
          AND ($2::uuid IS NULL OR h.event <> 'requirement_reviewed')
        ORDER BY h.created_at, h.id`, [id, ownerId]);
      return ownerId ? rows.map(({ actor_id: _actor, ...event }) => event) : rows;
    },
    async submit(ownerId, id) {
      return transaction(async client => {
        // Match file mutations' application lock, then read a fresh statement
        // snapshot so a concurrent last-file deletion cannot pass submission.
        const locked = await client.query(`SELECT id FROM public.applications
          WHERE id = $1 AND owner_id = $2 AND status = 'draft' FOR NO KEY UPDATE`, [id, ownerId]);
        if (!locked.rows.length) return null;
        const { rows } = await client.query(`
        UPDATE public.applications a SET status = 'submitted', updated_at = now()
        WHERE a.id = $1 AND a.owner_id = $2 AND a.status = 'draft'
          AND length(btrim(a.purpose)) > 0
          AND EXISTS (SELECT 1 FROM public.document_types dt WHERE dt.id = a.document_type_id AND dt.is_active)
          AND EXISTS (SELECT 1 FROM public.application_files f WHERE f.application_id = a.id AND f.owner_id = a.owner_id)
        RETURNING a.id, a.status
      `, [id, ownerId]);
        return rows[0] ?? null;
      });
    },
    async review(userId, id, decision, note) {
      // Conditional UPDATE prevents two reviewers from overwriting a decision.
      // The audit row and status change are a single atomic statement.
      const { rows } = await db.query(`
        WITH changed AS (
          UPDATE public.applications a SET status = $3, updated_at = now()
          WHERE a.id = $2 AND a.status = 'submitted' AND a.owner_id <> $1
            AND EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = $1 AND role IN ('staff', 'admin'))
          RETURNING a.id
        )
        INSERT INTO public.application_reviews (application_id, reviewer_id, decision, note)
        SELECT id, $1, $3, $4 FROM changed RETURNING id, decision, note, created_at
      `, [userId, id, decision, note]);
      return rows[0] ?? null;
    },
  };
}
