export function emailDailyLimit(enabled, value) {
  if (!enabled) return 20;
  const limit = Number(value || 20);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Email daily limit must be 1–100.');
  return limit;
}

export function createEmailProvider({ apiKey, from, applicationOrigin, fetchImpl = fetch }) {
  const url = new URL(applicationOrigin);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Email links require a trusted HTTPS application origin.');
  return async row => {
    const reference = `TSK-${row.application_id.slice(0, 6).toUpperCase()}`;
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `decision/${row.review_id}` },
      body: JSON.stringify({ from, to: [row.recipient], subject: `TSEK ${reference}: ${row.decision === 'approved' ? 'Approved' : 'Not approved'}`,
        text: `${reference}\nResult: ${row.decision === 'approved' ? 'Approved' : 'Not approved'}\nStaff note: ${row.note}\n\nView your application: ${url.origin}/#/applications/${row.application_id}\n\nYou can turn decision emails off in your TSEK account.` }),
    });
    if (!response.ok) throw new Error('Email provider unavailable');
    const payload = await response.json();
    if (typeof payload?.id !== 'string' || !payload.id) throw new Error('Invalid email provider response');
  };
}

export function decisionEmailsRepository(db, transaction, { send, dailyLimit = 20, logger = console } = {}) {
  if (!Number.isSafeInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100) throw new Error('Email daily limit must be 1–100.');
  let running = false;
  return {
    async preference(owner) {
      const { rows } = await db.query('SELECT enabled FROM public.notification_preferences WHERE owner_id = $1', [owner]);
      return rows[0] ?? { enabled: false };
    },
    async savePreference(owner, enabled, verifiedEmail) {
      if (enabled && !verifiedEmail) return null;
      const { rows } = await db.query(`INSERT INTO public.notification_preferences(owner_id, enabled, verified_email)
        VALUES ($1,$2,$3) ON CONFLICT (owner_id) DO UPDATE SET enabled = $2, verified_email = $3 RETURNING enabled`, [owner, enabled, verifiedEmail]);
      return rows[0];
    },
    async tick() {
      if (!send || running) return;
      running = true;
      let row;
      try {
        row = await transaction(async client => {
          // Shared with every worker, across processes and restarts.
          await client.query('SELECT pg_advisory_xact_lock(342010)');
          await client.query(`UPDATE public.decision_email_outbox SET state = 'failed'
            WHERE state IN ('queued','processing') AND (created_at < now() - interval '23 hours' OR attempts >= 3)`);
          const { rows: [candidate] } = await client.query(`SELECT o.review_id, o.recipient, r.application_id, r.decision, r.note
            FROM public.decision_email_outbox o JOIN public.application_reviews r ON r.id = o.review_id
            WHERE o.next_attempt_at <= now() AND (o.state = 'queued' OR (o.state = 'processing' AND o.locked_at < now() - interval '2 minutes'))
            ORDER BY o.created_at, o.review_id LIMIT 1 FOR UPDATE OF o SKIP LOCKED`);
          if (!candidate) return null;
          const { rows: [allowed] } = await client.query(`SELECT 1 FROM public.applications a
            JOIN public.notification_preferences p ON p.owner_id = a.owner_id
            WHERE a.id = $1 AND p.enabled AND p.verified_email = $2`, [candidate.application_id, candidate.recipient]);
          if (!allowed) { await client.query("UPDATE public.decision_email_outbox SET state = 'skipped' WHERE review_id = $1", [candidate.review_id]); return null; }
          const { rows: budget } = await client.query(`INSERT INTO public.email_daily_budget(day, attempts) VALUES ((now() AT TIME ZONE 'UTC')::date, 1)
            ON CONFLICT (day) DO UPDATE SET attempts = email_daily_budget.attempts + 1
            WHERE email_daily_budget.attempts < $1 RETURNING attempts`, [dailyLimit]);
          if (!budget.length) return null;
          await client.query("UPDATE public.decision_email_outbox SET state = 'processing', locked_at = now(), attempts = attempts + 1 WHERE review_id = $1", [candidate.review_id]);
          return candidate;
        });
        if (!row) return;
        await send(row);
        await db.query("UPDATE public.decision_email_outbox SET state = 'sent' WHERE review_id = $1", [row.review_id]);
      } catch {
        // Never print provider messages, email addresses or staff notes.
        logger.error({ event: 'decision_email_failed' });
        if (row) await db.query(`UPDATE public.decision_email_outbox SET state = 'queued',
          next_attempt_at = now() + interval '5 minutes' * attempts WHERE review_id = $1`, [row.review_id]).catch(() => {});
      } finally { running = false; }
    },
  };
}
