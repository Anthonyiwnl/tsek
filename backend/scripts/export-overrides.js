import { createPool } from '../src/db.js';
import { anonymizeReviews } from '../src/requirement-reviews.js';

const pool = createPool();
try {
  const { rows } = await pool.query(`SELECT ai_status, staff_status, prompt_version FROM public.requirement_reviews
    WHERE ai_status <> staff_status ORDER BY created_at, id`);
  process.stdout.write(JSON.stringify(anonymizeReviews(rows), null, 2) + '\n');
} catch { console.error('Override export failed. No data was exported.'); process.exitCode = 1; }
finally { await pool.end(); }
