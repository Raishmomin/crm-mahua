# QA Gate 2 re-gate: Sprint B fix round

Date: 2026-11-16 (12:50 to 13:10). I acted as the QA engineer: prove it works, then try to break it, and judge usability for users with basic schooling on a phone.

Scope (as assigned): I re-verified the four QA-owned findings sent to the fix round (G2-01, G2-02, G2-03, G2-04). I also re-ran the general checks:
- typecheck, lint, test, ci:tenant-check and `npx next build`;
- a fresh bootstrap of `mahua_qb2`, seeded twice;
- the gate-2 demo flow by SQL in one rolled-back transaction.

The security findings (SEC2-xx) belong to the security reviewer and were not re-gated. The gate-2 minors and infos (G2-05 to G2-13) were not part of this round.

Environment: local Postgres 17 on 127.0.0.1:5432 (`onion_crm`, auth shim from 0000). There is still no hosted Supabase, so web login is **blocked**, not failed.

Browser: the Playwright MCP server still cannot start (`Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome`). I ran the phone pass with playwright-core 1.62 and the cached Chromium 1208 at 390 x 844, DPR 2, touch on.

Evidence:
- Raw outputs and reusable scripts: `docs/qa/sprint-b/gate-2-regate-evidence/`.
- Screenshots: `docs/qa/screenshots/gate-2-regate/`.
- Structured result: `docs/qa/sprint-b/gate-2-regate.json`.

**Verdict: PASS.**
- All four findings are **fixed**. Every probe that got through at gate 2 is now refused with the right code, and the legitimate paths still work.
- Every automated check is green.
- The fresh bootstrap matches the acceptance table, and a second seed run changes nothing.
- The demo flow gives the same result as gate 2: 96 of 96 checks pass, and the KPI and number lines are byte-identical.
- No new blocker or high finding.
- The typecheck and build failures that all three developers reported came from **QA's own evidence script**. I fixed that script and did not touch any source file (see check 1a).

## 1. Checks

