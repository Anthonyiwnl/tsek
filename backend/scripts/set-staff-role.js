import { runTask } from './run-task.js';

// Operator-only provisioning. No email-derived privileges or browser role writes.
const [userId, role] = process.argv.slice(2);
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '')
  || !['staff', 'admin', 'citizen'].includes(role) || process.argv.length !== 4) {
  console.error('Usage: npm run staff:role -- <verified-Neon-user-UUID> <staff|admin|citizen>');
  process.exitCode = 1;
} else {
  await runTask(async client => {
    // Require an existing identity; never create credentials or guessed accounts.
    const { rows } = await client.query('SELECT id FROM neon_auth."user" WHERE id::text = $1', [userId]);
    if (!rows.length) throw new Error('Auth identity not found');
    if (role === 'citizen') {
      await client.query('DELETE FROM public.staff_roles WHERE user_id = $1', [userId]);
    } else {
      await client.query(`INSERT INTO public.staff_roles (user_id, role) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, assigned_at = now()`, [userId, role]);
    }
  });
}
