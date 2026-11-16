# Mahuva CRM - Screens (Designer 1)

Scope = the approved table in `tasks/todo.md`. Nothing here is outside that table.
Companion files by Designer 2: `labels.md` (all strings + Gujarati), `status-colours.md` (colour + icon per word), `components.md` (sizes, fonts, tap targets), `contracts.md` (tables, status values, SQL functions).
Flows and transitions: `flows.md`. Demo walk-through: `demo-script.md`. Seed rows: `sample-data.md`.

## 0. Conventions used on every screen

| Rule | Value |
|---|---|
| Frame | Phone 390 px wide. Wireframes below are phone. One line per screen says what changes on desktop (>= 768 px: sidebar stays, bottom bar hidden). |
| Header | Back arrow (48 px) + screen title (20 px bold) + speaker icon (plays Gujarati help clip, same spot on every screen). No breadcrumbs. |
| Primary action | One full-width 48 px button, sticky at the bottom above the bottom bar. Green. Only one per screen. |
| Secondary actions | Outline buttons in one row above the primary, or text links. Never more than 2 side by side. |
| Status | `[Word]` in wireframes = StatusBadge: colour + icon + one word from `status-colours.md`. |
| Phone number | Wherever a phone shows: two 48 px round buttons `(Call)` = `tel:` and `(WhatsApp)` = `wa.me/<digits>?text=<prefilled>` (templates in `flows.md` section 9). |
| Lists | Card rows, 3 facts per row max + one status chip + chevron. Search box = "Search name or phone" (matches buyer name, contact name, phone digits, document code). Filter chips scroll sideways, first chip "All" with count. Newest first. |
| Forms | Max 5-6 fields visible, rest under `> More`. Prefer chips over typing. Required fields marked `*`. Save = primary. Validation message appears under the field in red, 16 px, plain words. |
| Numbers | INR `₹1,25,000` (lakh grouping). USD `$18,900` (international grouping, no decimals unless needed). Qty `12,000 kg` and `(12 MT)` where helpful. Rates `₹185/kg`, `$2,250/MT`. |
| Dates | `06 Nov 2026`. Relative words next to dates where it helps: `today`, `2 days left`, `6 days late`. |
| Sheets | "Sheets" = full-screen pages on phone (route or `?sheet=`), right-side drawer on desktop. Never a small modal on phone. |
| Look before you leap | Anything that creates a numbered document (quote accepted -> order + PI, dispatch -> INV + SDN, money -> REC) shows a one-screen summary with `[Change]` and `[Looks right]` first. |
| Save success | Green toast with the new code: "Saved - INQ-0011". Auto-hides in 3 s. |
| Save failure | Red bar under the header: "Could not save. Check internet and tap Save again." Form data is kept. |
| Load failure | Centre text "Could not load. Tap to try again." with one `[Try again]` button. |

### 0.1 Routes, module keys and roles

Roles come from `profiles.role`; menu visibility from `profiles.modules` (Wall 3). Seed roles hold:
owner = everything; accountant (Accounts) = dashboard, buyers, quotes, orders, payments, catalog, settings; sales (Sales) = dashboard, leads, buyers, samples, quotes, orders, catalog; operations (Plant) = dashboard, buyers, samples, orders, catalog. `documents`, `reports`, `audit` are hidden in the demo even if held.

| # | Screen | Route | Module | Owner | Accounts | Sales | Plant |
|---|---|---|---|---|---|---|---|
| 1 | Login | `/login` | - | all | all | all | all |
| 2 | Home | `/` | dashboard | yes | yes | yes | yes (packing variant) |
| 3 | Inquiries list | `/inquiries` | leads | yes | - | yes | - |
| 4 | Inquiry detail | `/inquiries/[id]` | leads | yes | - | yes | - |
| 5 | New inquiry | `/inquiries/new` | leads | yes | - | yes | - |
| 6 | Buyers list | `/buyers` | buyers | yes | yes | yes | yes |
| 7 | Buyer detail | `/buyers/[id]` | buyers | yes | yes | yes | yes (no money card) |
| 8 | New / edit buyer | `/buyers/new`, `/buyers/[id]/edit` | buyers | yes | yes | yes | - (read only) |
| 9 | Samples list | `/samples` | samples | yes | - | yes | yes |
| 10 | Send sample | `/samples/new?inquiry=<id>` | samples | yes | - | yes | yes |
| 11 | Quotes list | `/quotes` | quotes | yes | yes | yes | - |
| 12 | Quote detail | `/quotes/[id]` | quotes | yes | yes | yes | - |
| 13 | New quote | `/quotes/new?inquiry=<id>` | quotes | yes | yes | yes | - |
| 14 | Quote print | `/quotes/[id]/print` | quotes | yes | yes | yes | - |
| 15 | Orders list | `/orders` | orders | yes | yes | yes | yes |
| 16 | Order detail (+ packing card) | `/orders/[id]` | orders | full | full | full | packing card only |
| 17 | Dispatch form | `/orders/[id]/dispatch` | orders | yes | yes | yes | short variant |
| 18 | Export checklist | `/orders/[id]/checklist` | orders | yes | yes | yes | read + tick COA / stuffing |
| 19 | Print PI | `/orders/[id]/print/pi` | orders | yes | yes | yes | - |
| 20 | Print invoice / dispatch slip | `/orders/[id]/print/invoice`, `/orders/[id]/print/slip` | orders | yes | yes | yes | slip only |
| 21 | Money list | `/payments` | payments | yes | yes | - | - |
| 22 | Money received | `/payments/new?order=<id>` | payments | yes | yes | - | - |
| 23 | Products | `/catalog` | catalog | yes + cost | yes + cost | yes | yes |
| 24 | Staff | `/users` | users | yes | - | - | - |
| 25 | My Company | `/settings` | settings | yes | yes | - | - |
| 26 | Access denied / Account inactive | `/access-denied`, `/account-inactive` | - | all | all | all | all |

Opening a route without the module -> `/access-denied` (screen 26). Plant opening `/orders/[id]` gets the packing-card variant of screen 16, not a different route.

### 0.2 Bottom bar (phone) and More sheet

Default order: `Home · Inquiries · Quotes · Orders · Money · [More]`. The bar always has 5 slots; the 5th is always `More`. The first 4 slots are filled, in this order, by held modules: Home, Inquiries, Quotes, Orders, Money, Buyers, Samples, Products.

| Role | Slots 1-4 | More sheet |
|---|---|---|
| Owner | Home, Inquiries, Quotes, Orders | Money, Buyers, Samples, Products, Staff, My Company, Language, Sign out |
| Accounts | Home, Quotes, Orders, Money | Buyers, Products, My Company, Language, Sign out |
| Sales | Home, Inquiries, Quotes, Orders | Buyers, Samples, Products, Language, Sign out |
| Plant | Home, Orders, Buyers, Samples | Products, Language, Sign out |

Owner note: Money sits in More for the owner only because the 4 slots fill first; the Money tile on Home is the owner's main door to it. (If the team prefers, swap Quotes out for Money for owner; the rule is data-driven either way.)

```
+----------------------------------------+
|  (home)  (inbox)  (tag)  (bag)  (dots) |
|  Home  Inquiries Quotes Orders  More   |
+----------------------------------------+

More sheet (slides up, full height on phone)
+----------------------------------------+
|  Hareshbhai Mehta - Owner              |
|----------------------------------------|
|  (rupee)  Money                      > |
|  (people) Buyers                     > |
|  (flask)  Samples                    > |
|  (box)    Products                   > |
|  (users)  Staff                      > |
|  (shop)   My Company                 > |
|----------------------------------------|
|  Language   [ English ] [ Gujarati ]   |
|  [ Sign out ]                          |
+----------------------------------------+
```

Each row 56 px, icon 24 px, label 17 px. Language toggle writes cookie `lang` and reloads.

### 0.3 Status words used in this file

| Thing | DB value -> word |
|---|---|
| Inquiry | new -> New · talking -> Talking · sample_sent -> Sample sent · quoted -> Quoted · won -> Won · lost -> Lost |
| Sample | to_send -> To send · sent -> Sent · approved -> Approved · rejected -> Rejected |
| Quote | draft -> Draft · sent -> Sent · accepted -> Accepted · rejected -> Rejected · expired -> Expired (also shown when sent and valid_till < today) |
| Order | confirmed -> Confirmed · in_production -> In production · ready -> Ready · dispatched -> Dispatched · delivered -> Delivered · cancelled -> Cancelled |
| Dispatch | dispatched -> On the way · delivered -> Delivered |
| Money row | due > 0 and past due date -> Late (red) · due > 0 otherwise -> Waiting (amber) · due = 0 -> Paid (green) |
| Advance badge | received >= advance_expected -> Advance OK (green) · else Advance waiting (amber) |
| Follow-up | done = false -> To do (due today = amber, past = red "n days late", future = grey date) · done = true -> Done (grey tick) |
| Staff login | is_active true -> On (green) · false -> Off (grey) |

---

## 1. Login

Route `/login`. Module: none. Everyone.

```
+----------------------------------------+
|                                        |
|                [leaf]                  |
|             Mahuva CRM                 |
|      Inquiries, orders and money       |
|           for your plant               |
|                                        |
|  Email                                 |
|  [ admin@mahuvacrm.com              ]  |
|                                        |
|  Password                              |
|  [ ********                      (eye)]|
|                                        |
|  [             Sign in              ]  |
|                                        |
|  Try as                                |
|  +-----------------+ +---------------+ |
|  | (crown)         | | (book)        | |
|  |  Owner          | |  Accounts     | |
|  +-----------------+ +---------------+ |
|  +-----------------+ +---------------+ |
|  | (phone)         | | (bag)         | |
|  |  Sales          | |  Plant        | |
|  +-----------------+ +---------------+ |
|                                        |
|       [ English ]  [ Gujarati ]        |
+----------------------------------------+
```

