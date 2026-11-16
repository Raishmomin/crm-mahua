# Developer contracts: tables, functions, views, routes, files

Designer 2, 2026-11-12 (revised the same day to match Designer 1's `flows.md`, `screens.md` and `sample-data.md`). Binding for Dev-1, Dev-2 and Dev-3. If something here conflicts with your idea, change this file first (one-line note in `tasks/todo.md`) so the other two developers see it. Words shown to users come from `labels.md`; this file is about names, types and signatures only.

Parameter naming: every SQL function parameter carries the `p_` prefix (as `fn_require_module(p_module)` in 0001). Designer 1's shorthand `fn_quote_accept(quote_id, ship_by, advance_pct)` is `fn_quote_accept(p_quote_id, p_ship_by, p_advance_pct)` here; RPC calls pass these names.

## 1. Migration ownership and order

Applied in numeric order by `scripts/seed.ts`, the tests and `supabase db reset`. A migration may reference only objects from lower numbers.

| File | Owner | Sprint | Contains |
|---|---|---|---|
| `supabase/migrations/0000_auth_shim.sql` | Dev-1 | A | `auth.users` / `auth.identities` shim when absent; grants on schema `auth` |
| `supabase/migrations/0001_core_system.sql` | Dev-1 (guard edits only) | A | existing; wrap `auth.uid()` / `auth.jwt()` creation in IF NOT EXISTS |
| `supabase/migrations/0002_catalog_and_buyers.sql` | nobody | — | existing, unchanged |
| `supabase/migrations/0003_security_fixes.sql` | Dev-2 | A | section 2.4: `fn_has_module`, `fn_user_role`, `fn_assign_code`, `fn_assign_doc_no`, `fn_set_user_access`, `fn_set_user_active`, grants, view fix, audit gating, per-table write policies on 0001/0002 tables |
| `supabase/migrations/0004_inquiries_followups.sql` | Dev-1 | B | `inquiries`, `follow_ups`, `fn_inquiry_set_status`, `fn_follow_up_done`, `v_inquiries_open`, `v_followups_today` |
| `supabase/migrations/0005_samples_quotes.sql` | Dev-2 | B | `samples`, `quotations`, `quotation_items`, item amount + floor-guard trigger, totals trigger, `fn_sample_set_status`, `fn_quote_send`, `fn_quote_reject` |
| `supabase/migrations/0006_orders_dispatch_payments.sql` | Dev-3 | B | `orders`, `order_items`, `dispatches`, `payments`, `fn_quote_accept`, `fn_order_set_status`, `fn_order_set_packed`, `fn_order_dispatch`, `fn_dispatch_tick`, `fn_dispatch_delivered`, `fn_payment_record`, `v_orders_in_production`, `v_order_balances`, `v_money_due`, `v_home_kpis` |

Every migration is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, `DROP TRIGGER IF EXISTS`) because `seed.ts` and the tests re-run all of them.

## 2. Templates every table and function must follow

### 2.1 Mandatory table block

```sql
CREATE TABLE IF NOT EXISTS <t> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ... columns ...
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_<t>_org_id ON <t>(org_id);
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <t> FORCE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_audit_<t> ON <t>;
CREATE TRIGGER trg_audit_<t> AFTER INSERT OR UPDATE OR DELETE ON <t>
  FOR EACH ROW EXECUTE FUNCTION fn_audit();
```

`scripts/ci-tenant-check.ts` fails the build if `org_id`, its index, ENABLE + FORCE RLS or an org-filtering policy is missing.

### 2.2 Policy templates

Module-gated tables (`inquiries`, `follow_ups`, `samples`, `buyers`, `buyer_contacts`, `quotations` while draft, `quotation_items` while the parent is draft):

```sql
DROP POLICY IF EXISTS <t>_select ON <t>;
CREATE POLICY <t>_select ON <t> FOR SELECT USING (org_id = fn_current_org());
DROP POLICY IF EXISTS <t>_insert ON <t>;
CREATE POLICY <t>_insert ON <t> FOR INSERT WITH CHECK (org_id = fn_current_org() AND fn_has_module('<module>'));
DROP POLICY IF EXISTS <t>_update ON <t>;
CREATE POLICY <t>_update ON <t> FOR UPDATE
  USING (org_id = fn_current_org() AND fn_has_module('<module>'))
  WITH CHECK (org_id = fn_current_org() AND fn_has_module('<module>'));
DROP POLICY IF EXISTS <t>_delete ON <t>;
CREATE POLICY <t>_delete ON <t> FOR DELETE USING (org_id = fn_current_org() AND fn_has_module('<module>'));
```

Function-only tables (`orders`, `order_items`, `dispatches`, `payments`): the SELECT policy only, plus

```sql
REVOKE INSERT, UPDATE, DELETE ON <t> FROM authenticated;
```

Status columns on module-gated tables are protected with column-level grants so the status machine lives only in the functions:

```sql
REVOKE UPDATE ON <t> FROM authenticated;
GRANT UPDATE (<editable columns>) ON <t> TO authenticated;
```

### 2.3 Function template (SECURITY DEFINER bypasses RLS, so the org check is mandatory)

```sql
CREATE OR REPLACE FUNCTION fn_x(p_id uuid, ...)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := fn_current_org();
  v_row <t>%ROWTYPE;
BEGIN
  PERFORM fn_require_module('<module>');                                  -- raises 42501
  SELECT * INTO v_row FROM <t> WHERE id = p_id AND org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';                 -- same code as no access: no existence leak
  END IF;
  IF NOT (<allowed transition>) THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001', DETAIL = v_row.status || ' -> ' || p_status;
  END IF;
  UPDATE <t> SET ..., updated_at = now() WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION fn_x(uuid, ...) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_x(uuid, ...) TO authenticated;
```

