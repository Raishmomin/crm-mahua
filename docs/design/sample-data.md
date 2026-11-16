# Mahuva CRM - Sample data for the demo seed (Designer 1)

Rows the developers insert in `supabase/seed_02..04` so the demo in `demo-script.md` tells a story on day one. Everything references the existing seed (`supabase/seed.sql`) by code / name. Column names follow `docs/research/product-gap-analysis.md` section 5 + the amendments in `tasks/todo.md` (+ two columns on payments flagged in section 8). Status values are the DB values.

## 0. Conventions

| Item | Rule |
|---|---|
| `T` | `CURRENT_DATE` when the seed runs (demo day). `T-6` = `CURRENT_DATE - 6`. Written examples assume T = 12 Nov 2026. |
| Timestamps | `(CURRENT_DATE - n)::timestamp + time '10:30'`; use 10:30 unless a time is given. |
| FY | Doc numbers use FY `2627` (Apr 2026 - Mar 2027). If the seed runs after 31 Mar 2027 keep the literal numbers; they are just text. |
| org_id | `11111111-1111-4111-8111-111111111111` |
| Users (created_by / assigned_to) | owner `...2221` Hareshbhai, accountant `...2222` Nileshbhai, sales `...2223` Pooja, ops `...2224` Dineshbhai (full uuids in seed.sql) |
| Products | by `products.code`: W-FLK-A (white flakes), W-MIN-A (white minced), W-POW-P (white powder), R-FLK-C (red flakes), R-POW-S (red powder), P-CHP-E (pink chopped) |
| Packaging | `pkg1` = "25 kg Multi-wall Paper Bag with LDPE Poly Liner" (capacity 25, tare 0.45) |
| Buyers | BUY-0001 Everest Food Products Pvt Ltd (Mumbai, INR, EXW, 30 days credit, contact Rajesh Parekh +91 98200 45678); BUY-0002 Haldiram Snacks Private Limited (Noida, INR, EXW, 15 days, Manish Sharma +91 98110 98765); BUY-0003 Al-Barakah Spice & Grain LLC (Dubai, USD, FOB, 0 days, Tariq Al-Mansoor +971 4 223 9876); BUY-0004 Rhine Food Ingredients GmbH (Hamburg, EUR in seed -> quoted in USD, CIF, 0 days, Hans Weber +49 40 3298 1234) |
| USD rate | 84.25 (`app_settings.currency_rates.USD`) |
| Bags | 25 kg; 1 x 20 ft container = 12 MT = 480 bags |
| Idempotency | `ON CONFLICT (org_id, code)` / `(org_id, quote_no)` etc. `DO UPDATE` on status + dates so re-running resets the story. Use fixed uuids: inquiries `66666666-6666-4666-8666-6666666666NN`, samples `7777...NN`, quotations `8888...NN`, orders `9999...NN`, dispatches `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaNN`, payments `bbbb...NN`, follow_ups `cccc...NN` (NN = 01..). |

Derived numbers used below: cost per kg (owner / accounts only) = raw + processing + packaging: W-FLK-A ₹136.50, W-MIN-A ₹140.50, W-POW-P ₹147.00, R-FLK-C ₹106.00, R-POW-S ₹112.50, P-CHP-E ₹118.50.

## 1. Inquiries (10) - `inquiries`

