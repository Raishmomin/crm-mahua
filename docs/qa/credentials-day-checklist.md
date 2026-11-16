# Credentials day: what to do when the hosted Supabase keys arrive

Written by QA at gate 3 (16 Nov 2026). Do the steps in order. Each step says what to type, what you
should see, and what to do if you see something else. Tick each box as you go. Put every screenshot
in `docs/qa/screenshots/credentials-day/` with the file name given.

You need: the laptop with this project folder, Node 18 or newer (`node -v`), the Android phone used
for the demo, both on the same Wi-Fi, and the Supabase login.

Never paste a key into chat, a ticket or a screenshot. Never commit `.env.local`.

---

## Part A. Make the Supabase project (about 10 minutes, once)

- [ ] **A1.** Go to https://supabase.com/dashboard and click **New project**.
  Name `mahuva-crm-demo`, region **Mumbai (ap-south-1)**. Choose a strong database password and
  write it down on paper. Wait until the project says **Healthy** (about 2 minutes).
- [ ] **A2.** In the project folder: `cp .env.example .env.local` (skip this if `.env.local` already
  exists; then edit the lines below instead).
- [ ] **A3.** Open `.env.local` in a text editor and set these lines. Copy and paste every value; never type a key by hand.

  | Line | Where to copy it from |
  |---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings > API > **Project URL** (`https://<ref>.supabase.co`) |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings > API > **anon public** key |
  | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings > API > **service_role** key (secret) |
  | `DATABASE_URL` | top bar **Connect** > **Direct connection**. If the seed later says `ENETUNREACH` or IPv6, use **Session pooler** (port 5432) instead. Replace `[YOUR-PASSWORD]` with the A1 password. |
  | `DEMO_MODE` | `true` |
  | `DEMO_PASSWORD` | a new password for the 4 demo logins, at least 8 characters. Do NOT use `DemoPass123!`: that one is written in the code. |

  Also delete the old line `NEXT_PUBLIC_DEMO_MODE=...` if it is still there (it does nothing now).
- [ ] **A4.** Check that `.env.local` is not tracked: `git ls-files | grep env` must print only
  `.env.example`.

## Part B. Load the database (about 3 minutes)

- [ ] **B1.** `npm install` (only the first time on this laptop).
- [ ] **B2.** `npm run db:seed`

  You should see, in this order:
  - 4 lines `ok   admin@mahuvacrm.com created` (then accountant, sales, ops)
  - `Demo users ready. Password for all four: the DEMO_PASSWORD you set (not printed).`
  - `Applying 8 migration(s)...` with 8 `ok` lines (0000 to 0007)
  - `Applying 4 seed file(s)...` with 4 `ok` lines (01 to 04)
  - last line `Seed completed.`

  If you see something else:
  - `Skipping auth users (no Supabase keys)`: the URL or service_role line in `.env.local` still has the placeholder. Fix A3, run again.
  - `DEMO_PASSWORD is not set, so the local demo default was used`: fix the `DEMO_PASSWORD` line, run again.
  - `password authentication failed`: the password inside `DATABASE_URL` is wrong (it is the A1 database password, not an API key).
  - `already exists in Supabase Auth with id ...`: delete that user in Authentication > Users, run again.
  - any other red error: stop, copy the full output (no keys in it) and send it to the developers.
- [ ] **B3.** Run `npm run db:seed` a second time. It must end with `Seed completed.` again, with no error.
- [ ] **B4.** Security check of the database owner. In the dashboard open **SQL Editor**, paste and run:

  ```sql
  SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user;
  ```

  You must see `postgres | true`. If `rolbypassrls` is `false`: stop. Recording money, sending a
  quote and Plant's "Loaded" will fail or show wrong "Wait for advance". Tell security before the demo.
- [ ] **B5.** `npm run ci:tenant-check`
  The first line must name the Supabase host (not `127.0.0.1`). The last line must start with
  `✅ CI Tenant Check PASSED`. If it fails, do not run the demo: send the full output to security.
  (If it lists `pgp_...` or `crypt` functions, the pgcrypto extension sits in the `public` schema:
  security must decide.)
- [ ] **B6.** Day-one numbers. In **SQL Editor** run:

  ```sql
  SELECT (SELECT count(*) FROM inquiries) inquiries, (SELECT count(*) FROM orders) orders,
         (SELECT count(*) FROM payments) payments, (SELECT count(*) FROM follow_ups) follow_ups,
         (SELECT current_val FROM entity_code_counters WHERE prefix = 'INQ') inq_counter;
  ```

  Expect `10 | 3 | 4 | 14 | 10`. If the counts are bigger, someone already used the project: do Part F (reset) now.
