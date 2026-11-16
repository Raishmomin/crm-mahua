// Security review 3: hosted Supabase readiness, simulated on the scratch database mahua_sc.
//
// What Supabase does (docs, row-level-security guide): "On Supabase the owner is postgres, which has
// bypassrls" and postgres is NOT a superuser. Supabase also sets default privileges so that every
// new table / function / sequence in public is granted to anon, authenticated and service_role.
// This script rebuilds that on plain Postgres 17:
//   sc_supa_postgres  LOGIN NOSUPERUSER BYPASSRLS CREATEROLE CREATEDB, member of anon/authenticated/service_role
//   mahua_sc          owned by sc_supa_postgres; Supabase-style default privileges set BEFORE the migrations
// then applies every migration + seed AS sc_supa_postgres (so it owns every table and definer).
//
// Usage (each step prints what it did):
//   node hosted-sim.cjs setup      create role + database + Supabase-style grants (+ pgcrypto in schema extensions;
//                                  add --pgcrypto-in-public to reproduce a non-Supabase install)
//   node hosted-sim.cjs seed       npm run db:seed:sql as sc_supa_postgres (run twice to prove idempotence)
//   node hosted-sim.cjs flow       demo-flow definers as impersonated users (BYPASSRLS owner), rolled back
//   node hosted-sim.cjs flow-norls same flow with the owner switched to NOBYPASSRLS inside the transaction
//   node hosted-sim.cjs anon       what anon / authenticated end up holding after the Supabase defaults
//   node hosted-sim.cjs teardown   drop mahua_sc and the role
// The role password below exists only for this local scratch role and is dropped at teardown.
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../..');
const SUPER = 'postgresql://postgres:postgres@127.0.0.1:5432';
const ROLE = 'sc_supa_postgres';
const ROLE_PW = 'sc_local_scratch_only';
const OWNER_URL = `postgresql://${ROLE}:${ROLE_PW}@127.0.0.1:5432/mahua_sc`;

function psql(url, sql) {
  const r = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=0', url], { input: sql, stdio: ['pipe', 'inherit', 'inherit'] });
  return r.status;
}
function run(cmd, args, env) {
  const r = spawnSync(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: 'inherit' });
  return r.status;
}

const step = process.argv[2];

