# Mahuva CRM - 5-minute demo script (Designer 1)

Setting: today = demo day (`T`, written below as 12 Nov 2026 for the sample numbers). Seed from `sample-data.md` is loaded. Presenter has an Android phone (390 px) mirrored to the TV and a laptop. Language toggle set to Gujarati on the phone for the Plant step, English elsewhere (English words below).

Demo users (password per seed / `NEXT_PUBLIC_DEMO_MODE` "Try as" buttons):

| Role word | Login | Name | Device in demo |
|---|---|---|---|
| Owner | admin@mahuvacrm.com | Hareshbhai Mehta | phone |
| Accounts | accountant@mahuvacrm.com | Nileshbhai Shah | laptop |
| Sales | sales@mahuvacrm.com | Pooja Patel | phone |
| Plant | ops@mahuvacrm.com | Dineshbhai Vaghela | phone (Gujarati) |

Buyers used: **Al-Barakah Spice & Grain LLC** (export, Dubai, USD, 30% advance / 70% against BL copy) and **Everest Food Products Pvt Ltd** (domestic, Mumbai, INR, 30 days credit).

Codes the live steps will create (counters after seed: INQ 10, SMP 3, QTN 4, ORD 3, PI 3, REC 4): INQ-0011, SMP-0004, QTN-2627-0005, ORD-0004, PI-2627-0004, REC-2627-0005.