- [ ] **B7.** Optional: `npm test` against the hosted database. It adds and removes its own test
  companies and users. Expect `Tests 111 passed`. A failure that mentions `auth.users` permission is
  not a demo blocker; note it and go on. If you run it, repeat B6 afterwards.

## Part C. Start the app and reach it from the phone

- [ ] **C1.** `npm run build` (ends with a route list and no error), then `npm start`. Leave this
  window open. Run the build again every time you change `.env.local`.
- [ ] **C2.** On the laptop open http://localhost:3000. You see the login page with **Try as:** and
  four buttons Owner / Accounts / Sales / Plant. Screenshot `01-login-laptop.png`.
- [ ] **C3.** Find the laptop's Wi-Fi address (Windows: `ipconfig`, "IPv4 Address"; Mac/Linux:
  `hostname -I` or System Settings > Wi-Fi). On the phone open `http://<that address>:3000`
  (for example `http://192.168.1.20:3000`). `localhost` does not work on the phone. If the page does
  not open, allow Node through the laptop firewall. Screenshot on the phone `02-login-phone.png`.
- [ ] **C4.** On the phone tap **ગુજરાતી** and back to **English**. The page switches language each
  time. Screenshot in Gujarati `03-login-phone-gu.png`.

If any Try as button shows "No internet. Try again.", the app cannot reach Supabase: check the URL
and anon key lines, rebuild (C1), and that the laptop is online.

## Part D. Real login checks (not possible before today)

- [ ] **D1.** Typed login: on the laptop type `admin@mahuvacrm.com` and the `DEMO_PASSWORD`, tap
  **Sign in**. Home opens with "Namaste, Hareshbhai". Log out from the menu.
- [ ] **D2.** Wrong password: type a wrong password. A red message appears; you stay on the login page.
- [ ] **D3.** Each Try as button opens Home for that person. Note what each Home shows:

  | Button | Home must show | Must NOT show | Screenshot |
  |---|---|---|---|
  | Owner | 4 tiles: `2` New inquiries, `1` Quotes waiting, `1` Orders in production, Money due `₹5,11,875` + `$18,900`, "about ₹21,04,200", `1 late`; "To do today (5)" | - | `10-home-owner.png` |
  | Accounts | Money tile and **Money received** button | New inquiry button | `11-home-accounts.png` |
  | Sales | New inquiry and New quote buttons | Money tile, money buttons, product cost | `12-home-sales.png` |
  | Plant (switch to Gujarati) | "Packing today" card for ORD-0003 Haldiram | any Money tile, rupee or dollar amount | `13-home-plant-gu.png` |

  Known issue G3-03: Plant's "To do today" may still show "Balance $18,900 due". Screenshot it as `13b-plant-todo.png` if you see it.
- [ ] **D4.** Wrong-door test as Plant: type `http://<address>:3000/payments` in the phone address bar.
  You must land on the page "Not for you", not the money list. Screenshot `14-plant-payments-denied.png`.
- [ ] **D5.** Wrong-door test as Sales: open `/payments/new` and `/catalog`. Money page refused; Products
  shows no cost column (no lock with cost). Screenshot `15-sales-catalog.png`.
- [ ] **D6.** Anonymous API test (laptop terminal; put the real URL and anon key in place of the `<...>`; do not save this command anywhere):

  ```bash
  curl -s -X POST "<URL>/rest/v1/rpc/fn_order_advance_waiting" -H "apikey: <ANON_KEY>" \
       -H "Content-Type: application/json" -d '{"p_order_id":"99999999-9999-4999-8999-999999999903"}'
  curl -s "<URL>/rest/v1/payments?select=amount" -H "apikey: <ANON_KEY>"
  ```

  The first must answer with `permission denied` (code 42501). The second must answer `[]` or a
  permission error, never amounts. Anything else: stop and call security.

## Part E. Full rehearsal of the demo script (about 10 minutes)

Follow `docs/design/demo-script.md` minute by minute. Use the phone for Owner, Sales and Plant and the laptop for
Accounts. At each row below check what appears and take the screenshot.

