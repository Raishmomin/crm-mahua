// QA gate 3 re-gate: a NASTIER committed rehearsal than rehearsal-commit.cjs, to try to break the
// G3-01 reset (supabase/seed/00_demo_reset.sql). Scratch DB mahua_qc* only.
// It touches SEEDED rows too (accepts seeded quote QTN-2627-0003, pays on seeded ORD-0003, packs ORD-0003,
// marks seeded INQ-0009 lost) and adds a new buyer + contact + note + an order on a NEW buyer.
// Each step runs in a savepoint and prints ok / error; the whole thing is COMMITTED.
// usage: node break-rehearsal.cjs mahua_qc_r3
const { Client } = require('/home/raish/raish/mahua-crm/node_modules/pg');
const db = process.argv[2];
if (!/^mahua_qc[a-z0-9_]*$/.test(db || '')) { console.error('refusing: scratch DB mahua_qc* only'); process.exit(2); }
const ORG = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222221';
const ACCT = '22222222-2222-4222-8222-222222222222';
const SALES = '22222222-2222-4222-8222-222222222223';
const OPS = '22222222-2222-4222-8222-222222222224';
const WMIN = '33333333-3333-4333-8333-333333333332';
const PKG1 = '44444444-4444-4444-8444-444444444441';
const QTN3 = '88888888-8888-4888-8888-888888888803';
const ORD3 = '99999999-9999-4999-8999-999999999903';
const INQ9 = '66666666-6666-4666-8666-666666666609';
const EVEREST = '55555555-5555-4555-8555-555555555551';
let c, sp = 0;
async function as(uid) {
  await c.query('RESET ROLE');
  await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [uid, JSON.stringify({ sub: uid, role: 'authenticated' })]);
  await c.query('SET LOCAL ROLE authenticated');
}
async function step(label, uid, sql, params = []) {
  await as(uid);
  const n = `s${++sp}`;
  await c.query(`SAVEPOINT ${n}`);
  try { const r = await c.query(sql, params); await c.query(`RELEASE SAVEPOINT ${n}`); console.log(`ok   ${label} ${JSON.stringify(r.rows[0] || {})}`); return r.rows; }
  catch (e) { await c.query(`ROLLBACK TO SAVEPOINT ${n}`); console.log(`err  ${label} ${e.code} ${e.message} ${e.detail || ''}`); return null; }
}
(async () => {
  c = new Client({ connectionString: `postgresql://postgres:postgres@127.0.0.1:5432/${db}` });
  await c.connect();
  await c.query('BEGIN');
  const b = await step('owner adds NEW buyer', OWNER, `INSERT INTO buyers (org_id, company_name, buyer_type, country, preferred_currency, payment_terms, city) VALUES ($1,'QA Break Foods','export_importer','UAE','USD','advance','Dubai') RETURNING id, buyer_code`, [ORG]);
  const NB = b && b[0].id;
  if (NB) await step('owner adds contact on NEW buyer', OWNER, `INSERT INTO buyer_contacts (org_id, buyer_id, name, phone, is_primary) VALUES ($1,$2,'QA Person','+971 50 000 0000',true) RETURNING id`, [ORG, NB]);
  if (NB) await step('owner note on NEW buyer', OWNER, `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note) VALUES ($1,'buyer',$2,$2,'QA break note') RETURNING id`, [ORG, NB]);
  await step('owner reminder on SEEDED buyer Everest', OWNER, `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on) VALUES ($1,'buyer',$2,$2,'QA break reminder',CURRENT_DATE) RETURNING id`, [ORG, EVEREST]);
  await step('owner accepts SEEDED quote QTN-2627-0003', OWNER, `SELECT fn_quote_accept($1, CURRENT_DATE+20, 30) id`, [QTN3]);
  await step('accountant pays on SEEDED ORD-0003 Rs 100000', ACCT, `SELECT fn_payment_record($1, 100000, CURRENT_DATE, 'bank', 'NEFT', NULL, NULL, NULL) id`, [ORD3]);
  await step('ops packs SEEDED ORD-0003', OPS, `SELECT fn_order_set_packed($1, 300)`, [ORD3]);
  await step('sales marks SEEDED INQ-0009 lost', SALES, `SELECT fn_inquiry_set_status($1,'lost','price')`, [INQ9]);
  if (NB) {
    const inq = await step('sales inquiry for NEW buyer', SALES, `INSERT INTO inquiries (org_id, buyer_id, buyer_name, phone, product_id, qty_kg, needed_by, source, assigned_to) VALUES ($1,$2,'QA Break Foods','+971 50 000 0000',$3,5000,CURRENT_DATE+30,'whatsapp',$4) RETURNING id, code`, [ORG, NB, WMIN, SALES]);
    const q = inq && await step('sales quote for NEW buyer', SALES, `INSERT INTO quotations (org_id, inquiry_id, buyer_id, currency, fx_rate, incoterm, valid_till, payment_terms) VALUES ($1,$2,$3,'USD',84.25,'FOB Pipavav',CURRENT_DATE+10,'100% advance') RETURNING id, quote_no`, [ORG, inq[0].id, NB]);
    if (q) {
      await step('quote item', SALES, `INSERT INTO quotation_items (org_id, quotation_id, product_id, packaging_type_id, qty_kg, unit, rate) VALUES ($1,$2,$3,$4,5000,'MT',2380) RETURNING id`, [ORG, q[0].id, WMIN, PKG1]);
      await step('send', SALES, `SELECT fn_quote_send($1)`, [q[0].id]);
      const o = await step('owner accepts NEW quote', OWNER, `SELECT fn_quote_accept($1, CURRENT_DATE+20, 100) id`, [q[0].id]);
      if (o) await step('accountant pays on NEW-buyer order', ACCT, `SELECT fn_payment_record($1, 5000, CURRENT_DATE, 'bank', 'TT', 421250, 84.25, NULL) id`, [o[0].id]);
    }
  }
  await c.query('RESET ROLE');
  await c.query('COMMIT');
  const r = await c.query(`SELECT (SELECT count(*) FROM buyers WHERE org_id=$1) buyers, (SELECT count(*) FROM orders WHERE org_id=$1) orders, (SELECT count(*) FROM payments WHERE org_id=$1) payments, (SELECT status FROM quotations WHERE id=$2) qtn3, (SELECT status FROM inquiries WHERE id=$3) inq9, (SELECT status FROM orders WHERE id=$4) ord3`, [ORG, QTN3, INQ9, ORD3]);
  console.log('COMMITTED break rehearsal on', db, JSON.stringify(r.rows[0]));
  await c.end();
})().catch((e) => { console.error('ERR', e.code, e.message, e.detail || ''); process.exit(1); });
