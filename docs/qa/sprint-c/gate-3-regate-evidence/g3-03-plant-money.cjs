// QA gate 3 re-gate: G3-03 end to end. Plays the demo script up to dispatch + BL inside ONE rolled-back
// transaction on onion_crm, and after each step shows the Home "To do today" list per role exactly as
// src/app/(dashboard)/page.tsx builds it (v_followups_today, then ENTITY_MODULE filter on profile.modules),
// next to v_home_kpis.followups_today. Then tries to break A6 for reminders as Plant.
// (run 2: BL key fixed to 'bl_received'; the kpi-vs-list check made INFO, since Home renders todos.length, not the KPI)
// usage: node g3-03-plant-money.cjs [db]
const { Client } = require('/home/raish/raish/mahua-crm/node_modules/pg');
const ORG = '11111111-1111-4111-8111-111111111111';
const U = { owner: '22222222-2222-4222-8222-222222222221', accountant: '22222222-2222-4222-8222-222222222222', sales: '22222222-2222-4222-8222-222222222223', plant: '22222222-2222-4222-8222-222222222224' };
const ALB = '55555555-5555-4555-8555-555555555553';
const WMIN = '33333333-3333-4333-8333-333333333332';
const PKG1 = '44444444-4444-4444-8444-444444444441';
const FU01 = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01';
const ENTITY_MODULE = { inquiry: 'leads', buyer: 'buyers', quote: 'quotes', order: 'orders', payment: 'payments' };
const MONEY = /[$₹]|advance|balance|paid|payment|receipt|\bdue\b/i;
let c, pass = 0, fail = 0, sp = 0;
const ok = (cond, label, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${extra ? ' ' + extra : ''}`); };
async function as(who) {
  await c.query('RESET ROLE');
  await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [U[who], JSON.stringify({ sub: U[who], role: 'authenticated' })]);
  await c.query('SET LOCAL ROLE authenticated');
}
async function run(who, sql, params = []) {
  await as(who);
  const n = `s${++sp}`;
  await c.query(`SAVEPOINT ${n}`);
  try { const r = await c.query(sql, params); await c.query(`RELEASE SAVEPOINT ${n}`); return { rows: r.rows, rowCount: r.rowCount }; }
  catch (e) { await c.query(`ROLLBACK TO SAVEPOINT ${n}`); return { err: e }; }
}
async function home(tag) {
  console.log(`\n--- Home To do after: ${tag}`);
  const out = {};
  for (const who of Object.keys(U)) {
    const mods = (await run(who, `SELECT modules FROM profiles WHERE id=$1`, [U[who]])).rows[0].modules;
    const rows = (await run(who, `SELECT entity_type, note, days_late FROM v_followups_today`)).rows;
    const kpi = Number((await run(who, `SELECT followups_today FROM v_home_kpis`)).rows[0].followups_today);
    const list = rows.filter((r) => mods.includes(ENTITY_MODULE[r.entity_type]));
    const money = list.filter((r) => MONEY.test(r.note)).map((r) => r.note);
    console.log(`  ${who.padEnd(10)} kpi=${kpi} list=${list.length} money rows in list=${JSON.stringify(money)}`);
    out[who] = { kpi, list: list.length, money };
  }
  ok(out.plant.money.length === 0, `[${tag}] Plant Home To do shows no money reminder`);
  // v_home_kpis.followups_today is not rendered anywhere (Home shows todos.length), so kpi vs list is INFO only.
  ok(out.owner.money.length > 0 && out.accountant.money.length > 0, `[${tag}] owner and accountant still see money reminders`);
  const api = await run('plant', `SELECT count(*)::int n FROM follow_ups WHERE entity_type='payment' OR note ~* '(advance|balance).*due|ask for balance'`);
  ok(api.rows[0].n === 0, `[${tag}] Plant API read of follow_ups: 0 payment / money-reminder rows`, `(${api.rows[0].n})`);
  return out;
}
(async () => {
  c = new Client({ connectionString: `postgresql://postgres:postgres@127.0.0.1:5432/${process.argv[2] || 'onion_crm'}` });
  await c.connect();
  await c.query('BEGIN');
  await home('seed (demo start)');

  const inq = (await run('sales', `INSERT INTO inquiries (org_id, buyer_id, buyer_name, phone, product_id, qty_kg, needed_by, source, assigned_to) VALUES ($1,$2,'Al-Barakah Spice & Grain LLC','+971 4 223 9876',$3,12000,'2026-12-20','whatsapp',$4) RETURNING id, code`, [ORG, ALB, WMIN, U.sales])).rows[0];
  const q = (await run('sales', `INSERT INTO quotations (org_id, inquiry_id, buyer_id, currency, fx_rate, incoterm, valid_till, payment_terms) VALUES ($1,$2,$3,'USD',84.25,'FOB Pipavav',CURRENT_DATE+10,'30% advance, 70% against BL copy') RETURNING id, quote_no`, [ORG, inq.id, ALB])).rows[0];
  await run('sales', `INSERT INTO quotation_items (org_id, quotation_id, product_id, packaging_type_id, qty_kg, unit, rate) VALUES ($1,$2,$3,$4,12000,'MT',2380)`, [ORG, q.id, WMIN, PKG1]);
  await run('sales', `SELECT fn_quote_send($1)`, [q.id]);
  const acc = await run('owner', `SELECT fn_quote_accept($1, CURRENT_DATE+17, 30) id`, [q.id]);
  const ord = acc.rows[0].id;
  console.log(`\n${inq.code} / ${q.quote_no} accepted -> order ${ord}`);
  const adv = await run('owner', `SELECT entity_type, note, done FROM follow_ups WHERE entity_id=$1 AND note LIKE 'Advance %'`, [ord]);
  ok(adv.rows.length === 1 && adv.rows[0].entity_type === 'payment', 'fn_quote_accept writes the Advance reminder as entity payment', JSON.stringify(adv.rows));
  const h1 = await home('quote accepted (advance reminder open)');

  // Plant tries to tick / change / read the advance reminder
  const advId = (await run('owner', `SELECT id FROM follow_ups WHERE entity_id=$1 AND note LIKE 'Advance %'`, [ord])).rows[0].id;
  const t1 = await run('plant', `SELECT fn_follow_up_done($1)`, [advId]);
  ok(t1.err && t1.err.code === '42501' && t1.err.message === 'not_found', 'Plant fn_follow_up_done(Advance reminder) -> 42501 not_found', t1.err ? `${t1.err.code} ${t1.err.message}` : 'NO ERROR');
  const t2 = await run('plant', `UPDATE follow_ups SET done=true WHERE id=$1`, [advId]);
  ok(!t2.err ? t2.rowCount === 0 : true, 'Plant direct UPDATE of Advance reminder changes 0 rows', t2.err ? `${t2.err.code} ${t2.err.message}` : `rows=${t2.rowCount}`);
  const t3 = await run('plant', `SELECT fn_follow_up_done($1)`, [FU01]);
  ok(t3.err && t3.err.message === 'not_found', 'Plant fn_follow_up_done(seeded Balance $18,900) -> not_found', t3.err ? `${t3.err.code} ${t3.err.message}` : 'NO ERROR');
  const t4 = await run('plant', `SELECT note FROM follow_ups WHERE id=$1`, [FU01]);
  ok(t4.rows && t4.rows.length === 0, 'Plant SELECT seeded Balance row by id -> 0 rows');

  await run('accountant', `SELECT fn_payment_record($1, 8568, CURRENT_DATE, 'bank', 'TT', 721854, 84.25, NULL)`, [ord]);
  const adv2 = await run('owner', `SELECT done FROM follow_ups WHERE id=$1`, [advId]);
  ok(adv2.rows[0].done === true, 'advance payment ticks the Advance reminder done (mark-done matches payment rows)');
  await home('advance received');

  const p1 = await run('plant', `SELECT fn_order_set_status($1,'in_production')`, [ord]);
  const p2 = await run('plant', `SELECT fn_order_set_packed($1, 480)`, [ord]);
  ok(!p1.err && !p2.err, 'Plant: Packing started + Packed (demo 3:25) work', p1.err ? p1.err.message : p2.err ? p2.err.message : '');
  await home('Plant packed (demo 3:25)');

  const d = await run('plant', `SELECT fn_order_dispatch($1,'container',NULL,NULL,'Seabridge CHA',480,12000,'MSKU 123456 7','Pipavav','MSC Aurora',CURRENT_DATE,CURRENT_DATE+20,CURRENT_DATE,NULL) id`, [ord]);
  ok(!d.err, 'Plant dispatches the order (container)', d.err ? `${d.err.code} ${d.err.message} ${d.err.detail || ''}` : '');
  const bal = await run('owner', `SELECT entity_type, note FROM follow_ups WHERE entity_id=$1 AND note LIKE 'Balance %'`, [ord]);
  ok(bal.rows.length === 1 && bal.rows[0].entity_type === 'payment', 'fn_order_dispatch writes the Balance reminder as entity payment', JSON.stringify(bal.rows));
  if (d.rows) {
    const dsp = (await run('owner', `SELECT id FROM dispatches WHERE order_id=$1`, [ord])).rows[0].id;
    const bl = await run('accountant', `SELECT fn_dispatch_tick($1,'bl_received',true,CURRENT_DATE,'MEDU1234567')`, [dsp]);
    const blr = await run('owner', `SELECT entity_type, note FROM follow_ups WHERE entity_id=$1 AND note LIKE 'BL received%'`, [ord]);
    ok(!bl.err && blr.rows.length === 1 && blr.rows[0].entity_type === 'payment', 'fn_dispatch_tick(bl) writes "BL received - ask for balance" as entity payment', bl.err ? bl.err.message : JSON.stringify(blr.rows));
  }
  const h5 = await home('dispatched + BL received');
  const notes = await run('plant', `SELECT entity_type, note FROM follow_ups WHERE entity_id=$1`, [ord]);
  ok(notes.rows.every((r) => !MONEY.test(r.note)), 'Plant order page notes (follow_ups for the order) carry no money words', JSON.stringify(notes.rows));
  console.log(`\nINFO sales Home: tile=${h5.sales.kpi} list=${h5.sales.list} (sales has orders but not payments; payment rows are counted by the KPI, filtered from the list)`);

  await c.query('ROLLBACK');
  console.log(`\nROLLED BACK. ${pass} pass, ${fail} fail${fail ? '' : '  G3-03 PLANT MONEY OK'}`);
  await c.end();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error('SCRIPT ERROR', e.code, e.message, e.detail || ''); try { await c.query('ROLLBACK'); } catch {} process.exit(2); });