| code | buyer_id | buyer_name | phone | product_id | qty_kg | needed_by | source | status | assigned_to | notes | lost_reason | created_by | created_at | closed_at |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| INQ-0001 | BUY-0001 | Everest Food Products Pvt Ltd | +91 98200 45678 | R-POW-S | 3000 | T-42 | call | won | owner | Rajeshbhai called; red powder for masala blend, 3 MT | - | owner | T-50 | T-46 |
| INQ-0002 | BUY-0003 | Al-Barakah Spice & Grain LLC | +971 4 223 9876 | W-FLK-A | 12000 | T-20 | whatsapp | won | sales | Repeat buyer; wants 1 x 20 ft white flakes before December | - | sales | T-40 | T-27 |
| INQ-0003 | BUY-0002 | Haldiram Snacks Private Limited | +91 98110 98765 | R-FLK-C | 4000 | T-5 | call | lost | owner | Manish asked ₹125/kg; our floor is ₹125, quoted ₹140 | price | owner | T-25 | T-18 |
| INQ-0004 | BUY-0002 | Haldiram Snacks Private Limited | +91 98110 98765 | W-MIN-A | 5000 | T+5 | email | won | owner | PO HSPL/26-27/1182 by email; 50% advance | - | owner | T-12 | T-10 |
| INQ-0005 | BUY-0004 | Rhine Food Ingredients GmbH | +49 40 3298 1234 | W-POW-P | 18000 | T+30 | email | quoted | sales | Hans wants 1 x 20 ft powder, LC at sight, CIF Hamburg | - | sales | T-10 | - |
| INQ-0006 | BUY-0003 | Al-Barakah Spice & Grain LLC | +971 4 223 9876 | P-CHP-E | 12000 | T+33 | whatsapp | sample_sent | sales | Wants pink chopped for Ramadan packs | - | sales | T-9 | - |
| INQ-0007 | BUY-0001 | Everest Food Products Pvt Ltd | +91 98200 45679 | W-FLK-A | 2000 | T+20 | visit | talking | sales | Sunita (QA) visited; needs flakes sample for a new soup mix | - | sales | T-3 | - |
| INQ-0008 | BUY-0001 | Everest Food Products Pvt Ltd | +91 98200 45678 | R-FLK-C | 1500 | T+12 | whatsapp | talking | owner | Trial lot of red flakes; draft quote made | - | owner | T-2 | - |
| INQ-0009 | NULL | Shree Ambica Masala, Rajkot | +91 98980 11223 | R-POW-S | 500 | T+10 | call | new | owner | Small masala maker; wants 20 bags red powder | - | owner | T-1 | - |
| INQ-0010 | NULL | Gulf Star Foodstuff Trading, Sharjah | +971 55 234 8899 | W-FLK-A | 6000 | T+45 | indiamart | new | sales | IndiaMART lead: 6 MT white flakes, asked FOB rate | - | sales | T (09:40) | - |

`product_text` NULL for all (product_id always set). Status spread: new 2, talking 2, sample_sent 1, quoted 1, won 3, lost 1.

## 2. Samples (3) - `samples`

| code | inquiry | buyer_id | product_id | qty_grams | sent_on | courier | tracking_no | status | result_note | created_by | created_at |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SMP-0001 | INQ-0002 | BUY-0003 | W-FLK-A | 500 | T-38 | DHL | DHL 7788 2211 05 | approved | Colour and moisture OK - Tariq on WhatsApp (T-31) | sales | T-39 |
| SMP-0002 | INQ-0006 | BUY-0003 | P-CHP-E | 500 | T-7 | DHL | DHL 7788 2290 41 | sent | NULL | sales | T-8 |
| SMP-0003 | INQ-0007 | BUY-0001 | W-FLK-A | 250 | NULL | NULL | NULL | to_send | For soup mix trial - Sunita Deshmukh | sales | T-2 |

## 3. Quotes (4) - `quotations` and `quotation_items`

| quote_no | inquiry | buyer_id | currency | incoterm | valid_till | payment_terms | subtotal | gst_amount | total | status | notes | created_by | sent_at | decided_at | created_at |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| QTN-2627-0001 | INQ-0002 | BUY-0003 | USD | FOB Pipavav | T-20 | 30% advance, 70% against BL copy | 27000.00 | 0.00 | 27000.00 | accepted | NULL | sales | T-30 | T-27 | T-30 |
| QTN-2627-0002 | INQ-0003 | BUY-0002 | INR | EXW | T-15 | 50% advance, 50% before dispatch | 560000.00 | 28000.00 | 588000.00 | rejected | Lost - Price | owner | T-22 | T-18 | T-22 |
| QTN-2627-0003 | INQ-0005 | BUY-0004 | USD | CIF | T+1 | LC at sight | 49500.00 | 0.00 | 49500.00 | sent | CIF Hamburg; 1 x 20 ft | sales | T-9 | NULL | T-9 |
| QTN-2627-0004 | INQ-0008 | BUY-0001 | INR | EXW | T+14 | 30 days credit | 210000.00 | 10500.00 | 220500.00 | draft | NULL | owner | NULL | NULL | T-1 |

Items (one per quote; `sort_order` 1):