| # | Field | Type | Required | Default / prefill | Source |
|---|---|---|---|---|---|
| 1 | Email | email | yes | last used (localStorage) | typed |
| 2 | Password | password with show/hide eye (48 px) | yes | - | typed |

- Primary: `Sign in` -> `supabase.auth.signInWithPassword` -> `/`.
- `Try as` buttons (each 72 px tall, icon + word): fill email + demo password AND sign in with one tap. Visible only when `NEXT_PUBLIC_DEMO_MODE=true`. Map: Owner -> admin@mahuvacrm.com, Accounts -> accountant@mahuvacrm.com, Sales -> sales@mahuvacrm.com, Plant -> ops@mahuvacrm.com.
- Language toggle: sets cookie `lang`, reloads, persists after login.
- Status chips: none.
- Error: red bar above form "Email or password is wrong. Try again." Network: "No internet. Check and try again."
- Busy: button text "Please wait..." with spinner, disabled.
- Desktop: same card centred, max 420 px; Try as stays 2 x 2.

---

## 2. Home

Route `/`. Module `dashboard`. Everyone. Data: `v_home_kpis` (one row), `v_followups_today`, and for Plant `v_orders_in_production`.

```
+----------------------------------------+
| Mahuva Dehydro Foods       12 Nov 2026 |
| Namaste, Hareshbhai             (spkr) |
|----------------------------------------|
| +-----------------+ +----------------+ |
| |  2              | |  1             | |
| |  New inquiries  | |  Quotes        | |
| |  (inbox)        | |  waiting (tag) | |
| +-----------------+ +----------------+ |
| +-----------------+ +----------------+ |
| |  1              | | ₹21,04,200     | |
| |  Orders in      | | + $18,900      | |
| |  production     | | Money due      | |
| |  (bag)          | | [Late]  (rupee)| |
| +-----------------+ +----------------+ |
|                                        |
| To do today (5)                        |
| +------------------------------------+ |
| | Al-Barakah Spice & Grain [6 days late]|
| | Balance $18,900 due - BL sent 10 Nov| |
| | (Call) (WhatsApp)          [ Done ]| |
| +------------------------------------+ |
| | Everest Food Products  [2 days late]| |
| | Send flakes sample for soup mix    | |
| | (Call) (WhatsApp)          [ Done ]| |
| +------------------------------------+ |
| | Al-Barakah Spice & Grain    [Today]| |
| | Sample sent 7 days ago - ask result| |
| | (Call) (WhatsApp)          [ Done ]| |
| +------------------------------------+ |
|   See all 5  >                         |
|                                        |
| [ +  New Inquiry                     ] |
| [ +  New Quote                       ] |
| [ ₹  Money Received                  ] |
|----------------------------------------|
|  Home  Inquiries  Quotes  Orders  More |
+----------------------------------------+
```

Tiles (each 48% width, 120 px tall; number 32 px bold; label 17 px; shown only if the module is held):

| Tile | Number in words | Colour rule | Tap opens |
|---|---|---|---|
| New inquiries | count of inquiries with status `new` | blue; grey when 0 | `/inquiries?status=new` |
| Quotes waiting | count of quotes with status `sent` and valid_till >= today | amber; grey when 0 | `/quotes?status=sent` |
| Orders in production | count of orders with status in (confirmed, in_production, ready) | blue; grey when 0 | `/orders?status=open` (open = those three) |
| Money due | sum of due across orders not cancelled: INR line + USD line if any; second line "about ₹ total" uses `app_settings.currency_rates.USD` | red if any order Late, amber if due > 0, green `Paid` when 0 | `/payments?filter=due` |

"To do today" list (`v_followups_today`: done = false AND due_on <= today, overdue first then today, limit 5 on Home, `See all` -> `/followups`? No: `See all` opens the same list in a full page `/?todo=all` within Home, no new module). Row = buyer name, chip (`Today` / `n days late`), note (one line, ellipsis), phone actions, `Done` (48 px). `Done` calls `fn_follow_up_done` and the row slides out. Tapping the row text opens the linked thing (inquiry / buyer / quote / order) if the module is held, otherwise nothing (row has no chevron). Rows are filtered to entity types whose module the user holds: inquiry->leads, buyer->buyers, quote->quotes, order->orders, payment->payments.

Big buttons (56 px each, shown only if module held): `New Inquiry` -> `/inquiries/new`; `New Quote` -> `/quotes/new`; `Money Received` -> `/payments/new`.

Plant variant (holds none of leads / quotes / payments): tiles = only `Orders in production`; the button row is replaced by **Packing today** = cards from `v_orders_in_production` (buyer, product + cut, bags x 25 kg, ship by, status) each opening screen 16; "To do today" shows only order / buyer follow-ups.

Empty states: tiles show `0` in grey; To do today -> "Nothing to do today. Well done." with a tick icon; Packing today (Plant) -> "No order to pack today."
Error: whole page keeps header and shows "Could not load. Tap to try again."
Desktop: tiles in one row of 4; To do list left (2/3), big buttons stacked right (1/3).

---

## 3. Inquiries list

Route `/inquiries`. Module `leads`. Owner, Sales. Data: inquiries joined to buyers (`v_inquiries_open` + closed rows when the Won / Lost chip is chosen).

```
+----------------------------------------+
| <  Inquiries                    (spkr) |
| [ (Q) Search name or phone           ] |
| (All 10)(New 2)(Talking 2)(Sample sent 1)
| (Quoted 1)(Won 3)(Lost 1)    <- scrolls|
|----------------------------------------|
| Gulf Star Foodstuff Trading      [New] |
| White Flakes · 6,000 kg      today     |
| (Call) (WhatsApp)                    > |
|----------------------------------------|
| Shree Ambica Masala              [New] |
| Red Powder · 500 kg          1 day     |
| (Call) (WhatsApp)                    > |
|----------------------------------------|
| Everest Food Products        [Talking] |
| White Flakes · 2,000 kg      3 days    |
| (Call) (WhatsApp)                    > |
|----------------------------------------|
| Rhine Food Ingredients        [Quoted] |
| White Powder · 18,000 kg    10 days    |
| (Call) (WhatsApp)                    > |
|                                        |
| [ +  New Inquiry                     ] |
|----------------------------------------|
|  Home  Inquiries  Quotes  Orders  More |
+----------------------------------------+
```

Row facts: (1) buyer name (`buyers.company_name` or `inquiries.buyer_name` when no buyer yet), (2) product short name + qty, (3) age in days since created_at. Chip = status. Code `INQ-0010` shown 14 px grey at the right of line 2 on desktop only. Phone actions use the buyer's primary contact phone or `inquiries.phone`.

Filter chips (status values): All / New / Talking / Sample sent / Quoted / Won / Lost. Default = All open (not won / lost) when no `?status=`; `?status=new` from the Home tile preselects New. Sort: New first, then oldest-untouched first inside the chip.

- Primary: `New Inquiry` -> screen 5.
- Secondary: none. Pull to refresh.
- Empty (no inquiries at all): "No inquiries yet. Tap + New Inquiry when a buyer asks for a price." Empty for a chip: "No inquiries here." Search miss: "No inquiry matches. Try the buyer's phone number."
- Desktop: table with columns Buyer, Product + qty, Source, Age, Status, Call / WhatsApp; chips stay; primary button top-right.

---

## 4. Inquiry detail

Route `/inquiries/[id]`. Module `leads`. Owner, Sales.

```
+----------------------------------------+
| <  INQ-0006               [Sample sent]|
|----------------------------------------|
| Al-Barakah Spice & Grain LLC         > |
| Dubai, UAE · Tariq Al-Mansoor          |
| +971 4 223 9876    (Call)  (WhatsApp)  |
|----------------------------------------|
| They want                              |
| Pink Onion Chopped 3-5 mm              |
| 12,000 kg (12 MT)                      |
| Needed by 15 Dec 2026                  |
| Came by WhatsApp · 9 days ago · Pooja  |
|----------------------------------------|
| Sample   SMP-0002  [Sent]  05 Nov  DHL |
| Quote    -                             |
|----------------------------------------|
| Notes & follow-ups        [+ Add note] |
| ( ) 12 Nov  Ask Tariq for sample result|
|              [Today]           [ Done ]|
| (v) 05 Nov  Sample 500 g sent by DHL   |
| (v) 03 Nov  Wants 12 MT before Ramadan |
|----------------------------------------|
| [ Send sample ]      [ Mark lost ]     |
| [            Make quote              ] |
+----------------------------------------+
```

Sections and sources:

| Block | Shows | Source |
|---|---|---|
| Header | code, status chip | inquiries.code, status |
| Buyer card | company, city/country, primary contact name, phone, Call / WhatsApp; chevron opens buyer detail. If `buyer_id` is NULL: shows `buyer_name`, `phone` and a link `Save as buyer` -> screen 8 prefilled | buyers, buyer_contacts (is_primary), inquiries.buyer_name / phone |
| They want | product name (or product_text), qty kg (+ MT when >= 1,000), needed by, source word, age, assigned person first name | inquiries.product_id -> products.name, qty_kg, needed_by, source, created_at, assigned_to -> profiles.full_name |
| Linked | latest sample (code, status, sent_on, courier) and latest quote (number, total, status), each a link | samples, quotations by inquiry_id |
| Notes & follow-ups | timeline, newest first: pending rows show empty circle, chip Today / n days late / date, `Done` button; done rows show grey tick + date | follow_ups where entity_type = 'inquiry' |
| Lost reason | when status lost: "Lost - Price" grey line under header | inquiries.lost_reason |

Primary button by status:

