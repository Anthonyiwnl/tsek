import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

// Non-empty process variables win; component overrides precede Neon root settings.
for (const relative of ['../.env.local', '../.env', '../../.env.local', '../../.env']) {
  const path = fileURLToPath(new URL(relative, import.meta.url));
  if (existsSync(path)) {
    // Empty placeholders from the process or earlier files can be filled later.
    for (const key of Object.keys(process.env)) {
      if (process.env[key] === '') delete process.env[key];
    }
    loadEnvFile(path);
  }
}
