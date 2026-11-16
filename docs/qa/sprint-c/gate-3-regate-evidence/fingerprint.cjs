// QA gate 3 re-gate: per-table fingerprint of the demo org MDPL (rows ordered by id, timestamps that
// the seed sets from now() dropped; doc_counters.id is a fresh random uuid after the reset, so it is dropped too). Two runs that print the same lines hold the same demo data.
// usage: node fingerprint.cjs <db>
const { Client } = require('/home/raish/raish/mahua-crm/node_modules/pg');
const ORG = '11111111-1111-4111-8111-111111111111';
const T = ['buyers', 'buyer_contacts', 'inquiries', 'samples', 'quotations', 'quotation_items', 'orders', 'order_items', 'dispatches', 'payments', 'follow_ups', 'entity_code_counters', 'doc_counters', 'products', 'price_list_items', 'packaging_types', 'business_settings', 'app_settings', 'profiles'];
(async () => {
  const c = new Client({ connectionString: `postgresql://postgres:postgres@127.0.0.1:5432/${process.argv[2]}` });
  await c.connect();
  for (const t of T) {
    const row = `(to_jsonb(x) - 'created_at' - 'updated_at' - (CASE WHEN '${t}' = 'doc_counters' THEN 'id' ELSE '' END))::text`;
    const r = await c.query(`SELECT count(*)::int n, md5(coalesce(string_agg(${row}, '|' ORDER BY ${row}), '')) h FROM ${t} x WHERE org_id=$1`, [ORG]);
    console.log(`${t.padEnd(22)} n=${String(r.rows[0].n).padEnd(4)} ${r.rows[0].h}`);
  }
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
