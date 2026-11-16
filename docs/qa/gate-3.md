# QA Gate 3: Sprint C final gate (before the demo)

Date: 2026-11-16. Fresh run 17:22 to 17:32 IST. It repeats and replaces the partial QA run from 13:53 to 14:08. No source file changed in between (`find src supabase scripts tests README.md docs/setup .env.example package.json -newer` the first run's evidence printed nothing), but I re-ran every check below anyway.

Role: QA engineer. I proved each item works, then tried to break it, and judged it for users with basic schooling on a phone. I edited no source file and wrote only under `docs/qa/`. I ran no git command that changes state.

Environment:
- Local Postgres 17 on 127.0.0.1:5432 (`onion_crm`, auth shim).
- Scratch database `mahua_qc`, created and then dropped (0 left).
- The security reviewer was not using the database during this run.
- No Supabase stack and no hosted credentials, so every signed-in screen is **blocked**, not failed.
- Browser: playwright-core 1.62.1 (npx cache) with the cached Chromium 1208, phone size 390 x 844, DPR 2, touch on.

Evidence:
- Raw outputs and scripts: `docs/qa/sprint-c/gate-3-evidence/`
- Screenshots: `docs/qa/screenshots/gate-3/`
- Structured result: `docs/qa/sprint-c/gate-3.json`
- Credentials-day runbook: `docs/qa/credentials-day-checklist.md`

## Verdict: FAIL (narrow). No blocker. 1 high, 2 major, 3 minor, 1 info.

- Every automated check is green: typecheck, lint, 111/111 tests, ci:tenant-check, build (36 routes).
- The README local steps work literally on a fresh database, and seeding twice gives the same result.
- The demo-script replay passes 224 of 224 checks.
- Every Sprint C item (A6 to A12, G2-06/07/10/13, F2 to F6, SEC1-07, SEC1-08, SEC1-12, favicon) is closed at the database and render level.

The gate fails on the agreed rule (pass = no new high). Three things remain:
1. **G3-01 (high).** The README and the hosted guide promise that `npm run db:seed` "resets the demo story to day one". It does not. After one full rehearsal, a re-seed leaves Home at 2 orders in production and $38,892 due, and the next inquiry becomes INQ-0012 instead of INQ-0011. A tested workaround (`demo-reset.sql`) is in the credentials-day checklist, so the demo can still run.
2. **G3-02 / G3-03 (major).** A6 removed money from Plant's database reads. Two Plant screens still show money words:
   - the Buyers list says every buyer is "₹0 · Paid", including the overdue Al-Barakah;
   - Home "To do today" shows "Balance $18,900 due · 6 days late", on the TV at demo minute 3:25.

All three are small, contained fixes.

## 1. Checks

| # | Check | Result | Output tail (full file in evidence) |
|---|---|---|---|
| 1a | `npm run typecheck` | pass | `tsc --noEmit` EXIT=0 (`typecheck.txt`) |
| 1b | `npm run lint` | pass | `✔ No ESLint warnings or errors` EXIT=0 (`lint.txt`) |
| 1c | `npm test` (onion_crm) | pass | `Test Files 5 passed (5) / Tests 111 passed (111)`; quotes 29, orders-payments 28, inquiries 26, security-fixes 23, rls 5 (`test.txt`) |
| 1d | `npm run ci:tenant-check` (onion_crm) | pass | `✅ CI Tenant Check PASSED: ... PUBLIC / anon execute no function; ... new functions are granted to nobody by default.` (`ci-tenant-check.txt`) |
| 1e | `npx next build` | pass | `✓ Compiled successfully`, 22 static pages generated, 36 app routes incl. `/payments/[id]` and `/payments/[id]/print`, Middleware 56.7 kB, EXIT=0 (`build.txt`) |
| 2a | README "Local database only" on scratch `mahua_qc` (DATABASE_URL override; `docker compose up -d` skipped as the README allows, because onion-crm-postgres holds 5432) | pass | run 1 and run 2: 8 migrations + 4 seed files, `Seed completed.`; counts / counters / step_dates / next codes / KPIs **IDENTICAL**; `SEED STORY OK (2 / 1 / 1 / 511875 + 18900 / 1 late / 5 to do)`; npm test 111/111; ci:tenant-check PASSED; story intact after tests; schema fingerprint identical to onion_crm (70 funcs, 61 policies, 25 triggers); `dropped mahua_qc`, 0 remaining (`readme-local-mahua_qc.txt`) |
| 2b | Re-seed after a committed demo rehearsal (scratch) | **fail** (G3-01) | after re-seed: `SEED STORY MISMATCH [["orders_in_production",1],["money_due_usd",18900]]`, next INQ-0012. After `demo-reset.sql` + seed: `SEED STORY OK`, next INQ-0011 (`reseed-after-rehearsal.txt`) |
| 2c | docker-compose file | pass | `docker-compose config -q` EXIT=0. The `docker compose` v2 plugin is not installed on this machine; the README gives the `docker-compose` fallback (`compose-check.txt`) |
| 2d | Hosted "Run the demo in 5 commands" review (running it is blocked) | pass with notes | every npm command exists in package.json (`db:seed` = seed-users + seed, `build`, `start`); the 6 `.env.local` lines match `.env.example` and hosted-supabase.md step 2; DEMO_MODE / DEMO_PASSWORD are server-only; no password in either doc. Notes: G3-01 (the reset claim is false) and G3-06 (the phone cannot open `localhost`) |
| 3a | Demo-script replay, gate-3 script, one rolled-back transaction on onion_crm | pass | `ROLLED BACK. 224 pass, 0 fail`; codes INQ-0011 / SMP-0004 / QTN-2627-0005 / ORD-0004 / REC-2627-0005 as the script says (`demo-flow-gate3.txt`) |
| 3b | Sprint B re-gate script | pass | `ROLLED BACK. 152 pass, 0 fail` (`demo-flow-regate-rerun.txt`) |
| 3c | Sprint B original script | pass (3 stale expectations) | `108 pass, 3 fail`. In all 3 the attack is still refused, with a different shape: (1) the EUR 1/MT item was refused earlier, so send says `no_items`; (2) the USD-to-INR switch was refused (`below_floor_price [175000.00]`), so sending the still-USD $2,380 quote is correct; (3) the Plant UPDATE of a buyer affects 0 rows (RLS) instead of raising 42501 (`demo-flow-gate2-rerun.txt`) |
| 3d | Home numbers along the exact demo script (committed on scratch) | pass | start 2/1/1/₹5,11,875+$18,900/1 late/5; end 2 new / 1 waiting / **2** in production / $38,892 / papers 0 / To do 4 (the rehearsal includes Owner's Done on the Everest row; the rolled-back replay in 3a shows Done takes To do down by 1). This matches demo-script 4:30 to 4:38 and flows.md 9 (`reseed-after-rehearsal.txt`, "after rehearsal") |
| 3e | Seed story on onion_crm after all probes | pass | `SEED STORY OK` |
| 5a | Every route, unauthenticated, `next start -p 3140` | pass | 37 routes `first=307 -> /login`, `final=200`, 0 responses 5xx, including `/payments/<uuid>`, `/payments/<uuid>/print` and `/payments/not-a-uuid(/print)`; `/no-such-page` 404; `/favicon.ico 200 image/x-icon 379B`; `/icon.svg 200` (`curl-routes.txt`) |
| 5b | Phone screenshots 390x844 | pass | `docs/qa/screenshots/gate-3/`: login-en, login-gu (Try as visible, DEMO_MODE=true), login-demo-off (DEMO_MODE=false: Try as hidden), not-found-en/gu, and required-field and offline variants (`pw-demo-on.txt`, `pw-demo-off.txt`) |
| 5c | Language toggle segment height | pass | `{"text":"English","h":48},{"text":"ગુજરાતી","h":48}` in every mode |
| 5d | Servers stopped | pass | 0 listeners on 3140 to 3142; the only log errors are the Try-as calls reaching the absent local Supabase (ECONNREFUSED 127.0.0.1:54321) |
| 6 | Label / jargon / tap-target audit of the 37 Sprint C files | pass | 415 key uses, 0 missing, 0 without Gujarati, 0 placeholder mismatches. 1 "jargon" hit is code (`it.floor_price_at_time`), not text. 1 hard-coded "Packing list" sits on the English export document print (by design). 2 `size="sm"` buttons sit inside rows of 64px or more, as components.md 3 allows (`labelcheck-gate3.txt`) |
| - | Web login, signed-in screens, receipt view as a user, stepper dates on screen | **blocked** | no Supabase stack or hosted credentials; see `docs/qa/credentials-day-checklist.md` Parts D and E |

## 2. Sprint C items, each with my own probe

| Item | Status | My proof |
|---|---|---|
| A6 Plant reads no money | **DB closed; UI not closed (G3-02, G3-03)** | As ops: payments 0 rows, v_order_balances 0, v_money_due 0, v_home_kpis money 0/0/0/0 with orders_in_production still 1. Owner, accountant and sales are unchanged. `fn_order_advance_waiting` on another org's order returns not_found, for ops and for the other org's owner. But the Plant To do still shows "Balance $18,900 due", and the Plant buyers list shows "₹0 · Paid". |
| A7 step_dates | closed | Through the flow: `{confirmed}` after accept, `+in_production` after Packing started, `+ready` after Packed, `+dispatched` after Loaded, `+delivered` after Delivered, each with `as_expected: true`. Seed on a fresh DB: ORD-0001 46/45/41/40/38, ORD-0002 27/22/9/6, ORD-0003 10/2 days ago, equal to sample-data.md line 86. See also G3-05 (a future delivered date is accepted). |
| A8 payment caps | closed | Accountant and owner, tomorrow's date: `bad_payload [received_on]`. Accountant $31,416.01 over a $28,560 due: `over_payment`. Exactly 110% is allowed. Owner $40,000 is allowed. ORD-0003 ₹563,062.51 refused, ₹563,062.50 allowed. Fully paid ORD-0001 ₹1: accountant refused, owner allowed. |
| A9 starts and deletes | closed | Sales inserting an inquiry won / quoted / with lost_reason / closed_at / created_by=owner: refused. Samples approved / sent / decided_on / created_by=owner: refused. Quotations with sent_at / decided_at / reject_reason / accepted / created_by=owner: refused. Supplied totals of 999999 are stored as 0, then 185000/9250/194250 after an item. Follow-ups with done_by / pre-ticked / done_at / created_by=owner: refused. Deletes: own app-made note 1 row; owner's note, own reminder and the system reminder 0 rows; owner deleting a reminder 1 row; sent sample 0 rows, to_send sample 1 row, approved sample (owner) 0 rows. |
| A10 hardening | closed | 70 public functions: anon_exec 0, public_exec 0. All 17 app `rpc()` names are executable by authenticated and by no anon. Generators and trigger functions are locked. `anon SELECT fn_payment_record(...)` gives 42501 permission denied. ci:tenant-check checks 6 to 10 pass on onion_crm and on the fresh mahua_qc. |
| A11 Try as server-side | closed | DEMO_MODE=true: 4 buttons, 72px tall. DEMO_MODE=false and DEMO_MODE='': 0 buttons (screenshot login-demo-off). A direct POST to the action with DEMO_MODE false or empty returns `msg.access_denied_title`. Role `superadmin` returns `msg.err.bad_payload`. `.next/static` (95 files) has 0 hits for the DEMO_PASSWORD value, `DemoPass123!`, `mahuvacrm.com`, `DEMO_PASSWORD` and `NEXT_PUBLIC_DEMO_MODE` (`bundle-secrets.txt`; see G3-07 for `.next/cache`). |
| A12 receipt routes | closed (render blocked) | Both routes are in the build. Unauthenticated they give 307 to /login. Source: `requireModule('payments')`, then a uuid check (`notFound`), then `notFound` when no row. As accountant the receipt data REC-2627-0005 $8,568 = ₹7,21,854 at 84.25 is read. As ops, 0 rows. |
| G2-06 | closed | en "was dispatched on 10 Nov 2026", gu "10 Nov 2026 ના રોજ રવાના થયો". No `{`, no "today" (`logic-gate3.txt`). |
| G2-07 | closed | `notes-section.tsx:102` "+ Add note" Button has no `size` (default h-12). |
| G2-10 | closed | prefillAmount: advance waiting gives 8568 + hint; part-paid gives 5568; advance OK, credit or 100% advance gives the full due. |
| G2-13 | closed | `fn_sample_create(..., true)` saves SMP-0004 `sent`, inquiry `sample_sent` and one reminder 7 days ahead in one call. NULL mark-sent, an other-org buyer and an accountant without the module are refused; samples stay at 4. |
| F2 | closed | Rendered /login has exactly 1 `id="password"`. |
| F3 | closed | Toggle segments 48px (were 41). |
| F4 | closed | Body line-height 27.2px at 17px in gu (1.6) and 25.5px in en (1.5). |
| F5 | closed (source; render blocked) | `header.tsx` has a path to title.* map for every section and sub-page. BackButton `md:hidden` on non-top-level pages incl. /users and /settings. |
| F6 | closed | Empty submit shows "Please fill this" / "આ ભરો" under both fields with aria-invalid, and the URL stays /login. |
| SEC1-07 | closed | limits 120 / 500 / 32 and 4 bank accounts, shared by the action and the form. |
| SEC1-08 | closed | 14 modules gives `P0001 bad_payload [modules]`. Duplicates are stored once. |
| SEC1-12 | closed | seed-users' only summary line prints "the DEMO_PASSWORD you set (not printed)". No console line contains the value. |
| Favicon | closed | `/favicon.ico` 200 image/x-icon; `<link rel="icon" href="/icon.svg?...">`. |
| README | local part closed; hosted part G3-01, G3-06 | see checks 2a to 2d |

## 3. Findings

| ID | Sev | Owner (co) | Where | Problem | Fix |
|---|---|---|---|---|---|
| G3-01 | high | dev1 | `README.md:37`, `docs/setup/hosted-supabase.md:87-96`, `scripts/seed.ts` | "Safe to run again: it resets the demo story to day one" is false. Seeds upsert their own fixed ids, but they never remove the rows a demo created or rewind the counters. After one committed rehearsal of the demo script plus `npm run db:seed:sql`, Home shows 2 in production (expected 1), $38,892 due (expected $18,900), and 9 pending follow-ups (expected 8). The next codes are INQ-0012 / SMP-0005 / ORD-0005 / QTN-2627-0006 / REC-2627-0006, so every code in the demo script is wrong. | Make the seed reset the demo org. Before the seed files run, delete MDPL rows whose ids are not the fixed seed ids, and set the entity and doc counters back (QA's tested draft is `docs/qa/sprint-c/gate-3-evidence/demo-reset.sql`). Or ship it as `npm run db:reset-demo` and correct both docs. Re-prove with `rehearsal-commit.cjs` + re-seed giving `SEED STORY OK` and next INQ-0011. |
| G3-02 | major | dev1 | `src/app/(dashboard)/buyers/page.tsx:125-134` | After A6, v_money_due is empty for Plant, so the list shows every buyer to Plant as "₹0" with a green "Paid" pill. Al-Barakah is in fact $18,900 late. This is wrong information on a Plant screen (screens.md 6 / A6). | Hide the due fact and the money pill when `profile.role === 'operations'`, as `buyers/[id]/page.tsx:45` already does. Also skip the money sort. |
| G3-03 | major | dev3 (dev1) | `0006_orders_dispatch_payments.sql:342,591` (definers write money reminders as `entity_type='order'`); `supabase/seed/02_inquiries.sql:117`; `src/app/(dashboard)/page.tsx:55-59` | Plant's Home "To do today" shows "Balance $18,900 due · 6 days late", and after dispatch it would show "Balance $19,992 due". Ops can also read the advance and balance notes through follow_ups. In the demo this appears at 3:25, the step whose message is "Plant sees only what to pack". | Lead to confirm. Write the advance and balance reminders as `entity_type='payment'` (entity_id = order id): Home's module filter then hides them from anyone without `payments`, and ENTITY_PATH already opens the order. dev1 changes the seeded "Balance $18,900 due" row to 'payment' and, for the API, adds `entity_type <> 'payment' OR fn_user_role() IS DISTINCT FROM 'operations'` to follow_ups SELECT. Check that the definers' "mark done" updates still match (they already use `IN ('order','payment')`). |
| G3-04 | minor | dev3 | `src/app/login/login-form.tsx:184` | At 390px the English Try-as button reads "Accou..." (span `truncate`, `text-lg`, icon + padding in a half-width tile). The word is cut on the first screen a user sees. | Allow the label to wrap or use `text-base` on narrow screens, or put the icon above the word. Recheck at 360px. |
| G3-05 | minor | dev3 | `0006_orders_dispatch_payments.sql:685-724` | `fn_dispatch_delivered` accepts a delivered date in the future. A probe set it 30 days ahead, and step_dates.delivered became that date, so the stepper would show a future "Delivered" date. A8 checks future dates only for payments. | Raise `bad_payload` (DETAIL `delivered_on`) when `p_delivered_on > CURRENT_DATE`, as fn_payment_record does, and map it to a plain message. |
| G3-06 | minor | dev1 | `README.md:40` | "open http://localhost:3000 on the same computer". The demo script runs Owner, Sales and Plant on an Android phone, and a phone cannot open `localhost`. The README gives no LAN address step. | Add one line: on the phone open `http://<laptop Wi-Fi address>:3000` (same Wi-Fi; allow Node in the firewall). This is already in the checklist, Part C3. |
| G3-07 | info | dev3 | `.next/cache/webpack/*` | Served output is clean, but 11 webpack cache packs (8 client, 3 server) still contain the string `DemoPass123!` from older builds. They are never served. They would leak only if the folder is zipped and shared. The local-only fallback `DemoPass123!` also stays in `seed-users.ts` and `01_core.sql`. | Delete `.next/cache` before sharing the folder (checklist Part H). Never use `DemoPass123!` as the hosted `DEMO_PASSWORD` (checklist A3). |

## 4. Usability notes (phone, basic schooling)

- The login page is good on a phone. In Gujarati and English the four Try-as tiles are 72px tall with an icon and one word, the toggle is 48px, there is no horizontal scroll and no raw key. Empty-field errors appear in plain words under each field.
- Without Supabase, Try as shows "No internet. Try again." On credentials day, wrong keys show the same message. The checklist says what it really means (Part C).
- Plant is shown money words (G3-03, G3-02). This matters most for the Plant user, who is meant to see only "what to pack".
- The receipt print and the export documents are in English. That is right for buyers, and the screens stay bilingual.

## 5. Open issues for the lead (docs/design, not edited)

- `demo-script.md:5` still says `NEXT_PUBLIC_DEMO_MODE`. A11 retired it: it is server-side `DEMO_MODE` now.
- `demo-script.md:56` "Reset between demos" is a manual list with no command behind it. Point it at the G3-01 fix.
- `labels.md` wa.dispatched lacks `{date}`. `screens.md` 1 still says NEXT_PUBLIC_DEMO_MODE. `screens.md` 6 says the due shows to everyone with buyers, which conflicts with A6 (G3-02).
- Contracts section 4 lists neither `fn_sample_create` nor `fn_order_advance_waiting`. 3.9 should record A6. The 2.3 template should revoke from `PUBLIC, anon`.
- Hosted readiness belongs to security. The 0005/0006 definers and the 0007 audit scrub need the function owner to have BYPASSRLS on Supabase. It is checklist step B4.
- Running `npm test` against the hosted DB writes and then removes test orgs and users in `auth.users`. It is optional in the checklist (B7).

## 6. Evidence index (`docs/qa/sprint-c/gate-3-evidence/`)

typecheck.txt, lint.txt, test.txt, ci-tenant-check.txt, build.txt, readme-local-mahua_qc.txt, qc-db.cjs, reseed-after-rehearsal.txt, rehearsal-commit.cjs, demo-reset.sql, compose-check.txt, demo-flow-gate3.cjs / .txt, demo-flow-regate-rerun.txt, demo-flow-gate2-rerun.txt, curl-routes.txt, pw-gate3.cjs, pw-demo-on.txt, pw-demo-off.txt, tryas-action.txt, bundle-secrets.txt, labelcheck-gate3.cjs / .txt, logic-gate3.cjs / .txt. (qc-run1.txt and qc-run2.txt are from the 13:56 run; the 17:24 rerun is inside readme-local-mahua_qc.txt.)
