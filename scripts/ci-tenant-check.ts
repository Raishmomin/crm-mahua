import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { DATABASE_URL, maskDbUrl } from './db-url';

interface Violation {
  object: string;
  issue: string;
}

/**
 * SECURITY DEFINER functions run with the owner's rights and bypass RLS, so every one
 * of them must be reviewed and listed here. A later migration that adds one adds its
 * name to the matching block in the same change (names from docs/design/contracts.md
 * section 4 are pre-registered); anything else fails the check.
 */
export const SECURITY_DEFINER_ALLOWLIST: readonly string[] = [
  // 0001 + 0003 (Sprint A)
  'fn_current_org',
  'fn_is_active',
  'fn_require_module',
  'fn_has_module',
  'fn_user_role',
  'fn_next_code',
  'fn_next_doc_no',
  'fn_audit',
  'fn_assign_code',
  'fn_assign_doc_no',
  'fn_set_user_access',
  'fn_set_user_active',
  // 0004 (Sprint B, Dev-1) - contracts 4.2
  'fn_inquiry_set_status',
  'fn_follow_up_done',
  // 0005 (Sprint B, Dev-2) - contracts 3.5 triggers + 4.3
  'fn_quote_item_guard',
  'fn_quotation_items_totals',
  'fn_sample_set_status',
  'fn_quote_send',
  'fn_quote_reject',
  // 0006 (Sprint B, Dev-3) - contracts 4.4
  'fn_quote_accept',
  'fn_order_set_status',
  'fn_order_set_packed',
  'fn_order_dispatch',
  'fn_dispatch_tick',
  'fn_dispatch_delivered',
  'fn_payment_record',
  'fn_order_advance_waiting', // Sprint C, Dev-3: Plant packing-card advance guard (A6)
];

/** Functions no web session may call directly (only SECURITY DEFINER functions / triggers use them). */
const LOCKED_FUNCTIONS = ['public.fn_next_code(text)', 'public.fn_next_doc_no(text)'];

/** Privileges that are not subject to RLS; web roles must never hold them on a public table. */
const FORBIDDEN_TABLE_PRIVILEGES = ['TRUNCATE', 'REFERENCES', 'TRIGGER'];

/** PostgREST roles. Only the ones that exist in the database are checked. */
const WEB_ROLES = ['authenticated', 'anon'];

const SECURITY_INVOKER_TRUE = /^security_invoker=(true|on|1|yes)$/i;

