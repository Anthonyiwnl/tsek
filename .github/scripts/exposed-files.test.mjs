import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findExposedFiles } from './exposed-files.mjs';

function build(files) {
  const directory = mkdtempSync(join(tmpdir(), 'dist-'));
  for (const file of files) {
    mkdirSync(join(directory, file, '..'), { recursive: true });
    writeFileSync(join(directory, file), 'x');
  }
  return directory;
}

test('a normal build passes', () => {
  const directory = build(['index.html', 'assets/index-abc.js', 'assets/index-abc.css', 'favicon.svg',
    'figma/logo.svg', 'tsek-check.png', 'devops-demo.txt', '.well-known/security.txt']);
  try {
    assert.deepEqual([...findExposedFiles(directory)], []);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test('planted files are caught by category', () => {
  const directory = build(['assets/index-abc.js.map', '.env', 'config/.env.production', 'env.local', '.git/config',
    '.DS_Store', 'certs/server.key', 'backup.sql', 'index.html.bak', 'npm-debug.log', 'source.zip', 'package.json',
    'index.html']);
  try {
    assert.deepEqual(Object.fromEntries(findExposedFiles(directory)), {
      'Source map': 1,
      'Environment file': 3,
      'Dotfile or dot-directory': 2,
      'Private key or certificate store': 1,
      'Database dump': 1,
      'Backup or editor file': 1,
      'Log file': 1,
      'Archive': 1,
      'Project manifest or config': 1,
    });
  } finally {
    rmSync(directory, { recursive: true });
  }
});
