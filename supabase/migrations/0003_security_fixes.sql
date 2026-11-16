-- Migration 0003: Security fixes (Dev-2, Sprint A)
-- Spec: docs/design/contracts.md section 2.4.
-- Holes closed: docs/research/product-gap-analysis.md section 8 (verified attacks).
--
-- * Idempotent. 0001 / 0002 re-create the permissive grants, the FOR ALL policies and
--   the plain view on every re-run, so this file must always run AFTER them. Filename
--   order guarantees that (scripts/seed.ts, tests/helpers/db.ts, supabase db reset).
-- * Valid on plain Postgres (postgres = superuser) and on Supabase (postgres is not a
--   superuser): nothing here alters schema auth or a role we did not create. Only
--   GRANT / REVOKE on public objects, policies, functions and the default privileges
--   of the current role.
-- * Error codes raised by the staff functions (server actions map the MESSAGE text):
--     self_change, role_not_allowed, not_found  -> SQLSTATE 42501 (insufficient_privilege)
--     last_owner, bad_payload                   -> SQLSTATE P0001 (raise_exception)

--------------------------------------------------------------------------------
-- 1. GUC overrides are honoured only for trusted callers
--------------------------------------------------------------------------------
-- Inside a SECURITY DEFINER function current_user is the function OWNER (postgres),
-- never 'authenticated', so the contract's "current_user NOT IN (...)" is implemented
-- with the role the session switched to: PostgREST and the tests both run
-- SET ROLE authenticated / anon, which stays visible as current_setting('role') even
-- inside a definer. With no SET ROLE active it reads 'none' and the caller is the
-- login role (session_user). Seeds and tests that connect as postgres may still set
-- app.current_org / app.override_module_check; web sessions never can.

CREATE OR REPLACE FUNCTION fn_current_org()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_override text;
  v_caller text;