/** Where the server actions live; every supabase.rpc('<name>') there is an app path. */
const SRC_DIR = path.resolve(__dirname, '..', 'src');
const RPC_CALL = /\.rpc\(\s*['"]([a-z_][a-z0-9_]*)['"]/g;

/** Names of the database functions the app calls through supabase.rpc() (A10). */
export function rpcNamesInSource(dir: string = SRC_DIR): string[] {
  const names = new Set<string>();
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf-8');
        const re = new RegExp(RPC_CALL.source, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) names.add(m[1]);
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return Array.from(names).sort();
}

export async function checkTenantIsolation(): Promise<{ success: boolean; violations: Violation[] }> {
  const client = new Client({ connectionString: DATABASE_URL });
  const violations: Violation[] = [];

  try {
    await client.connect();

    // 1. Every public table: org_id NOT NULL + index, ENABLE + FORCE RLS, a policy on fn_current_org()
    const tablesRes = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN ('schema_migrations', 'spatial_ref_sys')
      ORDER BY tablename;
    `);

    const tables = tablesRes.rows;

    if (tables.length === 0) {
      console.log('No public tables found. Ensure migrations have run.');
      return { success: true, violations: [] };
    }

    for (const { tablename, rowsecurity } of tables) {
      if (!rowsecurity) {
        violations.push({ object: tablename, issue: 'Row Level Security (RLS) is NOT enabled' });
      }

      const forceRes = await client.query(
        `SELECT relforcerowsecurity FROM pg_class WHERE relname = $1 AND relnamespace = 'public'::regnamespace;`,
        [tablename],
      );
      if (forceRes.rows.length > 0 && !forceRes.rows[0].relforcerowsecurity) {
        violations.push({
          object: tablename,
          issue: 'FORCE ROW LEVEL SECURITY is NOT enabled (allows bypass by table owners)',
        });
      }

      if (tablename !== 'organizations') {
        const colRes = await client.query(
          `SELECT is_nullable FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'org_id';`,
          [tablename],
        );
        if (colRes.rows.length === 0) {
          violations.push({ object: tablename, issue: 'Missing mandatory "org_id" column' });
        } else if (colRes.rows[0].is_nullable !== 'NO') {
          violations.push({ object: tablename, issue: '"org_id" column is nullable (must be NOT NULL)' });
        }

        const idxRes = await client.query(
          `SELECT indexname FROM pg_indexes
           WHERE schemaname = 'public' AND tablename = $1
             AND (indexdef LIKE '%(org_id%' OR indexdef LIKE '%(org_id)%');`,
          [tablename],
        );
        if (idxRes.rows.length === 0) {
          violations.push({ object: tablename, issue: 'Missing index on "org_id" column' });
        }
      }

      const policyRes = await client.query(
        `SELECT policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = $1;`,
        [tablename],
      );
      if (policyRes.rows.length === 0) {
        violations.push({ object: tablename, issue: 'No RLS policies defined on table' });
      } else {
        const hasOrgFilter = policyRes.rows.some(
          (p: { qual: string | null; with_check: string | null }) =>
            (p.qual && p.qual.includes('fn_current_org()')) ||
            (p.with_check && p.with_check.includes('fn_current_org()')),
        );
        if (!hasOrgFilter) {
          violations.push({ object: tablename, issue: 'RLS policies do not reference fn_current_org()' });
        }
      }
    }

    // 2. Every public view runs with the caller's rights (otherwise it bypasses RLS)
    const viewsRes = await client.query(`
      SELECT c.relname, c.reloptions
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'v'
      ORDER BY c.relname;
    `);
    for (const { relname, reloptions } of viewsRes.rows as { relname: string; reloptions: string[] | null }[]) {
      const ok = Array.isArray(reloptions) && reloptions.some((o) => SECURITY_INVOKER_TRUE.test(o));
      if (!ok) {
        violations.push({
          object: `view ${relname}`,
          issue: 'View lacks WITH (security_invoker = true); it would run with the owner rights and skip RLS',
        });
      }
    }

    // 3. Web roles hold no TRUNCATE / REFERENCES / TRIGGER on any public table or view
    const rolesRes = await client.query(`SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[])`, [WEB_ROLES]);
    const webRoles: string[] = rolesRes.rows.map((r: { rolname: string }) => r.rolname);
    if (webRoles.length === 0) {
      violations.push({ object: 'roles', issue: `None of ${WEB_ROLES.join(', ')} exists; run migration 0001` });
    }
    for (const role of webRoles) {
      for (const priv of FORBIDDEN_TABLE_PRIVILEGES) {
        const privRes = await client.query(
          `SELECT c.relname
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public'
             AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
             AND has_table_privilege($1, c.oid, $2)
           ORDER BY c.relname;`,
          [role, priv],
        );
        for (const { relname } of privRes.rows) {
          violations.push({
            object: relname,
            issue: `Role ${role} holds ${priv} (not subject to RLS); grant only SELECT, INSERT, UPDATE, DELETE`,
          });
        }
      }
    }

    // 4. SECURITY DEFINER functions must be on the reviewed allowlist
    const definersRes = await client.query(`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef
        -- Event trigger functions (e.g. Supabase's own rls_auto_enable) cannot be called by anyone.
        AND p.prorettype <> 'event_trigger'::regtype
      ORDER BY p.proname;
    `);
    for (const { proname, args } of definersRes.rows) {
      if (!SECURITY_DEFINER_ALLOWLIST.includes(proname)) {
        violations.push({
          object: `function ${proname}(${args})`,
          issue: 'SECURITY DEFINER function not in SECURITY_DEFINER_ALLOWLIST (scripts/ci-tenant-check.ts); review and list it',
        });
      }
    }

    // 5. Number generators are not executable by web roles
    for (const signature of LOCKED_FUNCTIONS) {
      const existsRes = await client.query(`SELECT to_regprocedure($1) IS NOT NULL AS present`, [signature]);
      if (!existsRes.rows[0].present) {
        violations.push({ object: `function ${signature}`, issue: 'Function is missing; run migration 0001' });
        continue;
      }
      for (const role of webRoles) {
        const execRes = await client.query(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS can_exec`, [
          role,
          signature,
        ]);
        if (execRes.rows[0].can_exec) {
          violations.push({
            object: `function ${signature}`,
            issue: `Executable by role ${role}; REVOKE EXECUTE ... FROM PUBLIC, ${role} (migration 0003)`,
          });
        }
      }
    }

    // 6-8. Function privileges (A10, migration 0007): definers pin search_path; PUBLIC / anon
    // execute nothing in public; trigger functions stay locked for every web role.
    const hasAnon = webRoles.includes('anon');
    const fnRes = await client.query(`
      SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef,
             'search_path=public' = ANY (COALESCE(p.proconfig, '{}'::text[])) AS pins_search_path,
             p.prorettype = 'trigger'::regtype AS is_trigger,
             p.prorettype = 'event_trigger'::regtype AS is_event_trigger,
             EXISTS (
               SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
               WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
             ) AS public_exec
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace
      ORDER BY p.proname;
    `);
    for (const fn of fnRes.rows as {
      oid: number;
      proname: string;
      args: string;
      prosecdef: boolean;
      pins_search_path: boolean;
      is_trigger: boolean;
      is_event_trigger: boolean;
      public_exec: boolean;
    }[]) {
      const label = `function ${fn.proname}(${fn.args})`;
      if (fn.prosecdef && !fn.pins_search_path && !fn.is_event_trigger) {
        violations.push({
          object: label,
          issue: 'SECURITY DEFINER function without SET search_path = public (search-path hijack risk)',
        });
      }
      if (fn.public_exec) {
        violations.push({ object: label, issue: 'Executable by PUBLIC; REVOKE ALL ON FUNCTION ... FROM PUBLIC (0007)' });
      }
      const rolesToCheck = fn.is_trigger ? webRoles : hasAnon ? ['anon'] : [];
      for (const role of rolesToCheck) {
        const execRes = await client.query(`SELECT has_function_privilege($1, $2::oid, 'EXECUTE') AS can_exec`, [
          role,
          fn.oid,
        ]);
        if (execRes.rows[0].can_exec) {
          violations.push({
            object: label,
            issue: fn.is_trigger
              ? `Trigger function executable by role ${role}; triggers fire without EXECUTE, revoke it (0007)`
              : `Executable by role ${role}${fn.prosecdef ? ' (SECURITY DEFINER)' : ''}; revoke it (0007)`,
          });
        }
      }
    }

    // 9. App paths keep EXECUTE: every public function an RLS policy, a view, a column default
    // or a CHECK runs as the caller, and every supabase.rpc() target in src/, is executable by
    // authenticated (so a privilege change can never break a screen silently).
    if (webRoles.includes('authenticated')) {
      const neededRes = await client.query(`
        SELECT DISTINCT p.proname
        FROM pg_depend d
        JOIN pg_proc p ON p.oid = d.refobjid
        WHERE d.refclassid = 'pg_proc'::regclass
          AND p.pronamespace = 'public'::regnamespace
          AND d.classid IN ('pg_policy'::regclass, 'pg_rewrite'::regclass, 'pg_attrdef'::regclass, 'pg_constraint'::regclass);
      `);
      const needed = new Map<string, string>();
      for (const { proname } of neededRes.rows as { proname: string }[]) {
        needed.set(proname, 'called by an RLS policy / view / default as the caller');
      }
      for (const name of rpcNamesInSource()) {
        if (!needed.has(name)) needed.set(name, 'called by the app via supabase.rpc()');
      }
      for (const [name, why] of Array.from(needed.entries()).sort()) {
        const execRes = await client.query(
          `SELECT count(*)::int AS overloads,
                  bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS can_exec
           FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.proname = $1`,
          [name],
        );
        const { overloads, can_exec } = execRes.rows[0] as { overloads: number; can_exec: boolean | null };
        if (overloads === 0) {
          violations.push({ object: `function ${name}`, issue: `Missing, but ${why}; run the migrations` });
        } else if (!can_exec) {
          violations.push({
            object: `function ${name}`,
            issue: `Not executable by authenticated, but ${why}; GRANT EXECUTE ... TO authenticated (0007)`,
          });
        }
      }
    }

    // 10. Default privileges of the migration role: a new function is executable by nobody
    // until its migration grants it (PUBLIC's default is global; Supabase adds anon per schema).
    const defRes = await client.query(`
      SELECT d.defaclnamespace, d.defaclacl::text AS acl
      FROM pg_default_acl d
      WHERE d.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = current_user)
        AND d.defaclobjtype = 'f';
    `);
    const defaults = defRes.rows as { defaclnamespace: number; acl: string }[];
    const publicNs = Number((await client.query(`SELECT 'public'::regnamespace::oid AS oid`)).rows[0].oid);
    const globalDefault = defaults.find((d) => Number(d.defaclnamespace) === 0);
    if (!globalDefault || /[{,]=X/.test(globalDefault.acl)) {
      violations.push({
        object: 'default privileges (functions)',
        issue: 'New functions are executable by PUBLIC; ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC (0007)',
      });
    }
    for (const d of defaults) {
      // Only the global default and public matter: our functions live in public. Supabase's own
      // schemas (storage, graphql ...) keep their platform defaults.
      const ns = Number(d.defaclnamespace);
      if (ns !== 0 && ns !== publicNs) continue;
      if (/[{,]anon=/.test(d.acl)) {
        violations.push({
          object: 'default privileges (functions)',
          issue: 'New functions are granted to anon; ALTER DEFAULT PRIVILEGES ... REVOKE ALL ON FUNCTIONS FROM anon (0007)',
        });
      }
    }

    return { success: violations.length === 0, violations };
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  console.log('CI tenant check against', maskDbUrl());
  checkTenantIsolation()
    .then((res) => {
      if (!res.success) {
        console.error('\n❌ CI Tenant Check FAILED: tenant isolation or privilege violations detected:\n');
        console.table(res.violations);
        process.exit(1);
      } else {
        console.log(
          '\n✅ CI Tenant Check PASSED: every public table has org_id, an index, ENABLE + FORCE RLS and an org policy; ' +
            'every view is security_invoker; web roles hold no TRUNCATE / REFERENCES / TRIGGER; ' +
            'all SECURITY DEFINER functions are allowlisted and pin search_path; number generators and trigger functions are locked; ' +
            'PUBLIC / anon execute no function; every function a policy, view or app RPC needs is executable by authenticated; ' +
            'new functions are granted to nobody by default.\n',
        );
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error('Error running CI tenant check:', err);
      process.exit(1);
    });
}
