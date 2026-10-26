import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { runTask } from '../scripts/run-task.js';

const guidance = 'Database task failed. Check connection settings, permissions, and migration files. No pending changes were committed.';
const cases = [
  ['connection failure', Object.assign(new Error('secret connection string'), { code: 'ECONNREFUSED' }), { type: 'Error', code: 'ECONNREFUSED' }, true],
  ['task failure', Object.assign(new TypeError('secret SQL details'), { code: 123 }), { type: 'TypeError' }],
  ['missing migration', new Error('Applied migration is missing: 001_catalogue.sql'), { type: 'Error', message: 'Applied migration is missing: 001_catalogue.sql' }],
  ['changed migration', new Error('Applied migration has changed: 001_catalogue.sql'), { type: 'Error', message: 'Applied migration has changed: 001_catalogue.sql' }],
  ['unapproved prefix', new Error('secret: Applied migration has changed: 001_catalogue.sql'), { type: 'Error' }],
  ['non-error throw', null, { type: 'Error' }],
];

for (const [name, error, expected, connectionFailure] of cases) {
  test(`database task logs only safe details for ${name}`, async t => {
    const previousUrl = process.env.DIRECT_DATABASE_URL;
    const previousExitCode = process.exitCode;
    process.env.DIRECT_DATABASE_URL = 'postgresql://localhost/tsek';
    t.after(() => {
      if (previousUrl === undefined) delete process.env.DIRECT_DATABASE_URL;
      else process.env.DIRECT_DATABASE_URL = previousUrl;
      process.exitCode = previousExitCode;
    });
    const release = t.mock.fn();
    t.mock.method(pg.Pool.prototype, 'connect', async () => {
      if (connectionFailure) throw error;
      return { release };
    });
    const end = t.mock.method(pg.Pool.prototype, 'end', async () => {});
    const log = t.mock.method(console, 'error', () => {});
    await runTask(async () => { throw error; });
    assert.equal(process.exitCode, 1);
    assert.deepEqual(log.mock.calls.map(call => call.arguments), [[guidance, expected]]);
    assert.equal(release.mock.callCount(), connectionFailure ? 0 : 1);
    assert.equal(end.mock.callCount(), 1);
  });
}
