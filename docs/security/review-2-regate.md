# Security review 2 — re-gate after the Sprint B fix round (Mahuva CRM)

Reviewer: security agent. Date: 2026-11-16. Repo `/home/raish/raish/mahua-crm`, branch `master`, working tree as left by Dev-1, Dev-2 and Dev-3 after the Sprint B fix round. This re-gate did not edit any source file. It wrote only this file and `docs/qa/sprint-b/security-2-regate.json`. It ran no git command that changes state.

**Scope.** As assigned, this re-gate re-checks only the four security findings routed from `review-2.md`: SEC2-01, SEC2-02, SEC2-03 and SEC2-04. It re-runs the same SQL and code checks. A new finding is reported only if it is a blocker or high.

**Database.** Plain Postgres 17 at `127.0.0.1:5432/onion_crm`, container `onion-crm-postgres`. It has migrations 0000-0006 and seeds 01-04, freshly applied by the devs: the counters were stamped at 07:19 today. Before any probe ran, the live catalog was checked against the migration files:

- `fn_quote_item_guard` contains `no_price` and `p.org_id = v_quote.org_id`.
- `fn_quote_send` contains the re-derive UPDATE.
- `fn_assign_code` and `fn_assign_doc_no` contain `v_caller IN`.
- The trigger `trg_quotations_currency_recheck` exists.
- `buyers_*` policies carry the role list.
- The `buyers` UPDATE grant is per column.

**Impersonation.** `SET ROLE authenticated; set_config('request.jwt.claim.sub', …)` with the seeded users `22222222-…-22{1 owner, 2 accountant, 3 sales, 4 operations}` of org MDPL. Org B (`bbbbbbbb-…0b`) has a product with `gst_rate 12`, a buyer and a draft quote, all inserted as `postgres` inside the same transaction. Everything ran in one `BEGIN … ROLLBACK`. The check after the rollback shows nothing persisted: counters `INQ 10 / BUY 4 / SMP 3 / QTN 4`, `qtn 4 / ord 3 / buy 4`, R-FLK-C INR floor `125.00`, `orgs 1`.

Script and full output are in the session scratchpad:

- `/tmp/claude-1000/-home-raish-raish-mahua-crm/8e2dfc8a-1f35-49a0-86fa-16cc3055527a/scratchpad/regate2.sql`
- `/tmp/claude-1000/-home-raish-raish-mahua-crm/8e2dfc8a-1f35-49a0-86fa-16cc3055527a/scratchpad/regate2.out`
- the redirect fuzz `/tmp/claude-1000/-home-raish-raish-mahua-crm/8e2dfc8a-1f35-49a0-86fa-16cc3055527a/scratchpad/sec4/redir.ts`

## Verdict

**PASS. All four security findings are FIXED, and there is no new blocker or high finding.**

| ID | Sev | Owner | Status | Proof in one line |
|---|---|---|---|---|
| SEC2-01 | high | dev2 | **fixed** | EUR / XYZ items → `below_floor_price no_price` for sales and accountant. EUR→INR and USD→INR switches → `below_floor_price 125.00`, and the header stays put. A floor raised after saving is caught at send (`150.00`). An org B product → `bad_payload product_id`, with no GST leak. 0 orders made. |
| SEC2-02 | high | dev2 (+dev1) | **fixed** | Supplied `INQ-0012` / `BUY-0006` / `SMP-0005` / `QTN-2627-0012` / `PI-2627-0099` are replaced by the next generated number. Every following insert succeeds and the counters advance. `UPDATE` of `buyer_code`, `quote_no` and `code` → `permission denied`. |
| SEC2-03 | high | dev1 (+dev2) | **fixed** | Plant: `UPDATE buyers` 0, `INSERT buyers` RLS error, `UPDATE`/`DELETE buyer_contacts` 0, `INSERT buyer_contacts` RLS error, `DELETE buyers` 0. ORD-0002 is still `overdue` (6 days). Both server actions return access denied for Plant. |
| SEC2-04 | major | dev1 | **fixed** | 25 payloads (`/\evil`, `/<tab>/evil`, `/.//evil`, `/x/..//evil`, `\\evil`, `https://…`, `javascript:` …) → 0 external navigations after the server check, the client re-check and Next's `new URL(target, location)`. |

## Checks run (real output tails)

