# Security review 2 — Sprint B (inquiries, follow-ups, samples, quotes, orders, dispatch, money)

Reviewer: security agent. Date: 2026-11-16. Repo `/home/raish/raish/mahua-crm`, branch `master`, working tree as left by Dev-1, Dev-2 and Dev-3 at the end of Sprint B. No source file was edited. Only this file and `docs/qa/sprint-b/security-2.json` were written. No git command that changes state was run.

Database: local Postgres 17 container `onion-crm-postgres`, `127.0.0.1:5432/onion_crm`, migrations 0000-0006 and seeds 01-04. Impersonation: `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '<uid>', false);` with the seeded users `22222222-2222-4222-8222-22222222222{1 owner, 2 accountant, 3 sales, 4 operations}` of org MDPL `11111111-…`. For the cross-tenant probes a second org B (`bbbbbbbb-0000-4000-8000-00000000000b`) with a buyer, product, inquiry, sent and draft quotes, a sample, a follow-up, a ready and a dispatched order, a container dispatch and a payment was inserted as `postgres` inside the same transaction. Every probe ran inside `BEGIN … ROLLBACK`. Scripts: `attack1.sql`, `attack2.sql`, `attack3.sql` in the session scratchpad. The essential output is pasted below.

## Verdict

**FAIL. There are no cross-tenant holes, but there are 3 high findings.**

The tenant walls hold. All 11 SECURITY DEFINER entry points return `42501 not_found` for org B rows, the `app.current_org` and `app.override_module_check` GUCs are ignored for web roles, and the four money/state tables refuse direct writes even from the owner. Module and role walls hold, and the dispatch, payment and checklist validation is correct. The seed story is intact.

The gate is red for three reasons:

| ID | Sev | Owner | One line |
|---|---|---|---|
| SEC2-01 | high | dev2 | Floor-price guard bypassed three ways: a currency with no price list (EUR), switching the quote currency after the items are saved, or a product from another org. A ₹1/kg INR quote with 0% GST was sent and accepted into an order by sales. |
| SEC2-02 | high | dev2 (+dev1) | Client-supplied codes are trusted. A user who pre-claims the next `INQ-` / `BUY-` / `SMP-` / `QTN-` number blocks all new inquiries, buyers, samples or quotes for the whole org until an admin fixes the counter. |
| SEC2-03 | high | dev1 (+dev2) | Plant (operations) can create and edit buyers through the server action and PostgREST, although screens.md 0.1 says read only. Changing credit days turned the Late $18,900 into Waiting. |
| SEC2-04 | major | dev1 | Open redirect: `/buyers/new?next=/%5Cevil.example` passes the `startsWith('/') && !startsWith('//')` check, and after Save `router.push` leaves the site. |
| SEC2-05 | minor | dev1 (+dev2) | INSERT can set state-machine columns, for example an inquiry inserted as `won`, a sample inserted as `approved`, or a follow-up with `done_by` = the owner. |
| SEC2-06 | minor | dev2 (+dev1) | Foreign keys do not check the org. Own rows can point at another tenant's buyer, inquiry or product. This gives an existence oracle and leaked the foreign `gst_rate` (12.00). |
| SEC2-07..11 | info | various | NULL-unsafe owner check, overpayment, anon EXECUTE on hosted Supabase, org-wide reads by design, deletable system reminders. |

## Checks run (real output tails)

