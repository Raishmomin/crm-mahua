-- Seed 03: samples and quotations for the demo (Dev-2, Sprint B)
-- Rows: docs/design/sample-data.md sections 2 and 3; structure: contracts.md section 8.
-- Runs after 01_core.sql (buyers, products, packaging, price list) and 02_inquiries.sql.
-- Idempotent: fixed UUIDs + ON CONFLICT (id) DO UPDATE; re-running resets the story.
-- Runs as postgres (no auth.uid()): the guard trigger sees no role and lets every rate
-- through; the totals trigger recomputes subtotal / gst / total to the sheet's numbers.
-- T = CURRENT_DATE; every date below is relative to it.

DO $$
DECLARE
  v_org uuid := '11111111-1111-4111-8111-111111111111';
  v_owner uuid := '22222222-2222-4222-8222-222222222221';
  v_sales uuid := '22222222-2222-4222-8222-222222222223';

  -- products (seed 01)
  v_w_flk uuid := '33333333-3333-4333-8333-333333333331';  -- W-FLK-A
  v_w_pow uuid := '33333333-3333-4333-8333-333333333333';  -- W-POW-P
  v_r_flk uuid := '33333333-3333-4333-8333-333333333334';  -- R-FLK-C
  v_p_chp uuid := '33333333-3333-4333-8333-333333333336';  -- P-CHP-E

  v_pkg1 uuid := '44444444-4444-4444-8444-444444444441';

  -- buyers (seed 01)
  v_everest uuid := '55555555-5555-4555-8555-555555555551';
  v_haldiram uuid := '55555555-5555-4555-8555-555555555552';
  v_albarakah uuid := '55555555-5555-4555-8555-555555555553';
  v_rhine uuid := '55555555-5555-4555-8555-555555555554';

  -- inquiries (seed 02, looked up by code so the ids never matter)
  v_inq_02 uuid := (SELECT id FROM inquiries WHERE org_id = '11111111-1111-4111-8111-111111111111' AND code = 'INQ-0002');
  v_inq_03 uuid := (SELECT id FROM inquiries WHERE org_id = '11111111-1111-4111-8111-111111111111' AND code = 'INQ-0003');
  v_inq_05 uuid := (SELECT id FROM inquiries WHERE org_id = '11111111-1111-4111-8111-111111111111' AND code = 'INQ-0005');
  v_inq_06 uuid := (SELECT id FROM inquiries WHERE org_id = '11111111-1111-4111-8111-111111111111' AND code = 'INQ-0006');
  v_inq_07 uuid := (SELECT id FROM inquiries WHERE org_id = '11111111-1111-4111-8111-111111111111' AND code = 'INQ-0007');
  v_inq_08 uuid := (SELECT id FROM inquiries WHERE org_id = '11111111-1111-4111-8111-111111111111' AND code = 'INQ-0008');

  v_usd_rate numeric(10,4) := 84.25;
