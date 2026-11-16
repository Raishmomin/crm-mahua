# Security review 1 — re-gate after the Sprint A fix round (Mahuva CRM)

Reviewer: security agent. Date: 2026-11-13. Repo: `/home/raish/raish/mahua-crm`, branch `master`, working tree as left by Dev-2 and Dev-3 after the fix round. No source file was edited by this re-gate; only this file was written. No state-changing git command was run.

Scope, as assigned: re-verify **only** the two security findings routed from `review-1.md` (SEC1-01, SEC1-02) by re-running the same SQL and code checks; new findings only if blocker or high. Database: plain Postgres 17.10 at `127.0.0.1:5432/onion_crm` (container `onion-crm-postgres`), migrations 0000-0003 + seed `01_core.sql`. No hosted Supabase and no GoTrue, so web login stays blocked exactly as in review 1. Impersonation: `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '<uid>', false);` with seed ids `22222222-2222-4222-8222-22222222222{1 owner, 2 accountant, 3 sales, 4 operations}`. Every mutating probe ran inside `BEGIN … ROLLBACK`; the persistence check at the end of the script shows all four profiles back to `is_active = t` and the live policy unchanged.

## Verdict

**FAIL (gate red), security findings both FIXED.**

- SEC1-01 (high, dev2): **fixed** — proven by SQL on the live database and by the new Vitest case.
- SEC1-02 (major, dev3): **fixed** — proven by reading `page.tsx` / `auth.ts` and by the check suite.
- One **new blocker** (SEC1-13, dev3, not a security hole): the working tree no longer type-checks and `next build` fails on `src/app/(dashboard)/users/user-table.tsx:82`. It is a cross-owner ordering artifact: Dev-2's F1 change to the `ActionResult` shape in `users/actions.ts` landed after Dev-3's green run (Dev-3's report shows 22 tests, Dev-2's later run 23). One-line fix, already named in Dev-2's notes. Until it lands the demo cannot be built, so the gate stays red even though the security work is done.

## Checks run (real output tails)

| # | Check | Result | Output tail |
|---|---|---|---|
| 1 | Live policy on `profiles` (`pg_policies`) matches 0003 section 8c lines 482-484 | pass | `profiles_select\|SELECT\|((org_id = fn_current_org()) OR (id = auth.uid()))\|` ; `relrowsecurity t, relforcerowsecurity t` |
| 2 | SEC1-01 SQL re-proof, positive (ops switched off in a rolled-back txn, then `SET ROLE authenticated` as ops) | pass | `uid 2222…224, org_when_inactive NULL, is_active_fn f, role_fn NULL, has_dashboard f` / `own_profile_rows_visible_when_inactive 1` / `total_profile_rows_visible_when_inactive 1, only_own_row t, shows_off t` / row: `…224 \| 1111… \| operations \| f` / `buyers 0, organizations 0, business_settings 0, products 0, audit_log 0` |
| 3 | SEC1-01 negative control (old qual `USING (org_id = fn_current_org())` recreated inside a rolled-back txn, same probe) | pass (old qual reproduces the bug) | `own_profile_rows_visible_when_inactive_old_policy 0` |
| 4 | SEC1-01 regression on an active user (sales) | pass | `profiles_visible_active_sales 4, distinct_orgs 1` |
| 5 | SEC1-01: switched-off user cannot switch itself back on | pass | `UPDATE profiles SET is_active = true WHERE id = auth.uid()` → `ERROR: permission denied for table profiles` |
| 6 | Nothing persisted after the script | pass | `profiles_select` qual unchanged; `…221 t, …222 t, …223 t, …224 t`; `orgs_total 1` |
| 7 | Policy / privilege inventory after the fix | pass | `policies_total 37, cmd_all 0, without_current_org 0, policies_using_auth_uid 1` (`profiles.profiles_select` only — the `OR id = auth.uid()` clause was not copied to any other table); `tables 13, all_rls t, all_force t`; `definers 12, all_search_path t`; `authenticated` UPDATE/INSERT/DELETE on profiles `f f f`; `anon` SELECT on profiles `f` |
| 8 | SEC1-02 code re-check | pass | `src/app/(dashboard)/page.tsx:4 import { hasModule, requireModule } from '@/lib/auth';` / `:40 const profile = await requireModule('dashboard'); // Wall 2 (contracts 6.1)`; `grep requireAuth` under `src/app`: only `(print)/layout.tsx:10`, `access-denied/page.tsx:10` (both intended), `account-inactive/page.tsx:7` (comment, intentionally none); `/users` → `requireModule('users')`, `/settings` → `requireModule('settings')` |
| 9 | SEC1-02 loop check | pass | `auth.ts:53-61` `requireModule` → `requireAuth` (inactive → `/account-inactive` before the module test) → `/access-denied` on a missing module; `access-denied/page.tsx` calls `requireAuth` only and never redirects to `/`; `home-actions.ts:19` still gates Done on `hasModule(profile,'dashboard')`, so Wall 2 on the page and on the action now agree |
| 10 | New Vitest case for SEC1-01 (`tests/security-fixes.test.ts:324-353`) | pass | asserts exactly `[{ id: OPS1, org_id: ORG1, is_active: false }]` from `SELECT … FROM profiles`, `fn_current_org()` NULL, buyers/organizations/business_settings 0, restores the user and checks 4 rows again |
| 11 | `npm test` | pass | `✓ tests/security-fixes.test.ts (18 tests) 427ms` / `✓ tests/rls-tenant-isolation.test.ts (5 tests) 271ms` / `Test Files 2 passed (2)` / `Tests 23 passed (23)` |
| 12 | `npm run ci:tenant-check` | pass | `✅ CI Tenant Check PASSED: every public table has org_id, an index, ENABLE + FORCE RLS and an org policy; every view is security_invoker; web roles hold no TRUNCATE / REFERENCES / TRIGGER; all SECURITY DEFINER functions are allowlisted; number generators are locked.` |
| 13 | `npm run lint` | pass | `✔ No ESLint warnings or errors` |
| 14 | `npm run typecheck` | **fail** | `src/app/(dashboard)/users/user-table.tsx(82,28): error TS2339: Property 'message' does not exist on type '{ ok: false; messageKey: string; detail?: string \| undefined; }'.` (exit 1) → SEC1-13 |
| 15 | `npx next build` (`next.config.mjs` has no `ignoreBuildErrors`) | **fail** | `✓ Compiled successfully` / `Linting and checking validity of types ...` / `Failed to compile.` / `./src/app/(dashboard)/users/user-table.tsx:82:28 Type error: Property 'message' does not exist …` (exit 1) → SEC1-13 |
| 16 | Secrets in git (re-run of review-1 check 14) | pass | `git ls-files \| grep -iE '\.env\|secret\|\.pem\|\.key$'` → only `.env.example`; `.env.local` ignored by `.gitignore:26:.env*.local`; grep for JWT / `sb_secret` / DSN-with-password over the tree → only the local default `postgres:postgres@127.0.0.1` DSN (docker-compose, README, .env.example, research docs) and `<placeholder>` DSNs |
| 17 | Regression read of Dev-2's reworked `src/app/(dashboard)/users/actions.ts` | pass | both actions still: Zod `safeParse` on `unknown` (`uuid`, role enum, module keys ⊆ `ALL_MODULES`) → `hasModule(profile,'users')` → self-change short-circuit → `rpc('fn_set_user_access' \| 'fn_set_user_active')` → `mapDbError`; failures now carry label keys only (no English sentence reaches the client); `profile!` is safe because `hasModule(null, …)` is `false` |

