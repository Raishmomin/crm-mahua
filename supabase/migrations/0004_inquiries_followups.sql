-- Migration 0004: Inquiries and follow-ups (Dev-1, Sprint B)
-- Spec: docs/design/contracts.md 3.1 (inquiries), 3.2 (follow_ups), 4.2 (functions),
--       5.1 (v_inquiries_open), 5.2 (v_followups_today); flows.md sections 2 and 8.
--
-- * Idempotent: CREATE IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS everywhere.
--   0003 re-grants full UPDATE on every table on each run, so the column-level locks at
--   the end of this file are re-applied on each run too (filename order guarantees it).
-- * Error codes (contracts 2.3 + amendment A4):
--     not_found, role_not_allowed, module missing  -> SQLSTATE 42501
--     invalid_transition, reason_required, bad_payload -> SQLSTATE P0001
-- * Additions beyond the contract text (noted in tasks/todo.md):
--     - trg_buyers_code: BEFORE INSERT on buyers fills buyer_code with fn_assign_code('BUY',
--       'buyer_code'). buyers is inserted by policy from /buyers/new and fn_next_code is not
--       callable by web sessions, so without a trigger the form could never save.
--     - v_followups_today also exposes created_at (Home orders by due_on, created_at).
-- * Sprint B fix round:
--     - G2-03: insert / update policies also check that buyer_id, product_id and assigned_to
--       (inquiries) and buyer_id (follow_ups) belong to the caller's org; a plain FK accepts
--       another org's id.
--     - SEC2-02: buyers.buyer_code (and id, org_id, created_at) cannot be changed by a web
--       session (column-level UPDATE grant, section 7).
-- * Sprint C (contracts A9: G2-05, SEC2-05, SEC2-11):
--     - INSERT pins the starting state and the author: an inquiry starts as 'new' (no lost
--       reason, not closed); a follow-up starts with done_by NULL and is either a pending
--       reminder (done = false, done_at NULL) or a plain note (due_on NULL, done = true);
--       created_by is NULL or the caller. The SECURITY DEFINER functions of 0005 / 0006
--       insert reminders as (done = false, due_on set, created_by = auth.uid()), which
--       passes these checks even when the function owner is subject to RLS.
--     - follow_ups DELETE: the owner may delete any row; everyone else only their own plain
--       notes (due_on NULL, done_by NULL). done_by is not in the web UPDATE grant, so a
--       ticked reminder can never be turned into a deletable 'note' by clearing due_on.
-- * Sprint C fix round (G3-03, contracts A6 'Plant does not read money'): money-chasing
--   reminders are entity_type 'payment' (entity_id = the order). follow_ups SELECT hides them
--   from operations, and fn_follow_up_done answers not_found to operations for such a row
--   (same answer as a missing id). Owner / accountant / sales still read them.