| # | Who | Do | Must see | Screenshot |
|---|---|---|---|---|
| E1 | Owner | Try as Owner | Home as in D3 | `20-owner-home.png` |
| E2 | Owner | tap Money due tile | Al-Barakah `Late` $18,900; Haldiram `Waiting` ₹5,11,875; Everest `Paid` | `21-money-list.png` |
| E3 | Sales | Try as Sales > `+ New Inquiry`; buyer Al-Barakah, White Minced, 12 MT, 20 Dec 2026, WhatsApp > Save | "Saved" with **INQ-0011** (if it says INQ-0012 the database was not reset: Part F) | `22-inq-saved.png` |
| E4 | Sales | `Reply on WhatsApp`, come back | chip `Talking` | - |
| E5 | Sales | `Send sample`: 500 g, DHL, tracking `7788 3001 22` > `Save & mark sent` | **SMP-0004** `Sent`; chip `Sample sent`; a reminder 7 days later | `23-sample-sent.png` |
| E6 | Sales | `Make quote`: rate 2,100 | red "Below floor ... owner only"; cannot send | `24-below-floor.png` |
| E7 | Sales | rate back to 2,380, FOB Pipavav, 30% adv, 10 days > Save quote | **QTN-2627-0005** Draft, total $28,560 | - |
| E8 | Sales | Share on WhatsApp > Yes, mark sent | chip `Sent`; inquiry `Quoted` | - |
| E9 | Sales | `Buyer accepted` > `Looks right` | **ORD-0004**, `Confirmed`, stepper shows today's date under the first step, Advance due $8,568, `Advance waiting` | `25-order-confirmed.png` |
| E10 | Sales | `Print PI` | A4 PI-2627-0004 with bank and SWIFT | `26-pi.png` |
| E11 | Accounts (laptop) | Try as Accounts > Money > Money received; pick ORD-0004 | amount pre-filled **8,568** with "Full due $28,560" under it | `27-money-form.png` |
| E12 | Accounts | rupee value fills at ₹84.25; Bank; Save | big tick, **REC-2627-0005**, "Now due $19,992" | `28-money-saved.png` |
| E13 | Accounts | tap `See receipt`, then Print | receipt page and printable receipt REC-2627-0005 | `29-receipt.png`, `30-receipt-print.png` |
| E14 | Accounts | try a date tomorrow on a new receipt | "The date cannot be after today." (do not save) | `31-future-date.png` |
| E15 | Plant (phone, Gujarati) | Try as Plant | Packing today: ORD-0003 and ORD-0004; no money anywhere | `32-plant-home.png` |
| E16 | Plant | ORD-0004 > `Packing started` | chip In production; today's date beside the step | - |
| E17 | Plant | `Packed` > 480 > Save | chip Ready; "Packed 480 bags" | `33-plant-packed.png` |
| E18 | Accounts | ORD-0002 > Export papers > tick Certificate of Origin, today, Save | `8 of 8` green | `34-checklist-8of8.png` |
| E19 | Accounts | ORD-0002 > Money > `Remind on WhatsApp` | WhatsApp text with $18,900 and INV-2627-0002 | - |
| E20 | Owner | Try as Owner > Home | `2` new inquiries, `1` quotes waiting, **`2`** orders in production, USD due **$38,892**, To do today (5) | `35-owner-home-after.png` |
| E21 | Owner | Everest row > Done | row goes; "To do today (4)" | `36-todo-done.png` |
| E22 | Owner | More > Products | lock with cost ₹140.50 on White Minced | `37-products-cost.png` |
| E23 | Owner | More > Staff > Pooja | four job buttons, Login On / Off | `38-staff.png` |

Write down anything that looked wrong, the time, and the screenshot name.

## Part F. Reset before the real demo (always after a rehearsal)

`npm run db:seed` alone does NOT undo a rehearsal (QA finding G3-01): the rehearsal's order stays in production, the dollar due
stays higher and the next inquiry becomes INQ-0012. Until the developers fix it, do this:

- [ ] **F1.** Open `docs/qa/sprint-c/gate-3-evidence/demo-reset.sql`, copy all of it, paste into the
  dashboard **SQL Editor**, click **Run**. It only removes rows that the demo company made live and
  puts the number counters back. (QA tested it on a scratch copy: rehearsal, then this file, then
  seed gave the day-one numbers again.)
- [ ] **F2.** `npm run db:seed`, ends with `Seed completed.`
- [ ] **F3.** Run the B6 query again: `10 | 3 | 4 | 14 | 10`.
- [ ] **F4.** Try as Owner: Home shows `2 / 1 / 1 / ₹5,11,875 + $18,900 / 1 late / To do today (5)`.
  Screenshot `40-home-after-reset.png`.

## Part G. Before the demo starts

- [ ] Phone: Gujarati off (English), screen never sleeps, brightness up, WhatsApp installed.
- [ ] Laptop: `npm start` window open; the phone shows the login page.
- [ ] Part F done after the last rehearsal.

## Part H. After the demo (if the client keeps using it)

- [ ] Set `DEMO_MODE=false` and delete the `DEMO_PASSWORD` line; `npm run build` and `npm start`.
  The login page must show no Try as buttons.
- [ ] Change or delete the four demo users (Authentication > Users). Do not run `npm run db:seed` on
  a client project after that.
- [ ] Before zipping or copying this folder to anyone, delete `.next/cache` (an old build cache
  still holds the old demo password text).