if (step === 'setup') {
  psql(`${SUPER}/postgres`, String.raw`
DROP DATABASE IF EXISTS mahua_sc;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}') THEN EXECUTE 'DROP ROLE ${ROLE}'; END IF; END $$;
CREATE ROLE ${ROLE} LOGIN PASSWORD '${ROLE_PW}' NOSUPERUSER BYPASSRLS CREATEROLE CREATEDB;
GRANT anon, authenticated, service_role TO ${ROLE};
CREATE DATABASE mahua_sc OWNER ${ROLE};
ALTER ROLE ${ROLE} IN DATABASE mahua_sc SET search_path = "$user", public, extensions;
SELECT rolname, rolsuper, rolbypassrls, rolcreaterole FROM pg_roles WHERE rolname = '${ROLE}';
`);
  // Supabase pre-installs pgcrypto in schema extensions (owned by an admin role), so 0000's
  // CREATE EXTENSION IF NOT EXISTS is a no-op there. Without this step pgcrypto lands in public,
  // owned by the bootstrap superuser, and 0007 (run as the non-superuser owner) cannot revoke it.
  if (!process.argv.includes('--pgcrypto-in-public')) {
    psql(`${SUPER}/mahua_sc`, String.raw`
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role, ${ROLE};
SELECT extname, extnamespace::regnamespace FROM pg_extension WHERE extname = 'pgcrypto';
`);
  }
  // Supabase-style grants and default privileges, before any migration (as the owner itself).
  psql(OWNER_URL, String.raw`
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
SELECT defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl FROM pg_default_acl ORDER BY 3;
`);
} else if (step === 'seed') {
  process.exit(run('npx', ['tsx', 'scripts/seed.ts'], { DATABASE_URL: OWNER_URL }));
} else if (step === 'flow' || step === 'flow-norls') {
  const norls = step === 'flow-norls';
  // Connected as the (non-superuser) owner itself, like a Supabase migration / PostgREST would be.
  // For the NOBYPASSRLS variant the attribute change needs a superuser, so that run connects as postgres.
  const url = norls ? `${SUPER}/mahua_sc` : OWNER_URL;
  psql(url, String.raw`
\set ON_ERROR_ROLLBACK on
\pset footer off
BEGIN;
${norls ? `ALTER ROLE ${ROLE} NOBYPASSRLS;` : ''}
SELECT current_user AS connected_as, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS super,
       r.rolname AS fn_owner, r.rolsuper AS owner_super, r.rolbypassrls AS owner_bypassrls
FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner WHERE p.proname = 'fn_quote_accept';
SELECT c.relname, pg_get_userbyid(c.relowner) owner, c.relforcerowsecurity force_rls FROM pg_class c WHERE c.relname IN ('orders','payments','quotations','follow_ups') ORDER BY 1;
CREATE TEMP TABLE flow(k text PRIMARY KEY, v text);
GRANT ALL ON flow TO authenticated;

\echo '--- 1 sales: fn_sample_create + mark sent (invoker -> fn_sample_set_status definer -> follow_ups insert)'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222223","role":"authenticated"}', false),
       set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222223', false);
SELECT fn_sample_create('55555555-5555-4555-8555-555555555551','33333333-3333-4333-8333-333333333331',NULL,500,NULL,NULL,NULL,NULL,true) ->> 'code' AS sample;
\echo '--- 2 sales: new quote + item at 170/kg (floor 165) + fn_quote_send'
WITH q AS (INSERT INTO quotations (org_id, buyer_id, currency, valid_till) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551','INR', CURRENT_DATE + 7) RETURNING id)
INSERT INTO flow SELECT 'quote', id::text FROM q;
INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate)
SELECT '11111111-1111-4111-8111-111111111111', v::uuid, '33333333-3333-4333-8333-333333333331', 1000, 'kg', 170 FROM flow WHERE k = 'quote';
SELECT fn_quote_send(v::uuid) FROM flow WHERE k = 'quote';
SELECT quote_no, status, total FROM quotations WHERE id = (SELECT v::uuid FROM flow WHERE k = 'quote');
\echo '--- 3 sales: fn_quote_accept (30% advance) -> order'
INSERT INTO flow SELECT 'order', fn_quote_accept(v::uuid, CURRENT_DATE + 20, 30)::text FROM flow WHERE k = 'quote';
SELECT order_code, pi_no, status, total, advance_expected, step_dates FROM orders WHERE id = (SELECT v::uuid FROM flow WHERE k = 'order');
\echo '--- 4 operations: in_production, packed, advance waiting?'
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222224","role":"authenticated"}', false),
       set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222224', false);
SELECT fn_order_set_status(v::uuid, 'in_production') FROM flow WHERE k = 'order';
SELECT fn_order_set_packed(v::uuid, 40) FROM flow WHERE k = 'order';
SELECT fn_order_advance_waiting(v::uuid) AS ops_sees_advance_waiting_before FROM flow WHERE k = 'order';
\echo '--- 5 accountant: fn_payment_record of the advance'
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', false),
       set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT fn_payment_record(o.id, o.advance_expected, CURRENT_DATE, 'bank') IS NOT NULL AS payment_recorded
FROM orders o WHERE o.id = (SELECT v::uuid FROM flow WHERE k = 'order');
SELECT order_code, received, due, advance_ok FROM v_order_balances WHERE order_id = (SELECT v::uuid FROM flow WHERE k = 'order');
\echo '--- 6 operations: advance waiting? then fn_order_dispatch (truck)'
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222224","role":"authenticated"}', false),
       set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222224', false);
SELECT fn_order_advance_waiting(v::uuid) AS ops_sees_advance_waiting_after FROM flow WHERE k = 'order';
SELECT fn_order_dispatch(v::uuid, 'truck', 'GJ04AB1234', 'LR-1', 'Mahuva Transport', 40, 1000, NULL, NULL, NULL, NULL, NULL) IS NOT NULL AS dispatched FROM flow WHERE k = 'order';
\echo '--- 7 sales: fn_follow_up_done on the dispatch balance reminder; owner Home'
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222223","role":"authenticated"}', false),
       set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222223', false);
SELECT f.note, fn_follow_up_done(f.id) FROM follow_ups f
WHERE f.entity_id = (SELECT v::uuid FROM flow WHERE k = 'order') AND f.done = false ORDER BY f.created_at LIMIT 1;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222221","role":"authenticated"}', false),
       set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222221', false);
SELECT o.order_code, o.status, o.step_dates, b.received, b.due FROM orders o JOIN v_order_balances b ON b.order_id = o.id WHERE o.id = (SELECT v::uuid FROM flow WHERE k = 'order');
SELECT new_inquiries, quotes_waiting, orders_in_production, money_due_inr, money_due_usd, money_overdue_count, followups_today FROM v_home_kpis;
\echo '--- 8 owner: fn_quote_reject on QTN-0003, fn_inquiry_set_status, fn_dispatch_tick on ORD-0002 container, fn_dispatch_delivered'
SELECT fn_quote_reject('88888888-8888-4888-8888-888888888803', 'price');
SELECT fn_inquiry_set_status(id, 'talking') FROM inquiries WHERE status = 'new' ORDER BY code LIMIT 1;
SELECT fn_dispatch_tick(d.id, 'coa', true) FROM dispatches d WHERE d.order_id = '99999999-9999-4999-8999-999999999902';
SELECT fn_dispatch_delivered(d.id) FROM dispatches d WHERE d.order_id = '99999999-9999-4999-8999-999999999902';
SELECT order_code, status FROM orders WHERE id = '99999999-9999-4999-8999-999999999902';
RESET ROLE;
ROLLBACK;
`);
} else if (step === 'anon') {
  psql(OWNER_URL, String.raw`
\pset footer off
\echo '--- privileges anon / authenticated hold after Supabase defaults + migrations'
SELECT count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE')) AS anon_exec_fns,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')) AS public_exec_fns,
       count(*) FILTER (WHERE has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS auth_exec_fns,
       count(*) FILTER (WHERE p.proname IN ('fn_next_code','fn_next_doc_no') AND has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS generators_auth
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace;
SELECT string_agg(c.relname || ':' || concat_ws('', CASE WHEN has_table_privilege('anon', c.oid, 'SELECT') THEN 'S' END,
         CASE WHEN has_table_privilege('anon', c.oid, 'INSERT') THEN 'I' END, CASE WHEN has_table_privilege('anon', c.oid, 'UPDATE') THEN 'U' END,
         CASE WHEN has_table_privilege('anon', c.oid, 'DELETE') THEN 'D' END, CASE WHEN has_table_privilege('anon', c.oid, 'TRUNCATE') THEN 'T' END), ' ' ORDER BY c.relname)
       FILTER (WHERE has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS anon_table_privs,
       count(*) FILTER (WHERE has_table_privilege('authenticated', c.oid, 'TRUNCATE') OR has_table_privilege('authenticated', c.oid, 'REFERENCES') OR has_table_privilege('authenticated', c.oid, 'TRIGGER')) AS auth_trunc_ref_trig
FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','v');
SELECT defaclrole::regrole, coalesce(defaclnamespace::regnamespace::text, '<all>') schema, defaclobjtype, defaclacl FROM pg_default_acl ORDER BY 2, 3;
\echo '--- anon tries to read and write (expect permission denied / 0 rows, never data)'
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false), set_config('request.jwt.claim.sub', '', false);
\set ON_ERROR_ROLLBACK on
BEGIN;
SELECT count(*) FROM buyers;
SELECT count(*) FROM payments;
SELECT * FROM v_home_kpis;
INSERT INTO inquiries (org_id, buyer_name) VALUES ('11111111-1111-4111-8111-111111111111', 'anon');
UPDATE buyers SET credit_period_days = 365;
DELETE FROM follow_ups;
SELECT fn_follow_up_done('cccccccc-cccc-4ccc-8ccc-cccccccccc01');
SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 1, CURRENT_DATE, 'cash');
SELECT fn_next_code('INQ');
SELECT fn_current_org();
ROLLBACK;
RESET ROLE;
`);
} else if (step === 'teardown') {
  psql(`${SUPER}/postgres`, String.raw`
DROP DATABASE IF EXISTS mahua_sc;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}') THEN EXECUTE 'DROP ROLE ${ROLE}'; END IF; END $$;
SELECT count(*) AS mahua_sc_left FROM pg_database WHERE datname = 'mahua_sc';
SELECT count(*) AS role_left FROM pg_roles WHERE rolname = '${ROLE}';
`);
} else {
  console.error('usage: node hosted-sim.cjs setup|seed|flow|flow-norls|anon|teardown');
  process.exit(2);
}
