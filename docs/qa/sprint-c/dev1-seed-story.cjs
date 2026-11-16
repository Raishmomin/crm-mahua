// Dev-1 Sprint C evidence: seed story (owner v_home_kpis) + A9 policy text, read as the demo users.
// Usage: node docs/qa/sprint-c/dev1-seed-story.cjs   (DATABASE_URL from env, else .env.local, else local default)
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { Client } = require('pg');

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/onion_crm';
const OWNER = '22222222-2222-4222-8222-222222222221';

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE authenticated');
    await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [OWNER]);
    const k = await c.query(
      `SELECT new_inquiries, quotes_waiting, orders_in_production, money_due_inr, money_due_usd,
              money_overdue_count, followups_today FROM v_home_kpis`,
    );
    await c.query('ROLLBACK');
    const r = k.rows[0];
    console.log('owner v_home_kpis:', JSON.stringify(r));
    const want = {
      new_inquiries: 2, quotes_waiting: 1, orders_in_production: 1, money_due_inr: 511875,
      money_due_usd: 18900, money_overdue_count: 1, followups_today: 5,
    };
    const bad = Object.entries(want).filter(([key, v]) => Number(r[key]) !== v);
    console.log(bad.length === 0 ? 'SEED STORY OK' : `SEED STORY MISMATCH: ${JSON.stringify(bad)}`);
    const pol = await c.query(
      `SELECT tablename, policyname, cmd FROM pg_policies
        WHERE tablename IN ('inquiries', 'follow_ups') ORDER BY tablename, policyname`,
    );
    console.log('policies:', pol.rows.map((p) => `${p.tablename}.${p.policyname}(${p.cmd})`).join(', '));
    process.exitCode = bad.length === 0 ? 0 : 1;
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error('failed:', e.code, e.message);
  process.exit(1);
});