| quotation | product_id | packaging_type_id | qty_kg | unit | rate | amount | floor_price_at_time | gst_rate |
|---|---|---|---|---|---|---|---|---|
| QTN-2627-0001 | W-FLK-A | pkg1 | 12000 | MT | 2250.00 | 27000.00 | 2050.00 | 0 |
| QTN-2627-0002 | R-FLK-C | pkg1 | 4000 | kg | 140.00 | 560000.00 | 125.00 | 5 |
| QTN-2627-0003 | W-POW-P | pkg1 | 18000 | MT | 2750.00 | 49500.00 | 2400.00 | 0 |
| QTN-2627-0004 | R-FLK-C | pkg1 | 1500 | kg | 140.00 | 210000.00 | 125.00 | 5 |

Insert items with the totals trigger enabled, or insert quotations with the totals above and items after (trigger recomputes the same numbers). Rate 2,750 CIF is above the FOB list rate 2,600 on purpose (freight).

## 4. Orders (3) - `orders` and `order_items`

| order_code | pi_no | quotation | buyer_id | currency | incoterm | payment_terms | total | advance_expected | expected_dispatch | status | packed_bags | notes | created_by | created_at |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ORD-0001 | PI-2627-0001 | NULL | BUY-0001 | INR | EXW | 30 days credit | 504000.00 | 0.00 | T-40 | delivered | 120 | Order on phone from Rajeshbhai; rate per price list | owner | T-46 |
| ORD-0002 | PI-2627-0002 | QTN-2627-0001 | BUY-0003 | USD | FOB Pipavav | 30% advance, 70% against BL copy | 27000.00 | 8100.00 | T-5 | dispatched | 480 | 1 x 20 ft via Pipavav; CHA Seabridge | sales | T-27 |
| ORD-0003 | PI-2627-0003 | NULL | BUY-0002 | INR | EXW | 50% advance, 50% before dispatch | 1023750.00 | 511875.00 | T+5 | in_production | NULL | PO HSPL/26-27/1182; truck to Noida | owner | T-10 |

`total` for INR orders includes GST 5% (item amount x 1.05). ORD-0001 and ORD-0003 have no quote (taken on the phone / by PO) - allowed because `quotation_id` is nullable; the UI only creates orders from quotes.

Items:

| order | product_id | packaging_type_id | qty_kg | unit | rate | amount | dispatched_kg |
|---|---|---|---|---|---|---|---|
| ORD-0001 | R-POW-S | pkg1 | 3000 | kg | 160.00 | 480000.00 | 3000 |
| ORD-0002 | W-FLK-A | pkg1 | 12000 | MT | 2250.00 | 27000.00 | 12000 |
| ORD-0003 | W-MIN-A | pkg1 | 5000 | kg | 195.00 | 975000.00 | 0 |

Status history for the stepper (write to `audit_log` if the stepper reads it; otherwise skip): ORD-0001 confirmed T-46, in_production T-45, ready T-41, dispatched T-40, delivered T-38. ORD-0002 confirmed T-27, in_production T-22, ready T-9, dispatched T-6. ORD-0003 confirmed T-10, in_production T-2.

## 5. Dispatches (2) - `dispatches`

| id | order | sdn_no | invoice_no | dispatched_on | mode | vehicle_no | lr_no | transporter | bags_count | qty_kg | invoice_total | delivered_on | status | container_no | port | vessel | stuffing_date | eta | bl_no | created_by | created_at |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aaaa...01 | ORD-0001 | SDN-2627-0001 | INV-2627-0001 | T-40 | truck | GJ-04-AX-7712 | MTC/4471 | Mahuva Transport Co. | 120 | 3000 | 504000.00 | T-38 | delivered | NULL | NULL | NULL | NULL | NULL | NULL | accountant | T-40 |
| aaaa...02 | ORD-0002 | SDN-2627-0002 | INV-2627-0002 | T-6 | container | NULL | PPV/CHA/2231 | Seabridge Logistics (CHA) | 480 | 12000 | 27000.00 | NULL | dispatched | MSKU 482913-7 | Pipavav | MSC Positano 2646W | T-6 | T+12 | MEDUPV2246118 | accountant | T-6 |

`export_checklist` for the container dispatch (truck dispatch: `'{}'` or NULL):

