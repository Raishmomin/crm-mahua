// QA gate 3: one full demo-script rehearsal that is COMMITTED (scratch DB mahua_qc* only), to test the
// README / hosted-guide claim that `npm run db:seed` "resets the demo story to day one".
// usage: node rehearsal-commit.cjs mahua_qc
const { Client } = require('/home/raish/raish/mahua-crm/node_modules/pg');
const db = process.argv[2];
if (!/^mahua_qc[a-z0-9_]*$/.test(db || '')) { console.error('refusing: scratch DB mahua_qc* only'); process.exit(2); }
const ORG = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222221';
const ACCT = '22222222-2222-4222-8222-222222222222';
const SALES = '22222222-2222-4222-8222-222222222223';
const OPS = '22222222-2222-4222-8222-222222222224';
const ALB = '55555555-5555-4555-8555-555555555553';
const WMIN = '33333333-3333-4333-8333-333333333332';
const PKG1 = '44444444-4444-4444-8444-444444444441';
const DSP2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';
const FU02 = 'cccccccc-cccc-4ccc-8ccc-cccccccccc02';

(async () => {
  const c = new Client({ connectionString: `postgresql://postgres:postgres@127.0.0.1:5432/${db}` });
  await c.connect();
  const as = async (uid) => {
    await c.query('RESET ROLE');
    await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [uid, JSON.stringify({ sub: uid, role: 'authenticated' })]);
    await c.query('SET LOCAL ROLE authenticated');
  };
  await c.query('BEGIN');
  await as(SALES);
  const inq = (await c.query(`INSERT INTO inquiries (org_id, buyer_id, buyer_name, phone, product_id, qty_kg, needed_by, source, assigned_to) VALUES ($1,$2,'Al-Barakah Spice & Grain LLC','+971 4 223 9876',$3,12000,'2026-12-20','whatsapp',$4) RETURNING id, code`, [ORG, ALB, WMIN, SALES])).rows[0];
  await c.query(`SELECT fn_inquiry_set_status($1,'talking',NULL)`, [inq.id]);
  const smp = (await c.query(`SELECT fn_sample_create($1,$2,$3,500,'DHL','7788 3001 22',NULL,NULL,true) j`, [ALB, WMIN, inq.id])).rows[0].j;
  const q = (await c.query(`INSERT INTO quotations (org_id, inquiry_id, buyer_id, currency, fx_rate, incoterm, valid_till, payment_terms) VALUES ($1,$2,$3,'USD',84.25,'FOB Pipavav',CURRENT_DATE+10,'30% advance, 70% against BL copy') RETURNING id, quote_no`, [ORG, inq.id, ALB])).rows[0];
  await c.query(`INSERT INTO quotation_items (org_id, quotation_id, product_id, packaging_type_id, qty_kg, unit, rate) VALUES ($1,$2,$3,$4,12000,'MT',2380)`, [ORG, q.id, WMIN, PKG1]);
  await c.query(`SELECT fn_quote_send($1)`, [q.id]);
  const ord = (await c.query(`SELECT fn_quote_accept($1, CURRENT_DATE+17, 30) id`, [q.id])).rows[0].id;
  await as(ACCT);
  await c.query(`SELECT fn_payment_record($1, 8568, CURRENT_DATE, 'bank', 'TT', 721854, 84.25, NULL)`, [ord]);
  await as(OPS);
  await c.query(`SELECT fn_order_set_status($1,'in_production')`, [ord]);
  await c.query(`SELECT fn_order_set_packed($1, 480)`, [ord]);
  await as(ACCT);
  await c.query(`SELECT fn_dispatch_tick($1,'coo',true,CURRENT_DATE,NULL)`, [DSP2]);
  await as(OWNER);
  await c.query(`SELECT fn_follow_up_done($1)`, [FU02]);
  const codes = (await c.query(`SELECT (SELECT code FROM inquiries WHERE id=$1) inq, (SELECT order_code||' / '||pi_no FROM orders WHERE id=$2) ord, (SELECT max(receipt_no) FROM payments) rec`, [inq.id, ord])).rows[0];
  await c.query('RESET ROLE');
  await c.query('COMMIT');
  console.log('COMMITTED demo rehearsal on', db, JSON.stringify({ ...codes, sample: smp.code, quote: q.quote_no }));
  await c.end();
})().catch(async (e) => { console.error('ERR', e.code, e.message, e.detail || ''); process.exit(1); });
