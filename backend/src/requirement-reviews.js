import { applicationChecklist } from './application-analyses.js';

export function requirementReviewsRepository(db, transaction) {
  return {
    async record(reviewer, applicationId, requirementId, status, reason) {
      return transaction(async client => {
        const { rows: [app] } = await client.query(`SELECT id, owner_id, document_type_id FROM public.applications
          WHERE id = $1 AND status = 'submitted' AND owner_id <> $2
          AND EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = $2 AND role IN ('staff', 'admin'))
          FOR NO KEY UPDATE`, [applicationId, reviewer]);
        if (!app) return null;
        const { rows: requirements } = await client.query('SELECT * FROM public.document_requirements WHERE document_type_id = $1', [app.document_type_id]);
        const { rows: analyses } = await client.query(`SELECT DISTINCT ON (file_id) file_id, result, normalized_result, error_code, metadata
          FROM public.application_analyses WHERE application_id = $1 AND owner_id = $2 AND document_type_id = $3
          ORDER BY file_id, created_at DESC, id DESC`, [applicationId, app.owner_id, app.document_type_id]);
        const item = applicationChecklist(requirements, analyses).requirements.find(row => row.id === requirementId);
        if (!item) return null;
        if (status !== item.status && !reason.trim()) return { error: 'OVERRIDE_REASON_REQUIRED' };
        const prompt = analyses.find(row => row.file_id === item.file_id)?.metadata?.promptVersion
          ?? ([...new Set(analyses.map(row => row.metadata?.promptVersion).filter(Boolean))].join(', ') || null);
        const { rows } = await client.query(`INSERT INTO public.requirement_reviews
          (application_id, requirement_id, reviewer_id, ai_status, staff_status, reason, prompt_version)
          VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (application_id, requirement_id) DO NOTHING
          RETURNING id, requirement_id, ai_status, staff_status, reason, prompt_version, created_at`,
        [applicationId, requirementId, reviewer, item.status, status, reason.trim(), prompt]);
        return rows[0] ?? null;
      });
    },
    async list(applicationId) {
      const { rows } = await db.query(`SELECT id, requirement_id, ai_status, staff_status, reason, prompt_version, created_at
        FROM public.requirement_reviews WHERE application_id = $1 ORDER BY created_at, id`, [applicationId]);
      return rows;
    },
  };
}

export async function agreementByWeek(db) {
  const { rows } = await db.query(`SELECT to_char(date_trunc('week', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS week,
    count(*)::integer AS reviewed, count(*) FILTER (WHERE ai_status = staff_status)::integer AS agreed
    FROM public.requirement_reviews WHERE created_at >= now() - interval '12 weeks'
    GROUP BY 1 ORDER BY 1`);
  return rows.map(row => ({ ...row, agreementRate: row.reviewed ? row.agreed / row.reviewed : null }));
}

// Free-text reasons may contain personal data. Never export them or identities.
export function anonymizeReviews(rows) {
  return { candidates: rows.map((row, index) => ({ id: `override-candidate-${index + 1}`, kind: 'requirement-review',
    ai_status: row.ai_status, staff_status: row.staff_status, prompt_version: row.prompt_version })) };
}
