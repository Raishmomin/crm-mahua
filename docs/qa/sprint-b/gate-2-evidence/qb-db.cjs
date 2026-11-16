// usage: node qb-db.cjs create|drop|counts <dbname>
const { Client } = require('/home/raish/raish/mahua-crm/node_modules/pg');
const [, , cmd, db] = process.argv;
(async () => {
  if (cmd === 'create' || cmd === 'drop') {
    const c = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres' });
    await c.connect();
    if (cmd === 'create') { await c.query(`DROP DATABASE IF EXISTS ${db}`); await c.query(`CREATE DATABASE ${db}`); console.log('created', db); }
    else { await c.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`); console.log('dropped', db); }
    await c.end(); return;
  }
  const c = new Client({ connectionString: `postgresql://postgres:postgres@127.0.0.1:5432/${db}` });
  await c.connect();
  const org = '11111111-1111-4111-8111-111111111111';
  const tables = ['buyers','inquiries','samples','quotations','quotation_items','orders','order_items','dispatches','payments','follow_ups'];
  const out = {};
  for (const t of tables) out[t] = Number((await c.query(`SELECT count(*) FROM ${t} WHERE org_id=$1`, [org])).rows[0].count);
  out.follow_ups_pending = Number((await c.query(`SELECT count(*) FROM follow_ups WHERE org_id=$1 AND done=false`, [org])).rows[0].count);
  out.follow_ups_notes = Number((await c.query(`SELECT count(*) FROM follow_ups WHERE org_id=$1 AND due_on IS NULL`, [org])).rows[0].count);
  console.log(JSON.stringify(out));
  const ec = await c.query(`SELECT prefix, current_val FROM entity_code_counters WHERE org_id=$1 ORDER BY prefix`, [org]);
  console.log('entity_code_counters', ec.rows.map(r => `${r.prefix}=${r.current_val}`).join(' '));
  const dc = await c.query(`SELECT doc_type, fy, current_val FROM doc_counters WHERE org_id=$1 ORDER BY doc_type`, [org]);
  console.log('doc_counters', dc.rows.map(r => `${r.doc_type}/${r.fy}=${r.current_val}`).join(' '));
  const mx = await c.query(`SELECT (SELECT max(code) FROM inquiries WHERE org_id=$1) inq, (SELECT max(code) FROM samples WHERE org_id=$1) smp, (SELECT max(quote_no) FROM quotations WHERE org_id=$1) qtn, (SELECT max(order_code) FROM orders WHERE org_id=$1) ord, (SELECT max(pi_no) FROM orders WHERE org_id=$1) pi, (SELECT max(invoice_no) FROM dispatches WHERE org_id=$1) inv, (SELECT max(sdn_no) FROM dispatches WHERE org_id=$1) sdn, (SELECT max(receipt_no) FROM payments WHERE org_id=$1) rec, (SELECT max(buyer_code) FROM buyers WHERE org_id=$1) buy`, [org]);
  console.log('max codes', JSON.stringify(mx.rows[0]));
  // next-code probe in a rolled-back txn
  await c.query('BEGIN');
  await c.query(`SELECT set_config('app.current_org', $1, true)`, [org]);
  const nx = await c.query(`SELECT fn_next_code('INQ') inq, fn_next_code('SMP') smp, fn_next_code('ORD') ord, fn_next_code('BUY') buy, fn_next_doc_no('QTN') qtn, fn_next_doc_no('PI') pi, fn_next_doc_no('INV') inv, fn_next_doc_no('SDN') sdn, fn_next_doc_no('REC') rec`);
  console.log('next codes (rolled back)', JSON.stringify(nx.rows[0]));
  await c.query('ROLLBACK');
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
