-- Migration 0005: Samples, Quotations, Quotation items (Dev-2, Sprint B)
-- Spec: docs/design/contracts.md 3.3 / 3.4 / 3.5 / 4.3 (+ section 11 amendments).
-- Depends on 0004 (inquiries, follow_ups) for the FK on inquiry_id and the side effects.
--
-- * Idempotent (CREATE IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS): seed.ts and
--   the tests re-run every migration. 0003 re-grants full UPDATE on every table on each run,
--   so the column-level locks below are re-applied here (this file always runs after 0003).
-- * Error codes (contracts 2.3 / A4): not_found, role_not_allowed -> 42501;
--   invalid_transition, no_items, below_floor_price, reason_required, bad_payload -> P0001.
-- * Status columns change only inside the SECURITY DEFINER functions (column-level grants).
-- * Rows point only at parents of their own org (buyer, product, packaging, inquiry, quote):
--   the write policies check it, since a plain FK accepts another org's id (G2-03).
-- * Sprint C (contracts section 12):
--     - A9 (G2-05, SEC2-05, SEC2-11): samples start as to_send (decided_on NULL), quotations
--       as draft (sent_at / decided_at / reject_reason NULL), both in the caller's name
--       (created_by NULL or auth.uid()). Samples are deleted only while to_send. A new
--       quotation's totals come from its items (trigger), never from the insert.
--     - SEC2-06: a foreign id and a random id give the same refusal everywhere (RLS 42501 on
--       samples / quotations, item guard not_found / bad_payload on quotation_items); the
--       item guard looks a quote up only in the caller's org, so no floor, GST or quote of
--       another org can be read through its errors.
--     - SEC2-07: owner checks are NULL-safe (a web session with no role is not the owner).
--     - G2-13: fn_sample_create inserts a sample and, when asked, marks it sent in one call.

--------------------------------------------------------------------------------
-- 1. samples (module samples)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  inquiry_id uuid REFERENCES inquiries(id) ON DELETE SET NULL,
  buyer_id uuid NOT NULL REFERENCES buyers(id),
  product_id uuid NOT NULL REFERENCES products(id),
  qty_grams integer NOT NULL DEFAULT 500 CHECK (qty_grams > 0),
  lot_no text,
  courier text,
  tracking_no text,
  sent_on date,
  status text NOT NULL DEFAULT 'to_send' CHECK (status IN ('to_send', 'sent', 'approved', 'rejected')),
  result_note text,
  decided_on date,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_samples_org_code UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_samples_org_id ON samples(org_id);