| # | Check | Result | Output tail |
|---|---|---|---|
| 1 | Live catalog matches the fix round (functions, triggers, policies, grants) | pass | `guard_has_no_price t t` / `send_rederives t` / `assign_code_caller t t` / `trg_quotations_currency_recheck AFTER UPDATE OF currency … WHEN ((old.currency IS DISTINCT FROM new.currency))` / `buyers_update … fn_user_role() = ANY ('{owner,accountant,sales}')` / `buyers: tbl_upd f, buyer_code upd f` |
| 2 | New and changed functions: definer flag, search_path, EXECUTE | pass | `fn_quote_update_draft f search_path=public auth t anon f` (invoker, so it correctly stays off the definer allowlist) / `fn_quotation_currency_recheck f search_path=public auth f` / `fn_quote_item_guard t search_path=public auth f` / `fn_assign_code`, `fn_assign_doc_no t search_path=public auth f` |
| 3 | SEC2-01 A: currency with no price list (sales, accountant) | pass | `EUR 0.01/kg → ERROR below_floor_price DETAIL no_price` / `EUR 1000/MT → no_price` / `XYZ → no_price` / accountant `→ no_price` / `fn_quote_send(empty EUR) → no_items` |
| 4 | SEC2-01 A: owner override does not carry over to sales | pass | owner saves EUR item `0.01 \| (null) \| 0.00` (by design). Sales `fn_quote_send` on it → `below_floor_price DETAIL no_price`, status stays `draft` |
| 5 | SEC2-01 B: currency switch after the items are saved (C6, C8) | pass | owner-made EUR 1/kg, sales `UPDATE currency='INR'` → `below_floor_price DETAIL 125.00`. `fn_quote_send` → `no_price`. `fn_quote_accept` → `invalid_transition draft -> accepted`. Row stays `EUR \| 1.00 \| (null) \| 0.00`, `orders_from_c6 0`. USD 2.00/kg → `UPDATE currency='INR'` → `125.00`. Row stays `USD \| 2.00 \| 1.55 \| 0.00` |
| 6 | SEC2-01 B: the action path `fn_quote_update_draft` (one transaction) | pass | INR at 2/kg → `below_floor_price 125.00` and the draft is unchanged (`USD \| 10000.00 \| 2.00 \| 1.55`). INR at 2000/MT → `125000.00`. INR at 130/kg → `QTN-2627-0007`, `INR \| 650000.00 \| 32500.00 \| 682500.00 \| 130.00 \| 125.00 \| 5.00` (floor and GST re-derived). A switch back to USD gives `gst 0.00, floor 1.55`, and back to INR gives `gst 32500.00, floor 125.00` |
| 7 | SEC2-01 B: stale floor at send | pass | owner raises the R-FLK-C INR floor from 125 to 150. Sales `fn_quote_send` on the 130/kg draft → `below_floor_price DETAIL 150.00`, and the quote stays `draft`. Owner-made INR draft at 1/kg, sent by sales → `150.00`. Control at 170/kg on W-FLK-A (floor 165) → `sent \| 17000.00 \| 850.00 \| 17850.00 \| 165.00 \| 5.00` |
| 8 | SEC2-01 C: product of another org | pass | sales INSERT → `bad_payload DETAIL product_id`. A random uuid gives the **same** error, so there is no existence oracle. Owner → same. UPDATE of an existing item to the org B product → same. `fn_quote_update_draft` → same. `items_on_c7 0`. No `gst_rate 12` is ever stored |
| 9 | SEC2-01 regression C1-C4 | pass | 100/kg → `below_floor_price 150.00` (the raised floor). MT 124 → `150000.00`. A forged `floor_price_at_time=1` → `150.00` |
| 10 | New entry point `fn_quote_update_draft` | pass | org B draft id → `not_found`. Sent QTN-0003 → `invalid_transition sent -> draft`. Own draft with org B buyer → `new row violates row-level security policy for table "quotations"`. Payload keys `floor_price_at_time:1, org_id:<B>` are ignored → `below_floor_price 150.00`. 21 items → `bad_payload items`. Plant → `Access denied: module quotes is required`. Plant `UPDATE quotations SET currency` → `UPDATE 0`. QTN-0004 afterwards `draft \| INR \| 220500.00 \| 1 item \| 140.00` (unchanged) |
| 11 | SEC2-02: pre-claim and forge, as sales | pass | supplied `INQ-0012` → `INQ-0011`, then `INQ-0012`, `INQ-0013`, `INQ-0014`. `INQ-9999` → `INQ-0015`. `BUY-0006` → `BUY-0005`, then `BUY-0006`. `SMP-0005` → `SMP-0004`, then `SMP-0005`. `QTN-2627-0012` → `QTN-2627-0011`. `PI-2627-0099` → `QTN-2627-0012`, then `QTN-2627-0013`. Counters `BUY 6 / INQ 15 / SMP 6` (advancing, never stuck). No `23505` anywhere |
| 12 | SEC2-02: rewrite numbers after insert | pass | `UPDATE buyers SET buyer_code / org_id / id / created_at` → 4 × `permission denied for table buyers`. `UPDATE quotations SET quote_no` / `inquiries SET code` / `samples SET code` → `permission denied` |
| 13 | SEC2-02: Plant (holds samples), and the trusted seed path | pass | ops supplies `SMP-0099` → `SMP-0006`. `postgres` supplies `INQ-7777` → kept (seeds unaffected) |
| 14 | SEC2-03: Plant writes on buyers and contacts | pass | `UPDATE buyers SET credit_period_days=365` → `UPDATE 0`. `INSERT buyers` → `new row violates row-level security policy for table "buyers"`. `UPDATE buyer_contacts SET phone` → `UPDATE 0`. `INSERT buyer_contacts` → RLS error. `DELETE buyer_contacts` → `DELETE 0`. `DELETE buyers` → `DELETE 0`. Ops still reads buyers (`6` incl. the rows from check 11), BUY-0003 `0` days, `+971 4 223 9876`. `ORD-0002 \| 2026-11-10 \| 6 \| overdue` |
| 15 | SEC2-03: control and cross-org parent | pass | sales `UPDATE buyers` → `UPDATE 1`. Accountant → `UPDATE 1`. Sales `INSERT buyer_contacts` for the org B buyer → RLS error |
| 16 | SEC2-03: app walls (read) | pass | `buyers/actions.ts:123-124` and `:170-171` check `hasModule('buyers')` and then `canWriteBuyers(profile!.role)` (owner, accountant, sales, the same as the 0003 policy). `/buyers/new` (`:28`) and `/buyers/[id]/edit` (`:20`) redirect Plant. The New and Edit buttons are gated (`buyers/page.tsx:38`, `[id]/page.tsx:46`, `inquiries/[id]/page.tsx:106`). The inquiry "+ New buyer" shortcut no longer writes `buyers` (`inquiries/actions.ts:108-115`: name and phone stay on the inquiry). `grep from('buyers')` writes in `src` → only `buyers/actions.ts` |
| 17 | SEC2-04: redirect fuzz through the real helper | pass | 25 payloads, each run through `safeInternalPath` (server, `buyers/new/page.tsx:41`), then `{id}` substitution and `safeInternalPath` again (client, `buyer-form.tsx:123-125`), then `new URL(target, 'https://crm.example/buyers/new')` → `external_navigations 0`. `/\evil`, `/\t/evil`, `/\n/evil`, `/.//evil`, `/x/..//evil`, `\\evil`, `https://evil`, `javascript:` → `null` → falls back to `/buyers/<id>`. `{id}` and `%7Bid%7D` flows still work (`/samples/new?inquiry=…&buyer=<id>`) |
| 18 | Other dynamic redirects in `src` | pass | `router.push` / `redirect` with a non-literal target: only `buyer-form.tsx:126` (checked) and `inquiry-actions.tsx:68` (built from server-side ids, no user input). The middleware does not redirect. No `next` / `redirectTo` parameter elsewhere |
| 19 | No service-role client in request paths | pass | `grep supabase/admin\|SERVICE_ROLE\|createAdminClient src scripts` → only `src/lib/supabase/admin.ts` itself and `scripts/seed-users.ts:30` |
| 20 | `npm run ci:tenant-check` | pass | `✅ CI Tenant Check PASSED: every public table has org_id, an index, ENABLE + FORCE RLS and an org policy; every view is security_invoker; web roles hold no TRUNCATE / REFERENCES / TRIGGER; all SECURITY DEFINER functions are allowlisted; number generators are locked.` |
| 21 | `npm test` | pass | `✓ quotes (23) ✓ orders-payments (24) ✓ inquiries (23) ✓ security-fixes (18) ✓ rls-tenant-isolation (5)` / `Test Files 5 passed (5)` / `Tests 93 passed (93)`. Regression tests exist for each finding: `quotes.test.ts:432, 450, 525, 564, 586`, `inquiries.test.ts:491, 532, 565`, `security-fixes.test.ts:431` |
| 22 | `npm run lint` | pass | `✔ No ESLint warnings or errors` (exit 0) |
| 23 | `npx tsc --noEmit` (`npm run typecheck`) | pass | exit 0, no output. The QA `labelcheck.ts` TS2802 errors that the dev reports mention are gone |
| 24 | Logged-in walkthrough over HTTP | **blocked** | There is still no hosted Supabase, so web login is impossible. Server actions were verified by reading the code and by the devs' Vitest cases with a faked session. The database walls were verified by SQL impersonation (checks 3-15) |

