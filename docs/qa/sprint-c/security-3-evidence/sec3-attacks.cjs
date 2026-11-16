// Security review 3 (Sprint C sign-off): attacks on every Sprint C security fix, as owner,
// accountant, sales, operations, anon and an org-B owner. ONE transaction, always rolled back.
// Usage: node docs/qa/sprint-c/security-3-evidence/sec3-attacks.cjs [db]   (default onion_crm)
// Needs psql on PATH. Talks only to the local container (postgres:postgres@127.0.0.1:5432).
const { spawnSync } = require('child_process');

const db = process.argv[2] || 'onion_crm';
if (!/^(onion_crm|mahua_sc)$/.test(db)) {
  console.error('Refusing: run against onion_crm or the scratch database mahua_sc only.');
  process.exit(2);
}
const url = `postgresql://postgres:postgres@127.0.0.1:5432/${db}`;

const SQL = String.raw`
\set ON_ERROR_ROLLBACK on
\set ON_ERROR_STOP off
\pset footer off
\pset null '(null)'
BEGIN;
-- ===================== fixture: org B (as postgres, inside the transaction) =====================
INSERT INTO organizations (id, name, code) VALUES ('bbbbbbbb-0000-4000-8000-00000000000b', 'Attacker Target B', 'SECB');
INSERT INTO auth.users (id, email) VALUES ('bbbbbbbb-0000-4000-8000-0000000000a1', 'owner@secb.test');
INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active) VALUES
 ('bbbbbbbb-0000-4000-8000-0000000000a1','bbbbbbbb-0000-4000-8000-00000000000b','owner@secb.test','Owner B','owner',
  ARRAY['dashboard','leads','buyers','samples','quotes','orders','payments','catalog','documents','reports','users','settings','audit'], true);
INSERT INTO products (id, org_id, code, name, form, color, mesh, gst_rate) VALUES
 ('bbbbbbbb-0000-4000-8000-000000000c01','bbbbbbbb-0000-4000-8000-00000000000b','B-P1','B Flakes','flakes','white','8-15 mm', 12);
INSERT INTO packaging_types (id, org_id, name) VALUES ('bbbbbbbb-0000-4000-8000-000000000c11','bbbbbbbb-0000-4000-8000-00000000000b','B bag');
INSERT INTO buyers (id, org_id, buyer_code, company_name, buyer_type, country) VALUES
 ('bbbbbbbb-0000-4000-8000-000000000b01','bbbbbbbb-0000-4000-8000-00000000000b','BUY-B01','Secret Buyer B','export_importer','Germany');
INSERT INTO inquiries (id, org_id, code, buyer_id, buyer_name, status) VALUES
 ('bbbbbbbb-0000-4000-8000-000000000d01','bbbbbbbb-0000-4000-8000-00000000000b','INQ-B01','bbbbbbbb-0000-4000-8000-000000000b01','Secret Buyer B','talking');
INSERT INTO quotations (id, org_id, quote_no, buyer_id, inquiry_id, currency, status, valid_till) VALUES
 ('bbbbbbbb-0000-4000-8000-000000000e01','bbbbbbbb-0000-4000-8000-00000000000b','QTN-B-01','bbbbbbbb-0000-4000-8000-000000000b01','bbbbbbbb-0000-4000-8000-000000000d01','INR','sent', CURRENT_DATE + 5),
 ('bbbbbbbb-0000-4000-8000-000000000e02','bbbbbbbb-0000-4000-8000-00000000000b','QTN-B-02','bbbbbbbb-0000-4000-8000-000000000b01',NULL,'INR','draft', CURRENT_DATE + 5);
INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES
 ('bbbbbbbb-0000-4000-8000-00000000000b','bbbbbbbb-0000-4000-8000-000000000e01','bbbbbbbb-0000-4000-8000-000000000c01',100,'kg',100),
 ('bbbbbbbb-0000-4000-8000-00000000000b','bbbbbbbb-0000-4000-8000-000000000e02','bbbbbbbb-0000-4000-8000-000000000c01',100,'kg',100);
INSERT INTO samples (id, org_id, code, buyer_id, product_id, status) VALUES
 ('bbbbbbbb-0000-4000-8000-000000000f41','bbbbbbbb-0000-4000-8000-00000000000b','SMP-B01','bbbbbbbb-0000-4000-8000-000000000b01','bbbbbbbb-0000-4000-8000-000000000c01','to_send');
INSERT INTO follow_ups (id, org_id, entity_type, entity_id, buyer_id, note, due_on, done) VALUES
 ('bbbbbbbb-0000-4000-8000-000000000f31','bbbbbbbb-0000-4000-8000-00000000000b','inquiry','bbbbbbbb-0000-4000-8000-000000000d01','bbbbbbbb-0000-4000-8000-000000000b01','B secret note', CURRENT_DATE, false);
INSERT INTO orders (id, org_id, order_code, pi_no, buyer_id, currency, incoterm, payment_terms, total, advance_expected, status, packed_bags) VALUES
 ('bbbbbbbb-0000-4000-8000-000000000f01','bbbbbbbb-0000-4000-8000-00000000000b','ORD-B01','PI-B01','bbbbbbbb-0000-4000-8000-000000000b01','INR','EXW','100% advance', 10000, 10000,'ready', 4),
 ('bbbbbbbb-0000-4000-8000-000000000f02','bbbbbbbb-0000-4000-8000-00000000000b','ORD-B02','PI-B02','bbbbbbbb-0000-4000-8000-000000000b01','INR','EXW','100% advance', 10000, 0,'dispatched', 4);
INSERT INTO order_items (org_id, order_id, product_id, qty_kg, unit, rate, amount) VALUES
 ('bbbbbbbb-0000-4000-8000-00000000000b','bbbbbbbb-0000-4000-8000-000000000f01','bbbbbbbb-0000-4000-8000-000000000c01',100,'kg',100,10000),
 ('bbbbbbbb-0000-4000-8000-00000000000b','bbbbbbbb-0000-4000-8000-000000000f02','bbbbbbbb-0000-4000-8000-000000000c01',100,'kg',100,10000);
INSERT INTO dispatches (id, org_id, order_id, sdn_no, invoice_no, mode, qty_kg, container_no, port, export_checklist) VALUES
 ('bbbbbbbb-0000-4000-8000-000000000f11','bbbbbbbb-0000-4000-8000-00000000000b','bbbbbbbb-0000-4000-8000-000000000f02','SDN-B01','INV-B01','container',100,'ABCU1234567','Mundra','{"coo":{"done":false,"date":null}}');
INSERT INTO payments (id, org_id, receipt_no, order_id, buyer_id, amount, currency, mode) VALUES
 ('bbbbbbbb-0000-4000-8000-000000000f21','bbbbbbbb-0000-4000-8000-00000000000b','REC-B01','bbbbbbbb-0000-4000-8000-000000000f02','bbbbbbbb-0000-4000-8000-000000000b01', 500,'INR','bank');

-- probe(sql): runs one statement as the CURRENT role in a sub-transaction that is always undone,
-- and returns 'ok rows=N' or 'SQLSTATE message | detail'. Exists only inside this transaction.
CREATE FUNCTION public.zz_probe(p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v_state text; v_msg text; v_detail text; v_n bigint;
BEGIN
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001', MESSAGE = 'ok rows=' || v_n;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT, v_detail = PG_EXCEPTION_DETAIL;
    IF v_state = 'ZZ001' THEN RETURN v_msg; END IF;
    RETURN v_state || ' ' || v_msg || COALESCE(' | ' || NULLIF(v_detail, ''), '');
  END;
END $f$;
GRANT EXECUTE ON FUNCTION public.zz_probe(text) TO authenticated, anon;

-- ===================== A. catalog (as postgres) =====================
\echo '=== A1 routines in public executable by PUBLIC / anon / authenticated'
SELECT count(*) AS routines,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')) AS public_exec,
       count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE')) AS anon_exec,
       count(*) FILTER (WHERE has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS auth_exec
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname <> 'zz_probe';
\echo '=== A2 authenticated may execute (names)'
SELECT string_agg(DISTINCT p.proname, ', ' ORDER BY p.proname) AS auth_exec_names
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname <> 'zz_probe'
  AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
\echo '=== A3 SECURITY DEFINER functions: count, without search_path=public, anon-executable, trigger fns executable by authenticated, generators'
SELECT count(*) FILTER (WHERE p.prosecdef) AS definers,
       count(*) FILTER (WHERE p.prosecdef AND NOT ('search_path=public' = ANY (coalesce(p.proconfig, '{}')))) AS definers_no_search_path,
       count(*) FILTER (WHERE p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')) AS definers_anon,
       count(*) FILTER (WHERE p.prorettype = 'trigger'::regtype AND has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS trigger_fns_auth,
       bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')) FILTER (WHERE p.proname IN ('fn_next_code','fn_next_doc_no')) AS generators_auth
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname <> 'zz_probe';
\echo '=== A4 default privileges (pg_default_acl)'
SELECT defaclrole::regrole AS role, coalesce(defaclnamespace::regnamespace::text, '<all schemas>') AS schema, defaclobjtype AS type, defaclacl FROM pg_default_acl ORDER BY 1, 2, 3;
\echo '=== A5 SEC1-03 legacy audit rows (expect 0 / 0)'
SELECT (SELECT count(*) FROM audit_log WHERE table_name = 'product_costs') AS product_costs_rows,
       (SELECT count(*) FROM audit_log WHERE table_name = 'business_settings' AND (old_data ? 'bank_details' OR new_data ? 'bank_details')) AS bank_snapshots;
\echo '=== A6 web-role table privileges on function-only tables and money views (expect all f)'
SELECT c.relname,
       has_table_privilege('authenticated', c.oid, 'INSERT') ins, has_table_privilege('authenticated', c.oid, 'UPDATE') upd,
       has_table_privilege('authenticated', c.oid, 'DELETE') del, has_table_privilege('anon', c.oid, 'SELECT') anon_sel
FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('orders','order_items','dispatches','payments','v_order_balances','v_money_due','v_home_kpis','audit_log') ORDER BY 1;

-- ===================== B. anon: every routine and every table =====================
\echo '=== B1 anon calls every routine in public with NULL args passed as sub-selects, so the planner cannot fold STRICT calls away (expect 42501 permission denied for every one)'
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false);
SELECT split_part(r.res, ' ', 1) || ' ' || CASE WHEN r.res LIKE '%permission denied for function%' THEN 'permission denied for function' ELSE r.res END AS result,
       count(*) AS n, string_agg(r.proname, ',' ORDER BY r.proname) FILTER (WHERE r.res NOT LIKE '%permission denied for function%') AS not_denied
FROM (
  SELECT p.proname,
         zz_probe(format('SELECT public.%I(%s)', p.proname,
           coalesce((SELECT string_agg('(SELECT NULL::' || format_type(t, NULL) || ')', ',' ORDER BY o) FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY u(t, o)), ''))) AS res
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname <> 'zz_probe'
) r GROUP BY 1 ORDER BY 2 DESC;
\echo '=== B2 anon SELECT / INSERT on every public table and view'
SELECT CASE WHEN r.res LIKE '42501 permission denied for%' THEN '42501 permission denied' ELSE r.res END AS result, count(*) n,
       string_agg(r.relname, ',' ORDER BY r.relname) AS objects
FROM (SELECT c.relname, zz_probe(format('SELECT 1 FROM public.%I', c.relname)) res
      FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','v')) r GROUP BY 1;
SELECT zz_probe($q$INSERT INTO inquiries (org_id, buyer_name) VALUES ('11111111-1111-4111-8111-111111111111','anon')$q$) AS anon_insert_inquiry,
       zz_probe($q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 1, CURRENT_DATE, 'cash')$q$) AS anon_payment,
       zz_probe($q$SELECT fn_order_advance_waiting('99999999-9999-4999-8999-999999999903')$q$) AS anon_advance;
RESET ROLE;

-- ===================== C. A9 (G2-05, SEC2-05, SEC2-11) as sales =====================
\echo '=== C1 sales: INSERT with a forged start state or author (expect 42501 RLS on every forged row, ok on controls)'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222223', false),
       set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222223","role":"authenticated"}', false);
SELECT t.label, zz_probe(t.q) AS result FROM (VALUES
 ('inq status won',        $q$INSERT INTO inquiries (org_id, buyer_name, status) VALUES ('11111111-1111-4111-8111-111111111111','x','won')$q$),
 ('inq status quoted',     $q$INSERT INTO inquiries (org_id, buyer_name, status) VALUES ('11111111-1111-4111-8111-111111111111','x','quoted')$q$),
 ('inq lost_reason',       $q$INSERT INTO inquiries (org_id, buyer_name, lost_reason) VALUES ('11111111-1111-4111-8111-111111111111','x','price')$q$),
 ('inq closed_at',         $q$INSERT INTO inquiries (org_id, buyer_name, closed_at) VALUES ('11111111-1111-4111-8111-111111111111','x',now())$q$),
 ('inq created_by owner',  $q$INSERT INTO inquiries (org_id, buyer_name, created_by) VALUES ('11111111-1111-4111-8111-111111111111','x','22222222-2222-4222-8222-222222222221')$q$),
 ('inq control',           $q$INSERT INTO inquiries (org_id, buyer_name) VALUES ('11111111-1111-4111-8111-111111111111','x')$q$),
 ('fu done_by owner',      $q$INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on, done, done_by) VALUES ('11111111-1111-4111-8111-111111111111','buyer','55555555-5555-4555-8555-555555555551','x',NULL,true,'22222222-2222-4222-8222-222222222221')$q$),
 ('fu note as owner',      $q$INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on, done, created_by) VALUES ('11111111-1111-4111-8111-111111111111','buyer','55555555-5555-4555-8555-555555555551','x',NULL,true,'22222222-2222-4222-8222-222222222221')$q$),
 ('fu reminder pre-ticked',$q$INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on, done, done_at) VALUES ('11111111-1111-4111-8111-111111111111','buyer','55555555-5555-4555-8555-555555555551','x',CURRENT_DATE,true,now())$q$),
 ('fu pending w/ done_at', $q$INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on, done, done_at) VALUES ('11111111-1111-4111-8111-111111111111','buyer','55555555-5555-4555-8555-555555555551','x',CURRENT_DATE,false,now())$q$),
 ('fu payment (no module)',$q$INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on) VALUES ('11111111-1111-4111-8111-111111111111','payment','99999999-9999-4999-8999-999999999903','x',CURRENT_DATE)$q$),
 ('fu control note',       $q$INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on, done, done_at) VALUES ('11111111-1111-4111-8111-111111111111','buyer','55555555-5555-4555-8555-555555555551','x',NULL,true,now())$q$),
 ('fu control reminder',   $q$INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on) VALUES ('11111111-1111-4111-8111-111111111111','buyer','55555555-5555-4555-8555-555555555551','x',CURRENT_DATE+1)$q$),
 ('smp status sent',       $q$INSERT INTO samples (org_id, buyer_id, product_id, status) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551','33333333-3333-4333-8333-333333333331','sent')$q$),
 ('smp status approved',   $q$INSERT INTO samples (org_id, buyer_id, product_id, status) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551','33333333-3333-4333-8333-333333333331','approved')$q$),
 ('smp decided_on',        $q$INSERT INTO samples (org_id, buyer_id, product_id, decided_on) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551','33333333-3333-4333-8333-333333333331',CURRENT_DATE)$q$),
 ('smp created_by owner',  $q$INSERT INTO samples (org_id, buyer_id, product_id, created_by) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551','33333333-3333-4333-8333-333333333331','22222222-2222-4222-8222-222222222221')$q$),
 ('smp control',           $q$INSERT INTO samples (org_id, buyer_id, product_id) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551','33333333-3333-4333-8333-333333333331')$q$),
 ('qtn status sent',       $q$INSERT INTO quotations (org_id, buyer_id, status) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551','sent')$q$),
 ('qtn sent_at',           $q$INSERT INTO quotations (org_id, buyer_id, sent_at) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551',now())$q$),
 ('qtn decided_at',        $q$INSERT INTO quotations (org_id, buyer_id, decided_at) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551',now())$q$),
 ('qtn reject_reason',     $q$INSERT INTO quotations (org_id, buyer_id, reject_reason) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551','price')$q$),
 ('qtn created_by owner',  $q$INSERT INTO quotations (org_id, buyer_id, created_by) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551','22222222-2222-4222-8222-222222222221')$q$),
 ('qtn control',           $q$INSERT INTO quotations (org_id, buyer_id) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551')$q$)
) t(label, q);
\echo '=== C2 sales: forged totals on a new quote are replaced (expect 0.00 | 0.00 | 0.00)'
INSERT INTO quotations (org_id, buyer_id, subtotal, gst_amount, total) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551', 999999, 1, 1000000)
RETURNING quote_no, subtotal, gst_amount, total, status;
\echo '=== C3 sales: deletes (system reminder, owner note, ticked reminder, own pending reminder, sent/approved sample, own plain note, to_send sample)'
SELECT t.label, zz_probe(t.q) AS result FROM (VALUES
 ('del Balance $18,900 due (accountant reminder)', $q$DELETE FROM follow_ups WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01'$q$),
 ('del owner plain note cc16',                     $q$DELETE FROM follow_ups WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc16'$q$),
 ('del own pending reminder cc03',                 $q$DELETE FROM follow_ups WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc03'$q$),
 ('del own plain note cc11',                       $q$DELETE FROM follow_ups WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc11'$q$),
 ('del EVERY follow-up (what is deletable?)',      $q$DELETE FROM follow_ups$q$),
 ('del sample SMP-0001 approved',                  $q$DELETE FROM samples WHERE id = '77777777-7777-4777-8777-777777777701'$q$),
 ('del sample SMP-0002 sent',                      $q$DELETE FROM samples WHERE id = '77777777-7777-4777-8777-777777777702'$q$),
 ('del sample SMP-0003 to_send (allowed)',         $q$DELETE FROM samples WHERE id = '77777777-7777-4777-8777-777777777703'$q$),
 ('upd follow_ups.done',                           $q$UPDATE follow_ups SET done = true WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01'$q$),
 ('upd follow_ups.created_by',                     $q$UPDATE follow_ups SET created_by = auth.uid() WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01'$q$),
 ('upd samples.status',                            $q$UPDATE samples SET status = 'approved' WHERE id = '77777777-7777-4777-8777-777777777702'$q$),
 ('upd quotations.total',                          $q$UPDATE quotations SET total = 1 WHERE id = '88888888-8888-4888-8888-888888888804'$q$),
 ('upd inquiries.status',                          $q$UPDATE inquiries SET status = 'won'$q$)
) t(label, q);
\echo '=== C4 sales: tick own system reminder via the definer, clear its date, then delete (A9 says only plain notes by author)'
SELECT fn_follow_up_done('cccccccc-cccc-4ccc-8ccc-cccccccccc03');
SELECT zz_probe($q$UPDATE follow_ups SET due_on = NULL WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc03'$q$) AS clear_date,
       zz_probe($q$WITH u AS (UPDATE follow_ups SET due_on = NULL WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc03' RETURNING 1) SELECT 1$q$) AS clear_date_cte;
UPDATE follow_ups SET due_on = NULL WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc03';
DELETE FROM follow_ups WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc03';
\echo '=== C5 residual: sales rewrites someone else''s reminder / note through the UPDATE grant (note, due_on)'
SELECT t.label, zz_probe(t.q) AS result FROM (VALUES
 ('push Balance $18,900 due to 2099',  $q$UPDATE follow_ups SET due_on = '2099-01-01' WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01'$q$),
 ('rewrite Balance note text',          $q$UPDATE follow_ups SET note = 'Paid in full, no need to call' WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01'$q$),
 ('rewrite owner plain note cc16',      $q$UPDATE follow_ups SET note = 'Owner says: OK to go below floor' WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc16'$q$),
 ('push owner buyer reminder cc05',     $q$UPDATE follow_ups SET due_on = '2099-01-01' WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc05'$q$)
) t(label, q);
UPDATE follow_ups SET due_on = '2099-01-01' WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222221', false);
SET ROLE authenticated;
SELECT 'owner Home after sales pushed the Balance reminder' AS effect, followups_today, money_overdue_count FROM v_home_kpis;
SELECT zz_probe($q$DELETE FROM follow_ups WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01'$q$) AS owner_deletes_system_reminder;
RESET ROLE;
\echo '=== C6 operations and accountant on the same rows'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222224', false);
SELECT 'ops' who, zz_probe($q$DELETE FROM follow_ups WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc07'$q$) del_owner_order_reminder,
       zz_probe($q$INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on, done, done_by) VALUES ('11111111-1111-4111-8111-111111111111','order','99999999-9999-4999-8999-999999999903','x',NULL,true,'22222222-2222-4222-8222-222222222221')$q$) ins_done_by_owner,
       zz_probe($q$UPDATE follow_ups SET due_on = '2099-01-01' WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc07'$q$) push_owner_order_reminder;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT 'accountant' who, zz_probe($q$DELETE FROM follow_ups WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01'$q$) del_own_system_reminder,
       zz_probe($q$DELETE FROM follow_ups WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc15'$q$) del_own_plain_note;
RESET ROLE;

-- ===================== D. SEC2-06: no existence oracle (foreign id vs random id) =====================
\echo '=== D1 sales: every FK path with an org-B id and with a random id (expect identical results, never 23503)'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222223', false);
WITH t(label, tmpl, foreign_id) AS (VALUES
 ('inq.buyer_id ins',  $q$INSERT INTO inquiries (org_id, buyer_name, buyer_id) VALUES ('11111111-1111-4111-8111-111111111111','x',%L)$q$, 'bbbbbbbb-0000-4000-8000-000000000b01'),
 ('inq.product_id ins',$q$INSERT INTO inquiries (org_id, buyer_name, product_id) VALUES ('11111111-1111-4111-8111-111111111111','x',%L)$q$, 'bbbbbbbb-0000-4000-8000-000000000c01'),
 ('inq.assigned_to ins',$q$INSERT INTO inquiries (org_id, buyer_name, assigned_to) VALUES ('11111111-1111-4111-8111-111111111111','x',%L)$q$, 'bbbbbbbb-0000-4000-8000-0000000000a1'),
 ('inq.buyer_id upd',  $q$UPDATE inquiries SET buyer_id = %L WHERE id = '66666666-6666-4666-8666-666666666601'$q$, 'bbbbbbbb-0000-4000-8000-000000000b01'),
 ('inq.product_id upd',$q$UPDATE inquiries SET product_id = %L WHERE id = '66666666-6666-4666-8666-666666666601'$q$, 'bbbbbbbb-0000-4000-8000-000000000c01'),
 ('inq.assigned_to upd',$q$UPDATE inquiries SET assigned_to = %L WHERE id = '66666666-6666-4666-8666-666666666601'$q$, 'bbbbbbbb-0000-4000-8000-0000000000a1'),
 ('fu.buyer_id ins',   $q$INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on) VALUES ('11111111-1111-4111-8111-111111111111','buyer','55555555-5555-4555-8555-555555555551',%L,'x',CURRENT_DATE)$q$, 'bbbbbbbb-0000-4000-8000-000000000b01'),
 ('fu.buyer_id upd',   $q$UPDATE follow_ups SET buyer_id = %L WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc05'$q$, 'bbbbbbbb-0000-4000-8000-000000000b01'),
 ('smp.buyer_id ins',  $q$INSERT INTO samples (org_id, buyer_id, product_id) VALUES ('11111111-1111-4111-8111-111111111111',%L,'33333333-3333-4333-8333-333333333331')$q$, 'bbbbbbbb-0000-4000-8000-000000000b01'),
 ('smp.product_id ins',$q$INSERT INTO samples (org_id, buyer_id, product_id) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551',%L)$q$, 'bbbbbbbb-0000-4000-8000-000000000c01'),
 ('smp.inquiry_id ins',$q$INSERT INTO samples (org_id, buyer_id, product_id, inquiry_id) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551','33333333-3333-4333-8333-333333333331',%L)$q$, 'bbbbbbbb-0000-4000-8000-000000000d01'),
 ('smp.buyer_id upd',  $q$UPDATE samples SET buyer_id = %L WHERE id = '77777777-7777-4777-8777-777777777703'$q$, 'bbbbbbbb-0000-4000-8000-000000000b01'),
 ('smp.product_id upd',$q$UPDATE samples SET product_id = %L WHERE id = '77777777-7777-4777-8777-777777777703'$q$, 'bbbbbbbb-0000-4000-8000-000000000c01'),
 ('smp.inquiry_id upd',$q$UPDATE samples SET inquiry_id = %L WHERE id = '77777777-7777-4777-8777-777777777703'$q$, 'bbbbbbbb-0000-4000-8000-000000000d01'),
 ('fn_sample_create buyer',  $q$SELECT fn_sample_create(%L,'33333333-3333-4333-8333-333333333331',NULL,500,NULL,NULL,NULL,NULL,true)$q$, 'bbbbbbbb-0000-4000-8000-000000000b01'),
 ('fn_sample_create product',$q$SELECT fn_sample_create('55555555-5555-4555-8555-555555555551',%L,NULL,500,NULL,NULL,NULL,NULL,false)$q$, 'bbbbbbbb-0000-4000-8000-000000000c01'),
 ('fn_sample_create inquiry',$q$SELECT fn_sample_create('55555555-5555-4555-8555-555555555551','33333333-3333-4333-8333-333333333331',%L,500,NULL,NULL,NULL,NULL,true)$q$, 'bbbbbbbb-0000-4000-8000-000000000d01'),
 ('qtn.buyer_id ins',  $q$INSERT INTO quotations (org_id, buyer_id) VALUES ('11111111-1111-4111-8111-111111111111',%L)$q$, 'bbbbbbbb-0000-4000-8000-000000000b01'),
 ('qtn.inquiry_id ins',$q$INSERT INTO quotations (org_id, buyer_id, inquiry_id) VALUES ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555551',%L)$q$, 'bbbbbbbb-0000-4000-8000-000000000d01'),
 ('qtn.buyer_id upd',  $q$UPDATE quotations SET buyer_id = %L WHERE id = '88888888-8888-4888-8888-888888888804'$q$, 'bbbbbbbb-0000-4000-8000-000000000b01'),
 ('qtn.inquiry_id upd',$q$UPDATE quotations SET inquiry_id = %L WHERE id = '88888888-8888-4888-8888-888888888804'$q$, 'bbbbbbbb-0000-4000-8000-000000000d01'),
 ('qi.quotation_id ins (draft B)',$q$INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ('11111111-1111-4111-8111-111111111111',%L,'33333333-3333-4333-8333-333333333331',100,'kg',500)$q$, 'bbbbbbbb-0000-4000-8000-000000000e02'),
 ('qi.quotation_id ins as B org_id',$q$INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ('bbbbbbbb-0000-4000-8000-00000000000b',%L,'33333333-3333-4333-8333-333333333331',100,'kg',500)$q$, 'bbbbbbbb-0000-4000-8000-000000000e02'),
 ('qi.product_id ins', $q$INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ('11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888804',%L,100,'kg',500)$q$, 'bbbbbbbb-0000-4000-8000-000000000c01'),
 ('qi.packaging ins',  $q$INSERT INTO quotation_items (org_id, quotation_id, product_id, packaging_type_id, qty_kg, unit, rate) VALUES ('11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888804','33333333-3333-4333-8333-333333333331',%L,100,'kg',500)$q$, 'bbbbbbbb-0000-4000-8000-000000000c11'),
 ('qi.quotation_id upd',$q$UPDATE quotation_items SET quotation_id = %L WHERE quotation_id = '88888888-8888-4888-8888-888888888804'$q$, 'bbbbbbbb-0000-4000-8000-000000000e02'),
 ('qi.product_id upd', $q$UPDATE quotation_items SET product_id = %L WHERE quotation_id = '88888888-8888-4888-8888-888888888804'$q$, 'bbbbbbbb-0000-4000-8000-000000000c01'),
 ('qi.packaging upd',  $q$UPDATE quotation_items SET packaging_type_id = %L WHERE quotation_id = '88888888-8888-4888-8888-888888888804'$q$, 'bbbbbbbb-0000-4000-8000-000000000c11'),
 ('bc.buyer_id ins',   $q$INSERT INTO buyer_contacts (org_id, buyer_id, name, phone) VALUES ('11111111-1111-4111-8111-111111111111',%L,'x','+911234567890')$q$, 'bbbbbbbb-0000-4000-8000-000000000b01'),
 ('fn_quote_update_draft buyer',$q$SELECT fn_quote_update_draft('88888888-8888-4888-8888-888888888804',%L,NULL,'INR',NULL,'EXW',CURRENT_DATE+7,'100%% advance',NULL,'[{"product_id":"33333333-3333-4333-8333-333333333334","qty_kg":1000,"unit":"kg","rate":140}]'::jsonb)$q$, 'bbbbbbbb-0000-4000-8000-000000000b01'),
 ('fn_inquiry_set_status',  $q$SELECT fn_inquiry_set_status(%L,'lost','price')$q$, 'bbbbbbbb-0000-4000-8000-000000000d01'),
 ('fn_follow_up_done',      $q$SELECT fn_follow_up_done(%L)$q$, 'bbbbbbbb-0000-4000-8000-000000000f31'),
 ('fn_sample_set_status',   $q$SELECT fn_sample_set_status(%L,'sent')$q$, 'bbbbbbbb-0000-4000-8000-000000000f41'),
 ('fn_quote_send',          $q$SELECT fn_quote_send(%L)$q$, 'bbbbbbbb-0000-4000-8000-000000000e02'),
 ('fn_quote_reject',        $q$SELECT fn_quote_reject(%L,'price')$q$, 'bbbbbbbb-0000-4000-8000-000000000e01'),
 ('fn_quote_accept',        $q$SELECT fn_quote_accept(%L,NULL,30)$q$, 'bbbbbbbb-0000-4000-8000-000000000e01'),
 ('fn_order_set_status',    $q$SELECT fn_order_set_status(%L,'cancelled')$q$, 'bbbbbbbb-0000-4000-8000-000000000f01'),
 ('fn_order_set_packed',    $q$SELECT fn_order_set_packed(%L,3)$q$, 'bbbbbbbb-0000-4000-8000-000000000f01'),
 ('fn_order_dispatch',      $q$SELECT fn_order_dispatch(%L,'truck','GJ01AB1234',NULL,NULL,4,100,NULL,NULL,NULL,NULL,NULL)$q$, 'bbbbbbbb-0000-4000-8000-000000000f01'),
 ('fn_dispatch_tick',       $q$SELECT fn_dispatch_tick(%L,'coa',true)$q$, 'bbbbbbbb-0000-4000-8000-000000000f11'),
 ('fn_dispatch_delivered',  $q$SELECT fn_dispatch_delivered(%L)$q$, 'bbbbbbbb-0000-4000-8000-000000000f11'),
 ('fn_order_advance_waiting',$q$SELECT fn_order_advance_waiting(%L)$q$, 'bbbbbbbb-0000-4000-8000-000000000f01')
), r AS (
  SELECT label, foreign_id,
         zz_probe(format(tmpl, foreign_id)) AS foreign_res,
         zz_probe(format(tmpl, 'deadbeef-0000-4000-8000-00000000dead')) AS random_res
  FROM t)
SELECT label, replace(foreign_res, foreign_id, '<id>') AS foreign_result,
       replace(foreign_res, foreign_id, '<id>') = replace(random_res, 'deadbeef-0000-4000-8000-00000000dead', '<id>') AS same_as_random
FROM r;
RESET ROLE;
\echo '=== D2 owner / accountant: payment and staff functions with an org-B id vs a random id'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222221', false);
WITH t(label, tmpl, foreign_id) AS (VALUES
 ('owner fn_payment_record', $q$SELECT fn_payment_record(%L, 1, CURRENT_DATE, 'cash')$q$, 'bbbbbbbb-0000-4000-8000-000000000f02'),
 ('owner fn_set_user_access', $q$SELECT fn_set_user_access(%L, 'sales', ARRAY['dashboard'])$q$, 'bbbbbbbb-0000-4000-8000-0000000000a1'),
 ('owner fn_set_user_active', $q$SELECT fn_set_user_active(%L, false)$q$, 'bbbbbbbb-0000-4000-8000-0000000000a1'),
 ('owner SELECT payments by id', $q$SELECT 1 FROM payments WHERE id = %L$q$, 'bbbbbbbb-0000-4000-8000-000000000f21')
), r AS (SELECT label, foreign_id, zz_probe(format(tmpl, foreign_id)) f, zz_probe(format(tmpl, 'deadbeef-0000-4000-8000-00000000dead')) x FROM t)
SELECT label, replace(f, foreign_id, '<id>') foreign_result, replace(f, foreign_id, '<id>') = replace(x, 'deadbeef-0000-4000-8000-00000000dead', '<id>') same_as_random FROM r;
RESET ROLE;

-- ===================== E. SEC2-07: NULL-safe owner checks =====================
\echo '=== E1 switched-off sales (fn_user_role NULL) adds an item at 1/kg and sends a quote'
UPDATE profiles SET is_active = false WHERE id = '22222222-2222-4222-8222-222222222223';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222223', false);
SELECT fn_user_role() AS role_reads, fn_current_org() AS org_reads,
       zz_probe($q$INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ('11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888804','33333333-3333-4333-8333-333333333334',100,'kg',1)$q$) AS item_at_1,
       zz_probe($q$SELECT fn_quote_send('88888888-8888-4888-8888-888888888804')$q$) AS send,
       zz_probe($q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 1, CURRENT_DATE, 'cash')$q$) AS payment;
RESET ROLE;
UPDATE profiles SET is_active = true WHERE id = '22222222-2222-4222-8222-222222222223';
\echo '=== E2 active sales: item at 1/kg and EUR item (expect below_floor_price)'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222223', false);
SELECT zz_probe($q$INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ('11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888804','33333333-3333-4333-8333-333333333334',100,'kg',1)$q$) AS item_at_1,
       zz_probe($q$UPDATE quotations SET currency = 'EUR' WHERE id = '88888888-8888-4888-8888-888888888804'$q$) AS switch_to_eur;
RESET ROLE;

-- ===================== F. A8 / SEC2-08: payment date and amount caps =====================
\echo '=== F1 fn_payment_record: future date, over-payment, controls (ORD-0003 INR due 511875, ORD-0002 USD due 18900, ORD-0001 paid)'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT t.label, zz_probe(t.q) AS result FROM (VALUES
 ('acct tomorrow',                 $q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 1000, CURRENT_DATE + 1, 'bank')$q$),
 ('acct +365 days',                $q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 1000, CURRENT_DATE + 365, 'bank')$q$),
 ('acct 563062.51 INR (>110%)',    $q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 563062.51, CURRENT_DATE, 'bank')$q$),
 ('acct 563062.50 INR (=110%)',    $q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 563062.50, CURRENT_DATE, 'bank')$q$),
 ('acct 1e12 INR',                 $q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 1000000000000, CURRENT_DATE, 'bank')$q$),
 ('acct 20790.01 USD (>110%)',     $q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999902', 20790.01, CURRENT_DATE, 'bank', NULL, 1700000)$q$),
 ('acct 20790.00 USD (=110%)',     $q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999902', 20790.00, CURRENT_DATE, 'bank', NULL, 1700000)$q$),
 ('acct 1 on paid ORD-0001',       $q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999901', 1, CURRENT_DATE, 'cash')$q$),
 ('acct date NULL (-> today)',     $q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 1000, NULL, 'cash')$q$),
 ('acct date 1900-01-01',          $q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 1000, DATE '1900-01-01', 'cash')$q$)
) t(label, q);
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222221', false);
SELECT t.label, zz_probe(t.q) AS result FROM (VALUES
 ('owner tomorrow',                $q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 1000, CURRENT_DATE + 1, 'bank')$q$),
 ('owner 2,000,000 INR (override)',$q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 2000000, CURRENT_DATE, 'bank')$q$)
) t(label, q);
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222223', false);
SELECT 'sales' who, zz_probe($q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 1000, CURRENT_DATE, 'bank')$q$) AS result;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222224', false);
SELECT 'ops' who, zz_probe($q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 1000, CURRENT_DATE, 'bank')$q$) AS result;
SELECT 'ops direct' who, zz_probe($q$INSERT INTO payments (org_id, receipt_no, order_id, buyer_id, amount, currency, mode) VALUES ('11111111-1111-4111-8111-111111111111','REC-X','99999999-9999-4999-8999-999999999903','55555555-5555-4555-8555-555555555553',1,'INR','cash')$q$) AS result;
RESET ROLE;

-- ===================== G. A6 / SEC2-10: Plant reads no money =====================
\echo '=== G1 money reads per role'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222224', false);
SELECT 'operations' who, (SELECT count(*) FROM payments) payments, (SELECT count(*) FROM payments WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01') receipt_by_id,
       (SELECT count(*) FROM v_order_balances) balances, (SELECT count(*) FROM v_money_due) money_due,
       k.money_due_inr, k.money_due_usd, k.money_due_about_inr, k.money_overdue_count, k.orders_in_production, k.followups_today,
       (SELECT count(*) FROM audit_log) audit_rows,
       fn_order_advance_waiting('99999999-9999-4999-8999-999999999903') adv_wait_ord3
FROM v_home_kpis k;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222223', false);
SELECT 'sales' who, (SELECT count(*) FROM payments) payments, (SELECT count(*) FROM v_order_balances) balances, (SELECT count(*) FROM v_money_due) money_due, k.money_due_inr, k.money_due_usd FROM v_home_kpis k;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT 'accountant' who, (SELECT count(*) FROM payments) payments, (SELECT count(*) FROM v_order_balances) balances, (SELECT count(*) FROM v_money_due) money_due, k.money_due_inr, k.money_due_usd FROM v_home_kpis k;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222221', false);
SELECT 'owner' who, (SELECT count(*) FROM payments) payments, (SELECT count(*) FROM v_order_balances) balances, (SELECT count(*) FROM v_money_due) money_due, k.money_due_inr, k.money_due_usd, k.money_overdue_count, k.followups_today FROM v_home_kpis k;
\echo '=== G2 residual money visible to operations through other tables (by contract: orders / quotes are org-wide reads)'
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222224', false);
SELECT (SELECT string_agg(order_code || ' total ' || total || ' adv ' || advance_expected, '; ' ORDER BY order_code) FROM orders) orders_money,
       (SELECT count(*) FROM quotations) quotes_visible, (SELECT count(*) FROM quotation_items WHERE floor_price_at_time IS NOT NULL) items_with_floor,
       (SELECT string_agg(note, '; ') FROM follow_ups WHERE note ~ '(\$|₹|Rs|Balance|Advance)') money_notes;
RESET ROLE;

-- ===================== H. review-1 replay (walls, GUCs, staff functions) =====================
\echo '=== H1 sales and operations: walls from review-1'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222223', false);
SELECT 'sales' who, zz_probe($q$UPDATE profiles SET role = 'owner' WHERE id = auth.uid()$q$) self_promote,
       (SELECT count(*) FROM v_product_costs) costs, zz_probe('TRUNCATE audit_log') truncate_audit,
       zz_probe($q$UPDATE price_list_items SET floor_price = 1$q$) floor_1, zz_probe($q$UPDATE business_settings SET bank_details = '[]'::jsonb$q$) bank,
       zz_probe($q$SELECT fn_next_code('INQ')$q$) next_code, zz_probe($q$SELECT fn_next_doc_no('PI')$q$) next_doc,
       (SELECT count(*) FROM audit_log) audit_rows,
       zz_probe($q$INSERT INTO buyers (org_id, buyer_code, company_name, buyer_type) VALUES ('bbbbbbbb-0000-4000-8000-00000000000b','BUY-9999','evil','domestic_masala')$q$) buyer_in_B,
       zz_probe($q$UPDATE orders SET step_dates = '{}'::jsonb$q$) step_dates;
SELECT set_config('app.current_org', 'bbbbbbbb-0000-4000-8000-00000000000b', false);
SELECT 'sales GUC override' who, fn_current_org() current_org, (SELECT count(*) FROM orders WHERE org_id = 'bbbbbbbb-0000-4000-8000-00000000000b') b_orders;
SELECT set_config('app.current_org', '', false);
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222224', false);
SELECT set_config('app.override_module_check', 'true', false);
SELECT 'ops module override' who, zz_probe($q$SELECT fn_require_module('payments')$q$) require_payments,
       zz_probe($q$SELECT fn_quote_accept('88888888-8888-4888-8888-888888888803', NULL, 30)$q$) quote_accept,
       (SELECT count(*) FROM v_product_costs) costs, zz_probe($q$UPDATE price_list_items SET floor_price = 1$q$) floor_1,
       zz_probe($q$UPDATE buyers SET credit_period_days = 365$q$) buyers_upd;
SELECT set_config('app.override_module_check', '', false);
RESET ROLE;
\echo '=== H2 owner and accountant: staff functions (review-1 D, SEC1-08) and costs'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222221', false);
SELECT 'owner' who, (SELECT count(*) FROM v_product_costs) costs, (SELECT count(*) FROM audit_log) audit_rows,
       zz_probe($q$SELECT fn_set_user_access('22222222-2222-4222-8222-222222222221','owner',ARRAY['dashboard'])$q$) self_change,
       zz_probe($q$SELECT fn_set_user_access('22222222-2222-4222-8222-222222222224','superuser',ARRAY['dashboard'])$q$) bad_role,
       zz_probe($q$SELECT fn_set_user_access('22222222-2222-4222-8222-222222222224','operations',ARRAY['dashboard','buyers','samples','orders','catalog','documents','leads','quotes','payments','reports','users','settings','audit','dashboard'])$q$) fourteen_modules,
       zz_probe($q$SELECT fn_set_user_access('22222222-2222-4222-8222-222222222224','operations',ARRAY['dashboard','root'])$q$) unknown_module;
SELECT fn_set_user_access('22222222-2222-4222-8222-222222222224','operations',ARRAY['dashboard','orders','dashboard','orders','samples']);
RESET ROLE;
SELECT 'ops modules after duplicate grant' AS check, modules FROM profiles WHERE id = '22222222-2222-4222-8222-222222222224';
UPDATE profiles SET modules = modules || '{users}' WHERE id = '22222222-2222-4222-8222-222222222222';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT 'accountant+users' who, (SELECT count(*) FROM v_product_costs) costs,
       zz_probe($q$SELECT fn_set_user_access('22222222-2222-4222-8222-222222222224','owner',ARRAY['dashboard'])$q$) make_owner,
       zz_probe($q$SELECT fn_set_user_active('22222222-2222-4222-8222-222222222221', false)$q$) switch_off_owner;
RESET ROLE;
\echo '=== H3 SEC1-01: switched-off user sees only its own profile'
UPDATE profiles SET is_active = false WHERE id = '22222222-2222-4222-8222-222222222224';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222224', false);
SELECT (SELECT count(*) FROM profiles) profiles_visible, (SELECT is_active FROM profiles WHERE id = auth.uid()) own_active,
       (SELECT count(*) FROM buyers) buyers, (SELECT count(*) FROM orders) orders, zz_probe($q$SELECT fn_order_set_packed('99999999-9999-4999-8999-999999999903', 1)$q$) packed;
RESET ROLE;
\echo '=== H4 org-B owner against MDPL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-0000000000a1', false);
SELECT (SELECT count(*) FROM orders WHERE org_id = '11111111-1111-4111-8111-111111111111') mdpl_orders,
       (SELECT count(*) FROM payments WHERE org_id = '11111111-1111-4111-8111-111111111111') mdpl_payments,
       (SELECT count(*) FROM audit_log WHERE org_id = '11111111-1111-4111-8111-111111111111') mdpl_audit,
       (SELECT count(*) FROM profiles WHERE org_id = '11111111-1111-4111-8111-111111111111') mdpl_profiles,
       zz_probe($q$SELECT fn_payment_record('99999999-9999-4999-8999-999999999903', 1, CURRENT_DATE, 'cash')$q$) pay_mdpl,
       zz_probe($q$SELECT fn_order_advance_waiting('99999999-9999-4999-8999-999999999903')$q$) adv_mdpl,
       zz_probe($q$SELECT fn_sample_create('55555555-5555-4555-8555-555555555551','33333333-3333-4333-8333-333333333331',NULL,500,NULL,NULL,NULL,NULL,true)$q$) sample_mdpl_buyer,
       zz_probe($q$SELECT fn_set_user_active('22222222-2222-4222-8222-222222222223', false)$q$) switch_off_mdpl_sales,
       zz_probe($q$SELECT fn_quote_update_draft('88888888-8888-4888-8888-888888888804','55555555-5555-4555-8555-555555555551',NULL,'INR',NULL,'EXW',CURRENT_DATE+7,'x',NULL,'[]'::jsonb)$q$) edit_mdpl_draft;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false);
ROLLBACK;
`;

const r = spawnSync('psql', ['-X', url], { input: SQL, stdio: ['pipe', 'inherit', 'inherit'] });
process.exit(r.status ?? 1);
