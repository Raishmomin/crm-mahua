// usage: node views.cjs <dbname> [uid]
const { Client } = require('/home/raish/raish/mahua-crm/node_modules/pg');
const [, , db, uidArg] = process.argv;
const uid = uidArg || '22222222-2222-4222-8222-222222222221';
(async () => {
  const c = new Client({ connectionString: `postgresql://postgres:postgres@127.0.0.1:5432/${db}` });
  await c.connect();
  await c.query('BEGIN');
  await c.query('SET LOCAL ROLE authenticated');
  await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid]);
  const q = async (label, sql) => { const r = await c.query(sql); console.log(`## ${label} (${r.rowCount})`); for (const row of r.rows) console.log('  ', JSON.stringify(row)); };
  await q('v_home_kpis', 'SELECT * FROM v_home_kpis');
  await q('v_followups_today', 'SELECT entity_type, note, due_on, days_late, buyer_name, phone FROM v_followups_today');
  await q('v_money_due', 'SELECT buyer_name, currency, total_due, orders_due, max_days_overdue, oldest_due_date, money_status, phone FROM v_money_due');
  await q('v_order_balances', 'SELECT order_code, buyer_name, order_status, currency, total, received, due, advance_ok, due_date, days_overdue, money_status FROM v_order_balances ORDER BY order_code');
  await q('v_orders_in_production', 'SELECT order_code, buyer_name, status, planned_bags, bag_kg, packed_bags, expected_dispatch, product_summary, qty_kg FROM v_orders_in_production');
  await q('inquiries by status', "SELECT status, count(*) FROM inquiries GROUP BY 1 ORDER BY 1");
  await q('quotes', "SELECT quote_no, status, currency, subtotal, gst_amount, total, valid_till FROM quotations ORDER BY quote_no");
  await q('dispatch ORD-0002', "SELECT d.mode, d.container_no, d.port, d.eta, d.bl_no, (SELECT count(*) FROM jsonb_each(d.export_checklist) e WHERE (e.value->>'done')::boolean) done_n, (SELECT count(*) FROM jsonb_each(d.export_checklist)) keys_n FROM dispatches d ORDER BY sdn_no");
  await c.query('ROLLBACK');
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
