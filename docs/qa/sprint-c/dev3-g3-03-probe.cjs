// Dev-3 Sprint C fix round evidence for G3-03: money reminders are entity 'payment' and Plant's Home
// filter (rows only for modules the user holds) drops them. Everything runs in a rolled-back transaction.
// Usage: node docs/qa/sprint-c/dev3-g3-03-probe.cjs
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { Client } = require('pg');

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/onion_crm';
const OWNER = '22222222-2222-4222-8222-222222222221';
const OPS = '22222222-2222-4222-8222-222222222224';
const MOD = { inquiry: 'leads', buyer: 'buyers', quote: 'quotes', order: 'orders', payment: 'payments' };

async function as(c, uid) {
  await c.query('RESET ROLE');
  await c.query('SET LOCAL ROLE authenticated');
  await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true),
                        set_config('request.jwt.claims', json_build_object('sub', $1::text)::text, true)`, [uid]);
}

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  let fail = 0;
  const check = (name, ok, extra) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); if (!ok) fail++; };
  try {
    await c.query('BEGIN');
    await as(c, OWNER);
    const q = await c.query(`SELECT id FROM quotations WHERE status = 'sent' AND valid_till >= CURRENT_DATE ORDER BY created_at LIMIT 1`);
    const orderId = (await c.query(`SELECT fn_quote_accept($1, NULL, 30) AS id`, [q.rows[0].id])).rows[0].id;
    const adv = await c.query(`SELECT entity_type, note FROM follow_ups WHERE entity_id = $1 AND note LIKE 'Advance %'`, [orderId]);
    check('advance reminder written as payment', adv.rows.length === 1 && adv.rows[0].entity_type === 'payment', JSON.stringify(adv.rows));

    // Take the new order to ready and dispatch it (truck), to get the balance reminder.
    await c.query(`SELECT fn_order_set_status($1, 'in_production')`, [orderId]);
    await c.query(`SELECT fn_order_set_status($1, 'ready')`, [orderId]);
    const kg = (await c.query(`SELECT sum(qty_kg) AS kg FROM order_items WHERE order_id = $1`, [orderId])).rows[0].kg;
    await c.query(`SELECT fn_order_dispatch($1, 'truck', 'GJ04AB1234', NULL, NULL, 10, $2, NULL, NULL, NULL, NULL, NULL, CURRENT_DATE, NULL)`, [orderId, kg]);
    const bal = await c.query(`SELECT entity_type, note FROM follow_ups WHERE entity_id = $1 AND note LIKE 'Balance %'`, [orderId]);
    check('balance reminder written as payment', bal.rows.length === 1 && bal.rows[0].entity_type === 'payment', JSON.stringify(bal.rows));

    // Owner Home: the payment rows are kept (owner holds payments).
    const ownerMods = (await c.query(`SELECT fn_has_module('payments') AS p, fn_has_module('orders') AS o`)).rows[0];
    check('owner holds payments + orders (Home keeps the rows, links to /orders/{id})', ownerMods.p && ownerMods.o);

    // Plant Home: rows from v_followups_today filtered by the module of entity_type (page.tsx ENTITY_MODULE).
    await as(c, OPS);
    const rows = (await c.query(`SELECT entity_type, note FROM v_followups_today`)).rows;
    const mods = {};
    for (const m of Object.values(MOD)) mods[m] = (await c.query(`SELECT fn_has_module($1) AS h`, [m])).rows[0].h;
    const isMoney = (r) => /Balance|Advance|balance|₹|\$/.test(r.note);
    const shown = rows.filter((r) => mods[MOD[r.entity_type]]);
    const fromDefiners = shown.filter((r) => isMoney(r) && r.note !== 'Balance $18,900 due');
    check('Plant Home To do shows no money reminders written by the 0006 definers', fromDefiners.length === 0);
    const seeded = shown.filter(isMoney);
    console.log(`INFO with the current seed 02 Plant Home shows: ${JSON.stringify(seeded.map((r) => r.note))} (dev1: seed row cc..01 still entity 'order')`);
    // Simulate dev1's seed change (row cc..01 -> 'payment') inside this rolled-back transaction.
    await c.query('RESET ROLE');
    await c.query(`UPDATE follow_ups SET entity_type = 'payment' WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01'`);
    await as(c, OPS);
    const rows2 = (await c.query(`SELECT entity_type, note FROM v_followups_today`)).rows;
    const shown2 = rows2.filter((r) => mods[MOD[r.entity_type]]);
    check('with seed row as payment: Plant Home To do shows no money words', shown2.filter(isMoney).length === 0, `shown=${JSON.stringify(shown2.map((r) => r.note))}`);
    const apiPay = (await c.query(`SELECT count(*)::int AS n FROM follow_ups WHERE entity_type = 'payment'`)).rows[0].n;
    console.log(`INFO ops follow_ups SELECT sees ${apiPay} payment rows (0 once dev1's follow_ups_select A6 clause lands)`);
    // Plant order page: payment rows shown only with payments module (orders/[id]/page.tsx canPay).
    check('Plant has no payments module (order page hides payment notes)', mods.payments === false);
    await c.query('ROLLBACK');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('failed:', e.code, e.message);
    fail++;
  } finally {
    await c.end();
  }
  console.log(fail === 0 ? 'G3-03 PROBE OK' : `G3-03 PROBE: ${fail} failed`);
  process.exitCode = fail === 0 ? 0 : 1;
})();
