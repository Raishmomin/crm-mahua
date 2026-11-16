# Security review 1 — Sprint A (Mahuva CRM)

Reviewer: security agent. Date: 2026-11-13. Repo: `/home/raish/raish/mahua-crm`, branch `master`, working tree as left by Dev-1/Dev-2/Dev-3 after Sprint A (no source file edited by this review; only this file was written).

Database used for every SQL proof: plain Postgres 17.10 in container `onion-crm-postgres`, `127.0.0.1:5432/onion_crm`, migrations 0000-0003 + seed `01_core.sql` applied. No Supabase stack and no hosted credentials exist, so everything that needs GoTrue / PostgREST is listed under **Blocked** and was not counted as a failure.

Impersonation method for all "as user X" statements: `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '<uid>', false);` with the seed ids `22222222-2222-4222-8222-22222222222{1 owner, 2 accountant, 3 sales, 4 operations}`. Every mutating probe was either expected to fail or wrapped in `BEGIN … ROLLBACK`; section H of the attack script confirmed nothing persisted (floor_price = 1 rows: 0, bank rows: 2, profiles unchanged).

## Verdict

**PASS with findings.** Tenant isolation (Wall 1) and the module walls hold against every attack in `docs/research/product-gap-analysis.md` section 8 and `docs/design/contracts.md` 2.4 / section 11 (A1, A3, A4, A5). No blocker. One **high** functional/security gap (a switched-off login can never reach `/account-inactive`, SEC1-01), one **major** spec gap (Home page is not behind `requireModule('dashboard')`, SEC1-02), the rest minor/info. All findings are routed by the Sprint A ownership map.

## Checks run (real output tails)

