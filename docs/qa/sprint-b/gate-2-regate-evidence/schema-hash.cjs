const { Client } = require('/home/raish/raish/mahua-crm/node_modules/pg');
(async () => {
  for (const db of process.argv.slice(2)) {
    const c = new Client({ connectionString: `postgresql://postgres:postgres@127.0.0.1:5432/${db}` });
    await c.connect();
    const f = await c.query(`SELECT md5(string_agg(p.proname||':'||md5(p.prosrc)||':'||p.prosecdef, ',' ORDER BY p.proname, md5(p.prosrc))) h, count(*) n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`);
    const pol = await c.query(`SELECT md5(string_agg(tablename||':'||policyname||':'||coalesce(qual,'')||':'||coalesce(with_check,''), ',' ORDER BY tablename, policyname)) h, count(*) n FROM pg_policies WHERE schemaname='public'`);
    const trg = await c.query(`SELECT md5(string_agg(tgrelid::regclass||':'||tgname, ',' ORDER BY tgrelid::regclass::text, tgname)) h, count(*) n FROM pg_trigger WHERE NOT tgisinternal`);
    const gr = await c.query(`SELECT md5(string_agg(table_name||':'||column_name||':'||grantee||':'||privilege_type, ',' ORDER BY table_name, column_name, grantee, privilege_type)) h, count(*) n FROM information_schema.column_privileges WHERE table_schema='public' AND grantee IN ('authenticated','anon')`);
    const has = await c.query(`SELECT to_regprocedure('fn_quote_update_draft(uuid,uuid,uuid,text,numeric,text,date,text,text,jsonb)') IS NOT NULL upd, (SELECT count(*) FROM pg_trigger WHERE tgname='trg_quotations_currency_recheck') recheck_trg`);
    console.log(db, JSON.stringify({ funcs: f.rows[0], policies: pol.rows[0], triggers: trg.rows[0], colgrants: gr.rows[0], ...has.rows[0] }));
    await c.end();
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