| # | Check | Result | Evidence (output tail) |
|---|---|---|---|
| 1a | `npm run typecheck` | pass (after a QA self-fix) | First run: 7 x `error TS2802` (`RegExpStringIterator` / `Set` can only be iterated with `--downlevelIteration`). All 7 were in `docs/qa/sprint-b/gate-2-evidence/labelcheck.ts`, a QA file that `tsconfig` picks up through `**/*.ts`. I wrote it after the gate-2 typecheck ran, so gate 2 never caught it. I changed the 7 loops to `Array.from(...)` (QA file, in my write scope). The output is unchanged: the re-run lists the same keys plus the new `quotes.no_price`. Re-run: `> tsc --noEmit`, no output, `EXIT=0` |
| 1b | `npm run lint` (stdin closed, 240 s timeout) | pass | `✔ No ESLint warnings or errors`, `EXIT=0` |
| 1c | `npm test` | pass | `✓ tests/quotes.test.ts (23 tests)`, `✓ tests/orders-payments.test.ts (24 tests)`, `✓ tests/inquiries.test.ts (23 tests)`, `✓ tests/security-fixes.test.ts (18 tests)`, `✓ tests/rls-tenant-isolation.test.ts (5 tests)`. `Test Files 5 passed (5)`, `Tests 93 passed (93)`, 9.7 s (gate 2 had 76) |
| 1d | `npm run ci:tenant-check` (onion_crm) | pass | `✅ CI Tenant Check PASSED: every public table has org_id, an index, ENABLE + FORCE RLS and an org policy; every view is security_invoker; web roles hold no TRUNCATE / REFERENCES / TRIGGER; all SECURITY DEFINER functions are allowlisted; number generators are locked.` |
| 1e | `npx next build` (in the repo, with docs/) | pass | `✓ Compiled successfully`, `Linting and checking validity of types` ok, `✓ Generating static pages (21/21)`, 33 `ƒ` routes, `Middleware 56.7 kB`, `real 0m52s`, `build exit 0` (`gate-2-regate-evidence/build.txt`) |
| 2a | Fresh bootstrap `mahua_qb2`: create, then `DATABASE_URL=…/mahua_qb2 npm run db:seed` twice | pass | Both runs: `Skipping auth users (no Supabase keys)`, `ok 0000_auth_shim … 0006_orders_dispatch_payments`, `ok 01_core / 02_inquiries / 03_samples_quotes / 04_orders_money`, `Seed completed.`, `EXIT=0` |
| 2b | Acceptance counts after both runs | pass | `{"buyers":4,"inquiries":10,"samples":3,"quotations":4,"quotation_items":4,"orders":3,"order_items":3,"dispatches":2,"payments":4,"follow_ups":14,"follow_ups_pending":8,"follow_ups_notes":6}`; `IDENTICAL after second run` |
| 2c | Counters and next codes | pass | `entity_code_counters BUY=4 INQ=10 ORD=3 SMP=3`; `doc_counters INV/2627=2 PI/2627=3 QTN/2627=4 REC/2627=4 SDN/2627=2`. Next codes (rolled back): `INQ-0011, SMP-0004, ORD-0004, BUY-0005, QTN-2627-0005, PI-2627-0004, INV-2627-0003, SDN-2627-0003, REC-2627-0005`. The seeds still keep their explicit codes after the `fn_assign_code` change |
| 2d | Acceptance views (owner) on mahua_qb2 | pass | `v_home_kpis`: `new_inquiries 2, quotes_waiting 1, orders_in_production 1, money_due_inr 511875.00, money_due_usd 18900.00, money_due_about_inr 2104200.00, money_overdue_count 1, followups_today 5, papers_pending 1`. `v_money_due`, `v_order_balances` and the quote totals are the same as at gate 2 |
| 2e | Schema parity onion_crm vs the fresh DB; tenant check on mahua_qb2; drop | pass | Fingerprints match exactly: 67 functions `aca3766b…`, 61 policies `c2182db4…`, 24 triggers `8313bedf…`, 724 column grants `498d260f…`, `fn_quote_update_draft` present, `trg_quotations_currency_recheck` present. So the demo flow on onion_crm tests the current migrations. `CI Tenant Check PASSED` on mahua_qb2. `dropped mahua_qb2`, `remaining: 0` |
| 3a | Gate-2 demo flow by SQL on onion_crm, one transaction, ROLLBACK | pass | Main flow: **96 of 96 PASS**. `diff` of every `KPIS` / `DELTA` / `->` line against the gate-2 log: `IDENTICAL`. Codes: INQ-0011, SMP-0004, QTN-2627-0005, ORD-0004 / PI-2627-0004, REC-2627-0005, INV-2627-0003 / SDN-2627-0003. After the rollback onion_crm still has inquiries 10, quotations 4, orders 3, buyers 4, organizations 1, and the W-MIN-A USD floor is 2180 |
| 3b | Re-gate probes (same transaction) | pass | **54 of 54** for G2-01 to G2-04 (section 2). The 2 G2-05 probes still get through, as expected, because G2-05 was not in this round. Total line: `ROLLED BACK. 150 pass, 2 fail`, and both failures are G2-05 |
| 3c | Sales can still send the seeded draft QTN-2627-0004 (send now re-derives the floor) | pass | Item ₹140/kg against a current floor of ₹125/kg. Sales `fn_quote_send` → status `sent` (rolled back) |
| 4 | Logic check of the form helpers (`logic-check.ts`, reads onion_crm) | pass | `19 pass, 0 fail`. Price list currencies: `INR, USD`. No product offers EUR. Rhine (preferred EUR) now defaults to `USD`, with chips `["INR","USD"]`. For all 4 buyers, quotes and orders agree on export vs India. `export_importer` + country `''` is export in both. Phone prefill: `+971` → Export / United Arab Emirates, `+91` → India, `+49` → Germany, `+92` → Export with the country left empty (the form asks for it) |
| 5a | `next start -p 3130`: unauthenticated `curl -L` on 22 URLs touched in the fix round (inquiry new / detail / edit; buyers new, `?from_inquiry=`, `?next=/%5Cevil.example`, `?next=//evil.example`, detail, edit; quotes new, `?inquiry=&buyer=`, detail, edit, print; order detail, dispatch, print pi / invoice; samples/new; payments/new; `/`) | pass | All 22: `first=307 -> final=200 http://localhost:3130/login`. Server log: 0 error lines |
| 5b | Phone render 390 x 844, en + gu (`/buyers/new?from_inquiry=`, `/quotes/new?inquiry=`, `/inquiries/new`) | pass | All six go to `/login`, with `htmlLang` en / gu, `horizontalScroll false` and `rawKeys []`. Console: en has only the known favicon 404; gu has none. Screenshots: `redirect-login-{en,gu}.png` |
| 5c | Signed-in screens (quote form currency chips, "No price in X" line, Save as buyer, buyer form prefill, order Container / English defaults) | **blocked** | No auth server. Covered by code reading, the logic check and the developers' server-action tests |
| 5d | Server stopped | pass | `listeners on 3130 after kill: 0` |
| 6 | Label keys / jargon on the changed files | pass | `files scanned: 95; literal key uses: 569; missing keys: 2`. Both are false positives: `quotes.no_price` and `quotes.about_inr_rate` are looked up through `tt = useT(QUOTE_LABELS)`, and `quotes/labels.ts` has both in en and gu. `no Gujarati text: 0`, `DB code -> label key gaps: 0`, `jargon hits: 0`. The only hard-coded English is the printed "Packing list", the same as at gate 2 |