Role-restricted steps (Reopen, Cancel order, Untick, Delivered, Plant's checklist keys) raise `ERRCODE '42501'` with MESSAGE `role_not_allowed` when `fn_user_role()` does not qualify.

Error message codes (the `MESSAGE` text; server actions map them to `msg.err.*` from `labels.md`): `not_found`, `role_not_allowed`, `invalid_transition`, `no_items`, `quote_expired`, `below_floor_price`, `bad_payload`, `last_owner`, `self_change`, `reason_required`, `bl_required`. `fn_require_module` keeps its message `Access denied: module X is required` (SQLSTATE 42501); 42501 of any kind maps to `msg.access_denied_title`.

Codes written to rows are generated inside functions with `fn_next_code` / `fn_next_doc_no` (both become non-executable by `authenticated` in 0003). Tables that are inserted directly by policy get their code from a BEFORE INSERT trigger:

```sql
CREATE TRIGGER trg_<t>_code BEFORE INSERT ON <t>
  FOR EACH ROW EXECUTE FUNCTION fn_assign_code('<PREFIX>', '<column>');      -- e.g. ('INQ', 'code')
CREATE TRIGGER trg_<t>_doc_no BEFORE INSERT ON <t>
  FOR EACH ROW EXECUTE FUNCTION fn_assign_doc_no('<DOC_TYPE>', '<column>');  -- e.g. ('QTN', 'quote_no')
```

Both trigger functions are SECURITY DEFINER and fill the column only when it is NULL (seeds pass explicit codes).

### 2.4 Contents of 0003_security_fixes.sql (Dev-2, Sprint A)

| Item | Spec |
|---|---|
| `fn_has_module(p_module text) RETURNS boolean` | `STABLE SECURITY DEFINER SET search_path = public`; true iff the active profile for `auth.uid()` holds `p_module`; never raises; NULL -> false. GRANT EXECUTE to authenticated. |
| `fn_user_role() RETURNS text` | `STABLE SECURITY DEFINER`; role of the active caller (`owner` / `accountant` / `sales` / `operations`) or NULL. |
| `fn_assign_code()` / `fn_assign_doc_no()` | trigger functions, SECURITY DEFINER; `TG_ARGV[0]` = prefix / doc_type, `TG_ARGV[1]` = column name (default `code`); set via `NEW := jsonb_populate_record(NEW, jsonb_build_object(col, fn_next_code(prefix)))` only when the column is NULL. |
| `fn_set_user_access(p_user uuid, p_role text, p_modules text[]) RETURNS void` | `fn_require_module('users')`; refuse `p_user = auth.uid()` (`self_change`); only an owner may grant role `owner`; refuse removing the last active owner (`last_owner`); `p_modules` must be a subset of the 13 keys (`bad_payload`). |
| `fn_set_user_active(p_user uuid, p_active boolean) RETURNS void` | `fn_require_module('users')`; refuse self; refuse deactivating the last active owner. |
| profiles | `REVOKE INSERT, UPDATE, DELETE ON profiles FROM authenticated`; SELECT policy stays org-scoped. |
| Grants | `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;` and `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated` (no TRUNCATE / REFERENCES / TRIGGER). `REVOKE INSERT, UPDATE, DELETE ON audit_log FROM authenticated`. |
| Number generators | `REVOKE EXECUTE ON FUNCTION fn_next_code(text), fn_next_doc_no(text) FROM PUBLIC, authenticated`. |
| Views | `CREATE OR REPLACE VIEW v_product_costs WITH (security_invoker = true) AS ...` (same body). CI check fails any view without `security_invoker=true`. |
| audit_log | SELECT policy `org_id = fn_current_org() AND fn_has_module('audit')`; `fn_audit` strips `bank_details` from business_settings rows and skips `product_costs` entirely (drop `trg_audit_product_costs`). |
| GUC overrides | `app.current_org` and `app.override_module_check` honoured only when `current_user NOT IN ('authenticated', 'anon')`. |
| `fn_current_fy` | mark `STABLE`. |
| Write policies on existing tables | split FOR ALL into select/insert/update/delete with `fn_has_module(...)`: products, packaging_types, price_list_items, product_costs -> `catalog`; buyers, buyer_contacts -> `buyers`; business_settings, app_settings -> `settings`. `product_costs` SELECT additionally requires `fn_user_role() IN ('owner','accountant')`. |
| Tests | `tests/security-fixes.test.ts`: self-escalation UPDATE affects 0 rows; `v_product_costs` returns 0 rows for sales; TRUNCATE raises; ops user cannot update `price_list_items`; `fn_next_code` raises for authenticated. |

## 3. Tables

Types are PostgreSQL. "mandatory block" = section 2.1. Status CHECKs list exactly the codes in `labels.md` / `status-colours.md`. Column names match `sample-data.md`; columns the seed does not mention are nullable or defaulted.

### 3.1 inquiries (0004, Dev-1) — module `leads`

| Column | Type | Null / default | Constraint |
|---|---|---|---|
| id, org_id, created_by, created_at, updated_at | mandatory block | | |
| code | text | NOT NULL (trigger `fn_assign_code('INQ','code')`) | `UNIQUE (org_id, code)` as `uq_inquiries_org_code` |
| buyer_id | uuid | NULL | `REFERENCES buyers(id) ON DELETE SET NULL` |
| buyer_name | text | NOT NULL | `CHECK (length(btrim(buyer_name)) > 0)` |
| phone | text | NULL | raw as typed |
| product_id | uuid | NULL | `REFERENCES products(id) ON DELETE SET NULL` |
| product_text | text | NULL | free text when no product picked |
| qty_kg | numeric(12,2) | NULL | `CHECK (qty_kg IS NULL OR qty_kg > 0)` |
| needed_by | date | NULL | |
| source | text | NOT NULL DEFAULT 'whatsapp' | `CHECK (source IN ('whatsapp','call','visit','email','indiamart'))` |
| status | text | NOT NULL DEFAULT 'new' | `CHECK (status IN ('new','talking','sample_sent','quoted','won','lost'))` |
| lost_reason | text | NULL | `CHECK (lost_reason IS NULL OR lost_reason IN ('price','quality','timing','no_reply'))` |
| assigned_to | uuid | NULL | `REFERENCES profiles(id) ON DELETE SET NULL`; default = creator (set by the action) |
| notes | text | NULL | |
| closed_at | timestamptz | NULL | set by function on won / lost |

Indexes: `idx_inquiries_org_id (org_id)`, `idx_inquiries_org_status (org_id, status)`, `idx_inquiries_org_buyer (org_id, buyer_id)`, `idx_inquiries_org_created (org_id, created_at DESC)`.
Policies: module template with `leads`. Column-level UPDATE grant: `buyer_id, buyer_name, phone, product_id, product_text, qty_kg, needed_by, source, assigned_to, notes, updated_at` (status, lost_reason, closed_at only via `fn_inquiry_set_status`).

### 3.2 follow_ups (0004, Dev-1) — one table for notes and reminders

| Column | Type | Null / default | Constraint |
|---|---|---|---|
| id, org_id, created_by, created_at, updated_at | mandatory block | | |
| entity_type | text | NOT NULL | `CHECK (entity_type IN ('inquiry','buyer','quote','order','payment'))` |
| entity_id | uuid | NOT NULL | `inquiry` -> inquiries.id, `buyer` -> buyers.id, `quote` -> quotations.id, `order` and `payment` -> orders.id (money chasing is per order). No FK (tables come later and cross migrations). |
| buyer_id | uuid | NULL | `REFERENCES buyers(id) ON DELETE SET NULL`; set by the creating screen / function for every type except `inquiry` without a buyer; the seed sets it too |
| note | text | NOT NULL | `CHECK (length(btrim(note)) > 0)` |
| due_on | date | NULL | NULL = a plain note (never in To do today) |
| done | boolean | NOT NULL DEFAULT false | a plain note is inserted with `due_on NULL, done = true, done_at = created_at` |
| done_at | timestamptz | NULL | |
| done_by | uuid | NULL | `REFERENCES profiles(id) ON DELETE SET NULL` |

`CHECK (due_on IS NOT NULL OR done = true)` (a reminder needs a date).
Indexes: `idx_follow_ups_org_id (org_id)`, `idx_follow_ups_org_due (org_id, due_on) WHERE done = false`, `idx_follow_ups_org_entity (org_id, entity_type, entity_id)`.
Policies: SELECT org; INSERT / UPDATE / DELETE `org_id = fn_current_org() AND fn_has_module(CASE entity_type WHEN 'inquiry' THEN 'leads' WHEN 'buyer' THEN 'buyers' WHEN 'quote' THEN 'quotes' WHEN 'order' THEN 'orders' WHEN 'payment' THEN 'payments' END)`. Column-level UPDATE grant: `note, due_on, buyer_id, updated_at` (done fields only via `fn_follow_up_done` and the functions below).
UI rule (Dev-1): the first note added to an inquiry in status `new`, and returning from "Reply on WhatsApp", call `fn_inquiry_set_status(id, 'talking')`.

### 3.3 samples (0005, Dev-2) — module `samples`

| Column | Type | Null / default | Constraint |
|---|---|---|---|
| id, org_id, created_by, created_at, updated_at | mandatory block | | |
| code | text | NOT NULL (trigger `fn_assign_code('SMP','code')`) | `UNIQUE (org_id, code)` |
| inquiry_id | uuid | NULL | `REFERENCES inquiries(id) ON DELETE SET NULL` |
| buyer_id | uuid | NOT NULL | `REFERENCES buyers(id)` (UI creates the buyer first when the inquiry has none, see 6.3) |
| product_id | uuid | NOT NULL | `REFERENCES products(id)` |
| qty_grams | integer | NOT NULL DEFAULT 500 | `CHECK (qty_grams > 0)` |
| lot_no | text | NULL | |
| courier | text | NULL | |
| tracking_no | text | NULL | |
| sent_on | date | NULL | set by function when status -> sent (editable afterwards) |
| status | text | NOT NULL DEFAULT 'to_send' | `CHECK (status IN ('to_send','sent','approved','rejected'))` |
| result_note | text | NULL | buyer's reply |
| decided_on | date | NULL | |

Indexes: org_id; `(org_id, inquiry_id)`; `(org_id, buyer_id)`; `(org_id, status)`.
Policies: module template with `samples`. Column-level UPDATE grant: `inquiry_id, buyer_id, product_id, qty_grams, lot_no, courier, tracking_no, sent_on, updated_at`.

### 3.4 quotations (0005, Dev-2) — module `quotes`

| Column | Type | Null / default | Constraint |
|---|---|---|---|
| id, org_id, created_by, created_at, updated_at | mandatory block | | |
| quote_no | text | NOT NULL (trigger `fn_assign_doc_no('QTN','quote_no')`) | `UNIQUE (org_id, quote_no)` |
| inquiry_id | uuid | NULL | `REFERENCES inquiries(id) ON DELETE SET NULL` |
| buyer_id | uuid | NOT NULL | `REFERENCES buyers(id)` |
| currency | text | NOT NULL DEFAULT 'INR' | `CHECK (currency ~ '^[A-Z]{3}$')`; form default rule in 6.3 |
| fx_rate | numeric(10,4) | NULL | INR per 1 unit of currency from `app_settings.settings->'currency_rates'` at creation; NULL for INR (used only for the "about ₹" line) |
| incoterm | text | NOT NULL DEFAULT 'EXW' | `CHECK (incoterm IN ('EXW','FOB Pipavav','FOB Mundra','CIF'))` — stored as the chip text ("Price basis") |
| valid_till | date | NOT NULL DEFAULT CURRENT_DATE + 10 | |
| payment_terms | text | NOT NULL DEFAULT '100% against dispatch' | |
| subtotal | numeric(14,2) | NOT NULL DEFAULT 0 | maintained by trigger |
| gst_amount | numeric(14,2) | NOT NULL DEFAULT 0 | trigger; 0 when currency <> 'INR' |
| total | numeric(14,2) | NOT NULL DEFAULT 0 | trigger |
| status | text | NOT NULL DEFAULT 'draft' | `CHECK (status IN ('draft','sent','accepted','rejected','expired'))` |
| reject_reason | text | NULL | `CHECK (reject_reason IS NULL OR reject_reason IN ('price','quality','timing','no_reply'))` |
| notes | text | NULL | |
| sent_at | timestamptz | NULL | |
| decided_at | timestamptz | NULL | |

Indexes: org_id; `(org_id, status)`; `(org_id, buyer_id)`; `(org_id, inquiry_id)`.
Policies: SELECT org. INSERT `org AND fn_has_module('quotes') AND status = 'draft'`. UPDATE USING `org AND fn_has_module('quotes') AND status = 'draft'` WITH CHECK `org AND status = 'draft'`. DELETE `org AND fn_has_module('quotes') AND status = 'draft'`. Column-level UPDATE grant: `inquiry_id, buyer_id, currency, fx_rate, incoterm, valid_till, payment_terms, notes, updated_at`.
`expired` is a display rule only (no cron): the UI, the quotes list and `v_home_kpis` treat `status = 'sent' AND valid_till < CURRENT_DATE` as expired; `fn_quote_accept` refuses such quotes. "Make new quote" inserts a fresh draft copying buyer, items and terms; the old row is untouched.

### 3.5 quotation_items (0005, Dev-2)

| Column | Type | Null / default | Constraint |
|---|---|---|---|
| id, org_id, created_at, updated_at | mandatory block (no created_by) | | |
| quotation_id | uuid | NOT NULL | `REFERENCES quotations(id) ON DELETE CASCADE` |
| product_id | uuid | NOT NULL | `REFERENCES products(id)` |
| packaging_type_id | uuid | NULL | `REFERENCES packaging_types(id) ON DELETE SET NULL` |
| qty_kg | numeric(12,2) | NOT NULL | `CHECK (qty_kg > 0)`; always kilograms |
| unit | text | NOT NULL DEFAULT 'kg' | `CHECK (unit IN ('kg','MT'))`; the unit the rate is per |
| rate | numeric(12,2) | NOT NULL | `CHECK (rate > 0)` |
| amount | numeric(14,2) | NOT NULL DEFAULT 0 | trigger: `qty_kg * rate` (kg) or `qty_kg / 1000 * rate` (MT) |
| floor_price_at_time | numeric(12,2) | NULL | trigger: matching `price_list_items.floor_price` |
| gst_rate | numeric(5,2) | NOT NULL DEFAULT 5 | trigger: `products.gst_rate` for INR, 0 otherwise |
| spec_text | text | NULL | printed under the product name; prefilled "moisture <= 5.5%, 8-15 mm" |
| sort_order | integer | NOT NULL DEFAULT 1 | |

Indexes: org_id; `(org_id, quotation_id)`.
Policies: SELECT org; INSERT / UPDATE / DELETE `org AND fn_has_module('quotes') AND EXISTS (SELECT 1 FROM quotations q WHERE q.id = quotation_id AND q.org_id = fn_current_org() AND q.status = 'draft')`.

Triggers:

| Trigger | When | Does |
|---|---|---|
| `trg_quotation_items_guard` -> `fn_quote_item_guard()` BEFORE INSERT OR UPDATE | each row | sets `amount`, `gst_rate` (products.gst_rate when the parent currency is INR, else 0), `floor_price_at_time` (price_list_items row with same org, product, currency of the parent quote, unit, `is_active`, latest `effective_from <= CURRENT_DATE`); if `floor_price_at_time IS NOT NULL AND NEW.rate < floor_price_at_time AND fn_user_role() <> 'owner'` -> `RAISE EXCEPTION 'below_floor_price' USING ERRCODE = 'P0001', DETAIL = floor_price_at_time::text`. SECURITY DEFINER. |
| `trg_quotation_items_totals` -> `fn_quotation_items_totals()` AFTER INSERT OR UPDATE OR DELETE | each row | recomputes parent: `subtotal = sum(amount)`, `gst_amount = round(sum(amount * gst_rate / 100), 2)`, `total = subtotal + gst_amount`, `updated_at = now()`. SECURITY DEFINER (authenticated has no UPDATE grant on those columns). |

### 3.6 orders (0006, Dev-3) — function-only writes

| Column | Type | Null / default | Constraint |
|---|---|---|---|
| id, org_id, created_by, created_at, updated_at | mandatory block | | |
| order_code | text | NOT NULL | `fn_next_code('ORD')` inside `fn_quote_accept`; `UNIQUE (org_id, order_code)` |
| pi_no | text | NOT NULL | `fn_next_doc_no('PI')`; `UNIQUE (org_id, pi_no)` |
| quotation_id | uuid | NULL | `REFERENCES quotations(id) ON DELETE SET NULL` (seed has phone orders without a quote) |
| inquiry_id | uuid | NULL | `REFERENCES inquiries(id) ON DELETE SET NULL` |
| buyer_id | uuid | NOT NULL | `REFERENCES buyers(id)` |
| currency | text | NOT NULL | copied from quote |
| fx_rate | numeric(10,4) | NULL | copied from quote |
| incoterm | text | NOT NULL | `CHECK (incoterm IN ('EXW','FOB Pipavav','FOB Mundra','CIF'))` |
| payment_terms | text | NOT NULL | |
| total | numeric(14,2) | NOT NULL DEFAULT 0 | copied from quote (INR totals include GST); GST split on print is recomputed from items |
| advance_expected | numeric(14,2) | NOT NULL DEFAULT 0 | `round(total * p_advance_pct / 100, 2)`; 0 for credit / LC |
| expected_dispatch | date | NULL | "Ship by" = `p_ship_by` |
| status | text | NOT NULL DEFAULT 'confirmed' | `CHECK (status IN ('confirmed','in_production','ready','dispatched','delivered','cancelled'))` |
| status_changed_at | timestamptz | NOT NULL DEFAULT now() | |
| packed_bags | integer | NULL | `CHECK (packed_bags IS NULL OR packed_bags >= 0)`; NULL until "Packed" (amendment) |
| packing_note | text | NULL | label text override (amendment); the UI composes the label when NULL |
| notes | text | NULL | |

Planned bags are not stored: `planned_bags = sum(ceil(qty_kg / COALESCE(packaging_types.capacity_kg, 25)))` over the items (computed in `v_orders_in_production` and in the order page query).
Indexes: org_id; `(org_id, status)`; `(org_id, buyer_id)`.
Policies: SELECT org only. `REVOKE INSERT, UPDATE, DELETE ON orders FROM authenticated`.

### 3.7 order_items (0006, Dev-3)

| Column | Type | Null / default | Constraint |
|---|---|---|---|
| id, org_id, created_at, updated_at | mandatory block (no created_by) | | |
| order_id | uuid | NOT NULL | `REFERENCES orders(id) ON DELETE CASCADE` |
| product_id | uuid | NOT NULL | `REFERENCES products(id)` |
| packaging_type_id | uuid | NULL | `REFERENCES packaging_types(id) ON DELETE SET NULL` |
| qty_kg | numeric(12,2) | NOT NULL | `CHECK (qty_kg > 0)` |
| unit | text | NOT NULL | `CHECK (unit IN ('kg','MT'))` |
| rate | numeric(12,2) | NOT NULL | |
| amount | numeric(14,2) | NOT NULL | before GST |
| gst_rate | numeric(5,2) | NOT NULL DEFAULT 5 | 0 for export |
| dispatched_kg | numeric(12,2) | NOT NULL DEFAULT 0 | maintained by `fn_order_dispatch` |
| spec_text | text | NULL | |
| sort_order | integer | NOT NULL DEFAULT 1 | |

Indexes: org_id; `(org_id, order_id)`. Policies: SELECT org only; writes revoked.

### 3.8 dispatches (0006, Dev-3) — truck or container, with the export checklist

| Column | Type | Null / default | Constraint |
|---|---|---|---|
| id, org_id, created_by, created_at, updated_at | mandatory block | | |
| order_id | uuid | NOT NULL | `REFERENCES orders(id) ON DELETE RESTRICT` |
| sdn_no | text | NOT NULL | `fn_next_doc_no('SDN')`; `UNIQUE (org_id, sdn_no)` |
| invoice_no | text | NOT NULL | `fn_next_doc_no('INV')`; `UNIQUE (org_id, invoice_no)` |
| dispatched_on | date | NOT NULL DEFAULT CURRENT_DATE | |
| mode | text | NOT NULL | `CHECK (mode IN ('truck','container'))` |
| vehicle_no | text | NULL | truck (required by the function in truck mode) |
| lr_no | text | NULL | |
| transporter | text | NULL | |
| bags_count | integer | NOT NULL DEFAULT 0 | `CHECK (bags_count >= 0)` |
| qty_kg | numeric(12,2) | NOT NULL | `CHECK (qty_kg > 0)` |
| invoice_total | numeric(14,2) | NOT NULL DEFAULT 0 | `round(order.total * qty_kg / order_qty_kg, 2)`; currency = the order's |
| delivered_on | date | NULL | |
| status | text | NOT NULL DEFAULT 'dispatched' | `CHECK (status IN ('dispatched','delivered'))` |
| container_no | text | NULL | container (required by the function in container mode) |
| port | text | NULL | container (required): Pipavav / Mundra / other text |
| vessel | text | NULL | |
| stuffing_date | date | NULL | container; function defaults it to `dispatched_on` |
| eta | date | NULL | |
| bl_no | text | NULL | filled by `fn_dispatch_tick('bl_received')` |
| export_checklist | jsonb | NOT NULL DEFAULT '{}'::jsonb | `CHECK (jsonb_typeof(export_checklist) = 'object')`; `'{}'` for truck |
| notes | text | NULL | |

`export_checklist` shape for container dispatches (all 8 keys present after `fn_order_dispatch`; `date` is `YYYY-MM-DD` or null — the key is `date`, not `on`; the seed must use `date`):

```json
{
  "container_booked":     { "done": false, "date": null },
  "stuffing_done":        { "done": true,  "date": "2026-11-06" },
  "coa":                  { "done": false, "date": null },
  "phyto":                { "done": false, "date": null },
  "coo":                  { "done": false, "date": null },
  "fumigation":           { "done": false, "date": null },
  "invoice_packing_list": { "done": true,  "date": "2026-11-06" },
  "bl_received":          { "done": false, "date": null }
}
```

Indexes: org_id; `(org_id, order_id)`. Policies: SELECT org only; writes revoked.

### 3.9 payments (0006, Dev-3) — append-only money

| Column | Type | Null / default | Constraint |
|---|---|---|---|
| id, org_id, created_by, created_at | mandatory block without updated_at (rows are never updated or deleted in the demo) | | |
| receipt_no | text | NOT NULL | `fn_next_doc_no('REC')`; `UNIQUE (org_id, receipt_no)` |
| order_id | uuid | NOT NULL | `REFERENCES orders(id) ON DELETE RESTRICT` |
| buyer_id | uuid | NOT NULL | `REFERENCES buyers(id)`; copied from order |
| amount | numeric(14,2) | NOT NULL | `CHECK (amount > 0)`; in `currency` |
| currency | text | NOT NULL | always the order's currency (set by the function) |
| amount_inr | numeric(14,2) | NULL | rupee value for non-INR receipts; NULL for INR |
| fx_rate | numeric(10,4) | NULL | ₹ per 1 unit; NULL for INR |
| received_on | date | NOT NULL DEFAULT CURRENT_DATE | |
| mode | text | NOT NULL | `CHECK (mode IN ('cash','bank','upi','cheque','lc'))` |
| reference | text | NULL | UTR / cheque no |
| note | text | NULL | |

Indexes: org_id; `(org_id, order_id)`; `(org_id, buyer_id)`; `(org_id, received_on DESC)`. Policies: SELECT org only (every org member may see receipts so order balances are correct for sales); writes revoked.

## 4. SQL functions

All follow section 2.3. RPC from the app: `supabase.rpc('<name>', { p_...: ... })` with the exact parameter names below (PostgREST matches by name; pass `null` for unused mode-specific parameters).

### 4.1 0003 (Dev-2, Sprint A)

| Function | Module | Returns | Notes |
|---|---|---|---|
| `fn_has_module(p_module text)` | — | boolean | non-raising helper for policies |
| `fn_user_role()` | — | text | caller's role |
| `fn_set_user_access(p_user uuid, p_role text, p_modules text[])` | users | void | rules in 2.4 |
| `fn_set_user_active(p_user uuid, p_active boolean)` | users | void | rules in 2.4 |

### 4.2 0004 (Dev-1)

| Function | Module | Allowed transitions | Side effects | Returns |
|---|---|---|---|---|
| `fn_inquiry_set_status(p_id uuid, p_status text, p_reason text DEFAULT NULL)` | leads | new -> talking, sample_sent, quoted, lost; talking -> sample_sent, quoted, lost; sample_sent -> talking, quoted, lost; quoted -> talking, lost; lost -> talking only when `fn_user_role() = 'owner'` (Reopen; else `role_not_allowed`); `won` is set only by `fn_quote_accept` (direct `'won'` -> `invalid_transition`) | `lost`: `p_reason` required in the 4 codes (`reason_required`), sets `lost_reason`, `closed_at = now()`, marks the inquiry's pending follow-ups done; Reopen clears `closed_at` and `lost_reason`; `updated_at = now()` | void |
| `fn_follow_up_done(p_id uuid)` | mapped from the row's `entity_type` (inquiry -> leads, buyer -> buyers, quote -> quotes, order -> orders, payment -> payments or orders) | done = false -> true (already done: no-op) | `done = true, done_at = now(), done_by = auth.uid()` | void |

### 4.3 0005 (Dev-2)

| Function | Module | Allowed transitions | Side effects | Returns |
|---|---|---|---|---|
| `fn_sample_set_status(p_id uuid, p_status text, p_note text DEFAULT NULL)` | samples | to_send -> sent; sent -> approved, rejected; approved / rejected -> nothing | `sent`: `sent_on = COALESCE(sent_on, CURRENT_DATE)`; linked inquiry in (`new`,`talking`) -> `sample_sent` (direct UPDATE inside the definer); insert `follow_ups` (entity_type `inquiry` + entity_id inquiry if linked, else `buyer`; `buyer_id`; `due_on = CURRENT_DATE + 7`; note `'Sample ' || code || ' sent, ask for result'`). `approved` / `rejected`: `result_note = p_note`, `decided_on = CURRENT_DATE`, that sample follow-up (note starting `'Sample ' || code`) marked done. | void |
| `fn_quote_send(p_id uuid)` | quotes | draft -> sent | requires at least one item (`no_items`); floor guard re-checked: any item with `rate < floor_price_at_time` and `fn_user_role() <> 'owner'` -> `below_floor_price`; `sent_at = now()`; linked inquiry not in (`won`,`lost`) -> `quoted`; insert follow-up (entity `quote`, buyer_id, `due_on = GREATEST(valid_till - 1, CURRENT_DATE)`, note `'Quote ' || quote_no || ' expires tomorrow - call buyer'`) | void |
| `fn_quote_reject(p_id uuid, p_reason text)` | quotes | sent -> rejected (also when past valid_till) | `p_reason` required in the 4 codes; `reject_reason`, `decided_at = now()`; the quote's pending follow-ups done; the inquiry is NOT changed (user may Mark lost on the inquiry or make a new quote) | void |

### 4.4 0006 (Dev-3)

| Function | Module | Allowed states | Side effects | Returns |
|---|---|---|---|---|
| `fn_quote_accept(p_quote_id uuid, p_ship_by date, p_advance_pct integer)` | quotes | quote `sent` and `valid_till >= CURRENT_DATE` (else `quote_expired`; rejected / accepted -> `invalid_transition`); `p_advance_pct` between 0 and 100 (`bad_payload`) | creates `orders` (order_code `fn_next_code('ORD')`, pi_no `fn_next_doc_no('PI')`, quotation_id, inquiry_id, buyer_id, currency, fx_rate, incoterm, payment_terms, total, `advance_expected = round(total * p_advance_pct / 100, 2)`, `expected_dispatch = COALESCE(p_ship_by, CURRENT_DATE + CASE WHEN buyer.country = 'India' THEN 7 ELSE 21 END)`); copies items into `order_items`; quote -> `accepted`, `decided_at`; inquiry -> `won`, `closed_at`; the quote's pending follow-ups done; if `advance_expected > 0` insert follow-up (entity `order`, buyer_id, `due_on = CURRENT_DATE + 3`, note `'Advance ' || <formatted amount> || ' due - check bank'`) | uuid (new order id) |
| `fn_order_set_status(p_id uuid, p_status text)` | orders | confirmed -> in_production (always allowed; the advance guard is UI-only, see 6.3); in_production -> ready; confirmed / in_production / ready -> cancelled only when `fn_user_role() = 'owner'` (`role_not_allowed`). Anything else `invalid_transition` (dispatched / delivered are set only by the dispatch functions) | `status_changed_at = now()`; `cancelled` marks the order's pending follow-ups done | void |
| `fn_order_set_packed(p_order_id uuid, p_packed_bags integer)` | orders | status `in_production`; `p_packed_bags > 0` (`bad_payload`) | `packed_bags = p_packed_bags`, status -> `ready`, `status_changed_at` | void |
| `fn_order_dispatch(p_order_id uuid, p_mode text, p_vehicle_no text, p_lr_no text, p_transporter text, p_bags integer, p_qty_kg numeric, p_container_no text, p_port text, p_vessel text, p_stuffing_date date, p_eta date, p_dispatched_on date DEFAULT CURRENT_DATE, p_notes text DEFAULT NULL)` | orders | order status `ready`; `p_mode` in (truck, container); truck requires `p_vehicle_no`; container requires `p_container_no` and `p_port`; `p_qty_kg > 0` and `<= remaining (sum qty_kg - sum dispatched_kg)`; `p_bags >= 0` (UI default = packed_bags); violations -> `bad_payload` | inserts `dispatches` (invoice_no `fn_next_doc_no('INV')`, sdn_no `fn_next_doc_no('SDN')`, `invoice_total = round(order.total * p_qty_kg / order_qty, 2)`, `stuffing_date = COALESCE(p_stuffing_date, p_dispatched_on)` for container, `export_checklist` = all 8 keys with `stuffing_done` and `invoice_packing_list` done on `p_dispatched_on` for container, `'{}'` for truck); distributes `p_qty_kg` over `order_items.dispatched_kg` in sort order; order -> `dispatched`, `status_changed_at`; if the order balance (total - received) > 0 insert follow-up (entity `order`, buyer_id, `due_on = p_dispatched_on + buyer.credit_period_days`, note `'Balance ' || <formatted amount> || ' due'`). The supervisor's "Loaded" short form and the office form both call this function. | uuid (dispatch id) |
| `fn_dispatch_tick(p_dispatch_id uuid, p_key text, p_done boolean, p_on_date date DEFAULT CURRENT_DATE, p_bl_no text DEFAULT NULL)` | orders | dispatch in org and `mode = 'container'`; `p_key` one of the 8 keys (`bad_payload`); `fn_user_role() = 'operations'` may tick only `stuffing_done` and `coa` (`role_not_allowed`); `p_done = false` (Untick) only for owner / accountant (`role_not_allowed`); `p_key = 'bl_received' AND p_done` requires non-empty `p_bl_no` (`bl_required`) | `export_checklist = export_checklist || jsonb_build_object(p_key, jsonb_build_object('done', p_done, 'date', CASE WHEN p_done THEN COALESCE(p_on_date, CURRENT_DATE) END))`; `bl_received` done: `bl_no = p_bl_no` and insert follow-up (entity `order`, buyer_id, `due_on = CURRENT_DATE`, note `'BL received - send copy and ask for balance'`) | void |
| `fn_dispatch_delivered(p_id uuid, p_delivered_on date DEFAULT CURRENT_DATE)` | orders; `fn_user_role() <> 'operations'` (`role_not_allowed`) | dispatched -> delivered | `delivered_on`, status `delivered`; when every item has `dispatched_kg >= qty_kg` and all dispatches of the order are delivered -> order `delivered`, `status_changed_at` | void |
| `fn_payment_record(p_order_id uuid, p_amount numeric, p_received_on date, p_mode text, p_reference text DEFAULT NULL, p_amount_inr numeric DEFAULT NULL, p_fx_rate numeric DEFAULT NULL, p_note text DEFAULT NULL)` | payments | order in org and not `cancelled`; `p_amount > 0`; `p_mode` in the 5 codes; when `order.currency <> 'INR'`: `p_amount_inr > 0` required (`bad_payload`), `fx_rate = COALESCE(p_fx_rate, round(p_amount_inr / p_amount, 4))`; when INR both stored NULL | inserts `payments` with `receipt_no = fn_next_doc_no('REC')`, `currency = order.currency`, `buyer_id` from order; afterwards: if `received >= advance_expected` mark pending order follow-ups whose note starts with `'Advance '` done; if `total - received <= 0` mark all pending `order` / `payment` follow-ups of the order done | uuid (payment id) |

## 5. Views (all `WITH (security_invoker = true)`; RLS of base tables applies)

### 5.1 v_inquiries_open (0004, Dev-1)

`WHERE status NOT IN ('won','lost')`. Columns: `id, org_id, code, buyer_id, buyer_name, phone, product_id, product_name (COALESCE(products.name, product_text)), qty_kg, needed_by, source, status, assigned_to, created_at, days_old (CURRENT_DATE - created_at::date), next_followup_on (min due_on of pending follow-ups for the inquiry)`.

### 5.2 v_followups_today (0004, Dev-1)

`WHERE done = false AND due_on <= CURRENT_DATE ORDER BY due_on, created_at` (plain notes have `due_on NULL` and fall out). Columns: `id, org_id, entity_type, entity_id, note, due_on, days_late (CURRENT_DATE - due_on), buyer_id (COALESCE(follow_ups.buyer_id, inquiries.buyer_id)), buyer_name (COALESCE(buyers.company_name, inquiries.buyer_name)), phone (COALESCE(primary buyer_contacts.phone, inquiries.phone)), inquiry_code (inquiries.code or NULL)`. Joins only `inquiries`, `buyers`, `buyer_contacts` (no dependency on 0005/0006); that is why `follow_ups.buyer_id` must be set for quote / order / payment / buyer rows. UI (Home) filters rows to entity types whose module the user holds and builds the link: inquiry -> `/inquiries/{entity_id}`, buyer -> `/buyers/{entity_id}`, quote -> `/quotes/{entity_id}`, order and payment -> `/orders/{entity_id}`.

### 5.3 v_orders_in_production (0006, Dev-3)

`WHERE status IN ('confirmed','in_production','ready')`. Columns: `id, org_id, order_code, pi_no, buyer_id, buyer_name, city, country, status, status_changed_at, currency, total, advance_expected, planned_bags (sum ceil(qty_kg / COALESCE(capacity_kg, 25))), bag_kg (capacity of the first item's packaging, default 25), packed_bags, expected_dispatch, packing_note, product_summary (string_agg of product names in sort order), qty_kg (sum of items), days_since_confirmed (CURRENT_DATE - created_at::date)`. Feeds the Orders list "Open" chip, the Plant Home "Packing today" list and the packing card.

### 5.4 v_order_balances (0006, Dev-3)

One row per non-cancelled order. Columns: `order_id, org_id, order_code, pi_no, buyer_id, buyer_name, order_status, currency, fx_rate, total, advance_expected, received (sum payments.amount, 0 if none), received_inr (sum amount_inr), last_received_on, due (GREATEST(total - received, 0)), advance_ok (received >= advance_expected), latest_dispatch_on (max dispatches.dispatched_on), credit_days (buyers.credit_period_days), due_date (latest_dispatch_on + credit_days, NULL before dispatch), days_overdue (GREATEST(CURRENT_DATE - due_date, 0) when due > 0 else 0), money_status ('paid' when due = 0; 'overdue' when due > 0 AND due_date < CURRENT_DATE; 'due' otherwise, including not yet dispatched)`. Words: paid = Paid, due = Waiting, overdue = Late.

### 5.5 v_money_due (0006, Dev-3)

`FROM v_order_balances WHERE due > 0 GROUP BY org_id, buyer_id, buyer_name, currency`. Columns: `org_id, buyer_id, buyer_name, phone (primary contact), currency, total_due, orders_due (count), max_days_overdue, oldest_due_date (min due_date), money_status ('overdue' if any order overdue else 'due')`. The Money list sorts Late (most days first), then Waiting (soonest due first); `?filter=due` = Late + Waiting; chip Paid lists orders with `money_status = 'paid'` from `v_order_balances`.

### 5.6 v_home_kpis (0006, Dev-3)

Always exactly one row for the caller's org: `FROM organizations o` (RLS limits to own org) with scalar subqueries. Columns: `org_id, new_inquiries int, quotes_waiting int (status = 'sent' AND valid_till >= CURRENT_DATE), orders_in_production int, money_due_inr numeric (sum due where currency = 'INR'), money_due_usd numeric (currency = 'USD'), money_due_about_inr numeric (money_due_inr + money_due_usd * COALESCE((app_settings.settings->'currency_rates'->>'USD')::numeric, 0)), money_overdue_count int (orders with money_status = 'overdue'), followups_today int, papers_pending int (container dispatches with any checklist item not done)`.

Home page rule (Dev-3, Sprint A): `const { data, error } = await supabase.from('v_home_kpis').select('*').maybeSingle()`; on error (view missing before 0006) or null, render zeros; same for `v_followups_today` (empty list, `msg.empty.todo`) and `v_orders_in_production` (Plant's "Packing today", `msg.empty.packing_today`). Never crash, never show an error box for a missing view.

TypeScript row shapes for `v_home_kpis`, `v_followups_today` and `v_orders_in_production` live in `src/types/home.ts` (Dev-3, Sprint A) as `HomeKpis`, `FollowupTodayRow`, `OrderInProductionRow`; Dev-1 imports `FollowupTodayRow` from there instead of redefining it.

## 6. Routes, pages, server actions

### 6.1 Ownership

| Route | Owner | Sprint | `requireModule` | Notes |
|---|---|---|---|---|
| `/login` | Dev-3 | A | — | copy from labels.md; "Try as" only when `NEXT_PUBLIC_DEMO_MODE === 'true'`; language toggle above the form |
| `/` (Home), `/?todo=all` | Dev-3 | A | dashboard | KpiTiles + To do today + 3 big buttons; Plant variant = Orders tile + "Packing today" (see components.md section 6) |
| `/access-denied`, `/account-inactive`, `not-found.tsx` | Dev-3 | A | — | |
| `/users`, `/settings` | Dev-3 | A | users / settings | copy + sizing only; `users/actions.ts` switched to `fn_set_user_access` / `fn_set_user_active` RPC (Dev-2 edits that one file in Sprint A together with 0003) |
| shell: `(dashboard)/layout.tsx`, `(print)/layout.tsx`, `src/components/**` | Dev-3 | A | | Bottom bar is data-driven (4 slots in the order Home, Inquiries, Quotes, Orders, Money, Buyers, Samples, Products from held modules + fixed More; More holds the rest, Staff, My Company, Language, Sign out) |
| `/inquiries` (`?status=&q=`), `/inquiries/new` (`?buyer=`), `/inquiries/[id]`, `/inquiries/[id]/edit` | Dev-1 | B | leads | |
| `/buyers` (`?q=&type=india\|export`), `/buyers/new` (`?from_inquiry=`), `/buyers/[id]`, `/buyers/[id]/edit` | Dev-1 | B | buyers | `?from_inquiry=<id>` prefills name + phone and, after save, sets `inquiries.buyer_id` and returns to the inquiry |
| `/samples` (`?status=`), `/samples/new` (`?inquiry=`), `/samples/[id]` | Dev-2 | B | samples | primary is `Save` (to_send) or `Save & mark sent` (insert then `fn_sample_set_status`) |
| `/quotes` (`?status=`), `/quotes/new` (`?inquiry=&buyer=&from=<quote id>`), `/quotes/[id]`, `/quotes/[id]/edit` (draft only), `/quotes/[id]/accept`, `(print)/quotes/[id]/print` | Dev-2 | B | quotes | `/accept` calls `fn_quote_accept` (Dev-3's function) and redirects to `/orders/{id}` |
| `/orders` (`?status=open` default, or a status code), `/orders/[id]`, `/orders/[id]/dispatch`, `/orders/[id]/checklist`, `(print)/orders/[id]/print?doc=pi\|invoice\|sdn&dispatch=<id>` | Dev-3 | B | orders | `/orders/[id]` renders the PackingCard variant for role `operations`; `/checklist` only for container dispatches (latest dispatch of the order) |
| `/payments` (`?filter=due\|late\|waiting\|paid&buyer=`), `/payments/new` (`?order=`), `/payments/[id]`, `(print)/payments/[id]/print` | Dev-3 | B | payments | |
| `/catalog` | Dev-3 | B | catalog | read-only; cost column only when `role IN ('owner','accountant')` |

Every `page.tsx` starts with `const profile = await requireModule('<key>')` (print pages too). Lists read through the server Supabase client (RLS applies); never import `src/lib/supabase/admin.ts` in `src/app/**`.

### 6.2 Server-action file per module and the pattern to copy

One `actions.ts` per module folder: `src/app/(dashboard)/inquiries/actions.ts`, `buyers/actions.ts` (Dev-1); `samples/actions.ts`, `quotes/actions.ts` (Dev-2); `orders/actions.ts`, `payments/actions.ts`, `home-actions.ts` (Dev-3; Home's "Done" calls `fn_follow_up_done`).

Pattern (copied from `src/app/(dashboard)/users/actions.ts`, with two changes: return `{ ok }` instead of throwing, and RPC for state changes):

```ts
'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, hasModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mapDbError } from '@/lib/db-errors';          // Dev-3, Sprint A: SQLSTATE/message -> label key

export type ActionResult = { ok: true; id?: string } | { ok: false; messageKey: string; detail?: string };

const CreateInquirySchema = z.object({ buyer_id: z.string().uuid().nullable(), buyer_name: z.string().trim().min(1), phone: z.string().trim().optional(), product_id: z.string().uuid().nullable(), product_text: z.string().optional(), qty_kg: z.number().positive().nullable(), needed_by: z.string().date().nullable(), source: z.enum(['whatsapp','call','visit','email','indiamart']), notes: z.string().optional() });

export async function createInquiryAction(input: unknown): Promise<ActionResult> {
  const parsed = CreateInquirySchema.safeParse(input);
  if (!parsed.success) return { ok: false, messageKey: 'msg.err.bad_payload' };
  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'leads')) return { ok: false, messageKey: 'msg.access_denied_title' };   // Wall 2
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inquiries')
    .insert({ ...parsed.data, org_id: profile!.org_id, assigned_to: profile!.id })  // org lock: org_id always from the profile
    .select('id')
    .single();
  if (error) return mapDbError(error);                                   // Wall 1 errors become label keys
  revalidatePath('/inquiries');
  return { ok: true, id: data.id };
}

export async function setInquiryStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['new','talking','sample_sent','quoted','won','lost']), reason: z.enum(['price','quality','timing','no_reply']).nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, messageKey: 'msg.err.bad_payload' };
  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'leads')) return { ok: false, messageKey: 'msg.access_denied_title' };
  const supabase = createClient();
  const { error } = await supabase.rpc('fn_inquiry_set_status', { p_id: parsed.data.id, p_status: parsed.data.status, p_reason: parsed.data.reason });
  if (error) return mapDbError(error);
  revalidatePath(`/inquiries/${parsed.data.id}`);
  return { ok: true };
}
```

Rules: Zod on every input; `hasModule` before any DB call; `org_id` from the profile on inserts and `.eq('org_id', profile.org_id)` on direct updates; state changes only through `rpc`; never `throw` to the client; the client shows `t(lang, messageKey, { floor: detail })`. `mapDbError` (Dev-3, `src/lib/db-errors.ts`): SQLSTATE `42501` -> `msg.access_denied_title`; message in the list of section 2.3 -> `msg.err.<message>` (with `DETAIL` as `detail`, e.g. the floor price); `23505` -> `msg.error.save`; `42P01` / `42883` (view or function not yet migrated) -> `msg.error.save`; anything else -> `msg.error.save` and `console.error` on the server.

### 6.3 Flow rules that cross modules

| Rule | Who implements |
|---|---|
| "Send sample" / "Make quote" from an inquiry without `buyer_id` first shows `msg.buyer_needed` and opens `/buyers/new?from_inquiry=<id>`; after save the inquiry gets `buyer_id` and the flow continues with `?inquiry=&buyer=` | Dev-1 (buyer form + inquiry update), Dev-2 (checks `buyer_id` before routing) |
| Quote form defaults: currency = buyer `preferred_currency` if an active `price_list_items` row exists for the product in that currency, else `USD` for export buyers (`country <> 'India'`) and `INR` for India; price basis = buyer incoterm (`FOB` -> `app_settings.settings->>'default_incoterm'`, i.e. `FOB Mundra`); rate and floor from the price list row for that currency / unit | Dev-2 |
| `/quotes/[id]/accept`: Ship by default today + 21 (export) / today + 7 (India); advance % chips 30 / 50 / 100 from the payment-terms words, 0 for credit / LC; calls `fn_quote_accept` and redirects to `/orders/{id}` with `msg.order_created` | Dev-2 |
| Advance guard (soft): order detail / packing card compute `advance waiting = received < advance_expected` from `v_order_balances`; for role `operations` the Start packing / Packing started button is disabled with `btn.wait_for_advance`; other roles get the confirm sheet `msg.advance_not_received` (`btn.wait` / `btn.start_anyway`). The DB never blocks | Dev-3 |
| Order detail "Money" section reads `v_order_balances` for one order; "Money received" button links to `/payments/new?order=<id>` (payments module only) | Dev-3 |
| Buyer detail reads `v_order_balances` (orders, money) and `v_inquiries_open`; if a view is missing (lower sprint state), the section shows `msg.empty.generic` | Dev-1 (guard like Home) |
| WhatsApp text for `wa.*` is built in the owning module's action and passed to `PhoneActions` as `message`; export buyers always get the English template | each module |
| Status codes in query strings (`?status=sent`, `?filter=due`) are the DB codes; the UI shows words | each module |
| Plain note = `follow_ups` insert with `due_on NULL, done = true, done_at = now()`; reminder = `due_on` set, `done = false`; both set `buyer_id` when known | Dev-1 (sheet component in `src/components/followups/`, used by every detail page) |

## 7. Shared-file rules (no two developers touch the same file)

| File / folder | Owner | Rule |
|---|---|---|
| `src/lib/labels.ts` | Dev-3, Sprint A only | Rewritten to `LABELS: LabelDict = { en: {...}, gu: {...} }` with every key from `labels.md`, plus `ModuleKey`, `UserRole`, `ROLE_PRESETS` (unchanged keys), `ALL_MODULES` (names via `nav.*`, descriptions via `module.*`), `MAIN_NAV` (10 shown modules only, href + lucide icon name), `BAR_ORDER`. Module developers never edit it. |
| `src/app/(dashboard)/<module>/labels.ts` | the module's developer | Module-local extra strings, same `LabelDict` shape, keys prefixed with the module (`inquiries.xxx`). Passed as the `local` argument of `t()`. If a key from `labels.md` is missing in the global file, add it locally under the same key and note it in `tasks/todo.md`; Dev-3 merges after Sprint B. |
| `src/lib/i18n.ts`, `src/lib/status.ts`, `src/lib/phone.ts`, `src/lib/db-errors.ts`, `src/lib/utils.ts` | Dev-3, Sprint A | Not edited after Sprint A. |
| `src/types/database.ts` | nobody after Sprint A | Each developer adds `src/types/inquiries.ts`, `src/types/buyers.ts` (Dev-1), `src/types/samples.ts`, `src/types/quotes.ts` (Dev-2), `src/types/orders.ts`, `src/types/payments.ts`, `src/types/home.ts` (Dev-3). Row interfaces mirror section 3 column names exactly. |
| `src/components/ui/*`, `src/components/shell/*`, `src/components/print/*` | Dev-3, Sprint A | Not modified by module developers. New components go under `src/components/<module>/` (e.g. `src/components/orders/packing-card.tsx`, `src/components/orders/checklist-item.tsx`, `src/components/home/packing-today.tsx`, `src/components/followups/note-sheet.tsx`, `src/components/quotes/quote-items-form.tsx`). |
| `src/app/(dashboard)/layout.tsx`, `src/app/(print)/layout.tsx`, `src/app/layout.tsx`, `src/app/globals.css` | Dev-3 | |
| `src/middleware.ts`, `src/lib/supabase/*`, `scripts/seed.ts`, `scripts/db-url.ts`, `docker-compose.yml`, `.eslintrc.json`, `package.json` | Dev-1, Sprint A | `seed.ts` runs `supabase/migrations/*.sql` then `supabase/seed/*.sql` in filename order. |
| `scripts/ci-tenant-check.ts`, `tests/helpers/db.ts`, `tests/security-fixes.test.ts`, `src/app/(dashboard)/users/actions.ts` | Dev-2, Sprint A | `tests/helpers/db.ts` exports `connect()`, `applyMigrations(client)`, `actAs(client, userId)` (`SET ROLE authenticated` + `set_config('request.jwt.claim.sub', uid, false)`), `resetRole(client)`. |
| `tasks/todo.md` | anyone | append-only notes under your own sprint line |

## 8. Seed files (idempotent, fixed UUIDs, ON CONFLICT)

Run by `scripts/seed.ts` in filename order after the migrations. Row content (names, numbers, dates) is in `docs/design/sample-data.md` (Designer 1); the structural rules are here.

| File | Owner | Rows | Fixed UUIDs (`NN` = 01, 02, ...) |
|---|---|---|---|
| `supabase/seed/01_core.sql` | Dev-1 (Sprint A, moves and fixes today's `supabase/seed.sql`) | org, 4 users, business_settings, app_settings (`currency_rates.USD = 84.25`, `default_incoterm = 'FOB Mundra'`), packaging, products, price list, costs, buyers, contacts; adds `ON CONFLICT` to price_list_items (unique `(org_id, product_id, tier_name)`), product_costs (`(org_id, product_id, effective_date)`), buyer_contacts (`(org_id, buyer_id, phone)`); removes `audit`, `documents`, `reports` from the demo owner's modules | existing ids (`11111111-...`, `22222222-...`, `33333333-...`, `44444444-...`, `55555555-...`) |
| `supabase/seed/02_inquiries.sql` | Dev-1 | 10 inquiries, 8 pending follow-ups, 6 notes (sample-data.md sections 1 and 7) | inquiries `66666666-6666-4666-8666-6666666666NN`, follow_ups `cccccccc-cccc-4ccc-8ccc-ccccccccccNN` |
| `supabase/seed/03_samples_quotes.sql` | Dev-2 | 3 samples, 4 quotes with items (sections 2 and 3) | samples `77777777-7777-4777-8777-7777777777NN`, quotations `88888888-8888-4888-8888-8888888888NN`, quotation_items `89898989-8989-4989-8989-8989898989NN` |
| `supabase/seed/04_orders_money.sql` | Dev-3 | 3 orders with items, 2 dispatches, 4 payments (sections 4-6) | orders `99999999-9999-4999-8999-9999999999NN`, order_items `9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9aNN`, dispatches `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaNN`, payments `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbNN` |

(The RLS test's fixture orgs `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` / `bbbbbbbb-...` live in `organizations`; no clash with dispatch / payment ids.)

Rules:

- Seeds run as `postgres` and INSERT directly (functions would fail the module check with no `auth.uid()`); they set `created_by` to the profile ids in sample-data.md and realistic `created_at` dates relative to `CURRENT_DATE`.
- Seeds pass explicit codes and document numbers (FY `2627`) and then bump the counters to the values in sample-data.md section 9:
  `INSERT INTO entity_code_counters (org_id, prefix, current_val) VALUES (<org>, 'INQ', 10) ON CONFLICT (org_id, prefix) DO UPDATE SET current_val = GREATEST(entity_code_counters.current_val, EXCLUDED.current_val);` and the same for `doc_counters (org_id, doc_type, fy, current_val)`.
- Every INSERT uses `ON CONFLICT (id) DO UPDATE SET ...` (or `DO NOTHING` for items) so `npm run db:seed` can be re-run any number of times and resets the story.
- Seed 02 sets `follow_ups.buyer_id` on every row (derive it from the inquiry / buyer / quote / order in sample-data.md) so `v_followups_today` can show the buyer name and phone without joining later tables. Notes rows: `due_on NULL, done = true, done_at = created_at`.
- Seeded quotation totals: insert the quotation header with the totals from sample-data.md, then the items; the totals trigger recomputes the same numbers. `payments.amount_inr` / `fx_rate` are NULL for INR rows.
- `dispatches.export_checklist` in the seed uses the key `date` (sample-data.md shows `on`; use `date`). Truck dispatch: `'{}'`.
- Dates are relative to `CURRENT_DATE` (`CURRENT_DATE - 6`) so "Late 6 days", "due today" and "expires tomorrow" stay true on demo day.

## 9. Test files

Vitest, `pg` client, pattern from `tests/rls-tenant-isolation.test.ts` via `tests/helpers/db.ts`. Each file uses its own org / user UUIDs so files can run in parallel, applies all migrations in `beforeAll`, and cleans its rows in `afterAll`.

| File | Owner | Fixture orgs | Must cover |
|---|---|---|---|
| `tests/inquiries.test.ts` | Dev-1 | `c1c1c1c1-...` (A), `c2c2c2c2-...` (B); users: owner A, sales A (leads, buyers), ops A (no leads), owner B | happy path: insert inquiry as sales -> code `INQ-0001`; `fn_inquiry_set_status` new -> talking -> quoted; lost without reason raises `reason_required`; lost -> talking as sales raises `42501` (`role_not_allowed`), as owner succeeds; `'won'` raises `invalid_transition`; direct `UPDATE inquiries SET status` as sales raises (column grant); plain note insert with `due_on NULL, done = true` passes the CHECK, `due_on NULL, done = false` fails; missing module: ops calling `fn_inquiry_set_status` -> SQLSTATE `42501`; cross-tenant: owner B `SELECT FROM inquiries` -> 0 rows, `fn_inquiry_set_status` on A's id -> `42501`; `fn_follow_up_done` as a user without the mapped module -> `42501`; `v_followups_today` returns only due rows (not notes) and only own org |
| `tests/quotes.test.ts` | Dev-2 | `d1d1d1d1-...` (A), `d2d2d2d2-...` (B) | sample to_send -> sent sets `sent_on`, inquiry -> `sample_sent`, follow-up created at +7 with `buyer_id`; approved marks that follow-up done; quote draft with items computes totals (INR GST 5%, USD GST 0); `incoterm = 'FOB Pipavav'` accepted, `'FOB'` rejected by CHECK; item below floor as sales raises `below_floor_price` with DETAIL = floor; same as owner succeeds; `fn_quote_send` without items -> `no_items`; after send, direct UPDATE of the quote as sales affects 0 rows; `fn_quote_reject` requires reason and leaves the inquiry `quoted`; missing module -> `42501`; cross-tenant -> 0 rows / `42501` |
| `tests/orders-payments.test.ts` | Dev-3 | `e1e1e1e1-...` (A), `e2e2e2e2-...` (B) | `fn_quote_accept(q, date, 30)` on a sent quote returns an order with `PI-` number, items, `advance_expected = 30%`, quote accepted, inquiry won, advance follow-up at +3; expired quote -> `quote_expired`; `fn_order_set_status` confirmed -> in_production works without advance; ready -> confirmed raises; cancel as sales -> `42501`, as owner works; `fn_order_set_packed(order, 480)` -> `ready`; `fn_order_dispatch` truck without `vehicle_no` -> `bad_payload`; container creates `INV-` / `SDN-` numbers, a checklist with `stuffing_done` and `invoice_packing_list` done, and a "Balance" follow-up at dispatched_on + credit days; `fn_dispatch_tick` unknown key -> `bad_payload`; ops ticking `phyto` -> `42501`; `bl_received` without BL no -> `bl_required`; with BL no sets `bl_no` and a follow-up due today; `fn_dispatch_delivered` as ops -> `42501`, as accountant -> order delivered; `fn_payment_record` USD without `p_amount_inr` -> `bad_payload`; INR stores NULL `amount_inr`; balances: `v_order_balances.money_status` paid / due / overdue with `credit_period_days`; `v_home_kpis` one row with correct counts and `money_due_about_inr`; direct INSERT into payments as authenticated raises (no grant); missing module (`payments`) -> `42501`; cross-tenant -> 0 rows / `42501` |

Assertion helpers: `await expect(client.query(...)).rejects.toMatchObject({ code: '42501' })` for module / role / cross-tenant; `{ code: 'P0001', message: 'invalid_transition' }` for transitions.

## 10. Code values vs words

- The database stores snake_case English codes exactly as in the CHECK constraints above (plus the price-basis texts `EXW` / `FOB Pipavav` / `FOB Mundra` / `CIF`). It never stores Gujarati and never stores display words.
- The UI never prints a raw code; every code goes through `t(lang, 'status.<domain>.<code>')` (or `source.*`, `lost_reason.*`, `pay_mode.*`, `buyer_type.*`, `incoterm.*` with the space replaced by `_`, `dispatch_mode.*`, `role.*`, `checklist.*`).
- Query strings, form values and RPC parameters carry codes; labels are resolved at render.
- Free-text columns (`notes`, `packing_note`, `result_note`, `follow_ups.note`) store whatever the user typed in any script. System-generated follow-up notes are short English strings containing the code or amount (`Sample SMP-0003 sent, ask for result`, `Balance $18,900 due`).
- Document numbers, entity codes, buyer and product names, phone numbers and amounts are the same in both languages.
- QA gate 2 greps rendered pages for `[a-z]+_[a-z]+` tokens inside visible text to catch leaked codes.

## 11. Amendments after Sprint A (binding, 2026-11-13)

| # | Amendment | Reason |
|---|---|---|
| A1 | Catalog writes (products, packaging_types, price_list_items, product_costs) require `fn_has_module('catalog') AND fn_user_role() IN ('owner','accountant')`. Sales and Plant hold `catalog` only for the read-only Products list. | Without it the seeded sales/ops users could set `floor_price = 1` and void the 0005 floor guard (verified by Dev-2). Implemented in 0003. |
| A2 | The demo owner keeps all 13 modules in `profiles.modules`; `documents`, `reports` and `audit` are hidden from the menu only (`MAIN_NAV` lists the 10 shown modules). Section 8's "drop them from the owner" is withdrawn. | Keeps the audit trail and history available later without re-seeding. |
| A3 | Migration 0001's `GRANT ALL` / `ALTER DEFAULT PRIVILEGES` block is narrowed to `SELECT, INSERT, UPDATE, DELETE` on tables so that a tool applying 0001 alone never re-opens TRUNCATE. 0003 still revokes/normalises everything afterwards. | Dev-2 finding: end state was correct only because 0003 runs after 0001. |
| A4 | Error codes from `fn_set_user_access` / `fn_set_user_active`: `self_change`, `role_not_allowed`, `not_found` -> SQLSTATE 42501; `last_owner`, `bad_payload` -> SQLSTATE P0001. `fn_require_module` keeps 'Access denied: module X is required' (42501). Use the same split in 0004-0006. | Contract was silent; permission failures and rule failures stay distinguishable. |
| A5 | New SECURITY DEFINER functions in 0004-0006 must be added to `SECURITY_DEFINER_ALLOWLIST` in `scripts/ci-tenant-check.ts` (Dev-2's file; the contract's function names are already listed). `fn_next_code` / `fn_next_doc_no` are callable only from SECURITY DEFINER functions; policy-inserted tables get codes via `fn_assign_code` / `fn_assign_doc_no` BEFORE INSERT triggers. | Matches 0003 as implemented. |

## 12. Amendments after Sprint B (binding, 2026-11-16)

| # | Amendment | Reason |
|---|---|---|
| A6 | Plant (`fn_user_role() = 'operations'`) does not read money. `payments` SELECT policy adds `fn_user_role() IS DISTINCT FROM 'operations'`; `v_order_balances` and `v_money_due` return no rows to operations; `v_home_kpis` money columns return 0 to operations. No Plant screen reads these. This replaces the org-wide read in 3.9 for money only. | SEC2-10: screens hide money from Plant, the API did not. |
| A7 | Orders keep one date per step: `orders.step_dates jsonb NOT NULL DEFAULT '{}'` with keys `confirmed`, `in_production`, `ready`, `dispatched`, `delivered` (ISO date). Set by `fn_quote_accept`, `fn_order_set_status`, `fn_order_set_packed`, `fn_order_dispatch`, `fn_dispatch_delivered`; seed 04 fills it from sample-data. The order stepper and the packing card show these dates. | G2-09 (screens.md 16A/16B). |
| A8 | `fn_payment_record` raises `bad_payload` (P0001, DETAIL `received_on`) when `p_received_on > CURRENT_DATE`, and for non-owners `bad_payload` (DETAIL `over_payment`) when `p_amount` is more than 110% of the order's due in the order currency. | SEC2-08. |
| A9 | Row starts and deletes: INSERT policies pin the starting state and the author: inquiries `status = 'new'`, samples `status = 'to_send'`, quotations `status = 'draft'` with `sent_at`/`decided_at`/`reject_reason` NULL, follow_ups `done_by IS NULL` and either (`done = false`) or (`due_on IS NULL AND done = true`); all four `created_by IS NULL OR created_by = auth.uid()`. DELETE: follow_ups only plain notes (`due_on IS NULL`) by their author, or any row by the owner; samples only `status = 'to_send'`. Quotation totals are always recomputed by the totals trigger, never taken from the insert. | G2-05, SEC2-05, SEC2-11. |
| A10 | Migration `0007_hardening.sql` (Dev-2): every function in `public` loses EXECUTE from `PUBLIC` and `anon`; `authenticated` keeps EXECUTE on what policies, views and actions call; number generators and trigger functions stay locked; default privileges no longer grant functions to `anon`. `ci-tenant-check` fails if any allowlisted definer is executable by `anon` or lacks `SET search_path`. | SEC1-04, SEC1-09, SEC1-11, SEC2-09. |
| A11 | Demo login: the "Try as" buttons render only when the server-side env `DEMO_MODE=true` (read in the server component; `NEXT_PUBLIC_DEMO_MODE` is retired). The demo password lives only in server env `DEMO_PASSWORD` and the "Try as" sign-in runs in a server action; the client bundle never contains the password. | SEC1-06. |
| A12 | Receipt view `/payments/[id]` and receipt print `(print)/payments/[id]/print` (6.1) are in scope for Sprint C. | G2-08. |