| # | Check | Result | Output tail |
|---|---|---|---|
| 1 | `npm run ci:tenant-check` | pass | `✅ CI Tenant Check PASSED: every public table has org_id, an index, ENABLE + FORCE RLS and an org policy; every view is security_invoker; web roles hold no TRUNCATE / REFERENCES / TRIGGER; all SECURITY DEFINER functions are allowlisted; number generators are locked.` |
| 2 | `npm test` (vitest, `fileParallelism: false` is now in `vitest.config.ts`) | pass | `✓ tests/security-fixes.test.ts (17 tests) 762ms` / `✓ tests/rls-tenant-isolation.test.ts (5 tests) 369ms` / `Test Files 2 passed (2)` / `Tests 22 passed (22)` |
| 3 | `npm run typecheck` | pass | `> tsc --noEmit` (exit 0, no errors) |
| 4 | `npm run lint` | pass | `✔ No ESLint warnings or errors` |
| 5 | SQL inventory: policies / grants / definers / views / RLS flags (`01_inventory.sql`) | pass | 37 policies, 0 with `cmd = ALL`; every policy references `fn_current_org()`; all 12 SECURITY DEFINER functions have `proconfig = {search_path=public}`; `authenticated` holds exactly `SELECT` on audit_log, doc_counters, entity_code_counters, organizations, profiles, v_product_costs and `DELETE,INSERT,SELECT,UPDATE` elsewhere; `anon` holds nothing; all 13 tables `relrowsecurity = t, relforcerowsecurity = t`; `v_product_costs reloptions = {security_invoker=true}`; `fn_current_fy provolatile = s` |
| 6 | SQL attacks as sales (`02_attacks.sql` section A) | pass | `UPDATE profiles … WHERE id = auth.uid()` → `ERROR: permission denied for table profiles`; `v_product_costs_rows 0`, `product_costs_rows 0`; `TRUNCATE audit_log` / `TRUNCATE buyers` → `permission denied`; `UPDATE price_list_items SET floor_price = 1` → `UPDATE 0`; `UPDATE business_settings SET bank_details='[]'` → `UPDATE 0`; `fn_next_code('INQ')` / `fn_next_doc_no('QTN')` → `permission denied for function`; `audit_rows_sales 0`; after `set_config('app.current_org', <other>)` → `fn_current_org() = 11111111-…` (own org); after `set_config('app.override_module_check','true')` → `fn_require_module('payments')` → `ERROR: Access denied: module payments is required`; `fn_set_user_access` / `fn_set_user_active` → `Access denied: module users is required`; cross-org `INSERT INTO buyers (org_id = f2f2…)` and `UPDATE buyers SET org_id = f2f2…` → `new row violates row-level security policy for table "buyers"` |
| 7 | SQL attacks as operations (section B) | pass | `UPDATE price_list_items SET floor_price = 1` → `UPDATE 0`; `UPDATE business_settings …` → `UPDATE 0`; `v_product_costs_ops 0`; `DELETE FROM products` → `DELETE 0`; `INSERT INTO products` → `new row violates row-level security policy`; `audit_rows_ops 0`; held module works: `UPDATE buyers SET updated_at = now()` → `UPDATE 4` (rolled back) |
| 8 | SQL as owner (section C) | pass | `v_product_costs_owner 6`; `audit_rows_owner 143`; `UPDATE price_list_items` → `UPDATE 12` (rolled back); direct `UPDATE profiles` → `permission denied for table profiles` (writes only through the functions); `fn_set_user_access(self)` → `ERROR: self_change`; bad role / bad module / NULL active → `ERROR: bad_payload DETAIL: role|modules|active`; unknown user → `ERROR: not_found`; owner demotes ops → `accountant {dashboard,users}` (rolled back) |
| 9 | SQL as a non-owner holding `users` (section D, accountant given `users` inside a rolled-back txn) | pass | grant owner → `ERROR: role_not_allowed`; demote the only owner → `ERROR: last_owner`; deactivate the only owner → `ERROR: last_owner` |
| 10 | SQL as anon / no session (sections F, G) | pass | anon `SELECT FROM buyers` → `permission denied for table buyers`; anon `fn_has_module` → `permission denied for function`; authenticated without sub: `auth.uid() NULL, fn_current_org() NULL, fn_user_role() NULL, fn_has_module false, buyers_no_session 0` |
| 11 | SQL: switched-off login can read its own profile (section E) | **fail** | after `UPDATE profiles SET is_active = false WHERE id = ops` (rolled back): `fn_current_org() NULL, fn_is_active f, fn_user_role NULL`, `own_profile_rows_visible_when_inactive 0` → SEC1-01 |
| 12 | SQL: audit_log holds no `product_costs` rows and no `bank_details` snapshots | **fail** (legacy rows only) | `product_costs_audit_rows 18` (newest `2026-11-12 06:16 UTC`, i.e. before 0003 was first applied), `bank_details_in_audit 2` (`2026-10-30`, `2026-11-12 06:16`); the row written after 0003 (`2026-11-13 05:44`) has `new_has_bank f, old_has_bank f` → SEC1-03 |
| 13 | Demo password hashes on the local shim | pass | all 4 `@mahuvacrm.com` users: `len 60`, `pw_ok t`, prefix `$2a$10$` |
| 14 | Secrets in git | pass | `git ls-files \| grep -iE '\.env\|secret\|\.pem\|\.key$'` → only `.env.example`; `git check-ignore -v .env.local` → `.gitignore:26:.env*.local`; `git log --all -- .env.local .env` → empty; grep for JWT-shaped strings / `sb_secret` / pooler passwords over the tree (excluding node_modules/.next/.git) → only `.env.example:10:SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here`; `.env.local` anon/service keys match the placeholder regex in `scripts/seed-users.ts` |
| 15 | Next.js static review (grep + read) | pass | no `dangerouslySetInnerHTML`; `src/lib/supabase/admin.ts` has `import 'server-only'` and is imported nowhere under `src/` (only `scripts/seed-users.ts` builds its own service client); `redirect()` targets are the four literals `/login`, `/account-inactive`, `/access-denied` (lib/auth.ts) and `/login` (dashboard layout); no `next=`/`returnTo` parameters anywhere; `searchParams` is read once (`todo === 'all'`); every `wa.me` / `tel:` href goes through `src/lib/phone.ts` (digits only in the path, `encodeURIComponent(text)` in the query); `lang` cookie is validated by `isLang` on write (`i18n-actions.ts:8`) and `toLang` on read (`i18n-server.ts:11`, `not-found.tsx:9`); all four `'use server'` actions take `unknown`, parse with Zod, and (except `setLangAction`, which only writes the validated cookie) check `hasModule` before any DB call; no `process.env` in client components |

