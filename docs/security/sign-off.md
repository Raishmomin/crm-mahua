# Security sign-off: Sprint C (final gate before the demo)

Reviewer: security agent. Date: 2026-11-16 (17:20 to 17:35 IST run). Repo `/home/raish/raish/mahua-crm`, branch `master`, working tree as Dev-1, Dev-2 and Dev-3 left it after Sprint C. I edited no source file. I wrote only this file, `docs/qa/sprint-c/security-3.json` and the evidence under `docs/qa/sprint-c/security-3-evidence/`. I ran no git command that changes state.

Database: local Postgres 17 `127.0.0.1:5432/onion_crm`, migrations 0000-0007 and seeds 01-04. Impersonation: `SET ROLE authenticated` plus `request.jwt.claim.sub` and `request.jwt.claims`, using the seeded MDPL users `…221` owner, `…222` accountant, `…223` sales and `…224` operations. Org B (`bbbbbbbb-…0b`, with an owner, product, buyer, inquiry, quotes, order and payment) is built inside the same transaction. Every probe runs in one `BEGIN … ROLLBACK`. Hosted simulation ran on the scratch database `mahua_sc`, which was then dropped (0 databases and 0 roles left).

## Verdict

**PASS. The build is signed off for the demo. There are no blocker or high findings.**

I re-ran every attack from reviews 1 and 2, and all of them are still blocked. Every Sprint C security fix held up when I attacked it directly. A Supabase-like owner that is not a superuser but has BYPASSRLS runs the whole demo flow. Anon can execute nothing and read nothing.

Two minor security findings are left. Neither is a demo stopper:
- **SEC3-01:** an UPDATE route still lets staff rewrite other people's reminders.
- **SEC3-02:** nothing checks beforehand that the database owner bypasses RLS.

There is also one major UI regression caused by A6 (**SEC3-03**: Plant sees every buyer as "Paid"). Residual risks are listed at the end.

| ID | Sev | Owner | One line |
|---|---|---|---|
| SEC3-03 | major | dev1 | After A6, the buyers list shows every buyer as `₹0 · Paid` to Plant (the money view is empty for Plant, but the list still renders a pill). |
| SEC3-01 | minor | dev1 | The `follow_ups` UPDATE policy lets any user with the module change `note` / `due_on` on anyone's reminder, system reminders included. This gets around the A9 delete rule: sales can push "Balance $18,900 due" to 2099, and the owner's Home "to do today" drops from 5 to 3. |
| SEC3-02 | minor | dev2 | Nothing checks that the migration / function owner bypasses RLS. Under a NOBYPASSRLS owner, every request fails with `stack depth limit exceeded` (`fn_current_org` → profiles policy → `fn_current_org`). Supabase documents that postgres has bypassrls, so this is a guard for credentials day, not a live bug. |
| SEC3-04 | minor | dev1 | `seed-users.ts` falls back to the public `DemoPass123!` when `DEMO_PASSWORD` is unset, even when it creates real hosted Supabase users. It only warns. |
| SEC3-05 | info | dev3 | `fn_payment_record` refuses future dates but accepts any past date (`1900-01-01` was accepted). |
| SEC3-06 | info | dev3 (+dev2) | A6 hides payments and balances from Plant. Plant can still read money through the API: `orders.total` / `advance_expected`, quotes and items (`floor_price_at_time`), and the follow-up note text "Balance $18,900 due". This is in scope by contract, so it is the lead's decision. |
| SEC3-07 | info | dev2 | `npm test` cannot run against a Supabase-like (non-superuser) database: it gives 11 failures from `session_replication_role` and pgcrypto in `extensions`. Tests stay local-only, as the README says. |

## Checks run (real output tails)

