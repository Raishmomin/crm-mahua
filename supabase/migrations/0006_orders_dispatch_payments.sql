-- Migration 0006: Orders, order items, dispatches (truck / container + export checklist),
-- payments, their state functions and the money / Home views (Dev-3, Sprint B).
-- Spec: docs/design/contracts.md 3.6-3.9, 4.4, 5.3-5.6 (+ section 11 amendments);
--       flows.md sections 5-9; sample-data.md sections 4-6.
-- Depends on 0004 (inquiries, follow_ups) and 0005 (quotations, quotation_items).
--
-- * Idempotent: CREATE IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS everywhere.
--   0003 re-grants SELECT / INSERT / UPDATE / DELETE on every table on each run, so the
--   REVOKEs below are re-applied on each run too (filename order guarantees it).
-- * Function-only tables (contracts 2.2): orders, order_items, dispatches, payments carry a
--   SELECT policy (own org) and no write grant for web roles. Every row change goes through
--   the SECURITY DEFINER functions below, each scoped to fn_current_org() and gated by
--   fn_require_module(). Codes come from fn_next_code / fn_next_doc_no inside them.
-- * Error codes (contracts 2.3 + amendment A4):
--     not_found, role_not_allowed, module missing        -> SQLSTATE 42501
--     invalid_transition, quote_expired, no_items,
--     bad_payload, bl_required                           -> SQLSTATE P0001
-- * Additions beyond the contract text (noted in tasks/todo.md):
--     - fn_format_money(amount, currency): plain (not SECURITY DEFINER) helper that writes
--       "$18,900" / "₹5,11,875" into the system follow-up notes.
--     - v_order_balances also exposes payment_terms, phone (primary contact),
--       latest_invoice_no and created_at for the Money list rows.
-- * Sprint C (contracts section 12): A6 Plant reads no money (payments policy, v_order_balances);
--   A7 orders.step_dates set by the state functions; A8 fn_payment_record date / amount caps;
--   fn_order_advance_waiting keeps the Plant "Wait for advance" guard without money rows.

--------------------------------------------------------------------------------
-- 0. Helper: money text for system follow-up notes (English, no decimals when whole)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_format_money(p_amount numeric, p_currency text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_cur text := upper(COALESCE(NULLIF(btrim(p_currency), ''), 'INR'));
  v_n numeric := round(abs(COALESCE(p_amount, 0)), 2);
  v_int text := trunc(v_n)::text;
  v_frac numeric := v_n - trunc(v_n);
  v_out text;
BEGIN
  IF v_cur = 'INR' THEN
    -- Indian grouping: last three digits, then pairs (5,11,875 / 10,23,750)
    IF length(v_int) > 3 THEN
      v_out := right(v_int, 3);
      v_int := left(v_int, length(v_int) - 3);
      WHILE length(v_int) > 2 LOOP
        v_out := right(v_int, 2) || ',' || v_out;
        v_int := left(v_int, length(v_int) - 2);
      END LOOP;
      v_out := v_int || ',' || v_out;
    ELSE
      v_out := v_int;
    END IF;
  ELSE
    v_out := to_char(trunc(v_n), 'FM999,999,999,999,990');
  END IF;

  IF v_frac > 0 THEN
    v_out := v_out || '.' || lpad(round(v_frac * 100)::integer::text, 2, '0');
  END IF;

  RETURN CASE v_cur
    WHEN 'INR' THEN '₹'
    WHEN 'USD' THEN '$'
    WHEN 'EUR' THEN '€'
    WHEN 'GBP' THEN '£'
    ELSE v_cur || ' '
  END || v_out;
END;
$$;

--------------------------------------------------------------------------------
-- 1. orders (contracts 3.6) - function-only writes
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_code text NOT NULL,
  pi_no text NOT NULL,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  inquiry_id uuid REFERENCES inquiries(id) ON DELETE SET NULL,
  buyer_id uuid NOT NULL REFERENCES buyers(id),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(10,4),
  incoterm text NOT NULL CHECK (incoterm IN ('EXW', 'FOB Pipavav', 'FOB Mundra', 'CIF')),
  payment_terms text NOT NULL,
  total numeric(14,2) NOT NULL DEFAULT 0,
  advance_expected numeric(14,2) NOT NULL DEFAULT 0,
  expected_dispatch date,
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'in_production', 'ready', 'dispatched', 'delivered', 'cancelled')),
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  packed_bags integer CHECK (packed_bags IS NULL OR packed_bags >= 0),
  packing_note text,
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_orders_org_order_code UNIQUE (org_id, order_code),
  CONSTRAINT uq_orders_org_pi_no UNIQUE (org_id, pi_no)
);