| Time | User | Screen | Tap | What appears | Presenter says |
|---|---|---|---|---|---|
| 0:00 | Owner (phone) | Login `/login` | `Try as > Owner` | Home | "No manual. Four buttons on the login page, one per person in the plant." |
| 0:10 | Owner | Home `/` | - | Tiles: `2 New inquiries`, `1 Quotes waiting`, `1 Orders in production`, `₹21,04,200 + $18,900 Money due` in red with `Late`. "To do today (5)": Al-Barakah `6 days late` balance, Everest `2 days late` sample, Rhine `Today` quote expiring, Al-Barakah `Today` sample result, Haldiram `Today` re-quote. Three big buttons below. | "Hareshbhai, this is your whole business: what came in, what is waiting, what is being packed, who owes you money. Red means call them." |
| 0:30 | Owner | Home | tap tile `Money due` | Money list: Al-Barakah `Late` $18,900 of $27,000, 6 days; Haldiram `Waiting` ₹5,11,875; Everest `Paid` ₹5,04,000 received 09 Nov | "Everest paid on the 9th, green. Haldiram's balance comes after dispatch, amber. Dubai is late, red. We come back to it." Back arrow. |
| 0:45 | Sales (phone) | Login | `Try as > Sales` then `+ New Inquiry` on Home | New inquiry form `/inquiries/new` | "Pooja gets a WhatsApp from Dubai: 'minced, 12 tons, rate?'. Six fields." |
| 0:55 | Sales | New inquiry | Buyer: type `Al-` -> pick Al-Barakah. Product chip `White Minced`. How much `12` with `MT`. Needed by `20 Dec 2026`. Contact chip `WhatsApp`. `Save` | Toast "Saved - INQ-0011". Inquiry detail with `[New]`, buyer card with Call / WhatsApp, primary button `Reply on WhatsApp` | "Thirty seconds. Now she replies from here." |
| 1:15 | Sales | Inquiry INQ-0011 | `Reply on WhatsApp` | WhatsApp opens with the prefilled thank-you text (T1). Return to app: chip is now `[Talking]` | "The reply is written for her, and the inquiry moves to Talking on its own." |
| 1:25 | Sales | Inquiry INQ-0011 | `Send sample` | Send sample form: product prefilled White Minced; tap `500 g`, `DHL`, type tracking `7788 3001 22`; `Save & mark sent` | Back on inquiry: chip `[Sample sent]`, line `Sample SMP-0004 [Sent] today DHL`, timeline shows a follow-up "Ask for sample result" dated 19 Nov | "Nobody forgets this sample. On the seventh day it is on Pooja's list by itself." |
| 1:50 | Sales | Inquiry INQ-0011 | `Make quote` | New quote: buyer locked, item White Minced 12,000 kg, rate prefilled `2,380 $/MT`, line `Floor $2,180 (v)`. Presenter types `2,100` -> line turns red `Below floor $2,180 - owner only (!)`; types `2,380` again -> green. Chips `FOB Pipavav`, `30% adv, 70% on BL`, valid `10` days. Total `$28,560 about ₹24,06,180`. `Save quote` | Quote detail QTN-2627-0005 `[Draft]` | "Same rate to every buyer, straight from the price list. Below the owner's floor it goes red and Pooja cannot send it. Only Hareshbhai can." |
| 2:20 | Sales | Quote QTN-2627-0005 | `Share on WhatsApp` -> WhatsApp opens with T2 -> back -> `Yes, mark sent` | Chip `[Sent]`; inquiry becomes `[Quoted]`; Home "Quotes waiting" will show 2 | "One tap and the buyer has the quote on WhatsApp. No Excel, no typo in the dollar amount." |
| 2:30 | Sales | Quote QTN-2627-0005 | `Buyer accepted` | Confirmation sheet: Al-Barakah, White Minced, `12,000 kg = 480 bags x 25 kg`, `Total $28,560`, `Advance due $8,568`, Ship by `03 Dec 2026`. `Looks right` | Order ORD-0004 opens: `[Confirmed]`, stepper first dot filled, Money block `Due $28,560`, badge `Advance waiting`, Papers `Print PI` | "Tariq says yes. One tap makes the order and the proforma invoice PI-2627-0004 with our bank and SWIFT. Look before you leap: the summary first, then the number." |
| 2:45 | Sales | Order ORD-0004 | `Print PI` | A4 proforma on letterhead with GSTIN, IEC, FSSAI, HDFC USD account, SWIFT, advance line $8,568 | "This goes to Dubai for the advance." Back. |
| 2:55 | Accounts (laptop) | Login | `Try as > Accounts`, then More > `Money` > `Money Received` | Money received form | "Two days later the advance lands. Nileshbhai, the munim, records it in three taps." |
| 3:05 | Accounts | Money received | Order picker: pick `ORD-0004 · Al-Barakah · due $28,560`. Amount: type `8,568` USD; `In rupees` fills `₹7,21,854 at ₹84.25`. Date today. `Bank`. `Save` | Success: big tick, `$8,568 received`, `REC-2627-0005`, "Now due: $19,992 [Waiting]", `Share receipt on WhatsApp` | "Dollar amount, rupee value and the rate are all saved. Tally stays Nileshbhai's book; this just makes sure nothing slips." |
| 3:20 | Accounts | Order ORD-0004 (`Done` -> order) | - | Money block: `Received $8,568`, badge `Advance OK` green | "Green means the plant may start." |
| 3:25 | Plant (phone, Gujarati) | Login | `Try as > Plant` | Home (Plant variant): tile `Orders in production 2`, "Packing today" cards: Haldiram ORD-0003 `[In production]`, Al-Barakah ORD-0004 `[Confirmed]` | "Dineshbhai on the floor sees only what to pack. Big letters, Gujarati." |
| 3:35 | Plant | Order ORD-0004 (packing card) | - | Card: `AL-BARAKAH SPICE & GRAIN - Dubai`, `White Onion Minced 1-3 mm`, `480 bags x 25 kg = 12,000 kg`, bag type, label text, `Moisture max 5.5%`, `Ship by 03 Dec 2026 (container)`. Buttons: `Packing started` green, `Packed` grey, `Loaded` grey | "Buyer, product, bags, label, date. Nothing else." |
| 3:45 | Plant | Order ORD-0004 | `Packing started` | Chip `[In production]`; first button becomes grey tick with today's date; `Packed - how many bags?` turns green | - |
| 3:50 | Plant | Order ORD-0004 | `Packed - how many bags?` -> number pad shows `480` -> `Save` | Chip `[Ready]`; "Packed 480 bags (v)"; `Loaded` turns green | "He types one number. That is all we ask of him. Loaded opens the truck or container form later." |
| 4:00 | Accounts (laptop) | Orders `/orders` -> ORD-0002 (Al-Barakah, seeded) | open order | `[Dispatched]`, Dispatch block: `Container MSKU 482913-7 · Pipavav · MSC Positano 2646W · Stuffed 06 Nov · ETA 24 Nov · BL MEDUPV2246118`, `INV-2627-0002 · SDN-2627-0002`, `Export papers 7 of 8 done [Open]` | "The earlier Dubai container. Where is it, which papers are pending? Here." |
| 4:10 | Accounts | Export checklist `/orders/<ORD-0002>/checklist` | `Tick` on `Certificate of Origin` -> date today -> `Save` | `8 of 8` green; `Share status on WhatsApp` | "Container booked, stuffing, COA, phyto, CoO, fumigation, invoice, BL - eight ticks with dates. The owner never has to ask the CHA." |
| 4:20 | Accounts | Order ORD-0002 -> Money block | `Remind on WhatsApp` | WhatsApp with T6: "$18,900 is pending for order ORD-0002 (invoice INV-2627-0002)..." | "BL copy went on the 10th, money has not come. One tap, polite reminder, in the buyer's language." |
| 4:30 | Owner (phone) | Home | `Try as > Owner` | Tiles now: `2 New inquiries` (Gulf Star, Shree Ambica; INQ-0011 has moved on to Won), `1 Quotes waiting` (Rhine), `2 Orders in production` (ORD-0003 + ORD-0004), Money due red and larger (ORD-0004 balance $19,992 added). To do today: Everest `2 days late` "Send flakes sample for soup mix" | "Everest, our Mumbai masala buyer, is waiting two days for a flakes sample. Rameshbhai calls." |
| 4:38 | Owner | Home | `(Call)` on the Everest row, then `Done` | Row slides out; "To do today (4)" | "Every morning this list says whom to call. Nothing lives in anybody's head." |
| 4:45 | Owner | More > `Products` | - | Products list with rates, floor prices and a lock icon with cost `₹140.50` on White Minced | "Cost price has a lock. Sales never sees it; only you and the munim." |
| 4:52 | Owner | More > `Staff` -> Pooja | - | Four big job buttons Owner / Accounts / Sales / Plant, Login On / Off | "You decide who sees money and costs - four buttons." |
| 5:00 | Owner | Home | hand the phone over | - | "Same app for Dubai containers and Mumbai trucks. Add one inquiry yourself." |

## Fallbacks

| If | Do |
|---|---|
| WhatsApp is not installed on the demo phone | wa.me opens WhatsApp Web / the browser; show the prefilled text and return. |
| Internet drops on Save | red bar "Could not save. Check internet and tap Save again." - tap Save again; the form keeps its values. |
| Short on time | skip 2:45 (Print PI) and 4:45-4:52 (Products, Staff); the story still closes on the To do list. |
| Need to show domestic papers | open ORD-0001 (Everest, delivered by truck) > `Print invoice` = Tax invoice with GST 5%, vehicle GJ-04-AX-7712, LR MTC/4471. |

## Reset between demos

Re-run the seed (`sample-data.md` is idempotent by code / doc number) and delete rows created live: INQ-0011, SMP-0004, QTN-2627-0005, ORD-0004 (+ items), REC-2627-0005, and follow-ups on those entities; reset counters to INQ 10, SMP 3, ORD 3, QTN 4, PI 3, REC 4.
