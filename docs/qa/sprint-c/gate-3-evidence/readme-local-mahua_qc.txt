# README 'Local database only (tests)' replayed literally on scratch DB mahua_qc (DATABASE_URL exported; 'docker compose up -d' skipped as README allows: onion-crm-postgres already holds 5432) - rerun 2026-11-16 17:24:24
created mahua_qc
mahua_qc* databases remaining: 1
== run 1: npm run db:seed:sql
Database: postgresql://postgres:****@127.0.0.1:5432/mahua_qc
Applying 8 migration(s)...
ok   supabase/migrations/0000_auth_shim.sql (42 ms)
ok   supabase/migrations/0001_core_system.sql (88 ms)
ok   supabase/migrations/0002_catalog_and_buyers.sql (100 ms)
ok   supabase/migrations/0003_security_fixes.sql (62 ms)
ok   supabase/migrations/0004_inquiries_followups.sql (82 ms)
ok   supabase/migrations/0005_samples_quotes.sql (109 ms)
ok   supabase/migrations/0006_orders_dispatch_payments.sql (169 ms)
ok   supabase/migrations/0007_hardening.sql (54 ms)
Applying 4 seed file(s)...
ok   supabase/seed/01_core.sql (369 ms)
ok   supabase/seed/02_inquiries.sql (45 ms)
ok   supabase/seed/03_samples_quotes.sql (57 ms)
ok   supabase/seed/04_orders_money.sql (37 ms)
Seed completed.
EXIT=0
mahua_qc counts {"buyers":4,"inquiries":10,"samples":3,"quotations":4,"quotation_items":4,"orders":3,"order_items":3,"dispatches":2,"payments":4,"follow_ups":14,"follow_ups_pending":8,"follow_ups_notes":6,"audit_cost_rows":0,"audit_bank_snapshots":0}
mahua_qc entity_code_counters BUY=4 INQ=10 ORD=3 SMP=3
mahua_qc doc_counters INV/2627=2 PI/2627=3 QTN/2627=4 REC/2627=4 SDN/2627=2
mahua_qc step_dates (days ago) ORD-0001 delivered {"confirmed":46,"delivered":38,"dispatched":40,"in_production":45,"ready":41}
mahua_qc step_dates (days ago) ORD-0002 dispatched {"confirmed":27,"dispatched":6,"in_production":22,"ready":9}
mahua_qc step_dates (days ago) ORD-0003 in_production {"confirmed":10,"in_production":2}
mahua_qc next codes (rolled back) {"inq":"INQ-0011","smp":"SMP-0004","ord":"ORD-0004","buy":"BUY-0005","qtn":"QTN-2627-0005","pi":"PI-2627-0004","inv":"INV-2627-0003","sdn":"SDN-2627-0003","rec":"REC-2627-0005"}
mahua_qc owner v_home_kpis {"new_inquiries":2,"quotes_waiting":1,"orders_in_production":1,"money_due_inr":"511875.00","money_due_usd":"18900.00","money_due_about_inr":"2104200.00","money_overdue_count":1,"followups_today":5,"papers_pending":1}
mahua_qc SEED STORY OK (2 / 1 / 1 / 511875 + 18900 / 1 late / 5 to do)
mahua_qc ops v_home_kpis {"new_inquiries":2,"quotes_waiting":1,"orders_in_production":1,"money_due_inr":"0.00","money_due_usd":"0.00","money_due_about_inr":"0.00","money_overdue_count":0,"followups_today":5,"papers_pending":1}
== run 2: npm run db:seed:sql
Database: postgresql://postgres:****@127.0.0.1:5432/mahua_qc
Applying 8 migration(s)...
ok   supabase/migrations/0000_auth_shim.sql (11 ms)
ok   supabase/migrations/0001_core_system.sql (44 ms)
ok   supabase/migrations/0002_catalog_and_buyers.sql (27 ms)
ok   supabase/migrations/0003_security_fixes.sql (92 ms)
ok   supabase/migrations/0004_inquiries_followups.sql (53 ms)
ok   supabase/migrations/0005_samples_quotes.sql (61 ms)
ok   supabase/migrations/0006_orders_dispatch_payments.sql (69 ms)
ok   supabase/migrations/0007_hardening.sql (36 ms)
Applying 4 seed file(s)...
ok   supabase/seed/01_core.sql (334 ms)
ok   supabase/seed/02_inquiries.sql (18 ms)
ok   supabase/seed/03_samples_quotes.sql (38 ms)
ok   supabase/seed/04_orders_money.sql (26 ms)
Seed completed.
EXIT=0
mahua_qc counts {"buyers":4,"inquiries":10,"samples":3,"quotations":4,"quotation_items":4,"orders":3,"order_items":3,"dispatches":2,"payments":4,"follow_ups":14,"follow_ups_pending":8,"follow_ups_notes":6,"audit_cost_rows":0,"audit_bank_snapshots":0}
mahua_qc entity_code_counters BUY=4 INQ=10 ORD=3 SMP=3
mahua_qc doc_counters INV/2627=2 PI/2627=3 QTN/2627=4 REC/2627=4 SDN/2627=2
mahua_qc step_dates (days ago) ORD-0001 delivered {"confirmed":46,"delivered":38,"dispatched":40,"in_production":45,"ready":41}
mahua_qc step_dates (days ago) ORD-0002 dispatched {"confirmed":27,"dispatched":6,"in_production":22,"ready":9}
mahua_qc step_dates (days ago) ORD-0003 in_production {"confirmed":10,"in_production":2}
mahua_qc next codes (rolled back) {"inq":"INQ-0011","smp":"SMP-0004","ord":"ORD-0004","buy":"BUY-0005","qtn":"QTN-2627-0005","pi":"PI-2627-0004","inv":"INV-2627-0003","sdn":"SDN-2627-0003","rec":"REC-2627-0005"}
mahua_qc owner v_home_kpis {"new_inquiries":2,"quotes_waiting":1,"orders_in_production":1,"money_due_inr":"511875.00","money_due_usd":"18900.00","money_due_about_inr":"2104200.00","money_overdue_count":1,"followups_today":5,"papers_pending":1}
mahua_qc SEED STORY OK (2 / 1 / 1 / 511875 + 18900 / 1 late / 5 to do)
mahua_qc ops v_home_kpis {"new_inquiries":2,"quotes_waiting":1,"orders_in_production":1,"money_due_inr":"0.00","money_due_usd":"0.00","money_due_about_inr":"0.00","money_overdue_count":0,"followups_today":5,"papers_pending":1}
diff run1 run2: IDENTICAL
== npm test (DATABASE_URL=mahua_qc)
 ✓ tests/quotes.test.ts  (29 tests) 1978ms
 ✓ tests/orders-payments.test.ts  (28 tests) 1761ms
 ✓ tests/inquiries.test.ts  (26 tests) 1141ms
 ✓ tests/security-fixes.test.ts  (23 tests) 891ms
 ✓ tests/rls-tenant-isolation.test.ts  (5 tests) 618ms
 Test Files  5 passed (5)
      Tests  111 passed (111)
