# QA Gate 3 re-gate: Sprint C fix round

Date: 2026-11-16, 17:42 to 17:48 IST. Role: QA engineer. I edited no source file and wrote only under `docs/qa/`. I ran no git command that changes state.

Environment:
- Local Postgres 127.0.0.1:5432, database `onion_crm`, re-seeded with `npm run db:seed:sql` first so it matches the source.
- Scratch databases `mahua_qc_r3`, `mahua_qc_r3b` and `mahua_qc_r3c`, all dropped afterwards (0 left).
- No Supabase stack and no hosted credentials, so web login and signed-in screens are still **blocked**.

Evidence:
- Folder: `docs/qa/sprint-c/gate-3-regate-evidence/`
- JSON copy of this report: `docs/qa/sprint-c/gate-3-regate.json`

## Verdict: PASS

All three re-checked findings are fixed, and I proved each one myself:
- **G3-01 (high):** fixed.
- **G3-02 (major):** fixed in code and in the build. I could not see the screen because web login is blocked.
- **G3-03 (major):** fixed.

Every general check is green. My attempts to break the fixes found no new blocker or high.

**How much is left before the demo:**
1. Minor findings G3-04, G3-05 and G3-06 are still open. They were not part of this fix round.
2. The lead still has doc updates to make (section 5).
3. Security sign-off.
4. Credentials day: hosted Supabase, `npm run db:seed` with real logins, and every signed-in screen. These include the Plant buyers list and the Plant Home on a phone. Follow `docs/qa/credentials-day-checklist.md`.

## 1. General checks

| # | Check | Result | Output tail |
|---|---|---|---|
| 1 | `npm run typecheck` | pass | `tsc --noEmit` EXIT=0 (`typecheck.txt`) |
| 2 | `npm run lint` | pass | `✔ No ESLint warnings or errors` EXIT=0 (`lint.txt`) |
| 3 | `npm test` (onion_crm) | pass | `Test Files 5 passed (5)`, `Tests 112 passed (112)` (quotes 29, orders-payments 28, inquiries 27, security-fixes 23, rls 5), EXIT=0 (`test.txt`) |
| 4 | `npm run ci:tenant-check` | pass | `✅ CI Tenant Check PASSED ...` EXIT=0 (`ci-tenant-check.txt`) |
| 5 | `npx next build` | pass | `✓ Compiled successfully`, `✓ Generating static pages (22/22)`, `/buyers 153 B 121 kB`, EXIT=0 (`build.txt`) |
| 6 | Re-seed onion_crm (`npm run db:seed:sql`) | pass | `ok supabase/seed/00_demo_reset.sql` ... `ok 04_orders_money.sql`, `Seed completed.` (`seed-onion_crm.txt`) |
| 7 | Demo-flow replay, `demo-flow-gate3.cjs`, one rolled-back transaction | pass | `-> INQ-0011 (expect INQ-0011)`, `ROLLED BACK. 224 pass, 0 fail` (`demo-flow-gate3-rerun.txt`). The first attempt hit `40P01 deadlock detected` in the baseline read: another session took an AccessExclusiveLock at that moment. It was not reproducible, and the re-run is clean (`demo-flow-gate3-attempt1-deadlock.txt`). |
| 8 | Seed story, before and after every probe | pass | `onion_crm SEED STORY OK (2 / 1 / 1 / 511875 + 18900 / 1 late / 5 to do)`. Ops KPIs: money 0/0/0/0, followups_today 4 (`story-before-tests.txt`, `story-final.txt`) |
| 9 | Served bundle secrets | pass | 95 static files. 0 hits in `.next/static` and 0 in `.next/cache` for `DemoPass123!`, `DEMO_PASSWORD`, `NEXT_PUBLIC_DEMO_MODE` and `mahuvacrm.com` (`bundle-secrets.txt`) |

## 2. Findings re-checked