| # | Check | Result | Output tail |
|---|---|---|---|
| 1 | `npm run ci:tenant-check` | pass | `✅ CI Tenant Check PASSED: every public table has org_id, an index, ENABLE + FORCE RLS and an org policy; every view is security_invoker; web roles hold no TRUNCATE / REFERENCES / TRIGGER; all SECURITY DEFINER functions are allowlisted; number generators are locked.` |
| 2 | `npm test` | pass | `✓ orders-payments (22) ✓ quotes (16) ✓ security-fixes (18) ✓ inquiries (15) ✓ rls-tenant-isolation (5)` / `Test Files 5 passed (5)` / `Tests 76 passed (76)` |
| 3 | `npm run typecheck` | pass | `> tsc --noEmit` exit 0, no output |
| 4 | `npm run lint` | pass | `✔ No ESLint warnings or errors` exit 0 |
| 5 | Catalog: RLS / privileges / definers / views (pg_catalog) | pass | 9 new tables: `rls t, force_rls t`. `orders, order_items, dispatches, payments`: authenticated INS/UPD/DEL `f f f`. `inquiries, follow_ups, samples, quotations`: `upd f` (column grants only). anon SELECT `f` everywhere. All 26 definers: `search_path=public`. `fn_next_code`/`fn_next_doc_no`/`fn_assign_*`/`fn_quote_item_guard`/`fn_quotation_items_totals`: authenticated EXECUTE `f`. All 7 views: `{security_invoker=true}`. `grep "GRANT ALL" 0004 0005 0006` → no match |
| 6 | Column UPDATE grants | pass | `follow_ups: buyer_id,due_on,note,updated_at` / `inquiries: assigned_to,buyer_id,buyer_name,needed_by,notes,phone,product_id,product_text,qty_kg,source,updated_at` / `quotations: buyer_id,currency,fx_rate,incoterm,inquiry_id,notes,payment_terms,updated_at,valid_till` / `samples: buyer_id,courier,inquiry_id,lot_no,product_id,qty_grams,sent_on,tracking_no,updated_at` (matches contracts 3.1-3.4) |
| 7 | MDPL sales → org B rows through every function | pass | `fn_inquiry_set_status, fn_follow_up_done, fn_sample_set_status, fn_quote_send, fn_quote_reject, fn_quote_accept, fn_order_set_status, fn_order_set_packed, fn_order_dispatch, fn_dispatch_tick, fn_dispatch_delivered` → each `ERROR: 42501: not_found`. Owner → `fn_payment_record(order B)` → `42501: not_found`. Org B afterwards: `inqb talking \| qb sent \| ordb ready \| {"coo": {"date": null, "done": false}} \| fub f` (unchanged) |
| 8 | Direct SELECT of org B rows / views as MDPL sales | pass | `inq 0 \| qtn 0 \| qi 0 \| ord 0 \| oi 0 \| dsp 0 \| pay 0 \| fu 0 \| smp 0 \| vob 0 \| kpis_rows 1 \| vft 0` |
| 9 | `set_config('app.current_org', <org B>)` as sales | pass | `current_org_after_override 11111111-… \| orders_visible 3 \| orgB_orders_visible 0`. Then `fn_order_set_status(order B)` → `42501: not_found` |
| 10 | Ops with `app.override_module_check = true` → `fn_quote_accept`, `fn_payment_record` | pass | `42501: Access denied: module quotes is required` / `42501: Access denied: module payments is required` |
| 11 | Role walls: ops ticks phyto, unticks stuffing_done, marks delivered, cancels. Sales records a payment | pass | 4 × `42501: role_not_allowed`. Sales → `42501: Access denied: module payments is required` |
| 12 | Direct writes as sales on status / total columns | pass | `UPDATE quotations SET status='sent'` / `SET total=1` / `SET subtotal=1` → `42501: permission denied for table quotations`. `UPDATE … valid_till` on a sent quote → `UPDATE 0`. `inquiries.status`, `samples.status`, `follow_ups.done` → `permission denied`. `INSERT quotations … status 'sent'` → `new row violates row-level security policy` |
| 13 | Direct writes as **owner** on function-only tables | pass | INSERT/UPDATE/DELETE on `orders`, `order_items`, `dispatches`, `payments` and `TRUNCATE payments` → 12 × `42501: permission denied for table …` |
| 14 | Floor guard: rate below floor, UPDATE rate after insert, MT vs kg, `floor_price_at_time` forged | pass | `INSERT 100/kg` → `P0001 below_floor_price DETAIL 125.00`. `UPDATE rate 140→100` → same. `MT 100000` and `MT 124` → `DETAIL 125000.00`. `UPDATE floor_price_at_time=1, rate=100` → `below_floor_price`. `UPDATE floor_price_at_time=1` alone → stored value stays `140.00 \| 125.00` |
| 15 | Floor guard: another currency, currency switch, foreign product | **fail** | see SEC2-01 |
| 16 | `fn_order_dispatch` validation | pass | qty 5000.01 > ordered → `bad_payload qty_kg`. bags −1 → `bad_payload bags`. qty 0 / −10 → `bad_payload qty_kg`. mode `ship` → `bad_payload mode`. blank vehicle → `bad_payload vehicle_no`. container without port → `bad_payload port`. Second dispatch → `invalid_transition dispatched -> dispatched` |
| 17 | `fn_payment_record` validation | pass (see SEC2-08) | amount 0 / −100 / NULL → `bad_payload amount`. mode `crypto` → `bad_payload mode`. USD without ₹ value → `bad_payload amount_inr`. fx −1 → `bad_payload fx_rate`. Order of org B → `42501 not_found`. 1e13 → `22003 numeric field overflow` |
| 18 | `fn_dispatch_tick` payload | pass | key `evil` / NULL / `coo"}, "x": {"done": true` → `bad_payload key`. done NULL → `bad_payload done`. Truck dispatch → `bad_payload mode`. BL blank → `bl_required`. Checklist still has `8` keys |
| 19 | `fn_quote_accept` twice / bad % / draft | pass | pct 101 / −1 → `bad_payload advance_pct`. Draft → `invalid_transition draft -> accepted`. First accept `t`, second → `invalid_transition accepted -> accepted`, `orders_for_qtn3 1` |
| 20 | audit_log for orders/payments | pass | owner `21`, accountant `21` (both hold `audit`), sales `0`, ops `0`, owner of org B reading MDPL audit `0` |
| 21 | User with no profile (random JWT sub) | pass | `kpis 0 \| ord 0 \| inq 0`. `fn_follow_up_done` → `42501 not_found` |
| 22 | Client-supplied codes | **fail** | see SEC2-02 |
| 23 | Plant buyer writes | **fail** | see SEC2-03 |
| 24 | State columns on INSERT | **fail** (minor) | see SEC2-05 |
| 25 | Cross-org FK references | **fail** (minor) | see SEC2-06 |
| 26 | `requireModule` on every page incl. `(print)` | pass | 28 pages: inquiries/* `leads`, buyers/* `buyers`, samples/* `samples`, quotes/* `quotes`, orders/* `orders`, payments/* `payments`, catalog `catalog`, `/` `dashboard`, `(print)/quotes/[id]/print` `quotes`, `(print)/orders/[id]/print` and `/print/[doc]` `orders` (+ `operations && doc !== 'slip'` → `/access-denied`). `(print)/layout.tsx` adds `requireAuth` |
| 27 | Server actions (orders, payments, home, inquiries, buyers, samples, quotes) | pass except SEC2-03 | Every action: Zod `safeParse(unknown)` → `hasModule` → RPC or org-locked query (`org_id: profile.org_id`, `.eq('org_id', …)`) → `mapDbError`. UUIDs `z.string().uuid()`. Numbers `.positive().max()` / `.int().min(0).max()`. Text `.max()`. Enums for status/mode/key/reason/pay mode. No `error.message` reaches the client. No `throw`. No client `org_id`. `grep supabase/admin\|SERVICE_ROLE src` → only `src/lib/supabase/admin.ts` itself. `grep dangerouslySetInnerHTML src` → none. `wa.me` / `tel:` only in `src/lib/phone.ts` (`encodeURIComponent(text)`) |
| 28 | Print pages read business_settings for the caller's org | pass | `(print)/quotes/[id]/print/page.tsx:23` and `(print)/orders/[id]/print/[doc]/page.tsx:41` `.eq('org_id', profile.org_id)`. No floor/cost on printed papers (`grep floor\|cost` → none) |
| 29 | Product cost only for owner/accountant | pass | `catalog/page.tsx:28` `showCost = role owner\|accountant`. `v_product_costs` is queried only then (`:42-44`). Sales/ops never touch `product_costs` columns. `v_product_costs` is security_invoker over the owner/accountant-only policy |
| 30 | Redirects only to internal paths | **fail** | see SEC2-04 |
| 31 | Seed story intact after all probes | pass | `inq=10 fu=14 smp=3 qtn=4 qi=4 ord=3 oi=3 dsp=2 pay=4 buy=4 org=1`. Counters `BUY=4 INQ=10 ORD=3 SMP=3` / `INV=2 PI=3 QTN=4 REC=4 SDN=2`. Owner `v_home_kpis`: `2 \| 1 \| 1 \| 511875.00 \| 18900.00 \| 2104200.00 \| 1 \| 5 \| 1` (the acceptance numbers) |
| 32 | Logged-in walkthrough over HTTP | **blocked** | No Supabase stack and no hosted credentials. Server actions and the open redirect were checked by reading code, by the Next 14.2.20 router source and by SQL impersonation |

## Findings

### SEC2-01 · high · dev2 · `supabase/migrations/0005_samples_quotes.sql:236-266, 445-456`; `src/app/(dashboard)/quotes/actions.ts:28, 104-123`; `src/components/quotes/quote-form.tsx:212`

**What is wrong:** The floor guard takes the floor only from a price-list row in the parent quote's *current* currency. That row is looked up once, when the item is written. `fn_quote_send` then re-checks the stored `floor_price_at_time` and does not look it up again. This leaves three gaps:

- **(A) Currency with no price list.** `quotations.currency` accepts any `^[A-Z]{3}$`, and so does the action Zod. The quote form offers the buyer's `preferred_currency` as a chip, and the buyer form also accepts any 3 letters. So any EUR (or XYZ) quote has `floor_price_at_time NULL`, and no floor applies.
- **(B) Switching currency after the items are saved.** `quotations.currency` is in the UPDATE grant, and changing it does not re-run the item guard. `updateQuoteAction` updates the header first and the items afterwards. When the new items are refused, the header stays in the new currency, with the old items and their old floor and GST.
- **(C) Product from another org.** The guard reads `products.gst_rate` without an org filter, and the floor query (org-filtered) finds nothing.

**Proof (sales, rolled back):**
```
=== C5 EUR quote, W-FLK-A at 0.01/kg, fn_quote_send
 QTN-2627-0005 | sent | EUR | 100.00
=== C6 EUR draft at 1/kg, UPDATE quotations SET currency='INR', fn_quote_send, fn_quote_accept
 QTN-2627-0006 | sent | INR | 1000.00 | 0.00 | 1000.00 | rate 1.00 | floor (null) | gst 0.00
 order_created t  →  ORD-0004 | INR | 1000.00          (R-FLK-C INR floor is 125/kg)
=== C8 the action's own sequence: USD draft 2.00/kg (USD floor 1.55/kg), header -> INR, new INR items refused
 ERROR: P0001: below_floor_price DETAIL: 125.00
 fn_quote_send → ok
 QTN-2627-0005 | sent | INR | 10000.00 | rate 2.00 | floor 1.55 | gst 0.00
=== C7 product of org B on an INR quote, rate 1
 rate 1.00 | floor (null) | leaked_foreign_gst 12.00
```

**What an attacker can do:** A sales user (or a careless edit) can send a quote below the owner's floor price and turn it into an order and PI. On INR quotes GST is also dropped (`gst 0.00`). Path (A) works from the normal UI for any buyer saved with preferred currency EUR. Path (B) works by replaying `updateQuoteAction` with a changed currency. This voids the control that amendment A1 was written to protect.

**Exact fix (0005, Dev-2):**
1. In `fn_quote_item_guard`, require the product to belong to the quote's org. For a non-owner web caller, refuse a product that has no price in the quote's currency:
   ```sql
   SELECT p.gst_rate INTO v_gst FROM products p WHERE p.id = NEW.product_id AND p.org_id = v_quote.org_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'bad_payload' USING ERRCODE = 'P0001', DETAIL = 'product_id'; END IF;
   NEW.gst_rate := CASE WHEN v_quote.currency = 'INR' THEN COALESCE(v_gst, 5) ELSE 0 END;
   -- after the floor lookup:
   IF v_floor IS NULL AND fn_user_role() IS NOT NULL AND fn_user_role() <> 'owner' THEN
     RAISE EXCEPTION 'below_floor_price' USING ERRCODE = 'P0001', DETAIL = 'no_price';
   END IF;
   ```
   Seeds and tests run as `postgres`, where `fn_user_role()` is NULL, so they are not affected.
2. In `fn_quote_send`, before the floor re-check and while the quote is still `draft`, add:
   ```sql
   UPDATE quotation_items SET updated_at = now() WHERE quotation_id = v_row.id;  -- re-runs the guard against the current currency
   ```
   This re-derives floor, GST and amount for every item, raises `below_floor_price` for non-owners, and makes the totals trigger correct `gst_amount`.
3. In `quote-form.tsx:212`, offer only the currencies that have a price for the picked products (INR / USD in the demo).
4. Make `updateQuoteAction` replace the items before it changes `currency`, or do the whole edit in one RPC.
5. Add Vitest cases C5, C6, C7 and C8 to `tests/quotes.test.ts`.

### SEC2-02 · high · dev2 (co: dev1) · `supabase/migrations/0003_security_fixes.sql:163, 189, 385`; triggers `0004:71-73, 149-151`, `0005:65-67, 130-132`

**What is wrong:** `fn_assign_code` and `fn_assign_doc_no` keep any code the caller sends ("only when NULL"). Web roles can INSERT `inquiries.code`, `buyers.buyer_code`, `samples.code` and `quotations.quote_no`, and can UPDATE `buyers.buyer_code`. If a user takes the next number, the next trigger-generated insert hits the UNIQUE constraint. That statement rolls back, the counter increment rolls back with it, and so every later insert computes the same number and fails again.

**Proof (sales, rolled back):**
```
inq_counter 11
INSERT inquiries (code 'INQ-0012')                → INQ-0012
INSERT inquiries (no code) ×3                     → 3 × ERROR 23505 uq_inquiries_org_code
inq_counter_after 11                              (stuck)
UPDATE buyers SET buyer_code='BUY-0005' (BUY-0001) → BUY-0005; next INSERT buyers → 23505 uq_buyers_org_code
INSERT samples (code 'SMP-0004') → next INSERT → 23505 uq_samples_org_code
INSERT quotations (quote_no 'QTN-2627-0005') → next INSERT → 23505 uq_quotations_org_quote_no
INSERT quotations (quote_no 'PI-2627-0099')      → accepted (forged document number)
```

**What an attacker can do:** One staff member with `leads`, `buyers`, `samples` or `quotes` (Plant has `buyers` and `samples`) can stop the whole company from saving new inquiries, buyers, samples or quotes. Everyone sees "Could not save. Try again." (`23505` → `msg.error.save`) until an admin edits the database. The same user can also give documents misleading numbers.

**Exact fix:**
- 0003 (Dev-2): in both trigger functions, ignore a supplied value from web roles:
  ```sql
  v_caller text := COALESCE(NULLIF(NULLIF(current_setting('role', true), 'none'), ''), session_user::text);
  ...
  IF (to_jsonb(NEW) ->> v_col) IS NULL OR v_caller IN ('authenticated', 'anon', 'authenticator') THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(v_col, fn_next_code(v_prefix)));   -- fn_next_doc_no in fn_assign_doc_no
  END IF;
  ```
- 0004 (Dev-1): 0003 re-grants full UPDATE every run, so the lock has to live in a later file. Add `REVOKE UPDATE ON buyers FROM authenticated; GRANT UPDATE (<every column except id, org_id, buyer_code, created_by, created_at>) ON buyers TO authenticated;`.
- Add a Vitest case: a supplied code is replaced, and two inserts in a row both succeed.

### SEC2-03 · high · dev1 (co: dev2) · `src/app/(dashboard)/buyers/actions.ts:123, 169`; `supabase/migrations/0003_security_fixes.sql:427-428`

**What is wrong:** screens.md 0.1 row 8 says Plant gets "New / edit buyer: - (read only)". The pages enforce this (`buyers/new/page.tsx:26`, `[id]/edit/page.tsx:20`), but `createBuyerAction` and `updateBuyerAction` check only `hasModule('buyers')`. The DB policies for `buyers` and `buyer_contacts` are module-only too, and the seeded Plant user holds `buyers`. Server actions can be called directly with the action id, and Plant's JWT also works against PostgREST.

**Proof (ops, rolled back):**
```
UPDATE buyers SET credit_period_days = 365, payment_terms = '365 days credit' (BUY-0003) → BUY-0003 | 365
INSERT buyers (…)                                                                    → BUY-0005
UPDATE buyer_contacts SET phone = '+15550001111' (BUY-0003)                         → +15550001111
v_order_balances ORD-0002 → due_date 2027-11-10 | days_overdue 0 | money_status due   (was Late, 6 days)
```

**What an attacker can do:** A Plant user can hide overdue money from the owner (Late becomes Waiting, and the Home Late count drops). They can also change payment terms, or point a buyer's primary phone, which is used for WhatsApp payment reminders and PIs, at another number.

**Exact fix:**
- Treat this the same way as amendment A1 for catalog. In the 0003 policy loop, add a mode for `buyers` and `buyer_contacts` with `v_write || ' AND fn_user_role() IN (''owner'', ''accountant'', ''sales'')'`. Dev-2 owns this; or Dev-1 can recreate those four policies in 0004.
- In `buyers/actions.ts` (both actions, and the "+ New buyer" shortcut in `inquiries/actions.ts:118`), add `if (profile!.role === 'operations') return ACCESS_DENIED;`.
- Add a test: ops UPDATE on buyers affects 0 rows.

### SEC2-04 · major · dev1 · `src/app/(dashboard)/buyers/new/page.tsx:38`; `src/components/buyers/buyer-form.tsx:120`

**What is wrong:** `next` is accepted when `startsWith('/') && !startsWith('//')`. A backslash or a tab after the slash still resolves to another origin:
```
"/\\evil.com"  passes check: true -> https://evil.com/
"/\t/evil.com" passes check: true -> https://evil.com/
```
Next 14.2.20 `useNavigate` builds `new URL(href, location.href)`. `isExternalURL` (`origin !== window.location.origin`) then makes `navigateReducer` call `handleExternalUrl`, so the browser does a full navigation off-site.

**What an attacker can do:** The attacker sends a sales user `https://<crm>/buyers/new?next=/%5Cevil.example` over WhatsApp. When the user saves the buyer, they land on a look-alike "session expired, sign in" page. Users with basic schooling are likely to type their password there.

**Exact fix:** Add a shared helper and use it on the server (page) and again on the client (form):
```ts
export function safeInternalPath(p: string | null | undefined): string | null {
  if (!p) return null;
  try { const u = new URL(p, 'https://app.invalid'); return u.origin === 'https://app.invalid' ? u.pathname + u.search : null; } catch { return null; }
}
```
The `{id}` placeholder lives in the query string and survives the round trip.

### SEC2-05 · minor · dev1 (co: dev2) · `0004_inquiries_followups.sql:58-60, 129-131`; `0005_samples_quotes.sql:47-49, 112-114`

**What is wrong:** The INSERT policies check only org and module, and INSERT is granted on every column. So status machines and attribution can be skipped at create time.

**Proof (sales):**
```
INSERT inquiries (status 'won', closed_at now())                   → INQ-0011 | won
INSERT samples (status 'approved', decided_on, result_note)        → SMP-0004 | approved
INSERT follow_ups (done true, done_by owner, created_by owner)     → t | …221 | …221
INSERT quotations (sent_at, decided_at, total 999999, created_by owner) → QTN-2627-0008 | 999999.00 | …221
```

**Impact:** A user can inflate win counts and fake "done by the owner" on reminders. The audit log still records the real `auth.uid()`.

**Fix:**
- Pin the initial state in WITH CHECK:
  - inquiries: `status = 'new' AND lost_reason IS NULL AND closed_at IS NULL`
  - samples: `status = 'to_send' AND decided_on IS NULL`
  - follow_ups: `(done = false AND done_by IS NULL AND done_at IS NULL) OR (due_on IS NULL AND done = true AND done_by IS NULL)`
  - quotations: `sent_at IS NULL AND decided_at IS NULL AND reject_reason IS NULL`
- Add `AND (created_by IS NULL OR created_by = auth.uid())` to all four.
- In the totals trigger, recompute totals on quotation INSERT too, or revoke INSERT on `subtotal, gst_amount, total`.

### SEC2-06 · minor · dev2 (co: dev1) · `0004:25,28,38,89`; `0005:20-22, 81-82, 146-147, 236`

**What is wrong:** These FK columns are checked only for existence, not for org: `buyer_id`, `inquiry_id`, `product_id`, `packaging_type_id`, `assigned_to`. RLS checks only the row's own `org_id`.

**Proof (MDPL sales):**
- A quote was saved with org B's buyer and inquiry (`QTN-2627-0009`), while a random UUID gave `23503 … not present in table "buyers"`. This is an existence oracle.
- A sample was saved with org B's buyer and inquiry, and `fn_sample_set_status(sent)` succeeded. Org B's inquiry was not changed, because the definer filters by org.
- The guard returned org B's product `gst_rate 12.00`.

Views and definers filter by org or join through RLS, so no foreign rows were readable. The impact is integrity only, plus the floor gap in SEC2-01(C).

**Fix:**
- Add a BEFORE INSERT OR UPDATE trigger `fn_same_org_refs()`, SECURITY DEFINER, allowlisted in CI. It raises `bad_payload` when a referenced buyer, inquiry, product, packaging type or profile has a different `org_id`.
- Alternatively, use composite FKs `(org_id, buyer_id) REFERENCES buyers(org_id, id)` once `UNIQUE (org_id, id)` exists on the parent tables.

### SEC2-07 · info · dev2 · `0005_samples_quotes.sql:264, 445`

`fn_user_role() <> 'owner'` is NULL-unsafe: a NULL role skips the guard. Today only `postgres` gets NULL, but 0006 already uses `COALESCE(fn_user_role(), '')`. Write it the same way here, or use `IS DISTINCT FROM 'owner'`.

### SEC2-08 · info · dev3 · `0006_orders_dispatch_payments.sql:748-750, 772`

`fn_payment_record` accepts any amount up to the column limit and any `received_on`. A ₹1,02,37,500 receipt dated +365 days on ORD-0003 (due ₹10,23,750) was accepted and marked the order `paid` (received 10,749,375.00). The UI has an over-payment confirm and limits the date to today or earlier. Consider refusing `received_on > CURRENT_DATE` in SQL, and an amount above `due × 1.1` for non-owners (`bad_payload`).

### SEC2-09 · info · dev2 (co: dev1) · `0004:232-233, 272-273`; `0005:406-407, 478-479, 521-522`; `scripts/ci-tenant-check.ts:49`

0006 revokes EXECUTE from `anon` on its definers (`:995-1006`), but 0004 and 0005 do not. On hosted Supabase, default privileges grant EXECUTE on new functions to `anon`. There is no exploit, because `fn_current_org()` is NULL and the call returns `not_found` or access denied. Add the same guarded `REVOKE … FROM anon` block, and have the CI check fail when any allowlisted definer is executable by `anon`.

### SEC2-10 · info · dev3 (co: dev1) · contracts 2.2 / 3.9

Reads are org-wide by contract. Plant can read inquiries, follow-up notes, payments, `v_order_balances` and `v_home_kpis` money through the API (ops: `payments 4, money_due_about_inr 2104200.00`), even though the screens hide money from Plant. This is not a defect. The product owner should know the hiding is UI-only.

### SEC2-11 · info · dev1 (co: dev2) · `0004:137-139`; `0005:56-57`

The module-template DELETE policies let sales delete system reminders, such as "Balance … due" and "Advance … due" (`DELETE 3`), and approved samples (`DELETE 1`). Consider limiting DELETE on function-made follow-ups (`created_by IS NULL` or note prefix) and on non-`to_send` samples to the owner.

## Not findings (verified)

- `fn_next_code` / `fn_next_doc_no` are called only inside definers (0006) or `fn_assign_*` BEFORE INSERT triggers (0004, 0005).
- Every new table has `org_id NOT NULL`, an `(org_id)` index, ENABLE + FORCE RLS, an org SELECT policy and the audit trigger.
- Dev deviations checked:
  - The kg/MT floor conversion holds (C3).
  - `bad_payload` before `not_found` in the status functions leaks nothing (the input check does not depend on the row).
  - `fn_follow_up_module` and `fn_format_money` are IMMUTABLE non-definers.
  - Extra view columns contain no cross-org data (`security_invoker`).
- `mapDbError` never returns raw SQL text. The `KNOWN_MESSAGES` codes match the codes the functions raise.

## Owner routing summary

- **dev1:** SEC2-03 (with dev2), SEC2-04, SEC2-05 (with dev2), SEC2-11; co-owner on SEC2-02, SEC2-06, SEC2-09, SEC2-10.
- **dev2:** SEC2-01, SEC2-02 (with dev1), SEC2-06 (with dev1), SEC2-07, SEC2-09 (with dev1); co-owner on SEC2-03, SEC2-05, SEC2-11.
- **dev3:** SEC2-08, SEC2-10 (with dev1).