Scratch scripts with the full SQL are in the session scratchpad (`01_inventory.sql`, `02_attacks.sql`, `03_more.sql`, `04_a9.sql`); the essential statements are repeated in the appendix so anyone can replay them.

## Review item 1 — migration 0003 vs contracts 2.4 / section 11 / gap-analysis section 8

Every item is present and proven by SQL (table above, rows 5-10):

| Contract 2.4 item | Where in 0003 | Proof |
|---|---|---|
| `fn_has_module` STABLE SECURITY DEFINER, never raises, NULL → false, EXECUTE to authenticated | lines 96-121 | `fn_has_module(NULL) = f`, sales `fn_has_module('audit') = f`, anon cannot execute (REVOKE FROM PUBLIC) |
| `fn_user_role` | 124-137 | sales → `sales`, ops → `operations`, no session → NULL |
| `fn_assign_code` / `fn_assign_doc_no` triggers, only when NULL | 149-196 | test `fn_assign_code fills codes from a BEFORE INSERT trigger…` passes; not executable by authenticated (`auth_exec f`) |
| `fn_set_user_access` rules (users module, self_change, owner grants owner, last_owner, bad_payload subset of 13 keys) | 202-255 | rows 8-9; SQLSTATE split per A4 (42501 for self_change/role_not_allowed/not_found, P0001 for last_owner/bad_payload) matches `users/actions.ts` mapping |
| `fn_set_user_active` | 257-298 | rows 8-9 |
| profiles: REVOKE writes, SELECT org-scoped | 401, 477-480 | sales/owner direct UPDATE/INSERT/DELETE → `permission denied` |
| Grants: SELECT/INSERT/UPDATE/DELETE only, default privileges, audit_log read-only | 384-406 | `pg_default_acl` for postgres in public: tables `arwd`, seq `rwU`, functions `X`; `has_table_privilege` matrix shows no TRUNCATE/REFERENCES/TRIGGER |
| Generators revoked | 143 | `permission denied for function fn_next_code` |
| `v_product_costs` security_invoker | 360-376 | `reloptions {security_invoker=true}`; sales/ops 0 rows, owner 6 |
| audit_log gated by `audit`; `fn_audit` strips `bank_details`, skips `product_costs` | 304-354 | sales/ops 0 rows; post-0003 business_settings row has no `bank_details`; legacy rows remain (SEC1-03) |
| GUC overrides only for trusted callers | 27-86 | row 6: overrides ignored as authenticated; test `session GUC overrides are ignored for web sessions, honoured for trusted scripts` passes. Implementation reads `current_setting('role')` (the SET ROLE value, which is what PostgREST sets with `SET LOCAL ROLE`) falling back to `session_user`; contract wording `current_user` would not work inside a definer, Dev-2's deviation is correct |
| `fn_current_fy` STABLE | 89 | `provolatile s` |
| Per-table write policies with `fn_has_module`, A1 owner/accountant on catalog | 417-474 | policy dump: every write policy on products/packaging_types/price_list_items/product_costs carries `fn_has_module('catalog') AND fn_user_role() = ANY(ARRAY['owner','accountant'])`; buyers/buyer_contacts → `buyers`; business_settings/app_settings → `settings`; `product_costs_select` additionally owner/accountant; no leftover `FOR ALL` policy on any table |

