# Mahuva CRM - Flows and status transitions (Designer 1)

Screens referenced by number are in `screens.md`. Table / column / function names follow `docs/research/product-gap-analysis.md` section 5 plus the amendments in `tasks/todo.md`; exact signatures are fixed by Designer 2 in `contracts.md`. Where this file needs something the contract does not have yet, it says so in **bold**.

## 1. The one flow

```
 Buyer asks (WhatsApp / call / IndiaMART)
        |
        v
 [Inquiry] INQ-0001 ..... New -> Talking
        |                      |
        |  Send sample         |  Make quote
        v                      v
 [Sample] SMP-0001         [Quote] QTN-2627-0001
  To send -> Sent -------> inquiry = Sample sent
  Sent -> Approved/Rejected        |
        \______ Make quote ________|  Share on WhatsApp -> Sent -> inquiry = Quoted
                                   |
                        Buyer accepted  (fn_quote_accept)
                                   v
 [Order] ORD-0001 + PI-2627-0001 ..... Confirmed ; inquiry = Won
        |  Money received (advance)  -> Advance OK
        |  Start packing / Packing started -> In production
        |  Packed (bags)                   -> Ready
        |  Dispatch / Loaded (fn_order_dispatch)
        v
 [Dispatch] INV-2627-0001 + SDN-2627-0001 ..... order = Dispatched
        |  truck: vehicle, LR   | container: container no, port, vessel, ETA
        |                       | export checklist 8 ticks, BL no
        |  Delivered            -> order = Delivered
        v
 [Money] due = total - received ..... Late / Waiting / Paid
        |  Money received (fn_payment_record) -> REC-2627-0001
        v
 Home: 4 numbers + To do today (follow_ups)
```

Every arrow is one button on one screen. No status changes by editing a dropdown.

## 2. Inquiry (`inquiries.status`)

```
 new --(Reply on WhatsApp / first note)--> talking
 new | talking --(sample marked sent)--> sample_sent
 new | talking | sample_sent --(quote sent)--> quoted
 quoted --(quote accepted)--> won
 new | talking | sample_sent | quoted --(Mark lost + reason)--> lost
 lost --(Reopen, owner)--> talking
```

| From | To | Button (screen) | Who (module / role) | Function | What else changes |
|---|---|---|---|---|---|
| - | new | `Save` (5 New inquiry) | leads: Owner, Sales | insert, `fn_next_code('INQ')` | assigned_to = creator; Home "New inquiries" +1 |
| new | talking | `Reply on WhatsApp` returns, or first `Add note` (4) | leads | `fn_inquiry_set_status(id,'talking',null)` | Home "New inquiries" -1 |
| new / talking | sample_sent | `Save & mark sent` (10) or `Mark sent` on the sample row (9) | samples: Owner, Sales, Plant | inside `fn_sample_set_status(sample,'sent')` | sample.sent_on = today; follow-up "Ask for sample result" due today + 7 |
| new / talking / sample_sent | quoted | `Share on WhatsApp` -> "Yes, mark sent", or `Mark sent` (12) | quotes: Owner, Accounts, Sales | inside `fn_quote_send(quote)` | quote.sent_at; follow-up "Quote expires tomorrow" due valid_till - 1 |
| quoted | won | `Buyer accepted` -> `Looks right` (12) | quotes | inside `fn_quote_accept(quote)` | order + PI created; closed_at = now |
| any open | lost | `Mark lost` + reason chip (4) | leads | `fn_inquiry_set_status(id,'lost',reason)` | lost_reason in (price, quality, timing, no_reply); closed_at = now; pending follow-ups on this inquiry marked done |
| lost | talking | `Reopen` (4) | leads, role owner only | `fn_inquiry_set_status(id,'talking',null)` | closed_at = null |

A sample or quote can be made from an inquiry in any open status (new, talking, sample_sent, quoted). A quote made on a sample_sent inquiry does not need the sample to be approved.

## 3. Sample (`samples.status`)

```
 to_send --(Mark sent)--> sent --(Approved)--> approved
                           sent --(Rejected)--> rejected
```

