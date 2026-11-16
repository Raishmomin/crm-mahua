# Labels: every user-facing string (English + Gujarati)

Designer 2, 2026-11-12. Binding for Dev-3 (Sprint A, `src/lib/labels.ts`) and for every module developer.

## How to read this file

| Column | Meaning |
|---|---|
| key | Dot path used in code: `t(lang, 'status.inquiry.new')`. Keys are flat strings in `LABELS.en` / `LABELS.gu`. |
| English | Exact text shown when `lang = en` (default). Plain words only. |
| Gujarati | Exact text shown when `lang = gu`. Gujarati script. |
| Translit. | Latin transliteration for developers and the presenter. Never shown in the UI. |
| Toggle | `yes` = translated when the user switches language. `no` = always English (names, numbers, doc numbers, printed papers). |
| Where | Screen or component that uses it. |

Rules (see `contracts.md` section 9):

- The database stores snake_case codes (`sample_sent`, `in_production`). The UI shows the word from this file. Never store Gujarati. Never display a raw code.
- Placeholders are `{name}` and are replaced by `t()`; placeholder values (buyer names, amounts, doc numbers) are never translated.
- A key missing in `gu` falls back to `en`; a key missing in both renders the key itself so QA can spot it.
- Trade words the users already use in English stay in Latin letters inside Gujarati strings: GST, PI, BL, COA, IFSC, SWIFT, IEC, FSSAI, PAN, UPI, LC, FOB, CIF, kg, MT.

## 1. App

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| app.name | Mahuva CRM | Mahuva CRM | — | no | Login, sidebar brand, print footer |
| app.tagline | Your whole business on one screen | આખો ધંધો એક સ્ક્રીન પર | aakho dhandho ek screen par | yes | Login |
| app.company_short | (business_settings.trade_name or company_name) | — | — | no | Header, sidebar brand line |

## 2. Menu (nav) and module names

Shown modules (MAIN_NAV, in this order). Hidden modules keep their key in ALL_MODULES for the Staff "Can see" list but have no route in the demo.

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| nav.home | Home | હોમ | home | yes | BottomNav, Sidebar (key `dashboard`, href `/`) |
| nav.inquiries | Inquiries | પૂછપરછ | puchhparachh | yes | BottomNav, Sidebar (key `leads`, href `/inquiries`) |
| nav.buyers | Buyers | ગ્રાહકો | grahako | yes | Sidebar / More (key `buyers`, `/buyers`) |
| nav.samples | Samples | સેમ્પલ | sample | yes | Sidebar / More (key `samples`, `/samples`) |
| nav.quotes | Quotes | ભાવપત્ર | bhaav patra | yes | BottomNav, Sidebar (key `quotes`, `/quotes`) |
| nav.orders | Orders | ઓર્ડર | order | yes | BottomNav, Sidebar (key `orders`, `/orders`) |
| nav.money | Money | પૈસા | paisa | yes | BottomNav, Sidebar (key `payments`, `/payments`) |
| nav.products | Products | માલ | maal | yes | Sidebar / More (key `catalog`, `/catalog`) |
| nav.staff | Staff | સ્ટાફ | staff | yes | Sidebar / More (key `users`, `/users`) |
| nav.company | My Company | મારી કંપની | mari company | yes | Sidebar / More (key `settings`, `/settings`) |
| nav.more | More | વધુ | vadhu | yes | BottomNav 5th slot |
| nav.menu | Menu | મેનુ | menu | yes | More sheet title |
| nav.papers | Papers | કાગળો | kagalo | yes | Hidden module `documents` (name only, for Staff list) |
| nav.reports | Reports | રિપોર્ટ | report | yes | Hidden module `reports` |
| nav.history | History | કોણે શું બદલ્યું | kone shu badalyu | yes | Hidden module `audit` |

Module one-line descriptions (Staff screen "Can see" list; replaces the consultant descriptions in `ALL_MODULES`):

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| module.dashboard | Today's work | આજનું કામ | aaj nu kaam | yes | Staff > Can see |
| module.leads | Buyers asking for price | ભાવ પૂછતા ગ્રાહકો | bhaav puchhta grahako | yes | Staff > Can see |
| module.buyers | Our buyers | આપણા ગ્રાહકો | aapna grahako | yes | Staff > Can see |
| module.samples | Samples we sent | મોકલેલા સેમ્પલ | mokalela sample | yes | Staff > Can see |
| module.quotes | Prices we offered | આપેલા ભાવ | aapela bhaav | yes | Staff > Can see |
| module.orders | Orders to make and send | બનાવવાના અને મોકલવાના ઓર્ડર | banavvana ane mokalvana order | yes | Staff > Can see |
| module.payments | Money received and due | આવેલા અને બાકી પૈસા | aavela ane baaki paisa | yes | Staff > Can see |
| module.catalog | What we sell | આપણે શું વેચીએ | aapne shu vechie | yes | Staff > Can see |
| module.users | Who can see what | કોણ શું જોઈ શકે | kon shu joi shake | yes | Staff > Can see |
| module.settings | Company name, GST, bank | કંપનીનું નામ, GST, બેંક | company nu naam, GST, bank | yes | Staff > Can see |
| module.documents | Quotes, bills, dispatch slips | ભાવપત્ર, બિલ, રવાના ચિઠ્ઠી | bhaav patra, bill, ravana chitthi | yes | Staff > Can see (hidden module) |
| module.reports | Who owes money | કોના પૈસા બાકી | kona paisa baaki | yes | Staff > Can see (hidden module) |
| module.audit | Who changed what | કોણે શું બદલ્યું | kone shu badalyu | yes | Staff > Can see (hidden module) |

## 3. Roles (jobs)

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| role.owner | Owner | માલિક | maalik | yes | Header, Staff list, Staff job buttons, Login "Try as" |
| role.accountant | Accounts | હિસાબ | hisaab | yes | same |
| role.sales | Sales | સેલ્સ | sales | yes | same |
| role.operations | Plant | પ્લાન્ટ | plant | yes | same |

## 4. Status words (colour + icon in `status-colours.md`)

| key | DB code | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|---|
| status.inquiry.new | new | New | નવી | navi | yes | Inquiry list pill, filter chip, detail |
| status.inquiry.talking | talking | Talking | વાત ચાલુ | vaat chalu | yes | same |
| status.inquiry.sample_sent | sample_sent | Sample sent | સેમ્પલ મોકલ્યું | sample mokalyu | yes | same |
| status.inquiry.quoted | quoted | Quoted | ભાવ આપ્યો | bhaav aapyo | yes | same |
| status.inquiry.won | won | Won | ઓર્ડર મળ્યો | order malyo | yes | same |
| status.inquiry.lost | lost | Lost | ગુમાવ્યો | gumavyo | yes | same |
| status.sample.to_send | to_send | To send | મોકલવાનું | mokalvanu | yes | Sample list pill |
| status.sample.sent | sent | Sent | મોકલ્યું | mokalyu | yes | same |
| status.sample.approved | approved | Approved | પાસ | pass | yes | same |
| status.sample.rejected | rejected | Rejected | નાપાસ | napaas | yes | same |
| status.quote.draft | draft | Draft | કાચું | kachu | yes | Quote list pill |
| status.quote.sent | sent | Sent | મોકલ્યું | mokalyu | yes | same |
| status.quote.accepted | accepted | Accepted | મંજૂર | manjoor | yes | same |
| status.quote.rejected | rejected | Rejected | નામંજૂર | namanjoor | yes | same |
| status.quote.expired | expired | Expired | મુદત પૂરી | mudat puri | yes | same (derived: sent and valid_till < today) |
| status.order.confirmed | confirmed | Confirmed | પાક્કો | pakko | yes | Order list pill, stepper |
| status.order.in_production | in_production | In production | બની રહ્યો | bani rahyo | yes | same |
| status.order.ready | ready | Ready | તૈયાર | taiyar | yes | same |
| status.order.dispatched | dispatched | Dispatched | રવાના | ravana | yes | same |
| status.order.delivered | delivered | Delivered | પહોંચ્યો | pahonchyo | yes | same |
| status.order.cancelled | cancelled | Cancelled | રદ | rad | yes | same |
| status.dispatch.dispatched | dispatched | Dispatched | રવાના | ravana | yes | Dispatch card |
| status.dispatch.delivered | delivered | Delivered | પહોંચ્યું | pahonchyu | yes | Dispatch card |
| status.money.paid | paid | Paid | ચૂકતે | chukte | yes | Money list, order money section, buyer detail |
| status.money.due | due | Waiting | બાકી | baaki | yes | same (amber; code stays `due`) |
| status.money.overdue | overdue | Late | મોડું | modu | yes | same (red; code stays `overdue`) |
| status.advance.due | (derived) | Advance waiting | એડવાન્સ બાકી | advance baaki | yes | Order card when advance_expected > received |
| status.advance.ok | (derived) | Advance OK | એડવાન્સ આવ્યો | advance aavyo | yes | Order card when received >= advance_expected > 0 |
| status.followup.pending | pending | To do | કરવાનું | karvanu | yes | Follow-up rows |
| status.followup.done | done | Done | થઈ ગયું | thai gayu | yes | Follow-up rows |
| status.staff.active | true | On | ચાલુ | chalu | yes | Staff list pill |
| status.staff.inactive | false | Off | બંધ | bandh | yes | Staff list pill |
| status.floor.ok | (derived) | Above floor | ભાવ બરાબર | bhaav barabar | yes | Quote item rate helper line |
| status.floor.below | (derived) | Below floor | ભાવ ઓછો | bhaav ochho | yes | Quote item rate helper line |
| status.checklist.done | done=true | Done | થઈ ગયું | thai gayu | yes | Export checklist |
| status.checklist.pending | done=false | Pending | બાકી | baaki | yes | Export checklist |