The full SQL for checks 2-6 is in the session scratchpad (`regate_sec1_01.sql`); the essential statements are repeated in the appendix.

## Finding status

### SEC1-01 · high · dev2 · `supabase/migrations/0003_security_fixes.sql:482-484` — **FIXED**

Was: `profiles_select USING (org_id = fn_current_org())`; a switched-off user read 0 rows of `profiles`, `getCurrentProfile()` returned `null`, and the app looped `login → / → login` instead of showing `/account-inactive`.

Now: section 8c drops `profiles_tenant_policy` and `profiles_select` and recreates `profiles_select FOR SELECT USING (org_id = fn_current_org() OR id = auth.uid())`. Re-proof on the live database (checks 2-6): the switched-off user reads exactly one row (their own, `is_active = f`) and 0 rows of buyers, organizations, business_settings, products and audit_log; `fn_current_org()`, `fn_user_role()` stay NULL and `fn_has_module('dashboard')` stays `false`, so every write policy and every `fn_require_module` call still refuses them; they cannot write their own row (`permission denied for table profiles`, writes go only through `fn_set_user_active`, which needs the `users` module of an *active* caller). The old qual, recreated in a rolled-back transaction, reproduces the original `0`. Active users are unaffected (sales still sees 4 own-org profiles, 1 org). The clause exists on `profiles` only (check 7: `policies_using_auth_uid 1`), matching Dev-2's note to Sprint B that it must not be copied to other tables.

App side (by reading, login still blocked): `requireAuth()` (`src/lib/auth.ts:41-43`) now receives the inactive profile and redirects to `/account-inactive`; `(dashboard)/layout.tsx:18-24` renders that page without menu and without touching `business_settings` / `organizations` (both hidden to an inactive caller); `account-inactive/page.tsx` reads only the lang cookie and offers Sign out; `hasModule()` (`auth.ts:49`) returns `false` for `is_active = false`, so every server action still returns access denied for such a user. New Vitest case passes (check 10, 11).

### SEC1-02 · major · dev3 · `src/app/(dashboard)/page.tsx:40` — **FIXED**

