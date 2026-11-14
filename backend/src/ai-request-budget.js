const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

function readWindow(now, duration, previousStart, previousCount, limit) {
  const previousStartMs = previousStart?.getTime() ?? -Infinity;
  const start = Math.max(Math.floor(now / duration) * duration, previousStartMs);
  const count = start === previousStartMs ? previousCount : 0;
  return { start: new Date(start), count, exhaustedUntil: count >= limit ? start + duration : 0 };
}

/**
 * Charge one admission across both AI routes before a provider call. The provider
 * may make up to two attempts for that admission. Rejected requests cost nothing.
 */
export function createAiRequestBudget(pool) {
  return async function consumeAiBudget(userId) {
    const client = await pool.connect();
    let rollbackError;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      // Every claim locks the global row first. The next statement sees any
      // user and global counts that committed while it waited for the lock.
      const { rows: locked } = await client.query(`
        SELECT singleton FROM public.ai_request_hourly_budget WHERE singleton FOR UPDATE
      `);
      if (!locked.length) throw new Error('The shared AI budget row is missing.');

      const { rows: [current] } = await client.query(`
        SELECT clock_timestamp() AS checked_at, hourly.hour_start, hourly.request_count,
          budgets.minute_start, budgets.minute_count, budgets.day_start, budgets.day_count
        FROM public.ai_request_hourly_budget hourly
        LEFT JOIN public.ai_request_user_budgets budgets ON budgets.user_id = $1
        WHERE hourly.singleton
      `, [userId]);
      const checkedAt = current.checked_at.getTime();
      const now = Math.max(checkedAt, current.hour_start.getTime());
      const hour = readWindow(now, hourMs, current.hour_start, current.request_count, 60);
      const minute = readWindow(now, minuteMs, current.minute_start, current.minute_count, 3);
      const day = readWindow(now, dayMs, current.day_start, current.day_count, 20);
      const blockedUntil = Math.max(hour.exhaustedUntil, minute.exhaustedUntil, day.exhaustedUntil);
      if (blockedUntil > checkedAt) {
        await client.query('COMMIT');
        return { allowed: false, retryAfterSeconds: Math.ceil((blockedUntil - checkedAt) / 1000) };
      }

      // Prune expired daily rows once at rollover. The global cap bounds the
      // table to the distinct users admitted during a single UTC day.
      if (day.start > current.hour_start) {
        await client.query('DELETE FROM public.ai_request_user_budgets WHERE day_start < $1', [day.start]);
      }
      await client.query(`
        WITH charged AS (
          UPDATE public.ai_request_hourly_budget
          SET hour_start = $2, request_count = $3
          WHERE singleton
          RETURNING singleton
        )
        INSERT INTO public.ai_request_user_budgets (user_id, minute_start, minute_count, day_start, day_count)
        SELECT $1::uuid, $4::timestamptz, $5::integer, $6::timestamptz, $7::integer FROM charged
        ON CONFLICT (user_id) DO UPDATE SET
          minute_start = EXCLUDED.minute_start, minute_count = EXCLUDED.minute_count,
          day_start = EXCLUDED.day_start, day_count = EXCLUDED.day_count
      `, [userId, hour.start, hour.count + 1, minute.start, minute.count + 1, day.start, day.count + 1]);
      await client.query('COMMIT');
      return { allowed: true };
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
  };
}
