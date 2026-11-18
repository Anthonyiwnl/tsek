// Fail when the built frontend contains files that should never be public
// (#294). Vercel serves everything in frontend/dist, so a source map, a
// dotfile, an env file or a key that lands there is downloadable by anyone.
// Usage: node exposed-files.mjs frontend/dist
// Only categories and counts are printed: file names could themselves leak.
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const RULES = [
  ['Source map', (path) => /\.map$/i.test(path)],
  ['Environment file', (path) => /(^|\/)\.?env(\.|$)|\.env$/i.test(path)],
  // .well-known is the standard public directory (security.txt and similar).
  ['Dotfile or dot-directory', (path) => path.split('/').some((part) => part.startsWith('.') && part !== '.well-known')],
  ['Private key or certificate store', (path) => /\.(pem|key|p12|pfx|jks|keystore)$/i.test(path)],
  ['Backup or editor file', (path) => /(\.(bak|old|orig|swp|swo|tmp)|~)$/i.test(path)],
  ['Database dump', (path) => /\.(sql|sqlite3?|db|dump)$/i.test(path)],
  ['Log file', (path) => /\.log$/i.test(path)],
  ['Archive', (path) => /\.(zip|tar|tgz|gz|rar|7z)$/i.test(path)],
  ['Project manifest or config', (path) => /(^|\/)(package(-lock)?\.json|tsconfig\.json|vite\.config\.[jt]s|vercel\.json)$/i.test(path)],
];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Count exposed files per rule. Each file counts once, under its first matching rule. */
export function findExposedFiles(directory) {
  const counts = new Map();
  for (const path of walk(directory)) {
    const relativePath = relative(directory, path).split(sep).join('/');
    const rule = RULES.find(([, matches]) => matches(relativePath));
    if (rule) counts.set(rule[0], (counts.get(rule[0]) ?? 0) + 1);
  }
  return counts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const counts = findExposedFiles(process.argv[2] ?? 'frontend/dist');
  for (const [category, count] of counts) {
    console.log(`::error title=Exposed file::${category}: ${count} file(s) in the built frontend would be public. Remove them from the build or from frontend/public.`);
  }
  if (!counts.size) console.log('No source maps, dotfiles, env files, keys, backups, dumps, logs, archives or project config in the build.');
  process.exitCode = counts.size ? 1 : 0;
}
