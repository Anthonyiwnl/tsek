import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate, seed } from '../scripts/database-tasks.js';
import { APP_ROLE, appRoleStatements, grantAppRole } from '../scripts/app-role.js';
import { applicationsRepository } from '../src/applications.js';
import { applicationFilesRepository } from '../src/application-files.js';
import { applicationAnalysesRepository } from '../src/application-analyses.js';
import { createAiRequestBudget } from '../src/ai-request-budget.js';
import { catalogueRepository } from '../src/catalogue.js';
import { staffRepository } from '../src/staff.js';

const citizen = '11111111-1111-4111-8111-111111111111';
const reviewer = '22222222-2222-4222-8222-222222222222';
const password = 'test-only-app-role-password-0123';
let db;
let client;

before(async () => {
  db = new PGlite();
  client = { query: (sql, params) => params || !sql.includes(';')
    ? db.query(sql, params) : db.exec(sql).then((results) => results.at(-1)) };
  await migrate(client);
  await seed(client);
  await client.query("INSERT INTO public.staff_roles (user_id, role) VALUES ($1, 'staff')", [reviewer]);
  await grantAppRole(client, { password });
});
after(async () => db?.close());

/** Run `work` as the API's role, then switch back to the owner. */
async function asApp(work) {
  await db.exec(`SET ROLE ${APP_ROLE}`);
  try {
    return await work();
  } finally {
    await db.exec('RESET ROLE');
  }
}

const denied = async (sql) => {
  await assert.rejects(asApp(() => client.query(sql)), (error) => error.code === '42501', sql);
};

test('the role has no superuser, role, database or replication powers', async () => {
  const { rows: [role] } = await client.query(
    'SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = $1', [APP_ROLE]);
  assert.deepEqual(role, {
    rolsuper: false, rolcreaterole: false, rolcreatedb: false, rolreplication: false, rolbypassrls: false, rolcanlogin: true,
  });
});

test('everything the API does still works under the role', async () => {
  await asApp(async () => {
    const catalogue = catalogueRepository(client);
    const type = (await catalogue.list())[0];
    assert.ok((await catalogue.requirements(type.id)).requirements.length > 0);

    const applications = applicationsRepository(client);
    const draft = await applications.create(citizen, type.id, 'Employment');
    assert.equal((await applications.update(citizen, draft.id, { purpose: 'Scholarship' })).updated, true);
    assert.equal((await applications.list(citizen)).rows.length, 1);

    const files = applicationFilesRepository(client, (work) => db.transaction(work));
    const file = await files.createFile(citizen, draft.id, {
      originalName: 'id.txt', mediaType: 'text/plain', content: Buffer.from('BARANGAY CLEARANCE'),
    });
    const analyses = applicationAnalysesRepository(client);
    assert.ok(await analyses.create(citizen, draft.id, file.id, type.id, {
      status: 'failed', result: null, normalizedResult: null, errorCode: 'INVALID_ANALYSIS', metadata: null,
    }));

    const budget = createAiRequestBudget({ connect: async () => ({ query: client.query, release() {} }) });
    assert.equal((await budget(citizen)).allowed, true);

    const staff = staffRepository(client, (work) => db.transaction(work));
    assert.equal(await staff.role(reviewer), 'staff');
    assert.ok(await staff.submit(citizen, draft.id));
    assert.ok(await staff.review(reviewer, draft.id, 'approved', 'Complete.'));

    const second = await applications.create(citizen, type.id, '');
    assert.ok(await applications.deleteDraft(citizen, second.id));
  });
});

test('the role cannot change the schema', async () => {
  await denied('DROP TABLE public.applications');
  await denied('ALTER TABLE public.applications ADD COLUMN note text');
  await denied('CREATE TABLE public.stolen (data text)');
  await denied('TRUNCATE public.application_files');
});

test('the role cannot grant itself staff access or rewrite the catalogue', async () => {
  await denied(`INSERT INTO public.staff_roles (user_id, role) VALUES ('${citizen}', 'admin')`);
  await denied(`UPDATE public.staff_roles SET role = 'admin'`);
  await denied("UPDATE public.document_types SET name = 'Changed'");
  await denied('DELETE FROM public.document_requirements');
  await denied('DELETE FROM public.schema_migrations');
  const { rows } = await asApp(() => client.query('SELECT count(*)::integer AS count FROM public.staff_roles'));
  assert.equal(rows[0].count, 1);
});

test('tables from later migrations are covered, and running it again is safe', async () => {
  await client.query('CREATE TABLE public.later_migration (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, x int)');
  await asApp(() => client.query('INSERT INTO public.later_migration (x) VALUES (1)'));
  await grantAppRole(client, { password: `${password}-rotated` });
  await asApp(() => client.query('UPDATE public.later_migration SET x = 2'));
  await denied('DROP TABLE public.later_migration');
  await client.query('DROP TABLE public.later_migration');
});

test('rejects weak passwords and unsafe names, and escapes the password', async () => {
  await assert.rejects(grantAppRole(client, { password: 'short' }), /at least 24 characters/);
  assert.throws(() => appRoleStatements({ role: 'x; DROP', database: 'neondb', passwordLiteral: "''", exists: false, readOnly: [] }));
  const statements = appRoleStatements({
    database: 'neondb', passwordLiteral: "'it''s'", exists: false, readOnly: ['staff_roles'], serverVersion: 140000,
  });
  assert.match(statements[0], /^CREATE ROLE tsek_app WITH LOGIN NOSUPERUSER .* PASSWORD 'it''s'$/);
  assert.ok(statements.includes('REVOKE CREATE ON SCHEMA public FROM PUBLIC'));
  assert.ok(!appRoleStatements({ database: 'neondb', passwordLiteral: "''", exists: true, readOnly: [], serverVersion: 170000 })
    .includes('REVOKE CREATE ON SCHEMA public FROM PUBLIC'));
});