EXIT=0
== npm run ci:tenant-check (DATABASE_URL=mahua_qc)
CI tenant check against postgresql://postgres:****@127.0.0.1:5432/mahua_qc
✅ CI Tenant Check PASSED: every public table has org_id, an index, ENABLE + FORCE RLS and an org policy; every view is security_invoker; web roles hold no TRUNCATE / REFERENCES / TRIGGER; all SECURITY DEFINER functions are allowlisted and pin search_path; number generators and trigger functions are locked; PUBLIC / anon execute no function; every function a policy, view or app RPC needs is executable by authenticated; new functions are granted to nobody by default.
EXIT=0
== story after npm test
mahua_qc owner v_home_kpis {"new_inquiries":2,"quotes_waiting":1,"orders_in_production":1,"money_due_inr":"511875.00","money_due_usd":"18900.00","money_due_about_inr":"2104200.00","money_overdue_count":1,"followups_today":5,"papers_pending":1}
mahua_qc SEED STORY OK (2 / 1 / 1 / 511875 + 18900 / 1 late / 5 to do)
mahua_qc ops v_home_kpis {"new_inquiries":2,"quotes_waiting":1,"orders_in_production":1,"money_due_inr":"0.00","money_due_usd":"0.00","money_due_about_inr":"0.00","money_overdue_count":0,"followups_today":5,"papers_pending":1}
== schema fingerprint onion_crm vs mahua_qc
onion_crm {"funcs":{"h":"423eb6d34c0e57f6ae40a804ec5fc0e0","n":"70"},"policies":{"h":"c569db6b9fe8cb24c6740209b3890771","n":"61"},"triggers":{"h":"4db092a0956f2dd3a5b35330f821f5d7","n":"25"},"colgrants":{"h":"b6411ad0445310b590e150ee99299087","n":"725"},"columns":{"h":"7ed1d08922aec3680a120af3169ddcc6","n":"404"}}
onion_crm default ACLs: postgres/S/public={authenticated=rwU/postgres} ; postgres/f/-={postgres=X/postgres} ; postgres/r/public={authenticated=arwd/postgres}
mahua_qc {"funcs":{"h":"423eb6d34c0e57f6ae40a804ec5fc0e0","n":"70"},"policies":{"h":"c569db6b9fe8cb24c6740209b3890771","n":"61"},"triggers":{"h":"4db092a0956f2dd3a5b35330f821f5d7","n":"25"},"colgrants":{"h":"b6411ad0445310b590e150ee99299087","n":"725"},"columns":{"h":"7ed1d08922aec3680a120af3169ddcc6","n":"404"}}
mahua_qc default ACLs: postgres/S/public={authenticated=rwU/postgres} ; postgres/f/-={postgres=X/postgres} ; postgres/r/public={authenticated=arwd/postgres}