## Finding status

### SEC2-01 · high · dev2 · `supabase/migrations/0005_samples_quotes.sql:239-339, 482-548, 602-672`; `src/app/(dashboard)/quotes/actions.ts:100-134`; `src/components/quotes/quote-form.tsx:217-219, 303-306` — **FIXED**

**Was:** The floor came only from a price row in the quote's currency at the time the item was written, and the send step trusted the stored floor. This left three ways around it:

- A currency with no price list (EUR) had no floor.
- A currency switch kept the old floor and GST.
- A product from another org had no floor and leaked that org's GST rate.

A ₹1/kg INR quote with 0% GST was accepted into ORD-0004.

**Now:**

- **(A) No price list.** In `fn_quote_item_guard`, a web caller who is not the owner gets `below_floor_price` with DETAIL `no_price` when no price row exists (`:300-307`). The check `fn_user_role() IS NOT NULL AND … <> 'owner'` is NULL-safe. Seeds as `postgres` still pass. The owner can still save such an item, by design. When sales sends it, `fn_quote_send` re-runs the guard as sales and refuses it (check 4).
- **(B) Currency switch.** `trg_quotations_currency_recheck` is an AFTER UPDATE OF currency trigger on `quotations`. It calls `fn_quotation_currency_recheck`, a SECURITY INVOKER function with `search_path` set. That function touches every item of the quote (`:330`), so a switch below the new floor fails as a whole statement and the header stays as it was (check 5). `fn_quote_send` re-derives the floor, GST and amount from the current price list before it sends (`:512`), which also catches a floor raised after the draft was saved (check 7). `updateQuoteAction` now makes one call to `fn_quote_update_draft`. That function is SECURITY INVOKER, so RLS, the column grants and the guard all apply. It deletes the old items, updates the header, then inserts the new items, and any refusal rolls back the whole edit (check 6).
- **(C) Product from another org.** The guard selects the product with `p.org_id = v_quote.org_id` (`:268`) and otherwise raises `bad_payload product_id`. A random uuid gets the same error, so the guard reveals nothing about which ids exist (check 8). The RLS WITH CHECK on `quotation_items` now also requires a same-org product and packaging.
- **UI.** The currency chips offer only currencies that have a price for every picked product (`pricedCurrencies`, `quotes/helpers.ts:85-91`). `defaultCurrency` ignores a preferred currency that has no price (`:113-121`).