--------------------------------------------------------------------------------
-- 1. inquiries (module leads)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  buyer_id uuid REFERENCES buyers(id) ON DELETE SET NULL,
  buyer_name text NOT NULL CHECK (length(btrim(buyer_name)) > 0),
  phone text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_text text,
  qty_kg numeric(12,2) CHECK (qty_kg IS NULL OR qty_kg > 0),
  needed_by date,
  source text NOT NULL DEFAULT 'whatsapp'
    CHECK (source IN ('whatsapp', 'call', 'visit', 'email', 'indiamart')),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'talking', 'sample_sent', 'quoted', 'won', 'lost')),
  lost_reason text
    CHECK (lost_reason IS NULL OR lost_reason IN ('price', 'quality', 'timing', 'no_reply')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  closed_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_inquiries_org_code UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inquiries_org_id ON inquiries(org_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_org_status ON inquiries(org_id, status);
CREATE INDEX IF NOT EXISTS idx_inquiries_org_buyer ON inquiries(org_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_org_created ON inquiries(org_id, created_at DESC);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inquiries_select ON inquiries;
CREATE POLICY inquiries_select ON inquiries
  FOR SELECT USING (org_id = fn_current_org());
-- Referenced rows must be in the caller's org too (G2-03). The sub-selects run with the
-- caller's RLS, and the explicit org_id test keeps them correct even without it.
DROP POLICY IF EXISTS inquiries_insert ON inquiries;
CREATE POLICY inquiries_insert ON inquiries
  FOR INSERT WITH CHECK (
    org_id = fn_current_org() AND fn_has_module('leads')
    -- A9: every inquiry starts as New, open, in the caller's name; the machine is fn_inquiry_set_status
    AND inquiries.status = 'new' AND inquiries.lost_reason IS NULL AND inquiries.closed_at IS NULL
    AND (inquiries.created_by IS NULL OR inquiries.created_by = auth.uid())
    AND (inquiries.buyer_id IS NULL
         OR EXISTS (SELECT 1 FROM buyers b WHERE b.id = inquiries.buyer_id AND b.org_id = fn_current_org()))
    AND (inquiries.product_id IS NULL
         OR EXISTS (SELECT 1 FROM products p WHERE p.id = inquiries.product_id AND p.org_id = fn_current_org()))
    AND (inquiries.assigned_to IS NULL
         OR EXISTS (SELECT 1 FROM profiles u WHERE u.id = inquiries.assigned_to AND u.org_id = fn_current_org()))
  );
DROP POLICY IF EXISTS inquiries_update ON inquiries;
CREATE POLICY inquiries_update ON inquiries
  FOR UPDATE
  USING (org_id = fn_current_org() AND fn_has_module('leads'))
  WITH CHECK (
    org_id = fn_current_org() AND fn_has_module('leads')
    AND (inquiries.buyer_id IS NULL
         OR EXISTS (SELECT 1 FROM buyers b WHERE b.id = inquiries.buyer_id AND b.org_id = fn_current_org()))
    AND (inquiries.product_id IS NULL
         OR EXISTS (SELECT 1 FROM products p WHERE p.id = inquiries.product_id AND p.org_id = fn_current_org()))
    AND (inquiries.assigned_to IS NULL
         OR EXISTS (SELECT 1 FROM profiles u WHERE u.id = inquiries.assigned_to AND u.org_id = fn_current_org()))
  );
DROP POLICY IF EXISTS inquiries_delete ON inquiries;
CREATE POLICY inquiries_delete ON inquiries
  FOR DELETE USING (org_id = fn_current_org() AND fn_has_module('leads'));

-- INQ-0001 ... assigned when code is NULL (seeds pass explicit codes)
DROP TRIGGER IF EXISTS trg_inquiries_code ON inquiries;
CREATE TRIGGER trg_inquiries_code BEFORE INSERT ON inquiries
  FOR EACH ROW EXECUTE FUNCTION fn_assign_code('INQ', 'code');

DROP TRIGGER IF EXISTS trg_audit_inquiries ON inquiries;
CREATE TRIGGER trg_audit_inquiries AFTER INSERT OR UPDATE OR DELETE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

--------------------------------------------------------------------------------
-- 2. follow_ups (notes and reminders for inquiry / buyer / quote / order / payment)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL
    CHECK (entity_type IN ('inquiry', 'buyer', 'quote', 'order', 'payment')),
  entity_id uuid NOT NULL,
  buyer_id uuid REFERENCES buyers(id) ON DELETE SET NULL,
  note text NOT NULL CHECK (length(btrim(note)) > 0),
  due_on date,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  done_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- a reminder needs a date; a plain note is due_on NULL + done = true
  CONSTRAINT chk_follow_ups_note_or_reminder CHECK (due_on IS NOT NULL OR done = true)
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_org_id ON follow_ups(org_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_org_due ON follow_ups(org_id, due_on) WHERE done = false;
CREATE INDEX IF NOT EXISTS idx_follow_ups_org_entity ON follow_ups(org_id, entity_type, entity_id);

ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups FORCE ROW LEVEL SECURITY;

-- Module of a follow-up row = module of the thing it hangs on.
CREATE OR REPLACE FUNCTION fn_follow_up_module(p_entity_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_entity_type
    WHEN 'inquiry' THEN 'leads'
    WHEN 'buyer'   THEN 'buyers'
    WHEN 'quote'   THEN 'quotes'
    WHEN 'order'   THEN 'orders'
    WHEN 'payment' THEN 'payments'
  END;
$$;
REVOKE ALL ON FUNCTION fn_follow_up_module(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_follow_up_module(text) TO authenticated;

DROP POLICY IF EXISTS follow_ups_select ON follow_ups;
CREATE POLICY follow_ups_select ON follow_ups
  FOR SELECT USING (
    org_id = fn_current_org()
    -- A6 / G3-03: Plant does not read money reminders
    AND (follow_ups.entity_type <> 'payment' OR fn_user_role() IS DISTINCT FROM 'operations')
  );
DROP POLICY IF EXISTS follow_ups_insert ON follow_ups;
CREATE POLICY follow_ups_insert ON follow_ups
  FOR INSERT WITH CHECK (
    org_id = fn_current_org() AND fn_has_module(fn_follow_up_module(entity_type))
    -- A9: a pending reminder or a plain note, never 'done by' someone, written in the caller's name
    AND follow_ups.done_by IS NULL
    AND ((follow_ups.done = false AND follow_ups.done_at IS NULL)
         OR (follow_ups.due_on IS NULL AND follow_ups.done = true))
    AND (follow_ups.created_by IS NULL OR follow_ups.created_by = auth.uid())
    AND (follow_ups.buyer_id IS NULL
         OR EXISTS (SELECT 1 FROM buyers b WHERE b.id = follow_ups.buyer_id AND b.org_id = fn_current_org()))
  );
DROP POLICY IF EXISTS follow_ups_update ON follow_ups;
CREATE POLICY follow_ups_update ON follow_ups
  FOR UPDATE
  USING (org_id = fn_current_org() AND fn_has_module(fn_follow_up_module(entity_type)))
  WITH CHECK (
    org_id = fn_current_org() AND fn_has_module(fn_follow_up_module(entity_type))
    AND (follow_ups.buyer_id IS NULL
         OR EXISTS (SELECT 1 FROM buyers b WHERE b.id = follow_ups.buyer_id AND b.org_id = fn_current_org()))
  );
DROP POLICY IF EXISTS follow_ups_delete ON follow_ups;
-- A9 / G2-05 / SEC2-11: system reminders ('Balance ... due', 'Advance ... due', ...) and ticked
-- reminders stay; only the owner deletes them. Others delete only their own plain notes.
CREATE POLICY follow_ups_delete ON follow_ups
  FOR DELETE USING (
    org_id = fn_current_org() AND fn_has_module(fn_follow_up_module(entity_type))
    AND (
      fn_user_role() = 'owner'
      OR (follow_ups.due_on IS NULL AND follow_ups.done_by IS NULL AND follow_ups.created_by = auth.uid())
    )
  );

DROP TRIGGER IF EXISTS trg_audit_follow_ups ON follow_ups;
CREATE TRIGGER trg_audit_follow_ups AFTER INSERT OR UPDATE OR DELETE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

--------------------------------------------------------------------------------
-- 3. buyers: BUY-0001 ... from the trigger (the buyer form inserts by policy)
--------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_buyers_code ON buyers;
CREATE TRIGGER trg_buyers_code BEFORE INSERT ON buyers
  FOR EACH ROW EXECUTE FUNCTION fn_assign_code('BUY', 'buyer_code');

--------------------------------------------------------------------------------
-- 4. fn_inquiry_set_status: the only way to move an inquiry (contracts 4.2, flows.md 2)
--------------------------------------------------------------------------------
--   new         -> talking, sample_sent, quoted, lost
--   talking     -> sample_sent, quoted, lost
--   sample_sent -> talking, quoted, lost
--   quoted      -> talking, lost
--   lost        -> talking (owner only: Reopen)
--   won is set only by fn_quote_accept (0006); asking for it here is invalid_transition.

CREATE OR REPLACE FUNCTION fn_inquiry_set_status(p_id uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_row inquiries%ROWTYPE;
  v_allowed boolean := false;
BEGIN
  PERFORM fn_require_module('leads');                                       -- raises 42501

  IF p_status IS NULL
     OR p_status NOT IN ('new', 'talking', 'sample_sent', 'quoted', 'won', 'lost') THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'status';
  END IF;

  SELECT * INTO v_row FROM inquiries WHERE id = p_id AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';                    -- same code as no access
  END IF;

  v_allowed := CASE v_row.status
    WHEN 'new'         THEN p_status IN ('talking', 'sample_sent', 'quoted', 'lost')
    WHEN 'talking'     THEN p_status IN ('sample_sent', 'quoted', 'lost')
    WHEN 'sample_sent' THEN p_status IN ('talking', 'quoted', 'lost')
    WHEN 'quoted'      THEN p_status IN ('talking', 'lost')
    WHEN 'lost'        THEN p_status = 'talking'
    ELSE false                                                              -- won: closed for good
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001',
      DETAIL = v_row.status || ' -> ' || p_status;
  END IF;

  -- Reopen a lost inquiry: owner only
  IF v_row.status = 'lost' AND COALESCE(fn_user_role(), '') <> 'owner' THEN
    RAISE EXCEPTION 'role_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_status = 'lost' THEN
    IF p_reason IS NULL OR p_reason NOT IN ('price', 'quality', 'timing', 'no_reply') THEN
      RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0001';
    END IF;

    UPDATE inquiries
    SET status = 'lost', lost_reason = p_reason, closed_at = now(), updated_at = now()
    WHERE id = p_id AND org_id = v_org;

    -- nothing left to chase on a lost inquiry
    UPDATE follow_ups
    SET done = true, done_at = now(), done_by = auth.uid(), updated_at = now()
    WHERE org_id = v_org AND entity_type = 'inquiry' AND entity_id = p_id AND done = false;

  ELSIF v_row.status = 'lost' THEN
    -- Reopen
    UPDATE inquiries
    SET status = p_status, lost_reason = NULL, closed_at = NULL, updated_at = now()
    WHERE id = p_id AND org_id = v_org;

  ELSE
    UPDATE inquiries
    SET status = p_status, updated_at = now()
    WHERE id = p_id AND org_id = v_org;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION fn_inquiry_set_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_inquiry_set_status(uuid, text, text) TO authenticated;

--------------------------------------------------------------------------------
-- 5. fn_follow_up_done: tick a reminder (module mapped from the row's entity_type)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_follow_up_done(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_row follow_ups%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM follow_ups WHERE id = p_id AND org_id = v_org FOR UPDATE;
  -- A6 / G3-03: a money reminder does not exist for Plant (it cannot read it either)
  IF NOT FOUND OR (v_row.entity_type = 'payment' AND fn_user_role() = 'operations') THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;

  -- Money chasing rows may be ticked by the money desk or the orders desk.
  IF v_row.entity_type = 'payment' THEN
    IF NOT (fn_has_module('payments') OR fn_has_module('orders')) THEN
      RAISE EXCEPTION 'Access denied: module % is required', 'payments' USING ERRCODE = '42501';
    END IF;
  ELSE
    PERFORM fn_require_module(fn_follow_up_module(v_row.entity_type));         -- raises 42501
  END IF;

  IF v_row.done THEN
    RETURN;                                                                  -- already done: no-op
  END IF;

  UPDATE follow_ups
  SET done = true, done_at = now(), done_by = auth.uid(), updated_at = now()
  WHERE id = p_id AND org_id = v_org;
END;
$$;
REVOKE ALL ON FUNCTION fn_follow_up_done(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_follow_up_done(uuid) TO authenticated;

--------------------------------------------------------------------------------
-- 6. Views (security_invoker: RLS of the base tables applies)
--------------------------------------------------------------------------------

-- 6a. Open inquiries for the list, the buyer page and Home (contracts 5.1)
CREATE OR REPLACE VIEW v_inquiries_open WITH (security_invoker = true) AS
SELECT
  i.id,
  i.org_id,
  i.code,
  i.buyer_id,
  i.buyer_name,
  i.phone,
  i.product_id,
  COALESCE(p.name, i.product_text) AS product_name,
  i.qty_kg,
  i.needed_by,
  i.source,
  i.status,
  i.assigned_to,
  i.created_at,
  (CURRENT_DATE - i.created_at::date) AS days_old,
  (SELECT min(f.due_on)
     FROM follow_ups f
    WHERE f.org_id = i.org_id AND f.entity_type = 'inquiry' AND f.entity_id = i.id AND f.done = false
  ) AS next_followup_on
FROM inquiries i
LEFT JOIN products p ON p.id = i.product_id
WHERE i.status NOT IN ('won', 'lost');

-- 6b. To do today (contracts 5.2): pending reminders due today or earlier.
-- Plain notes have due_on NULL and fall out. Joins only 0001-0004 tables, so the
-- quote / order / payment rows rely on follow_ups.buyer_id for the name and phone.
CREATE OR REPLACE VIEW v_followups_today WITH (security_invoker = true) AS
SELECT
  f.id,
  f.org_id,
  f.entity_type,
  f.entity_id,
  f.note,
  f.due_on,
  (CURRENT_DATE - f.due_on) AS days_late,
  COALESCE(f.buyer_id, i.buyer_id) AS buyer_id,
  COALESCE(b.company_name, i.buyer_name) AS buyer_name,
  COALESCE(bc.phone, i.phone) AS phone,
  i.code AS inquiry_code,
  f.created_at
FROM follow_ups f
LEFT JOIN inquiries i ON f.entity_type = 'inquiry' AND i.id = f.entity_id
LEFT JOIN buyers b ON b.id = COALESCE(f.buyer_id, i.buyer_id)
LEFT JOIN LATERAL (
  SELECT c.phone
  FROM buyer_contacts c
  WHERE c.buyer_id = b.id
  ORDER BY c.is_primary DESC, c.created_at
  LIMIT 1
) bc ON true
WHERE f.done = false AND f.due_on <= CURRENT_DATE
ORDER BY f.due_on, f.created_at;

REVOKE INSERT, UPDATE, DELETE ON v_inquiries_open FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON v_followups_today FROM authenticated;

--------------------------------------------------------------------------------
-- 7. Column-level locks (contracts 2.2): the status machine lives in the functions
--------------------------------------------------------------------------------
-- 0003 re-grants full UPDATE on every table each run; this block always runs after it.

REVOKE UPDATE ON inquiries FROM authenticated;
GRANT UPDATE (buyer_id, buyer_name, phone, product_id, product_text, qty_kg, needed_by, source,
              assigned_to, notes, updated_at)
  ON inquiries TO authenticated;

REVOKE UPDATE ON follow_ups FROM authenticated;
GRANT UPDATE (note, due_on, buyer_id, updated_at) ON follow_ups TO authenticated;

-- SEC2-02: the BUY number is assigned once by trg_buyers_code and never changes; a session
-- that could rewrite buyer_code could pre-claim the next number and block every new buyer.
REVOKE UPDATE ON buyers FROM authenticated;
GRANT UPDATE (company_name, buyer_type, country, gstin, pan, incoterm, preferred_currency,
              payment_terms, credit_period_days, address, city, state, status, updated_at)
  ON buyers TO authenticated;