SECURITY DEFINER hygiene: all 12 definers (`fn_current_org, fn_is_active, fn_require_module, fn_has_module, fn_user_role, fn_next_code, fn_next_doc_no, fn_audit, fn_assign_code, fn_assign_doc_no, fn_set_user_access, fn_set_user_active`) have `SET search_path = public`; the two that write rows for a user (`fn_set_user_access`, `fn_set_user_active`) filter `WHERE id = p_user AND org_id = v_org` with `v_org := fn_current_org()` and return `not_found` for foreign ids (row 8); the generators derive the org from `fn_current_org()` and raise when it is NULL.

Supabase compatibility of 0003 (by reading): no statement touches schema `auth`, no `CREATE OR REPLACE` of `auth.uid()`, no `ALTER`/`COMMENT` on objects we do not own; only public functions/policies/grants and `ALTER DEFAULT PRIVILEGES` of the current role. The `anon` block is guarded by role existence. See SEC1-04 for the one hosted-only gap.

## Review item 2 — migrations 0000 and 0001

- 0000 is a no-op on Supabase: `to_regclass('auth.users')` and `to_regclass('auth.identities')` both non-NULL → situation 3 (no table DDL); roles exist → skipped; `GRANT USAGE ON SCHEMA auth` is wrapped in `EXCEPTION WHEN insufficient_privilege` → NOTICE only. `CREATE SCHEMA IF NOT EXISTS auth` and `CREATE EXTENSION IF NOT EXISTS pgcrypto` only emit notices when present. Locally the shim was upgraded (situation 2: `auth.users` comment is empty, `auth.identities` exists) and `01_core.sql` still detects "local" via `identities exists AND no supabase_auth_admin role`.
- 0001 lines 9-32 create `auth.uid()` / `auth.jwt()` only when absent (`pg_proc` check). Locally both are owned by `postgres` and read `request.jwt.claim.sub` / `request.jwt.claims`.
- A3 applied: 0001 lines 40-45 grant `SELECT, INSERT, UPDATE, DELETE` on tables and the same via `ALTER DEFAULT PRIVILEGES … ON TABLES`; `ALL` remains only on sequences and routines (SEC1-11, info). Verified end state: no TRUNCATE for any web role (ci:tenant-check, privilege matrix).
- 0001 still re-creates the `FOR ALL` policies and the org-only `audit_log_tenant_select` on every run; 0003 drops all of them by name (verified: 0 `cmd = ALL` policies after a full `npm test` re-apply).

## Review item 3 — seed and secrets

- Local shim: `01_core.sql` lines 56-98 write `crypt('DemoPass123!', gen_salt('bf', 10))` plus `auth.identities` rows; verified `len 60 / pw_ok t` for all four.
- Supabase path: `v_local_shim` is false when `supabase_auth_admin` exists, so the SQL seed never writes `auth.users`; `scripts/seed-users.ts` uses `auth.admin.createUser` with the fixed ids and skips when the URL/keys match the placeholder regex (true for the current `.env.local`).
- `git ls-files` does not include `.env.local` (ignored by `.env*.local`), no env file ever committed (`git log --all`), no real key anywhere in docs/README/scripts. The demo password appears in README, `docs/setup/hosted-supabase.md`, the seed and `login-form.tsx`; acceptable for the demo, and the hosted doc has the rotation checklist.
- `NEXT_PUBLIC_DEMO_MODE` gates the "Try as" **buttons** server-side (`login/page.tsx:8` passes `demo` as a prop) but the literal stays in the client bundle (SEC1-06).

## Review item 4 — Next.js layer