| From | To | Button (screen) | Who | Function | What else changes |
|---|---|---|---|---|---|
| - | to_send | `Save` (10) with no courier | samples: Owner, Sales, Plant | insert, `fn_next_code('SMP')` | shows on inquiry detail "Sample SMP-0004 [To send]" |
| - | sent | `Save & mark sent` (10) with courier | samples | insert then `fn_sample_set_status(id,'sent',null)` | as below |
| to_send | sent | `Mark sent` row button (9): courier chips + tracking no | samples | `fn_sample_set_status(id,'sent',null)` | sent_on = today; linked inquiry -> sample_sent (if open); follow-up on the inquiry "Sample SMP-xxxx sent, ask for result" due today + 7, created_by = caller |
| sent | approved | `Approved` row button (9), optional note | samples | `fn_sample_set_status(id,'approved',note)` | result_note; the sample follow-up (if still pending) marked done; inquiry detail primary becomes `Make quote` |
| sent | rejected | `Rejected` row button (9), optional note | samples | `fn_sample_set_status(id,'rejected',note)` | result_note; follow-up marked done; inquiry stays sample_sent (user decides: another sample, quote, or Mark lost) |

## 4. Quote (`quotations.status`)

```
 draft --(Share on WhatsApp -> yes / Mark sent)--> sent
 sent --(Buyer accepted)--> accepted
 sent --(Buyer rejected + reason)--> rejected
 sent --(valid_till passes)--> expired   (display rule, see below)
 draft --(Edit)--> draft
```

| From | To | Button (screen) | Who | Function | What else changes |
|---|---|---|---|---|---|
| - | draft | `Save quote` (13) | quotes: Owner, Accounts, Sales | insert, `fn_next_doc_no('QTN')`; trigger `fn_quote_check_floor` blocks rate < floor_price_at_time unless role owner; `trg_quotation_items_totals` fills subtotal / gst / total | - |
| draft | draft | `Edit` (13 in edit mode) | quotes | update items (same triggers) | - |
| draft | sent | `Share on WhatsApp` then "Yes, mark sent", or `Mark sent` (12) | quotes; floor guard applies again (non-owner cannot send a below-floor quote) | `fn_quote_send(id)` | sent_at = now; inquiry -> quoted; follow-up on the quote "Quote QTN-xxxx expires tomorrow - call buyer" due valid_till - 1; Home "Quotes waiting" +1 |
| sent | accepted | `Buyer accepted` -> confirmation sheet -> `Looks right` (12) | quotes | `fn_quote_accept(id)` returns order id (**needs `p_expected_dispatch date` from the Ship by field**) | creates `orders` row: order_code `fn_next_code('ORD')`, pi_no `fn_next_doc_no('PI')`, quotation_id, buyer_id, currency, incoterm, payment_terms, total, advance_expected = total x advance % (30 / 50 / 100 from the payment-terms chip; 0 for credit and LC), expected_dispatch, status confirmed; copies items to `order_items`; quote decided_at = now; inquiry -> won; quote follow-up marked done; if advance_expected > 0 follow-up on the order "Advance $8,568 due - check bank" due today + 3; Home "Quotes waiting" -1, "Orders in production" +1, "Money due" + total |
| sent | rejected | `Buyer rejected` + reason chip (12) | quotes | `fn_quote_reject(id, reason)` | decided_at; notes gets "Lost - <reason>"; quote follow-up marked done; inquiry stays quoted (user may Mark lost on the inquiry, or make a new quote) |
| sent | expired | nobody taps | - | display rule: list and detail show `Expired` when status = sent AND valid_till < today; `fn_quote_expire_stale()` (**new, optional**) may be called by the quotes page to persist status = expired for such rows | Home "Quotes waiting" counts only sent AND valid_till >= today, so expired quotes drop out without a job |
| rejected / expired | (new draft) | `Make new quote` (12) -> screen 13 `?from=` | quotes | insert a new draft copying buyer, items, terms | old quote untouched |

An expired or rejected quote cannot be accepted. If the buyer says yes late, make a new quote (one tap) and accept that.

## 5. Order (`orders.status`)

```
 confirmed --(Start packing / Packing started)--> in_production
 in_production --(Packed + bag count)--> ready
 ready --(Dispatch / Loaded -> Save & make papers)--> dispatched
 dispatched --(Delivered)--> delivered
 confirmed | in_production | ready --(Cancel order, owner)--> cancelled
```

