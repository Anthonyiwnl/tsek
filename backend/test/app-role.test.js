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

// Neon has no true superuser: the owner role that runs migrations and
// `db:app-role` only has CREATEROLE. Every grantAppRole call here runs as such
// an operator, so the tests catch statements that would need a superuser.
const OPERATOR = 'tsek_operator';
const citizen = '11111111-1111-4111-8111-111111111111';
const reviewer = '22222222-2222-4222-8222-222222222222';
const password = 'test-only-app-role-password-0123';
let db;
let client;

/** Run `work` as `role` (from the superuser session), then switch back to the operator. */
async function as(role, work) {
  await db.exec(`RESET ROLE; SET ROLE ${role}`);
  try {
    return await work();
  } finally {
    await db.exec(`RESET ROLE; SET ROLE ${OPERATOR}`);
  }
}
const asApp = (work) => as(APP_ROLE, work);
/** Set-up that only a superuser could do, such as making a privileged group. */
const asSuperuser = (sql) => as('postgres', () => db.exec(sql));

async function appRoleState() {
  const results = await asSuperuser(
    `SELECT rolcreaterole, rolcanlogin, rolpassword FROM pg_authid WHERE rolname = '${APP_ROLE}'`);
  return results.at(-1).rows[0];
}

before(async () => {
  db = new PGlite();
  client = { query: (sql, params) => params || !sql.includes(';')
    ? db.query(sql, params) : db.exec(sql).then((results) => results.at(-1)) };
  await db.exec(`CREATE ROLE ${OPERATOR} WITH LOGIN CREATEROLE NOSUPERUSER;
    ALTER DATABASE postgres OWNER TO ${OPERATOR};
    ALTER SCHEMA public OWNER TO ${OPERATOR};
    SET ROLE ${OPERATOR}`);
  await migrate(client);
  await seed(client);
  await client.query("INSERT INTO public.staff_roles (user_id, role) VALUES ($1, 'staff')", [reviewer]);
  await grantAppRole(client, { password });
});
after(async () => db?.close());

const denied = async (sql) => {
  await assert.rejects(asApp(() => client.query(sql)), (error) => error.code === '42501', sql);
};

test('the operator is not a superuser, like the Neon owner role', async () => {
  const { rows: [{ user, superuser }] } = await client.query(
    "SELECT current_user AS user, current_setting('is_superuser') AS superuser");
  assert.deepEqual({ user, superuser }, { user: OPERATOR, superuser: 'off' });
});

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

