import { APP_ROLE, grantAppRole } from './app-role.js';
import { runTask } from './run-task.js';

// Operator-only. Uses the owner connection (DIRECT_DATABASE_URL) to create or
// update the API's least-privilege role. The password comes from the
// environment so it never lands in a file or shell history (#292).
await runTask((client) => grantAppRole(client, { role: APP_ROLE, password: process.env.APP_DB_PASSWORD }));