| Status | Primary | Secondary row |
|---|---|---|
| New | `Reply on WhatsApp` (opens wa.me with template T1; on return, status -> Talking) | `Send sample`, `Make quote`; `Mark lost` as red text link |
| Talking | `Make quote` -> screen 13 with `?inquiry=` | `Send sample`, `Mark lost` |
| Sample sent | `Make quote` | `Send sample` (another), `Mark lost` |
| Quoted | `Open quote` -> screen 12 | `Mark lost` |
| Won | `Open order` -> screen 16 | - |
| Lost | none; shows `Lost - <reason>` | `Reopen` (owner only) -> status talking |

`Add note` sheet: fields Note (text, required), `Remind me on` (date, optional; chips Tomorrow / 3 days / 7 days). Save: with a date -> follow_up pending; without -> follow_up with due_on NULL, done = true (shows as a note). First note on a New inquiry moves it to Talking.

`Mark lost` sheet: "Why did we lose it?" four chips `Price` `Quality` `Timing` `No reply` (values price / quality / timing / no_reply), optional note, primary `Mark lost` (red). Calls `fn_inquiry_set_status(id, 'lost', reason)`.

Status chips shown: inquiry status; sample status; quote status; follow-up chips.
Empty: timeline -> "No notes yet. Tap + Add note."
Desktop: two columns - left buyer + they want + linked, right timeline; buttons bottom-right of left column.

---

## 5. New inquiry

Route `/inquiries/new` (also `/inquiries/new?buyer=<id>` from a buyer page). Module `leads`. Owner, Sales.

```
+----------------------------------------+
| <  New Inquiry                         |
|----------------------------------------|
| Buyer *                                |
| [ (Q) Search name or phone           ] |
|   Al-Barakah Spice & Grain · Dubai     |
|   Everest Food Products · Mumbai       |
|   [+ New buyer]  -> Name [    ]        |
|                    Phone [ +91     ]   |
|                                        |
| What do they want? *                   |
| (White Flakes) (White Minced)          |
| (White Powder) (Red Flakes)            |
| (Red Powder)   (Pink Chopped)  (Other) |
|                                        |
| How much? *                            |
| [ 12         ]   ( kg | MT )           |
|                                        |
| Needed by                              |
| [ 15 Dec 2026              (calendar)] |
|                                        |
| How did they contact us? *             |
| (WhatsApp)(Call)(Visit)(Email)(IndiaMART)
|                                        |
| > More  (note)                         |
|                                        |
| [               Save                 ] |
+----------------------------------------+
```

| # | Field | Type | Required | Default / prefill | Writes to |
|---|---|---|---|---|---|
| 1 | Buyer | search picker (name / phone / city), results as rows; `+ New buyer` reveals Name + Phone inline | yes (existing or name + phone) | `?buyer=` if given | inquiries.buyer_id OR buyer_name + phone (buyer row is NOT created yet; "Save as buyer" later on detail) |
| 2 | What do they want | 6 product chips (icon = form, label = colour + form, e.g. "White Flakes") + `Other` (reveals text) | yes | - | product_id, or product_text |
| 3 | How much | number + unit toggle `kg | MT` (MT x 1,000) | yes | unit = MT for export buyer, kg for India | qty_kg |
| 4 | Needed by | date | no | - | needed_by |
| 5 | How did they contact us | chips WhatsApp / Call / Visit / Email / IndiaMART | yes | WhatsApp | source (whatsapp / call / visit / email / indiamart) |
| More | Note | text | no | - | notes |
| hidden | Assigned to | - | - | current user | assigned_to, created_by |

- Primary: `Save` -> insert inquiry (code via `fn_next_code('INQ')`, status new) -> toast "Saved - INQ-0011" -> opens screen 4 whose primary is `Reply on WhatsApp`.
- Secondary: none (back arrow asks "Leave without saving?" only if something was typed).
- Validation copy: "Pick a buyer or type a name and phone." / "Pick a product." / "Type how much." / "Phone must have 10 digits (India) or start with +."
- Desktop: same form, max 560 px, product chips in one row of 6.

---

## 6. Buyers list

Route `/buyers`. Module `buyers`. Everyone. Data: buyers + primary contact + `v_money_due` (money columns hidden for Plant and Sales without `payments`? No: due amount is shown to all who hold `buyers`; only the Money screens need `payments`).

```
+----------------------------------------+
| <  Buyers                       (spkr) |
| [ (Q) Search name or phone           ] |
| (All 4)(India 2)(Export 2)             |
|----------------------------------------|
| Al-Barakah Spice & Grain LLC           |
| Dubai, UAE            $18,900  [Late]  |
| (Call) (WhatsApp)                    > |
|----------------------------------------|
| Haldiram Snacks Private Limited        |
| Noida               ₹5,11,875 [Waiting]|
| (Call) (WhatsApp)                    > |
|----------------------------------------|
| Everest Food Products Pvt Ltd          |
| Mumbai                     ₹0  [Paid]  |
| (Call) (WhatsApp)                    > |
|----------------------------------------|
| Rhine Food Ingredients GmbH            |
| Hamburg, Germany           ₹0  [Paid]  |
| (Call) (WhatsApp)                    > |
|                                        |
| [ +  New Buyer                       ] |
+----------------------------------------+
```

Row facts: (1) company name, (2) city (+ country when not India), (3) money due with pill. Phone = primary contact. Chips: All / India (buyer_type like domestic_%) / Export. Sort: Late first, then name.

- Primary: `New Buyer` -> screen 8 (hidden for Plant).
- Empty: "No buyers yet. Tap + New Buyer." Search miss: "No buyer matches."
- Desktop: table Buyer, City, Country, Phone, Money due, Status; primary top-right.

---

## 7. Buyer detail

Route `/buyers/[id]`. Module `buyers`. Everyone (Plant sees no Money card and no quotes block).

```
+----------------------------------------+
| <  Al-Barakah Spice & Grain LLC [Edit] |
| Export · Dubai, UAE · USD · FOB        |
|----------------------------------------|
| Tariq Al-Mansoor · Managing Director   |
| +971 4 223 9876    (Call)  (WhatsApp)  |
| + 1 more contact                     > |
|----------------------------------------|
| Money due          $18,900     [Late]  |
| ORD-0002 · 6 days late                 |
| [ Remind on WhatsApp ]                 |
|----------------------------------------|
| Inquiries (1 open)                   > |
| INQ-0006 Pink Chopped 12,000 kg        |
|                          [Sample sent] |
|----------------------------------------|
| Quotes (1)                           > |
| QTN-2627-0001  $27,000     [Accepted]  |
|----------------------------------------|
| Orders (1)                           > |
| ORD-0002 White Flakes 12,000 kg        |
|                           [Dispatched] |
|----------------------------------------|
| Notes & follow-ups        [+ Add note] |
| ( ) 06 Nov  Balance $18,900 due        |
|                                 [Done] |
|----------------------------------------|
| [ Add follow-up ]                      |
| [            New inquiry             ] |
+----------------------------------------+
```

| Block | Shows | Source |
|---|---|---|
| Header | company name, `Edit` (buyers module, not Plant), line: India/Export · city, country · currency · incoterm | buyers |
| Contacts | primary contact name + designation + phone with Call / WhatsApp; `+ n more` expands | buyer_contacts |
| Money due | due sum, pill, worst order + days late, `Remind on WhatsApp` (template T6). Hidden for Plant. | v_money_due |
| Inquiries | last 3 open, chevron -> `/inquiries?buyer=<id>` | inquiries |
| Quotes | last 3, chevron -> `/quotes?buyer=<id>` (hidden for Plant) | quotations |
| Orders | last 3 with status, chevron -> `/orders?buyer=<id>` | orders |
| Notes & follow-ups | timeline as in screen 4 | follow_ups entity_type = 'buyer' |

- Primary: `New inquiry` -> `/inquiries/new?buyer=<id>` (if `leads` held) else `Add follow-up`.
- Secondary: `Add follow-up` (same sheet as Add note with date required), `Edit`.
- Status chips: money pill; inquiry / quote / order status chips.
- Empty blocks: "No inquiries yet." / "No quotes yet." / "No orders yet." / "No notes yet."
- Desktop: header + contacts + money across the top; three columns Inquiries / Quotes / Orders; timeline below.

---

## 8. New / edit buyer

Routes `/buyers/new`, `/buyers/[id]/edit`. Module `buyers`. Owner, Accounts, Sales.

```
+----------------------------------------+
| <  New Buyer                           |
|----------------------------------------|
| Company name *                         |
| [                                    ] |
|                                        |
| Phone (WhatsApp) *                     |
| [ +91                                ] |
|                                        |
| City                                   |
| [                                    ] |
|                                        |
| Where?                                 |
| (  India  |  Export  )                 |
|                                        |
| GST number (optional)        <- India  |
| [ 27AAACE1234A1Z1                    ] |
| Country *                    <- Export |
| [ United Arab Emirates          v    ] |
|                                        |
| > More                                 |
|   Contact person, Their job, Email,    |
|   Type, Address, State, Payment terms, |
|   Credit days, Price basis, Currency,  |
|   PAN                                  |
|                                        |
| [               Save                 ] |
+----------------------------------------+
```