**No new hole.** The new function `fn_quote_update_draft` was attacked as an entry point (check 10): another org's id, a sent quote, another org's buyer, injected `floor_price_at_time` / `org_id` keys, 21 items, and Plant. Every attempt was refused, and QTN-0004 was unchanged.

### SEC2-02 · high · dev2 (co: dev1) · `supabase/migrations/0003_security_fixes.sql:153-202`; `supabase/migrations/0004_inquiries_followups.sql:383-388` — **FIXED**

**Was:** `fn_assign_code` and `fn_assign_doc_no` kept any code the caller sent, and `buyers.buyer_code` could be updated. One user could claim the next `INQ` / `BUY` / `SMP` / `QTN` number ahead of time. After that, every later insert failed with `23505`, and the counter stayed stuck.

**Now:**

- Both trigger functions compute `v_caller` the same way `fn_current_org` does. They assign a generated number when the column is NULL **or** the caller is `authenticated`, `anon` or `authenticator` (`:162/168`, `:189/195`). Both are SECURITY DEFINER with `search_path=public` and are not executable by web roles.
- The role GUC survives SECURITY DEFINER, so the rule holds through PostgREST, where the role is set to `authenticated`.
- 0004 revokes table-level UPDATE on `buyers` and grants it back on 14 columns only, leaving out `id`, `org_id`, `buyer_code`, `created_by` and `created_at`.
- Check 11 shows the attack no longer works. The supplied codes are replaced, and the next three real inserts get consecutive numbers. Counters move from INQ 10 to 15, BUY 4 to 6 and SMP 3 to 6, and no `23505` occurs.
- A forged `PI-2627-0099` becomes `QTN-2627-0012`.
- Rewriting a number after insert is refused on all four tables (check 12).
- Seeds run as `postgres` and keep their explicit codes (check 13).