```json
{
  "container_booked":     {"done": true,  "date": "T-10"},
  "stuffing_done":        {"done": true,  "date": "T-6"},
  "coa":                  {"done": true,  "date": "T-7"},
  "phyto":                {"done": true,  "date": "T-4"},
  "coo":                  {"done": false, "date": null},
  "fumigation":           {"done": true,  "date": "T-6"},
  "invoice_packing_list": {"done": true,  "date": "T-6"},
  "bl_received":          {"done": true,  "date": "T-2"}
}
```
(Replace `"T-n"` with real ISO dates at seed time.) 7 of 8 done; the demo ticks `coo` live.

## 6. Payments (4) - `payments`

| receipt_no | order | buyer_id | amount | currency | amount_inr | fx_rate | received_on | mode | reference | note | created_by | created_at |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REC-2627-0001 | ORD-0002 | BUY-0003 | 8100.00 | USD | 682425.00 | 84.2500 | T-25 | bank | TT ref 7781AB, HDFC USD a/c | 30% advance | accountant | T-25 |
| REC-2627-0002 | ORD-0001 | BUY-0001 | 200000.00 | INR | NULL | NULL | T-15 | bank | NEFT N3121 SBI | Part payment | accountant | T-15 |
| REC-2627-0003 | ORD-0003 | BUY-0002 | 511875.00 | INR | NULL | NULL | T-9 | bank | RTGS HDFC R88213 | 50% advance | accountant | T-9 |
| REC-2627-0004 | ORD-0001 | BUY-0001 | 304000.00 | INR | NULL | NULL | T-3 | upi | UPI 4419@sbi | Balance; 7 days after due date | accountant | T-3 |

Resulting money state (`v_order_balances`):

| order | buyer | total | received | due | due_date | pill | advance |
|---|---|---|---|---|---|---|---|
| ORD-0001 | Everest | ₹5,04,000 | ₹5,04,000 | ₹0 | T-10 (T-40 + 30) | Paid (green) | n/a |
| ORD-0002 | Al-Barakah | $27,000 | $8,100 | $18,900 | T-6 (T-6 + 0) | Late (red), 6 days | Advance OK |
| ORD-0003 | Haldiram | ₹10,23,750 | ₹5,11,875 | ₹5,11,875 | NULL (not dispatched) | Waiting (amber) | Advance OK |

Money due tile: ₹5,11,875 + $18,900 = about ₹21,04,200 (18,900 x 84.25 = 15,92,325), colour red.

## 7. Follow-ups (8) - `follow_ups` (done = false)

| id | entity_type | entity | note | due_on | bucket | created_by | created_at |
|---|---|---|---|---|---|---|---|
| cccc...01 | order | ORD-0002 | Balance $18,900 due | T-6 | overdue (6 days late) - auto at dispatch | accountant | T-6 |
| cccc...02 | inquiry | INQ-0007 | Send flakes sample (250 g) for soup mix - Sunita | T-2 | overdue (2 days late) | sales | T-3 |
| cccc...03 | inquiry | INQ-0006 | Sample SMP-0002 sent, ask Tariq for result | T | today - auto at sample sent | sales | T-7 |
| cccc...04 | quote | QTN-2627-0003 | Quote QTN-2627-0003 expires tomorrow - call Hans | T | today - auto at quote sent | sales | T-9 |
| cccc...05 | buyer | BUY-0002 | Re-quote red flakes - crop price down, Manish asked | T | today | owner | T-4 |
| cccc...06 | inquiry | INQ-0010 | Send FOB rate and sample offer to Gulf Star | T+1 | later | sales | T |
| cccc...07 | order | ORD-0003 | Truck for 17 Nov - confirm with Mahuva Transport | T+4 | later | owner | T-2 |
| cccc...08 | buyer | BUY-0001 | Share season rate list for red powder | T+7 | later | owner | T-1 |

"To do today" after seed = rows 01-05 (2 late, 3 today) in this order: 01 (6 days late), 02 (2 days late), 04, 03, 05. Same-day rows sort by created_at (contracts.md 5.2), so 04 (T-9) comes before 03 (T-7).

Notes for the timelines (same table, `due_on` NULL, `done` = true, `done_at` = created_at) - optional but makes detail pages look lived-in:

