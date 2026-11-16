-- Migration 0000: auth schema shim for plain Postgres (no-op on Supabase)
--
-- Why: 0001 references auth.users(id). On a plain Postgres (docker compose,
-- CI, Vitest) there is no GoTrue, so we create a minimal auth.users and
-- auth.identities. On a real Supabase project both tables already exist and
-- are owned by supabase_auth_admin; there we touch nothing in the auth schema
-- except granting schema USAGE (which is already in place and is skipped on
-- permission errors).
--
-- Three situations:
--   1. auth.users missing                  -> fresh plain Postgres: create both tables
--   2. auth.users present, identities not  -> hand-made 7-column shim: add columns + identities
--   3. both present                        -> real Supabase: leave auth tables alone
--
-- Idempotent: safe to run any number of times.

CREATE SCHEMA IF NOT EXISTS auth;

-- pgcrypto gives crypt() / gen_salt() for the demo password hashes in the seed.
-- Already installed on Supabase (schema extensions); IF NOT EXISTS keeps it quiet.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_users_exists boolean := to_regclass('auth.users') IS NOT NULL;
  v_identities_exists boolean := to_regclass('auth.identities') IS NOT NULL;
BEGIN
  IF NOT v_users_exists THEN
    -- Situation 1: fresh plain Postgres
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      instance_id uuid,
      aud text,
      role text,
      email text,
      encrypted_password text,
      email_confirmed_at timestamptz,
      raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
      raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    COMMENT ON TABLE auth.users IS 'mahua-crm local auth shim';
  ELSIF NOT v_identities_exists THEN
    -- Situation 2: hand-made shim from an earlier setup; bring it up to the full column set
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS instance_id uuid;
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS aud text;
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS role text;
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email text;
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS encrypted_password text;
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_app_meta_data jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
  END IF;
  -- Situation 3 (both exist = Supabase): nothing to do on auth tables.

  IF NOT v_identities_exists THEN
    CREATE TABLE IF NOT EXISTS auth.identities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      provider text,
      provider_id text,
      identity_data jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

-- Roles that Supabase / PostgREST expect. On Supabase they already exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

-- auth.uid() / auth.jwt() (created in 0001 when absent) must be callable by the app roles.
-- On Supabase the grant is already in place; if the connected role may not grant on the
-- auth schema we only log a notice instead of failing the migration.
DO $$
BEGIN
  GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'auth schema grant skipped (not owner): %', SQLERRM;
END $$;
