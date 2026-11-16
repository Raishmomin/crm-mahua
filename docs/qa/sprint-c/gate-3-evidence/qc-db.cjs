// QA gate 3: scratch-DB helper. usage: node qc-db.cjs create|drop|remaining|counts|story|hash <dbname...>
// Reads only; 'counts' and 'story' run their probes in a rolled-back transaction.
const { Client } = require('/home/raish/raish/mahua-crm/node_modules/pg');
const [, , cmd, ...dbs] = process.argv;
const url = (db) => `postgresql://postgres:postgres@127.0.0.1:5432/${db}`;
const ORG = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222221';
const OPS = '22222222-2222-4222-8222-222222222224';

(async () => {
  if (cmd === 'create' || cmd === 'drop' || cmd === 'remaining') {
    const c = new Client({ connectionString: url('postgres') });
    await c.connect();
    for (const db of dbs) {
      if (!/^mahua_qc[a-z0-9_]*$/.test(db)) throw new Error('QA may only touch mahua_qc*');
      if (cmd === 'create') { await c.query(`DROP DATABASE IF EXISTS ${db}`); await c.query(`CREATE DATABASE ${db}`); console.log('created', db); }
      if (cmd === 'drop') { await c.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`); console.log('dropped', db); }
    }
    const r = await c.query(`SELECT count(*)::int n FROM pg_database WHERE datname LIKE 'mahua_qc%'`);
    console.log('mahua_qc* databases remaining:', r.rows[0].n);
    await c.end();
    return;
  }
  for (const db of dbs) {
    const c = new Client({ connectionString: url(db) });
    await c.connect();
    if (cmd === 'counts') {
      const tables = ['buyers', 'inquiries', 'samples', 'quotations', 'quotation_items', 'orders', 'order_items', 'dispatches', 'payments', 'follow_ups'];
      const out = {};
      for (const t of tables) out[t] = Number((await c.query(`SELECT count(*) FROM ${t} WHERE org_id=$1`, [ORG])).rows[0].count);
      out.follow_ups_pending = Number((await c.query(`SELECT count(*) FROM follow_ups WHERE org_id=$1 AND done=false`, [ORG])).rows[0].count);
      out.follow_ups_notes = Number((await c.query(`SELECT count(*) FROM follow_ups WHERE org_id=$1 AND due_on IS NULL`, [ORG])).rows[0].count);
      out.audit_cost_rows = Number((await c.query(`SELECT count(*) FROM audit_log WHERE table_name='product_costs'`)).rows[0].count);
      out.audit_bank_snapshots = Number((await c.query(`SELECT count(*) FROM audit_log WHERE table_name='business_settings' AND (coalesce(old_data,'{}'::jsonb) ? 'bank_details' OR coalesce(new_data,'{}'::jsonb) ? 'bank_details')`)).rows[0].count);
      console.log(db, 'counts', JSON.stringify(out));
      const ec = await c.query(`SELECT prefix, current_val FROM entity_code_counters WHERE org_id=$1 ORDER BY prefix`, [ORG]);
      console.log(db, 'entity_code_counters', ec.rows.map((r) => `${r.prefix}=${r.current_val}`).join(' '));
      const dc = await c.query(`SELECT doc_type, fy, current_val FROM doc_counters WHERE org_id=$1 ORDER BY doc_type`, [ORG]);
      console.log(db, 'doc_counters', dc.rows.map((r) => `${r.doc_type}/${r.fy}=${r.current_val}`).join(' '));
      const sd = await c.query(`SELECT order_code, status, (SELECT json_object_agg(k, CURRENT_DATE - (v #>> '{}')::date ORDER BY k) FROM jsonb_each(step_dates) e(k, v)) AS step_days_ago FROM orders WHERE org_id=$1 ORDER BY order_code`, [ORG]);
      for (const r of sd.rows) console.log(db, 'step_dates (days ago)', r.order_code, r.status, JSON.stringify(r.step_days_ago));
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.current_org', $1, true)`, [ORG]);
      const nx = await c.query(`SELECT fn_next_code('INQ') inq, fn_next_code('SMP') smp, fn_next_code('ORD') ord, fn_next_code('BUY') buy, fn_next_doc_no('QTN') qtn, fn_next_doc_no('PI') pi, fn_next_doc_no('INV') inv, fn_next_doc_no('SDN') sdn, fn_next_doc_no('REC') rec`);
      await c.query('ROLLBACK');
      console.log(db, 'next codes (rolled back)', JSON.stringify(nx.rows[0]));
    }
    if (cmd === 'story') {
      for (const [who, uid] of [['owner', OWNER], ['ops', OPS]]) {
        await c.query('BEGIN');
        await c.query('SET LOCAL ROLE authenticated');
        await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [uid, JSON.stringify({ sub: uid, role: 'authenticated' })]);
        const k = (await c.query('SELECT new_inquiries, quotes_waiting, orders_in_production, money_due_inr, money_due_usd, money_due_about_inr, money_overdue_count, followups_today, papers_pending FROM v_home_kpis')).rows[0];
        await c.query('ROLLBACK');
        console.log(db, `${who} v_home_kpis`, JSON.stringify(k));
        if (who === 'owner') {
          const want = { new_inquiries: 2, quotes_waiting: 1, orders_in_production: 1, money_due_inr: 511875, money_due_usd: 18900, money_overdue_count: 1, followups_today: 5 };
          const bad = Object.entries(want).filter(([key, v]) => Number(k[key]) !== v);
          console.log(db, bad.length ? `SEED STORY MISMATCH ${JSON.stringify(bad)}` : 'SEED STORY OK (2 / 1 / 1 / 511875 + 18900 / 1 late / 5 to do)');
        }
      }
    }
    if (cmd === 'hash') {
      const f = await c.query(`SELECT md5(string_agg(p.proname||':'||md5(p.prosrc)||':'||p.prosecdef||':'||coalesce(p.proacl::text,''), ',' ORDER BY p.proname, md5(p.prosrc))) h, count(*) n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`);
      const pol = await c.query(`SELECT md5(string_agg(tablename||':'||policyname||':'||coalesce(qual,'')||':'||coalesce(with_check,''), ',' ORDER BY tablename, policyname)) h, count(*) n FROM pg_policies WHERE schemaname='public'`);
      const trg = await c.query(`SELECT md5(string_agg(tgrelid::regclass||':'||tgname, ',' ORDER BY tgrelid::regclass::text, tgname)) h, count(*) n FROM pg_trigger WHERE NOT tgisinternal`);
      const gr = await c.query(`SELECT md5(string_agg(table_name||':'||column_name||':'||grantee||':'||privilege_type, ',' ORDER BY table_name, column_name, grantee, privilege_type)) h, count(*) n FROM information_schema.column_privileges WHERE table_schema='public' AND grantee IN ('authenticated','anon')`);
      const cols = await c.query(`SELECT md5(string_agg(table_name||':'||column_name||':'||data_type, ',' ORDER BY table_name, column_name)) h, count(*) n FROM information_schema.columns WHERE table_schema='public'`);
      const da = await c.query(`SELECT coalesce(string_agg(pg_get_userbyid(defaclrole)||'/'||defaclobjtype::text||'/'||coalesce(defaclnamespace::regnamespace::text,'*')||'='||defaclacl::text, ' ; ' ORDER BY defaclrole, defaclobjtype), '') d FROM pg_default_acl`);
      console.log(db, JSON.stringify({ funcs: f.rows[0], policies: pol.rows[0], triggers: trg.rows[0], colgrants: gr.rows[0], columns: cols.rows[0] }));
      console.log(db, 'default ACLs:', da.rows[0].d);
    }
    await c.end();
  }
})().catch((e) => { console.error('ERR', e.code, e.message); process.exit(1); });
