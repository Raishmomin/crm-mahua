-- Seed 00: put the demo company MDPL back to day one (Dev-1, Sprint C fix round, G3-01).
-- Runs first of the seed files (scripts/seed.ts: migrations, then supabase/seed/*.sql in name order).
--
-- Seeds 01-04 upsert their rows by fixed id, so they reset what the demo CHANGED, but they cannot
-- remove what the demo ADDED (INQ-0011, SMP-0004, QTN-2627-0005, ORD-0004, receipts, reminders ...)
-- and the number counters only go up. This file removes every MDPL row whose id is not a seed id
-- and drops the MDPL counters; seeds 01-04 then insert the counters at the sample-data.md values,
-- so the next codes are INQ-0011 / SMP-0004 / QTN-2627-0005 / ORD-0004 / REC-2627-0005 again.
--
-- Only organisation 11111111-1111-4111-8111-111111111111 (MDPL) is touched. Users, settings,
-- products, prices and the audit trail are left alone (seed 01 upserts them).
-- On an empty database every statement is a no-op. Runs as the database owner (bypasses RLS).
-- Order: children before parents (payments / dispatches RESTRICT the order delete).

DO $$
DECLARE
  v_org uuid := '11111111-1111-4111-8111-111111111111';
BEGIN
  DELETE FROM payments        WHERE org_id = v_org AND id::text NOT LIKE 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb%';
  DELETE FROM dispatches      WHERE org_id = v_org AND id::text NOT LIKE 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa%';
  DELETE FROM order_items     WHERE org_id = v_org AND id::text NOT LIKE '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a%';
  DELETE FROM orders          WHERE org_id = v_org AND id::text NOT LIKE '99999999-9999-4999-8999-9999999999%';
  DELETE FROM quotation_items WHERE org_id = v_org AND id::text NOT LIKE '89898989-8989-4989-8989-8989898989%';
  DELETE FROM quotations      WHERE org_id = v_org AND id::text NOT LIKE '88888888-8888-4888-8888-8888888888%';
  DELETE FROM samples         WHERE org_id = v_org AND id::text NOT LIKE '77777777-7777-4777-8777-7777777777%';
  DELETE FROM follow_ups      WHERE org_id = v_org AND id::text NOT LIKE 'cccccccc-cccc-4ccc-8ccc-cccccccccc%';
  DELETE FROM inquiries       WHERE org_id = v_org AND id::text NOT LIKE '66666666-6666-4666-8666-6666666666%';
  DELETE FROM buyer_contacts  WHERE org_id = v_org AND id::text NOT LIKE '88888888-8888-4888-8888-8888888888%';
  DELETE FROM buyers          WHERE org_id = v_org AND id::text NOT LIKE '55555555-5555-4555-8555-5555555555%';

  -- Counters: seeds 01-04 insert them again at the sample-data.md section 9 values
  -- (BUY 4, INQ 10, SMP 3, ORD 3; QTN 4, PI 3, INV 2, SDN 2, REC 4 in FY 2627).
  DELETE FROM entity_code_counters WHERE org_id = v_org;
  DELETE FROM doc_counters         WHERE org_id = v_org;
END $$;
