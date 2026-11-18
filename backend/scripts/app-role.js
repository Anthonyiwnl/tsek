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
 */

export const APP_ROLE = 'tsek_app';

// Rows the API must read but never change. Catalogue rows come from the seed;
// staff roles are set by an operator with `npm run staff:role`.
export const READ_ONLY_TABLES = ['schema_migrations', 'document_types', 'document_requirements', 'staff_roles'];

const identifier = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * SQL that creates or updates the role and sets its privileges. Safe to run
 * again after every new migration (the default privileges already cover new
 * tables, but re-running also fixes any that were created by another role).
 * @param {object} options
 * @param {string} options.database - Database name, from current_database().
 * @param {string} options.passwordLiteral - Password, already escaped with escapeLiteral.
 * @param {boolean} options.exists - Whether the role already exists.
 * @param {string[]} options.readOnly - READ_ONLY_TABLES that exist in this database.
 * @param {number} options.serverVersion - server_version_num.
 */
export function appRoleStatements({ role = APP_ROLE, database, passwordLiteral, exists, readOnly, serverVersion }) {
  if (!identifier.test(role) || !identifier.test(database)) throw new Error('Role and database names must be plain identifiers.');
  return [
    exists
      ? `ALTER ROLE ${role} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${passwordLiteral}`
      : `CREATE ROLE ${role} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${passwordLiteral}`,
    `GRANT CONNECT ON DATABASE ${database} TO ${role}`,
    `GRANT USAGE ON SCHEMA public TO ${role}`,
    // PostgreSQL 15+ already denies CREATE on public to ordinary roles; older servers allow it to everyone.
    ...(serverVersion < 150000 ? ['REVOKE CREATE ON SCHEMA public FROM PUBLIC'] : []),
    `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${role}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
    ...readOnly.map((table) => `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.${table} FROM ${role}`),
    // Tables and sequences that future migrations create as this owner.
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
  ];
}

/** Create or update the role using an owner connection. */
export async function grantAppRole(client, { role = APP_ROLE, password }) {
  if (typeof password !== 'string' || password.length < 24) {
    throw new Error('Set APP_DB_PASSWORD to a random password of at least 24 characters.');
  }
  const { rows: [{ database, exists, version }] } = await client.query(
    `SELECT current_database() AS database, EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists,
      current_setting('server_version_num')::integer AS version`, [role]);
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])", [READ_ONLY_TABLES]);
  const passwordLiteral = `'${password.replaceAll("'", "''")}'`;
  await client.query('BEGIN');
  try {
    for (const statement of appRoleStatements({
      role, database, passwordLiteral, exists, readOnly: rows.map(({ tablename }) => tablename), serverVersion: version,
    })) {
      await client.query(statement);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
