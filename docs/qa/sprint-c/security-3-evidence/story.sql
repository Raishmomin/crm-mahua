-- Seed story fingerprint (run as postgres). Expect owner v_home_kpis 2 | 1 | 1 | 511875.00 | 18900.00 | ... | 1 late | 5 to do
SELECT (SELECT count(*) FROM inquiries) inq, (SELECT count(*) FROM follow_ups) fu, (SELECT count(*) FROM samples) smp,
       (SELECT count(*) FROM quotations) qtn, (SELECT count(*) FROM quotation_items) qi, (SELECT count(*) FROM orders) ord,
       (SELECT count(*) FROM order_items) oi, (SELECT count(*) FROM dispatches) dsp, (SELECT count(*) FROM payments) pay,
       (SELECT count(*) FROM buyers) buy, (SELECT count(*) FROM organizations) org, (SELECT count(*) FROM profiles) prof;
SELECT (SELECT string_agg(prefix || '=' || current_val, ' ' ORDER BY prefix) FROM entity_code_counters) codes, (SELECT string_agg(doc_type || '=' || current_val, ' ' ORDER BY doc_type) FROM doc_counters) docs, (SELECT count(*) FROM audit_log) audit_rows;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222221', false);
SELECT * FROM v_home_kpis;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','', false);