| # | Field | Type | Required | Default | Writes to |
|---|---|---|---|---|---|
| 1 | Company name | text | yes | - | buyers.company_name |
| 2 | Phone (WhatsApp) | tel | yes | `+91 ` for India | buyer_contacts.phone (primary contact; name defaults to company name until More > Contact person is filled) |
| 3 | City | text | no | - | buyers.city |
| 4 | Where? | toggle India / Export | yes | India | India -> buyer_type domestic_masala, country India, currency INR, incoterm EXW, credit 30 days, payment terms "30 days credit"; Export -> buyer_type export_importer, currency USD, incoterm FOB, credit 0, payment terms "30% advance, 70% against BL copy" |
| 5a | GST number (India only) | text, 15 chars | no | - | buyers.gstin |
| 5b | Country (Export only) | dropdown with flag | yes | UAE | buyers.country |
| More | Contact person; Their job; Email | text | no | - | buyer_contacts.name / designation / email |
| More | Type | chips Masala maker / Food factory / Importer / Agent | no | from toggle | buyers.buyer_type |
| More | Address, State, PAN | text | no | - | buyers.address / state / pan |
| More | Payment terms | chips as in quote form | no | from toggle | buyers.payment_terms |
| More | Credit days | number | no | from toggle | buyers.credit_period_days |
| More | Price basis | chips EXW / FOB / CIF | no | from toggle | buyers.incoterm |
| More | Currency | chips INR / USD | no | from toggle | buyers.preferred_currency |

- Primary: `Save` -> buyer_code via `fn_next_code('BUY')`, insert buyer + primary contact; returns to detail (or back to the calling inquiry form with the buyer selected when opened via `?return=`).
- Validation: "Type the company name." / "Phone must have 10 digits (India) or start with +." / "GST number has 15 letters and digits."
- Edit mode: same form, title "Edit Buyer", a `Login off` style `Buyer active` switch under More (buyers.status active / inactive).
- Desktop: two columns under 720 px.

---

## 9. Samples list

Route `/samples`. Module `samples`. Owner, Sales, Plant.

```
+----------------------------------------+
| <  Samples                      (spkr) |
| [ (Q) Search name or phone           ] |
| (All 3)(To send 1)(Sent 1)(Approved 1) |
| (Rejected 0)                           |
|----------------------------------------|
| Everest Food Products        [To send] |
| White Flakes · 250 g       INQ-0007    |
| (Call) (WhatsApp)       [ Mark sent ]  |
|----------------------------------------|
| Al-Barakah Spice & Grain        [Sent] |
| Pink Chopped · 500 g   Sent 05 Nov DHL |
| (Call) (WhatsApp) [Approved] [Rejected]|
|----------------------------------------|
| Al-Barakah Spice & Grain    [Approved] |
| White Flakes · 500 g   Sent 05 Oct DHL |
| "Colour and moisture OK" - Tariq       |
|                                        |
| [ +  Send Sample                     ] |
+----------------------------------------+
```

Row facts: (1) buyer, (2) product short name + grams, (3) sent on + courier (or inquiry code when not sent). Row buttons by status: To send -> `Mark sent` (sheet: Courier chips + Tracking no, Save; sets sent_on = today); Sent -> `Approved` / `Rejected` (sheet: optional "What did they say?" note, Save); Approved / Rejected -> none, result_note in quotes. Sort: To send first, then Sent oldest first.

- Primary: `Send Sample` -> screen 10 without `?inquiry=` (buyer + product become pickers).
- Status chips: sample status.
- Empty: "No samples yet. Send one from an inquiry or tap + Send Sample."
- Desktop: table Buyer, Product, Grams, Courier + tracking, Sent on, Status, actions.

---

## 10. Send sample

Route `/samples/new?inquiry=<id>` (or without inquiry). Module `samples`. Owner, Sales, Plant.

```
+----------------------------------------+
| <  Send Sample                         |
|----------------------------------------|
| For  INQ-0006 · Al-Barakah Spice & Grain
|----------------------------------------|
| Product *                              |
| [ Pink Onion Chopped 3-5 mm         v ]|
|                                        |
| How much? *                            |
| (250 g) (500 g) (1 kg) (other [    ])  |
|                                        |
| Courier                                |
| (DHL)(DTDC)(Blue Dart)(Professional)   |
| (By hand)(other)                       |
|                                        |
| Tracking no                            |
| [                                    ] |
|                                        |
| > More  (note to buyer, lot no)        |
|                                        |
| [        Save & mark sent            ] |
+----------------------------------------+
```

| # | Field | Type | Required | Default / prefill | Writes to |
|---|---|---|---|---|---|
| 0 | For | read-only line; when no `?inquiry=`: Buyer picker (required) | - | inquiry's buyer | samples.inquiry_id, buyer_id |
| 1 | Product | dropdown of 6 products | yes | inquiry.product_id | product_id |
| 2 | How much | chips 250 g / 500 g / 1 kg / other (grams) | yes | 500 g | qty_grams |
| 3 | Courier | chips DHL / DTDC / Blue Dart / Professional / By hand / other | no | - | courier |
| 4 | Tracking no | text | no | - | tracking_no |
| More | Note | text | no | - | result_note (used as "note" until a result arrives) |

- Primary: text is `Save` when Courier and Tracking are empty (creates status to_send) and becomes `Save & mark sent` once a courier is chosen (creates then calls `fn_sample_set_status(id,'sent')`: sent_on = today, linked inquiry -> Sample sent, follow-up "Ask for sample result" due today + 7).
- After save: toast "Saved - SMP-0004", back to the inquiry detail (or samples list) which now shows the sample line.
- Validation: "Pick a product." / "Pick how much."
- Desktop: same, 560 px.

---

## 11. Quotes list

Route `/quotes`. Module `quotes`. Owner, Accounts, Sales.

```
+----------------------------------------+
| <  Quotes                       (spkr) |
| [ (Q) Search name or phone           ] |
| (All 4)(Draft 1)(Sent 1)(Accepted 1)   |
| (Rejected 1)(Expired 0)                |
|----------------------------------------|
| Rhine Food Ingredients GmbH     [Sent] |
| $49,500        Valid till 13 Nov       |
| QTN-2627-0003        (1 day left)    > |
|----------------------------------------|
| Everest Food Products Pvt Ltd  [Draft] |
| ₹2,20,500      Valid till 26 Nov       |
| QTN-2627-0004                        > |
|----------------------------------------|
| Al-Barakah Spice & Grain   [Accepted]  |
| $27,000        Order ORD-0002          |
| QTN-2627-0001                        > |
|----------------------------------------|
| Haldiram Snacks             [Rejected] |
| ₹5,88,000      Lost - Price            |
| QTN-2627-0002                        > |
|                                        |
| [ +  New Quote                       ] |
+----------------------------------------+
```

Row facts: (1) buyer, (2) total in quote currency, (3) valid till with days left (Sent / Draft), order code (Accepted), reason (Rejected). Quote number 14 px grey on line 3. No Call / WhatsApp on rows (they live on the detail; row space is for money). Chips: All / Draft / Sent / Accepted / Rejected / Expired. `Expired` chip = status sent with valid_till < today OR status expired. Sort: Sent expiring soonest first, then Draft, then the rest newest first.

- Primary: `New Quote` -> screen 13 (buyer picker first).
- Empty: "No quotes yet. Make one from an inquiry or tap + New Quote." Chip empty: "Nothing here."
- Desktop: table Number, Buyer, Items (first product + n more), Total, Valid till, Status.

---

## 12. Quote detail

Route `/quotes/[id]`. Module `quotes`. Owner, Accounts, Sales.

```
+----------------------------------------+
| <  QTN-2627-0003                [Sent] |
|----------------------------------------|
| Rhine Food Ingredients GmbH          > |
| Hamburg, Germany · Hans Weber          |
| +49 40 3298 1234   (Call)  (WhatsApp)  |
|----------------------------------------|
| Items                                  |
| White Onion Powder 100 mesh            |
| 18,000 kg (18 MT) x $2,750/MT  $49,500 |
| 25 kg paper bag with liner             |
|----------------------------------------|
| Total                          $49,500 |
| about ₹41,70,375 (at ₹84.25 per $)     |
| (v) Above floor price                  |
|----------------------------------------|
| CIF · LC at sight                      |
| Valid till 13 Nov 2026 (1 day left)    |
| Sent 03 Nov 2026 by Pooja              |
|----------------------------------------|
| Notes & follow-ups        [+ Add note] |
| ( ) 12 Nov  Quote expires tomorrow -   |
|             call Hans          [Done]  |
|----------------------------------------|
| [ Print ]      [ Share on WhatsApp ]   |
|  Buyer rejected (red text)             |
| [          Buyer accepted            ] |
+----------------------------------------+
```

Domestic totals block:
```
| Subtotal                    ₹2,10,000  |
| GST 5%                        ₹10,500  |
| Total                       ₹2,20,500  |
```

| Block | Shows | Source |
|---|---|---|
| Header | quote_no, status chip (Expired shown when sent and valid_till < today) | quotations |
| Buyer card | as screen 4 | buyers, buyer_contacts |
| Items | per item: product name, qty kg (+ MT), rate with unit, amount; packaging name | quotation_items, products, packaging_types |
| Totals | subtotal / GST / total for INR; total + "about ₹" for USD using `app_settings.currency_rates` | quotations.subtotal, gst_amount, total |
| Floor guard line | green tick "Above floor price" when every item rate >= floor_price_at_time; red "(!) Below floor price - owner only" otherwise (owner can still save/send; others cannot) | quotation_items.rate vs floor_price_at_time |
| Terms | incoterm, payment_terms, valid_till + days left, sent_at + sender | quotations |
| Timeline | follow_ups entity_type = 'quote' | follow_ups |

Buttons by status:

| Status | Primary | Secondary |
|---|---|---|
| Draft | `Share on WhatsApp` (opens wa.me template T2; on return asks "Did you send it?" `Yes, mark sent` -> `fn_quote_send`) | `Edit`, `Print`, `Mark sent` (sent by other means) |
| Sent | `Buyer accepted` (green) -> confirmation sheet below -> `fn_quote_accept` -> opens new order (screen 16) | `Share on WhatsApp` (again), `Print`, `Buyer rejected` (red text -> sheet with 4 chips Price / Quality / Timing / No reply -> `fn_quote_reject`) |
| Accepted | `Open order ORD-xxxx` | `Print` |
| Rejected / Expired | `Make new quote` -> screen 13 prefilled from this quote | `Print` |