### SEC2-03 · high · dev1 (co: dev2) · `supabase/migrations/0003_security_fixes.sql:418-468`; `src/app/(dashboard)/buyers/actions.ts:123-124, 170-171`; `src/app/(dashboard)/inquiries/actions.ts:108-115` — **FIXED**

**Was:** Plant (operations) holds the `buyers` module. The actions and the RLS policies checked only the module, so Plant could create buyers and edit credit days and phones. In the earlier review this turned ORD-0002 from Late to Waiting.

**Now:**

- **Database.** The 0003 policy loop adds `fn_user_role() = ANY ('{owner,accountant,sales}')` to the INSERT, UPDATE and DELETE policies of `buyers` and `buyer_contacts`. The `buyer_contacts` WITH CHECK also requires a buyer in the same org. Plant's writes now touch 0 rows or raise an RLS error, its reads still work, and ORD-0002 stays `overdue` (check 14). Sales and the accountant still edit buyers normally (check 15).
- **App.** Both buyer actions check `canWriteBuyers(role)` after `hasModule`. The pages redirect Plant and hide the New and Edit buttons. The inquiry "+ New buyer" shortcut no longer creates a buyer row (check 16).

### SEC2-04 · major · dev1 · `src/components/buyers/helpers.ts:13-23`; `src/app/(dashboard)/buyers/new/page.tsx:41`; `src/components/buyers/buyer-form.tsx:123-126` — **FIXED**

**Was:** The check `startsWith('/') && !startsWith('//')` let `/\evil.example` and `/<tab>/evil.example` through. After Save, `router.push` then left the site.

**Now:** `safeInternalPath` parses the value with `new URL(p, 'https://app.invalid')`. It accepts the value only when the origin stays `https://app.invalid` and the normalised pathname does not start with `//`. It returns `pathname + search + hash`. The check runs on the server page and again in the client right before `router.push`, after `{id}` is filled in.

The fuzz in check 17 covered backslash, tab, CR/LF, dot segments, `..//`, a full URL and `javascript:`. Every unsafe value fell back to `/buyers/<id>`, the legitimate `{id}` continuation flows still work, and there were 0 external navigations. No other user-controlled redirect exists in `src` (check 18).

## Residual notes (not new findings, not blocking)

- **Owner-priced EUR quotes (product decision, dev2 / dev3).** The owner can still save and send a quote in a currency with no price list, by design. Such an order would be left out of the Home money tile, which sums INR and USD only. This is not a security hole, because only the owner can create one.
- **Plant can add buyer notes and reminders (product decision, dev1).** `follow_ups` with entity type `buyer` map to the `buyers` module, so Plant can still add a note or reminder on a buyer page. This changes no money, terms or contacts, so it is out of SEC2-03's scope, which was credit days and phone. Dev-1 already raised it for QA, and flows.md 11 does not mention it.
- **Unassigned items from review 2.** SEC2-05 (minor), SEC2-07..11 (info) and SEC2-06 (minor) were not assigned this round and were not re-verified. One side effect was seen: the G2-03 same-org parent checks now refuse another org's buyer on `quotations` and `buyer_contacts` (checks 10 and 15), so SEC2-06 looks largely addressed. That still needs its own check in a later review.
- **Quotes saved before this fix.** They keep their stored floor until they are edited or sent. Send now re-derives the floor, so nothing below floor can go out. A re-seed resets the demo data anyway.

## Owner routing summary

There is nothing to route. SEC2-01, SEC2-02, SEC2-03 and SEC2-04 are all **fixed**. The security gate for Sprint B is green. The only thing still blocked is the logged-in HTTP walkthrough, which waits on hosted Supabase credentials.