| From | To | Button (screen) | Who | Function | What else changes |
|---|---|---|---|---|---|
| - | confirmed | `Looks right` on quote (12) | quotes | `fn_quote_accept` | see section 4 |
| confirmed | in_production | `Start packing` (16A) / `Packing started` (16B) | orders: everyone | `fn_order_set_status(id,'in_production')` | Advance guard: if advance_expected > received, Plant's button is disabled ("Wait for advance"); Owner / Accounts / Sales get a confirm sheet and may start anyway |
| in_production | ready | `Packed` -> "How many bags?" (16A / 16B) | orders: everyone | `fn_order_set_status(id,'ready')` (**needs `p_packed_bags int` or a separate `fn_order_set_packed(id, bags)`**) | orders.packed_bags = n; packing card shows "Packed n bags (v)" |
| ready | dispatched | `Dispatch` (16A) / `Loaded` (16B) -> screen 17 -> `Looks right` | orders: everyone (Plant short form) | `fn_order_dispatch(...)` returns dispatch id (**must accept mode, container_no, port, vessel, stuffing_date, eta in addition to qty, vehicle, lr, transporter, bags**) | dispatch row with sdn_no `fn_next_doc_no('SDN')`, invoice_no `fn_next_doc_no('INV')`, invoice_total; order_items.dispatched_kg += qty; container mode: export_checklist seeded with all 8 keys, stuffing_done and invoice_packing_list done on the dispatch date; follow-up on the order "Balance due" due = dispatched_on + buyer.credit_period_days (only if due > 0); Home "Orders in production" -1 |
| dispatched | delivered | `Delivered` (16A) | orders: Owner, Accounts, Sales | `fn_dispatch_delivered(dispatch id)` | dispatches.delivered_on = today, status delivered; order delivered when dispatched_kg >= qty for all items |
| open (before dispatched) | cancelled | `More > Cancel order` (16A) | orders, role owner | `fn_order_set_status(id,'cancelled')` | pending follow-ups on the order marked done; order drops out of Money list and Home counts |

Forward only. There is no "back one step" button in the demo; the owner fixes mistakes by cancelling and re-accepting the quote (quote stays accepted; the owner makes a new quote if needed).

Planned bags = ceil(qty_kg / packaging capacity_kg) with 25 kg default. Packed bags typed by the supervisor may differ; dispatch defaults to packed_bags.

## 6. Dispatch (`dispatches.status`) and export checklist

```
 (order ready) --(Save & make papers)--> dispatched --(Delivered)--> delivered
```

Mode decides the fields and the papers:

| | Truck (`mode = 'truck'`) | Container (`mode = 'container'`) |
|---|---|---|
| Required | vehicle_no, bags_count, qty_kg, dispatched_on | container_no, port (Pipavav / Mundra), bags_count, qty_kg, dispatched_on |
| Optional now | lr_no, transporter | vessel, stuffing_date (default = dispatched_on), eta, transporter, lr_no |
| Later | delivered_on | bl_no (through checklist tick), delivered_on |
| Papers | Tax invoice INV + dispatch slip SDN | Commercial invoice + packing list INV + dispatch slip SDN |
| Checklist | none | `export_checklist` jsonb, 8 keys |

Checklist transitions (screen 18), each tick = `UPDATE dispatches SET export_checklist = jsonb_set(...)` through **`fn_dispatch_tick(dispatch id, key text, done boolean, on date, bl_no text)`** (module orders; Plant allowed only for keys stuffing_done and coa):

| Key | Who normally ticks | Side effect |
|---|---|---|
| container_booked | Accounts | - |
| stuffing_done | auto on dispatch; Plant may tick earlier | - |
| coa | Plant / Sales | - |
| phyto | Accounts | - |
| coo | Accounts | - |
| fumigation | Accounts | - |
| invoice_packing_list | auto on dispatch | - |
| bl_received | Accounts | requires BL no -> dispatches.bl_no; follow-up on the order "BL received - send copy and ask for balance" due today |

Progress text "n of 8 done" on the order and in the checklist header. No photo upload in the demo (ticks + dates only).

## 7. Money (`payments`, views `v_order_balances`, `v_money_due`)

Payments have one status (`received`); the money state is computed per order:

```
 per order (not cancelled):
   total      = orders.total
   received   = sum(payments.amount) for the order (same currency as the order)
   due        = total - received  (never below 0 for display)
   due_date   = if no dispatch: NULL
                else latest dispatches.dispatched_on + buyers.credit_period_days
   pill       = due = 0                         -> Paid   (green)
                due > 0 and due_date < today    -> Late   (red, "n days late")
                due > 0 otherwise               -> Waiting (amber; "due 05 Dec" or "after dispatch" when due_date is NULL)
   advance    = received >= advance_expected    -> Advance OK (green) else Advance waiting (amber)
```

