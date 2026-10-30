-- Migration 0001: Core System & Multi-tenant RLS Foundation
-- Architecture: Multi-tenant by org_id, Module-based access control, Read-only audit logging

-- 0. Ensure Auth schema & auth.uid() support for local postgres, tests, and Supabase
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
  GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;
END $$;

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  currency text NOT NULL DEFAULT 'INR',
  tax_mode text NOT NULL DEFAULT 'regular_gst', -- 'regular_gst', 'composition', 'export'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Profiles (Extends auth.users, maps user to org and holds module privileges)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'sales', -- 'owner', 'accountant', 'sales', 'operations'
  modules text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 3. App Settings (Key-value / operational configuration per org)
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_org_id ON app_settings(org_id);

-- 4. Business Settings (Legal entity, GSTIN, IEC, Factory Address, Bank details)
CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  company_name text NOT NULL,
  trade_name text,
  gstin text,
  iec_code text,
  pan text,
  fssai_no text,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL,
  country text NOT NULL DEFAULT 'India',
  bank_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  authorized_signatory text,
  contact_email text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_settings_org_id ON business_settings(org_id);

-- 5. Document Counters (Per org, per document type, per Indian financial year)
CREATE TABLE IF NOT EXISTS doc_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  doc_type text NOT NULL, -- 'QTN', 'PI', 'INV', 'REC', 'SDN'
  fy text NOT NULL,       -- e.g. '2627'
  current_val bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_doc_counters_org_type_fy UNIQUE (org_id, doc_type, fy)
);

CREATE INDEX IF NOT EXISTS idx_doc_counters_org_id ON doc_counters(org_id);

-- 6. Entity Code Counters (For business entity codes: INQ, SMP, QTN, ORD, BUY)
CREATE TABLE IF NOT EXISTS entity_code_counters (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prefix text NOT NULL,
  current_val bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, prefix)
);

CREATE INDEX IF NOT EXISTS idx_entity_code_counters_org_id ON entity_code_counters(org_id);

-- 7. Audit Log (Read-only immutable table capturing all row mutations)
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(org_id, table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(org_id, created_at DESC);

--------------------------------------------------------------------------------
-- HELPER FUNCTIONS & THREE-WALL ACCESS ENGINE
--------------------------------------------------------------------------------

-- fn_current_org: Resolves current active organization for the authenticated session
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
BEGIN
  -- Support session-level override for SQL tests and background scripts
  v_override := NULLIF(current_setting('app.current_org', true), '');
  IF v_override IS NOT NULL THEN
    RETURN v_override::uuid;
  END IF;

  SELECT org_id INTO v_org_id
  FROM profiles
  WHERE id = auth.uid() AND is_active = true
  LIMIT 1;

  RETURN v_org_id;
END;
$$;

-- fn_is_active: Verifies whether the calling user is active
CREATE OR REPLACE FUNCTION fn_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_active FROM profiles WHERE id = auth.uid()), false);
$$;