`Buyer accepted` confirmation sheet ("look before you leap"):
```
+----------------------------------------+
| Make this an order?                    |
| Rhine Food Ingredients GmbH            |
| White Onion Powder 100 mesh            |
| 18,000 kg = 720 bags x 25 kg           |
| Total $49,500                          |
| Advance due $0 (LC at sight)           |
| Ship by  [ 03 Dec 2026          ]      |
| [ Change ]        [ Looks right ]      |
+----------------------------------------+
```
`Ship by` defaults to today + 21 (export) / today + 7 (India) and becomes `orders.expected_dispatch`. `Looks right` creates ORD + PI, marks quote accepted and inquiry Won, then opens the order with toast "Order ORD-0004 made. PI-2627-0004 ready to print."

Status chips: quote status; follow-up chips.
Error from floor guard on send: red bar "Rate is below floor price. Only the owner can send this quote."
Desktop: two columns (buyer + terms left; items + totals right), buttons bottom-right.

---

## 13. New quote

Route `/quotes/new?inquiry=<id>` or `/quotes/new?buyer=<id>` or `/quotes/new?from=<quote id>` (copy). Module `quotes`. Owner, Accounts, Sales. Also used by `Edit` on a Draft (`/quotes/[id]/edit`, same form).

```
+----------------------------------------+
| <  New Quote                           |
|----------------------------------------|
| Buyer *                                |
| [ Rhine Food Ingredients GmbH       v ]|
| Export · USD                            |
|----------------------------------------|
| Items *                                |
| +------------------------------------+ |
| | White Onion Powder 100 mesh    (x) | |
| | How much [ 18,000 ] ( kg | MT )    | |
| | Rate  [ 2,750 ] $/MT               | |
| | Floor $2,400  (v)         $49,500  | |
| +------------------------------------+ |
| [ + Add item ]                         |
|----------------------------------------|
| Price basis *                          |
| (EXW)(FOB Pipavav)(FOB Mundra)(CIF)    |
|                                        |
| Payment *                              |
| (30% adv, 70% on BL)(50% advance)      |
| (100% advance)(30 days credit)         |
| (LC at sight)                          |
|                                        |
| Valid for *   (7)(10)(15)(30) days     |
|                                        |
| > More  (packing, note)                |
|----------------------------------------|
| Total $49,500   about ₹41,70,375       |
| [            Save quote              ] |
+----------------------------------------+
```

| # | Field | Type | Required | Default / prefill | Writes to |
|---|---|---|---|---|---|
| 1 | Buyer | picker (locked when from inquiry) | yes | inquiry.buyer_id; currency = buyer.preferred_currency if a price list row exists in it, else USD for export / INR for India | quotations.buyer_id, currency, inquiry_id |
| 2 | Items (1..n) | item card: product chip/dropdown; How much (number + kg/MT toggle); Rate (number, unit label from price list: ₹/kg or $/MT); floor line; amount | at least 1 | first item = inquiry product + qty; rate = `price_list_items.rate` for product + currency; floor = `price_list_items.floor_price` copied to floor_price_at_time; gst_rate = products.gst_rate for INR, 0 for USD | quotation_items (product_id, qty_kg, unit, rate, amount, floor_price_at_time, gst_rate, sort_order) |
| 3 | Price basis | chips EXW / FOB Pipavav / FOB Mundra / CIF | yes | buyer.incoterm (FOB -> `app_settings.default_incoterm`, i.e. FOB Mundra) | quotations.incoterm (text as shown) |
| 4 | Payment | chips: "30% advance, 70% against BL copy" / "50% advance, 50% before dispatch" / "100% advance" / "30 days credit" / "LC at sight"; `other` reveals text | yes | buyer.payment_terms matched by leading number, else shown as custom chip | quotations.payment_terms |
| 5 | Valid for | chips 7 / 10 / 15 / 30 days | yes | 10 | valid_till = today + n |
| More | Packing | dropdown of packaging_types | no | 25 kg paper bag with liner | quotation_items.packaging_type_id |
| More | Note | text | no | - | quotations.notes |

Floor line under rate, live: `Floor $2,400 (v)` green when rate >= floor; `Below floor $2,400 - owner only (!)` red when below. Non-owner `Save quote` is blocked with the red bar text; owner can save (trigger `fn_quote_check_floor` allows role owner).
Amount = qty_kg x rate (per kg) or qty_kg / 1000 x rate (per MT). Totals recomputed by `trg_quotation_items_totals`.

- Primary: `Save quote` -> insert quotation (quote_no via `fn_next_doc_no('QTN')`, status draft) + items -> opens screen 12 whose primary is `Share on WhatsApp`.
- Validation: "Pick a buyer." / "Add at least one item." / "Type a rate." / "Rate is below floor price. Only the owner can save this."
- Desktop: items as a table with inline inputs; chips unchanged.

---

## 14. Quote print

Route `/quotes/[id]/print`. Module `quotes`. Opens in a new tab; A4 portrait; `window.print()` button top-right (screen only). Data: quotations + items + buyers + business_settings.

```
+------------------------------------------------------------+
| [logo] MAHUVA DEHYDRO FOODS                                |
|        Mahuva Dehydration Private Limited                  |
|        Plot 42, GIDC Industrial Estate, Nesvad Road,       |
|        Mahuva 364290, Gujarat, India                       |
|        GSTIN 24AAACM1234F1Z5 · IEC 0309012345              |
|        FSSAI 10019021004321 · +91 98250 12345              |
|------------------------------------------------------------|
|                      QUOTATION                             |
| No. QTN-2627-0003             Date 03 Nov 2026             |
| Valid till 13 Nov 2026                                     |
|                                                            |
| To: Rhine Food Ingredients GmbH                            |
|     Speicherstadt Block D, Am Sandtorkai 48, Hamburg,      |
|     Germany · Attn: Hans Weber                             |
|------------------------------------------------------------|
| # | Product (spec)            | Packing  | Qty    | Rate   | Amount |
| 1 | Dehydrated White Onion    | 25 kg    | 18,000 | $2,750 | $49,500|
|   | Powder, 100 mesh,         | paper    | kg     | per MT |        |
|   | moisture max 4.5%, HSN    | bag with |        |        |        |
|   | 07122000                  | liner    |        |        |        |
|------------------------------------------------------------|
|                                   Total        $49,500     |
| In words: US Dollars forty-nine thousand five hundred only |
|------------------------------------------------------------|
| Price basis: CIF Hamburg        Payment: LC at sight       |
| Delivery: 3-4 weeks from order  Origin: India              |
|------------------------------------------------------------|
| Bank: HDFC Bank, Station Road Mahuva                       |
| A/c 50200029384712 · IFSC HDFC0000842 · SWIFT HDFCINBB     |
|------------------------------------------------------------|
| For Mahuva Dehydration Private Limited                     |
|                                                            |
| ____________________                                       |
| Hareshbhai Mehta (Director) - Authorised Signatory         |
+------------------------------------------------------------+
```

Rules: INR quotes show Subtotal / GST 5% / Total and the buyer's GSTIN; export quotes show no GST and the USD bank (bank_details row with currency USD, else primary). Company block = `business_settings` (trade_name, company_name, address, city, pincode, state, gstin, iec_code, fssai_no, contact_phone). Signatory = `authorized_signatory`. Product spec line = name, mesh, moisture_max_pct, hsn_code. Page footer: "This is a computer-made quotation." Buttons on screen (not printed): `Print`, `Back`.

---

## 15. Orders list

Route `/orders`. Module `orders`. Everyone.

```
+----------------------------------------+
| <  Orders                       (spkr) |
| [ (Q) Search name or phone           ] |
| (Open 1)(All 3)(Confirmed)(In production)
| (Ready)(Dispatched)(Delivered)         |
|----------------------------------------|
| Haldiram Snacks         [In production]|
| White Minced · 5,000 kg · 200 bags     |
| Ship by 17 Nov       o-o-.-.-.  ORD-0003
|                                      > |
|----------------------------------------|
| Al-Barakah Spice & Grain   [Dispatched]|
| White Flakes · 12,000 kg · 480 bags    |
| Container · ETA 24 Nov      ORD-0002 > |
|----------------------------------------|
| Everest Food Products       [Delivered]|
| Red Powder · 3,000 kg · 120 bags       |
| Delivered 05 Oct            ORD-0001 > |
+----------------------------------------+
```

Row facts: (1) buyer, (2) product + qty + bags, (3) next date: Ship by (open), ETA / vehicle (dispatched), Delivered on (delivered). Tiny 5-dot stepper on the right of line 3 (filled = done). Chips: Open (confirmed + in_production + ready, default), All, then one per status. `?status=open` from the Home tile. Sort: open by ship-by soonest; others newest first.

- Primary: none. Orders are made from quotes (screen 12). No `New Order` button in the demo.
- Status chips: order status.
- Empty: "No orders yet. An order is made when a buyer accepts a quote." Chip empty: "Nothing here."
- Desktop: table Code, Buyer, Product, Qty, Bags, Ship by, Status stepper.

---

## 16. Order detail (owner / accounts / sales) and supervisor packing card (Plant)

Route `/orders/[id]`. Module `orders`. Everyone; Plant gets variant B.

### 16A. Full view

