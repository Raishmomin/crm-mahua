-- Seed 04: orders, order items, dispatches and payments for the demo (Dev-3, Sprint B)
-- Rows: docs/design/sample-data.md sections 4-6; structure: contracts.md section 8.
-- Runs after 01_core.sql (buyers, products, packaging), 02_inquiries.sql (follow-ups that
-- point at ORD-0002 / ORD-0003 by these fixed ids) and 03_samples_quotes.sql (QTN-2627-0001).
-- Runs as postgres: the four tables are function-only for web sessions, the seed inserts
-- directly with explicit codes and document numbers and then bumps the counters.
-- Idempotent: fixed UUIDs + ON CONFLICT (id) DO UPDATE; re-running resets the story
-- (dispatches / payments added to these three orders during a demo are removed again).
-- T = CURRENT_DATE; every date below is relative to it.
-- orders.step_dates (contracts A7) = the status history in sample-data.md section 4.

DO $$
DECLARE
  v_org uuid := '11111111-1111-4111-8111-111111111111';
  v_owner uuid := '22222222-2222-4222-8222-222222222221';
  v_accountant uuid := '22222222-2222-4222-8222-222222222222';
  v_sales uuid := '22222222-2222-4222-8222-222222222223';

  -- products (seed 01)
  v_w_flk uuid := '33333333-3333-4333-8333-333333333331';  -- W-FLK-A
  v_w_min uuid := '33333333-3333-4333-8333-333333333332';  -- W-MIN-A
  v_r_pow uuid := '33333333-3333-4333-8333-333333333335';  -- R-POW-S

  v_pkg1 uuid := '44444444-4444-4444-8444-444444444441';   -- 25 kg paper bag + liner

  -- buyers (seed 01)
  v_everest uuid := '55555555-5555-4555-8555-555555555551';
  v_haldiram uuid := '55555555-5555-4555-8555-555555555552';
  v_albarakah uuid := '55555555-5555-4555-8555-555555555553';

  -- quotation QTN-2627-0001 (seed 03)
  v_qtn01 uuid := '88888888-8888-4888-8888-888888888801';

  -- inquiries (seed 02), looked up by code
  v_inq01 uuid := (SELECT id FROM inquiries WHERE org_id = '11111111-1111-4111-8111-111111111111' AND code = 'INQ-0001');
  v_inq02 uuid := (SELECT id FROM inquiries WHERE org_id = '11111111-1111-4111-8111-111111111111' AND code = 'INQ-0002');
  v_inq04 uuid := (SELECT id FROM inquiries WHERE org_id = '11111111-1111-4111-8111-111111111111' AND code = 'INQ-0004');

  -- this seed's own ids (contracts.md section 8)
  v_ord01 uuid := '99999999-9999-4999-8999-999999999901';
  v_ord02 uuid := '99999999-9999-4999-8999-999999999902';
  v_ord03 uuid := '99999999-9999-4999-8999-999999999903';
  v_usd_rate numeric(10,4);
