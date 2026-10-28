import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('environment files honor local/component priority and fill empty values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tsek-env-'));
  try {
    await mkdir(join(root, 'backend/src'), { recursive: true });
    await copyFile(new URL('../src/environment.js', import.meta.url), join(root, 'backend/src/environment.mjs'));
    const pooled = 'postgresql://app:example@ep-test-pooler.region.neon.tech/db?sslmode=require';
    const direct = 'postgresql://app:example@ep-test.region.neon.tech/db?sslmode=require';
    const files = {
      'backend/.env.local': 'DATABASE_URL=\nDIRECT_DATABASE_URL=\nLOCAL=component-local\nFILLED=\n',
      'backend/.env': 'DATABASE_URL=\nDIRECT_DATABASE_URL=\nLOCAL=component\nCOMPONENT=component\nFILLED=component\n',
      '.env.local': `DATABASE_URL=${pooled}\nDIRECT_DATABASE_URL=\nLOCAL=root-local\nCOMPONENT=root-local\n`,
      '.env': `DATABASE_URL=lower-priority\nDIRECT_DATABASE_URL=${direct}\nDATABASE_URL_UNPOOLED=from-file\nLOCAL=root\nCOMPONENT=root\n`,
    };
    for (const [path, contents] of Object.entries(files)) await writeFile(join(root, path), contents);
    const expected = {
      DATABASE_URL: pooled,
      DIRECT_DATABASE_URL: direct,
      DATABASE_URL_UNPOOLED: 'existing-process-value',
      LOCAL: 'component-local',
      COMPONENT: 'component',
      FILLED: 'component',
    };
    const script = `import './backend/src/environment.mjs'; console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(Object.keys(expected))}.map(key => [key, process.env[key]]))));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      env: { DATABASE_URL: '', DIRECT_DATABASE_URL: '', DATABASE_URL_UNPOOLED: 'existing-process-value', FILLED: '' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), expected);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