## 5. Lost / reject reasons and inquiry sources

| key | DB code | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|---|
| lost_reason.price | price | Price | ભાવ | bhaav | yes | Mark lost sheet, Buyer rejected sheet (4 chips) |
| lost_reason.quality | quality | Quality | ક્વોલિટી | quality | yes | same |
| lost_reason.timing | timing | Timing | સમય | samay | yes | same |
| lost_reason.no_reply | no_reply | No reply | જવાબ નહીં | javab nahi | yes | same |
| source.whatsapp | whatsapp | WhatsApp | વોટ્સએપ | WhatsApp | yes | New inquiry "How did they contact us" chips |
| source.call | call | Phone call | ફોન | phone | yes | same |
| source.visit | visit | Visit | રૂબરૂ | rubaru | yes | same |
| source.email | email | Email | ઈમેલ | email | yes | same |
| source.indiamart | indiamart | IndiaMART | IndiaMART | — | no | same (brand) |
| buyer_type.domestic_masala | domestic_masala | Masala maker (India) | મસાલાવાળા (ભારત) | masalawala (bharat) | yes | Buyer form chips, buyer detail |
| buyer_type.domestic_food_mfr | domestic_food_mfr | Food company (India) | ફૂડ કંપની (ભારત) | food company (bharat) | yes | same |
| buyer_type.export_importer | export_importer | Importer (export) | ઇમ્પોર્ટર (એક્સપોર્ટ) | importer (export) | yes | same |
| buyer_type.export_agent | export_agent | Agent (export) | એજન્ટ (એક્સપોર્ટ) | agent (export) | yes | same |
| incoterm.EXW | EXW | Ex-plant (EXW) | પ્લાન્ટ પરથી (EXW) | plant parthi | yes | Price basis chips on quote / order; `buyers.incoterm` EXW |
| incoterm.FOB_Pipavav | FOB Pipavav | FOB Pipavav | FOB પીપાવાવ | FOB Pipavav | yes | same; key = code with space -> underscore |
| incoterm.FOB_Mundra | FOB Mundra | FOB Mundra | FOB મુંદ્રા | FOB Mundra | yes | same; default for `buyers.incoterm` FOB via `app_settings.default_incoterm` |
| incoterm.CIF | CIF | CIF (buyer's port) | CIF (ગ્રાહકનું બંદર) | CIF (grahak nu bandar) | yes | same |
| incoterm.FOB | FOB | FOB | FOB | — | no | Buyer form chip only (`buyers.incoterm` stores EXW / FOB / CIF) |
| pay_mode.cash | cash | Cash | રોકડ | rokad | yes | Money received "How did it come" chips |
| pay_mode.bank | bank | Bank | બેંક | bank | yes | same |
| pay_mode.upi | upi | UPI | UPI | — | no | same |
| pay_mode.cheque | cheque | Cheque | ચેક | check | yes | same |
| pay_mode.lc | lc | LC | LC | — | no | same |
| dispatch_mode.truck | truck | Truck | ટ્રક | truck | yes | Dispatch form first choice |
| dispatch_mode.container | container | Container | કન્ટેનર | container | yes | same |

## 6. KPI tiles and Home

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| kpi.new_inquiries | New inquiries | નવી પૂછપરછ | navi puchhparachh | yes | Home tile 1 (v_home_kpis.new_inquiries) |
| kpi.quotes_waiting | Quotes waiting | જવાબ બાકી ભાવપત્ર | javab baaki bhaav patra | yes | Home tile 2 (quotes_waiting) |
| kpi.orders_in_production | Orders in production | ઓર્ડર બની રહ્યા | order bani rahya | yes | Home tile 3 (orders_in_production) |
| kpi.money_due | Money due | બાકી પૈસા | baaki paisa | yes | Home tile 4 (money_due_inr / money_due_usd) |
| kpi.money_overdue | Late | મોડા | moda | yes | Small line under tile 4: "{n} late" |
| kpi.todo_today | To do today | આજનું કામ | aaj nu kaam | yes | Home list header (followups_today) |
| kpi.packing_today | Packing today | આજનું પેકિંગ | aaj nu packing | yes | Home (Plant) list header, from v_orders_in_production |
| kpi.about_inr | about ₹{amount} | લગભગ ₹{amount} | lagbhag | yes | Money tile second line (USD converted at settings rate) |
| kpi.papers_pending | Papers pending | કાગળ બાકી | kagal baaki | yes | Reserved (papers_pending) |
| home.greeting | Namaste, {name} | નમસ્તે, {name} | namaste | yes | Home top line |
| home.today_line | Today: {inquiries} new inquiries, {quotes} quotes waiting, {money} to collect | આજે: {inquiries} નવી પૂછપરછ, {quotes} ભાવપત્ર જવાબ બાકી, {money} લેવાના | aaje ... levana | yes | Home one-line summary |
| home.quick_actions | What do you want to do? | શું કરવું છે? | shu karvu chhe? | yes | Home 3 big buttons header |

## 7. Buttons

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| btn.save | Save | સેવ કરો | save karo | yes | Every form (sticky bottom) |
| btn.saving | Saving... | સેવ થાય છે... | save thay chhe | yes | Save button while pending |
| btn.cancel | Cancel | રદ કરો | rad karo | yes | Forms (secondary) |
| btn.back | Back | પાછા | pachha | yes | Page header left |
| btn.new_inquiry | New Inquiry | નવી પૂછપરછ | navi puchhparachh | yes | Home, Inquiries list |
| btn.new_quote | New Quote | નવું ભાવપત્ર | navu bhaav patra | yes | Home, Quotes list |
| btn.new_buyer | New Buyer | નવો ગ્રાહક | navo grahak | yes | Buyers list, buyer picker |
| btn.new_sample | New Sample | નવું સેમ્પલ | navu sample | yes | Samples list |
| btn.money_received | Money Received | પૈસા આવ્યા | paisa aavya | yes | Home, Money list, Order money section |
| btn.send_sample | Send sample | સેમ્પલ મોકલો | sample mokalo | yes | Inquiry detail |
| btn.make_quote | Make quote | ભાવપત્ર બનાવો | bhaav patra banavo | yes | Inquiry detail, Sample detail |
| btn.mark_talking | Talking | વાત ચાલુ | vaat chalu | yes | Inquiry detail (new -> talking) |
| btn.mark_lost | Mark lost | ગુમાવ્યો | gumavyo | yes | Inquiry detail |
| btn.reopen | Reopen | ફરી ખોલો | fari kholo | yes | Inquiry detail (lost, owner only) |
| btn.reply_whatsapp | Reply on WhatsApp | વોટ્સએપ પર જવાબ આપો | WhatsApp par javab aapo | yes | Inquiry detail (new); on return status -> talking |
| btn.mark_sent | Mark sent | મોકલ્યું | mokalyu | yes | Sample row/detail, Quote detail (draft -> sent) |
| btn.save_mark_sent | Save & mark sent | સેવ કરી મોકલ્યું કરો | save kari mokalyu karo | yes | Send sample form when a courier is chosen |
| btn.make_new_quote | Make new quote | નવું ભાવપત્ર બનાવો | navu bhaav patra banavo | yes | Quote detail (rejected / expired) |
| btn.approved | Approved | પાસ | pass | yes | Sample detail |
| btn.rejected | Rejected | નાપાસ | napaas | yes | Sample detail |
| btn.share_whatsapp | Share on WhatsApp | વોટ્સએપ પર મોકલો | WhatsApp par mokalo | yes | Quote, PI, Invoice, Receipt, Inquiry reply |
| btn.print | Print | પ્રિન્ટ | print | yes | Quote, Order papers, Receipt |
| btn.buyer_accepted | Buyer accepted | ગ્રાહકે મંજૂર કર્યું | grahake manjoor karyu | yes | Quote detail (sent) |
| btn.buyer_rejected | Buyer rejected | ગ્રાહકે ના પાડી | grahake na paadi | yes | Quote detail (sent) |
| btn.looks_right | Looks right, make order | બરાબર છે, ઓર્ડર બનાવો | barabar chhe, order banavo | yes | /quotes/[id]/accept confirmation |
| btn.change | Change | બદલો | badlo | yes | Confirmation screens (secondary) |
| btn.next_step | Next step: {status} | આગળનું પગલું: {status} | aagal nu pagalu | yes | Order detail stepper button |
| btn.start_packing | Start packing | પેકિંગ શરૂ કરો | packing sharu karo | yes | Order detail (office view, confirmed) |
| btn.packing_started | Packing started | પેકિંગ શરૂ | packing sharu | yes | Packing card |
| btn.wait_for_advance | Wait for advance | એડવાન્સની રાહ જુઓ | advance ni raah juo | yes | Disabled button text for Plant while advance waiting |
| btn.wait | Wait | રાહ જુઓ | raah juo | yes | Advance confirm sheet |
| btn.start_anyway | Start anyway | તો પણ શરૂ કરો | to pan sharu karo | yes | Advance confirm sheet |
| btn.packed | Packed | પેક થયું | pack thayu | yes | Packing card (opens bag count) |
| btn.loaded | Loaded | ભરાઈ ગયું | bharai gayu | yes | Packing card (opens dispatch form) |
| btn.dispatch | Dispatch | રવાના કરો | ravana karo | yes | Order detail (ready) |
| btn.save_make_papers | Save & make papers | સેવ કરી કાગળ બનાવો | save kari kagal banavo | yes | Dispatch form primary |
| btn.delivered | Delivered | પહોંચી ગયો | pahonchi gayo | yes | Order detail / dispatch card (dispatched) |
| btn.cancel_order | Cancel order | ઓર્ડર રદ કરો | order rad karo | yes | Order detail (before dispatch, under More) |
| btn.add_note | Add note | નોંધ લખો | nondh lakho | yes | Inquiry, Buyer, Order detail |
| btn.add_followup | Add follow-up | ફોલો-અપ ઉમેરો | follow-up umero | yes | Inquiry, Buyer, Quote, Order, Money detail |
| btn.done | Done | થઈ ગયું | thai gayu | yes | Follow-up row |
| btn.tick | Tick | ટીક કરો | tick karo | yes | Checklist item (pending) |
| btn.untick | Untick | ટીક કાઢો | tick kadho | yes | Checklist item (done; owner / accounts) |
| btn.see_all | See all | બધું જુઓ | badhu juo | yes | Home To do today |
| btn.help | Help | મદદ | madad | yes | Header speaker icon (plays Gujarati help clip) |
| btn.call | Call | ફોન કરો | phone karo | yes | PhoneActions |
| btn.whatsapp | WhatsApp | વોટ્સએપ | WhatsApp | yes | PhoneActions |
| btn.remind_whatsapp | WhatsApp Remind | વોટ્સએપ પર યાદ અપાવો | WhatsApp par yaad apavo | yes | Money list row, buyer detail, order money section |
| btn.share_status_whatsapp | Share status on WhatsApp | વોટ્સએપ પર સ્થિતિ મોકલો | WhatsApp par sthiti mokalo | yes | Export checklist primary |
| btn.share_receipt_whatsapp | Share receipt on WhatsApp | વોટ્સએપ પર રસીદ મોકલો | WhatsApp par rasid mokalo | yes | Money received success |
| btn.sign_in | Sign in | લોગિન | login | yes | Login |
| btn.sign_out | Sign out | લોગઆઉટ | logout | yes | Header |
| btn.try_as | Try as: | આ તરીકે ખોલો: | aa tarike kholo | yes | Login demo block (NEXT_PUBLIC_DEMO_MODE only) |
| btn.go_home | Go Home | હોમ પર જાઓ | home par jao | yes | Access denied, 404, account inactive |
| btn.language | Language | ભાષા | bhasha | yes | LanguageToggle aria-label |
| btn.lang_en | English | English | — | no | LanguageToggle option (always in its own language) |
| btn.lang_gu | ગુજરાતી | ગુજરાતી | gujarati | no | LanguageToggle option (always in its own language) |
| btn.retry | Try again | ફરી કરો | fari karo | yes | ErrorState |
| btn.more | More | વધુ | vadhu | yes | Forms: reveal optional fields |
| btn.less | Less | ઓછું | ochhu | yes | Forms: hide optional fields |
| btn.edit | Edit | સુધારો | sudharo | yes | Detail pages (draft quote, inquiry, buyer) |
| btn.delete | Delete | કાઢી નાખો | kadhi nakho | yes | Draft quote only |
| btn.add_item | Add product | માલ ઉમેરો | maal umero | yes | Quote form items |
| btn.remove | Remove | કાઢો | kadho | yes | Quote form item row |
| btn.take_photo | Take photo | ફોટો લો | photo lo | yes | Checklist item (later), packing card COA |
| btn.search | Search | શોધો | shodho | yes | List search box aria-label |
| btn.switch_off | Switch off | બંધ કરો | bandh karo | yes | Staff detail |
| btn.switch_on | Switch on | ચાલુ કરો | chalu karo | yes | Staff detail |
| btn.change_access | Change what they can see | શું જોઈ શકે તે બદલો | shu joi shake te badlo | yes | Staff detail |
| btn.change_details | Change details | વિગત બદલો | vigat badlo | yes | Staff access sheet (reveals 13-item list) |
| btn.papers | Papers | કાગળો | kagalo | yes | Order detail section button |
| btn.checklist | Export papers | એક્સપોર્ટ કાગળો | export kagalo | yes | Order detail (container dispatch) |
| btn.view_pi | PI | PI | — | no | Order papers (doc names stay English) |
| btn.view_invoice | Invoice | ઇન્વોઇસ | invoice | yes | Order papers |
| btn.view_sdn | Dispatch slip | રવાના ચિઠ્ઠી | ravana chitthi | yes | Order papers |
| btn.view_receipt | Receipt | રસીદ | rasid | yes | Money list row |
| btn.all | All | બધા | badha | yes | List filter chip |
| btn.open | Open | ચાલુ | chalu | yes | List filter chip (inquiries/orders not closed) |
| btn.closed | Closed | બંધ | bandh | yes | List filter chip |
| btn.yes | Yes | હા | haa | yes | Confirm dialogs |
| btn.no | No | ના | naa | yes | Confirm dialogs |

## 8. Screen titles and section headers

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| title.inquiries | Inquiries | પૂછપરછ | puchhparachh | yes | /inquiries |
| title.inquiry_new | New Inquiry | નવી પૂછપરછ | navi puchhparachh | yes | /inquiries/new |
| title.inquiry_edit | Change inquiry | પૂછપરછ બદલો | puchhparachh badlo | yes | /inquiries/[id]/edit |
| title.buyers | Buyers | ગ્રાહકો | grahako | yes | /buyers |
| title.buyer_new | New Buyer | નવો ગ્રાહક | navo grahak | yes | /buyers/new |
| title.buyer_edit | Change buyer | ગ્રાહક બદલો | grahak badlo | yes | /buyers/[id]/edit |
| title.samples | Samples | સેમ્પલ | sample | yes | /samples |
| title.sample_new | Send sample | સેમ્પલ મોકલો | sample mokalo | yes | /samples/new |
| title.quotes | Quotes | ભાવપત્ર | bhaav patra | yes | /quotes |
| title.quote_new | New Quote | નવું ભાવપત્ર | navu bhaav patra | yes | /quotes/new |
| title.quote_edit | Change quote | ભાવપત્ર બદલો | bhaav patra badlo | yes | /quotes/[id]/edit |
| title.quote_accept | Looks right? | બરાબર છે? | barabar chhe? | yes | /quotes/[id]/accept |
| title.orders | Orders | ઓર્ડર | order | yes | /orders |
| title.packing_card | Packing card | પેકિંગ કાર્ડ | packing card | yes | /orders/[id]/packing |
| title.dispatch | Dispatch | રવાના | ravana | yes | /orders/[id]/dispatch |
| title.export_papers | Export papers | એક્સપોર્ટ કાગળો | export kagalo | yes | /orders/[id]/checklist |
| title.money | Money | પૈસા | paisa | yes | /payments |
| title.money_received | Money received | પૈસા આવ્યા | paisa aavya | yes | /payments/new |
| title.products | Products | માલ | maal | yes | /catalog |
| title.staff | Staff | સ્ટાફ | staff | yes | /users |
| title.staff_access | Who can see what | કોણ શું જોઈ શકે | kon shu joi shake | yes | Staff access sheet |
| title.company | My Company | મારી કંપની | mari company | yes | /settings |
| section.what_they_want | What they want | શું જોઈએ છે | shu joie chhe | yes | Inquiry detail |
| section.notes_followups | Notes and follow-ups | નોંધ અને ફોલો-અપ | nondh ane follow-up | yes | Inquiry, Buyer, Order detail |
| section.items | Products | માલ | maal | yes | Quote, Order detail |
| section.money | Money | પૈસા | paisa | yes | Order detail, Buyer detail |
| section.papers | Papers | કાગળો | kagalo | yes | Order detail |
| section.dispatch | Dispatch | રવાના | ravana | yes | Order detail |
| section.contacts | Contacts | સંપર્ક | sampark | yes | Buyer detail |
| section.last_orders | Last orders | છેલ્લા ઓર્ડર | chhella order | yes | Buyer detail |
| section.open_inquiries | Open inquiries | ચાલુ પૂછપરછ | chalu puchhparachh | yes | Buyer detail |
| section.open_quotes | Open quotes | ચાલુ ભાવપત્ર | chalu bhaav patra | yes | Buyer detail |
| section.samples | Samples | સેમ્પલ | sample | yes | Inquiry / Buyer detail |
| section.totals | Total | કુલ | kul | yes | Quote / Order detail |
| section.company_card | Company | કંપની | company | yes | My Company card 1 |
| section.bank_card | Bank | બેંક | bank | yes | My Company card 2 |
| section.more_export | More (export) | વધુ (એક્સપોર્ટ) | vadhu (export) | yes | My Company toggle |
| section.can_see | Can see | જોઈ શકે | joi shake | yes | Staff detail |
| section.job | Job | કામ | kaam | yes | Staff access sheet |

## 9. Form field labels

Inquiry (`/inquiries/new`, 6 visible: buyer, phone, product, qty, needed_by, source; rest under More):

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| field.inquiry.buyer | Buyer | ગ્રાહક | grahak | yes | Buyer picker (search or New Buyer) |
| field.inquiry.buyer_name | Buyer name | ગ્રાહકનું નામ | grahak nu naam | yes | Text when no buyer picked |
| field.inquiry.phone | Phone (WhatsApp) | ફોન (વોટ્સએપ) | phone (WhatsApp) | yes | |
| field.inquiry.product | Product | માલ | maal | yes | 6 product chips |
| field.inquiry.product_text | Other product | બીજો માલ | bijo maal | yes | Under More |
| field.inquiry.qty_kg | Quantity | જથ્થો | jaththo | yes | Number + kg / MT toggle |
| field.inquiry.needed_by | Needed by | ક્યાં સુધીમાં જોઈએ | kya sudhi ma joie | yes | Date |
| field.inquiry.source | How did they contact us | ક્યાંથી આવી | kyathi aavi | yes | 5 chips |
| field.inquiry.notes | Notes | નોંધ | nondh | yes | Under More |
| field.inquiry.assigned_to | Who follows up | કોણ સંભાળે | kon sambhale | yes | Under More (staff picker) |
| field.inquiry.lost_reason | Why lost | કેમ ગુમાવ્યો | kem gumavyo | yes | Mark lost sheet |
| field.inquiry.code | Inquiry no. | પૂછપરછ નંબર | puchhparachh number | yes | Detail header (value stays INQ-0041) |
| field.followup.note | Note | નોંધ | nondh | yes | Add note sheet (required) |
| field.followup.remind_on | Remind me on | યાદ અપાવો | yaad apavo | yes | Add note sheet (optional date) |
| remind.tomorrow | Tomorrow | કાલે | kale | yes | Remind chips |
| remind.3_days | 3 days | 3 દિવસ | 3 divas | yes | Remind chips |
| remind.7_days | 7 days | 7 દિવસ | 7 divas | yes | Remind chips |

Buyer (`/buyers/new`, visible: company_name, phone, contact_name, city, is_export; rest under More):

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| field.buyer.company_name | Buyer name | ગ્રાહકનું નામ | grahak nu naam | yes | |
| field.buyer.phone | Phone (WhatsApp) | ફોન (વોટ્સએપ) | phone (WhatsApp) | yes | Primary contact phone |
| field.buyer.contact_name | Contact person | સંપર્ક વ્યક્તિ | sampark vyakti | yes | Primary contact name |
| field.buyer.city | City | શહેર | shaher | yes | |
| field.buyer.is_export | India or export? | ભારત કે એક્સપોર્ટ? | bharat ke export | yes | Two chips: India / Export |
| field.buyer.india | India | ભારત | bharat | yes | chip |
| field.buyer.export | Export | એક્સપોર્ટ | export | yes | chip |
| field.buyer.country | Country | દેશ | desh | yes | Shown when Export |
| field.buyer.buyer_type | Type of buyer | ગ્રાહકનો પ્રકાર | grahak no prakar | yes | Under More (4 chips, see buyer_type.*) |
| field.buyer.gstin | GST number | GST નંબર | GST number | yes | Under More (India) |
| field.buyer.pan | PAN | PAN | — | no | Under More |
| field.buyer.incoterm | Price basis | ભાવનો આધાર | bhaav no aadhar | yes | Under More (chips EXW / FOB / CIF) |
| field.buyer.payment_terms | Payment terms | પૈસાની શરત | paisa ni sharat | yes | Under More (text, default from settings) |
| field.buyer.credit_days | Credit days | ઉધાર દિવસ | udhaar divas | yes | Under More (number) |
| field.buyer.currency | Currency (₹ / $) | ચલણ (₹ / $) | chalan | yes | Under More |
| field.buyer.address | Address | સરનામું | sarnamu | yes | Under More |
| field.buyer.state | State | રાજ્ય | rajya | yes | Under More |
| field.buyer.email | Email | ઈમેલ | email | yes | Under More |
| field.buyer.money_due | Money due | બાકી પૈસા | baaki paisa | yes | Buyer list pill / detail |

Sample (`/samples/new`, visible: buyer, product, qty_grams, courier, tracking_no; rest under More):

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| field.sample.inquiry | For inquiry | પૂછપરછ માટે | puchhparachh mate | yes | Prefilled, read-only |
| field.sample.buyer | Buyer | ગ્રાહક | grahak | yes | |
| field.sample.product | Product | માલ | maal | yes | |
| field.sample.qty_grams | Grams | ગ્રામ | gram | yes | Default 500 |
| field.sample.lot_no | Lot no. | લોટ નંબર | lot number | yes | Under More |
| field.sample.courier | Courier | કુરિયર | courier | yes | |
| field.sample.tracking_no | Tracking number | ટ્રેકિંગ નંબર | tracking number | yes | |
| field.sample.sent_on | Sent on | મોકલ્યા તારીખ | mokalya tarikh | yes | Set by Mark sent |
| field.sample.result_note | Buyer's reply | ગ્રાહકનો જવાબ | grahak no javab | yes | Approved / Rejected sheet |
| field.sample.code | Sample no. | સેમ્પલ નંબર | sample number | yes | Detail header |

Quote (`/quotes/new`, visible: buyer, items (product, qty, rate), valid_days, payment_terms; rest under More):

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| field.quote.buyer | Buyer | ગ્રાહક | grahak | yes | |
| field.quote.inquiry | For inquiry | પૂછપરછ માટે | puchhparachh mate | yes | Prefilled |
| field.quote.currency | Currency (₹ / $) | ચલણ (₹ / $) | chalan | yes | Default from buyer |
| field.quote.incoterm | Price basis | ભાવનો આધાર | bhaav no aadhar | yes | Chips EXW / FOB Pipavav / FOB Mundra / CIF (stored as that text) |
| field.quote.valid_days | Valid for (days) | કેટલા દિવસ માન્ય | ketla divas manya | yes | Default 10 |
| field.quote.valid_till | Valid till | ક્યાં સુધી માન્ય | kya sudhi manya | yes | Detail / print |
| field.quote.payment_terms | Payment terms | પૈસાની શરત | paisa ni sharat | yes | Default from buyer / settings |
| field.quote.notes | Notes | નોંધ | nondh | yes | Under More |
| field.quote.quote_no | Quote no. | ભાવપત્ર નંબર | bhaav patra number | yes | Detail header |
| field.quote_item.product | Product | માલ | maal | yes | Item row |
| field.quote_item.qty | Quantity | જથ્થો | jaththo | yes | Item row (number + kg/MT) |
| field.quote_item.unit | Rate per | ભાવ પ્રતિ | bhaav prati | yes | kg / MT chips |
| field.quote_item.rate | Rate | ભાવ | bhaav | yes | Item row |
| field.quote_item.packaging | Packing | પેકિંગ | packing | yes | Under More per item |
| field.quote_item.spec | Spec (moisture, size) | સ્પેક (ભેજ, સાઇઝ) | spec (bhej, size) | yes | Under More per item, prefilled from product |
| field.quote_item.amount | Amount | રકમ | rakam | yes | Item row (computed) |
| field.quote_item.floor_price | Floor price | ઓછામાં ઓછો ભાવ | ochha ma ochho bhaav | yes | Helper line under rate |
| field.quote.subtotal | Goods total | માલની રકમ | maal ni rakam | yes | Totals |
| field.quote.gst | GST | GST | — | no | Totals (India only) |
| field.quote.total | Total | કુલ રકમ | kul rakam | yes | Totals |
| field.quote.total_inr | About ₹{amount} | લગભગ ₹{amount} | lagbhag | yes | Under total when currency is not INR and fx_rate known |

Order / accept confirmation (`/quotes/[id]/accept`):

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| field.order.advance_pct | Advance (%) | એડવાન્સ (%) | advance | yes | Accept screen (default 30 export, 0 India) |
| field.order.advance_expected | Advance expected | એડવાન્સ જોઈએ | advance joie | yes | Accept screen (computed), order money section |
| field.order.expected_dispatch | Ship by | ક્યાં સુધીમાં મોકલવું | kya sudhi ma mokalvu | yes | Accept screen, packing card |
| field.order.order_code | Order no. | ઓર્ડર નંબર | order number | yes | Detail header |
| field.order.pi_no | PI no. | PI નંબર | PI number | yes | Detail, papers |
| field.order.planned_bags | Bags | બેગ | bag | yes | Packing card "{packed} / {planned} bags" (planned_bags from v_orders_in_production) |
| field.order.packed_bags | Bags packed | બેગ પેક થઈ | bag pack thai | yes | Packed sheet number input |
| field.order.packing_note | Label text | લેબલ | label | yes | Packing card; when `orders.packing_note` is NULL the UI composes: buyer name + product name + "Net 25 kg" + company short name |
| field.order.notes | Notes | નોંધ | nondh | yes | Under More |
| field.order.received | Received | આવ્યા | aavya | yes | Money section |
| field.order.due | Due | બાકી | baaki | yes | Money section |
| field.order.due_date | Due date | છેલ્લી તારીખ | chhelli tarikh | yes | Money section (dispatch + credit days) |

Dispatch (`/orders/[id]/dispatch`; step 1 = mode chips; truck shows vehicle_no, lr_no, bags, qty; container shows container_no, stuffing_date, port, bags, qty; rest under More):

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| field.dispatch.mode | How is it going? | કેવી રીતે જાય છે? | kevi rite jay chhe | yes | Truck / Container chips |
| field.dispatch.dispatched_on | Dispatch date | રવાના તારીખ | ravana tarikh | yes | Default today |
| field.dispatch.vehicle_no | Truck number | ટ્રક નંબર | truck number | yes | Truck |
| field.dispatch.lr_no | LR / bilty number | LR / બિલ્ટી નંબર | LR / bilty number | yes | Truck, under More |
| field.dispatch.transporter | Transport | ટ્રાન્સપોર્ટ | transport | yes | Truck, under More |
| field.dispatch.bags_count | Bags | બેગ | bag | yes | Default packed_bags |
| field.dispatch.qty_kg | Quantity (kg) | જથ્થો (કિલો) | jaththo (kilo) | yes | Default remaining |
| field.dispatch.container_no | Container number | કન્ટેનર નંબર | container number | yes | Container |
| field.dispatch.stuffing_date | Stuffing date | ભરવાની તારીખ | bharvani tarikh | yes | Container |
| field.dispatch.port | Port | બંદર (પોર્ટ) | bandar (port) | yes | Container (Pipavav / Mundra chips + other) |
| field.dispatch.vessel | Vessel | જહાજ (વેસલ) | jahaj (vessel) | yes | Container, under More / papers screen |
| field.dispatch.eta | Arrives on (ETA) | પહોંચવાની તારીખ (ETA) | pahonchvani tarikh | yes | Container, under More / papers screen |
| field.dispatch.bl_no | BL number | BL નંબર | BL number | yes | Papers screen |
| field.dispatch.invoice_no | Invoice no. | ઇન્વોઇસ નંબર | invoice number | yes | Dispatch card |
| field.dispatch.sdn_no | Dispatch slip no. | રવાના ચિઠ્ઠી નંબર | ravana chitthi number | yes | Dispatch card |
| field.dispatch.delivered_on | Delivered on | પહોંચ્યા તારીખ | pahonchya tarikh | yes | Delivered sheet |
| field.dispatch.notes | Notes | નોંધ | nondh | yes | Under More |

Export checklist (8 items, keys = jsonb keys in `dispatches.export_checklist`):

| key | jsonb key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|---|
| checklist.container_booked | container_booked | Container booked | કન્ટેનર બુક થયું | container book thayu | yes | Export papers |
| checklist.stuffing_done | stuffing_done | Container stuffed | કન્ટેનર ભરાયું | container bharayu | yes | |
| checklist.coa | coa | COA (lab report) | COA (લેબ રિપોર્ટ) | COA (lab report) | yes | |
| checklist.phyto | phyto | Phyto certificate | ફાયટો સર્ટિફિકેટ | phyto certificate | yes | |
| checklist.coo | coo | Certificate of Origin | ઓરિજિન સર્ટિફિકેટ (CoO) | origin certificate | yes | |
| checklist.fumigation | fumigation | Fumigation | ફ્યુમિગેશન | fumigation | yes | |
| checklist.invoice_packing_list | invoice_packing_list | Invoice + packing list | ઇન્વોઇસ + પેકિંગ લિસ્ટ | invoice + packing list | yes | |
| checklist.bl_received | bl_received | BL received | BL મળ્યું | BL malyu | yes | |
| checklist.progress | — | {done} of 8 done | 8 માંથી {done} થયા | 8 manthi {done} thaya | yes | Papers header, order card |

Money received (`/payments/new`, visible: order, amount, received_on, mode; amount_inr + fx_rate shown only when currency is not INR; reference/note under More):

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| field.payment.order | Order | ઓર્ડર | order | yes | Picker shows "{order_code} · {buyer} · due {amount}" |
| field.payment.buyer | Buyer | ગ્રાહક | grahak | yes | Read-only from order |
| field.payment.amount | Amount | રકમ | rakam | yes | Currency symbol prefix from order |
| field.payment.received_on | Received on | ક્યારે આવ્યા | kyare aavya | yes | Default today |
| field.payment.amount_inr | Amount in ₹ | રૂપિયામાં રકમ | rupiya ma rakam | yes | Foreign currency only (`payments.amount_inr`) |
| field.payment.fx_rate | ₹ per 1 $ | 1 $ ના ₹ | 1 dollar na rupiya | yes | Foreign currency only (symbol follows currency) |
| field.payment.mode | How did it come | કઈ રીતે આવ્યા | kai rite aavya | yes | 5 chips (pay_mode.*) |
| field.payment.reference | Reference (UTR / cheque no.) | રેફરન્સ (UTR / ચેક નંબર) | reference | yes | Under More |
| field.payment.note | Note | નોંધ | nondh | yes | Under More |
| field.payment.receipt_no | Receipt no. | રસીદ નંબર | rasid number | yes | Receipt view |
| field.payment.due_now | Due now | હાલ બાકી | haal baaki | yes | Helper line under order picker |

Staff (`/users`):

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| field.staff.name | Name | નામ | naam | yes | List, detail |
| field.staff.email | Email | ઈમેલ | email | yes | Detail |
| field.staff.job | Job | કામ | kaam | yes | List fact, access sheet (4 big buttons role.*) |
| field.staff.can_see | Can see {n} things | {n} વસ્તુ જોઈ શકે | {n} vastu joi shake | yes | List fact; tap shows module.* names |
| field.staff.login | Login | લોગિન | login | yes | On / Off pill (status.staff.*) |

My Company (`/settings`; card Company: company_name, address, city, gstin, phone; card Bank: bank_name, account_no, ifsc; More (export): trade_name, state, pincode, country, email, iec, pan, fssai, swift, branch, signatory):

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| field.company.company_name | Company name | કંપનીનું નામ | company nu naam | yes | Card Company |
| field.company.trade_name | Brand name | બ્રાન્ડ નામ | brand naam | yes | More |
| field.company.address | Address | સરનામું | sarnamu | yes | Card Company |
| field.company.city | City | શહેર | shaher | yes | Card Company |
| field.company.state | State | રાજ્ય | rajya | yes | More |
| field.company.pincode | PIN code | પિન કોડ | pin code | yes | More |
| field.company.country | Country | દેશ | desh | yes | More |
| field.company.gstin | GST number | GST નંબર | GST number | yes | Card Company |
| field.company.phone | Phone | ફોન | phone | yes | Card Company |
| field.company.email | Email | ઈમેલ | email | yes | More |
| field.company.bank_name | Bank | બેંક | bank | yes | Card Bank |
| field.company.account_no | Account number | ખાતા નંબર | khata number | yes | Card Bank |
| field.company.ifsc | IFSC | IFSC | — | no | Card Bank |
| field.company.branch | Branch | બ્રાન્ચ | branch | yes | More |
| field.company.swift | SWIFT (for export) | SWIFT (એક્સપોર્ટ માટે) | SWIFT (export mate) | yes | More |
| field.company.iec | IEC (export code) | IEC (એક્સપોર્ટ કોડ) | IEC (export code) | yes | More |
| field.company.pan | PAN | PAN | — | no | More |
| field.company.fssai | FSSAI number | FSSAI નંબર | FSSAI number | yes | More |
| field.company.signatory | Who signs papers | કાગળ પર સહી કોણ કરે | kagal par sahi kon kare | yes | More |

Login:

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| login.title | Welcome | નમસ્તે | namaste | yes | /login |
| login.subtitle | Enter your email and password | ઈમેલ અને પાસવર્ડ લખો | email ane password lakho | yes | /login |
| field.login.email | Email | ઈમેલ | email | yes | /login |
| field.login.password | Password | પાસવર્ડ | password | yes | /login |
| login.wait | Please wait... | થોભો... | thobho | yes | Sign in button while pending |
| login.demo_note | Demo logins | ડેમો લોગિન | demo login | yes | Above Try as buttons (demo mode only) |

## 10. List row facts, units, time words

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| common.search_placeholder | Search name or phone | નામ કે ફોન શોધો | naam ke phone shodho | yes | Every list search box |
| common.loading | Loading... | ખૂલે છે... | khule chhe | yes | LoadingSkeleton aria |
| common.optional | optional | વૈકલ્પિક | vaikalpik | yes | Field hint |
| common.of | of | માંથી | manthi | yes | "240 of 480 bags" (Gujarati order: "480 માંથી 240") |
| common.total | Total | કુલ | kul | yes | Lists footer |
| common.today | Today | આજે | aaje | yes | Dates |
| common.tomorrow | Tomorrow | કાલે | kale | yes | Dates |
| common.yesterday | Yesterday | ગઈકાલે | gaikale | yes | Dates |
| common.days_old | {n} days old | {n} દિવસ જૂની | {n} divas juni | yes | Inquiry rows |
| common.days_left | {n} days left | {n} દિવસ બાકી | {n} divas baaki | yes | Quote validity, money due date |
| common.days_late | {n} days late | {n} દિવસ મોડું | {n} divas modu | yes | Money rows, follow-ups |
| common.since | since {date} | {date} થી | {date} thi | yes | Order rows |
| common.due_on | due {date} | {date} સુધી | {date} sudhi | yes | Money rows (Waiting with a date) |
| common.after_dispatch | after dispatch | રવાના પછી | ravana pachhi | yes | Money rows (Waiting, not dispatched) |
| common.by | by {name} | {name} દ્વારા | {name} dwara | yes | Notes timeline |
| common.locked_cost | Only owner and accounts can see cost | ખર્ચ ફક્ત માલિક અને હિસાબ જોઈ શકે | kharch fakt maalik ane hisaab joi shake | yes | Products list lock hint |
| common.not_set | Not set | નથી | nathi | yes | Empty field value in detail |
| unit.kg | kg | કિલો | kilo | yes | Quantities |
| unit.mt | MT | ટન | tan | yes | Quantities |
| unit.g | g | ગ્રામ | gram | yes | Samples |
| unit.bags | bags | બેગ | bag | yes | Orders |
| unit.days | days | દિવસ | divas | yes | Credit days, validity |
| unit.per | per | પ્રતિ | prati | yes | "₹185 per kg" (Gujarati: "₹185 પ્રતિ કિલો") |
| product.cost | Cost | ખર્ચ | kharch | yes | Products list column (owner/accounts) |
| product.rate_inr | Rate ₹/kg | ભાવ ₹/કિલો | bhaav | yes | Products list |
| product.rate_export | Export rate $/MT | એક્સપોર્ટ ભાવ $/MT | export bhaav | yes | Products list |
| product.floor | Floor | ઓછામાં ઓછો | ochha ma ochho | yes | Products list |
| product.form.flakes | Flakes | ફ્લેક્સ | flakes | yes | Product chips |
| product.form.kibbled | Kibbled | કિબલ્ડ | kibbled | yes | Product chips |
| product.form.minced | Minced | મિન્સ્ડ | minced | yes | Product chips |
| product.form.chopped | Chopped | ચોપ્ડ | chopped | yes | Product chips |
| product.form.granules | Granules | ગ્રેન્યુલ્સ | granules | yes | Product chips |
| product.form.powder | Powder | પાવડર | powder | yes | Product chips |
| product.color.white | White | સફેદ | safed | yes | Product chips |
| product.color.red | Red | લાલ | laal | yes | Product chips |
| product.color.pink | Pink | ગુલાબી | gulabi | yes | Product chips |

Product and buyer names, codes (INQ-0041, QTN-2627-0012, PI-2627-0007, INV-2627-0031, REC-2627-0003, SDN-2627-0002, ORD-0019, BUY-0003, SMP-0005) and all numbers are never translated.

## 11. Messages (empty, error, success, confirm)

| key | English | Gujarati | Translit. | Toggle | Where |
|---|---|---|---|---|---|
| msg.empty.generic | Nothing here yet. Tap + to add. | હજુ કંઈ નથી. + દબાવો. | haju kai nathi. + dabavo. | yes | EmptyState default |
| msg.empty.inquiries | No inquiries yet. Tap + when a buyer calls. | હજુ કોઈ પૂછપરછ નથી. ગ્રાહકનો ફોન આવે ત્યારે + દબાવો. | ... | yes | /inquiries |
| msg.empty.buyers | No buyers yet. | હજુ કોઈ ગ્રાહક નથી. | haju koi grahak nathi | yes | /buyers |
| msg.empty.samples | No samples sent yet. | હજુ કોઈ સેમ્પલ મોકલ્યું નથી. | ... | yes | /samples |
| msg.empty.quotes | No quotes yet. | હજુ કોઈ ભાવપત્ર નથી. | ... | yes | /quotes |
| msg.empty.orders | No orders yet. | હજુ કોઈ ઓર્ડર નથી. | ... | yes | /orders |
| msg.empty.money | No orders yet, so no money to collect. | હજુ ઓર્ડર નથી, એટલે પૈસા લેવાના નથી. | haju order nathi, etle paisa levana nathi | yes | /payments, chip All |
| msg.empty.money_late | Nobody is late. Good. | કોઈ મોડું નથી. સરસ. | koi modu nathi. saras. | yes | /payments, chip Late (green tick icon) |
| msg.empty.money_paid | No order fully paid yet. | હજુ કોઈ ઓર્ડર પૂરો ચૂકતે નથી. | haju koi order puro chukte nathi | yes | /payments, chip Paid |
| msg.not_dispatched | Not dispatched yet. | હજુ રવાના નથી થયો. | haju ravana nathi thayo | yes | Order detail dispatch block |
| msg.bl_not_yet | BL not yet | BL હજુ નથી | BL haju nathi | yes | Order detail dispatch block |
| msg.lost_with_reason | Lost - {reason} | ગુમાવ્યો - {reason} | gumavyo | yes | Inquiry detail, quote detail ({reason} = lost_reason word) |
| msg.empty.todo | Nothing to do today. Well done. | આજે કંઈ કામ બાકી નથી. શાબાશ. | aaje kai kaam baaki nathi. shabash. | yes | Home list (tick icon) |
| msg.empty.packing_today | No order to pack today. | આજે પેક કરવાનો કોઈ ઓર્ડર નથી. | aaje pack karvano koi order nathi | yes | Home (Plant) Packing today |
| msg.empty.search | No one found with this name or number. | આ નામ કે નંબર મળ્યો નહીં. | aa naam ke number malyo nahi | yes | Any list after search |
| msg.empty.notes | No notes yet. | હજુ કોઈ નોંધ નથી. | haju koi nondh nathi | yes | Detail timeline |
| msg.empty.items | Add at least one product. | ઓછામાં ઓછો એક માલ ઉમેરો. | ... | yes | Quote form |
| msg.error.load | Could not load. Tap to try again. | ખુલ્યું નહીં. ફરી દબાવો. | khulyu nahi. fari dabavo. | yes | ErrorState default |
| msg.error.save | Could not save. Try again. | સેવ થયું નહીં. ફરી કરો. | save thayu nahi. fari karo. | yes | Form error banner |
| msg.error.offline | No internet. Try again. | ઇન્ટરનેટ નથી. ફરી કરો. | internet nathi | yes | Form error banner |
| msg.error.required | Please fill this | આ ભરો | aa bharo | yes | Under a field |
| msg.error.phone | Phone number looks wrong | ફોન નંબર ખોટો લાગે છે | phone number khoto laage chhe | yes | Under phone field |
| msg.error.number | Enter a number | આંકડો લખો | aankdo lakho | yes | Under number field |
| msg.error.date | Pick a date | તારીખ પસંદ કરો | tarikh pasand karo | yes | Under date field |
| msg.error.not_found | This page does not exist. | આ પાનું નથી. | aa paanu nathi | yes | not-found.tsx |
| msg.err.invalid_transition | This step cannot be done now. | આ પગલું હમણાં ન થાય. | aa pagalu hamna na thay | yes | Mapped from DB message `invalid_transition` |
| msg.err.not_found | Not found. | મળ્યું નહીં. | malyu nahi | yes | DB `not_found` |
| msg.err.no_items | Add at least one product. | ઓછામાં ઓછો એક માલ ઉમેરો. | ... | yes | DB `no_items` |
| msg.err.quote_expired | This quote has expired. Make a new one. | આ ભાવપત્રની મુદત પૂરી થઈ. નવું બનાવો. | ... | yes | DB `quote_expired` |
| msg.err.bad_payload | Something is missing. Check the form. | કંઈક ખૂટે છે. ફોર્મ જુઓ. | ... | yes | DB `bad_payload` |
| msg.err.last_owner | At least one owner is needed. | ઓછામાં ઓછો એક માલિક જોઈએ. | ... | yes | DB `last_owner` |
| msg.err.self_change | You cannot change your own job. | તમે તમારું પોતાનું કામ બદલી ન શકો. | ... | yes | DB `self_change` |
| msg.err.reason_required | Pick a reason. | કારણ પસંદ કરો. | karan pasand karo | yes | DB `reason_required` |
| msg.err.bl_required | Enter the BL number. | BL નંબર લખો. | BL number lakho | yes | DB `bl_required` |
| msg.err.role_not_allowed | Only the owner can do this. | આ ફક્ત માલિક કરી શકે. | aa fakt maalik kari shake | yes | DB `role_not_allowed` (SQLSTATE 42501 with this message) |
| msg.saved | Saved | સેવ થયું | save thayu | yes | Toast, green tick, auto-hide 2 s |
| msg.saved_code | {code} saved | {code} સેવ થયું | ... | yes | After new inquiry / sample / quote |
| msg.sent | Sent | મોકલ્યું | mokalyu | yes | After Mark sent |
| msg.order_created | Order {order_code} made. PI {pi_no}. | ઓર્ડર {order_code} બની ગયો. PI {pi_no}. | order bani gayo | yes | After Buyer accepted |
| msg.payment_saved | {amount} received. Receipt {receipt_no}. | {amount} આવ્યા. રસીદ {receipt_no}. | aavya. rasid | yes | After Money received |
| msg.dispatched | Dispatched. Invoice {invoice_no}. | રવાના થયું. ઇન્વોઇસ {invoice_no}. | ravana thayu | yes | After Dispatch |
| msg.below_floor | Rate is below the floor price ({floor}). Only the owner can save this. | ભાવ ઓછામાં ઓછા ભાવ ({floor}) થી નીચે છે. ફક્ત માલિક સેવ કરી શકે. | bhaav ochha ma ochha bhaav thi niche chhe. fakt maalik save kari shake. | yes | Quote form, red helper + DB `below_floor_price` |
| msg.below_floor_owner | Below floor price ({floor}). Saving as owner. | ઓછામાં ઓછા ભાવ ({floor}) થી નીચે. માલિક તરીકે સેવ થશે. | ... | yes | Quote form when role = owner |
| msg.advance_not_received | Advance not received yet. Start anyway? | એડવાન્સ હજુ આવ્યો નથી. તો પણ શરૂ કરવું? | ... | yes | Confirm before Packing started |
| msg.confirm_lost | Mark this inquiry as lost? | આ પૂછપરછ ગુમાવી ગણવી? | ... | yes | Confirm |
| msg.confirm_cancel_order | Cancel this order? This cannot be undone. | આ ઓર્ડર રદ કરવો? પાછું નહીં થાય. | ... | yes | Confirm |
| msg.confirm_delete_quote | Delete this draft? | આ કાચું ભાવપત્ર કાઢી નાખવું? | ... | yes | Confirm |
| msg.over_payment | This is more than the amount due ({due}). Save anyway? | બાકી રકમ ({due}) કરતાં વધારે છે. તો પણ સેવ કરવું? | ... | yes | Money received confirm |
| msg.qty_exceeds | More than the ordered quantity. | ઓર્ડર કરતાં વધારે જથ્થો છે. | ... | yes | Dispatch form |
| msg.access_denied_title | Not for you | આ તમારા માટે નથી | aa tamara mate nathi | yes | /access-denied |
| msg.access_denied_desc | Ask the owner to open this for you. | માલિકને કહો, તે ખોલી આપશે. | maalik ne kaho, te kholi aapshe | yes | /access-denied |
| msg.account_inactive_title | Login switched off | લોગિન બંધ છે | login bandh chhe | yes | /account-inactive |
| msg.account_inactive_desc | Your login is switched off. Ask the owner. | તમારું લોગિન બંધ છે. માલિકને પૂછો. | tamaru login bandh chhe. maalik ne puchho. | yes | /account-inactive |
| msg.login_error | Wrong email or password. Try again. | ઈમેલ કે પાસવર્ડ ખોટો છે. ફરી કરો. | email ke password khoto chhe. fari karo. | yes | /login |
| msg.buyer_needed | First save the buyer (name + phone), then continue. | પહેલાં ગ્રાહક સેવ કરો (નામ + ફોન), પછી આગળ વધો. | ... | yes | Send sample / Make quote from an inquiry without a buyer |
| msg.whatsapp_no_phone | No phone number. Add one to the buyer. | ફોન નંબર નથી. ગ્રાહકમાં ઉમેરો. | ... | yes | PhoneActions disabled hint |

## 12. Rewritten copy for existing screens (replaces every string in product-gap-analysis section 3)

| Old string (file:line) | New key | New English | New Gujarati |
|---|---|---|---|
| 'Active Tenant' + org code (page.tsx:36) | app.company_short + date | {company} — 06 Nov 2026 | (same; date format is not translated) |
| 'Welcome back, ... RLS ... enforced.' (page.tsx:46) | home.greeting + home.today_line | Namaste, Hareshbhai / Today: 3 new inquiries, 2 quotes waiting, ₹4,50,000 to collect | નમસ્તે, Hareshbhai / આજે: ... |
| 'Database Engine / Postgres RLS Active / Tenant ID' (page.tsx:73-85) | kpi.new_inquiries | New inquiries | નવી પૂછપરછ |
| 'Access Entitlements / Role Preset / Rule 5' (page.tsx:92-104) | kpi.quotes_waiting | Quotes waiting | જવાબ બાકી ભાવપત્ર |
| 'Factory Identity' GSTIN/IEC (page.tsx:111-123) | kpi.orders_in_production, kpi.money_due | Orders in production / Money due | ઓર્ડર બની રહ્યા / બાકી પૈસા |
| 'System Module Registry (Phase 1)' Granted/Locked (page.tsx:131-156) | btn.new_inquiry, btn.new_quote, btn.money_received, kpi.todo_today | New Inquiry / New Quote / Money Received / To do today | નવી પૂછપરછ / નવું ભાવપત્ર / પૈસા આવ્યા / આજનું કામ |
| 'MULTI-TENANT LIVE' badge (header.tsx:12) | (deleted) | — | — |
| 'Modules' heading (sidebar.tsx:69) | nav.menu | Menu | મેનુ |
| 'DEHYDRATION CRM' subtitle (sidebar.tsx:60-61) | app.company_short | Mahuva Dehydro Foods | (not translated) |
| raw role 'operations' (sidebar.tsx:101, user-nav.tsx:25) | role.* | Plant | પ્લાન્ટ |
| 'Receivables' (labels.ts:98) | nav.money | Money | પૈસા |
| 'Document Register' (labels.ts:84) | nav.papers (hidden) | Papers | કાગળો |
| 'Reports' description (labels.ts:85,101) | nav.reports (hidden) | Reports | રિપોર્ટ |
| 'Activity Log' (labels.ts:88,104) | nav.history (hidden) | History | કોણે શું બદલ્યું |
| Module descriptions (labels.ts:76-87) | module.* | see section 2 | see section 2 |
| 'Sign In to Your Workspace' (labels.ts:111) | login.title | Welcome | નમસ્તે |
| 'Enter your work credentials to access your tenant dashboard' (labels.ts:112) | login.subtitle | Enter your email and password | ઈમેલ અને પાસવર્ડ લખો |
| 'Verifying credentials...' (labels.ts:116) | login.wait | Please wait... | થોભો... |
| 'Email Address' / 'Password' (labels.ts:113-114) | field.login.email / field.login.password | Email / Password | ઈમેલ / પાસવર્ડ |
| 'Invalid email or password. Please try again.' (labels.ts:117) | msg.login_error | Wrong email or password. Try again. | ઈમેલ કે પાસવર્ડ ખોટો છે. ફરી કરો. |
| 'Your account has been deactivated by the organization admin.' (labels.ts:118) + 'Account Deactivated' (account-inactive:13) | msg.account_inactive_desc / msg.account_inactive_title | Your login is switched off. Ask the owner. / Login switched off | તમારું લોગિન બંધ છે. માલિકને પૂછો. / લોગિન બંધ છે |
| 'Sign In with Another Account' (account-inactive) | btn.sign_in | Sign in | લોગિન |
| 'Access Restricted' / 'You do not have permission...' (labels.ts:119-120) | msg.access_denied_title / msg.access_denied_desc | Not for you / Ask the owner to open this for you. | આ તમારા માટે નથી / માલિકને કહો, તે ખોલી આપશે. |
| 'Return to Home' (access-denied) | btn.go_home | Go Home | હોમ પર જાઓ |
| 'Search by code, buyer name, or reference...' (labels.ts:124) | common.search_placeholder | Search name or phone | નામ કે ફોન શોધો |
| 'No records found' / 'Get started by creating a new entry or adjusting your filters.' (labels.ts:134-135) | msg.empty.generic | Nothing here yet. Tap + to add. | હજુ કંઈ નથી. + દબાવો. |
| 'Something went wrong' / 'Unable to load records. Please retry or contact technical support.' (labels.ts:136-137) | msg.error.load | Could not load. Tap to try again. | ખુલ્યું નહીં. ફરી દબાવો. |
| 'Save Changes' / 'Go Back' / 'Create New' (labels.ts:126-131) | btn.save / btn.back / btn.new_* | Save / Back / New ... | સેવ કરો / પાછા / નવી ... |
| 'Users & Module Permissions' (labels.ts:144) | title.staff | Staff | સ્ટાફ |
| 'Manage team access, roles, and fine-tune module entitlements per user.' (labels.ts:145) | title.staff_access | Who can see what | કોણ શું જોઈ શકે |
| 'Add Team Member' (labels.ts:146) | (removed in demo; users are seeded) | — | — |
| 'Role Preset' (labels.ts:149) | field.staff.job | Job | કામ |
| 'Assigned Modules' (labels.ts:150) | field.staff.can_see | Can see {n} things | {n} વસ્તુ જોઈ શકે |
| 'Status' / 'Active' / 'Inactive' (labels.ts:151-153) | field.staff.login + status.staff.* | Login: On / Off | લોગિન: ચાલુ / બંધ |
| 'Edit Modules' (labels.ts:154) | btn.change_access | Change what they can see | શું જોઈ શકે તે બદલો |
| 'Configure Access Permissions' (labels.ts:155) | title.staff_access | Who can see what | કોણ શું જોઈ શકે |
| 'Save Permissions' (labels.ts:156) | btn.save | Save | સેવ કરો |
| 'Preset Role Archetype' (user-table.tsx:165) | section.job | Job | કામ |
| 'Selecting a preset will populate recommended modules, which you can customize below.' (user-table.tsx:184) | (deleted) | — | — |
| 'Granular Module Entitlements (7 of 13)' (user-table.tsx:191) | btn.change_details + section.can_see | Change details / Can see | વિગત બદલો / જોઈ શકે |
| raw module keys chips (user-table.tsx:93-99) | field.staff.can_see + module.* | Can see 7 things | 7 વસ્તુ જોઈ શકે |
| 'Deactivate' / 'Activate' (user-table.tsx:125) | btn.switch_off / btn.switch_on | Switch off / Switch on | બંધ કરો / ચાલુ કરો |
| 'Failed to update permissions.' / 'Failed to toggle status.' (user-table.tsx:49,62) | msg.error.save | Could not save. Try again. | સેવ થયું નહીં. ફરી કરો. |
| 'Organization Settings' (labels.ts:159) | title.company | My Company | મારી કંપની |
| 'Company legal registration, GSTIN, IEC, bank details, and financial parameters.' (labels.ts:160) | (deleted) | — | — |
| 'Business Identity' tab (labels.ts:161) | section.company_card | Company | કંપની |
| 'Tax & Bank Details' tab (labels.ts:162) | section.bank_card | Bank | બેંક |
| 'Doc Counters & Defaults' tab (labels.ts:163) | (deleted; counters are not user-facing) | — | — |
| 'Trade / Brand Name' (labels.ts:165) | field.company.trade_name | Brand name | બ્રાન્ડ નામ |
| 'GSTIN' (labels.ts:166) | field.company.gstin | GST number | GST નંબર |
| 'Import Export Code (IEC)' (labels.ts:167) | field.company.iec | IEC (export code) | IEC (એક્સપોર્ટ કોડ) |
| 'PAN Number' (labels.ts:168) | field.company.pan | PAN | PAN |
| 'FSSAI License No.' (labels.ts:169) | field.company.fssai | FSSAI number | FSSAI નંબર |
| 'Factory / Registered Address' (labels.ts:170) | field.company.address | Address | સરનામું |
| 'Bank Name' / 'Account Number' / 'IFSC Code' / 'Branch Name' (labels.ts:175-178) | field.company.bank_name / account_no / ifsc / branch | Bank / Account number / IFSC / Branch | બેંક / ખાતા નંબર / IFSC / બ્રાન્ચ |
| 'SWIFT Code (for Export)' (labels.ts:179) | field.company.swift | SWIFT (for export) | SWIFT (એક્સપોર્ટ માટે) |
| 'Authorized Signatory' (labels.ts:180) | field.company.signatory | Who signs papers | કાગળ પર સહી કોણ કરે |
| 'Official Email' / 'Official Phone' (labels.ts:181-182) | field.company.email / field.company.phone | Email / Phone | ઈમેલ / ફોન |
| 'Organization settings saved and synchronized successfully.' (settings-form.tsx:98) | msg.saved | Saved | સેવ થયું |
| 'Failed to save settings.' (settings-form.tsx:87) | msg.error.save | Could not save. Try again. | સેવ થયું નહીં. ફરી કરો. |
| 'Demo Credentials (Stage 0)' (login:114) | btn.try_as | Try as: | આ તરીકે ખોલો: |
| 'Owner (Admin) / All 13 modules' (login:124) | role.owner | Owner | માલિક |
| 'Accountant / Finance & costs' (login:132) | role.accountant | Accounts | હિસાબ |
| 'Sales Lead / Quotes & orders' (login:140) | role.sales | Sales | સેલ્સ |
| 'Operations / Fulfillment' (login:148) | role.operations | Plant | પ્લાન્ટ |
| 'Dehydrated Onion Processing & Export Management' (labels.ts:109) | app.tagline | Your whole business on one screen | આખો ધંધો એક સ્ક્રીન પર |

## 13. WhatsApp message templates

Keys live under `wa.*`. Designer 1's template ids map as: T1 = wa.inquiry_reply, T2 = wa.quote_share, T3 = wa.sample_sent, T4 = wa.pi_share, T5 = wa.dispatched, T6 = wa.payment_reminder, T7 = wa.checklist_status, T8 = wa.receipt. Language rule: if the buyer's country is not India the English template is always used; for Indian buyers the template follows the current UI language. Placeholders are filled by the server action before `encodeURIComponent`. `{company}` = business_settings.trade_name or company_name; `{sender}` = first name of the logged-in user. Values keep their formatting (₹1,25,000; $2,250/MT; 06 Nov 2026).

| key | Placeholders | English | Gujarati |
|---|---|---|---|
| wa.inquiry_reply | buyer, product, qty, sender, company | Namaste {buyer}, thank you for your inquiry for {product}, {qty}. We will send the rate and a sample today. - {sender}, {company} | નમસ્તે {buyer}, {product}, {qty} ની પૂછપરછ બદલ આભાર. આજે ભાવ અને સેમ્પલ મોકલીએ છીએ. - {sender}, {company} |
| wa.quote_share | buyer, product, rate, unit, basis, qty, amount, quote_no, valid_till, terms, sender, company | Namaste {buyer}, our quotation {quote_no} for {product}, {qty}: {rate} per {unit} {basis}. Payment: {terms}. Valid till {valid_till}. Total {amount}. PDF attached. - {sender}, {company} | નમસ્તે {buyer}, {product}, {qty} માટે ભાવપત્ર {quote_no}: {rate} પ્રતિ {unit} {basis}. પેમેન્ટ: {terms}. {valid_till} સુધી માન્ય. કુલ {amount}. PDF સાથે છે. - {sender}, {company} |
| wa.payment_reminder | buyer, amount, order_code, invoice_no, due_date, company | Namaste {buyer}, a gentle reminder: {amount} is due for order {order_code} (invoice {invoice_no}) since {due_date}. Please send it today. Thank you. - {company} | નમસ્તે {buyer}, યાદ અપાવવા માટે: ઓર્ડર {order_code} (ઇન્વોઇસ {invoice_no}) ના {amount} {due_date} થી બાકી છે. આજે મોકલશો. આભાર. - {company} |
| wa.sample_sent | buyer, product, grams, courier, tracking_no, sender, company | Namaste {buyer}, your sample of {product} ({grams} g) was sent today by {courier}, tracking {tracking_no}. Please check it and reply. - {sender}, {company} | નમસ્તે {buyer}, {product} નું સેમ્પલ ({grams} ગ્રામ) આજે {courier} થી મોકલ્યું છે, ટ્રેકિંગ {tracking_no}. જોઈને જવાબ આપશો. - {sender}, {company} |
| wa.pi_share | buyer, order_code, pi_no, amount, advance, company | Namaste {buyer}, order {order_code} is confirmed. Proforma invoice {pi_no}, total {amount}, advance {advance}. Bank details are on the PI. - {company} | નમસ્તે {buyer}, ઓર્ડર {order_code} પાક્કો થયો. PI {pi_no}, કુલ {amount}, એડવાન્સ {advance}. બેંક વિગત PI પર છે. - {company} |
| wa.dispatched | buyer, order_code, invoice_no, vehicle_or_container, qty, company | Namaste {buyer}, order {order_code} was dispatched today. Invoice {invoice_no}, {vehicle_or_container}, {qty}. - {company} | નમસ્તે {buyer}, ઓર્ડર {order_code} આજે રવાના થયો. ઇન્વોઇસ {invoice_no}, {vehicle_or_container}, {qty}. - {company} |
| wa.checklist_status | order_code, container_no, done_list, pending_list, eta, sender, company | Order {order_code}, container {container_no}: done - {done_list}; pending - {pending_list}. ETA {eta}. - {sender}, {company} | ઓર્ડર {order_code}, કન્ટેનર {container_no}: થયું - {done_list}; બાકી - {pending_list}. ETA {eta}. - {sender}, {company} |
| wa.receipt | buyer, amount, receipt_no, order_code, due, company | Namaste {buyer}, received {amount} for order {order_code}. Receipt {receipt_no}. Balance due {due}. Thank you. - {company} | નમસ્તે {buyer}, ઓર્ડર {order_code} ના {amount} મળ્યા. રસીદ {receipt_no}. બાકી {due}. આભાર. - {company} |

If a placeholder value is empty (no invoice yet, no tracking number) the server action drops the clause containing it; it never sends "{tracking_no}" literally.

## 14. Printed papers (never translated)

Doc titles and table headers on `/quotes/[id]/print` and `/orders/[id]/print` are English constants in `src/components/print/` and are not keys in LABELS: QUOTATION, PROFORMA INVOICE, TAX INVOICE (India) / COMMERCIAL INVOICE (export), DISPATCH NOTE, RECEIPT, Sr, Product, Packing, Qty, Rate, Amount, Subtotal, GST, Total, Amount in words, Payment terms, Price basis, Valid till, Bank, A/c no, IFSC, SWIFT, For {company}, Authorised signatory.