BEGIN
  v_usd_rate := COALESCE(
    (SELECT (settings -> 'currency_rates' ->> 'USD')::numeric FROM app_settings WHERE org_id = v_org),
    84.25);

  --------------------------------------------------------------------------
  -- 1. Orders (3)
  --------------------------------------------------------------------------
  INSERT INTO orders (
    id, org_id, order_code, pi_no, quotation_id, inquiry_id, buyer_id, currency, fx_rate, incoterm,
    payment_terms, total, advance_expected, expected_dispatch, status, status_changed_at,
    packed_bags, packing_note, notes, created_by, created_at, updated_at, step_dates
  )
  VALUES
    (v_ord01, v_org, 'ORD-0001', 'PI-2627-0001', NULL, v_inq01, v_everest, 'INR', NULL, 'EXW',
      '30 days credit', 504000.00, 0.00, CURRENT_DATE - 40, 'delivered',
      (CURRENT_DATE - 38)::timestamp + time '10:30',
      120, NULL, 'Order on phone from Rajeshbhai; rate per price list',
      v_owner, (CURRENT_DATE - 46)::timestamp + time '10:30', (CURRENT_DATE - 38)::timestamp + time '10:30',
      jsonb_build_object('confirmed', CURRENT_DATE - 46, 'in_production', CURRENT_DATE - 45, 'ready', CURRENT_DATE - 41,
                         'dispatched', CURRENT_DATE - 40, 'delivered', CURRENT_DATE - 38)),
    (v_ord02, v_org, 'ORD-0002', 'PI-2627-0002', v_qtn01, v_inq02, v_albarakah, 'USD', v_usd_rate, 'FOB Pipavav',
      '30% advance, 70% against BL copy', 27000.00, 8100.00, CURRENT_DATE - 5, 'dispatched',
      (CURRENT_DATE - 6)::timestamp + time '10:30',
      480, NULL, '1 x 20 ft via Pipavav; CHA Seabridge',
      v_sales, (CURRENT_DATE - 27)::timestamp + time '10:30', (CURRENT_DATE - 6)::timestamp + time '10:30',
      jsonb_build_object('confirmed', CURRENT_DATE - 27, 'in_production', CURRENT_DATE - 22, 'ready', CURRENT_DATE - 9,
                         'dispatched', CURRENT_DATE - 6)),
    (v_ord03, v_org, 'ORD-0003', 'PI-2627-0003', NULL, v_inq04, v_haldiram, 'INR', NULL, 'EXW',
      '50% advance, 50% before dispatch', 1023750.00, 511875.00, CURRENT_DATE + 5, 'in_production',
      (CURRENT_DATE - 2)::timestamp + time '10:30',
      NULL, NULL, 'PO HSPL/26-27/1182; truck to Noida',
      v_owner, (CURRENT_DATE - 10)::timestamp + time '10:30', (CURRENT_DATE - 2)::timestamp + time '10:30',
      jsonb_build_object('confirmed', CURRENT_DATE - 10, 'in_production', CURRENT_DATE - 2))
  ON CONFLICT (id) DO UPDATE SET
    order_code = EXCLUDED.order_code,
    pi_no = EXCLUDED.pi_no,
    quotation_id = EXCLUDED.quotation_id,
    inquiry_id = EXCLUDED.inquiry_id,
    buyer_id = EXCLUDED.buyer_id,
    currency = EXCLUDED.currency,
    fx_rate = EXCLUDED.fx_rate,
    incoterm = EXCLUDED.incoterm,
    payment_terms = EXCLUDED.payment_terms,
    total = EXCLUDED.total,
    advance_expected = EXCLUDED.advance_expected,
    expected_dispatch = EXCLUDED.expected_dispatch,
    status = EXCLUDED.status,
    status_changed_at = EXCLUDED.status_changed_at,
    packed_bags = EXCLUDED.packed_bags,
    packing_note = EXCLUDED.packing_note,
    notes = EXCLUDED.notes,
    created_by = EXCLUDED.created_by,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    step_dates = EXCLUDED.step_dates;

  --------------------------------------------------------------------------
  -- 2. Order items (one per order; INR totals above include GST 5%)
  --------------------------------------------------------------------------
  INSERT INTO order_items (
    id, org_id, order_id, product_id, packaging_type_id, qty_kg, unit, rate, amount, gst_rate,
    dispatched_kg, spec_text, sort_order, created_at, updated_at
  )
  VALUES
    ('9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a01', v_org, v_ord01, v_r_pow, v_pkg1, 3000, 'kg', 160.00, 480000.00, 5,
      3000, 'moisture <= 5%, 80-100 mesh', 1,
      (CURRENT_DATE - 46)::timestamp + time '10:30', (CURRENT_DATE - 40)::timestamp + time '10:30'),
    ('9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a02', v_org, v_ord02, v_w_flk, v_pkg1, 12000, 'MT', 2250.00, 27000.00, 0,
      12000, 'moisture <= 5.5%, 8-15 mm', 1,
      (CURRENT_DATE - 27)::timestamp + time '10:30', (CURRENT_DATE - 6)::timestamp + time '10:30'),
    ('9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a03', v_org, v_ord03, v_w_min, v_pkg1, 5000, 'kg', 195.00, 975000.00, 5,
      0, 'moisture <= 5.5%, 1-3 mm', 1,
      (CURRENT_DATE - 10)::timestamp + time '10:30', (CURRENT_DATE - 10)::timestamp + time '10:30')
  ON CONFLICT (id) DO UPDATE SET
    order_id = EXCLUDED.order_id,
    product_id = EXCLUDED.product_id,
    packaging_type_id = EXCLUDED.packaging_type_id,
    qty_kg = EXCLUDED.qty_kg,
    unit = EXCLUDED.unit,
    rate = EXCLUDED.rate,
    amount = EXCLUDED.amount,
    gst_rate = EXCLUDED.gst_rate,
    dispatched_kg = EXCLUDED.dispatched_kg,
    spec_text = EXCLUDED.spec_text,
    sort_order = EXCLUDED.sort_order,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

  -- Items added to these orders outside this seed would break the story: remove them.
  DELETE FROM order_items
  WHERE org_id = v_org
    AND order_id IN (v_ord01, v_ord02, v_ord03)
    AND id NOT IN ('9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a01', '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a02',
                   '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a03');

  --------------------------------------------------------------------------
  -- 3. Dispatches (2): Everest by truck (delivered), Al-Barakah by container (7 of 8 papers)
  --------------------------------------------------------------------------
  -- A demo run may have dispatched ORD-0003 or added receipts; reset to the seeded story.
  DELETE FROM payments
  WHERE org_id = v_org
    AND order_id IN (v_ord01, v_ord02, v_ord03)
    AND id NOT IN ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02',
                   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb04');
  DELETE FROM dispatches
  WHERE org_id = v_org
    AND order_id IN (v_ord01, v_ord02, v_ord03)
    AND id NOT IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02');

  INSERT INTO dispatches (
    id, org_id, order_id, sdn_no, invoice_no, dispatched_on, mode, vehicle_no, lr_no, transporter,
    bags_count, qty_kg, invoice_total, delivered_on, status, container_no, port, vessel,
    stuffing_date, eta, bl_no, export_checklist, notes, created_by, created_at, updated_at
  )
  VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', v_org, v_ord01, 'SDN-2627-0001', 'INV-2627-0001', CURRENT_DATE - 40,
      'truck', 'GJ-04-AX-7712', 'MTC/4471', 'Mahuva Transport Co.',
      120, 3000, 504000.00, CURRENT_DATE - 38, 'delivered', NULL, NULL, NULL,
      NULL, NULL, NULL, '{}'::jsonb, NULL,
      v_accountant, (CURRENT_DATE - 40)::timestamp + time '10:30', (CURRENT_DATE - 38)::timestamp + time '10:30'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', v_org, v_ord02, 'SDN-2627-0002', 'INV-2627-0002', CURRENT_DATE - 6,
      'container', NULL, 'PPV/CHA/2231', 'Seabridge Logistics (CHA)',
      480, 12000, 27000.00, NULL, 'dispatched', 'MSKU 482913-7', 'Pipavav', 'MSC Positano 2646W',
      CURRENT_DATE - 6, CURRENT_DATE + 12, 'MEDUPV2246118',
      jsonb_build_object(
        'container_booked',     jsonb_build_object('done', true,  'date', CURRENT_DATE - 10),
        'stuffing_done',        jsonb_build_object('done', true,  'date', CURRENT_DATE - 6),
        'coa',                  jsonb_build_object('done', true,  'date', CURRENT_DATE - 7),
        'phyto',                jsonb_build_object('done', true,  'date', CURRENT_DATE - 4),
        'coo',                  jsonb_build_object('done', false, 'date', NULL),
        'fumigation',           jsonb_build_object('done', true,  'date', CURRENT_DATE - 6),
        'invoice_packing_list', jsonb_build_object('done', true,  'date', CURRENT_DATE - 6),
        'bl_received',          jsonb_build_object('done', true,  'date', CURRENT_DATE - 2)
      ),
      NULL,
      v_accountant, (CURRENT_DATE - 6)::timestamp + time '10:30', (CURRENT_DATE - 2)::timestamp + time '10:30')
  ON CONFLICT (id) DO UPDATE SET
    order_id = EXCLUDED.order_id,
    sdn_no = EXCLUDED.sdn_no,
    invoice_no = EXCLUDED.invoice_no,
    dispatched_on = EXCLUDED.dispatched_on,
    mode = EXCLUDED.mode,
    vehicle_no = EXCLUDED.vehicle_no,
    lr_no = EXCLUDED.lr_no,
    transporter = EXCLUDED.transporter,
    bags_count = EXCLUDED.bags_count,
    qty_kg = EXCLUDED.qty_kg,
    invoice_total = EXCLUDED.invoice_total,
    delivered_on = EXCLUDED.delivered_on,
    status = EXCLUDED.status,
    container_no = EXCLUDED.container_no,
    port = EXCLUDED.port,
    vessel = EXCLUDED.vessel,
    stuffing_date = EXCLUDED.stuffing_date,
    eta = EXCLUDED.eta,
    bl_no = EXCLUDED.bl_no,
    export_checklist = EXCLUDED.export_checklist,
    notes = EXCLUDED.notes,
    created_by = EXCLUDED.created_by,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

  --------------------------------------------------------------------------
  -- 4. Payments (4): INR rows keep amount_inr / fx_rate NULL
  --------------------------------------------------------------------------
  INSERT INTO payments (
    id, org_id, receipt_no, order_id, buyer_id, amount, currency, amount_inr, fx_rate,
    received_on, mode, reference, note, created_by, created_at
  )
  VALUES
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', v_org, 'REC-2627-0001', v_ord02, v_albarakah, 8100.00, 'USD',
      682425.00, 84.2500, CURRENT_DATE - 25, 'bank', 'TT ref 7781AB, HDFC USD a/c', '30% advance',
      v_accountant, (CURRENT_DATE - 25)::timestamp + time '10:30'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02', v_org, 'REC-2627-0002', v_ord01, v_everest, 200000.00, 'INR',
      NULL, NULL, CURRENT_DATE - 15, 'bank', 'NEFT N3121 SBI', 'Part payment',
      v_accountant, (CURRENT_DATE - 15)::timestamp + time '10:30'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03', v_org, 'REC-2627-0003', v_ord03, v_haldiram, 511875.00, 'INR',
      NULL, NULL, CURRENT_DATE - 9, 'bank', 'RTGS HDFC R88213', '50% advance',
      v_accountant, (CURRENT_DATE - 9)::timestamp + time '10:30'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb04', v_org, 'REC-2627-0004', v_ord01, v_everest, 304000.00, 'INR',
      NULL, NULL, CURRENT_DATE - 3, 'upi', 'UPI 4419@sbi', 'Balance; 7 days after due date',
      v_accountant, (CURRENT_DATE - 3)::timestamp + time '10:30')
  ON CONFLICT (id) DO UPDATE SET
    receipt_no = EXCLUDED.receipt_no,
    order_id = EXCLUDED.order_id,
    buyer_id = EXCLUDED.buyer_id,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    amount_inr = EXCLUDED.amount_inr,
    fx_rate = EXCLUDED.fx_rate,
    received_on = EXCLUDED.received_on,
    mode = EXCLUDED.mode,
    reference = EXCLUDED.reference,
    note = EXCLUDED.note,
    created_by = EXCLUDED.created_by,
    created_at = EXCLUDED.created_at;

  --------------------------------------------------------------------------
  -- 5. Counters (sample-data.md section 9): ORD 3; PI 3, INV 2, SDN 2, REC 4 in FY 2627
  --------------------------------------------------------------------------
  INSERT INTO entity_code_counters (org_id, prefix, current_val)
  VALUES (v_org, 'ORD', 3)
  ON CONFLICT (org_id, prefix) DO UPDATE
    SET current_val = GREATEST(entity_code_counters.current_val, EXCLUDED.current_val);

  INSERT INTO doc_counters (org_id, doc_type, fy, current_val)
  VALUES (v_org, 'PI', '2627', 3), (v_org, 'INV', '2627', 2), (v_org, 'SDN', '2627', 2), (v_org, 'REC', '2627', 4)
  ON CONFLICT (org_id, doc_type, fy) DO UPDATE
    SET current_val = GREATEST(doc_counters.current_val, EXCLUDED.current_val), updated_at = now();
END $$;
