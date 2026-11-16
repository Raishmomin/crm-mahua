import { expect } from 'vitest';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { DATABASE_URL } from '../../scripts/db-url';

export { DATABASE_URL };

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'supabase', 'migrations');

// Test files run in parallel workers against one database; this lock serialises
// migration runs so no worker observes a half-applied state (0001 re-opens the
// permissive grants that 0003 closes again).
const MIGRATION_LOCK_KEY = 73_003;

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

/** Applies every supabase/migrations/*.sql in filename order inside one transaction. */
export async function applyMigrations(client: Client): Promise<string[]> {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [MIGRATION_LOCK_KEY]);
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      try {
        await client.query(sql);
      } catch (err) {
        throw new Error(`migration ${file} failed: ${(err as Error).message}`);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  return files;
}

/**
 * Impersonates a web session: SET ROLE authenticated + the JWT claims. Both forms are set
 * (SEC1-05): the local shim's auth.uid() reads request.jwt.claim.sub, Supabase's reads
 * request.jwt.claims ->> 'sub', so the suite impersonates the same user on either database.
 */
export async function actAs(client: Client, userId: string): Promise<void> {
  await client.query('SET ROLE authenticated');
  await client.query(
    `SELECT set_config('request.jwt.claim.sub', $1, false),
            set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, false)`,
    [userId],
  );
}

/** Back to the connection role (postgres) with every session override cleared. */
export async function resetRole(client: Client): Promise<void> {
  await client.query('RESET ROLE');
  await client.query(`
    SELECT set_config('request.jwt.claim.sub', '', false),
           set_config('request.jwt.claims', '', false),
           set_config('app.current_org', '', false),
           set_config('app.override_module_check', '', false)
  `);
}

export interface DbError {
  code?: string;
  message: string;
  detail?: string;
}

/**
 * Asserts that a query fails, optionally with the given SQLSTATE and/or primary message
 * (exact string or RegExp). Returns the error for further checks.
 */
export async function expectDbError(
  pending: Promise<unknown>,
  code?: string,
  message?: string | RegExp,
): Promise<DbError> {
  let caught: DbError | null = null;
  try {
    await pending;
  } catch (err) {
    caught = err as DbError;
  }
  if (!caught) {
    throw new Error(
      `expected the query to fail${code ? ` with SQLSTATE ${code}` : ''}${
        message ? ` and message ${String(message)}` : ''
      }, but it succeeded`,
    );
  }
  if (code !== undefined) {
    expect(caught.code, `SQLSTATE for "${caught.message}"`).toBe(code);
  }
  if (typeof message === 'string') {
    expect(caught.message).toBe(message);
  } else if (message instanceof RegExp) {
    expect(caught.message).toMatch(message);
  }
  return caught;
}
