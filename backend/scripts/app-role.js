/**
 * Least-privilege role for the running API (#292).
 *
 * The API only reads and writes rows. Migrations, seeds and staff-role
 * provisioning keep using the owner role through DIRECT_DATABASE_URL. With this
 * role a SQL injection or a leaked DATABASE_URL cannot drop or alter tables,
 * rewrite the catalogue, or grant anyone the staff role.
 *
 * Create the role with SQL, not in the Neon Console: console-created roles join
 * neon_superuser and would get every privilege back.
 *
 * Neon has no true superuser, so everything here must work for an operator
 * with CREATEROLE only (the owner role). The setup fails closed: an existing
 * role with elevated attributes, memberships or owned objects is rejected,
 * and after granting, the role's effective privileges are checked inside the
 * same transaction, so any leftover path to write access rolls everything back.
 */

export const APP_ROLE = 'tsek_app';

// Rows the API must read but never change. Catalogue rows come from the seed;
// staff roles are set by an operator with `npm run staff:role`.
export const READ_ONLY_TABLES = ['schema_migrations', 'document_types', 'document_requirements', 'staff_roles'];
export const APPEND_ONLY_TABLES = ['application_history', 'requirement_reviews'];

const identifier = /^[a-z_][a-z0-9_]{0,62}$/;
const unsafeAttributes = {
  rolsuper: 'SUPERUSER',
  rolcreaterole: 'CREATEROLE',
  rolcreatedb: 'CREATEDB',
  rolreplication: 'REPLICATION',
  rolbypassrls: 'BYPASSRLS',
};

/**
 * SQL that creates the role, or rotates the password of an existing role that
 * passed {@link checkExistingRole}, and sets its privileges. Safe to run again
 * after every new migration (the default privileges already cover new tables,
 * but re-running also fixes any that were created by another role).
 * @param {object} options
 * @param {string} options.database - Database name, from current_database().
 * @param {string} options.passwordLiteral - Password, already escaped with escapeLiteral.
 * @param {boolean} options.exists - Whether the role already exists.
 * @param {string[]} options.readOnly - READ_ONLY_TABLES that exist in this database.
 */