| id | entity_type | entity | note | created_by | created_at |
|---|---|---|---|---|---|
| cccc...11 | inquiry | INQ-0002 | Repeat buyer; wants 1 x 20 ft before December | sales | T-40 |
| cccc...12 | inquiry | INQ-0006 | Wants pink chopped for Ramadan packs, 12 MT | sales | T-9 |
| cccc...13 | inquiry | INQ-0006 | Sample 500 g sent by DHL | sales | T-7 |
| cccc...14 | buyer | BUY-0003 | Tariq prefers WhatsApp after 2 pm IST | sales | T-30 |
| cccc...15 | order | ORD-0002 | Container booked with Seabridge CHA, Pipavav | accountant | T-10 |
| cccc...16 | inquiry | INQ-0003 | Manish wants ₹125; cannot go below floor | owner | T-18 |

## 8. Columns this data needs beyond the plan (for `contracts.md`)

| Table | Column | Why |
|---|---|---|
| payments | `amount_inr numeric(14,2)` NULL, `fx_rate numeric(10,4)` NULL | USD receipts store the rupee value and rate entered by the munim (screen 22). Without them the FX on each receipt is lost - the research lists this as a pain. `fn_payment_record` gets two optional parameters. |
| dispatches | `status text` (dispatched / delivered) | listed in the gap analysis status column but not in the column list; the seed sets it. |
| dispatches | `mode`, `container_no`, `port`, `vessel`, `stuffing_date date`, `eta date`, `bl_no`, `export_checklist jsonb` | from tasks/todo.md amendment 4 (stuffing_date added here so the checklist date and dispatch date can differ). |
| orders | `packed_bags integer` | tasks/todo.md amendment 4. |

## 9. Counters after seed

| Table | Key | Value |
|---|---|---|
| entity_code_counters | INQ | 10 |
| entity_code_counters | SMP | 3 |
| entity_code_counters | BUY | 4 |
| entity_code_counters | ORD | 3 |
| doc_counters (fy 2627) | QTN | 4 |
| doc_counters (fy 2627) | PI | 3 |
| doc_counters (fy 2627) | INV | 2 |
| doc_counters (fy 2627) | SDN | 2 |
| doc_counters (fy 2627) | REC | 4 |

Live demo then produces INQ-0011, SMP-0004, QTN-2627-0005, ORD-0004, PI-2627-0004, REC-2627-0005.

## 10. Acceptance check after seeding (what QA should see)

| Screen | Expected |
|---|---|
| Home (owner) | New inquiries 2 · Quotes waiting 1 · Orders in production 1 · Money due ₹5,11,875 + $18,900 (about ₹21,04,200) red · To do today 5 |
| Inquiries, chip New | INQ-0010 Gulf Star (today), INQ-0009 Shree Ambica (1 day) |
| Inquiry INQ-0006 | [Sample sent]; sample line SMP-0002 [Sent] T-7 DHL; follow-up today; primary `Make quote` |
| Samples | SMP-0003 [To send] with `Mark sent`; SMP-0002 [Sent] with `Approved` / `Rejected`; SMP-0001 [Approved] |
| Quotes | QTN-0003 [Sent] $49,500 valid till T+1 (1 day left); QTN-0004 [Draft] ₹2,20,500; QTN-0001 [Accepted] -> ORD-0002; QTN-0002 [Rejected] Lost - Price |
| Orders, chip Open | ORD-0003 Haldiram [In production], 200 bags, ship by T+5 |
| Order ORD-0002 | [Dispatched]; Money Late $18,900, Advance OK; Dispatch container MSKU 482913-7, Pipavav, ETA T+12, BL MEDUPV2246118; Export papers 7 of 8 |
| Order ORD-0001 | [Delivered]; Money Paid; Dispatch truck GJ-04-AX-7712, LR MTC/4471; INV-2627-0001 |
| Order ORD-0003 (as Plant) | packing card Haldiram, White Onion Minced 1-3 mm, 200 bags x 25 kg; `Packing started` ticked T-2; `Packed` green |
| Money | Al-Barakah [Late] $18,900 6 days; Haldiram [Waiting] ₹5,11,875; Everest [Paid] |
| Buyers | Al-Barakah $18,900 [Late]; Haldiram ₹5,11,875 [Waiting]; Everest ₹0 [Paid]; Rhine ₹0 [Paid] |
| Products (owner) | 6 rows; cost column with lock; as Sales: no cost column |