| Trigger | Button (screen) | Who | Function | What else changes |
|---|---|---|---|---|
| Money comes | `Save` (22) | payments: Owner, Accounts | `fn_payment_record(order, amount, received_on, mode, reference, **amount_inr, fx_rate, note**)` returns payment id with receipt_no `fn_next_doc_no('REC')` | due recomputed by the view; order money block and Advance badge change; Home "Money due" tile drops by the amount; pending "Advance due" / "Balance due" follow-up on the order marked done when due becomes 0 (advance follow-up done when received >= advance_expected) |
| Buyer is late | `WhatsApp Remind` (21, 7, 16) | payments / buyers | none (wa.me link, template T6) | nothing stored; optional `Add follow-up` afterwards |

Rules in words:
- Advance is expected from the day the order is made. The order shows `Advance waiting` until received >= advance_expected. This is a badge, not a Late pill: nothing is "late" before dispatch.
- After dispatch the whole balance is due on dispatched_on + credit days. Export buyers have 0 credit days, so the balance is Late from the day after dispatch; the presenter reads it as "BL copy sent, money not yet come". Domestic buyers get their credit days (Everest 30, Haldiram 15).
- USD orders: payments are entered in USD with the rupee value and rate stored (`amount_inr`, `fx_rate`). Due stays in USD. Home converts USD due to rupees with `app_settings.currency_rates.USD` for the "about ₹" line only.
- Over-payment is allowed with a confirm; due shows ₹0 / Paid.
- Deleting a payment is not in the demo (Tally stays the book of account; a wrong entry is corrected by the owner in SQL).

## 8. Follow-ups (`follow_ups`) and "To do today"

One table serves notes and reminders.

| Rule | Row written |
|---|---|
| `Add note` without a date (4, 7, 12, 16) | entity_type / entity_id of the page, note, due_on NULL, done = true, done_at = now -> shows as a grey note in the timeline |
| `Add note` with "Remind me on" / `Add follow-up` | same, due_on = date, done = false -> appears in To do today on that date |
| Inquiry saved | none (the New tile is the reminder) |
| Sample marked sent | inquiry follow-up "Sample SMP-xxxx sent, ask for result", due today + 7 |
| Quote sent | quote follow-up "Quote QTN-xxxx expires tomorrow - call <contact>", due valid_till - 1 (if valid_till - 1 < today then due today) |
| Quote accepted with advance > 0 | order follow-up "Advance <amount> due - check bank", due today + 3 |
| Dispatch saved with due > 0 | order follow-up "Balance <amount> due", due = due_date (dispatched_on + credit days) |
| BL received ticked | order follow-up "BL received - send copy and ask for balance", due today |
| Payment makes due = 0 / advance OK | matching pending order follow-ups marked done |
| Inquiry lost, order cancelled | pending follow-ups on that entity marked done |
| `Done` tick (2, 4, 7, 12, 16) | `fn_follow_up_done(id)`: done = true, done_at = now |

"To do today" (`v_followups_today`) = follow_ups where done = false AND due_on <= today, joined to the buyer name and primary phone through the entity (inquiry -> buyer or inquiry.buyer_name / phone; buyer; quote -> buyer; order -> buyer). Sorted: most overdue first, then today, then by buyer. Chip: `n days late` (red) when due_on < today, `Today` (amber) when due_on = today. Home shows 5, `See all` shows all. Rows are filtered by the module of the entity (inquiry -> leads, buyer -> buyers, quote -> quotes, order -> orders). Overdue money is not duplicated as a follow-up every day; the red Money tile and the "Balance due" follow-up created at dispatch cover it.

## 9. Home numbers in words (`v_home_kpis`, one row per org)

| Tile | Count / sum | Colour |
|---|---|---|
| New inquiries | number of inquiries whose status is New (nobody has replied yet) | blue; grey at 0 |
| Quotes waiting | number of quotes that were sent and are still valid today (status sent, valid_till >= today) | amber; grey at 0 |
| Orders in production | number of orders that are confirmed, in production or ready, i.e. not yet dispatched and not cancelled | blue; grey at 0 |
| Money due | for every order not cancelled: total minus received, summed per currency; shown as "₹x + $y" with "about ₹" total at the settings USD rate; `money_overdue` = the same sum over orders whose due_date is past | red if money_overdue > 0; amber if money_due > 0; green `Paid` at 0 |

Each tile is a link: `/inquiries?status=new`, `/quotes?status=sent`, `/orders?status=open`, `/payments?filter=due`.

