-- Migration 0007: Hardening (Dev-2, Sprint C)
-- Spec: docs/design/contracts.md section 12, amendment A10 (SEC1-04, SEC1-09, SEC1-11, SEC2-09)
-- plus the legacy audit scrub SEC1-03 (docs/security/review-1.md).
--
-- * Runs after every other migration (filename order) and is re-runnable: 0001 re-grants
--   EXECUTE on every routine to authenticated on each run, so this file normalises the end
--   state each time. Only GRANT / REVOKE, default privileges and two audit_log statements.
-- * Valid on plain Postgres and on Supabase: the anon statements are guarded by the role's
--   existence; ALTER DEFAULT PRIVILEGES changes only the current role's defaults.
-- * End state for functions in schema public:
--     PUBLIC, anon     no EXECUTE on anything.
--     authenticated    EXECUTE on what web sessions reach: the helpers RLS policies, views,
--                      column defaults and SECURITY INVOKER functions call as the caller, and
--                      the RPCs the server actions call (list in section 3).
--                      No EXECUTE on the number generators, on any trigger function (a trigger
--                      fires without EXECUTE), on extension functions (pgcrypto lives in public
--                      on plain Postgres) or on helpers used only inside definers / by scripts.
--   scripts/ci-tenant-check.ts fails when this drifts (anon, search_path, app paths, locks).

--------------------------------------------------------------------------------
-- 1. Nobody executes by default: PUBLIC and anon lose EXECUTE on every routine
--------------------------------------------------------------------------------

REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon';
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 2. Locked for web sessions (authenticated)
--------------------------------------------------------------------------------
-- fn_next_code / fn_next_doc_no: only definers and the fn_assign_* triggers number rows (A5).
-- Trigger functions (fn_audit, fn_assign_*, fn_quote_item_guard, the totals triggers, ...):
--   derived from the catalog, so a new trigger function is locked too.
-- Extension members: pgcrypto's functions sit in public on plain Postgres; only seeds use them.
-- fn_is_active, fn_current_fy, fn_format_money: called only inside SECURITY DEFINER functions
--   or by trusted scripts, never by a web session (grep of src/, tests/ and the catalog).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND (
        p.prorettype = 'trigger'::regtype
        OR p.proname IN ('fn_next_code', 'fn_next_doc_no', 'fn_is_active', 'fn_current_fy', 'fn_format_money')
        OR EXISTS (
          SELECT 1 FROM pg_depend d
          WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
        )
      )
  LOOP
    EXECUTE format('REVOKE ALL ON ROUTINE %s FROM authenticated', r.fn);
  END LOOP;
END $$;

--------------------------------------------------------------------------------
-- 3. What web sessions reach keeps EXECUTE (authenticated)
--------------------------------------------------------------------------------
-- (a) Catalog-derived: every public function an RLS policy, a view, a column default or a
--     CHECK constraint depends on. These run as the caller (views are security_invoker), so
--     they must stay executable or every read and write fails. Today: fn_current_org,
--     fn_has_module, fn_user_role, fn_follow_up_module.
-- (b) Called as the caller inside SECURITY INVOKER RPCs (fn_quote_update_draft,
--     fn_sample_create): fn_current_org, fn_require_module, fn_sample_set_status.
-- (c) The RPCs the server actions call: grep -rhoE "rpc\('[a-z_]+'" src (17 names below).
-- Granted by name, so a changed signature keeps its grant; trigger functions and the number
-- generators are never granted here.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT p.oid::regprocedure AS fn
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prorettype <> 'trigger'::regtype
      AND p.proname NOT IN ('fn_next_code', 'fn_next_doc_no')
      AND (
        p.proname IN (
          -- (b) helpers
          'fn_current_org', 'fn_has_module', 'fn_user_role', 'fn_require_module', 'fn_follow_up_module',
          -- (c) RPCs: staff (0003), inquiries (0004), samples + quotes (0005), orders + money (0006)
          'fn_set_user_access', 'fn_set_user_active',
          'fn_inquiry_set_status', 'fn_follow_up_done',
          'fn_sample_create', 'fn_sample_set_status', 'fn_quote_send', 'fn_quote_reject', 'fn_quote_update_draft',
          'fn_quote_accept', 'fn_order_set_status', 'fn_order_set_packed', 'fn_order_dispatch',
          'fn_dispatch_tick', 'fn_dispatch_delivered', 'fn_payment_record', 'fn_order_advance_waiting'
        )
        OR EXISTS (                                                      -- (a)
          SELECT 1 FROM pg_depend d
          WHERE d.refclassid = 'pg_proc'::regclass
            AND d.refobjid = p.oid
            AND d.classid IN ('pg_policy'::regclass, 'pg_rewrite'::regclass,
                              'pg_attrdef'::regclass, 'pg_constraint'::regclass)
        )
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO authenticated', r.fn);
  END LOOP;
END $$;

--------------------------------------------------------------------------------
-- 4. Default privileges: a new function is executable by nobody until it is granted
--------------------------------------------------------------------------------
-- PUBLIC's EXECUTE default is global, so it can only be revoked globally (for the current
-- role). The schema-level defaults of 0001 (authenticated) and of Supabase (anon) go too:
-- every function migration already ends with REVOKE ... FROM PUBLIC; GRANT EXECUTE ... TO
-- authenticated where a web session needs it (contracts 2.3 template). 0001 re-adds its
-- authenticated default on each run before 0002-0006, so this changes nothing for them.

ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES REVOKE ALL ON FUNCTIONS FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon';
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 5. SEC1-03: legacy audit rows written before 0003 (cost rows, bank details)
--------------------------------------------------------------------------------
-- fn_audit (0003) skips product_costs and strips bank_details from business_settings, but rows
-- written before 0003 first ran still hold them. Re-runnable: a second run finds nothing.
-- Needs a role that bypasses RLS (audit_log has FORCE RLS and no DELETE / UPDATE policy):
-- postgres is superuser locally and BYPASSRLS on Supabase.

DELETE FROM audit_log WHERE table_name = 'product_costs';

UPDATE audit_log
SET old_data = old_data - 'bank_details',
    new_data = new_data - 'bank_details'
WHERE table_name = 'business_settings'
  AND (old_data ? 'bank_details' OR new_data ? 'bank_details');
