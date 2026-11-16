-- Seed 02: Inquiries, follow-ups and notes for the demo story (Dev-1, Sprint B)
-- Rows: docs/design/sample-data.md sections 1 (10 inquiries) and 7 (8 pending follow-ups + 6 notes).
-- Structure: docs/design/contracts.md section 8 (fixed UUIDs, ON CONFLICT (id) DO UPDATE, dates as
-- CURRENT_DATE offsets, counters bumped). Runs as postgres after supabase/seed/01_core.sql.
-- Re-running resets the story (status, dates, done flags) so the demo can start again.
--
-- Fixed ids: inquiries 66666666-6666-4666-8666-6666666666NN, follow_ups cccccccc-cccc-4ccc-8ccc-ccccccccccNN.
-- Entity ids of later seeds (orders 9999...NN, quotations 8888...NN) are plain uuids here: follow_ups
-- has no FK on entity_id, so this file does not depend on 0005 / 0006.

DO $$
DECLARE
  v_org uuid := '11111111-1111-4111-8111-111111111111';
  v_owner uuid := '22222222-2222-4222-8222-222222222221';
  v_acct uuid := '22222222-2222-4222-8222-222222222222';
  v_sales uuid := '22222222-2222-4222-8222-222222222223';

  v_p_wflk uuid := '33333333-3333-4333-8333-333333333331';  -- W-FLK-A white flakes
  v_p_wmin uuid := '33333333-3333-4333-8333-333333333332';  -- W-MIN-A white minced
  v_p_wpow uuid := '33333333-3333-4333-8333-333333333333';  -- W-POW-P white powder
  v_p_rflk uuid := '33333333-3333-4333-8333-333333333334';  -- R-FLK-C red flakes
  v_p_rpow uuid := '33333333-3333-4333-8333-333333333335';  -- R-POW-S red powder
  v_p_pchp uuid := '33333333-3333-4333-8333-333333333336';  -- P-CHP-E pink chopped

  v_b_everest uuid := '55555555-5555-4555-8555-555555555551'; -- BUY-0001
  v_b_haldiram uuid := '55555555-5555-4555-8555-555555555552'; -- BUY-0002
  v_b_albarakah uuid := '55555555-5555-4555-8555-555555555553'; -- BUY-0003
  v_b_rhine uuid := '55555555-5555-4555-8555-555555555554'; -- BUY-0004

  v_inq01 uuid := '66666666-6666-4666-8666-666666666601';
  v_inq02 uuid := '66666666-6666-4666-8666-666666666602';
  v_inq03 uuid := '66666666-6666-4666-8666-666666666603';
  v_inq04 uuid := '66666666-6666-4666-8666-666666666604';
  v_inq05 uuid := '66666666-6666-4666-8666-666666666605';
  v_inq06 uuid := '66666666-6666-4666-8666-666666666606';
  v_inq07 uuid := '66666666-6666-4666-8666-666666666607';
  v_inq08 uuid := '66666666-6666-4666-8666-666666666608';
  v_inq09 uuid := '66666666-6666-4666-8666-666666666609';
  v_inq10 uuid := '66666666-6666-4666-8666-666666666610';

  -- later seeds (03 quotations, 04 orders) use these same ids
  v_qtn03 uuid := '88888888-8888-4888-8888-888888888803'; -- QTN-2627-0003
  v_ord02 uuid := '99999999-9999-4999-8999-999999999902'; -- ORD-0002
  v_ord03 uuid := '99999999-9999-4999-8999-999999999903'; -- ORD-0003

  t date := CURRENT_DATE;