## 2. Findings (same ids as gate 2)

| ID | Was | Status | Re-test evidence (demo-flow-regate.txt, rolled back) |
|---|---|---|---|
| G2-01 | high, dev2 | **fixed** | **(a) A currency with no price row is refused.** Sales EUR item for Rhine at 1/MT gives `P0001 below_floor_price [no_price]`, and at 99,999/MT also `[no_price]`. So EUR is refused whatever the rate, and it is no longer a way to skip the floor. An owner item at 1/MT is allowed (`floor_price_at_time null`), but sales `fn_quote_send` of that quote gives `below_floor_price [no_price]`, and sales accept on the draft gives `invalid_transition`. Only the owner can send it, which is the agreed owner override. **(b) A currency change re-runs the guard.** Sales `UPDATE quotations SET currency='INR'` on a USD 2380/MT draft gives `below_floor_price [175000.00]` (₹175/kg = ₹1,75,000/MT). `currency='EUR'` gives `[no_price]`. The draft is unchanged afterwards (USD, floor 2180, total 28560). `fn_quote_update_draft` to INR keeping 2380/MT is refused and nothing changes (USD, 1 item, floor 2180). To INR at ₹190/kg it saves in one go with `floor 175, gst_rate 5, subtotal 2280000, gst 114000`, and switching back to USD works too. **(c) Send re-derives the floor.** The owner raised the USD list price and floor to 2600 / 2500 per MT. Sales `fn_quote_send` on the draft with the stale stored floor 2180 gives `below_floor_price [2500.00]`, and the owner can send it. **(d) Sales cannot move the floor.** Sales INSERT of a EUR price row gives `42501`, and sales UPDATE of `price_list_items` affects 0 rows. **Form:** only priced currencies are offered (logic check), and the no-price lines are labelled in en + gu. Regression tests: `tests/quotes.test.ts` lines 432 and 450 |
| G2-02 | high, dev2 (dev1) | **fixed** | Plant (`ops@`) can still read: `SELECT buyers` → 4. Every Plant write is refused: UPDATE `credit_period_days=90` affects **0 rows**, INSERT buyer gives `42501`, DELETE buyer affects 0 rows, UPDATE / DELETE `buyer_contacts` affect 0 rows, and INSERT `buyer_contacts` gives `42501`. The controls still work: sales and accountant UPDATE buyers each affect 1 row. Server side: `createBuyerAction` and `updateBuyerAction` return `msg.access_denied_title` through `canWriteBuyers(role)` (owner / accountant / sales), and the pages use the same helper. Tests: `tests/quotes.test.ts:564`, `tests/inquiries.test.ts:532` and `:598` |
| G2-03 | high, dev2 (dev1) | **fixed** | As MDPL sales, with a second org created in the transaction, all 17 cross-org probes are refused. `42501` on: samples (another org's buyer, product or inquiry, on insert and on update of SMP-0002); quotations (another org's buyer or inquiry, on insert and on update of draft QTN-0004); quotation_items with another org's packaging; inquiries (another org's buyer, product or `assigned_to` user, and update of INQ-0007); follow_ups with another org's buyer; buyer_contacts for another org's buyer; owner `price_list_items` for another org's product. `P0001 bad_payload` from the guard on: a quote item with another org's product (`[product_id]`), and an item put into the other org's draft quote (`[org_id]`). Control: a sample with our own buyer and product → `SMP-0005`. Tests: `tests/quotes.test.ts:525`, `tests/inquiries.test.ts:378` |
| G2-04 | major, dev1 (dev3) | **fixed** | **Dev-1:** "+ New buyer" on an inquiry now saves name + phone only. The probe inquiry `INQ-0012` was saved with `buyer_id null` and the buyer count stayed at 4, so there are no orphan or duplicate buyers and no buyer with an empty country. A sample for a buyer-less inquiry is refused (`samples.buyer_id` is required), and the inquiry screen sends the user to Save as buyer first (`inquiry-actions.tsx` `needBuyerNext`). Save as buyer then works: export buyer `BUY-0005` with country `United Arab Emirates`, its contact, the inquiry linked (1 row), and the sample → `SMP-0005`. On the server an Export buyer needs a country (`validateShapes` → `msg.error.required`). **Dev-3:** the order screens now decide export by `buyer_type` (`isExportBuyer({buyer_type, country})`), and the logic check shows quotes and orders agree for every seeded buyer and for the old `export_importer` + `''` row. Test: `tests/orders-payments.test.ts:696` |