CREATE INDEX IF NOT EXISTS idx_samples_org_inquiry ON samples(org_id, inquiry_id);
CREATE INDEX IF NOT EXISTS idx_samples_org_buyer ON samples(org_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_samples_org_status ON samples(org_id, status);

ALTER TABLE samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE samples FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS samples_select ON samples;
CREATE POLICY samples_select ON samples FOR SELECT USING (org_id = fn_current_org());
DROP POLICY IF EXISTS samples_insert ON samples;
CREATE POLICY samples_insert ON samples
  FOR INSERT WITH CHECK (
    org_id = fn_current_org() AND fn_has_module('samples')
    -- A9: a new sample is still to be sent, has no result date and is written in the caller's name
    AND samples.status = 'to_send' AND samples.decided_on IS NULL
    AND (samples.created_by IS NULL OR samples.created_by = auth.uid())
    AND EXISTS (SELECT 1 FROM buyers b WHERE b.id = samples.buyer_id AND b.org_id = fn_current_org())
    AND EXISTS (SELECT 1 FROM products p WHERE p.id = samples.product_id AND p.org_id = fn_current_org())
    AND (samples.inquiry_id IS NULL
         OR EXISTS (SELECT 1 FROM inquiries i WHERE i.id = samples.inquiry_id AND i.org_id = fn_current_org()))
  );
DROP POLICY IF EXISTS samples_update ON samples;
CREATE POLICY samples_update ON samples
  FOR UPDATE
  USING (org_id = fn_current_org() AND fn_has_module('samples'))
  WITH CHECK (
    org_id = fn_current_org() AND fn_has_module('samples')
    AND EXISTS (SELECT 1 FROM buyers b WHERE b.id = samples.buyer_id AND b.org_id = fn_current_org())
    AND EXISTS (SELECT 1 FROM products p WHERE p.id = samples.product_id AND p.org_id = fn_current_org())
    AND (samples.inquiry_id IS NULL
         OR EXISTS (SELECT 1 FROM inquiries i WHERE i.id = samples.inquiry_id AND i.org_id = fn_current_org()))
  );
DROP POLICY IF EXISTS samples_delete ON samples;
-- A9 / G2-05: a sample that went out (sent / approved / rejected) is history and stays.
CREATE POLICY samples_delete ON samples
  FOR DELETE USING (org_id = fn_current_org() AND fn_has_module('samples') AND status = 'to_send');

-- Column-level lock (contracts 3.3): status / result_note / decided_on only via fn_sample_set_status.
GRANT SELECT, INSERT, DELETE ON samples TO authenticated;
REVOKE UPDATE ON samples FROM authenticated;
GRANT UPDATE (inquiry_id, buyer_id, product_id, qty_grams, lot_no, courier, tracking_no, sent_on, updated_at)
  ON samples TO authenticated;

DROP TRIGGER IF EXISTS trg_samples_code ON samples;
CREATE TRIGGER trg_samples_code BEFORE INSERT ON samples
  FOR EACH ROW EXECUTE FUNCTION fn_assign_code('SMP', 'code');

DROP TRIGGER IF EXISTS trg_audit_samples ON samples;
CREATE TRIGGER trg_audit_samples AFTER INSERT OR UPDATE OR DELETE ON samples
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

--------------------------------------------------------------------------------
-- 2. quotations (module quotes; editable only while draft)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quote_no text NOT NULL,
  inquiry_id uuid REFERENCES inquiries(id) ON DELETE SET NULL,
  buyer_id uuid NOT NULL REFERENCES buyers(id),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(10,4),
  incoterm text NOT NULL DEFAULT 'EXW' CHECK (incoterm IN ('EXW', 'FOB Pipavav', 'FOB Mundra', 'CIF')),
  valid_till date NOT NULL DEFAULT CURRENT_DATE + 10,
  payment_terms text NOT NULL DEFAULT '100% against dispatch',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  gst_amount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  reject_reason text CHECK (reject_reason IS NULL OR reject_reason IN ('price', 'quality', 'timing', 'no_reply')),
  notes text,
  sent_at timestamptz,
  decided_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_quotations_org_quote_no UNIQUE (org_id, quote_no)
);

