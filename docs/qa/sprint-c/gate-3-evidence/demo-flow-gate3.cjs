// QA GATE 3 (Sprint C final): the demo-script flow + every Sprint B negative path and re-gate probe,
// updated for Sprint C (fn_sample_create one call, A6 Plant money, A7 step_dates, A8 payment caps,
// A9 starts/deletes, G2-05 now refused), then the Sprint C probes (section 'SPRINT C').
// Copied from docs/qa/sprint-b/gate-2-regate-evidence/demo-flow-regate.cjs. Usage: node demo-flow-gate3.cjs [db]
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
  // SEC1-05: set both the local-shim GUC and the Supabase-style claims JSON.
  await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [uid, JSON.stringify({ sub: uid, role: 'authenticated' })]);
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
    ok = expect !== 'ok' && (!expect.code || expect.code === err.code) && (!expect.message || (expect.message instanceof RegExp ? expect.message.test(err.message) : expect.message === err.message)) && (!expect.detail || expect.detail === err.detail);
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
  c = new Client({ connectionString: `postgresql://postgres:postgres@127.0.0.1:5432/${process.argv[2] || 'onion_crm'}` });
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

  console.log('\n=== 1:25 Sales sends sample (G2-13: Save & mark sent = ONE call, fn_sample_create p_mark_sent=true)');
  const smpJ = (await step('fn_sample_create 500 g DHL, mark sent', SALES,
    `SELECT fn_sample_create($1,$2,$3,500,'DHL','7788 3001 22',NULL,NULL,true) AS j`,
    [ALB, WMIN, inq.id]))[0].j;
  const smp = { id: smpJ.id, code: smpJ.code };
  console.log(`  -> ${smp.code} (expect SMP-0004)`);
  await show('sample row (expect sent, created_by = sales)', SALES, `SELECT code, status, sent_on = CURRENT_DATE sent_today, created_by = $2 by_sales FROM samples WHERE id=$1`, [smp.id, SALES]);
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
  const sdq = `SELECT step_dates, step_dates = $2::jsonb AS as_expected FROM orders WHERE id=$1`;
  const today = (await c.query(`SELECT to_char(CURRENT_DATE,'YYYY-MM-DD') d`)).rows[0].d;
  const sd1 = await show('A7 step_dates after fn_quote_accept (expect {confirmed: today})', OWNER, sdq, [ordId, JSON.stringify({ confirmed: today })]);
  if (sd1[0].as_expected) pass++; else { fail++; fails.push('A7 accept step_dates'); }
  await show('order items', OWNER, `SELECT qty_kg, unit, rate, amount, gst_rate FROM order_items WHERE order_id=$1`, [ordId]);
  await show('quote / inquiry / follow-ups after accept', OWNER,
    `SELECT (SELECT status FROM quotations WHERE id=$1) quote, (SELECT status FROM inquiries WHERE id=$2) inquiry, (SELECT closed_at IS NOT NULL FROM inquiries WHERE id=$2) inquiry_closed,
            (SELECT count(*) FROM follow_ups WHERE entity_type='quote' AND entity_id=$1 AND done=false) quote_fu_pending,
            (SELECT json_agg(json_build_object('note',note,'due_in',due_on-CURRENT_DATE)) FROM follow_ups WHERE entity_type='order' AND entity_id=$3 AND done=false) order_fu`, [q.id, inq.id, ordId]);
  await step('accept again -> invalid_transition', OWNER, `SELECT fn_quote_accept($1, NULL, 30)`, [q.id], { code: 'P0001', message: 'invalid_transition' });
  await kpis('after accept (quotes_waiting 1, orders_in_production 2, usd due +28560)');

  console.log('\n=== A6: Plant before the advance');
  await step('A6 ops fn_order_advance_waiting(ORD-0004) before advance -> true', OPS, `SELECT fn_order_advance_waiting($1) AS waiting`, [ordId]);
  await show('A6 ops reads ORD-0004 money (payments / v_order_balances rows; expect 0 / 0)', OPS, `SELECT (SELECT count(*) FROM payments WHERE order_id=$1) payments, (SELECT count(*) FROM v_order_balances WHERE order_id=$1) balances`, [ordId]);

  console.log('\n=== 3:05 Accountant records advance $8,568');
  await step('A8 accountant advance dated tomorrow -> bad_payload [received_on]', ACCT, `SELECT fn_payment_record($1, 8568, CURRENT_DATE+1, 'bank', 'TT', 721854, 84.25, NULL)`, [ordId], { code: 'P0001', message: 'bad_payload', detail: 'received_on' });
  await step('A8 owner advance dated tomorrow -> bad_payload [received_on] (owner too)', OWNER, `SELECT fn_payment_record($1, 8568, CURRENT_DATE+1, 'bank', 'TT', 721854, 84.25, NULL)`, [ordId], { code: 'P0001', message: 'bad_payload', detail: 'received_on' });
  await step('A8 accountant $31,416.01 (> 110% of due $28,560) -> bad_payload [over_payment]', ACCT, `SELECT fn_payment_record($1, 31416.01, CURRENT_DATE, 'bank', 'TT', 2646798, 84.25, NULL)`, [ordId], { code: 'P0001', message: 'bad_payload', detail: 'over_payment' });
  await step('A8 accountant exactly 110% ($31,416) yesterday -> allowed (try-only)', ACCT, `SELECT fn_payment_record($1, 31416, CURRENT_DATE-1, 'bank', 'TT', 2646798, 84.25, NULL)`, [ordId], 'ok', false);
  await step('A8 owner $40,000 (over 110%) -> allowed for owner (try-only)', OWNER, `SELECT fn_payment_record($1, 40000, CURRENT_DATE, 'bank', 'TT', 3370000, 84.25, NULL)`, [ordId], 'ok', false);
  await step('USD payment without amount_inr -> bad_payload', ACCT, `SELECT fn_payment_record($1, 8568, CURRENT_DATE, 'bank', 'TT', NULL, NULL, NULL)`, [ordId], { code: 'P0001', message: 'bad_payload' });
  const payId = (await step('fn_payment_record 8568 USD, 721854 INR @84.25', ACCT, `SELECT fn_payment_record($1, 8568, CURRENT_DATE, 'bank', 'TT ref QA1', 721854, 84.25, 'advance') AS id`, [ordId]))[0].id;
  await show('payment row', ACCT, `SELECT receipt_no, amount, currency, amount_inr, fx_rate, mode FROM payments WHERE id=$1`, [payId]);
  await show('v_order_balances ORD-0004', ACCT, `SELECT order_code, total, received, due, advance_ok, due_date, money_status FROM v_order_balances WHERE order_id=$1`, [ordId]);
  await show('advance follow-up after payment', ACCT, `SELECT note, done FROM follow_ups WHERE entity_type='order' AND entity_id=$1`, [ordId]);
  await step('A6 ops fn_order_advance_waiting(ORD-0004) after advance -> false', OPS, `SELECT fn_order_advance_waiting($1) AS waiting`, [ordId]);
  await show('A6 ops reads the new receipt (expect payments 0, balances 0, money_due 0)', OPS, `SELECT (SELECT count(*) FROM payments WHERE id=$1) payments, (SELECT count(*) FROM v_order_balances) balances, (SELECT count(*) FROM v_money_due) money_due`, [payId]);

  console.log('\n=== 3:45 Plant packs, loads (container)');
  await step('ops fn_order_set_packed while confirmed -> invalid_transition', OPS, `SELECT fn_order_set_packed($1, 480)`, [ordId], { code: 'P0001', message: 'invalid_transition' });
  await step('ops fn_order_dispatch while confirmed -> invalid_transition', OPS, `SELECT fn_order_dispatch($1,'truck','GJ04AB1',NULL,NULL,480,12000,NULL,NULL,NULL,NULL,NULL,CURRENT_DATE,NULL)`, [ordId], { code: 'P0001', message: 'invalid_transition' });
  await step('ops Packing started -> in_production', OPS, `SELECT fn_order_set_status($1,'in_production')`, [ordId]);
  const sd2 = await show('A7 step_dates after Packing started', OPS, sdq, [ordId, JSON.stringify({ confirmed: today, in_production: today })]);
  if (sd2[0].as_expected) pass++; else { fail++; fails.push('A7 in_production step_dates'); }
  await step('ops Packed 0 bags -> bad_payload', OPS, `SELECT fn_order_set_packed($1, 0)`, [ordId], { code: 'P0001', message: 'bad_payload' });
  await step('ops Packed 480 bags -> ready', OPS, `SELECT fn_order_set_packed($1, 480)`, [ordId]);
  const sd3 = await show('A7 step_dates after Packed', OPS, sdq, [ordId, JSON.stringify({ confirmed: today, in_production: today, ready: today })]);
  if (sd3[0].as_expected) pass++; else { fail++; fails.push('A7 ready step_dates'); }
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
  const sd4 = await show('A7 step_dates after Loaded', OPS, sdq, [ordId, JSON.stringify({ confirmed: today, in_production: today, ready: today, dispatched: today })]);
  if (sd4[0].as_expected) pass++; else { fail++; fails.push('A7 dispatched step_dates'); }
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
  await as('postgres'); await c.query('SAVEPOINT dlvfut');
  await step('observation: accountant fn_dispatch_delivered 30 days in the FUTURE (no date check)', ACCT, `SELECT fn_dispatch_delivered($1, CURRENT_DATE+30)`, [dspId], 'ok');
  await show('observation: step_dates.delivered after a future date', ACCT, `SELECT step_dates->>'delivered' delivered, (step_dates->>'delivered')::date - CURRENT_DATE days_ahead FROM orders WHERE id=$1`, [ordId]);
  await as('postgres'); await c.query('ROLLBACK TO SAVEPOINT dlvfut');
  await step('accountant fn_dispatch_delivered', ACCT, `SELECT fn_dispatch_delivered($1, CURRENT_DATE)`, [dspId]);
  const sd5 = await show('A7 step_dates after Delivered', ACCT, sdq, [ordId, JSON.stringify({ confirmed: today, in_production: today, ready: today, dispatched: today, delivered: today })]);
  if (sd5[0].as_expected) pass++; else { fail++; fails.push('A7 delivered step_dates'); }
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

  // ---------------------------------------------------------------------------------------------
  // Re-gate probes (gate-2 findings G2-01 .. G2-04 after the Sprint B fix round).
  // Every probe is try-only (savepoint rolled back) unless it says otherwise.
  // ---------------------------------------------------------------------------------------------
  const PROD_X = 'f9f9f9f9-dddd-4f9f-8f9f-dddddddddd01';
  const PKG_X = 'f9f9f9f9-eeee-4f9f-8f9f-eeeeeeeeee01';
  const INQ_X = 'f9f9f9f9-aaaa-4f9f-8f9f-aaaaaaaaaa01';
  const QTN_X = 'f9f9f9f9-bbbb-4f9f-8f9f-bbbbbbbbbb01';
  const RHINE = '55555555-5555-4555-8555-555555555554';
  const HALDIRAM = '55555555-5555-4555-8555-555555555552';
  const SMP2 = '77777777-7777-4777-8777-777777777702';
  const INQ7 = '66666666-6666-4666-8666-666666666607';
  await as('postgres');
  await c.query(`INSERT INTO products (id, org_id, code, name, color, form) SELECT $1,$2,'X-PRD','Other org product',color,form FROM products WHERE id=$3`, [PROD_X, ORG_X, WMIN]);
  await c.query(`INSERT INTO packaging_types (id, org_id, name) VALUES ($1,$2,'Other org bag')`, [PKG_X, ORG_X]);
  await c.query(`INSERT INTO inquiries (id, org_id, code, buyer_name) VALUES ($1,$2,'INQ-X1','Other org lead')`, [INQ_X, ORG_X]);
  await c.query(`INSERT INTO quotations (id, org_id, quote_no, buyer_id, currency) VALUES ($1,$2,'QTN-X1',$3,'USD')`, [QTN_X, ORG_X, BUYER_X]);

  console.log('\n=== G2-03 re-gate: a row may only point at parents of its own org (expected REFUSED)');
  await step('G2-03 sales INSERT sample with other-org buyer_id', SALES, `INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1,$2,$3) RETURNING code`, [ORG, BUYER_X, WMIN], { code: '42501' }, false);
  await step('G2-03 sales INSERT sample with other-org product_id', SALES, `INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1,$2,$3) RETURNING code`, [ORG, ALB, PROD_X], { code: '42501' }, false);
  await step('G2-03 sales INSERT sample with other-org inquiry_id', SALES, `INSERT INTO samples (org_id, inquiry_id, buyer_id, product_id) VALUES ($1,$2,$3,$4) RETURNING code`, [ORG, INQ_X, ALB, WMIN], { code: '42501' }, false);
  await step('G2-03 sales UPDATE SMP-0002 buyer_id -> other org', SALES, `UPDATE samples SET buyer_id=$2 WHERE id=$1`, [SMP2, BUYER_X], { code: '42501' }, false);
  await step('G2-03 sales INSERT quotation with other-org buyer_id', SALES, `INSERT INTO quotations (org_id, buyer_id, currency) VALUES ($1,$2,'INR') RETURNING quote_no`, [ORG, BUYER_X], { code: '42501' }, false);
  await step('G2-03 sales INSERT quotation with other-org inquiry_id', SALES, `INSERT INTO quotations (org_id, inquiry_id, buyer_id, currency) VALUES ($1,$2,$3,'INR') RETURNING quote_no`, [ORG, INQ_X, EVEREST], { code: '42501' }, false);
  await step('G2-03 sales UPDATE draft QTN-0004 buyer_id -> other org', SALES, `UPDATE quotations SET buyer_id=$2 WHERE id=$1`, [QTN4, BUYER_X], { code: '42501' }, false);
  await step('G2-03 sales INSERT quote item with other-org product_id (no floor there)', SALES, `INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ($1,$2,$3,1000,'kg',1) RETURNING amount`, [ORG, QTN4, PROD_X], {}, false);
  await step('G2-03 sales INSERT quote item with other-org packaging_type_id', SALES, `INSERT INTO quotation_items (org_id, quotation_id, product_id, packaging_type_id, qty_kg, unit, rate) VALUES ($1,$2,$3,$4,1000,'kg',200) RETURNING amount`, [ORG, QTN4, WMIN, PKG_X], { code: '42501' }, false);
  await step('G2-03 sales INSERT quote item into the other org\'s draft quote', SALES, `INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ($1,$2,$3,1000,'kg',200) RETURNING amount`, [ORG, QTN_X, WMIN], {}, false);
  await step('G2-03 sales INSERT inquiry with other-org buyer_id', SALES, `INSERT INTO inquiries (org_id, buyer_id, buyer_name) VALUES ($1,$2,'x') RETURNING code`, [ORG, BUYER_X], { code: '42501' }, false);
  await step('G2-03 sales INSERT inquiry with other-org product_id', SALES, `INSERT INTO inquiries (org_id, buyer_name, product_id) VALUES ($1,'x',$2) RETURNING code`, [ORG, PROD_X], { code: '42501' }, false);
  await step('G2-03 sales INSERT inquiry assigned_to other-org user', SALES, `INSERT INTO inquiries (org_id, buyer_name, assigned_to) VALUES ($1,'x',$2) RETURNING code`, [ORG, OWNER_X], { code: '42501' }, false);
  await step('G2-03 sales UPDATE INQ-0007 product_id -> other org', SALES, `UPDATE inquiries SET product_id=$2 WHERE id=$1`, [INQ7, PROD_X], { code: '42501' }, false);
  await step('G2-03 sales INSERT follow-up with other-org buyer_id', SALES, `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note) VALUES ($1,'inquiry',$2,$3,'x')`, [ORG, INQ3, BUYER_X], { code: '42501' }, false);
  await step('G2-03 sales INSERT buyer_contact for other-org buyer', SALES, `INSERT INTO buyer_contacts (org_id, buyer_id, name, phone) VALUES ($1,$2,'x','+91 98200 00000')`, [ORG, BUYER_X], { code: '42501' }, false);
  await step('G2-03 owner INSERT price_list_items for other-org product', OWNER, `INSERT INTO price_list_items (org_id, product_id, currency, unit, rate, floor_price) VALUES ($1,$2,'INR','kg',1,1)`, [ORG, PROD_X], { code: '42501' }, false);
  await step('G2-03 control: sales INSERT sample with own buyer + product (allowed)', SALES, `INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1,$2,$3) RETURNING code`, [ORG, ALB, WMIN], 'ok', false);

  console.log('\n=== G2-01 re-gate (a): a currency with no price row (EUR) is no way around the floor');
  await as('postgres'); await c.query('SAVEPOINT fb1');
  const qe = (await step('G2-01a sales EUR quote header for Rhine (header alone is allowed)', SALES, `INSERT INTO quotations (org_id, buyer_id, currency, incoterm, payment_terms) VALUES ($1,$2,'EUR','CIF','LC at sight') RETURNING id, quote_no`, [ORG, RHINE]))[0];
  await step('G2-01a sales EUR item W-MIN-A at 1 per MT', SALES, itemSql, [ORG, qe.id, WMIN, PKG1, 1], { code: 'P0001', message: 'below_floor_price', detail: 'no_price' });
  await step('G2-01a sales EUR item W-MIN-A at 99,999 per MT (still no known floor)', SALES, itemSql, [ORG, qe.id, WMIN, PKG1, 99999], { code: 'P0001', message: 'below_floor_price', detail: 'no_price' });
  await step('G2-01a sales fn_quote_send EUR quote with no items', SALES, `SELECT fn_quote_send($1)`, [qe.id], { code: 'P0001', message: 'no_items' });
  await step('G2-01a owner EUR item at 1 per MT (owner override, kept)', OWNER, itemSql, [ORG, qe.id, WMIN, PKG1, 1]);
  await step('G2-01a sales fn_quote_send of the owner-priced EUR quote', SALES, `SELECT fn_quote_send($1)`, [qe.id], { code: 'P0001', message: 'below_floor_price', detail: 'no_price' });
  await step('G2-01a sales fn_quote_accept on the EUR draft', SALES, `SELECT fn_quote_accept($1, NULL, 0)`, [qe.id], { code: 'P0001', message: 'invalid_transition' });
  await step('G2-01a owner fn_quote_send (owner override, by design)', OWNER, `SELECT fn_quote_send($1)`, [qe.id]);
  await as('postgres'); await c.query('ROLLBACK TO SAVEPOINT fb1');

  console.log('\n=== G2-01 re-gate (b): a draft\'s currency change and a raised floor are re-checked');
  await as('postgres'); await c.query('SAVEPOINT fb2');
  const qu = (await step('G2-01b sales USD quote for Al-Barakah', SALES, `INSERT INTO quotations (org_id, buyer_id, currency, fx_rate, incoterm) VALUES ($1,$2,'USD',84.25,'FOB Pipavav') RETURNING id, quote_no`, [ORG, ALB]))[0];
  await step('G2-01b sales USD item 2380/MT', SALES, itemSql, [ORG, qu.id, WMIN, PKG1, 2380]);
  await step('G2-01b sales UPDATE draft currency USD -> INR (Rs 2.38/kg vs floor Rs 175/kg)', SALES, `UPDATE quotations SET currency='INR', fx_rate=NULL WHERE id=$1 RETURNING currency, total`, [qu.id], { code: 'P0001', message: 'below_floor_price' });
  await step('G2-01b sales UPDATE draft currency USD -> EUR (no price row)', SALES, `UPDATE quotations SET currency='EUR' WHERE id=$1 RETURNING currency`, [qu.id], { code: 'P0001', message: 'below_floor_price', detail: 'no_price' });
  await show('G2-01b draft after the two refused switches (expect USD, floor 2180, total 28560)', SALES, `SELECT q.quote_no, q.status, q.currency, q.fx_rate, q.total, i.unit, i.rate, i.floor_price_at_time, i.gst_rate FROM quotations q JOIN quotation_items i ON i.quotation_id=q.id WHERE q.id=$1`, [qu.id]);
  const upd = `SELECT fn_quote_update_draft($1,$2,NULL,$3,$4,'FOB Pipavav',CURRENT_DATE+10,'30% advance, 70% against BL copy',NULL,$5::jsonb) AS quote_no`;
  const itemsUsdMt = JSON.stringify([{ product_id: WMIN, packaging_type_id: PKG1, qty_kg: 12000, unit: 'MT', rate: 2380 }]);
  const itemsInrKg = JSON.stringify([{ product_id: WMIN, packaging_type_id: PKG1, qty_kg: 12000, unit: 'kg', rate: 190 }]);
  await step('G2-01b sales fn_quote_update_draft USD -> INR keeping 2380 per MT', SALES, upd, [qu.id, ALB, 'INR', null, itemsUsdMt], { code: 'P0001', message: 'below_floor_price' });
  await show('G2-01b draft after the refused RPC (expect unchanged: USD, 1 item, floor 2180)', SALES, `SELECT q.currency, q.fx_rate, q.total, count(i.*) items, max(i.floor_price_at_time) floor FROM quotations q LEFT JOIN quotation_items i ON i.quotation_id=q.id WHERE q.id=$1 GROUP BY q.id`, [qu.id]);
  await step('G2-01b sales fn_quote_update_draft USD -> INR at Rs 190/kg (valid)', SALES, upd, [qu.id, ALB, 'INR', null, itemsInrKg]);
  await show('G2-01b draft in INR (expect floor 175, gst 5, subtotal 2280000, gst 114000)', SALES, `SELECT q.currency, q.fx_rate, q.subtotal, q.gst_amount, q.total, i.unit, i.rate, i.floor_price_at_time, i.gst_rate FROM quotations q JOIN quotation_items i ON i.quotation_id=q.id WHERE q.id=$1`, [qu.id]);
  await step('G2-01b sales fn_quote_update_draft back to USD at 2380 per MT (valid)', SALES, upd, [qu.id, ALB, 'USD', 84.25, itemsUsdMt]);
  await step('G2-01b owner raises the USD price of W-MIN-A to 2600/MT, floor 2500/MT', OWNER, `UPDATE price_list_items SET rate=2600, floor_price=2500 WHERE org_id=$1 AND product_id=$2 AND currency='USD' AND unit='MT' AND is_active RETURNING floor_price`, [ORG, WMIN]);
  await step('G2-01b sales fn_quote_send after the floor was raised (stored floor 2180 is stale)', SALES, `SELECT fn_quote_send($1)`, [qu.id], { code: 'P0001', message: 'below_floor_price', detail: '2500.00' });
  await step('G2-01b owner fn_quote_send (owner override, by design)', OWNER, `SELECT fn_quote_send($1)`, [qu.id], 'ok', false);
  await step('G2-01b sales INSERT a EUR price row with floor 1 (catalog is owner/accountant)', SALES, `INSERT INTO price_list_items (org_id, product_id, currency, unit, rate, floor_price) VALUES ($1,$2,'EUR','MT',1,1)`, [ORG, WMIN], { code: '42501' });
  await step('G2-01b sales UPDATE price_list_items floor to 1 (0 rows)', SALES, `UPDATE price_list_items SET floor_price=1 WHERE org_id=$1 AND product_id=$2`, [ORG, WMIN], { rows: 0 });
  await as('postgres'); await c.query('ROLLBACK TO SAVEPOINT fb2');

  console.log('\n=== G2-02 re-gate: Plant reads buyers but cannot write them');
  await step('G2-02 ops SELECT buyers (read still works)', OPS, `SELECT count(*)::int n FROM buyers`, [], 'ok', false);
  await step('G2-02 ops UPDATE buyer credit days to 90', OPS, `UPDATE buyers SET credit_period_days = 90 WHERE id=$1 RETURNING credit_period_days`, [ALB], { rows: 0 }, false);
  await step('G2-02 ops INSERT buyer', OPS, `INSERT INTO buyers (org_id, company_name, buyer_type) VALUES ($1,'Plant made buyer','domestic_masala') RETURNING buyer_code`, [ORG], { code: '42501' }, false);
  await step('G2-02 ops DELETE buyer', OPS, `DELETE FROM buyers WHERE id=$1`, [HALDIRAM], { rows: 0 }, false);
  await step('G2-02 ops UPDATE buyer_contacts phone', OPS, `UPDATE buyer_contacts SET phone='+91 90000 00000' WHERE buyer_id=$1`, [ALB], { rows: 0 }, false);
  await step('G2-02 ops INSERT buyer_contact', OPS, `INSERT INTO buyer_contacts (org_id, buyer_id, name, phone) VALUES ($1,$2,'x','+91 98200 00000')`, [ORG, ALB], { code: '42501' }, false);
  await step('G2-02 ops DELETE buyer_contacts', OPS, `DELETE FROM buyer_contacts WHERE buyer_id=$1`, [ALB], { rows: 0 }, false);
  await step('G2-02 control: sales UPDATE buyer credit days (allowed)', SALES, `UPDATE buyers SET credit_period_days = 45 WHERE id=$1`, [HALDIRAM], { rows: 1 }, false);
  await step('G2-02 control: accountant UPDATE buyer credit days (allowed)', ACCT, `UPDATE buyers SET credit_period_days = 45 WHERE id=$1`, [HALDIRAM], { rows: 1 }, false);
  await step('G2-02 observation: ops INSERT a note on a buyer (dev1 open issue, flows.md silent)', OPS, `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on) VALUES ($1,'buyer',$2,$2,'Plant reminder',CURRENT_DATE+1) RETURNING id`, [ORG, ALB], 'ok', false);

  console.log('\n=== G2-04 re-gate: "Add one inquiry yourself" with + New buyer, then Save as buyer');
  await as('postgres'); await c.query('SAVEPOINT g204');
  const nb0 = (await show('buyers before', SALES, `SELECT count(*)::int n FROM buyers`))[0].n;
  const qi = (await step('G2-04 sales INSERT inquiry with name + phone only (no buyer row)', SALES,
    `INSERT INTO inquiries (org_id, buyer_name, phone, product_id, qty_kg, source, assigned_to) VALUES ($1,'Sharjah Spice Trading','+971 50 123 4567',$2,5000,'whatsapp',$3) RETURNING id, code, buyer_id`, [ORG, WMIN, SALES]))[0];
  const nb1 = (await show('buyers after the inquiry (expect unchanged)', SALES, `SELECT count(*)::int n FROM buyers`))[0].n;
  console.log(`  buyers ${nb0} -> ${nb1} (${nb0 === nb1 ? 'no buyer row made' : 'BUYER ROW MADE'})`);
  await step('G2-04 sales sample for a buyer-less inquiry (needs Save as buyer first)', SALES, `INSERT INTO samples (org_id, inquiry_id, buyer_id, product_id) VALUES ($1,$2,NULL,$3)`, [ORG, qi.id, WMIN], {}, false);
  const nbuy = (await step('G2-04 Save as buyer: sales INSERT export buyer with country', SALES,
    `INSERT INTO buyers (org_id, company_name, buyer_type, country, preferred_currency, incoterm, payment_terms, credit_period_days, status) VALUES ($1,'Sharjah Spice Trading','export_importer','United Arab Emirates','USD','FOB','30% advance, 70% against BL copy',0,'active') RETURNING id, buyer_code, country`, [ORG]))[0];
  await step('G2-04 Save as buyer: primary contact', SALES, `INSERT INTO buyer_contacts (org_id, buyer_id, name, phone, is_primary) VALUES ($1,$2,'Sharjah Spice Trading','+971 50 123 4567',true)`, [ORG, nbuy.id]);
  await step('G2-04 Save as buyer: link the inquiry', SALES, `UPDATE inquiries SET buyer_id=$2 WHERE id=$1 AND org_id=$3`, [qi.id, nbuy.id, ORG], { rows: 1 });
  await step('G2-04 sales sample for the inquiry now that it has a buyer', SALES, `INSERT INTO samples (org_id, inquiry_id, buyer_id, product_id) VALUES ($1,$2,$3,$4) RETURNING code`, [ORG, qi.id, nbuy.id, WMIN]);
  await as('postgres'); await c.query('ROLLBACK TO SAVEPOINT g204');

  console.log('\n=== G2-05 (Sprint C A9: now expected REFUSED, 0 rows)');
  await step('G2-05 sales DELETE order follow-up "Balance $18,900 due"', SALES, `DELETE FROM follow_ups WHERE id=$1`, [FU01], { rows: 0 }, false);
  await step('G2-05 sales DELETE approved sample SMP-0001', SALES, `DELETE FROM samples WHERE id=$1`, [SMP1], { rows: 0 }, false);


  // ---------------------------------------------------------------------------------------------
  // SPRINT C probes (QA gate 3). All try-only (savepoint rolled back) unless they say otherwise.
  // ---------------------------------------------------------------------------------------------
  const SMP3 = '77777777-7777-4777-8777-777777777703';
  const ORD1 = '99999999-9999-4999-8999-999999999901';
  const FU14 = 'cccccccc-cccc-4ccc-8ccc-cccccccccc14'; // sales' own plain buyer note
  const FU16 = 'cccccccc-cccc-4ccc-8ccc-cccccccccc16'; // owner's plain inquiry note
  const FU03 = 'cccccccc-cccc-4ccc-8ccc-cccccccccc03'; // sales' pending reminder (inquiry)

  console.log('\n=== SPRINT C A6: Plant (operations) reads no money; others unchanged');
  for (const [who, uid] of [['owner', OWNER], ['accountant', ACCT], ['sales', SALES], ['ops', OPS]]) {
    await show(`A6 ${who}: payments / v_order_balances / v_money_due rows`, uid, `SELECT (SELECT count(*) FROM payments)::int payments, (SELECT count(*) FROM v_order_balances)::int balances, (SELECT count(*) FROM v_money_due)::int money_due`);
  }
  await step('A6 ops SELECT payments -> 0 rows', OPS, `SELECT id FROM payments`, [], { rows: 0 }, false);
  await step('A6 ops SELECT v_order_balances -> 0 rows', OPS, `SELECT order_id FROM v_order_balances`, [], { rows: 0 }, false);
  await step('A6 ops SELECT v_money_due -> 0 rows', OPS, `SELECT buyer_id FROM v_money_due`, [], { rows: 0 }, false);
  await step('A6 ops v_home_kpis money columns all 0', OPS, `SELECT 1 FROM v_home_kpis WHERE money_due_inr = 0 AND money_due_usd = 0 AND money_due_about_inr = 0 AND money_overdue_count = 0`, [], { rows: 1 }, false);
  await show('A6 ops v_home_kpis (orders_in_production still counted)', OPS, `SELECT orders_in_production, money_due_inr, money_due_usd, money_due_about_inr, money_overdue_count, followups_today FROM v_home_kpis`);
  await step('A6 owner v_order_balances still has rows', OWNER, `SELECT order_id FROM v_order_balances`, [], 'ok', false);
  await step('A6 ops fn_order_advance_waiting on other-org order id -> not_found', OPS, `SELECT fn_order_advance_waiting($1)`, ['f9f9f9f9-9999-4f9f-8f9f-999999999999'], { code: '42501', message: 'not_found' }, false);
  await step('A6 other-org owner fn_order_advance_waiting(MDPL ORD-0003) -> not_found', OWNER_X, `SELECT fn_order_advance_waiting($1)`, [ORD3], { code: '42501', message: 'not_found' }, false);
  await show('A6 observation: what Plant sees in To do today (v_followups_today as ops)', OPS, `SELECT entity_type, note, days_late FROM v_followups_today`);
  await show('A6 observation: follow_ups notes with a money amount that ops can read', OPS, `SELECT entity_type, note, done FROM follow_ups WHERE note ~ '[$₹]|Rs' ORDER BY note`);

  console.log('\n=== SPRINT C A8: payment caps on seeded orders');
  await step('A8 accountant ORD-0003 (INR due 511875) 563062.51 -> over_payment', ACCT, `SELECT fn_payment_record($1, 563062.51, CURRENT_DATE, 'bank')`, [ORD3], { code: 'P0001', message: 'bad_payload', detail: 'over_payment' }, false);
  await step('A8 accountant ORD-0003 563062.50 (= 110%) -> allowed', ACCT, `SELECT fn_payment_record($1, 563062.50, CURRENT_DATE, 'bank')`, [ORD3], 'ok', false);
  await step('A8 accountant fully paid ORD-0001 Rs 1 -> over_payment (due 0)', ACCT, `SELECT fn_payment_record($1, 1, CURRENT_DATE, 'cash')`, [ORD1], { code: 'P0001', message: 'bad_payload', detail: 'over_payment' }, false);
  await step('A8 owner fully paid ORD-0001 Rs 1 -> allowed (owner)', OWNER, `SELECT fn_payment_record($1, 1, CURRENT_DATE, 'cash')`, [ORD1], 'ok', false);
  await step('A8 accountant ORD-0003 dated 2099-01-01 -> received_on', ACCT, `SELECT fn_payment_record($1, 100, DATE '2099-01-01', 'bank')`, [ORD3], { code: 'P0001', message: 'bad_payload', detail: 'received_on' }, false);
  await step('A8 accountant ORD-0003 dated today -> allowed', ACCT, `SELECT fn_payment_record($1, 100, CURRENT_DATE, 'bank')`, [ORD3], 'ok', false);

  console.log('\n=== SPRINT C A9: rows start in their first state, in the caller\'s name');
  await step('A9 sales INSERT inquiry status=won', SALES, `INSERT INTO inquiries (org_id, buyer_name, status) VALUES ($1,'x','won')`, [ORG], { code: '42501' }, false);
  await step('A9 sales INSERT inquiry status=quoted', SALES, `INSERT INTO inquiries (org_id, buyer_name, status) VALUES ($1,'x','quoted')`, [ORG], { code: '42501' }, false);
  await step('A9 sales INSERT inquiry with lost_reason', SALES, `INSERT INTO inquiries (org_id, buyer_name, lost_reason) VALUES ($1,'x','price')`, [ORG], { code: '42501' }, false);
  await step('A9 sales INSERT inquiry with closed_at', SALES, `INSERT INTO inquiries (org_id, buyer_name, closed_at) VALUES ($1,'x',now())`, [ORG], { code: '42501' }, false);
  await step('A9 sales INSERT inquiry created_by=owner', SALES, `INSERT INTO inquiries (org_id, buyer_name, created_by) VALUES ($1,'x',$2)`, [ORG, OWNER], { code: '42501' }, false);
  await step('A9 control: sales INSERT inquiry created_by=self, assigned_to=self', SALES, `INSERT INTO inquiries (org_id, buyer_name, created_by, assigned_to) VALUES ($1,'x',$2,$2) RETURNING status`, [ORG, SALES], 'ok', false);
  await step('A9 sales INSERT sample status=approved', SALES, `INSERT INTO samples (org_id, buyer_id, product_id, status) VALUES ($1,$2,$3,'approved')`, [ORG, ALB, WMIN], { code: '42501' }, false);
  await step('A9 sales INSERT sample status=sent', SALES, `INSERT INTO samples (org_id, buyer_id, product_id, status) VALUES ($1,$2,$3,'sent')`, [ORG, ALB, WMIN], { code: '42501' }, false);
  await step('A9 sales INSERT sample with decided_on', SALES, `INSERT INTO samples (org_id, buyer_id, product_id, decided_on) VALUES ($1,$2,$3,CURRENT_DATE)`, [ORG, ALB, WMIN], { code: '42501' }, false);
  await step('A9 sales INSERT sample created_by=owner', SALES, `INSERT INTO samples (org_id, buyer_id, product_id, created_by) VALUES ($1,$2,$3,$4)`, [ORG, ALB, WMIN, OWNER], { code: '42501' }, false);
  await step('A9 sales INSERT quotation with sent_at', SALES, `INSERT INTO quotations (org_id, buyer_id, sent_at) VALUES ($1,$2,now())`, [ORG, EVEREST], { code: '42501' }, false);
  await step('A9 sales INSERT quotation with decided_at', SALES, `INSERT INTO quotations (org_id, buyer_id, decided_at) VALUES ($1,$2,now())`, [ORG, EVEREST], { code: '42501' }, false);
  await step('A9 sales INSERT quotation with reject_reason', SALES, `INSERT INTO quotations (org_id, buyer_id, reject_reason) VALUES ($1,$2,'price')`, [ORG, EVEREST], { code: '42501' }, false);
  await step('A9 sales INSERT quotation status=accepted', SALES, `INSERT INTO quotations (org_id, buyer_id, status) VALUES ($1,$2,'accepted')`, [ORG, EVEREST], { code: '42501' }, false);
  await step('A9 sales INSERT quotation created_by=owner', SALES, `INSERT INTO quotations (org_id, buyer_id, created_by) VALUES ($1,$2,$3)`, [ORG, EVEREST, OWNER], { code: '42501' }, false);
  await as('postgres'); await c.query('SAVEPOINT a9tot');
  const qt = (await step('A9 sales INSERT quotation with supplied totals 999999 (kept, then rolled back)', SALES, `INSERT INTO quotations (org_id, buyer_id, currency, subtotal, gst_amount, total) VALUES ($1,$2,'INR',999999,999999,999999) RETURNING id, subtotal, gst_amount, total`, [ORG, EVEREST]))[0];
  await step('A9 supplied totals ignored: stored subtotal/gst/total = 0', SALES, `SELECT 1 FROM quotations WHERE id=$1 AND subtotal=0 AND gst_amount=0 AND total=0`, [qt.id], { rows: 1 });
  await step('A9 add item 1000 kg x Rs 185 (W-MIN-A INR)', SALES, `INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ($1,$2,$3,1000,'kg',185) RETURNING amount, gst_rate`, [ORG, qt.id, WMIN]);
  await show('A9 totals now come from the items (expect 185000 / 9250 / 194250)', SALES, `SELECT subtotal, gst_amount, total FROM quotations WHERE id=$1`, [qt.id]);
  await as('postgres'); await c.query('ROLLBACK TO SAVEPOINT a9tot');
  await step('A9 sales INSERT follow-up with done_by=owner', SALES, `INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on, done_by) VALUES ($1,'inquiry',$2,'x',CURRENT_DATE,$3)`, [ORG, INQ3, OWNER], { code: '42501' }, false);
  await step('A9 sales INSERT already-ticked reminder (due_on set, done=true)', SALES, `INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on, done) VALUES ($1,'inquiry',$2,'x',CURRENT_DATE,true)`, [ORG, INQ3], { code: '42501' }, false);
  await step('A9 sales INSERT pending reminder with done_at', SALES, `INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on, done_at) VALUES ($1,'inquiry',$2,'x',CURRENT_DATE,now())`, [ORG, INQ3], { code: '42501' }, false);
  await step('A9 sales INSERT follow-up created_by=owner', SALES, `INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on, created_by) VALUES ($1,'inquiry',$2,'x',CURRENT_DATE,$3)`, [ORG, INQ3, OWNER], { code: '42501' }, false);
  await step('A9 control: sales plain note (due_on NULL, done=true)', SALES, `INSERT INTO follow_ups (org_id, entity_type, entity_id, note, done) VALUES ($1,'inquiry',$2,'QA note',true) RETURNING id`, [ORG, INQ3], 'ok', false);
  await step('A9 control: sales reminder (pending, due tomorrow)', SALES, `INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on) VALUES ($1,'inquiry',$2,'QA reminder',CURRENT_DATE+1) RETURNING id`, [ORG, INQ3], 'ok', false);

  console.log('\n=== SPRINT C A9: deletes');
  await as('postgres'); await c.query('SAVEPOINT a9del');
  const myNote = (await step('A9 sales adds a plain note the way the app does (done=true, due_on NULL, done_by NULL)', SALES, `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, done) VALUES ($1,'buyer',$2,$2,'QA own note',true) RETURNING id`, [ORG, ALB]))[0];
  await step('A9 sales DELETE own app-made plain note -> 1 row', SALES, `DELETE FROM follow_ups WHERE id=$1`, [myNote.id], { rows: 1 });
  await as('postgres'); await c.query('ROLLBACK TO SAVEPOINT a9del');
  await step('A9 observation (dev1 deviation): sales DELETE own SEEDED plain note (seed sets done_by) -> 0 rows', SALES, `DELETE FROM follow_ups WHERE id=$1`, [FU14], { rows: 0 }, false);
  await step('A9 sales DELETE owner\'s plain note -> 0 rows', SALES, `DELETE FROM follow_ups WHERE id=$1`, [FU16], { rows: 0 }, false);
  await step('A9 sales DELETE own pending reminder -> 0 rows', SALES, `DELETE FROM follow_ups WHERE id=$1`, [FU03], { rows: 0 }, false);
  await step('A9 accountant DELETE own system reminder "Balance $18,900 due" -> 0 rows', ACCT, `DELETE FROM follow_ups WHERE id=$1`, [FU01], { rows: 0 }, false);
  await step('A9 owner DELETE "Balance $18,900 due" -> 1 row (owner may)', OWNER, `DELETE FROM follow_ups WHERE id=$1`, [FU01], { rows: 1 }, false);
  await step('A9 sales DELETE sent sample SMP-0002 -> 0 rows', SALES, `DELETE FROM samples WHERE id=$1`, [SMP2], { rows: 0 }, false);
  await step('A9 sales DELETE to_send sample SMP-0003 -> 1 row', SALES, `DELETE FROM samples WHERE id=$1`, [SMP3], { rows: 1 }, false);
  await step('A9 owner DELETE approved sample SMP-0001 -> 0 rows (history stays, owner too)', OWNER, `DELETE FROM samples WHERE id=$1`, [SMP1], { rows: 0 }, false);

  console.log('\n=== SPRINT C G2-13: Save & mark sent is one call; a refused call saves nothing');
  const ns0 = (await show('samples before', SALES, `SELECT count(*)::int n FROM samples`))[0].n;
  await step('G2-13 fn_sample_create with p_mark_sent NULL -> bad_payload', SALES, `SELECT fn_sample_create($1,$2,NULL,500,NULL,NULL,NULL,NULL,NULL)`, [ALB, WMIN], { code: 'P0001', message: 'bad_payload' }, false);
  await step('G2-13 fn_sample_create other-org buyer -> refused', SALES, `SELECT fn_sample_create($1,$2,NULL,500,NULL,NULL,NULL,NULL,true)`, [BUYER_X, WMIN], { code: '42501' }, false);
  await step('G2-13 control: ops (holds samples) fn_sample_create, no mark-sent refusal', OPS, `SELECT fn_sample_create($1,$2,NULL,500,NULL,NULL,NULL,NULL,true) AS j`, [ALB, WMIN], 'ok', false);
  await step('G2-13 accountant (no samples module) fn_sample_create -> 42501', ACCT, `SELECT fn_sample_create($1,$2,NULL,500,NULL,NULL,NULL,NULL,true)`, [ALB, WMIN], { code: '42501' }, false);
  const ns1 = (await show('samples after refused calls', SALES, `SELECT count(*)::int n FROM samples`))[0].n;
  if (ns0 === ns1) pass++; else { fail++; fails.push('G2-13 refused call left a sample'); }
  console.log(`  samples ${ns0} -> ${ns1} (${ns0 === ns1 ? 'nothing saved' : 'ROW LEFT BEHIND'})`);

  console.log('\n=== SPRINT C A10: anon / PUBLIC execute nothing; app RPCs stay executable by authenticated');
  await as('postgres');
  const fx = (await c.query(`SELECT
      (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')::int total,
      (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND has_function_privilege('anon', p.oid, 'EXECUTE'))::int anon_exec,
      (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0 AND a.privilege_type='EXECUTE')))::int public_exec,
      (SELECT string_agg(p.proname, ',' ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND has_function_privilege('anon', p.oid, 'EXECUTE')) anon_list`)).rows[0];
  console.log('  functions in public:', JSON.stringify(fx));
  if (fx.anon_exec === 0 && fx.public_exec === 0) pass++; else { fail++; fails.push('A10 anon/PUBLIC execute'); }
  const rpcs = ['fn_dispatch_delivered','fn_dispatch_tick','fn_follow_up_done','fn_inquiry_set_status','fn_order_advance_waiting','fn_order_dispatch','fn_order_set_packed','fn_order_set_status','fn_payment_record','fn_quote_accept','fn_quote_reject','fn_quote_send','fn_quote_update_draft','fn_sample_create','fn_sample_set_status','fn_set_user_access','fn_set_user_active'];
  const ra = (await c.query(`SELECT p.proname, bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE')) auth_exec, bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) anon_exec FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname = ANY($1) GROUP BY p.proname ORDER BY p.proname`, [rpcs])).rows;
  const raBad = ra.filter((r) => !r.auth_exec || r.anon_exec);
  console.log(`  17 app rpc() names found: ${ra.length}; authenticated can execute all, anon none: ${raBad.length === 0 && ra.length === 17}`);
  if (raBad.length === 0 && ra.length === 17) pass++; else { fail++; fails.push('A10 app rpc grants ' + JSON.stringify(raBad)); }
  const locked = (await c.query(`SELECT p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') auth_exec FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('fn_next_code','fn_next_doc_no','fn_assign_code','fn_assign_doc_no','fn_audit','fn_quote_item_guard','fn_quotation_insert_totals') ORDER BY 1`)).rows;
  console.log('  locked for authenticated (generators / trigger fns):', JSON.stringify(locked));
  if (locked.every((r) => !r.auth_exec)) pass++; else { fail++; fails.push('A10 generators/trigger fns executable'); }
  // Act as anon (what PostgREST does with only the anon key, no login)
  await c.query('SAVEPOINT anon1'); await c.query('SET LOCAL ROLE anon');
  let anonErr = null; try { await c.query(`SELECT fn_payment_record($1, 1, CURRENT_DATE, 'bank')`, [ORD3]); } catch (e) { anonErr = e; }
  await c.query('ROLLBACK TO SAVEPOINT anon1'); await c.query('RESET ROLE');
  console.log(`  anon SELECT fn_payment_record(...) -> ${anonErr ? 'ERROR ' + anonErr.code + ' ' + anonErr.message : 'OK (BAD)'}`);
  if (anonErr && anonErr.code === '42501') pass++; else { fail++; fails.push('A10 anon fn_payment_record'); }
  await c.query('SAVEPOINT anon2'); await c.query('SET LOCAL ROLE anon');
  let anonErr2 = null; try { await c.query(`SELECT fn_order_advance_waiting($1)`, [ORD3]); } catch (e) { anonErr2 = e; }
  await c.query('ROLLBACK TO SAVEPOINT anon2'); await c.query('RESET ROLE');
  console.log(`  anon SELECT fn_order_advance_waiting(...) -> ${anonErr2 ? 'ERROR ' + anonErr2.code + ' ' + anonErr2.message : 'OK (BAD)'}`);
  if (anonErr2 && anonErr2.code === '42501') pass++; else { fail++; fails.push('A10 anon fn_order_advance_waiting'); }

  console.log('\n=== SPRINT C SEC1-08: module list deduplicated and capped at 13');
  const mods14 = ['dashboard','leads','buyers','samples','quotes','orders','payments','catalog','users','settings','documents','reports','audit','dashboard'];
  await step('SEC1-08 owner fn_set_user_access sales with 14 entries -> bad_payload', OWNER, `SELECT fn_set_user_access($1,'sales',$2::text[])`, [SALES, mods14], { code: 'P0001', message: 'bad_payload' }, false);
  await as('postgres'); await c.query('SAVEPOINT s108');
  await step('SEC1-08 owner fn_set_user_access sales with duplicates', OWNER, `SELECT fn_set_user_access($1,'sales',$2::text[])`, [SALES, ['dashboard','leads','leads','buyers','dashboard']]);
  await show('SEC1-08 stored modules (expect each once)', OWNER, `SELECT modules FROM profiles WHERE id=$1`, [SALES]);
  await as('postgres'); await c.query('ROLLBACK TO SAVEPOINT s108');

  console.log('\n=== SPRINT C A12: receipt data per role (the /payments/[id] page needs the payments module)');
  await show('A12 accountant reads REC of ORD-0004 (receipt view data)', ACCT, `SELECT receipt_no, amount, currency, amount_inr, fx_rate, mode, reference FROM payments WHERE id=$1`, [payId]);
  await step('A12 ops reads the same receipt -> 0 rows', OPS, `SELECT receipt_no FROM payments WHERE id=$1`, [payId], { rows: 0 }, false);
  await show('A12 role modules (payments module holders)', 'postgres', `SELECT email, role, 'payments' = ANY(modules) has_payments FROM profiles WHERE org_id=$1 ORDER BY role`, [ORG]);

  console.log('\n=== Seed story inside the transaction is only restored by the ROLLBACK below');
  await c.query('ROLLBACK');
  console.log(`\nROLLED BACK. ${pass} pass, ${fail} fail`);
  if (fails.length) console.log('FAILED: ' + fails.join(' | '));
  await c.end();
})().catch(async (e) => { console.error('SCRIPT ERROR', e); try { await c.query('ROLLBACK'); } catch {} process.exit(2); });