BEGIN
  v_caller := COALESCE(NULLIF(NULLIF(current_setting('role', true), 'none'), ''), session_user::text);

  IF v_caller NOT IN ('authenticated', 'anon', 'authenticator') THEN
    v_override := NULLIF(current_setting('app.current_org', true), '');
    IF v_override IS NOT NULL THEN
      RETURN v_override::uuid;
    END IF;
  END IF;

  SELECT org_id INTO v_org_id
  FROM profiles
  WHERE id = auth.uid() AND is_active = true
  LIMIT 1;

  RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_require_module(p_module text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_module boolean;
  v_caller text;
BEGIN
  v_caller := COALESCE(NULLIF(NULLIF(current_setting('role', true), 'none'), ''), session_user::text);

  IF v_caller NOT IN ('authenticated', 'anon', 'authenticator')
     AND NULLIF(current_setting('app.override_module_check', true), '') = 'true' THEN
    RETURN true;
  END IF;

  SELECT (p_module = ANY(modules)) INTO v_has_module
  FROM profiles
  WHERE id = auth.uid() AND is_active = true;

  IF v_has_module IS NOT TRUE THEN
    RAISE EXCEPTION 'Access denied: module % is required', p_module
      USING ERRCODE = '42501';
  END IF;

  RETURN true;
END;
$$;

-- fn_current_fy is pure in p_date; the contract wants it STABLE (its default is CURRENT_DATE).
ALTER FUNCTION fn_current_fy(date) STABLE;

--------------------------------------------------------------------------------
-- 2. Non-raising helpers for policies
--------------------------------------------------------------------------------

-- fn_has_module: true iff the active profile of auth.uid() holds p_module. Never raises.
CREATE OR REPLACE FUNCTION fn_has_module(p_module text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has boolean;
BEGIN
  IF p_module IS NULL THEN
    RETURN false;
  END IF;

  SELECT (p_module = ANY(modules)) INTO v_has
  FROM profiles
  WHERE id = auth.uid() AND is_active = true
  LIMIT 1;

  RETURN COALESCE(v_has, false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION fn_has_module(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_has_module(text) TO authenticated;

-- fn_user_role: role of the active caller or NULL.
CREATE OR REPLACE FUNCTION fn_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.role
  FROM profiles pr
  WHERE pr.id = auth.uid() AND pr.is_active = true
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION fn_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_user_role() TO authenticated;

--------------------------------------------------------------------------------
-- 3. Number generators: only callable from SECURITY DEFINER functions / triggers
--------------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION fn_next_code(text), fn_next_doc_no(text) FROM PUBLIC, authenticated;

-- fn_assign_code: BEFORE INSERT trigger. TG_ARGV[0] = prefix, TG_ARGV[1] = column (default 'code').
-- Web sessions (authenticated / anon / authenticator, read as in fn_current_org) always get
-- the generated number: a code they supply is replaced, so nobody can pre-claim the next
-- number (every later insert would fail with 23505 and the counter would stay stuck) or
-- forge one (security review 2, SEC2-02). Trusted callers (seeds, tests as postgres) keep
-- an explicit code; NULL is filled for everyone.
--   CREATE TRIGGER trg_<t>_code BEFORE INSERT ON <t>
--     FOR EACH ROW EXECUTE FUNCTION fn_assign_code('INQ', 'code');
CREATE OR REPLACE FUNCTION fn_assign_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := TG_ARGV[0];
  v_col text := COALESCE(NULLIF(TG_ARGV[1], ''), 'code');
  v_caller text := COALESCE(NULLIF(NULLIF(current_setting('role', true), 'none'), ''), session_user::text);
BEGIN
  IF v_prefix IS NULL OR v_prefix = '' THEN
    RAISE EXCEPTION 'fn_assign_code needs a prefix argument' USING ERRCODE = '22023';
  END IF;

  IF (to_jsonb(NEW) ->> v_col) IS NULL OR v_caller IN ('authenticated', 'anon', 'authenticator') THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(v_col, fn_next_code(v_prefix)));
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION fn_assign_code() FROM PUBLIC, authenticated;

-- fn_assign_doc_no: same rule, with fn_next_doc_no. TG_ARGV[0] = doc type, TG_ARGV[1] = column.
--   CREATE TRIGGER trg_<t>_doc_no BEFORE INSERT ON <t>
--     FOR EACH ROW EXECUTE FUNCTION fn_assign_doc_no('QTN', 'quote_no');
CREATE OR REPLACE FUNCTION fn_assign_doc_no()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_type text := TG_ARGV[0];
  v_col text := COALESCE(NULLIF(TG_ARGV[1], ''), 'code');
  v_caller text := COALESCE(NULLIF(NULLIF(current_setting('role', true), 'none'), ''), session_user::text);
BEGIN
  IF v_doc_type IS NULL OR v_doc_type = '' THEN
    RAISE EXCEPTION 'fn_assign_doc_no needs a doc type argument' USING ERRCODE = '22023';
  END IF;

  IF (to_jsonb(NEW) ->> v_col) IS NULL OR v_caller IN ('authenticated', 'anon', 'authenticator') THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(v_col, fn_next_doc_no(v_doc_type)));
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION fn_assign_doc_no() FROM PUBLIC, authenticated;

--------------------------------------------------------------------------------
-- 4. Staff management: the only way to change role / modules / active
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_set_user_access(p_user uuid, p_role text, p_modules text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_target profiles%ROWTYPE;
  v_active_owners integer;
BEGIN
  PERFORM fn_require_module('users');                                  -- raises 42501

  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'self_change' USING ERRCODE = '42501';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('owner', 'accountant', 'sales', 'operations') THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'role';
  END IF;

  -- Known keys only, at most 13 entries, stored once each in the order given (SEC1-08; the
  -- staff action applies the same rule).
  IF p_modules IS NULL OR cardinality(p_modules) > 13 OR NOT (p_modules <@ ARRAY[
       'dashboard', 'leads', 'buyers', 'samples', 'quotes', 'orders', 'payments',
       'catalog', 'documents', 'reports', 'users', 'settings', 'audit']::text[]) THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'modules';
  END IF;
  p_modules := ARRAY(
    SELECT u.m FROM unnest(p_modules) WITH ORDINALITY AS u(m, n) GROUP BY u.m ORDER BY min(u.n)
  );

  SELECT * INTO v_target FROM profiles WHERE id = p_user AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';               -- no existence leak
  END IF;

  -- Only an owner may hand out the owner role.
  IF p_role = 'owner' AND COALESCE(fn_user_role(), '') <> 'owner' THEN
    RAISE EXCEPTION 'role_not_allowed' USING ERRCODE = '42501';
  END IF;

  -- Never remove the last active owner of the org.
  IF v_target.role = 'owner' AND v_target.is_active AND p_role <> 'owner' THEN
    PERFORM 1 FROM profiles WHERE org_id = v_org AND role = 'owner' FOR UPDATE;
    SELECT count(*) INTO v_active_owners
    FROM profiles WHERE org_id = v_org AND role = 'owner' AND is_active = true;
    IF v_active_owners <= 1 THEN
      RAISE EXCEPTION 'last_owner' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE profiles
  SET role = p_role, modules = p_modules, updated_at = now()
  WHERE id = p_user AND org_id = v_org;
END;
$$;
REVOKE ALL ON FUNCTION fn_set_user_access(uuid, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_set_user_access(uuid, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION fn_set_user_active(p_user uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_target profiles%ROWTYPE;
  v_active_owners integer;
BEGIN
  PERFORM fn_require_module('users');                                  -- raises 42501

  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'self_change' USING ERRCODE = '42501';
  END IF;

  IF p_active IS NULL THEN
    RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'active';
  END IF;

  SELECT * INTO v_target FROM profiles WHERE id = p_user AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;

  IF v_target.role = 'owner' AND v_target.is_active AND NOT p_active THEN
    PERFORM 1 FROM profiles WHERE org_id = v_org AND role = 'owner' FOR UPDATE;
    SELECT count(*) INTO v_active_owners
    FROM profiles WHERE org_id = v_org AND role = 'owner' AND is_active = true;
    IF v_active_owners <= 1 THEN
      RAISE EXCEPTION 'last_owner' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE profiles
  SET is_active = p_active, updated_at = now()
  WHERE id = p_user AND org_id = v_org;
END;
$$;
REVOKE ALL ON FUNCTION fn_set_user_active(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_set_user_active(uuid, boolean) TO authenticated;

--------------------------------------------------------------------------------
-- 5. Audit log: gated by the audit module, no costs, no bank details
--------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_audit_product_costs ON product_costs;

CREATE OR REPLACE FUNCTION fn_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_record_id uuid;
  v_old_data jsonb := NULL;
  v_new_data jsonb := NULL;
BEGIN
  -- Cost rows never enter the audit log (readable by the audit module, not by owner/accountant only).
  IF TG_TABLE_NAME = 'product_costs' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF (TG_OP = 'DELETE') THEN
    v_org_id := OLD.org_id;
    v_record_id := OLD.id;
    v_old_data := to_jsonb(OLD);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_org_id := NEW.org_id;
    v_record_id := NEW.id;
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF (TG_OP = 'INSERT') THEN
    v_org_id := NEW.org_id;
    v_record_id := NEW.id;
    v_new_data := to_jsonb(NEW);
  END IF;

  -- Bank account numbers stay out of the snapshots.
  IF TG_TABLE_NAME = 'business_settings' THEN
    v_old_data := v_old_data - 'bank_details';
    v_new_data := v_new_data - 'bank_details';
  END IF;

  INSERT INTO audit_log (org_id, user_id, table_name, record_id, action, old_data, new_data, created_at)
  VALUES (v_org_id, auth.uid(), TG_TABLE_NAME, v_record_id, TG_OP, v_old_data, v_new_data, now());

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP POLICY IF EXISTS audit_log_tenant_select ON audit_log;
DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log
  FOR SELECT USING (org_id = fn_current_org() AND fn_has_module('audit'));

--------------------------------------------------------------------------------
-- 6. Views run with the caller's rights
--------------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_product_costs WITH (security_invoker = true) AS
SELECT
  pc.id,
  pc.org_id,
  pc.product_id,
  p.code AS product_code,
  p.name AS product_name,
  p.form,
  p.color,
  pc.raw_onion_rate_per_kg,
  pc.processing_cost_per_kg,
  pc.packaging_cost_per_kg,
  (pc.raw_onion_rate_per_kg + pc.processing_cost_per_kg + pc.packaging_cost_per_kg) AS total_cost_per_kg,
  pc.effective_date,
  pc.updated_at
FROM product_costs pc
JOIN products p ON pc.product_id = p.id;

--------------------------------------------------------------------------------
-- 7. Grants: authenticated gets SELECT / INSERT / UPDATE / DELETE only
--------------------------------------------------------------------------------
-- TRUNCATE, REFERENCES and TRIGGER are not subject to RLS; they go away here and
-- stay away for tables created by later migrations (default privileges).

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- On Supabase the anon role also receives ALL on new tables by default. Our tables
-- carry no anon policies, but TRUNCATE would still bypass RLS, so anon gets nothing.
-- (Guarded: the role does not exist on plain Postgres.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
  END IF;
END $$;

-- Rows of these tables change only through SECURITY DEFINER functions / triggers.
REVOKE INSERT, UPDATE, DELETE ON profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON audit_log FROM authenticated;             -- fn_audit is SECURITY DEFINER
REVOKE INSERT, UPDATE, DELETE ON organizations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON doc_counters FROM authenticated;          -- fn_next_doc_no
REVOKE INSERT, UPDATE, DELETE ON entity_code_counters FROM authenticated;  -- fn_next_code
REVOKE INSERT, UPDATE, DELETE ON v_product_costs FROM authenticated;

--------------------------------------------------------------------------------
-- 8. Policies: SELECT = own org; writes = own org AND the module (contracts 2.2)
--------------------------------------------------------------------------------

-- 8a. Module-gated tables from 0001 / 0002.
-- Writers are additionally limited by role (contracts 11 A1 + security review 2):
-- * Catalog tables (products, packaging_types, price_list_items): owner / accountant. The
--   demo gives sales and operations the catalog module for the read-only Products list,
--   and a module-only gate would let them rewrite floor prices (the 0005 floor guard).
-- * buyers, buyer_contacts: owner / accountant / sales. Plant holds the buyers module for
--   reading only (flows.md 11, screens.md 0.1); credit days drive due dates and the Late
--   pill, and the primary phone receives the WhatsApp reminders (G2-02 / SEC2-03).
-- A row may point only at a parent of its own org (G2-03): a plain FK would accept another
-- org's buyer / product id and pin that row there.
DO $$
DECLARE
  r record;
  v_write text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('products',          'catalog',  '{owner,accountant}'::text[],       NULL),
      ('packaging_types',   'catalog',  '{owner,accountant}'::text[],       NULL),
      ('price_list_items',  'catalog',  '{owner,accountant}'::text[],
         'EXISTS (SELECT 1 FROM products p WHERE p.id = price_list_items.product_id AND p.org_id = fn_current_org())'),
      ('buyers',            'buyers',   '{owner,accountant,sales}'::text[], NULL),
      ('buyer_contacts',    'buyers',   '{owner,accountant,sales}'::text[],
         'EXISTS (SELECT 1 FROM buyers b WHERE b.id = buyer_contacts.buyer_id AND b.org_id = fn_current_org())'),
      ('business_settings', 'settings', NULL::text[],                       NULL),
      ('app_settings',      'settings', NULL::text[],                       NULL)
    ) AS t(tbl, module, roles, parent_check)
  LOOP
    v_write := format('org_id = fn_current_org() AND fn_has_module(%L)', r.module);
    IF r.roles IS NOT NULL THEN
      v_write := v_write || format(' AND fn_user_role() = ANY (%L::text[])', r.roles);
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.tbl || '_tenant_policy', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.tbl || '_select', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.tbl || '_insert', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.tbl || '_update', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.tbl || '_delete', r.tbl);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (org_id = fn_current_org())',
      r.tbl || '_select', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (%s)',
      r.tbl || '_insert', r.tbl, v_write || COALESCE(' AND ' || r.parent_check, ''));
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (%s) WITH CHECK (%s)',
      r.tbl || '_update', r.tbl, v_write, v_write || COALESCE(' AND ' || r.parent_check, ''));
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (%s)',
      r.tbl || '_delete', r.tbl, v_write);
  END LOOP;
END $$;

-- 8b. product_costs: only owner / accountant may read costs; writes need catalog + owner / accountant.
DROP POLICY IF EXISTS product_costs_tenant_policy ON product_costs;
DROP POLICY IF EXISTS product_costs_select ON product_costs;
DROP POLICY IF EXISTS product_costs_insert ON product_costs;
DROP POLICY IF EXISTS product_costs_update ON product_costs;
DROP POLICY IF EXISTS product_costs_delete ON product_costs;
CREATE POLICY product_costs_select ON product_costs
  FOR SELECT USING (org_id = fn_current_org() AND fn_user_role() IN ('owner', 'accountant'));
CREATE POLICY product_costs_insert ON product_costs
  FOR INSERT WITH CHECK (org_id = fn_current_org() AND fn_has_module('catalog') AND fn_user_role() IN ('owner', 'accountant'));
CREATE POLICY product_costs_update ON product_costs
  FOR UPDATE
  USING (org_id = fn_current_org() AND fn_has_module('catalog') AND fn_user_role() IN ('owner', 'accountant'))
  WITH CHECK (org_id = fn_current_org() AND fn_has_module('catalog') AND fn_user_role() IN ('owner', 'accountant'));
CREATE POLICY product_costs_delete ON product_costs
  FOR DELETE USING (org_id = fn_current_org() AND fn_has_module('catalog') AND fn_user_role() IN ('owner', 'accountant'));

-- 8c. profiles: read own org, plus always your own row; writes only via
-- fn_set_user_access / fn_set_user_active. fn_current_org() is NULL for a switched-off
-- login, so without `id = auth.uid()` that user could not read their own profile, the app
-- treated them as logged out and looped login -> / -> login instead of showing
-- /account-inactive (security review 1, SEC1-01). Own row only: no other row leaks.
DROP POLICY IF EXISTS profiles_tenant_policy ON profiles;
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (org_id = fn_current_org() OR id = auth.uid());

-- 8d. organizations: read own org only.
DROP POLICY IF EXISTS organizations_tenant_policy ON organizations;
DROP POLICY IF EXISTS organizations_select ON organizations;
CREATE POLICY organizations_select ON organizations
  FOR SELECT USING (id = fn_current_org());

-- 8e. Counters: read own org; rows move only inside fn_next_code / fn_next_doc_no.
DROP POLICY IF EXISTS doc_counters_tenant_policy ON doc_counters;
DROP POLICY IF EXISTS doc_counters_select ON doc_counters;
CREATE POLICY doc_counters_select ON doc_counters
  FOR SELECT USING (org_id = fn_current_org());

DROP POLICY IF EXISTS entity_code_counters_tenant_policy ON entity_code_counters;
DROP POLICY IF EXISTS entity_code_counters_select ON entity_code_counters;
CREATE POLICY entity_code_counters_select ON entity_code_counters
  FOR SELECT USING (org_id = fn_current_org());

--------------------------------------------------------------------------------
-- 9. Column-level lock template (contracts 2.2) for later migrations
--------------------------------------------------------------------------------
-- Status columns on module-gated tables are changed only by their state function.
-- Keep the row policy, then narrow the UPDATE grant to the editable columns:
--
--   REVOKE UPDATE ON <t> FROM authenticated;
--   GRANT UPDATE (<editable columns>, updated_at) ON <t> TO authenticated;
--
-- 0004 applies it to inquiries (status, lost_reason, closed_at locked), follow_ups
-- (done, done_at, done_by locked), 0005 to samples and quotations. The contract
-- defines no status function for buyers.status, so that column stays editable by
-- holders of the buyers module with the owner / accountant / sales role (8a).
