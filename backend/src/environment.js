import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

// Existing process variables win; component overrides precede Neon root settings.
for (const relative of ['../.env', '../.env.local', '../../.env', '../../.env.local']) {
  const path = fileURLToPath(new URL(relative, import.meta.url));
  if (existsSync(path)) loadEnvFile(path);
}