**No new blocker or high findings.**

Break attempts beyond the fix list that held:
- an owner-made below-floor or no-price draft cannot be sent by sales;
- sales cannot write the price list;
- a quote item cannot be put into another org's draft quote;
- an edit through `fn_quote_update_draft` is all-or-nothing: a refused RPC left the header and items exactly as they were.

Still open, not in this round (for the record):
- **G2-05** (minor, dev1 / dev2): sales can still DELETE the system reminder `Balance $18,900 due` and the approved sample SMP-0001 (1 row each). G2-06 to G2-13 were not re-gated.

## 3. Usability notes (plant supervisor or munim on a phone)

- **Extra step in the demo's "Add one inquiry yourself".** "+ New buyer" no longer makes a buyer, so Send sample or Make quote on that inquiry now opens the buyer form first. Export is preselected from a +971 phone with the country filled in, and Save then continues to the sample or quote. It is one more screen, but every field is prefilled. The presenter should expect this screen in the script.
- **"Save as buyer" button size.** On the inquiry's buyer card it is an outline `size="sm"` button (h-10, about 42 px) outside a list row, the same pattern as G2-07. Dev-1 can make it the default size when fixing G2-07.
- **Quote form wording.** The quote form no longer offers € EUR to Rhine. The new messages are short and plain in both languages: "No price in EUR - owner only" / "EUR માં ભાવ નથી - ફક્ત માલિક", "No price for this product in EUR. Only the owner can save this."
- **Plant can still add a reminder on a buyer** (SQL: a `follow_ups` insert with entity `buyer` works for ops@). This is Dev-1's open issue. flows.md 11 does not mention buyer notes, so the designers should decide. It is harmless to money and due dates.
- **EUR money is missing from Home.** An owner-made EUR quote can still become an order, and its money would not appear in the Home Money tile, which sums INR + USD. This is owner-only and by design (Dev-2 open issue). Mention it if the owner ever quotes in EUR.

## 4. Blocked (needs hosted Supabase credentials)

A signed-in walkthrough at 390 x 844, in en and gu:
- the quote form currency chips and the red "No price in X" line for sales against the amber owner note;
- Save as buyer from INQ-0010 (+971) opening as Export / UAE;
- Plant on `/buyers` with no New / Edit buttons;
- order ORD-0002 and a new export order defaulting to Container with English WhatsApp text;
- the demo-script timing run.

## 5. Notes for the lead

- QA mistake: the gate-2 evidence script `labelcheck.ts` broke `typecheck` and `next build` for everyone after the gate-2 run. I have fixed it (Array.from), and both checks now pass in the repo. Gate 2's own 1a / 1e results were recorded before the file existed. The lesson: QA evidence scripts must be `.cjs` or must pass `tsc`, and typecheck must run after the last evidence file is written. `tasks/lessons.md` is outside QA's write scope, so I am stating the lesson here.
- Two developers left scratch build copies in the session scratchpad (`…/scratchpad/buildcopy`). They are safe to delete. I did not touch them.
- Dev-2 asked for amendment A6 in contracts.md section 11. A6 would record: buyer writes need the owner, accountant or sales role; FK parents must be in the same org; supplied codes are replaced; and the new `fn_quote_update_draft` and `trg_quotations_currency_recheck`. The re-gate confirms all of this behaves as described, but contracts.md is not a QA file.

## 6. Files written by QA

- `docs/qa/gate-2-regate.md` (this report) and `docs/qa/sprint-b/gate-2-regate.json`.
- `docs/qa/sprint-b/gate-2-evidence/labelcheck.ts`: 7 loops changed to `Array.from`, with the same output.
- `docs/qa/sprint-b/gate-2-regate-evidence/`:
  - `demo-flow-regate.cjs` / `.txt`
  - `logic-check.ts` / `.txt`
  - `bootstrap-qb2.txt`
  - `schema-hash.cjs`
  - `curl-routes-regate.txt`
  - `pw-regate.cjs` / `.txt`
  - `labelcheck-regate.txt`
  - `build.txt`
- `docs/qa/screenshots/gate-2-regate/redirect-login-{en,gu}.png`.

I edited no source files and ran no git command that changes state. I created, seeded twice, checked and dropped the scratch database `mahua_qb2` (`remaining: 0`). The demo flow on onion_crm ran in one transaction and was rolled back.