| ID | Status | My proof |
|---|---|---|
| G3-01 high (dev1) | **fixed** | See `g3-01-reset.txt` on scratch `mahua_qc_r3`. Details below. |
| G3-02 major (dev1) | **fixed** (render blocked) | `buyers/page.tsx`: `isPlant = profile.role === 'operations'`. For Plant: `fact2` is `undefined`, there is no `Status` money badge, the sort is by name only, and `loadBuyerList(supabase, { withMoney: !isPlant })` skips `v_money_due` (`queries.ts:42`). Typecheck, lint and build all pass. Seeing the Plant screen on a phone is blocked until credentials day. |
| G3-03 major (dev3, dev1) | **fixed** | See `g3-03-plant-money.txt` (my probe) and `dev3-g3-03-probe.txt` / `dev1-plant-money.txt` (the devs' probes, re-run). Details below. |

### G3-01: how I proved it (`g3-01-reset.txt`)

**Seed from zero:**
- `SEED STORY OK`.
- Counts: buyers 4, inquiries 10, samples 3, quotations 4, orders 3, payments 4, follow_ups 14 (8 pending).
- Counters: BUY 4, INQ 10, ORD 3, SMP 3; INV 2, PI 3, QTN 4, REC 4, SDN 2.
- Next codes: INQ-0011 / SMP-0004 / ORD-0004 / QTN-2627-0005 / REC-2627-0005.

**Committed demo rehearsal, then re-seed:**
- Before the re-seed, the rehearsal left `SEED STORY MISMATCH` and next INQ-0012. That is the old bug state.
- After `npm run db:seed:sql`: `SEED STORY OK`, the same counts and counters, and next INQ-0011 again.
- A second and a fourth rehearsal again made `INQ-0011 / ORD-0004 / PI-2627-0004 / REC-2627-0005 / SMP-0004 / QTN-2627-0005`.

**Break attempt (`break-rehearsal.cjs`, committed).** The rehearsal also changed rows the seed owns, and added new ones:
- The owner adds a NEW buyer BUY-0005 with a contact.
- The owner accepts the SEEDED quote QTN-2627-0003.
- The accountant pays ₹1,00,000 on the SEEDED ORD-0003.
- Plant packs ORD-0003.
- Sales marks the SEEDED INQ-0009 lost.
- A full inquiry, quote, order and payment on the new buyer.
- A reminder on a seeded buyer.

The re-seed removed all of it:
- `SEED STORY OK`.
- Counts and counters back to the seed values.
- Next codes INQ-0011 / BUY-0005 / ORD-0004 / QTN-2627-0005 / REC-2627-0005.

**Whole-org fingerprint (`fingerprint.cjs`, 19 MDPL tables, timestamps ignored):**
- After a re-seed, after the break attempt plus re-seed, and after a final rehearsal plus re-seed, all three fingerprints are **identical** to the reference.
- A seed from zero on a second scratch DB matches too. The only difference is two settings rows whose ids are random. Their content is identical (md5 compared on `mahua_qc_r3c` and on onion_crm).
- The reset deletes children before parents. The FK map has no blocking references (`quotations` has no FK to orders; buyers RESTRICT only from samples, quotes, orders and payments, which are deleted first). Only audit triggers fire on DELETE.

**Docs:** README:36-38 and hosted-supabase.md 5 now say what the reset deletes, and that the next codes are INQ-0011 / QTN-2627-0005 / ORD-0004.

### G3-03: how I proved it (`g3-03-plant-money.cjs`, rolled back, 26 pass, 0 fail)

I played the demo inside one transaction:
1. The seed.
2. INQ-0011 and QTN-2627-0005 accepted. The Advance reminder is written as `payment`.
3. The advance is received, and the Advance reminder is ticked done automatically (mark-done matches `payment`).
4. Plant: Packing started, then Packed (demo 3:25).
5. Plant dispatches by container. "Balance $19,992 due" is written as `payment`.
6. The accountant ticks `bl_received`. "BL received - send copy and ask for balance" is written as `payment`.

After every step:
- **Plant Home To do** (built exactly as `page.tsx`: v_followups_today, then the ENTITY_MODULE filter) shows **no money reminder**.
- **Plant API read** of `follow_ups` finds 0 payment or money-reminder rows.
- **Owner and accountant** still see "Balance $18,900 due", "Balance $19,992 due" and "BL received ...".

Break attempts as Plant:
- `fn_follow_up_done` on the Advance reminder and on the seeded Balance row: `42501 not_found`.
- Direct `UPDATE`: `42501 permission denied`.
- `SELECT` of the seeded Balance row by id: 0 rows.
- The order's notes as Plant: `[]`.

Policy on onion_crm: `follow_ups_select = org_id = fn_current_org() AND (entity_type <> 'payment' OR fn_user_role() IS DISTINCT FROM 'operations')`.

## 3. Findings not in this round (status only)

| ID | Sev | Status |
|---|---|---|
| G3-04 | minor | open: `login-form.tsx` still has `truncate` on the Try-as word |
| G3-05 | minor | open: `fn_dispatch_delivered` still accepts a future `p_delivered_on` |
| G3-06 | minor | open: README still says "open http://localhost:3000 on the same computer", with no phone or LAN line |
| G3-07 | info | not reproduced: `.next/cache` now has 0 hits for `DemoPass123!` (the cache was rebuilt). The local fallback in seed-users.ts and 01_core.sql is unchanged. |

No new blocker or high.

## 4. Usability notes (phone, basic schooling)

- **Plant's Home To do** now shows one row: "Re-quote red flakes - crop price down, Manish asked" (entity `buyer`). It has no money, but it is sales work, not packing work. It could confuse Dineshbhai. The lead can decide whether Plant should see `buyer` reminders.
- **Sales no longer sees the "Balance ... due" reminders** on Home, because sales lacks the `payments` module. `v_home_kpis.followups_today` still counts them (sales: KPI 7, list 4 after BL). No screen renders that KPI: Home shows `todos.length`. So nobody sees the mismatch today, but anyone who later adds a tile from that KPI would see it.
- **The demo-script numbers are unchanged** for Owner (To do 5 at 0:10).

## 5. Open issues for the lead (docs/design, not edited)

- **G3-03 approach needs confirming.** Then update `contracts.md` 4.4: fn_quote_accept, fn_order_dispatch and fn_dispatch_tick(bl_received) write entity `payment`. 4.2: Plant can no longer tick `payment` rows.
- **`sample-data.md` section 7:** row `cccccccc-...01` is now entity `payment`.
- **`contracts.md` section 8:** add `supabase/seed/00_demo_reset.sql`, and the rule that new seed rows must use the fixed id prefixes or every seed deletes them.
- **`demo-script.md:56` "Reset between demos":** can now say `npm run db:seed` (or `db:seed:sql`).
- **Hosted:** the reset runs as the database owner. On Supabase it needs the same BYPASSRLS as the seeds (checklist B4). If the reset is skipped silently, the next code after a rehearsal will not be INQ-0011. On credentials day, check that the next code is INQ-0011 after a re-seed.
- **00_demo_reset deletes live MDPL data on purpose.** Never run `db:seed` against a project with real data in MDPL. The hosted guide already says so.

## 6. Evidence index (`docs/qa/sprint-c/gate-3-regate-evidence/`)

**Checks:** typecheck.txt, lint.txt, test.txt, ci-tenant-check.txt, build.txt, seed-onion_crm.txt, story-before-tests.txt, story-final.txt, bundle-secrets.txt

**Demo-flow replay:** demo-flow-gate3-rerun.txt, demo-flow-gate3-attempt1-deadlock.txt

**G3-01:** g3-01-reset.txt, break-rehearsal.cjs, fingerprint.cjs, fp-*.txt

**G3-03:** g3-03-plant-money.cjs / .txt, dev3-g3-03-probe.txt, dev1-plant-money.txt

**Reused from gate 3:** `../gate-3-evidence/qc-db.cjs`, `rehearsal-commit.cjs`, `demo-flow-gate3.cjs`