| # | Check | Result | Output tail |
|---|---|---|---|
| 1 | `npm run ci:tenant-check` (onion_crm) | pass | `✅ CI Tenant Check PASSED: every public table has org_id, an index, ENABLE + FORCE RLS and an org policy; every view is security_invoker; web roles hold no TRUNCATE / REFERENCES / TRIGGER; all SECURITY DEFINER functions are allowlisted and pin search_path; number generators and trigger functions are locked; PUBLIC / anon execute no function; every function a policy, view or app RPC needs is executable by authenticated; new functions are granted to nobody by default.` |
| 2 | `npm test` | pass | `✓ quotes (29) ✓ orders-payments (28) ✓ inquiries (26) ✓ security-fixes (23) ✓ rls-tenant-isolation (5)` / `Test Files 5 passed (5)` / `Tests 111 passed (111)` |
| 3 | `npm run typecheck` | pass | `> tsc --noEmit`, exit 0, no output |
| 4 | `npm run lint` | pass | `✔ No ESLint warnings or errors` |
| 5 | Attack script `sec3-attacks.cjs onion_crm` (1 tx, rolled back) | pass, except SEC3-01 | Sections A1-H4 below |
| 6 | Hosted sim: Supabase-style default privileges + NOSUPERUSER BYPASSRLS owner, migrations + seed ×2 | pass | `Applying 8 migration(s)… ok 0007_hardening.sql … Seed completed.` (both runs) |
| 7 | Hosted sim: `ci:tenant-check` as that owner | pass | `CI tenant check against postgresql://sc_supa_postgres:****@127.0.0.1:5432/mahua_sc` / `✅ CI Tenant Check PASSED: …` |
| 8 | Hosted sim: demo-flow definers as impersonated users | pass | 0 errors. `fn_sample_create` → `SMP-0004`. `fn_quote_send` → `sent 178500.00`. `fn_quote_accept` → `ORD-0004 PI-2627-0004 confirmed adv 53550.00`. Ops `fn_order_set_status` / `fn_order_set_packed`, `advance_waiting t`. Accountant `fn_payment_record` → `advance_ok t`. Ops `advance_waiting f`, `fn_order_dispatch` → `t`. Sales `fn_follow_up_done('Balance ₹1,24,950 due')`. Owner `fn_quote_reject`, `fn_inquiry_set_status`, `fn_dispatch_tick`, `fn_dispatch_delivered` → `ORD-0002 delivered`. |
| 9 | Hosted sim: the same flow with the owner set to NOBYPASSRLS | fails (expected) | 30 × `ERROR: stack depth limit exceeded` (`fn_current_org -> profiles policy -> fn_current_org`). See SEC3-02. |
| 10 | Hosted sim: what anon holds | pass | `anon_exec_fns 0 \| public_exec_fns 0 \| auth_exec_fns 22 \| generators_auth 0`. anon table privileges: none. Function default ACL `{service_role=X}` (anon removed). anon → `permission denied for function fn_current_org / fn_follow_up_done / fn_payment_record / fn_next_code`, `permission denied for view v_home_kpis` |
| 11 | Hosted sim: attack script on mahua_sc | pass | Identical to onion_crm, except 34 routines (pgcrypto sits in `extensions`) and the audit row count |
| 12 | Hosted sim: SEC1-03 scrub as the non-superuser BYPASSRLS owner (0007 run twice) | pass | `sc_supa_postgres \| f \| t`. `cost_rows_before 3 \| bank_before 1` → `cost_rows_after 0 \| bank_after 0 \| kept_rest 1` |
| 13 | Client bundle (`.next` built 17:23 from the current tree) | pass | `.next/static files: 95`. The DEMO_PASSWORD value from .env.local: `0 files`. Service role key value: `0`. `DemoPass123!`: `0`. `mahuvacrm.com`: `0`. `DEMO_PASSWORD` / `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_DEMO_MODE` / `service_role`: `0`. Client components reading non-public env: `0` |
| 14 | Secrets in tracked and unignored files | pass | JWT-shaped / `sk_live`/`sk_test` / `sb_secret_`: `0 files`. Password literals other than the documented local default: `0 lines`. `DemoPass123!` in code: only `scripts/seed-users.ts` (fallback, SEC3-04) and `supabase/seed/01_core.sql` (local-shim branch only). `.env.local` ignored (`.gitignore:26 .env*.local`). Only `.env.example` is tracked. The service role key is read only in `src/lib/supabase/admin.ts` (`import 'server-only'`, imported by nothing in `src/`) and `scripts/seed-users.ts` |
| 15 | Try as server action (code + QA's direct POST evidence) | pass | `tryAsAction`: `DEMO_MODE !== 'true' \|\| !password` → `msg.access_denied_title`, then `z.enum(USER_ROLES)` → a fixed server-side email map. No email or password comes from the client. QA POST: DEMO_MODE=true `{"role":"superadmin"}` → `msg.err.bad_payload`. DEMO_MODE=false `{"role":"owner"}` → `msg.access_denied_title` |
| 16 | Seed story after every probe | pass | Owner `v_home_kpis`: `2 \| 1 \| 1 \| 511875.00 \| 18900.00 \| 2104200.00 \| 1 \| 5 \| 1` |
| 17 | Web login / PostgREST over HTTP / hosted `rolbypassrls` read | **blocked** | No Supabase stack and no hosted credentials |

## 1. Regression: review 1 and review 2 attacks (onion_crm, rolled back)

```
=== H1 sales: self_promote 42501 permission denied for table profiles | costs 0 | truncate_audit 42501 permission denied |
    floor_1 ok rows=0 | bank ok rows=0 | fn_next_code / fn_next_doc_no 42501 permission denied | audit_rows 0 | buyer_in_b 42501 RLS
    sales GUC override app.current_org=B -> current_org 11111111-… | b_orders 0
    ops module override -> require_payments / quote_accept 42501 Access denied | costs 0 | floor_1 rows=0 | buyers_upd rows=0  (SEC2-03)
=== H2 owner: self_change 42501 | bad_role P0001 bad_payload role | fourteen_modules / unknown_module P0001 bad_payload modules
    ops modules after duplicate grant {dashboard,orders,samples}                             (SEC1-08)
    accountant+users: make_owner 42501 role_not_allowed | switch_off_owner P0001 last_owner
=== H3 switched-off ops: profiles_visible 1 | buyers 0 | orders 0 | packed 42501 Access denied          (SEC1-01)
=== H4 org-B owner vs MDPL: orders 0 | payments 0 | audit 0 | profiles 0 | pay 42501 not_found | adv 42501 not_found |
    sample on MDPL buyer 42501 RLS | switch off MDPL sales 42501 not_found | edit MDPL draft 42501 not_found
=== E2 active sales: item at 1/kg P0001 below_floor_price | 125.00 ; switch to EUR P0001 below_floor_price | no_price  (SEC2-01)
=== C3 direct UPDATE of follow_ups.done / samples.status / quotations.total / inquiries.status -> 42501 permission denied
=== A6 authenticated INSERT/UPDATE/DELETE on orders, order_items, dispatches, payments, audit_log, money views -> all f
```
SEC1-02 (Home `requireModule('dashboard')`) holds. 31 of the 33 page.tsx files under `(dashboard)` and `(print)` call `requireModule(<key>)`, including the new `/payments/[id]` and its print page. The other two skip it on purpose: access-denied calls `requireAuth`, and account-inactive has no check. SEC2-04 holds: `safeInternalPath` parses with `new URL` and checks the origin plus a leading `//`. SEC2-02: the `SEC2-02` Vitest case passes, and web roles cannot run the generators (A3 `generators_auth f`).

## 2. Sprint C security items

| Item | Result | Evidence (attack → outcome) |
|---|---|---|
| SEC1-03 | fixed | A5 `product_costs_rows 0 \| bank_snapshots 0`; replay as a non-superuser BYPASSRLS owner: 3+1 planted → 0+0, other fields kept |
| SEC1-04 / SEC1-09 / SEC1-11 / SEC2-09 (A10) | fixed | A1 `routines 70 \| public_exec 0 \| anon_exec 0 \| auth_exec 22`; A3 `definers 27 \| no_search_path 0 \| anon 0 \| trigger_fns_auth 0 \| generators f`; A4 default ACL for functions `{postgres=X}` only. B1 anon calls all 70 routines with sub-select NULL args → `42501 permission denied for function \| 70`. B2 anon SELECT on all 29 tables/views → `42501 permission denied \| 29`. CI enforces this (check 7 and the hosted sim) |
| SEC1-05 | fixed | `tests/helpers/db.ts` actAs sets `request.jwt.claims`; the Vitest case passes; the attack script sets both and sees `auth.uid()` |
| SEC1-06 (A11) | fixed | Check 13 (bundle clean) and check 15 (4-role enum, DEMO_MODE gate, server-side emails) |
| SEC1-07 | fixed | `settings/actions.ts:16` `text(max)` on every field, `bank_details .max(MAX_BANK_ACCOUNTS)` |
| SEC1-08 | fixed | H2: 14 modules / unknown → `bad_payload modules`; duplicates stored once |
| SEC1-12 | fixed | seed-users prints only "the DEMO_PASSWORD you set (not printed)". The fallback is SEC3-04 |
| SEC2-05 / SEC2-11 (A9) | fixed for INSERT and DELETE | C1 as sales: inquiry won/quoted/lost_reason/closed_at/created_by=owner, follow-up done_by=owner / note as owner / pre-ticked / pending with done_at / no module, sample sent/approved/decided_on/created_by=owner, quote sent/sent_at/decided_at/reject_reason/created_by=owner → **all 42501 RLS**, and the controls save. C2: forged totals → `0.00 \| 0.00 \| 0.00 draft`. C3: delete "Balance $18,900 due", the owner's note, own pending reminder, approved / sent sample → `rows=0`; to_send sample → `rows=1`. C4: tick own system reminder, clear its date, delete → `DELETE 0`. C6: ops/accountant deletes → `rows=0`. **But C5: UPDATE remains open (SEC3-01)** |
| SEC2-06 | fixed | D1: 41 FK / definer paths as sales with an org-B id vs a random id → `same_as_random t` on every row, never `23503`, no gst/floor leak. D2: owner `fn_payment_record`, `fn_set_user_access`, `fn_set_user_active`, `SELECT payments by id` → identical |
| SEC2-07 | fixed | E1 switched-off sales (role NULL): item at 1/kg → `42501 not_found`; send → `Access denied: module quotes`; payment → `Access denied: module payments` |
| SEC2-08 (A8) | fixed | F1 accountant: tomorrow / +365 → `bad_payload received_on`; 563062.51 INR (>110%) / 1e12 / 20790.01 USD / 1 on paid ORD-0001 → `bad_payload over_payment`; exactly 110% INR and USD → ok. Owner: tomorrow refused, 2,000,000 INR override ok. Sales / ops → `Access denied: module payments`; ops direct INSERT → `permission denied`. Past date 1900-01-01 → ok (SEC3-05) |
| SEC2-10 (A6) | fixed (for its scope) | G1 operations: `payments 0 \| receipt_by_id 0 \| balances 0 \| money_due 0 \| kpis money 0.00/0.00/0.00/0 \| orders_in_production 1 \| audit 0 \| adv_wait_ord3 f`. Sales/accountant/owner unchanged (`4 \| 3 \| 2 \| 511875.00 \| 18900.00`). G2: residual through orders/quotes (SEC3-06) |

## 3. Hosted readiness

**(a) Definer owner.** The Supabase RLS guide says: *"On Supabase the owner is `postgres`, which has `bypassrls`"* and *"if you create a role with a superuser (like `postgres`), then that function will have `bypassrls` privileges"* (supabase.com/docs/guides/database/postgres/row-level-security, fetched 2026-11-16). The roles page says only "has admin privileges". So **BYPASSRLS on hosted postgres is documented. Its value on the actual project is still an assumption until credentials day.**

The simulation used `sc_supa_postgres`: NOSUPERUSER, BYPASSRLS, CREATEROLE, a member of anon / authenticated / service_role, and the owner of the database. That role applied every migration and seed, so it owns every table (FORCE RLS) and every definer. Results:
- The whole demo flow passed (check 8).
- The 0007 scrub works (check 12).
- With NOBYPASSRLS, everything breaks: `fn_current_org` itself recurses through the profiles policy, so this is not only the 0005/0006 definers that dev1/dev3 named (check 9). dev1's NOBYPASSRLS test changed only `fn_sample_set_status`'s owner, so it did not hit this. Hence SEC3-02.

On credentials day, before the demo, run as the migration connection:

`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;` → expect `f | t`

**(b) Supabase default privileges.** Before the migrations, `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES / FUNCTIONS / SEQUENCES TO anon, authenticated, service_role`. After 0000-0007:
- CI passes (check 7).
- anon executes 0 functions and holds no table privileges (check 10).
- All anon calls are refused (check 11).
- What is left in the default ACL: anon `rwU` on future **sequences** in public. There are 0 sequences in public today, so this has no effect.

One variant: when pgcrypto is installed in `public` by a superuser and the owner is not one (not the Supabase layout, where pgcrypto lives in `extensions`), 0007 cannot revoke pgcrypto's functions and CI fails. See `hosted-sim-ci-pgcrypto-in-public.out` from the earlier run on the same tree. Supabase pre-installs pgcrypto in `extensions`, so this is info only.

**(c) Secrets.** Checks 13 and 14: the service role key appears only in `src/lib/supabase/admin.ts` (marked `server-only`, imported nowhere in `src/`) and `scripts/seed-users.ts`. No secret is in any tracked file. `.env.local` is ignored.

`mahua_sc` and the role `sc_supa_postgres` are dropped: `mahua_sc_left 0 | role_left 0`.

## Findings

### SEC3-03 · major · dev1 · `src/app/(dashboard)/buyers/page.tsx:125-134` (`buyers/queries.ts:38`)
**What happens:** A6 empties `v_money_due` for operations, but the buyers list still shows a money fact and pill for every buyer. For Plant, every buyer reads `₹0 · Paid` (or `$0`), including the buyer whose $18,900 is late. Plant sees a wrong fact on screen. `buyers/[id]/page.tsx:45,125` already hides money with `isPlant`. Dev-3 reported this as an open issue, and it is still unfixed.
**Fix:** In `buyers/page.tsx`, compute `const isPlant = profile.role === 'operations'`. For Plant, pass no `fact2` / `badge` money pill and skip the overdue sort. In `queries.ts`, skip the `v_money_due` read when the caller is operations.

### SEC3-01 · minor · dev1 · `supabase/migrations/0004_inquiries_followups.sql:178-185` (`follow_ups_update`), grant at `:407`
**What an attacker can do:** Any user who holds the follow-up's module can `PATCH /rest/v1/follow_ups?id=eq.<id>` with `{"due_on":"2099-12-31"}` or a new `note` on rows they did not write, including system reminders. As sales (C5):
```
push Balance $18,900 due to 2099 | ok rows=1
rewrite Balance note text        | ok rows=1
rewrite owner plain note cc16    | ok rows=1   ('Owner says: OK to go below floor')
push owner buyer reminder cc05   | ok rows=1
owner Home after sales pushed the Balance reminder | followups_today 3 (was 5)
ops push_owner_order_reminder    | ok rows=1
```
This undoes the purpose of the A9 / SEC2-11 delete rule (a pushed reminder is in effect deleted) and allows an owner's note to be faked. `trg_audit_follow_ups` records the real `auth.uid()`. No app path UPDATEs `follow_ups`: every write is an insert or `fn_follow_up_done`.
**Fix:** Add the author/owner rule to both clauses:
```sql
CREATE POLICY follow_ups_update ON follow_ups FOR UPDATE
  USING (org_id = fn_current_org() AND fn_has_module(fn_follow_up_module(entity_type))
         AND (fn_user_role() = 'owner' OR (follow_ups.created_by = auth.uid() AND follow_ups.done_by IS NULL)))
  WITH CHECK (org_id = fn_current_org() AND fn_has_module(fn_follow_up_module(entity_type))
         AND (fn_user_role() = 'owner' OR (follow_ups.created_by = auth.uid() AND follow_ups.done_by IS NULL))
         AND (follow_ups.buyer_id IS NULL OR EXISTS (SELECT 1 FROM buyers b WHERE b.id = follow_ups.buyer_id AND b.org_id = fn_current_org())));
```
Add a Vitest case: sales UPDATE of "Balance $18,900 due" → 0 rows; own reminder → 1 row. The existing tests at `tests/inquiries.test.ts:245` and `:662` update the caller's own rows, so they still pass.

### SEC3-02 · minor · dev2 · `supabase/migrations/0007_hardening.sql:1-20`, `scripts/ci-tenant-check.ts`
**What happens:** If the role that owns the functions lacks both SUPERUSER and BYPASSRLS (a wrong connection string, a pooler user, or a future Supabase change), every request fails: `fn_current_org` → `profiles_select` → `fn_current_org` recursion (`stack depth limit exceeded`, 30 times in the simulated flow). The 0007 audit scrub would also quietly touch 0 rows. Nothing warns.
**Fix:** At the top of 0007, add:
```sql
DO $$ BEGIN
  IF NOT (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'migration owner % must be SUPERUSER or BYPASSRLS (definers read FORCE RLS tables)', current_user;
  END IF; END $$;
```
Also add a CI check 11: every `SECURITY DEFINER` function's owner has `rolsuper OR rolbypassrls`.

### SEC3-04 · minor · dev1 · `scripts/seed-users.ts:14-15`
**What happens:** With Supabase keys set and `DEMO_PASSWORD` empty, the four real hosted accounts (owner included) are created with `DemoPass123!`. That string is in the repo, `01_core.sql` and several docs. The script warns and continues. Once `DEMO_MODE=false` is set after the demo, those logins stay open to anyone who has read the repo.
**Fix:** In the Supabase branch (after the key check at `:33-37`), `if (!process.env.DEMO_PASSWORD) { console.error('Set DEMO_PASSWORD in .env.local before creating Supabase users.'); process.exit(1); }`. Keep the fallback only for the local shim, which does not use this script.

### SEC3-05 · info · dev3 · `supabase/migrations/0006_orders_dispatch_payments.sql:779`
`p_received_on` has no lower bound (`acct date 1900-01-01 → ok rows=1`). Optional: `IF p_received_on < (SELECT created_at::date FROM orders WHERE id = p_order_id) - 365 THEN bad_payload received_on`.

### SEC3-06 · info · dev3 (co: dev2) · contracts A6 / 3.9
Through the API, Plant still reads:
- `ORD-0001 total 504000.00 adv 0.00; … ORD-0003 total 1023750.00 adv 511875.00`
- 5 quotes and 4 items with `floor_price_at_time`
- the follow-up note text `Balance $18,900 due` (G2)

No Plant screen shows these, except Home "To do today", which shows the note text. A6 covers only payments, balances and KPIs. If the lead wants "Plant reads no money" to be literal, column-limit `orders` for operations through a view and hide `quotes` / `quotation_items` from operations (`fn_user_role() IS DISTINCT FROM 'operations'`).

### SEC3-07 · info · dev2 · `tests/helpers/db.ts`, `tests/security-fixes.test.ts:537`
On the Supabase-like scratch database, `npm test` gives `11 failed | 100 passed`. The causes are `permission denied to set parameter "session_replication_role"` (that setting needs a superuser) and `gen_salt` living in `extensions` (42883 instead of 42501). These are harness assumptions, not product defects. Do not point `npm test` at the hosted database. It is local-only, per the README.

## Residual risks (accepted for the demo)

1. **Try as is a public owner login while `DEMO_MODE=true`.** Anyone with the URL can sign in as owner, accountant, sales or Plant and change data, staff access and settings. Run `npm run db:seed` to restore the story. After the demo, follow hosted-supabase.md section 6: set `DEMO_MODE=false`, remove `DEMO_PASSWORD`, and rotate or delete the demo users.
2. **Hosted BYPASSRLS** is documented by Supabase but not yet read on the real project (SEC3-02 query above).
3. **SEC1-10 (contract residual):** a non-owner who holds `users` can grant other non-owners any module except owner. Unchanged by design.
4. **Same-org reads are by contract:** Plant reads orders, quotes and notes that contain money (SEC3-06). Same-org writes to other people's reminders remain until SEC3-01 is fixed. All are audited.
5. **anon default `rwU` on future sequences** in public on Supabase. There are 0 sequences today. A future migration that adds a sequence should revoke it.
6. **Blocked:** web login, cookie refresh in `src/middleware.ts`, PostgREST over HTTP, and the signed-in receipt and print pages. These are proven only by SQL impersonation, code reading, the build and unauthenticated renders.

## Evidence files (`docs/qa/sprint-c/security-3-evidence/`)
- `sec3-attacks.cjs`, `sec3-attacks.out`, `sec3-attacks-mahua_sc.out`
- `hosted-sim.cjs`, `hosted-sim-{setup,seed1,seed2,ci,flow,anon,sec1-03,teardown}.out`, `hosted-sim-flow-norls.txt`, `hosted-sim-npm-test.out`, `hosted-sim-ci-pgcrypto-in-public.out`
- `bundle-secrets.out`, `ci-tenant-check.out`, `npm-test.out`, `typecheck.out`, `lint.out`, `story.sql`

## Owner routing
- **dev1:** SEC3-03, SEC3-01, SEC3-04.
- **dev2:** SEC3-02, SEC3-07; co-owner on SEC3-06.
- **dev3:** SEC3-05, SEC3-06.