## 10. WhatsApp message templates (English; Gujarati in `labels.md`)

All open `https://wa.me/<digits>?text=<urlencoded>`. Digits = primary contact phone without spaces, `+` or dashes. Sender name = current user's first name; company short name = `business_settings.trade_name`.

| Id | Where | Text |
|---|---|---|
| T1 | Inquiry `Reply on WhatsApp` (4) | "Namaste {contact}, thank you for your inquiry for {product}, {qty}. We will send the rate and sample details today. - {user}, {company}" |
| T2 | Quote `Share on WhatsApp` (12) | "Namaste {contact}, our quotation {quote_no} for {product} {qty} at {rate} {price basis}, {payment terms}, valid till {valid_till}. Total {total}. PDF attached. - {user}, {company}" (the PDF is attached by the user from the phone share sheet after Print > Save as PDF) |
| T3 | Sample `Mark sent` success (9 / 10) | "Namaste {contact}, sample {sample_no} of {product} ({grams}) sent by {courier}, tracking {tracking}. Please share your feedback. - {user}, {company}" |
| T4 | Order made (12 -> 16) `Share on WhatsApp` | "Namaste {contact}, order {order_code} confirmed for {product} {qty}. Proforma invoice {pi_no} total {total}, advance {advance} due. Bank details in the PI. - {user}, {company}" |
| T5 | Order `Papers > Share on WhatsApp` (16) after dispatch | "Namaste {contact}, your order {order_code} is dispatched on {date}. Invoice {invoice_no}, {bags} bags, {qty}. {Truck: vehicle {vehicle}, LR {lr} / Container {container_no}, vessel {vessel}, ETA {eta}}. - {user}, {company}" |
| T6 | `WhatsApp Remind` (21, 7, 16) | "Namaste {contact}, a gentle reminder: {due} is pending for order {order_code} (invoice {invoice_no}, due {due_date}). Please arrange payment. Thank you. - {user}, {company}" |
| T7 | Checklist `Share status on WhatsApp` (18) | "Order {order_code}, container {container_no}: done - {done list}; pending - {pending list}. ETA {eta}. - {user}, {company}" |
| T8 | Receipt `Share receipt on WhatsApp` (22 success) | "Namaste {contact}, received {amount} on {date} for order {order_code}. Receipt {receipt_no}. Balance now {due}. Thank you. - {user}, {company}" |

## 11. Who may press what (module -> roles from the seed)

| Action | Module | Owner | Accounts | Sales | Plant |
|---|---|---|---|---|---|
| New inquiry, note, mark lost | leads | yes | - | yes | - |
| Reopen lost inquiry | leads + role owner | yes | - | - | - |
| New / edit buyer | buyers | yes | yes | yes | - |
| Send sample, mark sent / approved / rejected | samples | yes | - | yes | yes |
| New quote, share, mark sent, reject | quotes | yes | yes | yes | - |
| Save / send quote below floor price | quotes + role owner | yes | - | - | - |
| Buyer accepted -> order + PI | quotes | yes | yes | yes | - |
| Start packing, Packed, Dispatch / Loaded, Delivered | orders | yes | yes | yes | yes (not Delivered; not Start packing while advance waiting) |
| Export checklist ticks | orders | yes | yes | yes | stuffing_done, coa only |
| Cancel order | orders + role owner | yes | - | - | - |
| Money received, Money list | payments | yes | yes | - | - |
| See cost per kg | catalog + role owner / accountant | yes | yes | - | - |
| Staff job / login on-off | users | yes | - | - | - |
| My Company | settings | yes | yes | - | - |

## 12. Side-effect map (what a developer must not forget)

| When | Also do |
|---|---|
| Sample -> sent | inquiry -> sample_sent; follow-up +7 days |
| Quote -> sent | inquiry -> quoted; follow-up valid_till - 1 |
| Quote -> accepted | order + PI; items copied; inquiry -> won; quote follow-up done; advance follow-up +3 days (if advance) |
| Order -> ready | packed_bags stored |
| Order -> dispatched | dispatch row with INV + SDN; dispatched_kg; checklist seeded (container); balance follow-up on due date |
| Checklist bl_received | bl_no stored; follow-up today |
| Payment saved | REC number; due recomputed; advance / balance follow-ups done when satisfied |
| Inquiry -> lost, order -> cancelled | pending follow-ups done |
| Any of the above | Home tiles change on next load (no realtime needed for the demo) |