BEGIN

  -- 1. Inquiries (sample-data.md section 1); product_text NULL everywhere (product_id always set)
  INSERT INTO inquiries (
    id, org_id, code, buyer_id, buyer_name, phone, product_id, product_text, qty_kg, needed_by,
    source, status, lost_reason, assigned_to, notes, closed_at, created_by, created_at, updated_at
  )
  VALUES
    (v_inq01, v_org, 'INQ-0001', v_b_everest, 'Everest Food Products Pvt Ltd', '+91 98200 45678', v_p_rpow, NULL, 3000, t - 42,
      'call', 'won', NULL, v_owner, 'Rajeshbhai called; red powder for masala blend, 3 MT',
      (t - 46)::timestamp + time '10:30', v_owner, (t - 50)::timestamp + time '10:30', (t - 46)::timestamp + time '10:30'),
    (v_inq02, v_org, 'INQ-0002', v_b_albarakah, 'Al-Barakah Spice & Grain LLC', '+971 4 223 9876', v_p_wflk, NULL, 12000, t - 20,
      'whatsapp', 'won', NULL, v_sales, 'Repeat buyer; wants 1 x 20 ft white flakes before December',
      (t - 27)::timestamp + time '10:30', v_sales, (t - 40)::timestamp + time '10:30', (t - 27)::timestamp + time '10:30'),
    (v_inq03, v_org, 'INQ-0003', v_b_haldiram, 'Haldiram Snacks Private Limited', '+91 98110 98765', v_p_rflk, NULL, 4000, t - 5,
      'call', 'lost', 'price', v_owner, 'Manish asked ₹125/kg; our floor is ₹125, quoted ₹140',
      (t - 18)::timestamp + time '10:30', v_owner, (t - 25)::timestamp + time '10:30', (t - 18)::timestamp + time '10:30'),
    (v_inq04, v_org, 'INQ-0004', v_b_haldiram, 'Haldiram Snacks Private Limited', '+91 98110 98765', v_p_wmin, NULL, 5000, t + 5,
      'email', 'won', NULL, v_owner, 'PO HSPL/26-27/1182 by email; 50% advance',
      (t - 10)::timestamp + time '10:30', v_owner, (t - 12)::timestamp + time '10:30', (t - 10)::timestamp + time '10:30'),
    (v_inq05, v_org, 'INQ-0005', v_b_rhine, 'Rhine Food Ingredients GmbH', '+49 40 3298 1234', v_p_wpow, NULL, 18000, t + 30,
      'email', 'quoted', NULL, v_sales, 'Hans wants 1 x 20 ft powder, LC at sight, CIF Hamburg',
      NULL, v_sales, (t - 10)::timestamp + time '10:30', (t - 9)::timestamp + time '10:30'),
    (v_inq06, v_org, 'INQ-0006', v_b_albarakah, 'Al-Barakah Spice & Grain LLC', '+971 4 223 9876', v_p_pchp, NULL, 12000, t + 33,
      'whatsapp', 'sample_sent', NULL, v_sales, 'Wants pink chopped for Ramadan packs',
      NULL, v_sales, (t - 9)::timestamp + time '10:30', (t - 7)::timestamp + time '10:30'),
    (v_inq07, v_org, 'INQ-0007', v_b_everest, 'Everest Food Products Pvt Ltd', '+91 98200 45679', v_p_wflk, NULL, 2000, t + 20,
      'visit', 'talking', NULL, v_sales, 'Sunita (QA) visited; needs flakes sample for a new soup mix',
      NULL, v_sales, (t - 3)::timestamp + time '10:30', (t - 3)::timestamp + time '10:30'),
    (v_inq08, v_org, 'INQ-0008', v_b_everest, 'Everest Food Products Pvt Ltd', '+91 98200 45678', v_p_rflk, NULL, 1500, t + 12,
      'whatsapp', 'talking', NULL, v_owner, 'Trial lot of red flakes; draft quote made',
      NULL, v_owner, (t - 2)::timestamp + time '10:30', (t - 2)::timestamp + time '10:30'),
    (v_inq09, v_org, 'INQ-0009', NULL, 'Shree Ambica Masala, Rajkot', '+91 98980 11223', v_p_rpow, NULL, 500, t + 10,
      'call', 'new', NULL, v_owner, 'Small masala maker; wants 20 bags red powder',
      NULL, v_owner, (t - 1)::timestamp + time '10:30', (t - 1)::timestamp + time '10:30'),
    (v_inq10, v_org, 'INQ-0010', NULL, 'Gulf Star Foodstuff Trading, Sharjah', '+971 55 234 8899', v_p_wflk, NULL, 6000, t + 45,
      'indiamart', 'new', NULL, v_sales, 'IndiaMART lead: 6 MT white flakes, asked FOB rate',
      NULL, v_sales, t::timestamp + time '09:40', t::timestamp + time '09:40')
  ON CONFLICT (id) DO UPDATE SET
    org_id = EXCLUDED.org_id,
    code = EXCLUDED.code,
    buyer_id = EXCLUDED.buyer_id,
    buyer_name = EXCLUDED.buyer_name,
    phone = EXCLUDED.phone,
    product_id = EXCLUDED.product_id,
    product_text = EXCLUDED.product_text,
    qty_kg = EXCLUDED.qty_kg,
    needed_by = EXCLUDED.needed_by,
    source = EXCLUDED.source,
    status = EXCLUDED.status,
    lost_reason = EXCLUDED.lost_reason,
    assigned_to = EXCLUDED.assigned_to,
    notes = EXCLUDED.notes,
    closed_at = EXCLUDED.closed_at,
    created_by = EXCLUDED.created_by,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

  -- Inquiry code counter (sample-data.md section 9: INQ = 10; live demo makes INQ-0011)
  INSERT INTO entity_code_counters (org_id, prefix, current_val)
  VALUES (v_org, 'INQ', 10)
  ON CONFLICT (org_id, prefix) DO UPDATE
    SET current_val = GREATEST(entity_code_counters.current_val, EXCLUDED.current_val), updated_at = now();

  -- 2. Pending follow-ups (section 7): 2 overdue, 3 due today, 3 later. buyer_id set on every row.
  INSERT INTO follow_ups (
    id, org_id, entity_type, entity_id, buyer_id, note, due_on, done, done_at, done_by, created_by, created_at, updated_at
  )
  VALUES
    -- G3-03 / A6: money reminder = entity_type 'payment' (entity_id = the order), hidden from Plant
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc01', v_org, 'payment', v_ord02, v_b_albarakah,
      'Balance $18,900 due', t - 6, false, NULL, NULL, v_acct, (t - 6)::timestamp + time '10:30', (t - 6)::timestamp + time '10:30'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc02', v_org, 'inquiry', v_inq07, v_b_everest,
      'Send flakes sample (250 g) for soup mix - Sunita', t - 2, false, NULL, NULL, v_sales, (t - 3)::timestamp + time '10:30', (t - 3)::timestamp + time '10:30'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc03', v_org, 'inquiry', v_inq06, v_b_albarakah,
      'Sample SMP-0002 sent, ask Tariq for result', t, false, NULL, NULL, v_sales, (t - 7)::timestamp + time '10:30', (t - 7)::timestamp + time '10:30'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc04', v_org, 'quote', v_qtn03, v_b_rhine,
      'Quote QTN-2627-0003 expires tomorrow - call Hans', t, false, NULL, NULL, v_sales, (t - 9)::timestamp + time '10:30', (t - 9)::timestamp + time '10:30'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc05', v_org, 'buyer', v_b_haldiram, v_b_haldiram,
      'Re-quote red flakes - crop price down, Manish asked', t, false, NULL, NULL, v_owner, (t - 4)::timestamp + time '10:30', (t - 4)::timestamp + time '10:30'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc06', v_org, 'inquiry', v_inq10, NULL,
      'Send FOB rate and sample offer to Gulf Star', t + 1, false, NULL, NULL, v_sales, t::timestamp + time '10:30', t::timestamp + time '10:30'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc07', v_org, 'order', v_ord03, v_b_haldiram,
      'Truck for 17 Nov - confirm with Mahuva Transport', t + 4, false, NULL, NULL, v_owner, (t - 2)::timestamp + time '10:30', (t - 2)::timestamp + time '10:30'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc08', v_org, 'buyer', v_b_everest, v_b_everest,
      'Share season rate list for red powder', t + 7, false, NULL, NULL, v_owner, (t - 1)::timestamp + time '10:30', (t - 1)::timestamp + time '10:30'),

  -- 3. Notes for the timelines: due_on NULL, done = true, done_at = created_at
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc11', v_org, 'inquiry', v_inq02, v_b_albarakah,
      'Repeat buyer; wants 1 x 20 ft before December', NULL, true, (t - 40)::timestamp + time '10:30', v_sales, v_sales, (t - 40)::timestamp + time '10:30', (t - 40)::timestamp + time '10:30'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc12', v_org, 'inquiry', v_inq06, v_b_albarakah,
      'Wants pink chopped for Ramadan packs, 12 MT', NULL, true, (t - 9)::timestamp + time '10:30', v_sales, v_sales, (t - 9)::timestamp + time '10:30', (t - 9)::timestamp + time '10:30'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc13', v_org, 'inquiry', v_inq06, v_b_albarakah,
      'Sample 500 g sent by DHL', NULL, true, (t - 7)::timestamp + time '10:30', v_sales, v_sales, (t - 7)::timestamp + time '10:30', (t - 7)::timestamp + time '10:30'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc14', v_org, 'buyer', v_b_albarakah, v_b_albarakah,
      'Tariq prefers WhatsApp after 2 pm IST', NULL, true, (t - 30)::timestamp + time '10:30', v_sales, v_sales, (t - 30)::timestamp + time '10:30', (t - 30)::timestamp + time '10:30'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc15', v_org, 'order', v_ord02, v_b_albarakah,
      'Container booked with Seabridge CHA, Pipavav', NULL, true, (t - 10)::timestamp + time '10:30', v_acct, v_acct, (t - 10)::timestamp + time '10:30', (t - 10)::timestamp + time '10:30'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc16', v_org, 'inquiry', v_inq03, v_b_haldiram,
      'Manish wants ₹125; cannot go below floor', NULL, true, (t - 18)::timestamp + time '10:30', v_owner, v_owner, (t - 18)::timestamp + time '10:30', (t - 18)::timestamp + time '10:30')
  ON CONFLICT (id) DO UPDATE SET
    org_id = EXCLUDED.org_id,
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    buyer_id = EXCLUDED.buyer_id,
    note = EXCLUDED.note,
    due_on = EXCLUDED.due_on,
    done = EXCLUDED.done,
    done_at = EXCLUDED.done_at,
    done_by = EXCLUDED.done_by,
    created_by = EXCLUDED.created_by,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

END $$;