- `src/middleware.ts`: `createServerClient` with `getAll`/`setAll`, `auth.getUser()` in try/catch, matcher excludes `_next/static`, `_next/image`, `favicon.ico` and image extensions; no redirects (pages call `requireAuth`/`requireModule`). Correct updateSession pattern; the cookie write-back cannot be exercised without GoTrue (blocked).
- `src/lib/supabase/server.ts`: `getAll`/`setAll` with the Server-Component try/catch; `client.ts` is the plain `createBrowserClient`; no token handling in app code (cookies via `@supabase/ssr`).
- `src/lib/supabase/admin.ts`: `import 'server-only'`, not imported under `src/app` (grep).
- `users/actions.ts`: Zod (`uuid`, role enum, module keys from `ALL_MODULES`), `hasModule(profile,'users')`, self-change short-circuit, `rpc('fn_set_user_access'|'fn_set_user_active')`, `mapDbError` returns plain words and logs raw errors server-side only. Good. (SEC1-08 for duplicates/length.)
- `home-actions.ts`: `z.object({ id: z.string().uuid() })`, `hasModule(profile,'dashboard')`, `rpc('fn_follow_up_done')`, `mapDbError`. Good.
- `settings/actions.ts`: Zod with GSTIN/IFSC regexes, `hasModule(profile,'settings')`, `org_id: profile.org_id` (org lock), upsert on `org_id`. No client-supplied org id is trusted anywhere; RLS additionally requires `settings`. (SEC1-07 for max lengths.)
- `login-form.tsx`: `signInWithPassword` then `router.push('/')`; no redirect parameter → no open redirect. `localStorage` stores only the last email.
- `lang` cookie: validated on both sides; `SameSite=Lax`, not sensitive.
- Pages: `/users` and `/settings` call `requireModule`; `/access-denied` calls `requireAuth`; `/account-inactive` intentionally does not; `(print)/layout.tsx` calls `requireAuth` (print pages must still call `requireModule`, none exist yet). `/` calls only `requireAuth` (SEC1-02).

## Review item 5 — `scripts/ci-tenant-check.ts`

Read lines 59-222 and ran it (row 1). It fails on: a view without `security_invoker=true` (regex on `reloptions`, lines 139-155), any TRUNCATE/REFERENCES/TRIGGER held by `authenticated` or `anon` on any public relation (`has_table_privilege`, lines 157-182, so grants via PUBLIC are caught too), any `prosecdef` function outside `SECURITY_DEFINER_ALLOWLIST` (184-199), and EXECUTE on `fn_next_code`/`fn_next_doc_no` for a web role (201-220). Dev-2's report shows all four regressions planted and caught. Gap: it does not assert `SET search_path` on definers (SEC1-09).

## Findings

Severity: blocker = demo cannot run or data/security hole; high = wrong behaviour or security weakness; major = spec violation visible to the user; minor = polish; info = note.

### SEC1-01 · high · dev2 · `supabase/migrations/0003_security_fixes.sql:479-480` (`profiles_select`)

**What happens:** `profiles_select USING (org_id = fn_current_org())` and `fn_current_org()` returns NULL when the caller's row has `is_active = false`. A switched-off user therefore cannot read **their own** profile (proof: section E, `own_profile_rows_visible_when_inactive 0`). In the app `getCurrentProfile()` then returns `null`, `requireAuth()` and `(dashboard)/layout.tsx:14` redirect to `/login`, and the user can sign in again successfully only to be bounced back to `/login` with no message. Screen 26 "Your login is switched off" (`screens.md` section 26, `account-inactive/page.tsx`) is unreachable, and the Staff "Login Off" demo step looks broken. The layout branch for `!profile.is_active` (`layout.tsx:18-24`) is dead code until this is fixed. Not a data leak (an inactive user sees nothing), but wrong behaviour on a demo path.

**Fix (one policy, idempotent):**
```sql
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (org_id = fn_current_org() OR id = auth.uid());
```
A switched-off user then reads exactly one row (their own) and every other table stays hidden because `fn_current_org()` is still NULL. Add to `tests/security-fixes.test.ts`: deactivate a fixture user as postgres, `actAs` them, expect `SELECT * FROM profiles` → 1 row with `is_active = false` and `SELECT count(*) FROM buyers` → 0. Dev-3 needs no change: `requireAuth` already sends an inactive profile to `/account-inactive`.

### SEC1-02 · major · dev3 · `src/app/(dashboard)/page.tsx:40`