```
+----------------------------------------+
| <  ORD-0002               [Dispatched] |
| Al-Barakah Spice & Grain LLC · Dubai > |
| +971 4 223 9876    (Call)  (WhatsApp)  |
|----------------------------------------|
| (v)------(v)------(v)------(v)-----( ) |
| Confirmed In prod. Ready  Dispatched   |
|                              Delivered |
| 16 Oct   21 Oct   03 Nov   06 Nov      |
|----------------------------------------|
| Money                           [Late] |
| Total $27,000 · Received $8,100        |
| Due  $18,900   6 days late             |
| [Advance OK]                           |
| [ Money received ] [ Remind on WhatsApp]
|----------------------------------------|
| Packing card                   Container
| White Onion Flakes 8-15 mm             |
| 480 bags x 25 kg = 12,000 kg           |
| Packed 480 bags (v) · Ship by 07 Nov   |
|----------------------------------------|
| Dispatch                               |
| Container MSKU 482913-7 · Pipavav      |
| Vessel MSC Positano 2646W              |
| Stuffed 06 Nov · ETA 24 Nov            |
| BL MEDUPV2246118 (10 Nov)              |
| INV-2627-0002 · SDN-2627-0002          |
| Export papers  7 of 8 done   [ Open > ]|
|----------------------------------------|
| Papers                                 |
| [ Print PI ]  [ Print invoice ]        |
| [ Dispatch slip ] [ Share on WhatsApp ]|
|----------------------------------------|
| Notes & follow-ups        [+ Add note] |
| ( ) 06 Nov  Balance $18,900 due        |
|                                 [Done] |
|----------------------------------------|
| ... More: Cancel order (owner, before  |
|     dispatch)                          |
| [             Delivered              ] |
+----------------------------------------+
```

| Block | Shows | Source | Hidden for |
|---|---|---|---|
| Header | order_code, status chip, buyer + city with chevron, phone actions | orders, buyers, buyer_contacts | - |
| Stepper | 5 steps Confirmed / In production / Ready / Dispatched / Delivered with the date each was reached (from audit_log of status changes; if unavailable show only ticks) | orders.status (+ audit_log) | - |
| Money | total, received, due, money pill, days late or "due <date>", `Advance OK` / `Advance waiting` badge (advance_expected vs received), `Money received` (payments module) -> screen 22 with `?order=`; `Remind on WhatsApp` (template T6) | v_order_balances, orders.advance_expected | Plant; Sales sees numbers but no `Money received` button |
| Packing card | product + cut (form, mesh), bags x bag size = qty, packaging name, label text, moisture max, ship by, mode icon Truck / Container; `Packed n bags (v)` when packed_bags set | order_items, products, packaging_types, orders.expected_dispatch, orders.packed_bags; mode = `dispatches.mode` if exists else buyer type (export -> Container) | - |
| Dispatch | after dispatch: truck -> vehicle, LR, transporter, bags, qty, date; container -> container no, port, vessel, stuffing date, ETA, BL no (or "BL not yet"); INV + SDN numbers; for container: checklist progress `n of 8 done` with `Open` -> screen 18. Before dispatch: one line "Not dispatched yet." | dispatches | Plant sees it read-only |
| Papers | `Print PI` (always) -> screen 19; `Print invoice` (after dispatch) -> screen 20; `Dispatch slip` (after dispatch) -> `/print/slip`; `Share on WhatsApp` (template T5 with PI / invoice numbers; the PDF itself is shared from the phone share sheet after printing to PDF) | - | Plant (sees only `Dispatch slip`) |
| Timeline | follow_ups entity_type = 'order' | follow_ups | - |

Primary `Next step` button by status (calls `fn_order_set_status` unless noted):

| Status | Primary button | Goes to | Guard |
|---|---|---|---|
| Confirmed | `Start packing` | in_production | if Advance waiting: confirm sheet "Advance not received yet. Start anyway?" `[Wait]` `[Start anyway]` (Plant cannot override: button disabled with text "Wait for advance") |
| In production | `Packed` | sheet "How many bags?" number pad, default = planned bags -> sets `orders.packed_bags`, status ready | bags > 0 |
| Ready | `Dispatch` | screen 17 | - |
| Dispatched | `Delivered` | `fn_dispatch_delivered` -> delivered | - |
| Delivered | none; green "Done" line | - | - |
| Cancelled | none; grey "Cancelled" | - | - |

`More` (three dots in header): `Cancel order` (owner only, status before dispatched) -> confirm "Cancel ORD-0002? The buyer will not be told." -> `fn_order_set_status(id,'cancelled')`.

### 16B. Supervisor packing card (Plant role on the same route)

```
+----------------------------------------+
| <  ORD-0003             [In production]|
|----------------------------------------|
| +------------------------------------+ |
| |  HALDIRAM SNACKS - Noida           | |
| |                                    | |
| |  White Onion Minced 1-3 mm         | |
| |                                    | |
| |  200 bags x 25 kg                  | |
| |  = 5,000 kg                        | |
| |                                    | |
| |  Bag: 25 kg paper bag with liner   | |
| |  Label: Haldiram Snacks Pvt Ltd    | |
| |         Dehydrated White Onion     | |
| |         Minced · Net 25 kg         | |
| |  Moisture max 5.5%                 | |
| |                                    | |
| |  Ship by  17 Nov 2026   (truck)    | |
| +------------------------------------+ |
|                                        |
|  (v) Packing started      10 Nov       |
|                                        |
| [  Packed - how many bags?           ] |
|                                        |
| [  Loaded                            ] |
|   (grey until Packed)                  |
+----------------------------------------+
```

Card text is 20 px, buyer name 24 px bold, numbers 28 px. Everything in Gujarati when `lang=gu` except buyer / product names. No money, no papers, no timeline.

Three buttons = the same transitions as 16A: `Packing started` (confirmed -> in_production; disabled with "Wait for advance" while Advance waiting), `Packed` (sheet "How many bags?" big number pad, default planned bags -> packed_bags + ready), `Loaded` (ready -> opens screen 17 short variant). Done steps turn into a grey line with a tick and date; only the current step is a big green button; the future step is grey.

Label text rule: buyer company_name + product name + "Net 25 kg" (bag capacity) + "Mahuva Dehydro Foods, India". Lot number is handwritten on the bag (not in demo).

Status chips: order status; money pill; Advance badge; dispatch status.
Empty: never empty (an order always has one item). Dispatch block before dispatch: "Not dispatched yet."
Desktop: left column stepper + packing card + dispatch; right column money + papers + timeline; Next step button bottom-right.

---

## 17. Dispatch form

Route `/orders/[id]/dispatch`. Module `orders`. Everyone (Plant sees the short variant: Mode, number, bags; all else under More).

```
+----------------------------------------+
| <  Dispatch  ORD-0002                  |
| Al-Barakah Spice & Grain · 12,000 kg   |
|----------------------------------------|
| How is it going? *                     |
| (  Truck   |   Container  )            |
|                                        |
| Date *        [ 06 Nov 2026          ] |
|                                        |
| Bags *        [ 480  ]                 |
| Qty kg *      [ 12,000 ]               |
|                                        |
| --- Container ---                      |
| Container no *                         |
| [ MSKU 482913-7                      ] |
| Port *   (Pipavav) (Mundra)            |
| > More: Vessel, Stuffing date, ETA,    |
|         Transporter, LR no, Note       |
|                                        |
| --- Truck ---                          |
| Vehicle no *                           |
| [ GJ-04-AX-7712                      ] |
| LR no [          ] Transporter [     ] |
| > More: Note                           |
|                                        |
| [         Save & make papers         ] |
+----------------------------------------+
```

| # | Field | Type | Required | Default | Writes to |
|---|---|---|---|---|---|
| 1 | How is it going | toggle Truck / Container | yes | Container for export buyers, Truck for India | dispatches.mode ('truck' / 'container') |
| 2 | Date | date | yes | today | dispatched_on (container: also stuffing_date unless changed in More) |
| 3 | Bags | number | yes | orders.packed_bags, else qty / bag capacity | bags_count |
| 4 | Qty kg | number | yes | bags x bag capacity | qty_kg -> order_items.dispatched_kg |
| 5t | Vehicle no (truck) | text, uppercase | yes | - | vehicle_no |
| 6t | LR no, Transporter (truck) | text | no | - | lr_no, transporter |
| 5c | Container no (container) | text, uppercase | yes | - | container_no |
| 6c | Port (container) | chips Pipavav / Mundra | yes | from quote incoterm if "FOB Pipavav" / "FOB Mundra", else Mundra (`default_incoterm`) | port |
| More c | Vessel, Stuffing date, ETA | text, date, date | no | stuffing = Date | vessel, stuffing_date, eta |
| More | Transporter, LR no (container truck to port), Note | text | no | - | transporter, lr_no, notes |
| hidden | BL no | - | - | filled later from checklist | bl_no |
| hidden | Invoice total | - | - | sum(qty_kg x rate) for dispatched qty, + GST for INR | invoice_total |

- Primary: `Save & make papers` -> confirmation sheet "480 bags · 12,000 kg · by container MSKU 482913-7. Invoice INV-2627-0002 and slip SDN-2627-0002 will be made." `[Change]` `[Looks right]` -> `fn_order_dispatch` (signature per `contracts.md`; must take mode + container fields) -> order status Dispatched; container mode seeds `export_checklist` with `stuffing_done` and `invoice_packing_list` ticked on Date -> returns to screen 16 with toast "Dispatched. INV-2627-0002 made."
- Plant short variant: fields 1, 3, 5t/5c (+ 6c Port); Date = today hidden; Qty = bags x 25 hidden; everything else under More. The same confirm sheet, the same function.
- Validation: "Type the vehicle number." / "Type the container number." / "Bags must be more than 0." / "Qty cannot be more than the order (12,000 kg)."
- Desktop: two columns; truck / container block switches in place.

---

## 18. Export checklist

Route `/orders/[id]/checklist`. Module `orders`. Owner, Accounts, Sales full; Plant may tick only `Stuffing done` and `COA`. Only shown for container dispatches (`dispatches.mode = 'container'`). Data: `dispatches.export_checklist` jsonb, keys in this order (same as contracts.md 3.8, labels.md 9 and `CHECKLIST_KEYS` in src/lib/status.ts).

