// Dev-1 Sprint C fix round (G3-03 / A6): what Plant and the owner read from follow_ups / v_followups_today
// on the seeded demo org. Usage: node docs/qa/sprint-c/dev1-plant-money.cjs (DATABASE_URL from env, else .env.local)
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { Client } = require('pg');
const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/onion_crm';
const USERS = { owner: '22222222-2222-4222-8222-222222222221', accountant: '22222222-2222-4222-8222-222222222222', sales: '22222222-2222-4222-8222-222222222223', plant: '22222222-2222-4222-8222-222222222224' };
(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  let bad = 0;
  for (const [who, uid] of Object.entries(USERS)) {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [uid, JSON.stringify({ sub: uid, role: 'authenticated' })]);
    await c.query('SET LOCAL ROLE authenticated');
    const pay = (await c.query(`SELECT count(*)::int n FROM follow_ups WHERE entity_type = 'payment'`)).rows[0].n;
    const today = (await c.query(`SELECT entity_type, note FROM v_followups_today`)).rows;
    const money = today.filter((r) => /\$|₹|Balance|Advance/.test(r.note));
    const kpi = (await c.query(`SELECT followups_today FROM v_home_kpis`)).rows[0];
    let done = 'n/a';
    if (who === 'plant') {
      try { await c.query(`SELECT fn_follow_up_done('cccccccc-cccc-4ccc-8ccc-cccccccccc01')`); done = 'TICKED (bad)'; bad++; }
      catch (e) { done = `${e.code} ${e.message}`; }
    }
    console.log(`${who}: payment follow_ups=${pay}, to-do rows=${today.length}, money to-do rows=${money.map((r) => r.note).join(' | ') || 'none'}, kpi followups_today=${kpi.followups_today}, tick balance reminder: ${done}`);
    if (who === 'plant' && (pay !== 0 || money.length !== 0)) bad++;
    if (who !== 'plant' && pay < 1) bad++;
    await c.query('ROLLBACK');
  }
  console.log(bad === 0 ? 'PLANT MONEY CHECK OK' : `PLANT MONEY CHECK FAILED (${bad})`);
  await c.end();
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
