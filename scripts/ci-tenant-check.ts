import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

interface Violation {
  table: string;
  issue: string;
}

export async function checkTenantIsolation(): Promise<{ success: boolean; violations: Violation[] }> {
  const client = new Client({ connectionString });
  const violations: Violation[] = [];

  try {
    await client.connect();

    // 1. Fetch all user tables in public schema
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
      // Check RLS enabled
      if (!rowsecurity) {
        violations.push({
          table: tablename,
          issue: 'Row Level Security (RLS) is NOT enabled',
        });
      }

      // Check FORCE RLS
      const forceRes = await client.query(`
        SELECT relforcerowsecurity
        FROM pg_class
        WHERE relname = $1 AND relnamespace = 'public'::regnamespace;
      `, [tablename]);

      if (forceRes.rows.length > 0 && !forceRes.rows[0].relforcerowsecurity) {
        violations.push({
          table: tablename,
          issue: 'FORCE ROW LEVEL SECURITY is NOT enabled (allows bypass by table owners)',
        });
      }

      // Check org_id column presence and not-null (except organizations table which is keyed by id)
      if (tablename !== 'organizations') {
        const colRes = await client.query(`
          SELECT is_nullable, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'org_id';
        `, [tablename]);

        if (colRes.rows.length === 0) {
          violations.push({
            table: tablename,
            issue: 'Missing mandatory "org_id" column',
          });
        } else if (colRes.rows[0].is_nullable !== 'NO') {
          violations.push({
            table: tablename,
            issue: '"org_id" column is nullable (must be NOT NULL)',
          });
        }

        // Check index on org_id
        const idxRes = await client.query(`
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = $1
            AND (indexdef LIKE '%(org_id%' OR indexdef LIKE '%(org_id)%');
        `, [tablename]);

        if (idxRes.rows.length === 0) {
          violations.push({
            table: tablename,
            issue: 'Missing index on "org_id" column',
          });
        }
      }

      // Check RLS policies exist and reference fn_current_org()
      const policyRes = await client.query(`
        SELECT policyname, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = $1;
      `, [tablename]);

      if (policyRes.rows.length === 0) {
        violations.push({
          table: tablename,
          issue: 'No RLS policies defined on table',
        });
      } else {
        const hasOrgFilter = policyRes.rows.some((p: any) =>
          (p.qual && p.qual.includes('fn_current_org()')) ||
          (p.with_check && p.with_check.includes('fn_current_org()'))
        );
        if (!hasOrgFilter) {
          violations.push({
            table: tablename,
            issue: 'RLS policies do not reference fn_current_org()',
          });
        }
      }
    }

    return {
      success: violations.length === 0,
      violations,
    };
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  checkTenantIsolation()
    .then((res) => {
      if (!res.success) {
        console.error('\n❌ CI Tenant Check FAILED: Tenant isolation violations detected:\n');
        console.table(res.violations);
        process.exit(1);
      } else {
        console.log('\n✅ CI Tenant Check PASSED: All public tables enforce org_id, indexes, and RLS policies.\n');
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error('Error running CI tenant check:', err);
      process.exit(1);
    });
}