Was: Home called `requireAuth()`; a user without the `dashboard` module saw the KPI tiles while the Done action was gated on `dashboard`.

Now: line 4 imports `hasModule, requireModule`, line 40 is `const profile = await requireModule('dashboard'); // Wall 2 (contracts 6.1)`; no `requireAuth` remains in `page.tsx` (check 8). Wall 2 on the page and on `home-actions.ts:19` agree. No redirect loop: `/access-denied` keeps `requireAuth` and only links to `/` (check 9). Build-time proof that the page compiles with the new wall: `next build` reports `✓ Compiled successfully` before failing later on the unrelated type error (check 15); `npm test`, `ci:tenant-check`, `lint` green.

### SEC1-13 · blocker · dev3 · `src/app/(dashboard)/users/user-table.tsx:82` — **NEW**

**What happens:** Dev-2's F1 fix changed `ActionResult` in `users/actions.ts:14` to `{ ok: true; id?: string } | { ok: false; messageKey: string; detail?: string }` (contracts 6.2) but the only consumer still reads `result.message`. `npm run typecheck` exits 1 and `npx next build` fails at "checking validity of types" (checks 14-15), so no production build of the demo can be produced from this tree. Under `next dev` the page still runs, but every Staff-screen failure shows an empty error toast (`show('error', undefined)`), i.e. the user gets no words at all when a save is refused. Not a data or tenant hole; it is a blocker only because the demo cannot be built and the all-green claim in the Dev-3 fix report no longer holds for the merged tree (Dev-2's report already flagged this line as the one remaining error).

**Fix (one line, Dev-3 file):**
```ts
// src/app/(dashboard)/users/user-table.tsx:82
show('error', tt(result.messageKey));
```
Then re-run `npm run typecheck` and `npx next build`; both must exit 0. Note for whoever runs the next smoke: the failed build left `.next/` in a partial state, so do not trust a `next start` from it until a build succeeds.

### Other review-1 findings (SEC1-03 … SEC1-12)

Not in scope of this re-gate (minor / info, not assigned in the fix round); unchanged.

## Blocked (unchanged from review 1)

No hosted Supabase credentials, no GoTrue locally: the Login Off demo step (`/account-inactive` after being switched off), the Home access-denied path for a user without `dashboard`, the `@supabase/ssr` cookie refresh in `src/middleware.ts`, and the hosted-only items SEC1-04 / SEC1-05 remain unverified end to end. The SQL and page-level logic for SEC1-01 / SEC1-02 are proven; only the browser round-trip is pending.

## Usability notes (for QA, not security)

- Login Off: once credentials exist, switch a user off as owner, sign in as that user → expect the amber "login is switched off" screen with a Sign out button and no menu; the SQL equivalent is proven (own row only, `is_active = f`).
- Home without `dashboard`: "Go home" on `/access-denied` lands back on `/access-denied` for such a user (by spec, not an automatic loop); every seeded preset holds `dashboard`, so the demo script is unaffected.
- Staff screen error toasts: after SEC1-13 is fixed, re-check in Gujarati that every refusal (`self_change`, `last_owner`, `role_not_allowed`, `bad_payload`, `not_found`, access denied, generic save error) shows a translated label and never an empty toast.

## Appendix — replay statements (psql, connected as postgres to onion_crm)

```sql
-- SEC1-01 positive (rolled back)
BEGIN;
UPDATE profiles SET is_active = false WHERE id = '22222222-2222-4222-8222-222222222224';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222224', false);
SELECT fn_current_org(), fn_is_active(), fn_user_role(), fn_has_module('dashboard');   -- NULL, f, NULL, f
SELECT count(*) FROM profiles WHERE id = auth.uid();                                      -- 1  (was 0)
SELECT count(*) FROM profiles;                                                            -- 1  (own row only)
SELECT (SELECT count(*) FROM buyers), (SELECT count(*) FROM organizations),
       (SELECT count(*) FROM business_settings), (SELECT count(*) FROM audit_log);        -- 0 0 0 0
UPDATE profiles SET is_active = true WHERE id = auth.uid();                               -- permission denied for table profiles
RESET ROLE; ROLLBACK;
-- SEC1-01 negative control (rolled back)
BEGIN;
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT USING (org_id = fn_current_org());
UPDATE profiles SET is_active = false WHERE id = '22222222-2222-4222-8222-222222222224';
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222224', false);
SELECT count(*) FROM profiles WHERE id = auth.uid();                                      -- 0
RESET ROLE; ROLLBACK;
-- live state
SELECT policyname, qual FROM pg_policies WHERE tablename = 'profiles';                    -- profiles_select | ((org_id = fn_current_org()) OR (id = auth.uid()))
SELECT tablename||'.'||policyname FROM pg_policies WHERE schemaname='public'
   AND coalesce(qual,'')||coalesce(with_check,'') LIKE '%auth.uid()%';                    -- profiles.profiles_select only
```
