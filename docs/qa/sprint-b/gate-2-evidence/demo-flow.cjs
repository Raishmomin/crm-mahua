// QA gate 2, check 3: demo-script flow + negative paths by SQL on onion_crm.
// Everything runs in ONE transaction that is rolled back at the end.
const { Client } = require('/home/raish/raish/mahua-crm/node_modules/pg');

const ORG = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222221';
const ACCT = '22222222-2222-4222-8222-222222222222';
const SALES = '22222222-2222-4222-8222-222222222223';
const OPS = '22222222-2222-4222-8222-222222222224';
const ALB = '55555555-5555-4555-8555-555555555553'; // Al-Barakah
const EVEREST = '55555555-5555-4555-8555-555555555551';
const WMIN = '33333333-3333-4333-8333-333333333332';
const PKG1 = '44444444-4444-4444-8444-444444444441';
const ORD2 = '99999999-9999-4999-8999-999999999902';
const ORD3 = '99999999-9999-4999-8999-999999999903';
const DSP2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';
const DSP1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const QTN1 = '88888888-8888-4888-8888-888888888801';
const QTN2 = '88888888-8888-4888-8888-888888888802';
const QTN3 = '88888888-8888-4888-8888-888888888803';
const QTN4 = '88888888-8888-4888-8888-888888888804';
const SMP1 = '77777777-7777-4777-8777-777777777701';
const INQ2 = '66666666-6666-4666-8666-666666666602';
const INQ3 = '66666666-6666-4666-8666-666666666603';
const FU01 = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01';
const FU02 = 'cccccccc-cccc-4ccc-8ccc-cccccccccc02';
// cross-org fixture (created inside the transaction, rolled back)
const ORG_X = 'f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f9f9';
const OWNER_X = 'f9f9f9f9-0001-4f9f-8f9f-000000000001';
const BUYER_X = 'f9f9f9f9-cccc-4f9f-8f9f-cccccccccc01';

const NAMES = { [OWNER]: 'owner', [ACCT]: 'accountant', [SALES]: 'sales', [OPS]: 'ops(Plant)', [OWNER_X]: 'ownerX(other org)', postgres: 'postgres' };

let c;
let pass = 0, fail = 0;
const fails = [];
let sp = 0;

async function as(uid) {
  await c.query('RESET ROLE');
  if (uid === 'postgres') return;
  await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid]);
  await c.query('SET LOCAL ROLE authenticated');
}

// expect: 'ok' | {code, message?} ; keep=false rolls the step back (try-only)
async function step(label, uid, sql, params = [], expect = 'ok', keep = true) {
  await as(uid);
  const name = `s${++sp}`;
  await c.query(`SAVEPOINT ${name}`);
  let res, err;
  try { res = await c.query(sql, params); } catch (e) { err = e; }
  if (err || !keep) await c.query(`ROLLBACK TO SAVEPOINT ${name}`); else await c.query(`RELEASE SAVEPOINT ${name}`);
  let ok;
  let got;
  if (err) {
    got = `ERROR ${err.code} ${err.message}${err.detail ? ' [' + err.detail + ']' : ''}`;
    ok = expect !== 'ok' && (!expect.code || expect.code === err.code) && (!expect.message || (expect.message instanceof RegExp ? expect.message.test(err.message) : expect.message === err.message));
  } else {
    const rows = res.rows || [];
    got = `OK rows=${res.rowCount}${rows.length ? ' ' + JSON.stringify(rows.length === 1 ? rows[0] : rows) : ''}`;
    ok = expect === 'ok' || (expect.rows !== undefined && res.rowCount === expect.rows);
  }
  if (ok) pass++; else { fail++; fails.push(label); }
  const exp = expect === 'ok' ? 'ok' : JSON.stringify(expect, (k, v) => (v instanceof RegExp ? v.toString() : v));
  console.log(`${ok ? 'PASS' : 'FAIL'} [${NAMES[uid] || uid}] ${label}\n      expect ${exp}\n      got    ${got.slice(0, 700)}`);
  return res ? res.rows : null;
}

async function kpis(tag) {
  await as(OWNER);
  const k = (await c.query('SELECT new_inquiries, quotes_waiting, orders_in_production, money_due_inr, money_due_usd, money_due_about_inr, money_overdue_count, followups_today, papers_pending FROM v_home_kpis')).rows[0];
  console.log(`  KPIS ${tag}: ${JSON.stringify(k)}`);
  return k;
}
async function show(tag, uid, sql, params = []) {
  await as(uid);
  const r = await c.query(sql, params);
  console.log(`  ${tag} (${r.rowCount}):`);
  for (const row of r.rows) console.log('     ' + JSON.stringify(row));
  return r.rows;
}