```
+----------------------------------------+
| <  Export papers  ORD-0002    7 of 8   |
| Al-Barakah · MSKU 482913-7 · Pipavav   |
|----------------------------------------|
| (v) Container booked          02 Nov   |
| (v) Stuffing done             06 Nov   |
| (v) COA (lab report)          05 Nov   |
| (v) Phyto certificate         08 Nov   |
| ( ) Certificate of Origin   [ Tick ]   |
| (v) Fumigation                06 Nov   |
| (v) Invoice + packing list    06 Nov   |
| (v) BL received  MEDUPV2246118 10 Nov  |
|----------------------------------------|
| ETA 24 Nov 2026 · Vessel MSC Positano  |
|----------------------------------------|
| [     Share status on WhatsApp       ] |
+----------------------------------------+
```

| Key (jsonb) | Label | Extra field on tick |
|---|---|---|
| container_booked | Container booked | - |
| stuffing_done | Stuffing done | - (auto-ticked by dispatch) |
| coa | COA (lab report) | - |
| phyto | Phyto certificate | - |
| coo | Certificate of Origin | - |
| fumigation | Fumigation | - |
| invoice_packing_list | Invoice + packing list | - (auto-ticked by dispatch) |
| bl_received | BL received | BL no (text, required) -> dispatches.bl_no |

jsonb shape per key: `{"done": true, "date": "2026-11-02"}`. Each row 56 px; tapping `Tick` opens a sheet "Done on [date = today]" (+ BL no for the last) with `Save`. Tapping a done row shows `Untick` (owner / accounts). Progress `n of 8` also appears on screen 16.

- Primary: `Share status on WhatsApp` (template T7: list of done / pending items + ETA).
- Status chips: none (ticks only). Progress text turns green at 8 of 8.
- Empty: for a truck dispatch the route redirects to the order with toast "No export papers for truck dispatch."
- Desktop: same list, 640 px.

---

## 19. Print PI (proforma invoice)

Route `/orders/[id]/print/pi`. Module `orders`. Owner, Accounts, Sales. A4, same header block as screen 14.

```
+------------------------------------------------------------+
| [company header block as in Quote print]                   |
|------------------------------------------------------------|
|                  PROFORMA INVOICE                          |
| PI No. PI-2627-0002            Date 16 Oct 2026            |
| Order ORD-0002 · Against quotation QTN-2627-0001           |
|                                                            |
| Buyer: Al-Barakah Spice & Grain LLC                        |
|        Warehouse 14, Al Ras Spice Souk, Deira, Dubai, UAE  |
|        Attn: Tariq Al-Mansoor · +971 4 223 9876            |
|------------------------------------------------------------|
| # | Product (spec)          | Packing     | Qty     | Rate   | Amount |
| 1 | Dehydrated White Onion  | 480 bags x  | 12,000  | $2,250 | $27,000|
|   | Flakes A-Grade, 8-15 mm,| 25 kg paper | kg      | per MT |        |
|   | moisture max 5.5%,      | bag + liner |         |        |        |
|   | HSN 07122000            |             |         |        |        |
|------------------------------------------------------------|
|                                 Total          $27,000     |
|                                 Advance 30%     $8,100     |
|                                 Balance        $18,900     |
| In words: US Dollars twenty-seven thousand only            |
|------------------------------------------------------------|
| Price basis: FOB Pipavav                                   |
| Payment: 30% advance, 70% against BL copy                  |
| Shipment: by 07 Nov 2026, 1 x 20 ft container             |
| Origin: India · Port of loading: Pipavav                   |
|------------------------------------------------------------|
| Bank for remittance: HDFC Bank, Station Road Mahuva        |
| A/c 50200029384712 · IFSC HDFC0000842 · SWIFT HDFCINBB     |
| Beneficiary: Mahuva Dehydration Private Limited            |
|------------------------------------------------------------|
| For Mahuva Dehydration Private Limited                     |
| ____________________  Authorised Signatory                 |
+------------------------------------------------------------+
```

INR orders: Subtotal / GST 5% / Total and buyer GSTIN; advance line from `advance_expected`; bank = primary INR account. On-screen buttons: `Print`, `Back`.

---

## 20. Print invoice and dispatch slip

Routes `/orders/[id]/print/invoice` (latest dispatch, or `?dispatch=<id>`) and `/orders/[id]/print/slip`. Module `orders`. Invoice: Owner, Accounts, Sales. Slip: everyone.

Invoice title and extra lines depend on the buyer:

| | Domestic (INR) | Export (USD) |
|---|---|---|
| Title | TAX INVOICE | COMMERCIAL INVOICE + PACKING LIST |
| Number | INV-2627-0001 | INV-2627-0002 |
| Buyer block | name, address, GSTIN, state, place of supply | name, address, country; consignee = buyer |
| Columns | Product (HSN 07122000), Qty kg, Rate ₹/kg, Amount, GST 5%, Total | Product (HSN), Bags, Net kg, Gross kg, Rate $/MT, Amount |
| Transport lines | Vehicle no, LR no, Transporter, Dispatch date | Container no, Port of loading, Port of discharge (buyer city), Vessel, Stuffing date, ETA, Marks: buyer name + lot |
| Totals | Subtotal, GST 5%, Grand total, in words | Total $, in words; "Export under LUT - no GST" |
| Footer | bank (INR primary), "E-way bill / e-invoice as per Tally", signatory | IEC, FSSAI, bank (USD), SWIFT, signatory |
| Packing list | - | second block: Bags, Net per bag 25.00 kg, Tare 0.45 kg, Total net 12,000 kg, Total gross 12,216 kg |

Gross = net + bags x `packaging_types.tare_weight_kg`.

Dispatch slip (SDN) - half A4, plain, for the plant gate and transporter:
```
+------------------------------------------+
| MAHUVA DEHYDRO FOODS      DISPATCH SLIP  |
| SDN-2627-0002             06 Nov 2026    |
| Order ORD-0002 · Invoice INV-2627-0002   |
| To: Al-Barakah Spice & Grain LLC, Dubai  |
| White Onion Flakes 8-15 mm               |
| 480 bags x 25 kg = 12,000 kg             |
| Container MSKU 482913-7 · Pipavav        |
| Loaded by: ____________  Checked: ______ |
+------------------------------------------+
```
On-screen buttons: `Print`, `Back`. Error if no dispatch: "Not dispatched yet. Dispatch first."

---

## 21. Money list

Route `/payments`. Module `payments`. Owner, Accounts. Data: `v_order_balances` (one row per order not cancelled) + buyer phone.

```
+----------------------------------------+
| <  Money                        (spkr) |
| [ (Q) Search name or phone           ] |
| (All 3)(Late 1)(Waiting 1)(Paid 1)     |
|----------------------------------------|
| Al-Barakah Spice & Grain        [Late] |
| Due $18,900  of $27,000   6 days late  |
| ORD-0002 · against BL copy             |
| (Call) (WhatsApp Remind)             > |
|----------------------------------------|
| Haldiram Snacks              [Waiting] |
| Due ₹5,11,875  of ₹10,23,750           |
| ORD-0003 · after dispatch              |
| (Call) (WhatsApp Remind)             > |
|----------------------------------------|
| Everest Food Products           [Paid] |
| ₹5,04,000 received      last 09 Nov    |
| ORD-0001                             > |
|----------------------------------------|
| Total due   ₹5,11,875 + $18,900        |
|             about ₹21,04,200           |
| [ ₹  Money Received                  ] |
+----------------------------------------+
```

Row facts: (1) buyer, (2) due of total (or received + last date when Paid), (3) order code + why/when (days late / "due 05 Dec" / "after dispatch" / "against BL copy" taken from payment_terms words). Pill = Late / Waiting / Paid (rule in 0.3; computed in the view: Late = due > 0 AND due_date < today). `WhatsApp Remind` uses template T6. Chevron opens the order (screen 16). Chips: All / Late / Waiting / Paid; `?filter=due` from the Home tile = Late + Waiting. Sort: Late (most days first), Waiting (soonest due first), Paid newest first.

Footer line: sum of due per currency and "about ₹" converted at `currency_rates.USD`.

- Primary: `Money Received` -> screen 22.
- Empty: "No orders yet, so no money to collect." Chip Late empty: "Nobody is late. Good." Paid empty: "No order fully paid yet."
- Desktop: table Buyer, Order, Total, Received, Due, Due date, Status, actions; total line at the bottom.

---

## 22. Money received

Route `/payments/new?order=<id>`. Module `payments`. Owner, Accounts. Three taps when opened from a row: amount is prefilled, pick `Bank`, tap `Save`.

```
+----------------------------------------+
| <  Money Received                      |
|----------------------------------------|
| For which order? *                     |
| [ ORD-0002 · Al-Barakah · due $18,900 v]|
|                                        |
| How much? *                            |
| [ 18,900          ]  USD               |
| In rupees  [ 15,92,325 ] at ₹[ 84.25 ] |
|                                        |
| Date *                                 |
| [ 12 Nov 2026                        ] |
|                                        |
| How? *                                 |
| (Cash) (Bank) (UPI) (Cheque) (LC)      |
|                                        |
| > More  (reference no, note)           |
|                                        |
| [               Save                 ] |
+----------------------------------------+
```

| # | Field | Type | Required | Default / prefill | Writes to |
|---|---|---|---|---|---|
| 1 | For which order | picker: search buyer / order code; each option shows buyer, order code, due amount; only orders with due > 0 listed first, then others | yes | `?order=` | payments.order_id, buyer_id (from order) |
| 2 | How much | number, currency label from order | yes | due amount of the order | amount, currency |
| 2b | In rupees (USD only) | number, with rate field | yes when USD | amount x `currency_rates.USD`; rate editable, INR recomputed | amount_inr, fx_rate (see note) |
| 3 | Date | date | yes | today | received_on |
| 4 | How | chips Cash / Bank / UPI / Cheque / LC | yes | Bank | mode (cash / bank / upi / cheque / lc) |
| More | Reference no | text (UTR / cheque no / TT ref) | no | - | reference |
| More | Note | text | no | - | note |