test('application history remains readable and append-only after provisioning', async () => {
  await asApp(() => client.query('SELECT id, event FROM public.application_history'));
  await denied('UPDATE public.application_history SET event = event');
  await denied('DELETE FROM public.application_history');
  await denied('TRUNCATE public.application_history');
  await denied('UPDATE public.requirement_reviews SET staff_status = staff_status');
  await denied('DELETE FROM public.requirement_reviews');
  await asSuperuser('GRANT UPDATE ON public.application_history TO PUBLIC');
  try { await assert.rejects(grantAppRole(client, { password }), /append-only/); }
  finally { await asSuperuser('REVOKE UPDATE ON public.application_history FROM PUBLIC'); }
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

test('a non-superuser operator can run it again: new tables are covered and the password rotates', async () => {
  await client.query('CREATE TABLE public.later_migration (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, x int)');
  await asApp(() => client.query('INSERT INTO public.later_migration (x) VALUES (1)'));
  const before = (await asSuperuser(`SELECT rolpassword FROM pg_authid WHERE rolname = '${APP_ROLE}'`)).at(-1).rows[0].rolpassword;
  await grantAppRole(client, { password: `${password}-rotated` });
  await grantAppRole(client, { password: `${password}-rotated-again` });
  const after = (await asSuperuser(`SELECT rolpassword FROM pg_authid WHERE rolname = '${APP_ROLE}'`)).at(-1).rows[0].rolpassword;
  assert.notEqual(after, before);
  await asApp(() => client.query('UPDATE public.later_migration SET x = 2'));
  await denied('DROP TABLE public.later_migration');
  await client.query('DROP TABLE public.later_migration');
});

test('an existing role in a privileged group is rejected and left unchanged', async () => {
  await asSuperuser(`CREATE ROLE writers NOLOGIN;
    GRANT INSERT, UPDATE ON public.staff_roles TO writers;
    GRANT CREATE ON SCHEMA public TO writers;
    GRANT writers TO ${APP_ROLE}`);
  try {
    await assert.rejects(grantAppRole(client, { password: `${password}-group` }), /member of writers/);
    // Proof the check matters: the inherited grant really does give write access.
    await asApp(() => client.query(`INSERT INTO public.staff_roles (user_id, role) VALUES ('${citizen}', 'admin')`));
  } finally {
    await asSuperuser(`DELETE FROM public.staff_roles WHERE user_id = '${citizen}';
      REVOKE writers FROM ${APP_ROLE}; DROP OWNED BY writers; DROP ROLE writers`);
  }
  await denied(`INSERT INTO public.staff_roles (user_id, role) VALUES ('${citizen}', 'admin')`);
});

test('an existing role with elevated attributes or owned objects is rejected', async () => {
  await asSuperuser(`ALTER ROLE ${APP_ROLE} CREATEDB`);
  try {
    await assert.rejects(grantAppRole(client, { password }), /already exists with CREATEDB/);
  } finally {
    await asSuperuser(`ALTER ROLE ${APP_ROLE} NOCREATEDB`);
  }
  await asSuperuser(`CREATE TABLE public.owned_by_app (x int); ALTER TABLE public.owned_by_app OWNER TO ${APP_ROLE}`);
  try {
    await assert.rejects(grantAppRole(client, { password }), /owns 1 database object/);
  } finally {
    await asSuperuser('DROP TABLE public.owned_by_app');
  }
  await grantAppRole(client, { password });
});

for (const [attribute, reset, reason] of [
  ['CREATEROLE', 'NOCREATEROLE', /already exists with CREATEROLE/],
  ['NOLOGIN', 'LOGIN', /already exists without LOGIN/],
]) {
  test(`an existing ${attribute} API role is rejected without changing its attributes or password`, async () => {
    await asSuperuser(`ALTER ROLE ${APP_ROLE} ${attribute}`);
    try {
      const before = await appRoleState();
      await assert.rejects(grantAppRole(client, { password: `${password}-${attribute}` }), reason);
      assert.deepEqual(await appRoleState(), before);
    } finally {
      await asSuperuser(`ALTER ROLE ${APP_ROLE} ${reset}`);
    }
  });
}

test('a CREATE grant to PUBLIC on a modern server is removed', async () => {
  await client.query('GRANT CREATE ON SCHEMA public TO PUBLIC');
  await asApp(async () => {
    await client.query('CREATE TABLE public.via_public (x int)');
    await client.query('DROP TABLE public.via_public');
  });
  await grantAppRole(client, { password });
  await denied('CREATE TABLE public.via_public (x int)');
  const { rows: [{ allowed }] } = await client.query(
    "SELECT has_schema_privilege('public', 'public', 'CREATE') AS allowed");
  assert.equal(allowed, false);
});

test('write access left through PUBLIC fails the setup and rolls everything back', async () => {
  // Provisioning would restore this INSERT, revoke this CREATE and rotate the
  // password before noticing the unsafe PUBLIC write. None may survive rollback.
  await client.query(`REVOKE INSERT ON public.applications FROM ${APP_ROLE};
    GRANT CREATE ON SCHEMA public TO PUBLIC;
    GRANT INSERT ON public.staff_roles TO PUBLIC`);
  const privileges = async () => (await client.query(`SELECT
    has_table_privilege($1, 'public.applications', 'INSERT') AS application_insert,
    has_schema_privilege('public', 'public', 'CREATE') AS public_create,
    has_table_privilege($1, 'public.staff_roles', 'INSERT') AS staff_insert`, [APP_ROLE])).rows[0];
  try {
    const beforeRole = await appRoleState();
    const beforePrivileges = await privileges();
    assert.deepEqual(beforePrivileges, { application_insert: false, public_create: true, staff_insert: true });
    await assert.rejects(grantAppRole(client, { password: `${password}-rollback` }),
      /still can write public\.staff_roles.*Nothing was changed/);
    assert.deepEqual(await appRoleState(), beforeRole);
    assert.deepEqual(await privileges(), beforePrivileges);
    await denied('INSERT INTO public.applications DEFAULT VALUES');
  } finally {
    await client.query(`REVOKE INSERT ON public.staff_roles FROM PUBLIC;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
    await grantAppRole(client, { password });
  }
});

test('an existing role with grants in another schema is rejected', async () => {
  // Kenlie's reproduction on #298: USAGE + CREATE on a second schema and SELECT on its table.
  await client.query(`CREATE SCHEMA side;
    CREATE TABLE side.secrets (x int);
    GRANT USAGE, CREATE ON SCHEMA side TO ${APP_ROLE};
    GRANT SELECT ON side.secrets TO ${APP_ROLE}`);
  try {
    await assert.rejects(grantAppRole(client, { password: `${password}-side` }),
      /grants outside schema public \(schema side, table side\.secrets\)/);
    // Proof the check matters: the grants really do give access outside public.
    await asApp(() => client.query('SELECT * FROM side.secrets'));
  } finally {
    await client.query('DROP SCHEMA side CASCADE');
  }
  await grantAppRole(client, { password });
  await denied('CREATE SCHEMA stolen');
});

test('default privileges for the role in another schema are rejected', async () => {
  await client.query(`CREATE SCHEMA later;
    ALTER DEFAULT PRIVILEGES IN SCHEMA later GRANT SELECT ON TABLES TO ${APP_ROLE}`);
  try {
    await assert.rejects(grantAppRole(client, { password }), /default privileges in later/);
  } finally {
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA later REVOKE SELECT ON TABLES FROM ${APP_ROLE};
      DROP SCHEMA later`);
  }
  await grantAppRole(client, { password });
});

test('CREATE reached through PUBLIC on another schema or the database fails the setup', async () => {
  await client.query('CREATE SCHEMA shared; GRANT CREATE ON SCHEMA shared TO PUBLIC');
  try {
    await assert.rejects(grantAppRole(client, { password: `${password}-shared` }),
      /still can create objects in schema shared.*Nothing was changed/);
  } finally {
    await client.query('DROP SCHEMA shared');
  }
  await client.query('GRANT CREATE ON DATABASE postgres TO PUBLIC');
  try {
    await assert.rejects(grantAppRole(client, { password: `${password}-createdb` }),
      /still can create schemas in this database/);
  } finally {
    await client.query('REVOKE CREATE ON DATABASE postgres FROM PUBLIC');
  }
  await grantAppRole(client, { password });
});

test('rejects weak passwords and unsafe names, and escapes the password', async () => {
  await assert.rejects(grantAppRole(client, { password: 'short' }), /at least 24 characters/);
  assert.throws(() => appRoleStatements({ role: 'x; DROP', database: 'neondb', passwordLiteral: "''", exists: false, readOnly: [] }));
  const created = appRoleStatements({ database: 'neondb', passwordLiteral: "'it''s'", exists: false, readOnly: ['staff_roles'] });
  assert.match(created[0], /^CREATE ROLE tsek_app WITH LOGIN NOSUPERUSER .* PASSWORD 'it''s'$/);
  assert.ok(created.includes('REVOKE CREATE ON SCHEMA public FROM PUBLIC'));
  const rotated = appRoleStatements({ database: 'neondb', passwordLiteral: "'it''s'", exists: true, readOnly: [] });
  assert.equal(rotated[0], "ALTER ROLE tsek_app WITH PASSWORD 'it''s'");
  assert.ok(rotated.includes('REVOKE CREATE ON SCHEMA public FROM PUBLIC'));
});