CREATE INDEX IF NOT EXISTS idx_quotations_org_id ON quotations(org_id);
CREATE INDEX IF NOT EXISTS idx_quotations_org_status ON quotations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_quotations_org_buyer ON quotations(org_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_org_inquiry ON quotations(org_id, inquiry_id);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotations_select ON quotations;
CREATE POLICY quotations_select ON quotations FOR SELECT USING (org_id = fn_current_org());
DROP POLICY IF EXISTS quotations_insert ON quotations;
CREATE POLICY quotations_insert ON quotations
  FOR INSERT WITH CHECK (
    org_id = fn_current_org() AND fn_has_module('quotes') AND status = 'draft'
    -- A9: never sent or decided at birth, written in the caller's name
    AND quotations.sent_at IS NULL AND quotations.decided_at IS NULL AND quotations.reject_reason IS NULL
    AND (quotations.created_by IS NULL OR quotations.created_by = auth.uid())
    AND EXISTS (SELECT 1 FROM buyers b WHERE b.id = quotations.buyer_id AND b.org_id = fn_current_org())
    AND (quotations.inquiry_id IS NULL
         OR EXISTS (SELECT 1 FROM inquiries i WHERE i.id = quotations.inquiry_id AND i.org_id = fn_current_org()))
  );
DROP POLICY IF EXISTS quotations_update ON quotations;
CREATE POLICY quotations_update ON quotations
  FOR UPDATE
  USING (org_id = fn_current_org() AND fn_has_module('quotes') AND status = 'draft')
  WITH CHECK (
    org_id = fn_current_org() AND status = 'draft'
    AND EXISTS (SELECT 1 FROM buyers b WHERE b.id = quotations.buyer_id AND b.org_id = fn_current_org())
    AND (quotations.inquiry_id IS NULL
         OR EXISTS (SELECT 1 FROM inquiries i WHERE i.id = quotations.inquiry_id AND i.org_id = fn_current_org()))
  );
DROP POLICY IF EXISTS quotations_delete ON quotations;
CREATE POLICY quotations_delete ON quotations
  FOR DELETE USING (org_id = fn_current_org() AND fn_has_module('quotes') AND status = 'draft');

-- Column-level lock (contracts 3.4): status, totals, sent_at, decided_at, reject_reason only via functions / triggers.
GRANT SELECT, INSERT, DELETE ON quotations TO authenticated;
REVOKE UPDATE ON quotations FROM authenticated;
GRANT UPDATE (inquiry_id, buyer_id, currency, fx_rate, incoterm, valid_till, payment_terms, notes, updated_at)
  ON quotations TO authenticated;

DROP TRIGGER IF EXISTS trg_quotations_doc_no ON quotations;
CREATE TRIGGER trg_quotations_doc_no BEFORE INSERT ON quotations
  FOR EACH ROW EXECUTE FUNCTION fn_assign_doc_no('QTN', 'quote_no');

DROP TRIGGER IF EXISTS trg_audit_quotations ON quotations;
CREATE TRIGGER trg_audit_quotations AFTER INSERT OR UPDATE OR DELETE ON quotations
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

--------------------------------------------------------------------------------
-- 3. quotation_items (writable only while the parent is draft)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  packaging_type_id uuid REFERENCES packaging_types(id) ON DELETE SET NULL,
  qty_kg numeric(12,2) NOT NULL CHECK (qty_kg > 0),
  unit text NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg', 'MT')),
  rate numeric(12,2) NOT NULL CHECK (rate > 0),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  floor_price_at_time numeric(12,2),
  gst_rate numeric(5,2) NOT NULL DEFAULT 5,
  spec_text text,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_org_id ON quotation_items(org_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_org_quotation ON quotation_items(org_id, quotation_id);

ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotation_items_select ON quotation_items;
CREATE POLICY quotation_items_select ON quotation_items FOR SELECT USING (org_id = fn_current_org());
DROP POLICY IF EXISTS quotation_items_insert ON quotation_items;
CREATE POLICY quotation_items_insert ON quotation_items
  FOR INSERT WITH CHECK (
    org_id = fn_current_org() AND fn_has_module('quotes')
    AND EXISTS (SELECT 1 FROM quotations q WHERE q.id = quotation_id AND q.org_id = fn_current_org() AND q.status = 'draft')
    AND EXISTS (SELECT 1 FROM products p WHERE p.id = quotation_items.product_id AND p.org_id = fn_current_org())
    AND (quotation_items.packaging_type_id IS NULL
         OR EXISTS (SELECT 1 FROM packaging_types pt WHERE pt.id = quotation_items.packaging_type_id AND pt.org_id = fn_current_org()))
  );
DROP POLICY IF EXISTS quotation_items_update ON quotation_items;
CREATE POLICY quotation_items_update ON quotation_items
  FOR UPDATE
  USING (
    org_id = fn_current_org() AND fn_has_module('quotes')
    AND EXISTS (SELECT 1 FROM quotations q WHERE q.id = quotation_id AND q.org_id = fn_current_org() AND q.status = 'draft')
  )
  WITH CHECK (
    org_id = fn_current_org() AND fn_has_module('quotes')
    AND EXISTS (SELECT 1 FROM quotations q WHERE q.id = quotation_id AND q.org_id = fn_current_org() AND q.status = 'draft')
    AND EXISTS (SELECT 1 FROM products p WHERE p.id = quotation_items.product_id AND p.org_id = fn_current_org())
    AND (quotation_items.packaging_type_id IS NULL
         OR EXISTS (SELECT 1 FROM packaging_types pt WHERE pt.id = quotation_items.packaging_type_id AND pt.org_id = fn_current_org()))
  );
DROP POLICY IF EXISTS quotation_items_delete ON quotation_items;
CREATE POLICY quotation_items_delete ON quotation_items
  FOR DELETE USING (
    org_id = fn_current_org() AND fn_has_module('quotes')
    AND EXISTS (SELECT 1 FROM quotations q WHERE q.id = quotation_id AND q.org_id = fn_current_org() AND q.status = 'draft')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON quotation_items TO authenticated;

DROP TRIGGER IF EXISTS trg_audit_quotation_items ON quotation_items;
CREATE TRIGGER trg_audit_quotation_items AFTER INSERT OR UPDATE OR DELETE ON quotation_items
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

--------------------------------------------------------------------------------
-- 4. Item guard: amount, gst_rate, floor_price_at_time; floor price wall (contracts 3.5)
--------------------------------------------------------------------------------
-- The floor comes from the active price_list_items row for the same org, product and the
-- parent quote's currency, preferring the item's unit. When the list only prices the product
-- in the other unit (INR per kg, USD per MT in the seed), the floor is converted (x / 1000)
-- so that picking the "wrong" unit never switches the guard off.
-- No price row for (product, currency) means no known floor: only the owner may quote it
-- (below_floor_price, DETAIL 'no_price'), so an unpriced currency such as EUR is no way
-- around the floor (G2-01 / SEC2-01). The product must belong to the quote's org.

CREATE OR REPLACE FUNCTION fn_quote_item_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote quotations%ROWTYPE;
  v_gst numeric(5,2);
  v_floor numeric(12,2);
  v_floor_unit text;
  -- A web session (PostgREST / tests SET ROLE authenticated or anon; see fn_current_org in
  -- 0003) versus a trusted script connected as postgres (seeds). Web sessions get the org
  -- scope and the floor wall even when their role reads NULL (SEC2-07).
  v_web boolean := COALESCE(NULLIF(NULLIF(current_setting('role', true), 'none'), ''), session_user::text)
                   IN ('authenticated', 'anon', 'authenticator');
BEGIN
  -- The parent quote in the row's org and, for a web session, in the caller's org. Another
  -- org's quote, a mismatched org_id and a random id all read 'not_found' (SEC2-06: no
  -- existence oracle, and no other org's floor or GST can reach an error message).
  SELECT * INTO v_quote FROM quotations q
  WHERE q.id = NEW.quotation_id
    AND q.org_id = NEW.org_id
    AND (NOT v_web OR q.org_id = fn_current_org());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;

  -- Amount: the rate is per kg or per MT; qty is always kilograms.
  IF NEW.unit = 'MT' THEN
    NEW.amount := round(NEW.qty_kg / 1000 * NEW.rate, 2);
  ELSE
    NEW.amount := round(NEW.qty_kg * NEW.rate, 2);
  END IF;

  -- Same-org product only (its floor and GST rate are looked up in the quote's org).
  SELECT p.gst_rate INTO v_gst FROM products p WHERE p.id = NEW.product_id AND p.org_id = v_quote.org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'product_id';
  END IF;

  -- GST only on rupee quotes.
  IF v_quote.currency = 'INR' THEN
    NEW.gst_rate := COALESCE(v_gst, 5);
  ELSE
    NEW.gst_rate := 0;
  END IF;

  -- Floor price from the price list (same unit first, then the other unit converted).
  SELECT pli.floor_price, pli.unit INTO v_floor, v_floor_unit
  FROM price_list_items pli
  WHERE pli.org_id = v_quote.org_id
    AND pli.product_id = NEW.product_id
    AND pli.currency = v_quote.currency
    AND pli.is_active
    AND pli.effective_from <= CURRENT_DATE
  ORDER BY (pli.unit = NEW.unit) DESC, pli.effective_from DESC, pli.created_at DESC
  LIMIT 1;

  IF v_floor IS NOT NULL AND v_floor_unit <> NEW.unit THEN
    IF NEW.unit = 'MT' THEN
      v_floor := round(v_floor * 1000, 2);
    ELSE
      v_floor := round(v_floor / 1000, 2);
    END IF;
  END IF;
  NEW.floor_price_at_time := v_floor;

  -- Every web session except the owner meets the wall (NULL-safe, SEC2-07); trusted callers
  -- (seeds and test fixtures as postgres) do not.
  IF v_web AND fn_user_role() IS DISTINCT FROM 'owner' THEN
    IF NEW.floor_price_at_time IS NULL THEN
      RAISE EXCEPTION 'below_floor_price' USING ERRCODE = 'P0001', DETAIL = 'no_price';
    END IF;
    IF NEW.rate < NEW.floor_price_at_time THEN
      RAISE EXCEPTION 'below_floor_price' USING ERRCODE = 'P0001', DETAIL = NEW.floor_price_at_time::text;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION fn_quote_item_guard() FROM PUBLIC, authenticated;

DROP TRIGGER IF EXISTS trg_quotation_items_guard ON quotation_items;
CREATE TRIGGER trg_quotation_items_guard BEFORE INSERT OR UPDATE ON quotation_items
  FOR EACH ROW EXECUTE FUNCTION fn_quote_item_guard();

-- A draft's currency change re-runs the guard on its saved items: floor, GST and amount are
-- derived again for the new currency, and a non-owner below the new floor (or with no price
-- in it) is refused, so no stale floor survives a USD -> INR switch (G2-01 / SEC2-01).
-- SECURITY INVOKER: the caller already passed quotations_update (draft + quotes module).
CREATE OR REPLACE FUNCTION fn_quotation_currency_recheck()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE quotation_items SET updated_at = now() WHERE quotation_id = NEW.id;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION fn_quotation_currency_recheck() FROM PUBLIC, authenticated;

DROP TRIGGER IF EXISTS trg_quotations_currency_recheck ON quotations;
CREATE TRIGGER trg_quotations_currency_recheck AFTER UPDATE OF currency ON quotations
  FOR EACH ROW WHEN (OLD.currency IS DISTINCT FROM NEW.currency)
  EXECUTE FUNCTION fn_quotation_currency_recheck();

--------------------------------------------------------------------------------
-- 5. Totals: the parent's subtotal / gst_amount / total follow the items (contracts 3.5)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_quotation_items_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_ids := ARRAY[OLD.quotation_id];
  ELSIF TG_OP = 'INSERT' THEN
    v_ids := ARRAY[NEW.quotation_id];
  ELSE
    v_ids := ARRAY[NEW.quotation_id];
    IF OLD.quotation_id IS DISTINCT FROM NEW.quotation_id THEN
      v_ids := array_append(v_ids, OLD.quotation_id);
    END IF;
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    UPDATE quotations q
    SET subtotal = s.subtotal,
        gst_amount = s.gst_amount,
        total = s.subtotal + s.gst_amount,
        updated_at = now()
    FROM (
      SELECT COALESCE(sum(i.amount), 0)::numeric(14,2) AS subtotal,
             round(COALESCE(sum(i.amount * i.gst_rate / 100), 0), 2)::numeric(14,2) AS gst_amount
      FROM quotation_items i
      WHERE i.quotation_id = v_id
    ) s
    WHERE q.id = v_id;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION fn_quotation_items_totals() FROM PUBLIC, authenticated;

DROP TRIGGER IF EXISTS trg_quotation_items_totals ON quotation_items;
CREATE TRIGGER trg_quotation_items_totals AFTER INSERT OR UPDATE OR DELETE ON quotation_items
  FOR EACH ROW EXECUTE FUNCTION fn_quotation_items_totals();

-- A9 / SEC2-05: a quotation's totals are never taken from its INSERT. They are summed from its
-- items (none for a new quote, so 0; the seed's upsert of an existing quote gets its real
-- totals). The column UPDATE grant has no totals, so after this only the item trigger moves
-- them. SECURITY INVOKER: the caller sees only items of its own org.
CREATE OR REPLACE FUNCTION fn_quotation_insert_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(sum(i.amount), 0)::numeric(14,2),
         round(COALESCE(sum(i.amount * i.gst_rate / 100), 0), 2)::numeric(14,2)
    INTO NEW.subtotal, NEW.gst_amount
  FROM quotation_items i
  WHERE i.quotation_id = NEW.id;
  NEW.total := NEW.subtotal + NEW.gst_amount;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION fn_quotation_insert_totals() FROM PUBLIC, authenticated;

DROP TRIGGER IF EXISTS trg_quotations_insert_totals ON quotations;
CREATE TRIGGER trg_quotations_insert_totals BEFORE INSERT ON quotations
  FOR EACH ROW EXECUTE FUNCTION fn_quotation_insert_totals();

--------------------------------------------------------------------------------
-- 6. fn_sample_set_status (contracts 4.3)
--------------------------------------------------------------------------------
-- to_send -> sent; sent -> approved | rejected. sent: sent_on, linked inquiry new/talking ->
-- sample_sent, follow-up "Sample SMP-xxxx sent, ask for result" due +7. approved / rejected:
-- result_note, decided_on, that follow-up done.

CREATE OR REPLACE FUNCTION fn_sample_set_status(p_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_row samples%ROWTYPE;
  v_inquiry_status text;
  v_note text;
BEGIN
  PERFORM fn_require_module('samples');                                  -- raises 42501

  IF p_status IS NULL OR p_status NOT IN ('sent', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'status';
  END IF;

  SELECT * INTO v_row FROM samples WHERE id = p_id AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';                 -- same code as no access
  END IF;

  IF NOT (
       (v_row.status = 'to_send' AND p_status = 'sent')
    OR (v_row.status = 'sent' AND p_status IN ('approved', 'rejected'))
  ) THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001', DETAIL = v_row.status || ' -> ' || p_status;
  END IF;

  IF p_status = 'sent' THEN
    UPDATE samples
    SET status = 'sent', sent_on = COALESCE(sent_on, CURRENT_DATE), updated_at = now()
    WHERE id = v_row.id;

    IF v_row.inquiry_id IS NOT NULL THEN
      SELECT status INTO v_inquiry_status FROM inquiries WHERE id = v_row.inquiry_id AND org_id = v_org;
      IF v_inquiry_status IN ('new', 'talking') THEN
        UPDATE inquiries SET status = 'sample_sent', updated_at = now()
        WHERE id = v_row.inquiry_id AND org_id = v_org;
      END IF;
    END IF;

    v_note := 'Sample ' || v_row.code || ' sent, ask for result';
    IF v_row.inquiry_id IS NOT NULL THEN
      INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, created_by)
      VALUES (v_org, 'inquiry', v_row.inquiry_id, v_row.buyer_id, v_note, CURRENT_DATE + 7, false, auth.uid());
    ELSE
      INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, created_by)
      VALUES (v_org, 'buyer', v_row.buyer_id, v_row.buyer_id, v_note, CURRENT_DATE + 7, false, auth.uid());
    END IF;
  ELSE
    UPDATE samples
    SET status = p_status,
        result_note = COALESCE(NULLIF(btrim(p_note), ''), result_note),
        decided_on = CURRENT_DATE,
        updated_at = now()
    WHERE id = v_row.id;

    -- The sample's own reminder is answered now.
    UPDATE follow_ups
    SET done = true, done_at = now(), done_by = auth.uid(), updated_at = now()
    WHERE org_id = v_org
      AND done = false
      AND note LIKE 'Sample ' || v_row.code || '%'
      AND (
        (entity_type = 'inquiry' AND entity_id = v_row.inquiry_id)
        OR (entity_type = 'buyer' AND entity_id = v_row.buyer_id)
      );
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION fn_sample_set_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_sample_set_status(uuid, text, text) TO authenticated;

--------------------------------------------------------------------------------
-- 6b. fn_sample_create: "Save" / "Save & mark sent" in one call (G2-13)
--------------------------------------------------------------------------------
-- SECURITY INVOKER (not a definer): the insert runs as the caller, so RLS (A9 start state,
-- same-org buyer / product / inquiry), the column grants and the SMP code trigger all apply.
-- With p_mark_sent the new row goes to 'sent' through fn_sample_set_status in the same
-- transaction: if that step is refused, the sample is not saved either, so a retry never
-- makes a second sample. Returns {"id": ..., "code": "SMP-0004"} for the toast.

CREATE OR REPLACE FUNCTION fn_sample_create(
  p_buyer_id uuid,
  p_product_id uuid,
  p_inquiry_id uuid DEFAULT NULL,
  p_qty_grams integer DEFAULT 500,
  p_courier text DEFAULT NULL,
  p_tracking_no text DEFAULT NULL,
  p_lot_no text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_mark_sent boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_code text;
BEGIN
  PERFORM fn_require_module('samples');                                  -- raises 42501

  IF p_buyer_id IS NULL OR p_product_id IS NULL OR p_mark_sent IS NULL THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'sample';
  END IF;

  INSERT INTO samples (org_id, inquiry_id, buyer_id, product_id, qty_grams, courier, tracking_no, lot_no, result_note, created_by)
  VALUES (
    fn_current_org(), p_inquiry_id, p_buyer_id, p_product_id, COALESCE(p_qty_grams, 500),
    NULLIF(btrim(p_courier), ''), NULLIF(btrim(p_tracking_no), ''), NULLIF(btrim(p_lot_no), ''),
    NULLIF(btrim(p_note), ''), auth.uid()
  )
  RETURNING id, code INTO v_id, v_code;

  IF p_mark_sent THEN
    PERFORM fn_sample_set_status(v_id, 'sent', NULL);
  END IF;

  RETURN jsonb_build_object('id', v_id, 'code', v_code);
END;
$$;
REVOKE ALL ON FUNCTION fn_sample_create(uuid, uuid, uuid, integer, text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_sample_create(uuid, uuid, uuid, integer, text, text, text, text, boolean) TO authenticated;

--------------------------------------------------------------------------------
-- 7. fn_quote_send (contracts 4.3)
--------------------------------------------------------------------------------
-- draft -> sent. Needs items (no_items); floor guard re-checked for non-owners
-- (below_floor_price, DETAIL = floor or 'no_price'); sent_at; linked inquiry not won / lost ->
-- quoted; follow-up "Quote QTN-xxxx expires tomorrow - call buyer" due
-- GREATEST(valid_till - 1, today). The items are re-run through fn_quote_item_guard first, so
-- the floor is the current price list's for the current currency, never the one stored when
-- the item was saved (G2-01 / SEC2-01).

CREATE OR REPLACE FUNCTION fn_quote_send(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_row quotations%ROWTYPE;
  v_items integer;
  v_floor numeric(12,2);
  v_inquiry_status text;
BEGIN
  PERFORM fn_require_module('quotes');                                   -- raises 42501

  SELECT * INTO v_row FROM quotations WHERE id = p_id AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;

  IF v_row.status <> 'draft' THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001', DETAIL = v_row.status || ' -> sent';
  END IF;

  SELECT count(*) INTO v_items FROM quotation_items WHERE quotation_id = v_row.id;
  IF v_items = 0 THEN
    RAISE EXCEPTION 'no_items' USING ERRCODE = 'P0001';
  END IF;

  -- Re-derive floor, GST and amount (raises below_floor_price for a non-owner).
  UPDATE quotation_items SET updated_at = now() WHERE quotation_id = v_row.id;

  IF fn_user_role() IS DISTINCT FROM 'owner' THEN                       -- NULL-safe (SEC2-07)
    SELECT i.floor_price_at_time INTO v_floor
    FROM quotation_items i
    WHERE i.quotation_id = v_row.id
      AND i.floor_price_at_time IS NOT NULL
      AND i.rate < i.floor_price_at_time
    ORDER BY i.sort_order
    LIMIT 1;
    IF v_floor IS NOT NULL THEN
      RAISE EXCEPTION 'below_floor_price' USING ERRCODE = 'P0001', DETAIL = v_floor::text;
    END IF;
  END IF;

  UPDATE quotations
  SET status = 'sent', sent_at = now(), updated_at = now()
  WHERE id = v_row.id;

  IF v_row.inquiry_id IS NOT NULL THEN
    SELECT status INTO v_inquiry_status FROM inquiries WHERE id = v_row.inquiry_id AND org_id = v_org;
    IF v_inquiry_status IS NOT NULL AND v_inquiry_status NOT IN ('won', 'lost') THEN
      UPDATE inquiries SET status = 'quoted', updated_at = now()
      WHERE id = v_row.inquiry_id AND org_id = v_org;
    END IF;
  END IF;

  INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, created_by)
  VALUES (
    v_org, 'quote', v_row.id, v_row.buyer_id,
    'Quote ' || v_row.quote_no || ' expires tomorrow - call buyer',
    GREATEST(v_row.valid_till - 1, CURRENT_DATE), false, auth.uid()
  );
END;
$$;
REVOKE ALL ON FUNCTION fn_quote_send(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_quote_send(uuid) TO authenticated;

--------------------------------------------------------------------------------
-- 8. fn_quote_reject (contracts 4.3)
--------------------------------------------------------------------------------
-- sent -> rejected (also after valid_till). Reason required; the quote's pending follow-ups
-- are done; the inquiry is left as it is.

CREATE OR REPLACE FUNCTION fn_quote_reject(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_row quotations%ROWTYPE;
BEGIN
  PERFORM fn_require_module('quotes');                                   -- raises 42501

  SELECT * INTO v_row FROM quotations WHERE id = p_id AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;

  IF v_row.status <> 'sent' THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001', DETAIL = v_row.status || ' -> rejected';
  END IF;

  IF p_reason IS NULL OR p_reason NOT IN ('price', 'quality', 'timing', 'no_reply') THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0001';
  END IF;

  UPDATE quotations
  SET status = 'rejected', reject_reason = p_reason, decided_at = now(), updated_at = now()
  WHERE id = v_row.id;

  UPDATE follow_ups
  SET done = true, done_at = now(), done_by = auth.uid(), updated_at = now()
  WHERE org_id = v_org AND entity_type = 'quote' AND entity_id = v_row.id AND done = false;
END;
$$;
REVOKE ALL ON FUNCTION fn_quote_reject(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_quote_reject(uuid, text) TO authenticated;

--------------------------------------------------------------------------------
-- 9. fn_quote_update_draft: an edited draft is saved in one transaction (SEC2-01)
--------------------------------------------------------------------------------
-- SECURITY INVOKER (not a definer): every statement runs as the caller under RLS, the
-- column grants and the item guard. The old items go first, then the header (so the
-- currency re-check has nothing stale to look at), then the new items are guarded against
-- the new currency. Any refusal rolls the whole edit back: the draft keeps its old header
-- and items, and never keeps a floor or GST rate from its previous currency.

CREATE OR REPLACE FUNCTION fn_quote_update_draft(
  p_id uuid,
  p_buyer_id uuid,
  p_inquiry_id uuid,
  p_currency text,
  p_fx_rate numeric,
  p_incoterm text,
  p_valid_till date,
  p_payment_terms text,
  p_notes text,
  p_items jsonb
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_status text;
  v_quote_no text;
BEGIN
  PERFORM fn_require_module('quotes');                                   -- raises 42501

  SELECT status INTO v_status FROM quotations WHERE id = p_id AND org_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001', DETAIL = v_status || ' -> draft';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'no_items' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(p_items) > 20 THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'items';
  END IF;

  DELETE FROM quotation_items WHERE quotation_id = p_id AND org_id = v_org;

  UPDATE quotations
  SET buyer_id = p_buyer_id,
      inquiry_id = p_inquiry_id,
      currency = p_currency,
      fx_rate = CASE WHEN p_currency = 'INR' THEN NULL ELSE p_fx_rate END,
      incoterm = p_incoterm,
      valid_till = p_valid_till,
      payment_terms = p_payment_terms,
      notes = NULLIF(btrim(p_notes), ''),
      updated_at = now()
  WHERE id = p_id AND org_id = v_org AND status = 'draft'
  RETURNING quote_no INTO v_quote_no;
  IF v_quote_no IS NULL THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001', DETAIL = 'not draft';
  END IF;

  INSERT INTO quotation_items (org_id, quotation_id, product_id, packaging_type_id, qty_kg, unit, rate, spec_text, sort_order)
  SELECT v_org, p_id,
         (e.item ->> 'product_id')::uuid,
         NULLIF(e.item ->> 'packaging_type_id', '')::uuid,
         (e.item ->> 'qty_kg')::numeric,
         e.item ->> 'unit',
         (e.item ->> 'rate')::numeric,
         NULLIF(btrim(e.item ->> 'spec_text'), ''),
         e.ord::integer
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord);

  RETURN v_quote_no;
END;
$$;
REVOKE ALL ON FUNCTION fn_quote_update_draft(uuid, uuid, uuid, text, numeric, text, date, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_quote_update_draft(uuid, uuid, uuid, text, numeric, text, date, text, text, jsonb) TO authenticated;