Note for `contracts.md`: `payments` needs `amount_inr numeric(14,2)` and `fx_rate numeric(10,4)` (NULL for INR) so the rupee value and rate are stored, not recomputed later; `fn_payment_record` takes them as optional parameters.

- Primary: `Save` -> `fn_payment_record` -> success screen:
```
+----------------------------------------+
|              (big tick)                |
|        $18,900 received                |
|         REC-2627-0005                  |
|  Al-Barakah Spice & Grain · ORD-0002   |
|  Now due: $0  [Paid]                   |
|                                        |
| [   Share receipt on WhatsApp        ] |
| [               Done                 ] |
+----------------------------------------+
```
`Share receipt` = template T8. `Done` -> back to Money list (or the order when opened from it). Home tile and order money block update on next load.
- Validation: "Pick an order." / "Type the amount." / "Amount is more than due ($18,900). Save anyway?" (allowed, with confirm). / "Pick how the money came."
- Desktop: 560 px form; success as a card.

---

## 23. Products

Route `/catalog`. Module `catalog`. Everyone; cost line only for role owner / accountant (from `v_product_costs`, which must be `security_invoker`).

```
+----------------------------------------+
| <  Products                     (spkr) |
| [ (Q) Search product                 ] |
|----------------------------------------|
| (flake) White Onion Flakes 8-15 mm     |
| ₹185/kg · $2,250/MT                    |
| Floor ₹165 · $2,050   (lock) ₹136.50   |
|                                      v |
|----------------------------------------|
| (flake) White Onion Minced 1-3 mm      |
| ₹195/kg · $2,380/MT                    |
| Floor ₹175 · $2,180   (lock) ₹140.50   |
|----------------------------------------|
| (dust)  White Onion Powder 100 mesh    |
| ₹215/kg · $2,600/MT                    |
| Floor ₹195 · $2,400   (lock) ₹147.00   |
|----------------------------------------|
| (flake) Red Onion Flakes 10-20 mm      |
| ...                                    |
+----------------------------------------+
```

Row facts: (1) icon by form (flakes / minced / chopped = flake icon; powder = dust icon) + short name = colour + form + mesh, (2) domestic rate per kg (`price_list_items` INR tier) and export rate per MT (USD tier), (3) floor prices; cost per kg with lock icon only for owner / accountant (`raw_onion_rate_per_kg + processing_cost_per_kg + packaging_cost_per_kg`, latest effective_date). Tapping a row expands: full name, grade, moisture max, HSN, GST %, and for owner / accountant "Cost is seen only by Owner and Accounts" under the lock.

- Primary: none (read-only in demo). No edit.
- Status chips: none.
- Empty: "No products yet. Ask the owner to add products."
- Desktop: table Product, Domestic ₹/kg, Export $/MT, Floor ₹, Floor $, Cost ₹/kg (lock column shown only to owner / accountant).

---

## 24. Staff

Route `/users`. Module `users`. Owner only. Existing screen simplified; same server actions moved to `fn_set_user_access` / `fn_set_user_active`.

```
+----------------------------------------+
| <  Staff                        (spkr) |
| Who can see what                       |
|----------------------------------------|
| Hareshbhai Mehta                       |
| Owner                       [On]     > |
|----------------------------------------|
| Nileshbhai Shah                        |
| Accounts                    [On]     > |
|----------------------------------------|
| Pooja Patel                            |
| Sales                       [On]     > |
|----------------------------------------|
| Dineshbhai Vaghela                     |
| Plant                       [On]     > |
+----------------------------------------+
```

Row facts: name, job word (owner -> Owner, accountant -> Accounts, sales -> Sales, operations -> Plant), On / Off pill. Tap -> change-access sheet:

```
+----------------------------------------+
| <  Pooja Patel                         |
| sales@mahuvacrm.com                    |
|----------------------------------------|
| Job                                    |
| +-----------------+ +----------------+ |
| | (crown) Owner   | | (book) Accounts| |
| +-----------------+ +----------------+ |
| +-----------------+ +----------------+ |
| | (phone) Sales * | | (bag) Plant    | |
| +-----------------+ +----------------+ |
|                                        |
| Login     (  On  |  Off  )             |
|                                        |
| > Change details                       |
|   [v] Home  [v] Inquiries  [v] Buyers  |
|   [v] Samples [v] Quotes [v] Orders    |
|   [ ] Money [v] Products [ ] Staff     |
|   [ ] My Company                       |
|                                        |
| [               Save                 ] |
+----------------------------------------+
```

| # | Field | Type | Writes to |
|---|---|---|---|
| 1 | Job | 4 big buttons (72 px, icon + word); picking one fills the tick list with the demo preset (ROLE_PRESETS minus documents / reports / audit) | profiles.role + modules via `fn_set_user_access` |
| 2 | Login | On / Off toggle | profiles.is_active via `fn_set_user_active` |
| More | Change details | tick list of the 10 demo modules with plain labels | profiles.modules |

- Primary: `Save` -> toast "Saved". Owner cannot switch own login Off or change own job (buttons disabled, text "You cannot change yourself.").
- Empty: never (owner always exists). No "Add staff" in the demo (staff are created by the seed / Supabase auth).
- Desktop: list left, sheet as right drawer.

---

## 25. My Company

Route `/settings`. Module `settings`. Owner, Accounts. Existing settings form reduced to two cards + More.

```
+----------------------------------------+
| <  My Company                   (spkr) |
|----------------------------------------|
| Company                                |
| Name *   [ Mahuva Dehydration Pvt Ltd ]|
| Short name [ Mahuva Dehydro Foods     ]|
| Address  [ Plot 42, GIDC, Nesvad Road ]|
|          [ Mahuva ] [ 364290 ]         |
| GST number [ 24AAACM1234F1Z5          ]|
| Phone    [ +91 98250 12345            ]|
|----------------------------------------|
| Bank (for rupee payments)              |
| Bank     [ State Bank of India        ]|
| Account no [ 30491823749              ]|
| IFSC     [ SBIN0000421                ]|
|----------------------------------------|
| > More (export)                        |
|   IEC, PAN, FSSAI, Signatory,          |
|   USD bank: bank, account no, IFSC,    |
|   SWIFT                                |
|----------------------------------------|
| [               Save                 ] |
+----------------------------------------+
```

| Card | Field | Writes to |
|---|---|---|
| Company | Name *, Short name, Address, City, PIN, GST number, Phone | business_settings.company_name, trade_name, address, city, pincode, gstin, contact_phone (state = Gujarat, country = India kept as is) |
| Bank | Bank, Account no, IFSC | bank_details[0] (is_primary, currency INR): bank_name, account_no, ifsc (branch kept) |
| More (export) | IEC, PAN, FSSAI, Signatory, USD bank (bank, account no, IFSC, SWIFT) | iec_code, pan, fssai_no, authorized_signatory, bank_details[1] (currency USD) |

- Primary: sticky `Save` -> "Saved" green tick toast. Validation: "GST number has 15 letters and digits." / "IFSC has 11 letters and digits."
- Status chips: none.
- Desktop: cards side by side, Save bottom-right.

---

## 26. Access denied and Account inactive

Routes `/access-denied`, `/account-inactive`. No module.

```
+----------------------------------------+
|                                        |
|              (lock icon)               |
|           Not for you                  |
|  Ask the owner to open this for you.   |
|                                        |
| [             Go Home                ] |
+----------------------------------------+

+----------------------------------------+
|                                        |
|            (person-off icon)           |
|       Your login is switched off       |
|            Ask the owner.              |
|                                        |
| [            Go to Login             ] |
+----------------------------------------+
```

- Access denied: one line + `Go Home` -> `/`.
- Account inactive: one line + `Go to Login` -> signs out, `/login`.
- Desktop: same, centred.

---

## 27. Screen-by-screen empty / error text (collected)

| Screen | Empty | Error |
|---|---|---|
| Home | "Nothing to do today. Well done." / Plant: "No order to pack today." | "Could not load. Tap to try again." |
| Inquiries | "No inquiries yet. Tap + New Inquiry when a buyer asks for a price." | same |
| Inquiry detail | timeline "No notes yet. Tap + Add note." | "This inquiry was not found." + Go Home |
| New inquiry | - | "Could not save. Check internet and tap Save again." |
| Buyers | "No buyers yet. Tap + New Buyer." | same as Home |
| Buyer detail | per block "No inquiries / quotes / orders / notes yet." | "This buyer was not found." |
| Samples | "No samples yet. Send one from an inquiry or tap + Send Sample." | same |
| Quotes | "No quotes yet. Make one from an inquiry or tap + New Quote." | same |
| Quote detail | - | "Rate is below floor price. Only the owner can send this quote." |
| Orders | "No orders yet. An order is made when a buyer accepts a quote." | same |
| Order detail | Dispatch block "Not dispatched yet." | Plant on Start packing while advance waiting: "Wait for advance." |
| Checklist | truck order: redirect + "No export papers for truck dispatch." | - |
| Money | "No orders yet, so no money to collect." / Late: "Nobody is late. Good." | - |
| Money received | - | "Amount is more than due. Save anyway?" |
| Products | "No products yet. Ask the owner to add products." | - |
| Staff | - | "You cannot change yourself." |
| My Company | - | "Could not save. Check internet and tap Save again." |
| Print views | "Not dispatched yet. Dispatch first." (invoice / slip) | - |