**What happens:** Home calls `requireAuth()` instead of `requireModule('dashboard')`. `contracts.md` 6.1 ("Every `page.tsx` starts with `const profile = await requireModule('<key>')`", Home = `dashboard`) and `screens.md` 0.1 (row 2) require the module. Today every seeded user holds `dashboard`, so nothing is visible, but a user whose `dashboard` module is removed in the Staff screen still gets the KPI tiles (`v_home_kpis` is a 0006 view with no module condition) and the Done action is gated on `dashboard` (`home-actions.ts:16`) while the page is not — Wall 2 and Wall 3 disagree.

**Fix:** `const profile = await requireModule('dashboard');` (one-line change; `hasModule` import stays).

### SEC1-03 · minor · dev2 · `supabase/migrations/0003_security_fixes.sql:304-349` (section 5)

**What happens:** 0003 stops new leaks but does not scrub rows already in `audit_log`. On `onion_crm` the audit module holders (owner, accountant) can still read 18 `product_costs` snapshots (`raw_onion_rate_per_kg` etc.) and 2 `business_settings` snapshots with full `bank_details` (`account_no`, `ifsc`) written before 0003 (rows 12 and C2: `owner_sees_product_costs_audit 18`, `owner_sees_bank_in_audit 2`). Both roles may read that data through the live tables anyway, so no new exposure, but the contract statement "audit_log contains no bank_details or product_costs rows" is false on the current database. A fresh hosted database is unaffected (0003 runs before any seed).

**Fix (idempotent, add after the policy in section 5):**
```sql
DELETE FROM audit_log WHERE table_name = 'product_costs';
UPDATE audit_log
   SET old_data = old_data - 'bank_details', new_data = new_data - 'bank_details'
 WHERE table_name = 'business_settings'
   AND (old_data ? 'bank_details' OR new_data ? 'bank_details');
```

### SEC1-04 · minor · dev2 · `supabase/migrations/0003_security_fixes.sql:143, 170, 196, 254, 297` (and contracts 2.3 template)

**What happens:** the REVOKEs name `PUBLIC` and `authenticated` only. Locally that is enough (`anon_exec = f` for all locked functions). On hosted Supabase the project's default privileges grant EXECUTE on every new public function to `anon` explicitly, and `REVOKE … FROM PUBLIC` does not remove an explicit grant, so `fn_next_code`, `fn_next_doc_no`, `fn_assign_*`, `fn_set_user_*` (and every 0004-0006 function that copies the template) become executable by `anon`. Each of them fails on `fn_current_org()` / `fn_require_module` for a caller without a profile, so no data path opens, but `ci:tenant-check` (check 5, which includes `anon`) will go red on the hosted database. Cannot be verified until credentials arrive.

**Fix:** append `, anon` to each REVOKE in 0003 (the role exists locally since 0000 and on Supabase, no guard needed) and change the contracts 2.3 template to `REVOKE ALL ON FUNCTION fn_x(...) FROM PUBLIC, anon;`. Optional hardening in `ci-tenant-check.ts`: fail when `anon` can execute any allowlisted SECURITY DEFINER function.

### SEC1-05 · minor · dev2 · `tests/helpers/db.ts:49-52` (`actAs`)

**What happens:** `actAs` sets only `request.jwt.claim.sub`, which the **local** `auth.uid()` reads. Supabase's real `auth.uid()` reads `request.jwt.claims ->> 'sub'`. Run against the hosted database the suite impersonates nobody: every "attack blocked" case passes vacuously (NULL uid → 0 rows / 42501) and every "allowed" case (`owner changes a sales user…`, `operations … owner and accountant can`) fails, so a real regression in a policy could hide behind the expected failures.

**Fix:** in `actAs` also run `set_config('request.jwt.claims', json_build_object('sub', $1, 'role', 'authenticated')::text, false)`; `resetRole` already clears both.

### SEC1-06 · minor · dev3 · `src/app/login/login-form.tsx:29-35`

**What happens:** `DEMO_PASSWORD = 'DemoPass123!'` and the four demo emails are module-level constants in a client component; `NEXT_PUBLIC_DEMO_MODE` only hides the buttons (`demo` prop), so the literal ships in `/_next/static/chunks/app/login/page.js` for every build (confirmed in the current `.next` output). Harmless for the demo; a problem the day the same build goes to a real client with the flag off (gap-analysis section 8, low).