export function appRoleStatements({ role = APP_ROLE, database, passwordLiteral, exists, readOnly, appendOnly = [] }) {
  if (!identifier.test(role) || !identifier.test(database)) throw new Error('Role and database names must be plain identifiers.');
  return [
    // Specifying NOSUPERUSER and similar flags in ALTER ROLE needs a true
    // superuser, even when they are already off, so an existing role only gets
    // a new password. Its attributes were checked before this runs.
    exists
      ? `ALTER ROLE ${role} WITH PASSWORD ${passwordLiteral}`
      : `CREATE ROLE ${role} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${passwordLiteral}`,
    `GRANT CONNECT ON DATABASE ${database} TO ${role}`,
    `GRANT USAGE ON SCHEMA public TO ${role}`,
    // On every version: PostgreSQL 15+ only stops granting CREATE by default,
    // so an upgraded or hand-edited database can still allow it.
    'REVOKE CREATE ON SCHEMA public FROM PUBLIC',
    `REVOKE CREATE ON SCHEMA public FROM ${role}`,
    `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${role}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
    ...readOnly.map((table) => `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.${table} FROM ${role}`),
    ...appendOnly.map((table) => `REVOKE UPDATE, DELETE, TRUNCATE ON public.${table} FROM ${role}`),
    // Tables and sequences that future migrations create as this owner.
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
  ];
}

/**
 * Reject an existing role that could have more power than the grants give it:
 * elevated attributes, no LOGIN, membership in any other role (privileges are
 * inherited, and SET ROLE works even with NOINHERIT), owned objects (owners
 * bypass grants), or grants of its own outside schema public (the revokes below
 * only touch public). Fixing these needs a deliberate operator decision, so the
 * script stops instead of guessing.
 * @returns {Promise<void>}
 */
export async function checkExistingRole(client, role = APP_ROLE) {
  const { rows: [attributes] } = await client.query(
    `SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls, rolcanlogin
       FROM pg_roles WHERE rolname = $1`, [role]);
  const elevated = Object.entries(unsafeAttributes).filter(([column]) => attributes[column]).map(([, name]) => name);
  if (elevated.length) {
    throw new Error(`Role ${role} already exists with ${elevated.join(', ')}. Drop it and run this again.`);
  }
  if (!attributes.rolcanlogin) throw new Error(`Role ${role} already exists without LOGIN. Drop it and run this again.`);

  const { rows: memberships } = await client.query(
    `SELECT granted.rolname AS name FROM pg_auth_members m
       JOIN pg_roles member ON member.oid = m.member
       JOIN pg_roles granted ON granted.oid = m.roleid
      WHERE member.rolname = $1 ORDER BY 1`, [role]);
  if (memberships.length) {
    const names = memberships.map(({ name }) => name).join(', ');
    throw new Error(`Role ${role} is a member of ${names} and would inherit their privileges. `
      + `Run REVOKE ${names} FROM ${role} as an operator who may, or drop the role, then run this again.`);
  }

  const { rows: [{ owned }] } = await client.query(
    `SELECT (SELECT count(*) FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE r.rolname = $1)
          + (SELECT count(*) FROM pg_namespace n JOIN pg_roles r ON r.oid = n.nspowner WHERE r.rolname = $1)
          + (SELECT count(*) FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner WHERE r.rolname = $1)
          + (SELECT count(*) FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba WHERE r.rolname = $1) AS owned`,
    [role]);
  if (Number(owned) > 0) {
    throw new Error(`Role ${role} owns ${owned} database object(s) and owners bypass grants. `
      + 'Reassign them (REASSIGN OWNED) or drop the role, then run this again.');
  }

  // The API's boundary is schema public. Grants made to the role itself on
  // anything outside it (another schema, its tables, sequences or functions,
  // or default privileges there) survive every revoke below, so stop.
  const { rows: outside } = await client.query(
    `WITH objects AS (
       SELECT 'schema ' || quote_ident(n.nspname) AS name, n.nspacl AS acl
         FROM pg_namespace n WHERE n.nspname <> 'public'
       UNION ALL
       SELECT 'table ' || quote_ident(n.nspname) || '.' || quote_ident(c.relname), c.relacl
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname <> 'public'
       UNION ALL
       SELECT 'function ' || quote_ident(n.nspname) || '.' || quote_ident(p.proname), p.proacl
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname <> 'public'
       UNION ALL
       SELECT 'default privileges in ' || coalesce(quote_ident(n.nspname), 'all schemas'), d.defaclacl
         FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
        WHERE n.nspname IS DISTINCT FROM 'public'
     )
     SELECT DISTINCT o.name FROM objects o
       CROSS JOIN LATERAL aclexplode(o.acl) a
       JOIN pg_roles r ON r.oid = a.grantee
      WHERE r.rolname = $1 ORDER BY 1`, [role]);
  if (outside.length) {
    const names = outside.map(({ name }) => name).join(', ');
    throw new Error(`Role ${role} has grants outside schema public (${names}). `
      + 'Revoke them or drop the role, then run this again.');
  }
}

/**
 * Check what the role can actually do, including privileges granted to PUBLIC
 * or inherited through roles: it must not create schemas, create objects in any
 * schema, or write any read-only table.
 * @returns {Promise<string[]>} Problems found; empty when the role is safe.
 */
export async function effectivePrivilegeProblems(client, role = APP_ROLE) {
  const problems = [];
  const { rows: [{ createdb }] } = await client.query(
    "SELECT has_database_privilege($1, current_database(), 'CREATE') AS createdb", [role]);
  if (createdb) problems.push('can create schemas in this database');
  const { rows: schemas } = await client.query(
    `SELECT nspname FROM pg_namespace
      WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema'
        AND has_schema_privilege($1, oid, 'CREATE')
      ORDER BY 1`, [role]);
  for (const { nspname } of schemas) problems.push(`can create objects in schema ${nspname}`);
  const { rows } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($2::text[])
        AND has_table_privilege($1, format('public.%I', tablename), 'INSERT, UPDATE, DELETE, TRUNCATE')
      ORDER BY 1`, [role, READ_ONLY_TABLES]);
  for (const { tablename } of rows) {
    problems.push(`can write public.${tablename} (granted to PUBLIC or through another role)`);
  }
  const { rows: appendOnly } = await client.query(`SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename = ANY($2::text[])
      AND has_table_privilege($1, format('public.%I', tablename), 'UPDATE, DELETE, TRUNCATE')`, [role, APPEND_ONLY_TABLES]);
  for (const { tablename } of appendOnly) problems.push(`can change append-only public.${tablename}`);
  return problems;
}

/** Create or update the role using an owner connection. */
export async function grantAppRole(client, { role = APP_ROLE, password }) {
  if (typeof password !== 'string' || password.length < 24) {
    throw new Error('Set APP_DB_PASSWORD to a random password of at least 24 characters.');
  }
  const { rows: [{ database, exists }] } = await client.query(
    `SELECT current_database() AS database, EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists`, [role]);
  if (exists) await checkExistingRole(client, role);
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])", [READ_ONLY_TABLES]);
  const { rows: appendOnly } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])", [APPEND_ONLY_TABLES]);
  const passwordLiteral = `'${password.replaceAll("'", "''")}'`;
  await client.query('BEGIN');
  try {
    for (const statement of appRoleStatements({
      role, database, passwordLiteral, exists, readOnly: rows.map(({ tablename }) => tablename), appendOnly: appendOnly.map(({ tablename }) => tablename),
    })) {
      await client.query(statement);
    }
    const problems = await effectivePrivilegeProblems(client, role);
    if (problems.length) {
      throw new Error(`Role ${role} still ${problems.join('; ')}. Nothing was changed; remove those grants and run this again.`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