-- fn_require_module: Wall 1 (Database) permission enforcement
CREATE OR REPLACE FUNCTION fn_require_module(p_module text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_module boolean;
  v_override text;
BEGIN
  v_override := NULLIF(current_setting('app.override_module_check', true), '');
  IF v_override = 'true' THEN
    RETURN true;
  END IF;

  SELECT (p_module = ANY(modules)) INTO v_has_module
  FROM profiles
  WHERE id = auth.uid() AND is_active = true;

  IF v_has_module IS NOT TRUE THEN
    RAISE EXCEPTION 'Access denied: module % is required', p_module
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  RETURN true;
END;
$$;

-- fn_current_fy: Computes Indian Financial Year (April 1 to March 31, e.g. '2627')
CREATE OR REPLACE FUNCTION fn_current_fy(p_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_year int;
  v_month int;
  v_start_yy int;
  v_end_yy int;
BEGIN
  v_year := EXTRACT(YEAR FROM p_date)::int;
  v_month := EXTRACT(MONTH FROM p_date)::int;
  IF v_month >= 4 THEN
    v_start_yy := v_year % 100;
    v_end_yy := (v_year + 1) % 100;
  ELSE
    v_start_yy := (v_year - 1) % 100;
    v_end_yy := v_year % 100;
  END IF;
  RETURN LPAD(v_start_yy::text, 2, '0') || LPAD(v_end_yy::text, 2, '0');
END;
$$;

-- fn_next_code: Generates atomic sequential entity codes (INQ-0001, BUY-0001, ORD-0001)
CREATE OR REPLACE FUNCTION fn_next_code(p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_val bigint;
BEGIN
  v_org_id := fn_current_org();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No active organization found in context';
  END IF;

  INSERT INTO entity_code_counters (org_id, prefix, current_val, updated_at)
  VALUES (v_org_id, p_prefix, 1, now())
  ON CONFLICT (org_id, prefix)
  DO UPDATE SET current_val = entity_code_counters.current_val + 1, updated_at = now()
  RETURNING current_val INTO v_val;

  RETURN p_prefix || '-' || LPAD(v_val::text, 4, '0');
END;
$$;

-- fn_next_doc_no: Generates document numbers per org, doc_type, and Indian FY (e.g. QTN-2627-0001)
CREATE OR REPLACE FUNCTION fn_next_doc_no(p_doc_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_fy text;
  v_val bigint;
BEGIN
  v_org_id := fn_current_org();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No active organization found in context';
  END IF;

  v_fy := fn_current_fy();

  INSERT INTO doc_counters (org_id, doc_type, fy, current_val, updated_at)
  VALUES (v_org_id, p_doc_type, v_fy, 1, now())
  ON CONFLICT (org_id, doc_type, fy)
  DO UPDATE SET current_val = doc_counters.current_val + 1, updated_at = now()
  RETURNING current_val INTO v_val;

  RETURN p_doc_type || '-' || v_fy || '-' || LPAD(v_val::text, 4, '0');
END;
$$;

-- fn_audit: Generic trigger writing row mutation snapshots to audit_log
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

  INSERT INTO audit_log (org_id, user_id, table_name, record_id, action, old_data, new_data, created_at)
  VALUES (
    v_org_id,
    auth.uid(),
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    v_old_data,
    v_new_data,
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_tenant_policy ON organizations;
CREATE POLICY organizations_tenant_policy ON organizations
  FOR ALL USING (id = fn_current_org()) WITH CHECK (id = fn_current_org());

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_tenant_policy ON profiles;
CREATE POLICY profiles_tenant_policy ON profiles
  FOR ALL USING (org_id = fn_current_org()) WITH CHECK (org_id = fn_current_org());

-- App Settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_settings_tenant_policy ON app_settings;
CREATE POLICY app_settings_tenant_policy ON app_settings
  FOR ALL USING (org_id = fn_current_org()) WITH CHECK (org_id = fn_current_org());

-- Business Settings
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_settings_tenant_policy ON business_settings;
CREATE POLICY business_settings_tenant_policy ON business_settings
  FOR ALL USING (org_id = fn_current_org()) WITH CHECK (org_id = fn_current_org());

-- Doc Counters
ALTER TABLE doc_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_counters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doc_counters_tenant_policy ON doc_counters;
CREATE POLICY doc_counters_tenant_policy ON doc_counters
  FOR ALL USING (org_id = fn_current_org()) WITH CHECK (org_id = fn_current_org());

-- Entity Code Counters
ALTER TABLE entity_code_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_code_counters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_code_counters_tenant_policy ON entity_code_counters;
CREATE POLICY entity_code_counters_tenant_policy ON entity_code_counters
  FOR ALL USING (org_id = fn_current_org()) WITH CHECK (org_id = fn_current_org());

-- Audit Log (Read-only for tenant members with 'audit' module)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_tenant_select ON audit_log;
CREATE POLICY audit_log_tenant_select ON audit_log
  FOR SELECT USING (org_id = fn_current_org());

--------------------------------------------------------------------------------
-- AUDIT TRIGGERS ON BUSINESS TABLES
--------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_audit_app_settings ON app_settings;
CREATE TRIGGER trg_audit_app_settings
  AFTER INSERT OR UPDATE OR DELETE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

DROP TRIGGER IF EXISTS trg_audit_business_settings ON business_settings;
CREATE TRIGGER trg_audit_business_settings
  AFTER INSERT OR UPDATE OR DELETE ON business_settings
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

DROP TRIGGER IF EXISTS trg_audit_profiles ON profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_audit();