**Fix:** derive the demo data from the inlined env so the minifier drops it: `const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? { password: 'DemoPass123!', users: { owner: {...}, ... } } : null;` and render/use `DEMO` only when non-null (drop the `demo` prop or keep it as the server-side guard).

### SEC1-07 · minor · dev3 · `src/app/(dashboard)/settings/actions.ts:17-43`

**What happens:** no `.max()` on any text field and no cap on `bank_details.length`; a `settings` holder can store megabytes per save in `business_settings` and in every `audit_log` snapshot (the snapshot keeps everything but `bank_details`), and the print layout later renders these fields. No cross-tenant effect.

**Fix:** `text.max(120)` for names/codes, `.max(500)` for `address`, `.max(32)` for `account_no`/`contact_phone`, `z.array(BankSchema).max(4)`.

### SEC1-08 · minor · dev2 · `src/app/(dashboard)/users/actions.ts:17-19` and `0003_security_fixes.sql:223-227`

**What happens:** `modules` is validated as "every element is a known key" and in SQL as `<@` the 13 keys; duplicates and arbitrary length pass both (`['dashboard','dashboard',…]` × 10 000 is stored verbatim). Only a `users` holder can do it, and `hasModule` still works, but it bloats `profiles` and the audit snapshot.

**Fix:** `z.array(z.string()).max(13)` plus `Array.from(new Set(modules))` before the RPC; in the function `p_modules := ARRAY(SELECT DISTINCT m FROM unnest(p_modules) m)` before the subset check.

### SEC1-09 · minor · dev2 · `scripts/ci-tenant-check.ts:184-199`

**What happens:** the allowlist check only compares names. A 0004-0006 definer added to the list but written without `SET search_path = public` would pass CI while being open to search-path hijacking by any role that can create objects in a schema earlier in the path.

**Fix:** in the same query select `p.proconfig` and add a violation when it does not contain `search_path=public` (`'search_path=public' = ANY(coalesce(proconfig, '{}'))`).

### SEC1-10 · info · dev2 · `0003_security_fixes.sql:234-237` (contract design residual)

Proof D4: a non-owner holding `users` may give any other non-owner `users`, `settings`, `audit`, `payments` (anything except role `owner`), and that colleague can return the favour, so two non-owners can grant each other every module. Dev-2 already recorded the sibling residual (demoting a non-last owner). Matches contracts 2.4 as written; if the team wants "only owners touch access", add to contracts: non-owners may only grant modules they themselves hold and may not change owners at all.

### SEC1-11 · info · dev1 · `supabase/migrations/0001_core_system.sql:42, 45`

`GRANT ALL ON ALL ROUTINES` and `ALTER DEFAULT PRIVILEGES … GRANT ALL ON ROUTINES TO authenticated` remain (A3 narrowed tables only). Consequence: every function created in 0004-0006 is executable by `authenticated` from the moment it exists, until its own `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO authenticated` lines run — which is also the intended end state for the RPC functions. Only an internal helper that forgets the template would be exposed. No action needed now; `ci:tenant-check` allowlist plus code review of 0004-0006 covers it.

### SEC1-12 · info · dev1 · `scripts/seed-users.ts:154`

Prints `Password for all four: DemoPass123! (demo only)` to stdout, so the demo password lands in any CI / terminal log. Fine for the demo; drop the literal from the log line before a client deployment.

## Blocked (waiting for hosted Supabase credentials)