(async () => {
  c = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/onion_crm' });
  await c.connect();
  await c.query('BEGIN');
  console.log('=== Baseline (seeded story)');
  const k0 = await kpis('before');

  console.log('\n=== 0:55 Sales creates inquiry for Al-Barakah');
  const inq = (await step('insert inquiry (6 fields)', SALES,
    `INSERT INTO inquiries (org_id, buyer_id, buyer_name, phone, product_id, qty_kg, needed_by, source, assigned_to)
     VALUES ($1,$2,'Al-Barakah Spice & Grain LLC','+971 4 223 9876',$3,12000,'2026-12-20','whatsapp',$4) RETURNING id, code, status`,
    [ORG, ALB, WMIN, SALES]))[0];
  console.log(`  -> ${inq.code} (expect INQ-0011)`);
  await kpis('after inquiry (new_inquiries +1)');
  await step('Reply on WhatsApp -> talking', SALES, `SELECT fn_inquiry_set_status($1,'talking',NULL)`, [inq.id]);

  console.log('\n=== 1:25 Sales sends sample');
  const smp = (await step('insert sample 500 g DHL', SALES,
    `INSERT INTO samples (org_id, inquiry_id, buyer_id, product_id, qty_grams, courier, tracking_no) VALUES ($1,$2,$3,$4,500,'DHL','7788 3001 22') RETURNING id, code, status`,
    [ORG, inq.id, ALB, WMIN]))[0];
  console.log(`  -> ${smp.code} (expect SMP-0004)`);
  await step('fn_sample_set_status sent', SALES, `SELECT fn_sample_set_status($1,'sent',NULL)`, [smp.id]);
  await show('inquiry + sample + follow-up', SALES,
    `SELECT i.status inquiry_status, s.status sample_status, s.sent_on, f.note, f.due_on, f.due_on - CURRENT_DATE AS due_in_days, f.buyer_id IS NOT NULL AS has_buyer
       FROM inquiries i JOIN samples s ON s.inquiry_id = i.id LEFT JOIN follow_ups f ON f.entity_type='inquiry' AND f.entity_id=i.id AND f.done=false WHERE i.id=$1`, [inq.id]);

  console.log('\n=== 1:50 Sales makes quote (floor guard)');
  const q = (await step('insert USD quote FOB Pipavav valid 10 days', SALES,
    `INSERT INTO quotations (org_id, inquiry_id, buyer_id, currency, fx_rate, incoterm, valid_till, payment_terms)
     VALUES ($1,$2,$3,'USD',84.25,'FOB Pipavav',CURRENT_DATE+10,'30% advance, 70% against BL copy') RETURNING id, quote_no, status`,
    [ORG, inq.id, ALB]))[0];
  console.log(`  -> ${q.quote_no} (expect QTN-2627-0005)`);
  const itemSql = `INSERT INTO quotation_items (org_id, quotation_id, product_id, packaging_type_id, qty_kg, unit, rate, spec_text) VALUES ($1,$2,$3,$4,12000,'MT',$5,'moisture <= 5.5%') RETURNING amount, floor_price_at_time, gst_rate`;
  await step('item at $2,100/MT as sales (below floor 2180)', SALES, itemSql, [ORG, q.id, WMIN, PKG1, 2100], { code: 'P0001', message: 'below_floor_price' });
  await step('item at $2,100/MT as owner (allowed, try-only)', OWNER, itemSql, [ORG, q.id, WMIN, PKG1, 2100], 'ok', false);
  await step('item at $2,380/MT as sales', SALES, itemSql, [ORG, q.id, WMIN, PKG1, 2380]);
  await show('quote totals', SALES, `SELECT quote_no, status, subtotal, gst_amount, total FROM quotations WHERE id=$1`, [q.id]);

  console.log('\n=== 2:20 Sales shares quote -> mark sent');
  await step('fn_quote_send', SALES, `SELECT fn_quote_send($1)`, [q.id]);
  await show('quote + inquiry + follow-up', SALES,
    `SELECT q.status, q.sent_at IS NOT NULL sent, i.status inquiry_status, f.note, f.due_on - CURRENT_DATE due_in_days FROM quotations q JOIN inquiries i ON i.id=q.inquiry_id LEFT JOIN follow_ups f ON f.entity_type='quote' AND f.entity_id=q.id WHERE q.id=$1`, [q.id]);
  await kpis('after quote sent (quotes_waiting 2)');
  await step('sales UPDATE sent quote rate via items (0 rows: policy)', SALES, `UPDATE quotation_items SET rate = 1 WHERE quotation_id=$1`, [q.id], { rows: 0 });
  await step('sales UPDATE sent quote header (0 rows: policy)', SALES, `UPDATE quotations SET payment_terms='x' WHERE id=$1`, [q.id], { rows: 0 });

  console.log('\n=== 2:30 Owner: Buyer accepted -> order + PI');
  await step('fn_quote_accept advance 101 -> bad_payload', OWNER, `SELECT fn_quote_accept($1, CURRENT_DATE+21, 101)`, [q.id], { code: 'P0001', message: 'bad_payload' });
  const ordId = (await step('fn_quote_accept(ship_by +21, 30)', OWNER, `SELECT fn_quote_accept($1, CURRENT_DATE+21, 30) AS order_id`, [q.id]))[0].order_id;
  await show('order', OWNER, `SELECT order_code, pi_no, status, currency, total, advance_expected, expected_dispatch - CURRENT_DATE ship_in_days, incoterm, payment_terms FROM orders WHERE id=$1`, [ordId]);
  await show('order items', OWNER, `SELECT qty_kg, unit, rate, amount, gst_rate FROM order_items WHERE order_id=$1`, [ordId]);
  await show('quote / inquiry / follow-ups after accept', OWNER,
    `SELECT (SELECT status FROM quotations WHERE id=$1) quote, (SELECT status FROM inquiries WHERE id=$2) inquiry, (SELECT closed_at IS NOT NULL FROM inquiries WHERE id=$2) inquiry_closed,
            (SELECT count(*) FROM follow_ups WHERE entity_type='quote' AND entity_id=$1 AND done=false) quote_fu_pending,
            (SELECT json_agg(json_build_object('note',note,'due_in',due_on-CURRENT_DATE)) FROM follow_ups WHERE entity_type='order' AND entity_id=$3 AND done=false) order_fu`, [q.id, inq.id, ordId]);
  await step('accept again -> invalid_transition', OWNER, `SELECT fn_quote_accept($1, NULL, 30)`, [q.id], { code: 'P0001', message: 'invalid_transition' });
  await kpis('after accept (quotes_waiting 1, orders_in_production 2, usd due +28560)');

  console.log('\n=== 3:05 Accountant records advance $8,568');
  await step('USD payment without amount_inr -> bad_payload', ACCT, `SELECT fn_payment_record($1, 8568, CURRENT_DATE, 'bank', 'TT', NULL, NULL, NULL)`, [ordId], { code: 'P0001', message: 'bad_payload' });
  const payId = (await step('fn_payment_record 8568 USD, 721854 INR @84.25', ACCT, `SELECT fn_payment_record($1, 8568, CURRENT_DATE, 'bank', 'TT ref QA1', 721854, 84.25, 'advance') AS id`, [ordId]))[0].id;
  await show('payment row', ACCT, `SELECT receipt_no, amount, currency, amount_inr, fx_rate, mode FROM payments WHERE id=$1`, [payId]);
  await show('v_order_balances ORD-0004', ACCT, `SELECT order_code, total, received, due, advance_ok, due_date, money_status FROM v_order_balances WHERE order_id=$1`, [ordId]);
  await show('advance follow-up after payment', ACCT, `SELECT note, done FROM follow_ups WHERE entity_type='order' AND entity_id=$1`, [ordId]);

  console.log('\n=== 3:45 Plant packs, loads (container)');
  await step('ops fn_order_set_packed while confirmed -> invalid_transition', OPS, `SELECT fn_order_set_packed($1, 480)`, [ordId], { code: 'P0001', message: 'invalid_transition' });
  await step('ops fn_order_dispatch while confirmed -> invalid_transition', OPS, `SELECT fn_order_dispatch($1,'truck','GJ04AB1',NULL,NULL,480,12000,NULL,NULL,NULL,NULL,NULL,CURRENT_DATE,NULL)`, [ordId], { code: 'P0001', message: 'invalid_transition' });
  await step('ops Packing started -> in_production', OPS, `SELECT fn_order_set_status($1,'in_production')`, [ordId]);
  await step('ops Packed 0 bags -> bad_payload', OPS, `SELECT fn_order_set_packed($1, 0)`, [ordId], { code: 'P0001', message: 'bad_payload' });
  await step('ops Packed 480 bags -> ready', OPS, `SELECT fn_order_set_packed($1, 480)`, [ordId]);
  await step('ops backwards ready -> in_production -> invalid_transition', OPS, `SELECT fn_order_set_status($1,'in_production')`, [ordId], { code: 'P0001', message: 'invalid_transition' });
  await step('ops backwards ready -> confirmed -> invalid_transition', OPS, `SELECT fn_order_set_status($1,'confirmed')`, [ordId], { code: 'P0001', message: 'invalid_transition' });
  await step('ops set dispatched directly -> invalid_transition', OPS, `SELECT fn_order_set_status($1,'dispatched')`, [ordId], { code: 'P0001', message: 'invalid_transition' });
  await step('container without port -> bad_payload', OPS, `SELECT fn_order_dispatch($1,'container',NULL,NULL,NULL,480,12000,'MSKU 111222-3',NULL,NULL,NULL,NULL,CURRENT_DATE,NULL)`, [ordId], { code: 'P0001', message: 'bad_payload' });
  await step('truck without vehicle -> bad_payload', OPS, `SELECT fn_order_dispatch($1,'truck',' ',NULL,NULL,480,12000,NULL,NULL,NULL,NULL,NULL,CURRENT_DATE,NULL)`, [ordId], { code: 'P0001', message: 'bad_payload' });
  await step('qty above order -> bad_payload', OPS, `SELECT fn_order_dispatch($1,'container',NULL,NULL,NULL,480,12001,'MSKU 111222-3','Pipavav',NULL,NULL,NULL,CURRENT_DATE,NULL)`, [ordId], { code: 'P0001', message: 'bad_payload' });
  const dspId = (await step('ops Loaded: fn_order_dispatch container', OPS,
    `SELECT fn_order_dispatch($1,'container',NULL,'PPV/CHA/9001','Seabridge Logistics (CHA)',NULL,12000,' msku 111222-3 ','Pipavav','MSC Test 001W',NULL,CURRENT_DATE+12,CURRENT_DATE,NULL) AS id`, [ordId]))[0].id;
  await show('dispatch row', OPS, `SELECT invoice_no, sdn_no, mode, container_no, port, bags_count, qty_kg, invoice_total, stuffing_date = dispatched_on AS stuffing_eq_dispatch, (SELECT count(*) FROM jsonb_each(export_checklist) e WHERE (e.value->>'done')::boolean) done_n, (SELECT count(*) FROM jsonb_each(export_checklist)) keys FROM dispatches WHERE id=$1`, [dspId]);
  await show('order after dispatch', OPS, `SELECT o.order_code, o.status, o.packed_bags, (SELECT sum(dispatched_kg) FROM order_items WHERE order_id=o.id) dispatched_kg FROM orders o WHERE id=$1`, [ordId]);
  await show('balance follow-up', OPS, `SELECT note, due_on - CURRENT_DATE due_in_days, done FROM follow_ups WHERE entity_type='order' AND entity_id=$1 ORDER BY created_at`, [ordId]);
  await step('second dispatch on dispatched order -> invalid_transition', OPS, `SELECT fn_order_dispatch($1,'truck','GJ04AB1',NULL,NULL,1,1,NULL,NULL,NULL,NULL,NULL,CURRENT_DATE,NULL)`, [ordId], { code: 'P0001', message: 'invalid_transition' });

  console.log('\n=== Export checklist ticks');
  await step('ops tick coa (allowed)', OPS, `SELECT fn_dispatch_tick($1,'coa',true,CURRENT_DATE,NULL)`, [dspId]);
  await step('ops tick phyto -> role_not_allowed 42501', OPS, `SELECT fn_dispatch_tick($1,'phyto',true,CURRENT_DATE,NULL)`, [dspId], { code: '42501', message: 'role_not_allowed' });
  await step('sales untick coa -> role_not_allowed 42501', SALES, `SELECT fn_dispatch_tick($1,'coa',false,NULL,NULL)`, [dspId], { code: '42501', message: 'role_not_allowed' });
  await step('accountant tick container_booked', ACCT, `SELECT fn_dispatch_tick($1,'container_booked',true,CURRENT_DATE-1,NULL)`, [dspId]);
  await step('accountant tick bl_received without BL -> bl_required', ACCT, `SELECT fn_dispatch_tick($1,'bl_received',true,CURRENT_DATE,'  ')`, [dspId], { code: 'P0001', message: 'bl_required' });
  await step('accountant tick bl_received with BL', ACCT, `SELECT fn_dispatch_tick($1,'bl_received',true,CURRENT_DATE,'MEDUQA0001')`, [dspId]);
  await step('accountant tick unknown key -> bad_payload', ACCT, `SELECT fn_dispatch_tick($1,'insurance',true,CURRENT_DATE,NULL)`, [dspId], { code: 'P0001', message: 'bad_payload' });
  await step('accountant tick on truck dispatch -> bad_payload', ACCT, `SELECT fn_dispatch_tick($1,'coo',true,CURRENT_DATE,NULL)`, [DSP1], { code: 'P0001', message: 'bad_payload' });
  await show('checklist after ticks', ACCT, `SELECT bl_no, (SELECT count(*) FROM jsonb_each(export_checklist) e WHERE (e.value->>'done')::boolean) done_n, export_checklist->'coa' coa, export_checklist->'container_booked' booked FROM dispatches WHERE id=$1`, [dspId]);
  await step('4:10 accountant ticks COO on ORD-0002 -> 8 of 8', ACCT, `SELECT fn_dispatch_tick($1,'coo',true,CURRENT_DATE,NULL)`, [DSP2]);

  console.log('\n=== 4:30 Owner reads Home views');
  const k1 = await kpis('after flow');
  await show('v_followups_today (owner)', OWNER, `SELECT entity_type, note, days_late, buyer_name FROM v_followups_today`);
  await show('v_money_due (owner)', OWNER, `SELECT buyer_name, currency, total_due, orders_due, max_days_overdue, money_status FROM v_money_due ORDER BY buyer_name`);
  await show('v_orders_in_production (owner)', OWNER, `SELECT order_code, status, planned_bags, packed_bags FROM v_orders_in_production`);
  await show('v_orders_in_production (ops)', OPS, `SELECT order_code, buyer_name, status, planned_bags, packed_bags FROM v_orders_in_production`);
  await step('4:38 owner Done on Everest row (fn_follow_up_done)', OWNER, `SELECT fn_follow_up_done($1)`, [FU02]);
  await step('fn_follow_up_done again (no-op)', OWNER, `SELECT fn_follow_up_done($1)`, [FU02]);
  const k2 = await kpis('after Done');
  console.log(`  DELTA new_inq ${k1.new_inquiries - k0.new_inquiries}, quotes_waiting ${k1.quotes_waiting - k0.quotes_waiting}, in_prod ${k1.orders_in_production - k0.orders_in_production}, usd_due ${Number(k1.money_due_usd) - Number(k0.money_due_usd)}, followups_today ${k1.followups_today - k0.followups_today} then ${k2.followups_today - k1.followups_today}, papers_pending ${k1.papers_pending - k0.papers_pending}`);

  console.log('\n=== Delivered / balance paid');
  await step('ops fn_dispatch_delivered -> role_not_allowed', OPS, `SELECT fn_dispatch_delivered($1, CURRENT_DATE)`, [dspId], { code: '42501', message: 'role_not_allowed' });
  await step('accountant fn_dispatch_delivered', ACCT, `SELECT fn_dispatch_delivered($1, CURRENT_DATE)`, [dspId]);
  await step('delivered twice -> invalid_transition', ACCT, `SELECT fn_dispatch_delivered($1, CURRENT_DATE)`, [dspId], { code: 'P0001', message: 'invalid_transition' });
  await step('balance $19,992 paid', ACCT, `SELECT fn_payment_record($1, 19992, CURRENT_DATE, 'bank', 'TT QA2', 1684326, NULL, NULL)`, [ordId]);
  await show('ORD-0004 money + open follow-ups', ACCT, `SELECT b.order_status, b.due, b.money_status, (SELECT count(*) FROM follow_ups f WHERE f.entity_id=b.order_id AND f.done=false) open_fu FROM v_order_balances b WHERE b.order_id=$1`, [ordId]);

  console.log('\n=== Negative: wrong role / missing module (42501)');
  await step('accountant (no leads) fn_inquiry_set_status', ACCT, `SELECT fn_inquiry_set_status($1,'talking',NULL)`, [INQ3], { code: '42501' });
  await step('ops (no leads) insert inquiry', OPS, `INSERT INTO inquiries (org_id, buyer_name) VALUES ($1,'X')`, [ORG], { code: '42501' });
  await step('sales lost -> talking (Reopen) -> role_not_allowed', SALES, `SELECT fn_inquiry_set_status($1,'talking',NULL)`, [INQ3], { code: '42501', message: 'role_not_allowed' });
  await step('sales set won directly -> invalid_transition', SALES, `SELECT fn_inquiry_set_status($1,'won',NULL)`, ['66666666-6666-4666-8666-666666666607'], { code: 'P0001', message: 'invalid_transition' });
  await step('sales won -> talking (backwards) -> invalid_transition', SALES, `SELECT fn_inquiry_set_status($1,'talking',NULL)`, [INQ2], { code: 'P0001', message: 'invalid_transition' });
  await step('sales lost without reason -> reason_required', SALES, `SELECT fn_inquiry_set_status($1,'lost',NULL)`, ['66666666-6666-4666-8666-666666666607'], { code: 'P0001', message: 'reason_required' });
  await step('accountant (no leads) fn_follow_up_done on inquiry row', ACCT, `SELECT fn_follow_up_done($1)`, ['cccccccc-cccc-4ccc-8ccc-cccccccccc03'], { code: '42501' });
  await step('accountant (no samples) fn_sample_set_status', ACCT, `SELECT fn_sample_set_status($1,'approved','x')`, ['77777777-7777-4777-8777-777777777702'], { code: '42501' });
  await step('sales approved -> sent (backwards) -> invalid_transition', SALES, `SELECT fn_sample_set_status($1,'sent',NULL)`, [SMP1], { code: 'P0001', message: 'invalid_transition' });
  await step('ops (no quotes) fn_quote_send', OPS, `SELECT fn_quote_send($1)`, [QTN4], { code: '42501' });
  await step('ops (no quotes) fn_quote_reject', OPS, `SELECT fn_quote_reject($1,'price')`, [QTN3], { code: '42501' });
  await step('ops (no quotes) fn_quote_accept', OPS, `SELECT fn_quote_accept($1,NULL,30)`, [QTN3], { code: '42501' });
  await step('sales cancel order -> role_not_allowed', SALES, `SELECT fn_order_set_status($1,'cancelled')`, [ORD3], { code: '42501', message: 'role_not_allowed' });
  await step('sales (no payments) fn_payment_record', SALES, `SELECT fn_payment_record($1, 100, CURRENT_DATE, 'bank')`, [ORD3], { code: '42501' });
  await step('ops (no payments) fn_payment_record', OPS, `SELECT fn_payment_record($1, 100, CURRENT_DATE, 'bank')`, [ORD3], { code: '42501' });
  // remove 'orders' from sales for the orders functions (try-only, profile change rolled back)
  await as('postgres');
  await c.query('SAVEPOINT nomod');
  await c.query(`UPDATE profiles SET modules = array_remove(modules, 'orders') WHERE id=$1`, [SALES]);
  await step('sales without orders module: fn_order_set_status', SALES, `SELECT fn_order_set_status($1,'ready')`, [ORD3], { code: '42501' });
  await step('sales without orders module: fn_order_set_packed', SALES, `SELECT fn_order_set_packed($1, 200)`, [ORD3], { code: '42501' });
  await step('sales without orders module: fn_order_dispatch', SALES, `SELECT fn_order_dispatch($1,'truck','GJ1',NULL,NULL,1,1,NULL,NULL,NULL,NULL,NULL,CURRENT_DATE,NULL)`, [ORD3], { code: '42501' });
  await step('sales without orders module: fn_dispatch_tick', SALES, `SELECT fn_dispatch_tick($1,'coa',true,CURRENT_DATE,NULL)`, [DSP2], { code: '42501' });
  await step('sales without orders module: fn_dispatch_delivered', SALES, `SELECT fn_dispatch_delivered($1, CURRENT_DATE)`, [DSP2], { code: '42501' });
  await as('postgres');
  await c.query('ROLLBACK TO SAVEPOINT nomod');

  console.log('\n=== Negative: direct writes on function-only tables');
  await step('sales INSERT payments', SALES, `INSERT INTO payments (org_id, receipt_no, order_id, buyer_id, amount, currency, mode) VALUES ($1,'REC-X',$2,$3,1,'INR','cash')`, [ORG, ORD3, '55555555-5555-4555-8555-555555555552'], { code: '42501' });
  await step('accountant INSERT payments', ACCT, `INSERT INTO payments (org_id, receipt_no, order_id, buyer_id, amount, currency, mode) VALUES ($1,'REC-X',$2,$3,1,'INR','cash')`, [ORG, ORD3, '55555555-5555-4555-8555-555555555552'], { code: '42501' });
  await step('owner INSERT orders', OWNER, `INSERT INTO orders (org_id, order_code, pi_no, buyer_id, currency, incoterm, payment_terms) VALUES ($1,'ORD-X','PI-X',$2,'INR','EXW','x')`, [ORG, EVEREST], { code: '42501' });
  await step('ops UPDATE orders status', OPS, `UPDATE orders SET status='delivered' WHERE id=$1`, [ORD3], { code: '42501' });
  await step('ops UPDATE dispatches checklist', OPS, `UPDATE dispatches SET export_checklist='{}' WHERE id=$1`, [DSP2], { code: '42501' });
  await step('accountant DELETE payments', ACCT, `DELETE FROM payments WHERE order_id=$1`, [ORD3], { code: '42501' });
  await step('owner INSERT order_items', OWNER, `INSERT INTO order_items (org_id, order_id, product_id, qty_kg, unit, rate, amount) VALUES ($1,$2,$3,1,'kg',1,1)`, [ORG, ORD3, WMIN], { code: '42501' });
  await step('sales UPDATE follow_ups done=true (column lock)', SALES, `UPDATE follow_ups SET done=true WHERE id=$1`, [FU01], { code: '42501' });
  await step('sales UPDATE inquiries status (column lock)', SALES, `UPDATE inquiries SET status='won' WHERE id=$1`, [INQ3], { code: '42501' });
  await step('sales INSERT quotation as sent (policy)', SALES, `INSERT INTO quotations (org_id, buyer_id, status) VALUES ($1,$2,'sent')`, [ORG, EVEREST], { code: '42501' });
  await step('sales call fn_next_code (locked)', SALES, `SELECT fn_next_code('ORD')`, [], { code: '42501' });

  console.log('\n=== Negative: accept expired / rejected / accepted / draft quotes');
  await as('postgres');
  await c.query('SAVEPOINT exp');
  await c.query(`UPDATE quotations SET valid_till = CURRENT_DATE - 1 WHERE id=$1`, [QTN3]);
  await step('accept sent quote past valid_till -> quote_expired', OWNER, `SELECT fn_quote_accept($1,NULL,0)`, [QTN3], { code: 'P0001', message: 'quote_expired' });
  await kpis('QTN-0003 past valid_till (quotes_waiting excludes it)');
  await as('postgres');
  await c.query('ROLLBACK TO SAVEPOINT exp');
  await step('accept rejected QTN-0002 -> invalid_transition', OWNER, `SELECT fn_quote_accept($1,NULL,50)`, [QTN2], { code: 'P0001', message: 'invalid_transition' });
  await step('accept accepted QTN-0001 -> invalid_transition', OWNER, `SELECT fn_quote_accept($1,NULL,30)`, [QTN1], { code: 'P0001', message: 'invalid_transition' });
  await step('accept draft QTN-0004 -> invalid_transition', OWNER, `SELECT fn_quote_accept($1,NULL,0)`, [QTN4], { code: 'P0001', message: 'invalid_transition' });
  await step('reject without reason -> reason_required', SALES, `SELECT fn_quote_reject($1,NULL)`, [QTN3], { code: 'P0001', message: 'reason_required' });

  console.log('\n=== Negative: owner cancel (try-only)');
  await as('postgres');
  await c.query('SAVEPOINT cancel');
  await step('owner cancel ORD-0003 (in_production)', OWNER, `SELECT fn_order_set_status($1,'cancelled')`, [ORD3]);
  await kpis('ORD-0003 cancelled (INR due drops 511875, in_prod -1)');
  await step('payment on cancelled order -> invalid_transition', ACCT, `SELECT fn_payment_record($1, 100, CURRENT_DATE, 'bank')`, [ORD3], { code: 'P0001', message: 'invalid_transition' });
  await step('cancelled -> in_production -> invalid_transition', OWNER, `SELECT fn_order_set_status($1,'in_production')`, [ORD3], { code: 'P0001', message: 'invalid_transition' });
  await as('postgres');
  await c.query('ROLLBACK TO SAVEPOINT cancel');

  console.log('\n=== Negative: cross-org (other org owner, ids of MDPL rows)');
  await as('postgres');
  await c.query(`INSERT INTO organizations (id, name, code) VALUES ($1,'QA Other Org','QAX')`, [ORG_X]);
  await c.query(`INSERT INTO auth.users (id, email) VALUES ($1,'owner@qax.test')`, [OWNER_X]);
  await c.query(`INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active) VALUES ($1,$2,'owner@qax.test','Owner X','owner',ARRAY['dashboard','leads','buyers','samples','quotes','orders','payments','catalog','users','settings'],true)`, [OWNER_X, ORG_X]);
  await c.query(`INSERT INTO buyers (id, org_id, company_name, buyer_code, buyer_type) VALUES ($1,$2,'Other Org Buyer','BUY-X1',(SELECT buyer_type FROM buyers LIMIT 1))`, [BUYER_X, ORG_X]);
  const X = OWNER_X;
  await step('X fn_quote_accept(MDPL QTN-0003)', X, `SELECT fn_quote_accept($1,NULL,30)`, [QTN3], { code: '42501', message: 'not_found' });
  await step('X fn_quote_send(MDPL QTN-0004)', X, `SELECT fn_quote_send($1)`, [QTN4], { code: '42501', message: 'not_found' });
  await step('X fn_quote_reject(MDPL QTN-0003)', X, `SELECT fn_quote_reject($1,'price')`, [QTN3], { code: '42501', message: 'not_found' });
  await step('X fn_inquiry_set_status(MDPL INQ-0007)', X, `SELECT fn_inquiry_set_status($1,'lost','price')`, ['66666666-6666-4666-8666-666666666607'], { code: '42501', message: 'not_found' });
  await step('X fn_sample_set_status(MDPL SMP-0002)', X, `SELECT fn_sample_set_status($1,'approved',NULL)`, ['77777777-7777-4777-8777-777777777702'], { code: '42501', message: 'not_found' });
  await step('X fn_follow_up_done(MDPL follow-up)', X, `SELECT fn_follow_up_done($1)`, [FU01], { code: '42501', message: 'not_found' });
  await step('X fn_order_set_status(MDPL ORD-0003)', X, `SELECT fn_order_set_status($1,'cancelled')`, [ORD3], { code: '42501', message: 'not_found' });
  await step('X fn_order_set_packed(MDPL ORD-0003)', X, `SELECT fn_order_set_packed($1, 1)`, [ORD3], { code: '42501', message: 'not_found' });
  await step('X fn_order_dispatch(MDPL ORD-0003)', X, `SELECT fn_order_dispatch($1,'truck','GJ1',NULL,NULL,1,1,NULL,NULL,NULL,NULL,NULL,CURRENT_DATE,NULL)`, [ORD3], { code: '42501', message: 'not_found' });
  await step('X fn_dispatch_tick(MDPL dispatch)', X, `SELECT fn_dispatch_tick($1,'coo',false,NULL,NULL)`, [DSP2], { code: '42501', message: 'not_found' });
  await step('X fn_dispatch_delivered(MDPL dispatch)', X, `SELECT fn_dispatch_delivered($1, CURRENT_DATE)`, [DSP2], { code: '42501', message: 'not_found' });
  await step('X fn_payment_record(MDPL ORD-0002)', X, `SELECT fn_payment_record($1, 1, CURRENT_DATE, 'bank', NULL, 1, NULL, NULL)`, [ORD2], { code: '42501', message: 'not_found' });
  await show('X sees MDPL rows (all should be 0)', X, `SELECT (SELECT count(*) FROM orders WHERE org_id=$1) orders, (SELECT count(*) FROM payments WHERE org_id=$1) payments, (SELECT count(*) FROM dispatches WHERE org_id=$1) dispatches, (SELECT count(*) FROM v_order_balances WHERE org_id=$1) balances, (SELECT count(*) FROM v_money_due WHERE org_id=$1) money_due, (SELECT count(*) FROM v_followups_today WHERE org_id=$1) todo, (SELECT count(*) FROM inquiries WHERE org_id=$1) inquiries, (SELECT count(*) FROM quotations WHERE org_id=$1) quotes`, [ORG]);
  await show('X v_home_kpis (own org only, zeros)', X, `SELECT org_id, new_inquiries, quotes_waiting, orders_in_production, money_due_inr, money_due_usd, followups_today FROM v_home_kpis`);
  await step('X UPDATE MDPL buyer (0 rows)', X, `UPDATE buyers SET credit_period_days = 99 WHERE id=$1`, [ALB], { rows: 0 });

  console.log('\n=== Probes: cross-org references and floor-guard bypasses (expected to be REFUSED)');
  await step('PROBE sales INSERT sample with other-org buyer_id', SALES, `INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1,$2,$3) RETURNING code`, [ORG, BUYER_X, WMIN], { code: '42501' }, false);
  await step('PROBE sales INSERT quotation with other-org buyer_id', SALES, `INSERT INTO quotations (org_id, buyer_id, currency) VALUES ($1,$2,'INR') RETURNING quote_no`, [ORG, BUYER_X], { code: '42501' }, false);
  await step('PROBE sales INSERT inquiry with other-org buyer_id', SALES, `INSERT INTO inquiries (org_id, buyer_id, buyer_name) VALUES ($1,$2,'x') RETURNING code`, [ORG, BUYER_X], { code: '42501' }, false);
  // Floor bypass A: currency without a price-list row (EUR) -> no floor at all
  await as('postgres'); await c.query('SAVEPOINT fb1');
  const qe = (await step('PROBE sales EUR quote', SALES, `INSERT INTO quotations (org_id, buyer_id, currency, incoterm, payment_terms) VALUES ($1,$2,'EUR','CIF','LC at sight') RETURNING id, quote_no`, [ORG, '55555555-5555-4555-8555-555555555554']))[0];
  await step('PROBE sales EUR item W-MIN-A at 1 per MT (expect below_floor_price)', SALES, itemSql, [ORG, qe.id, WMIN, PKG1, 1], { code: 'P0001', message: 'below_floor_price' });
  await step('PROBE sales fn_quote_send EUR 1/MT quote (expect refused)', SALES, `SELECT fn_quote_send($1)`, [qe.id], { code: 'P0001', message: 'below_floor_price' });
  const eurOrder = await step('PROBE sales accept EUR 1/MT quote -> order (expect refused)', SALES, `SELECT fn_quote_accept($1, NULL, 0) AS id`, [qe.id], { code: 'P0001' });
  if (eurOrder) await show('PROBE EUR order created', SALES, `SELECT order_code, currency, total FROM orders WHERE id=$1`, [eurOrder[0].id]);
  await as('postgres'); await c.query('ROLLBACK TO SAVEPOINT fb1');
  // Floor bypass B: valid USD item, then switch the draft header to INR
  await as('postgres'); await c.query('SAVEPOINT fb2');
  const qu = (await step('PROBE sales USD quote', SALES, `INSERT INTO quotations (org_id, buyer_id, currency, fx_rate, incoterm) VALUES ($1,$2,'USD',84.25,'FOB Pipavav') RETURNING id, quote_no`, [ORG, ALB]))[0];
  await step('PROBE sales USD item 2380/MT', SALES, itemSql, [ORG, qu.id, WMIN, PKG1, 2380]);
  await step('PROBE sales UPDATE draft currency USD -> INR (expect refused or items re-checked)', SALES, `UPDATE quotations SET currency='INR', fx_rate=NULL WHERE id=$1 RETURNING currency, subtotal, gst_amount, total`, [qu.id], { code: 'P0001' });
  await step('PROBE sales fn_quote_send INR quote at Rs 2380/MT = Rs 2.38/kg (floor Rs 175/kg)', SALES, `SELECT fn_quote_send($1)`, [qu.id], { code: 'P0001', message: 'below_floor_price' });
  await show('PROBE resulting quote', SALES, `SELECT q.quote_no, q.status, q.currency, q.total, i.unit, i.rate, i.floor_price_at_time, i.gst_rate FROM quotations q JOIN quotation_items i ON i.quotation_id=q.id WHERE q.id=$1`, [qu.id]);
  await as('postgres'); await c.query('ROLLBACK TO SAVEPOINT fb2');
  // Plant writes buyers (flows.md 11: Plant cannot New / edit buyer)
  await step('PROBE ops UPDATE buyer credit days (flows.md 11: Plant may not edit buyers)', OPS, `UPDATE buyers SET credit_period_days = 90 WHERE id=$1 RETURNING credit_period_days`, [ALB], { code: '42501' }, false);
  await step('PROBE ops INSERT buyer', OPS, `INSERT INTO buyers (org_id, company_name, buyer_type) VALUES ($1,'Plant made buyer','domestic_masala') RETURNING buyer_code`, [ORG], { code: '42501' }, false);
  // Sales deletes money-chasing reminder / approved sample
  await step('PROBE sales DELETE order follow-up "Balance $18,900 due"', SALES, `DELETE FROM follow_ups WHERE id=$1`, [FU01], { rows: 0 }, false);
  await step('PROBE sales DELETE approved sample SMP-0001', SALES, `DELETE FROM samples WHERE id=$1`, [SMP1], { rows: 0 }, false);

  await c.query('ROLLBACK');
  console.log(`\nROLLED BACK. ${pass} pass, ${fail} fail`);
  if (fails.length) console.log('FAILED: ' + fails.join(' | '));
  await c.end();
})().catch(async (e) => { console.error('SCRIPT ERROR', e); try { await c.query('ROLLBACK'); } catch {} process.exit(2); });