BEGIN
  v_usd_rate := COALESCE(
    (SELECT (settings -> 'currency_rates' ->> 'USD')::numeric FROM app_settings WHERE org_id = v_org),
    84.25);

  --------------------------------------------------------------------------
  -- 1. Samples (3)
  --------------------------------------------------------------------------
  INSERT INTO samples (
    id, org_id, code, inquiry_id, buyer_id, product_id, qty_grams, courier, tracking_no,
    sent_on, status, result_note, decided_on, created_by, created_at, updated_at
  )
  VALUES
    ('77777777-7777-4777-8777-777777777701', v_org, 'SMP-0001', v_inq_02, v_albarakah, v_w_flk, 500,
      'DHL', 'DHL 7788 2211 05', CURRENT_DATE - 38, 'approved',
      'Colour and moisture OK - Tariq on WhatsApp', CURRENT_DATE - 31,
      v_sales, (CURRENT_DATE - 39)::timestamp + time '10:30', (CURRENT_DATE - 31)::timestamp + time '10:30'),
    ('77777777-7777-4777-8777-777777777702', v_org, 'SMP-0002', v_inq_06, v_albarakah, v_p_chp, 500,
      'DHL', 'DHL 7788 2290 41', CURRENT_DATE - 7, 'sent',
      NULL, NULL,
      v_sales, (CURRENT_DATE - 8)::timestamp + time '10:30', (CURRENT_DATE - 7)::timestamp + time '10:30'),
    ('77777777-7777-4777-8777-777777777703', v_org, 'SMP-0003', v_inq_07, v_everest, v_w_flk, 250,
      NULL, NULL, NULL, 'to_send',
      'For soup mix trial - Sunita Deshmukh', NULL,
      v_sales, (CURRENT_DATE - 2)::timestamp + time '10:30', (CURRENT_DATE - 2)::timestamp + time '10:30')
  ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    inquiry_id = EXCLUDED.inquiry_id,
    buyer_id = EXCLUDED.buyer_id,
    product_id = EXCLUDED.product_id,
    qty_grams = EXCLUDED.qty_grams,
    courier = EXCLUDED.courier,
    tracking_no = EXCLUDED.tracking_no,
    sent_on = EXCLUDED.sent_on,
    status = EXCLUDED.status,
    result_note = EXCLUDED.result_note,
    decided_on = EXCLUDED.decided_on,
    created_by = EXCLUDED.created_by,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO entity_code_counters (org_id, prefix, current_val)
  VALUES (v_org, 'SMP', 3)
  ON CONFLICT (org_id, prefix) DO UPDATE
    SET current_val = GREATEST(entity_code_counters.current_val, EXCLUDED.current_val);

  --------------------------------------------------------------------------
  -- 2. Quotations (4): headers with the sheet's totals, items after (trigger recomputes)
  --------------------------------------------------------------------------
  INSERT INTO quotations (
    id, org_id, quote_no, inquiry_id, buyer_id, currency, fx_rate, incoterm, valid_till, payment_terms,
    subtotal, gst_amount, total, status, reject_reason, notes, sent_at, decided_at,
    created_by, created_at, updated_at
  )
  VALUES
    ('88888888-8888-4888-8888-888888888801', v_org, 'QTN-2627-0001', v_inq_02, v_albarakah, 'USD', v_usd_rate,
      'FOB Pipavav', CURRENT_DATE - 20, '30% advance, 70% against BL copy',
      27000.00, 0.00, 27000.00, 'accepted', NULL, NULL,
      (CURRENT_DATE - 30)::timestamp + time '10:30', (CURRENT_DATE - 27)::timestamp + time '10:30',
      v_sales, (CURRENT_DATE - 30)::timestamp + time '10:30', (CURRENT_DATE - 27)::timestamp + time '10:30'),
    ('88888888-8888-4888-8888-888888888802', v_org, 'QTN-2627-0002', v_inq_03, v_haldiram, 'INR', NULL,
      'EXW', CURRENT_DATE - 15, '50% advance, 50% before dispatch',
      560000.00, 28000.00, 588000.00, 'rejected', 'price', 'Lost - Price',
      (CURRENT_DATE - 22)::timestamp + time '10:30', (CURRENT_DATE - 18)::timestamp + time '10:30',
      v_owner, (CURRENT_DATE - 22)::timestamp + time '10:30', (CURRENT_DATE - 18)::timestamp + time '10:30'),
    ('88888888-8888-4888-8888-888888888803', v_org, 'QTN-2627-0003', v_inq_05, v_rhine, 'USD', v_usd_rate,
      'CIF', CURRENT_DATE + 1, 'LC at sight',
      49500.00, 0.00, 49500.00, 'sent', NULL, 'CIF Hamburg; 1 x 20 ft',
      (CURRENT_DATE - 9)::timestamp + time '10:30', NULL,
      v_sales, (CURRENT_DATE - 9)::timestamp + time '10:30', (CURRENT_DATE - 9)::timestamp + time '10:30'),
    ('88888888-8888-4888-8888-888888888804', v_org, 'QTN-2627-0004', v_inq_08, v_everest, 'INR', NULL,
      'EXW', CURRENT_DATE + 14, '30 days credit',
      210000.00, 10500.00, 220500.00, 'draft', NULL, NULL,
      NULL, NULL,
      v_owner, (CURRENT_DATE - 1)::timestamp + time '10:30', (CURRENT_DATE - 1)::timestamp + time '10:30')
  ON CONFLICT (id) DO UPDATE SET
    quote_no = EXCLUDED.quote_no,
    inquiry_id = EXCLUDED.inquiry_id,
    buyer_id = EXCLUDED.buyer_id,
    currency = EXCLUDED.currency,
    fx_rate = EXCLUDED.fx_rate,
    incoterm = EXCLUDED.incoterm,
    valid_till = EXCLUDED.valid_till,
    payment_terms = EXCLUDED.payment_terms,
    subtotal = EXCLUDED.subtotal,
    gst_amount = EXCLUDED.gst_amount,
    total = EXCLUDED.total,
    status = EXCLUDED.status,
    reject_reason = EXCLUDED.reject_reason,
    notes = EXCLUDED.notes,
    sent_at = EXCLUDED.sent_at,
    decided_at = EXCLUDED.decided_at,
    created_by = EXCLUDED.created_by,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

  -- Items (one per quote). amount / floor_price_at_time / gst_rate are set by the guard trigger
  -- (W-FLK-A USD/MT floor 2050, R-FLK-C INR/kg floor 125, W-POW-P USD/MT floor 2400).
  INSERT INTO quotation_items (
    id, org_id, quotation_id, product_id, packaging_type_id, qty_kg, unit, rate, spec_text, sort_order, created_at
  )
  VALUES
    ('89898989-8989-4989-8989-898989898901', v_org, '88888888-8888-4888-8888-888888888801', v_w_flk, v_pkg1,
      12000, 'MT', 2250.00, 'moisture <= 5.5%, 8-15 mm', 1, (CURRENT_DATE - 30)::timestamp + time '10:30'),
    ('89898989-8989-4989-8989-898989898902', v_org, '88888888-8888-4888-8888-888888888802', v_r_flk, v_pkg1,
      4000, 'kg', 140.00, 'moisture <= 6%, 10-20 mm', 1, (CURRENT_DATE - 22)::timestamp + time '10:30'),
    ('89898989-8989-4989-8989-898989898903', v_org, '88888888-8888-4888-8888-888888888803', v_w_pow, v_pkg1,
      18000, 'MT', 2750.00, 'moisture <= 4.5%, 100 mesh', 1, (CURRENT_DATE - 9)::timestamp + time '10:30'),
    ('89898989-8989-4989-8989-898989898904', v_org, '88888888-8888-4888-8888-888888888804', v_r_flk, v_pkg1,
      1500, 'kg', 140.00, 'moisture <= 6%, 10-20 mm', 1, (CURRENT_DATE - 1)::timestamp + time '10:30')
  ON CONFLICT (id) DO UPDATE SET
    quotation_id = EXCLUDED.quotation_id,
    product_id = EXCLUDED.product_id,
    packaging_type_id = EXCLUDED.packaging_type_id,
    qty_kg = EXCLUDED.qty_kg,
    unit = EXCLUDED.unit,
    rate = EXCLUDED.rate,
    spec_text = EXCLUDED.spec_text,
    sort_order = EXCLUDED.sort_order,
    created_at = EXCLUDED.created_at;

  -- Items left by an older run of this seed (never expected; keeps one item per quote)
  DELETE FROM quotation_items i
  WHERE i.org_id = v_org
    AND i.quotation_id::text LIKE '88888888-8888-4888-8888-8888888888%'
    AND i.id::text NOT LIKE '89898989-8989-4989-8989-8989898989%';

  -- Doc counter (sample-data.md section 9): QTN = 4 for FY 2627
  INSERT INTO doc_counters (org_id, doc_type, fy, current_val)
  VALUES (v_org, 'QTN', '2627', 4)
  ON CONFLICT (org_id, doc_type, fy) DO UPDATE
    SET current_val = GREATEST(doc_counters.current_val, EXCLUDED.current_val), updated_at = now();
END $$;