CREATE INDEX IF NOT EXISTS idx_orders_org_id ON orders(org_id);
CREATE INDEX IF NOT EXISTS idx_orders_org_status ON orders(org_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_org_buyer ON orders(org_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_org_quotation ON orders(org_id, quotation_id);

-- Amendment A7 (G2-09): one ISO date per step reached, keys confirmed / in_production / ready /
-- dispatched / delivered. Written only by the state functions below (and seed 04).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS step_dates jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_step_dates_object' AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT chk_orders_step_dates_object CHECK (jsonb_typeof(step_dates) = 'object');
  END IF;
END $$;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_select ON orders;
CREATE POLICY orders_select ON orders FOR SELECT USING (org_id = fn_current_org());

DROP TRIGGER IF EXISTS trg_audit_orders ON orders;
CREATE TRIGGER trg_audit_orders AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

--------------------------------------------------------------------------------
-- 2. order_items (contracts 3.7)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  packaging_type_id uuid REFERENCES packaging_types(id) ON DELETE SET NULL,
  qty_kg numeric(12,2) NOT NULL CHECK (qty_kg > 0),
  unit text NOT NULL CHECK (unit IN ('kg', 'MT')),
  rate numeric(12,2) NOT NULL,
  amount numeric(14,2) NOT NULL,
  gst_rate numeric(5,2) NOT NULL DEFAULT 5,
  dispatched_kg numeric(12,2) NOT NULL DEFAULT 0 CHECK (dispatched_kg >= 0),
  spec_text text,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_org_id ON order_items(org_id);
CREATE INDEX IF NOT EXISTS idx_order_items_org_order ON order_items(org_id, order_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_select ON order_items;
CREATE POLICY order_items_select ON order_items FOR SELECT USING (org_id = fn_current_org());

DROP TRIGGER IF EXISTS trg_audit_order_items ON order_items;
CREATE TRIGGER trg_audit_order_items AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

--------------------------------------------------------------------------------
-- 3. dispatches (contracts 3.8): truck or container, export checklist for containers
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  sdn_no text NOT NULL,
  invoice_no text NOT NULL,
  dispatched_on date NOT NULL DEFAULT CURRENT_DATE,
  mode text NOT NULL CHECK (mode IN ('truck', 'container')),
  vehicle_no text,
  lr_no text,
  transporter text,
  bags_count integer NOT NULL DEFAULT 0 CHECK (bags_count >= 0),
  qty_kg numeric(12,2) NOT NULL CHECK (qty_kg > 0),
  invoice_total numeric(14,2) NOT NULL DEFAULT 0,
  delivered_on date,
  status text NOT NULL DEFAULT 'dispatched' CHECK (status IN ('dispatched', 'delivered')),
  container_no text,
  port text,
  vessel text,
  stuffing_date date,
  eta date,
  bl_no text,
  export_checklist jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(export_checklist) = 'object'),
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_dispatches_org_sdn_no UNIQUE (org_id, sdn_no),
  CONSTRAINT uq_dispatches_org_invoice_no UNIQUE (org_id, invoice_no)
);

CREATE INDEX IF NOT EXISTS idx_dispatches_org_id ON dispatches(org_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_org_order ON dispatches(org_id, order_id);

ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispatches_select ON dispatches;
CREATE POLICY dispatches_select ON dispatches FOR SELECT USING (org_id = fn_current_org());

DROP TRIGGER IF EXISTS trg_audit_dispatches ON dispatches;
CREATE TRIGGER trg_audit_dispatches AFTER INSERT OR UPDATE OR DELETE ON dispatches
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

--------------------------------------------------------------------------------
-- 4. payments (contracts 3.9): append-only money received
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  receipt_no text NOT NULL,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES buyers(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount_inr numeric(14,2),
  fx_rate numeric(10,4),
  received_on date NOT NULL DEFAULT CURRENT_DATE,
  mode text NOT NULL CHECK (mode IN ('cash', 'bank', 'upi', 'cheque', 'lc')),
  reference text,
  note text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payments_org_receipt_no UNIQUE (org_id, receipt_no)
);

CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_order ON payments(org_id, order_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_buyer ON payments(org_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_received ON payments(org_id, received_on DESC);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

-- Org members read receipts so order balances are right for sales too; Plant (operations)
-- reads no money (amendment A6, SEC2-10). NULL role (postgres: seeds, tests) is not Plant.
DROP POLICY IF EXISTS payments_select ON payments;
CREATE POLICY payments_select ON payments FOR SELECT
  USING (org_id = fn_current_org() AND fn_user_role() IS DISTINCT FROM 'operations');

DROP TRIGGER IF EXISTS trg_audit_payments ON payments;
CREATE TRIGGER trg_audit_payments AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

--------------------------------------------------------------------------------
-- 5. fn_quote_accept (contracts 4.4): sent quote -> order + PI, items, inquiry won
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_quote_accept(p_quote_id uuid, p_ship_by date, p_advance_pct integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_quote quotations%ROWTYPE;
  v_country text;
  v_order_id uuid;
  v_items integer;
  v_advance numeric(14,2);
BEGIN
  PERFORM fn_require_module('quotes');                                   -- raises 42501

  IF p_advance_pct IS NULL OR p_advance_pct < 0 OR p_advance_pct > 100 THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'advance_pct';
  END IF;

  SELECT * INTO v_quote FROM quotations WHERE id = p_quote_id AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';                 -- same code as no access
  END IF;

  IF v_quote.status = 'expired' OR (v_quote.status = 'sent' AND v_quote.valid_till < CURRENT_DATE) THEN
    RAISE EXCEPTION 'quote_expired' USING ERRCODE = 'P0001', DETAIL = v_quote.valid_till::text;
  END IF;

  IF v_quote.status <> 'sent' THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001', DETAIL = v_quote.status || ' -> accepted';
  END IF;

  SELECT count(*) INTO v_items FROM quotation_items WHERE quotation_id = v_quote.id;
  IF v_items = 0 THEN
    RAISE EXCEPTION 'no_items' USING ERRCODE = 'P0001';
  END IF;

  SELECT country INTO v_country FROM buyers WHERE id = v_quote.buyer_id AND org_id = v_org;
  v_advance := round(v_quote.total * p_advance_pct / 100, 2);

  INSERT INTO orders (
    org_id, order_code, pi_no, quotation_id, inquiry_id, buyer_id, currency, fx_rate, incoterm,
    payment_terms, total, advance_expected, expected_dispatch, status, status_changed_at, step_dates, created_by
  )
  VALUES (
    v_org, fn_next_code('ORD'), fn_next_doc_no('PI'), v_quote.id, v_quote.inquiry_id, v_quote.buyer_id,
    v_quote.currency, v_quote.fx_rate, v_quote.incoterm, v_quote.payment_terms, v_quote.total, v_advance,
    COALESCE(p_ship_by, CURRENT_DATE + CASE WHEN COALESCE(v_country, 'India') = 'India' THEN 7 ELSE 21 END),
    'confirmed', now(), jsonb_build_object('confirmed', CURRENT_DATE), auth.uid()
  )
  RETURNING id INTO v_order_id;

  INSERT INTO order_items (
    org_id, order_id, product_id, packaging_type_id, qty_kg, unit, rate, amount, gst_rate, spec_text, sort_order
  )
  SELECT v_org, v_order_id, qi.product_id, qi.packaging_type_id, qi.qty_kg, qi.unit, qi.rate, qi.amount,
         qi.gst_rate, qi.spec_text, qi.sort_order
  FROM quotation_items qi
  WHERE qi.quotation_id = v_quote.id
  ORDER BY qi.sort_order, qi.created_at;

  UPDATE quotations
  SET status = 'accepted', decided_at = now(), updated_at = now()
  WHERE id = v_quote.id;

  IF v_quote.inquiry_id IS NOT NULL THEN
    UPDATE inquiries
    SET status = 'won', closed_at = now(), lost_reason = NULL, updated_at = now()
    WHERE id = v_quote.inquiry_id AND org_id = v_org;
  END IF;

  -- The quote's reminders ("expires tomorrow") are answered now.
  UPDATE follow_ups
  SET done = true, done_at = now(), done_by = auth.uid(), updated_at = now()
  WHERE org_id = v_org AND entity_type = 'quote' AND entity_id = v_quote.id AND done = false;

  -- Money reminders (advance, balance, BL-received) are entity 'payment' with entity_id = order id:
  -- only payments-module holders see them, never Plant (A6 / G3-03); Home still links to the order.
  IF v_advance > 0 THEN
    INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, created_by)
    VALUES (
      v_org, 'payment', v_order_id, v_quote.buyer_id,
      'Advance ' || fn_format_money(v_advance, v_quote.currency) || ' due - check bank',
      CURRENT_DATE + 3, false, auth.uid()
    );
  END IF;

  RETURN v_order_id;
END;
$$;
REVOKE ALL ON FUNCTION fn_quote_accept(uuid, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_quote_accept(uuid, date, integer) TO authenticated;

--------------------------------------------------------------------------------
-- 6. fn_order_set_status (contracts 4.4): forward only
--------------------------------------------------------------------------------
--   confirmed     -> in_production (advance guard is UI-only)
--   in_production -> ready
--   confirmed | in_production | ready -> cancelled (owner only)
--   dispatched / delivered are set only by the dispatch functions.

CREATE OR REPLACE FUNCTION fn_order_set_status(p_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_row orders%ROWTYPE;
  v_allowed boolean;
BEGIN
  PERFORM fn_require_module('orders');                                   -- raises 42501

  IF p_status IS NULL
     OR p_status NOT IN ('confirmed', 'in_production', 'ready', 'dispatched', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'status';
  END IF;

  SELECT * INTO v_row FROM orders WHERE id = p_id AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;

  v_allowed := CASE
    WHEN v_row.status = 'confirmed' AND p_status = 'in_production' THEN true
    WHEN v_row.status = 'in_production' AND p_status = 'ready' THEN true
    WHEN v_row.status IN ('confirmed', 'in_production', 'ready') AND p_status = 'cancelled' THEN true
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001', DETAIL = v_row.status || ' -> ' || p_status;
  END IF;

  IF p_status = 'cancelled' AND COALESCE(fn_user_role(), '') <> 'owner' THEN
    RAISE EXCEPTION 'role_not_allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE orders
  SET status = p_status, status_changed_at = now(), updated_at = now(),
      step_dates = CASE WHEN p_status = 'cancelled' THEN step_dates
                        ELSE step_dates || jsonb_build_object(p_status, CURRENT_DATE) END
  WHERE id = v_row.id;

  IF p_status = 'cancelled' THEN
    UPDATE follow_ups
    SET done = true, done_at = now(), done_by = auth.uid(), updated_at = now()
    WHERE org_id = v_org AND entity_type IN ('order', 'payment') AND entity_id = v_row.id AND done = false;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION fn_order_set_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_order_set_status(uuid, text) TO authenticated;

--------------------------------------------------------------------------------
-- 7. fn_order_set_packed (contracts 4.4): in_production -> ready with the bag count
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_order_set_packed(p_order_id uuid, p_packed_bags integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_row orders%ROWTYPE;
BEGIN
  PERFORM fn_require_module('orders');                                   -- raises 42501

  IF p_packed_bags IS NULL OR p_packed_bags <= 0 THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'packed_bags';
  END IF;

  SELECT * INTO v_row FROM orders WHERE id = p_order_id AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;

  IF v_row.status <> 'in_production' THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001', DETAIL = v_row.status || ' -> ready';
  END IF;

  UPDATE orders
  SET packed_bags = p_packed_bags, status = 'ready', status_changed_at = now(), updated_at = now(),
      step_dates = step_dates || jsonb_build_object('ready', CURRENT_DATE)
  WHERE id = v_row.id;
END;
$$;
REVOKE ALL ON FUNCTION fn_order_set_packed(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_order_set_packed(uuid, integer) TO authenticated;

--------------------------------------------------------------------------------
-- 8. fn_order_dispatch (contracts 4.4): ready -> dispatched, INV + SDN numbers
--------------------------------------------------------------------------------
-- The supervisor's "Loaded" short form and the office form both call this.

CREATE OR REPLACE FUNCTION fn_order_dispatch(
  p_order_id uuid,
  p_mode text,
  p_vehicle_no text,
  p_lr_no text,
  p_transporter text,
  p_bags integer,
  p_qty_kg numeric,
  p_container_no text,
  p_port text,
  p_vessel text,
  p_stuffing_date date,
  p_eta date,
  p_dispatched_on date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_row orders%ROWTYPE;
  v_on date := COALESCE(p_dispatched_on, CURRENT_DATE);
  v_order_qty numeric;
  v_remaining numeric;
  v_left numeric;
  v_take numeric;
  v_item record;
  v_bags integer;
  v_checklist jsonb := '{}'::jsonb;
  v_dispatch_id uuid;
  v_received numeric;
  v_due numeric;
  v_credit integer;
BEGIN
  PERFORM fn_require_module('orders');                                   -- raises 42501

  SELECT * INTO v_row FROM orders WHERE id = p_order_id AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;

  IF v_row.status <> 'ready' THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001', DETAIL = v_row.status || ' -> dispatched';
  END IF;

  IF p_mode IS NULL OR p_mode NOT IN ('truck', 'container') THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'mode';
  END IF;
  IF p_mode = 'truck' AND NULLIF(btrim(p_vehicle_no), '') IS NULL THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'vehicle_no';
  END IF;
  IF p_mode = 'container' AND NULLIF(btrim(p_container_no), '') IS NULL THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'container_no';
  END IF;
  IF p_mode = 'container' AND NULLIF(btrim(p_port), '') IS NULL THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'port';
  END IF;

  SELECT COALESCE(sum(qty_kg), 0), COALESCE(sum(qty_kg - dispatched_kg), 0)
  INTO v_order_qty, v_remaining
  FROM order_items WHERE order_id = v_row.id AND org_id = v_org;

  IF p_qty_kg IS NULL OR p_qty_kg <= 0 OR p_qty_kg > v_remaining OR v_order_qty <= 0 THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'qty_kg';
  END IF;

  v_bags := COALESCE(p_bags, v_row.packed_bags, 0);
  IF v_bags < 0 THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'bags';
  END IF;

  IF p_mode = 'container' THEN
    v_checklist := jsonb_build_object(
      'container_booked',     jsonb_build_object('done', false, 'date', NULL),
      'stuffing_done',        jsonb_build_object('done', true,  'date', v_on),
      'coa',                  jsonb_build_object('done', false, 'date', NULL),
      'phyto',                jsonb_build_object('done', false, 'date', NULL),
      'coo',                  jsonb_build_object('done', false, 'date', NULL),
      'fumigation',           jsonb_build_object('done', false, 'date', NULL),
      'invoice_packing_list', jsonb_build_object('done', true,  'date', v_on),
      'bl_received',          jsonb_build_object('done', false, 'date', NULL)
    );
  END IF;

  INSERT INTO dispatches (
    org_id, order_id, sdn_no, invoice_no, dispatched_on, mode, vehicle_no, lr_no, transporter,
    bags_count, qty_kg, invoice_total, status, container_no, port, vessel, stuffing_date, eta,
    export_checklist, notes, created_by
  )
  VALUES (
    v_org, v_row.id, fn_next_doc_no('SDN'), fn_next_doc_no('INV'), v_on, p_mode,
    NULLIF(upper(btrim(p_vehicle_no)), ''), NULLIF(btrim(p_lr_no), ''), NULLIF(btrim(p_transporter), ''),
    v_bags, p_qty_kg, round(v_row.total * p_qty_kg / v_order_qty, 2), 'dispatched',
    CASE WHEN p_mode = 'container' THEN NULLIF(upper(btrim(p_container_no)), '') END,
    CASE WHEN p_mode = 'container' THEN NULLIF(btrim(p_port), '') END,
    CASE WHEN p_mode = 'container' THEN NULLIF(btrim(p_vessel), '') END,
    CASE WHEN p_mode = 'container' THEN COALESCE(p_stuffing_date, v_on) END,
    CASE WHEN p_mode = 'container' THEN p_eta END,
    v_checklist, NULLIF(btrim(p_notes), ''), auth.uid()
  )
  RETURNING id INTO v_dispatch_id;

  -- Spread the dispatched kilograms over the items in sort order.
  v_left := p_qty_kg;
  FOR v_item IN
    SELECT id, qty_kg - dispatched_kg AS open_kg
    FROM order_items
    WHERE order_id = v_row.id AND org_id = v_org AND qty_kg > dispatched_kg
    ORDER BY sort_order, created_at, id
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := LEAST(v_item.open_kg, v_left);
    UPDATE order_items SET dispatched_kg = dispatched_kg + v_take, updated_at = now() WHERE id = v_item.id;
    v_left := v_left - v_take;
  END LOOP;

  UPDATE orders
  SET status = 'dispatched', status_changed_at = now(), updated_at = now(),
      step_dates = step_dates || jsonb_build_object('dispatched', v_on)
  WHERE id = v_row.id;

  -- Balance reminder on the due date (dispatch date + the buyer's credit days).
  SELECT COALESCE(sum(amount), 0) INTO v_received FROM payments WHERE order_id = v_row.id AND org_id = v_org;
  v_due := v_row.total - v_received;
  IF v_due > 0 THEN
    SELECT COALESCE(credit_period_days, 0) INTO v_credit FROM buyers WHERE id = v_row.buyer_id AND org_id = v_org;
    INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, created_by)
    VALUES (
      v_org, 'payment', v_row.id, v_row.buyer_id,
      'Balance ' || fn_format_money(v_due, v_row.currency) || ' due',
      v_on + COALESCE(v_credit, 0), false, auth.uid()
    );
  END IF;

  RETURN v_dispatch_id;
END;
$$;
REVOKE ALL ON FUNCTION fn_order_dispatch(uuid, text, text, text, text, integer, numeric, text, text, text, date, date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_order_dispatch(uuid, text, text, text, text, integer, numeric, text, text, text, date, date, date, text) TO authenticated;

--------------------------------------------------------------------------------
-- 9. fn_dispatch_tick (contracts 4.4): one export checklist item
--------------------------------------------------------------------------------
-- Plant may tick only stuffing_done and coa; Untick only owner / accountant;
-- bl_received needs the BL number and adds a follow-up due today.

CREATE OR REPLACE FUNCTION fn_dispatch_tick(
  p_dispatch_id uuid,
  p_key text,
  p_done boolean,
  p_on_date date DEFAULT CURRENT_DATE,
  p_bl_no text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_row dispatches%ROWTYPE;
  v_role text := COALESCE(fn_user_role(), '');
  v_buyer uuid;
BEGIN
  PERFORM fn_require_module('orders');                                   -- raises 42501

  SELECT * INTO v_row FROM dispatches WHERE id = p_dispatch_id AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;

  IF v_row.mode <> 'container' THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'mode';
  END IF;

  IF p_key IS NULL OR p_key NOT IN (
       'container_booked', 'stuffing_done', 'coa', 'phyto', 'coo', 'fumigation',
       'invoice_packing_list', 'bl_received') THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'key';
  END IF;

  IF p_done IS NULL THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'done';
  END IF;

  IF v_role = 'operations' AND p_key NOT IN ('stuffing_done', 'coa') THEN
    RAISE EXCEPTION 'role_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF NOT p_done AND v_role NOT IN ('owner', 'accountant') THEN
    RAISE EXCEPTION 'role_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_key = 'bl_received' AND p_done AND NULLIF(btrim(p_bl_no), '') IS NULL THEN
    RAISE EXCEPTION 'bl_required' USING ERRCODE = 'P0001';
  END IF;

  UPDATE dispatches
  SET export_checklist = export_checklist || jsonb_build_object(
        p_key,
        jsonb_build_object('done', p_done, 'date', CASE WHEN p_done THEN COALESCE(p_on_date, CURRENT_DATE) END)
      ),
      bl_no = CASE WHEN p_key = 'bl_received' AND p_done THEN btrim(p_bl_no) ELSE bl_no END,
      updated_at = now()
  WHERE id = v_row.id;

  IF p_key = 'bl_received' AND p_done THEN
    SELECT buyer_id INTO v_buyer FROM orders WHERE id = v_row.order_id AND org_id = v_org;
    INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, created_by)
    VALUES (
      v_org, 'payment', v_row.order_id, v_buyer,
      'BL received - send copy and ask for balance', CURRENT_DATE, false, auth.uid()
    );
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION fn_dispatch_tick(uuid, text, boolean, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_dispatch_tick(uuid, text, boolean, date, text) TO authenticated;

--------------------------------------------------------------------------------
-- 10. fn_dispatch_delivered (contracts 4.4): dispatched -> delivered (not Plant)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_dispatch_delivered(p_id uuid, p_delivered_on date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_row dispatches%ROWTYPE;
  v_open_items integer;
  v_open_dispatches integer;
BEGIN
  PERFORM fn_require_module('orders');                                   -- raises 42501

  SELECT * INTO v_row FROM dispatches WHERE id = p_id AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(fn_user_role(), '') = 'operations' THEN
    RAISE EXCEPTION 'role_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_row.status <> 'dispatched' THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001', DETAIL = v_row.status || ' -> delivered';
  END IF;

  UPDATE dispatches
  SET status = 'delivered', delivered_on = COALESCE(p_delivered_on, CURRENT_DATE), updated_at = now()
  WHERE id = v_row.id;

  SELECT count(*) INTO v_open_items
  FROM order_items WHERE order_id = v_row.order_id AND org_id = v_org AND dispatched_kg < qty_kg;
  SELECT count(*) INTO v_open_dispatches
  FROM dispatches WHERE order_id = v_row.order_id AND org_id = v_org AND status <> 'delivered';

  IF v_open_items = 0 AND v_open_dispatches = 0 THEN
    UPDATE orders
    SET status = 'delivered', status_changed_at = now(), updated_at = now(),
        step_dates = step_dates || jsonb_build_object('delivered', COALESCE(p_delivered_on, CURRENT_DATE))
    WHERE id = v_row.order_id AND org_id = v_org AND status = 'dispatched';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION fn_dispatch_delivered(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_dispatch_delivered(uuid, date) TO authenticated;

--------------------------------------------------------------------------------
-- 11. fn_payment_record (contracts 4.4): money received -> REC number
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_payment_record(
  p_order_id uuid,
  p_amount numeric,
  p_received_on date,
  p_mode text,
  p_reference text DEFAULT NULL,
  p_amount_inr numeric DEFAULT NULL,
  p_fx_rate numeric DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_row orders%ROWTYPE;
  v_amount_inr numeric(14,2);
  v_fx numeric(10,4);
  v_payment_id uuid;
  v_received numeric;
BEGIN
  PERFORM fn_require_module('payments');                                 -- raises 42501

  SELECT * INTO v_row FROM orders WHERE id = p_order_id AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;

  IF v_row.status = 'cancelled' THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001', DETAIL = 'cancelled';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'amount';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('cash', 'bank', 'upi', 'cheque', 'lc') THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'mode';
  END IF;

  -- Amendment A8 (SEC2-08): no receipt dated in the future; non-owners may not record more
  -- than 110% of what is still due on the order (order currency). The owner may.
  IF p_received_on > CURRENT_DATE THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'received_on';
  END IF;
  SELECT COALESCE(sum(amount), 0) INTO v_received FROM payments WHERE order_id = v_row.id AND org_id = v_org;
  IF COALESCE(fn_user_role(), '') <> 'owner' AND p_amount > GREATEST(v_row.total - v_received, 0) * 1.1 THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'over_payment';
  END IF;

  IF v_row.currency <> 'INR' THEN
    IF p_amount_inr IS NULL OR p_amount_inr <= 0 THEN
      RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'amount_inr';
    END IF;
    IF p_fx_rate IS NOT NULL AND p_fx_rate <= 0 THEN
      RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'fx_rate';
    END IF;
    v_amount_inr := round(p_amount_inr, 2);
    v_fx := COALESCE(p_fx_rate, round(p_amount_inr / p_amount, 4));
  END IF;

  INSERT INTO payments (
    org_id, receipt_no, order_id, buyer_id, amount, currency, amount_inr, fx_rate,
    received_on, mode, reference, note, created_by
  )
  VALUES (
    v_org, fn_next_doc_no('REC'), v_row.id, v_row.buyer_id, p_amount, v_row.currency, v_amount_inr, v_fx,
    COALESCE(p_received_on, CURRENT_DATE), p_mode, NULLIF(btrim(p_reference), ''), NULLIF(btrim(p_note), ''),
    auth.uid()
  )
  RETURNING id INTO v_payment_id;

  SELECT COALESCE(sum(amount), 0) INTO v_received FROM payments WHERE order_id = v_row.id AND org_id = v_org;

  IF v_received >= v_row.advance_expected THEN
    UPDATE follow_ups
    SET done = true, done_at = now(), done_by = auth.uid(), updated_at = now()
    WHERE org_id = v_org AND entity_type IN ('order', 'payment') AND entity_id = v_row.id AND done = false
      AND note LIKE 'Advance %';
  END IF;

  IF v_row.total - v_received <= 0 THEN
    UPDATE follow_ups
    SET done = true, done_at = now(), done_by = auth.uid(), updated_at = now()
    WHERE org_id = v_org AND entity_type IN ('order', 'payment') AND entity_id = v_row.id AND done = false;
  END IF;

  RETURN v_payment_id;
END;
$$;
REVOKE ALL ON FUNCTION fn_payment_record(uuid, numeric, date, text, text, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_payment_record(uuid, numeric, date, text, text, numeric, numeric, text) TO authenticated;

--------------------------------------------------------------------------------
-- 11b. fn_order_advance_waiting: the packing card's "Wait for advance" guard (screens.md 16B)
--------------------------------------------------------------------------------
-- Plant reads no payments (A6), but its packing card must still know whether the advance has
-- come. This answers yes / no for one order of the caller's org and shows no amount.

CREATE OR REPLACE FUNCTION fn_order_advance_waiting(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_advance numeric;
  v_received numeric;
BEGIN
  PERFORM fn_require_module('orders');                                   -- raises 42501

  SELECT advance_expected INTO v_advance FROM orders WHERE id = p_order_id AND org_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_received FROM payments WHERE order_id = p_order_id AND org_id = v_org;
  RETURN COALESCE(v_advance, 0) > 0 AND v_received < v_advance;
END;
$$;
REVOKE ALL ON FUNCTION fn_order_advance_waiting(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_order_advance_waiting(uuid) TO authenticated;

--------------------------------------------------------------------------------
-- 12. Views (security_invoker: RLS of the base tables applies)
--------------------------------------------------------------------------------

-- 12a. Open orders for the Orders "Open" chip, Plant Home "Packing today" and the packing card (5.3)
CREATE OR REPLACE VIEW v_orders_in_production WITH (security_invoker = true) AS
SELECT
  o.id,
  o.org_id,
  o.order_code,
  o.pi_no,
  o.buyer_id,
  b.company_name AS buyer_name,
  b.city,
  b.country,
  o.status,
  o.status_changed_at,
  o.currency,
  o.total,
  o.advance_expected,
  COALESCE(it.planned_bags, 0) AS planned_bags,
  COALESCE(it.bag_kg, 25) AS bag_kg,
  o.packed_bags,
  o.expected_dispatch,
  o.packing_note,
  it.product_summary,
  COALESCE(it.qty_kg, 0) AS qty_kg,
  (CURRENT_DATE - o.created_at::date) AS days_since_confirmed
FROM orders o
JOIN buyers b ON b.id = o.buyer_id
LEFT JOIN LATERAL (
  SELECT
    sum(ceil(oi.qty_kg / COALESCE(pt.capacity_kg, 25)))::integer AS planned_bags,
    (array_agg(COALESCE(pt.capacity_kg, 25) ORDER BY oi.sort_order, oi.created_at))[1] AS bag_kg,
    string_agg(p.name, ', ' ORDER BY oi.sort_order, oi.created_at) AS product_summary,
    sum(oi.qty_kg) AS qty_kg
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  LEFT JOIN packaging_types pt ON pt.id = oi.packaging_type_id
  WHERE oi.order_id = o.id
) it ON true
WHERE o.status IN ('confirmed', 'in_production', 'ready');

-- 12b. Money per order (5.4): paid / due (Waiting) / overdue (Late)
CREATE OR REPLACE VIEW v_order_balances WITH (security_invoker = true) AS
SELECT
  x.order_id,
  x.org_id,
  x.order_code,
  x.pi_no,
  x.buyer_id,
  x.buyer_name,
  x.order_status,
  x.currency,
  x.fx_rate,
  x.total,
  x.advance_expected,
  x.received,
  x.received_inr,
  x.last_received_on,
  x.due,
  (x.received >= x.advance_expected) AS advance_ok,
  x.latest_dispatch_on,
  x.credit_days,
  x.due_date,
  CASE WHEN x.due > 0 AND x.due_date IS NOT NULL THEN GREATEST(CURRENT_DATE - x.due_date, 0) ELSE 0 END AS days_overdue,
  CASE
    WHEN x.due = 0 THEN 'paid'
    WHEN x.due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'due'
  END AS money_status,
  x.payment_terms,
  x.phone,
  x.latest_invoice_no,
  x.created_at
-- Plant reads no money (A6): no rows, so v_money_due is empty and v_home_kpis money is 0.
FROM (
  SELECT
    o.id AS order_id,
    o.org_id,
    o.order_code,
    o.pi_no,
    o.buyer_id,
    b.company_name AS buyer_name,
    o.status AS order_status,
    o.currency,
    o.fx_rate,
    o.total,
    o.advance_expected,
    COALESCE(pay.received, 0)::numeric(14,2) AS received,
    pay.received_inr,
    pay.last_received_on,
    GREATEST(o.total - COALESCE(pay.received, 0), 0)::numeric(14,2) AS due,
    d.latest_dispatch_on,
    b.credit_period_days AS credit_days,
    (d.latest_dispatch_on + b.credit_period_days) AS due_date,
    o.payment_terms,
    bc.phone,
    d.latest_invoice_no,
    o.created_at
  FROM orders o
  JOIN buyers b ON b.id = o.buyer_id
  LEFT JOIN LATERAL (
    SELECT sum(p.amount) AS received, sum(p.amount_inr) AS received_inr, max(p.received_on) AS last_received_on
    FROM payments p
    WHERE p.order_id = o.id
  ) pay ON true
  LEFT JOIN LATERAL (
    SELECT dd.dispatched_on AS latest_dispatch_on, dd.invoice_no AS latest_invoice_no
    FROM dispatches dd
    WHERE dd.order_id = o.id
    ORDER BY dd.dispatched_on DESC, dd.created_at DESC
    LIMIT 1
  ) d ON true
  LEFT JOIN LATERAL (
    SELECT c.phone
    FROM buyer_contacts c
    WHERE c.buyer_id = b.id
    ORDER BY c.is_primary DESC, c.created_at
    LIMIT 1
  ) bc ON true
  WHERE o.status <> 'cancelled'
    AND fn_user_role() IS DISTINCT FROM 'operations'
) x;

-- 12c. Money due per buyer and currency (5.5)
CREATE OR REPLACE VIEW v_money_due WITH (security_invoker = true) AS
SELECT
  ob.org_id,
  ob.buyer_id,
  ob.buyer_name,
  max(ob.phone) AS phone,
  ob.currency,
  sum(ob.due)::numeric(14,2) AS total_due,
  count(*)::integer AS orders_due,
  max(ob.days_overdue)::integer AS max_days_overdue,
  min(ob.due_date) AS oldest_due_date,
  CASE WHEN bool_or(ob.money_status = 'overdue') THEN 'overdue' ELSE 'due' END AS money_status
FROM v_order_balances ob
WHERE ob.due > 0
GROUP BY ob.org_id, ob.buyer_id, ob.buyer_name, ob.currency;

-- 12d. Home numbers (5.6): always exactly one row for the caller's org (RLS on organizations).
--      The money columns read v_order_balances, so they are 0 for Plant (A6).
CREATE OR REPLACE VIEW v_home_kpis WITH (security_invoker = true) AS
SELECT
  k.org_id,
  k.new_inquiries,
  k.quotes_waiting,
  k.orders_in_production,
  k.money_due_inr,
  k.money_due_usd,
  (k.money_due_inr + k.money_due_usd * k.usd_rate)::numeric(14,2) AS money_due_about_inr,
  k.money_overdue_count,
  k.followups_today,
  k.papers_pending
FROM (
  SELECT
    o.id AS org_id,
    (SELECT count(*) FROM inquiries i WHERE i.org_id = o.id AND i.status = 'new')::integer AS new_inquiries,
    (SELECT count(*) FROM quotations q
      WHERE q.org_id = o.id AND q.status = 'sent' AND q.valid_till >= CURRENT_DATE)::integer AS quotes_waiting,
    (SELECT count(*) FROM orders x
      WHERE x.org_id = o.id AND x.status IN ('confirmed', 'in_production', 'ready'))::integer AS orders_in_production,
    COALESCE((SELECT sum(ob.due) FROM v_order_balances ob
      WHERE ob.org_id = o.id AND ob.currency = 'INR'), 0)::numeric(14,2) AS money_due_inr,
    COALESCE((SELECT sum(ob.due) FROM v_order_balances ob
      WHERE ob.org_id = o.id AND ob.currency = 'USD'), 0)::numeric(14,2) AS money_due_usd,
    COALESCE((SELECT (s.settings -> 'currency_rates' ->> 'USD')::numeric
      FROM app_settings s WHERE s.org_id = o.id LIMIT 1), 0) AS usd_rate,
    (SELECT count(*) FROM v_order_balances ob
      WHERE ob.org_id = o.id AND ob.money_status = 'overdue')::integer AS money_overdue_count,
    (SELECT count(*) FROM follow_ups f
      WHERE f.org_id = o.id AND f.done = false AND f.due_on <= CURRENT_DATE)::integer AS followups_today,
    (SELECT count(*) FROM dispatches d
      WHERE d.org_id = o.id AND d.mode = 'container'
        AND (SELECT count(*) FROM jsonb_each(d.export_checklist) e
              WHERE jsonb_typeof(e.value) = 'object' AND (e.value ->> 'done') = 'true') < 8
    )::integer AS papers_pending
  FROM organizations o
) k;

--------------------------------------------------------------------------------
-- 13. Grants: function-only tables and read-only views (contracts 2.2)
--------------------------------------------------------------------------------
-- 0003 re-grants SELECT / INSERT / UPDATE / DELETE on every table each run and its
-- default privileges hand them to new tables; this block always runs after it.

GRANT SELECT ON orders, order_items, dispatches, payments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON orders FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON order_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON dispatches FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON payments FROM authenticated;

REVOKE INSERT, UPDATE, DELETE ON v_orders_in_production FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON v_order_balances FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON v_money_due FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON v_home_kpis FROM authenticated;

-- Supabase: anon gets nothing on these (guarded: the role does not exist on plain Postgres).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON orders, order_items, dispatches, payments FROM anon';
    EXECUTE 'REVOKE ALL ON v_orders_in_production, v_order_balances, v_money_due, v_home_kpis FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION fn_quote_accept(uuid, date, integer), fn_order_set_status(uuid, text), '
         || 'fn_order_set_packed(uuid, integer), '
         || 'fn_order_dispatch(uuid, text, text, text, text, integer, numeric, text, text, text, date, date, date, text), '
         || 'fn_dispatch_tick(uuid, text, boolean, date, text), fn_dispatch_delivered(uuid, date), '
         || 'fn_payment_record(uuid, numeric, date, text, text, numeric, numeric, text), '
         || 'fn_order_advance_waiting(uuid) FROM anon';
  END IF;
END $$;
