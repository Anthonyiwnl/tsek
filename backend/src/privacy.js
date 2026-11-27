export function privacyRepository(db, { enabled = false, retentionDays, logger = console } = {}) {
  if (enabled && (!Number.isSafeInteger(retentionDays) || retentionDays < 1 || retentionDays > 365)) throw new Error('Choose a reviewed file retention period of 1–365 days.');
  // Changing the retention policy requires fresh consent before another upload.
  const version = `privacy-v1-${retentionDays ?? 'unconfigured'}`;
  return {
    enabled,
    policy: { enabled, retentionDays: retentionDays ?? null, version },
    async consented(owner) {
      if (!enabled) return true;
      const { rows } = await db.query('SELECT 1 FROM public.privacy_consents WHERE owner_id = $1 AND policy_version = $2', [owner, version]);
      return rows.length > 0;
    },
    async consent(owner) {
      await db.query(`INSERT INTO public.privacy_consents(owner_id, policy_version) VALUES ($1,$2)
        ON CONFLICT (owner_id) DO UPDATE SET policy_version = $2, accepted_at = clock_timestamp()`, [owner, version]);
    },
    async erase(owner, id) {
      const { rows } = await db.query('DELETE FROM public.applications WHERE owner_id = $1 AND id = $2 RETURNING id', [owner, id]);
      return rows.length > 0;
    },
    async expireFiles() {
      if (!enabled) return 0;
      try {
        const { rows } = await db.query(`DELETE FROM public.application_files WHERE id IN (
          SELECT f.id FROM public.application_files f JOIN public.applications a ON a.id = f.application_id AND a.owner_id = f.owner_id
          WHERE a.status IN ('approved','rejected') AND EXISTS (
            SELECT 1 FROM public.application_reviews r WHERE r.application_id = a.id
            GROUP BY r.application_id HAVING max(r.created_at) <= now() - make_interval(days => $1::integer))
          ORDER BY f.created_at, f.id LIMIT 100
        ) RETURNING id`, [retentionDays]);
        return rows.length;
      } catch { logger.error({ event: 'file_retention_failed' }); return 0; }
    },
  };
}
