-- QA gate 3 WORKAROUND (finding G3-01), not a migration: remove the rows a demo or rehearsal made for
-- the demo organisation MDPL and put the number counters back, so that `npm run db:seed` then gives
-- the day-one story again (Home 2 / 1 / 1 / Rs 5,11,875 + $18,900 / 1 late / 5 to do, next INQ-0011).
-- Run as the database owner (Supabase dashboard > SQL Editor, or node). Only touches org 1111...1111.
-- Seeded rows have fixed ids with the prefixes below; every other row of MDPL was made live.
BEGIN;
DELETE FROM payments        WHERE org_id = '11111111-1111-4111-8111-111111111111' AND id::text NOT LIKE 'bbbbbbbb-bbbb-4bbb-8bbb-%';
DELETE FROM dispatches      WHERE org_id = '11111111-1111-4111-8111-111111111111' AND id::text NOT LIKE 'aaaaaaaa-aaaa-4aaa-8aaa-%';
DELETE FROM order_items     WHERE org_id = '11111111-1111-4111-8111-111111111111' AND id::text NOT LIKE '9a9a9a9a-9a9a-49a9-89a9-%';
DELETE FROM orders          WHERE org_id = '11111111-1111-4111-8111-111111111111' AND id::text NOT LIKE '99999999-9999-4999-8999-%';
DELETE FROM quotation_items WHERE org_id = '11111111-1111-4111-8111-111111111111' AND id::text NOT LIKE '89898989-8989-4989-8989-%';
DELETE FROM quotations      WHERE org_id = '11111111-1111-4111-8111-111111111111' AND id::text NOT LIKE '88888888-8888-4888-8888-%';
DELETE FROM samples         WHERE org_id = '11111111-1111-4111-8111-111111111111' AND id::text NOT LIKE '77777777-7777-4777-8777-%';
DELETE FROM follow_ups      WHERE org_id = '11111111-1111-4111-8111-111111111111' AND id::text NOT LIKE 'cccccccc-cccc-4ccc-8ccc-%';
DELETE FROM inquiries       WHERE org_id = '11111111-1111-4111-8111-111111111111' AND id::text NOT LIKE '66666666-6666-4666-8666-%';
DELETE FROM buyer_contacts  WHERE org_id = '11111111-1111-4111-8111-111111111111' AND buyer_id::text NOT LIKE '55555555-5555-4555-8555-%';
DELETE FROM buyers          WHERE org_id = '11111111-1111-4111-8111-111111111111' AND id::text NOT LIKE '55555555-5555-4555-8555-%';
UPDATE entity_code_counters SET current_val = CASE prefix WHEN 'BUY' THEN 4 WHEN 'INQ' THEN 10 WHEN 'SMP' THEN 3 WHEN 'ORD' THEN 3 ELSE current_val END
 WHERE org_id = '11111111-1111-4111-8111-111111111111';
UPDATE doc_counters SET current_val = CASE doc_type WHEN 'QTN' THEN 4 WHEN 'PI' THEN 3 WHEN 'INV' THEN 2 WHEN 'SDN' THEN 2 WHEN 'REC' THEN 4 ELSE current_val END
 WHERE org_id = '11111111-1111-4111-8111-111111111111';
COMMIT;