1. Web login end to end (`signInWithPassword`, cookie session, `/` → Home as all four users, Staff "Login Off" → `/account-inactive` after SEC1-01).
2. `src/middleware.ts` token refresh and `setAll` write-back with a real GoTrue (only the code pattern was reviewed).
3. Migration 0000 situation 3 and the `insufficient_privilege` fallback on a real Supabase project; 0001's "function already exists" branch for `auth.uid()`.
4. 0003 on hosted: `pg_default_acl` after the per-schema REVOKE/GRANT, and whether `anon` holds EXECUTE on public functions (SEC1-04); re-run `npm run ci:tenant-check` against the hosted DATABASE_URL after seeding and again after 0004-0006.
5. `scripts/seed-users.ts` `createUser` / `updateUserById` path with fixed ids.
6. PostgREST behaviour of `current_setting('role')` inside the definers under `SET LOCAL ROLE authenticated` (verified locally with `SET ROLE`, which is the same mechanism).
7. Vitest against the hosted DB (needs SEC1-05 first).

## Usability notes (for QA, not security)

- When SEC1-01 is fixed, check the Gujarati copy of "Your login is switched off / Ask the owner" and the `Go to Login` button (it signs out and goes to `/login`).
- Staff screen error toasts from `users/actions.ts` are English only (Dev-3 already logged this); plain words, but a Gujarati user sees English on failure.
- `/access-denied` → "Go Home" → Home; if SEC1-02 is fixed and a user has no `dashboard` module, Home itself redirects to `/access-denied` again (loop by spec). Keep `dashboard` in every preset, or make `/access-denied` show "Sign out" when `dashboard` is missing.

## Appendix — replay statements (psql, connected as postgres to onion_crm)

```sql
-- impersonate
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222223', false);  -- sales (…224 ops, …221 owner, …222 accountant)
-- walls
UPDATE profiles SET role='owner' WHERE id = auth.uid();                 -- permission denied for table profiles
SELECT count(*) FROM v_product_costs;                                   -- 0 (sales / ops), 6 (owner / accountant)
TRUNCATE audit_log;                                                     -- permission denied
UPDATE price_list_items SET floor_price = 1;                            -- UPDATE 0 (sales / ops), UPDATE 12 (owner)
UPDATE business_settings SET bank_details = '[]'::jsonb;                -- UPDATE 0 (sales / ops)
SELECT fn_next_code('INQ');                                             -- permission denied for function
SELECT count(*) FROM audit_log;                                         -- 0 without the audit module
SELECT set_config('app.current_org','f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2',false); SELECT fn_current_org();  -- still 1111…
SELECT set_config('app.override_module_check','true',false); SELECT fn_require_module('payments');            -- 42501
INSERT INTO buyers (org_id, buyer_code, company_name, buyer_type) VALUES ('f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2','BUY-9999','evil','domestic_masala'); -- RLS violation
-- staff functions (as owner …221)
SELECT fn_set_user_access('22222222-2222-4222-8222-222222222221','owner',ARRAY['dashboard']);  -- self_change (42501)
SELECT fn_set_user_access('22222222-2222-4222-8222-222222222224','superuser',ARRAY['dashboard']); -- bad_payload (P0001)
-- last_owner / role_not_allowed: BEGIN; UPDATE profiles SET modules = modules || '{users}' WHERE id = '…222'; SET ROLE authenticated; set sub = …222;
--   SELECT fn_set_user_access('…224','owner',ARRAY['dashboard']);   -- role_not_allowed
--   SELECT fn_set_user_active('…221', false);                      -- last_owner
-- RESET ROLE; ROLLBACK;
-- SEC1-01 proof: BEGIN; UPDATE profiles SET is_active=false WHERE id='…224'; SET ROLE authenticated; set sub = …224;
--   SELECT count(*) FROM profiles WHERE id = auth.uid();          -- 0  (expected 1 after the fix)
-- RESET ROLE; ROLLBACK;
-- audit hygiene (as postgres): SELECT set_config('app.current_org','11111111-1111-4111-8111-111111111111',false);
--   SELECT count(*) FROM audit_log WHERE table_name='product_costs';                                   -- 18 today, 0 after SEC1-03
--   SELECT count(*) FROM audit_log WHERE table_name='business_settings' AND (new_data ? 'bank_details' OR old_data ? 'bank_details'); -- 2 today
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false), set_config('app.current_org','',false), set_config('app.override_module_check','',false);
```
