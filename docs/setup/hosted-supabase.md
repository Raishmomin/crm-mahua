# Hosted Supabase: what to do when the credentials arrive

The demo runs on a free hosted Supabase project. Until the credentials exist, SQL and
Vitest run against the local plain Postgres (see README, "Local database only"). This page
is the exact checklist for the hosted path. Every step is one command or one copy-paste.
The short version is in the README: "Run the demo in 5 commands".

## 1. Create the project (once)

1. Sign in at https://supabase.com/dashboard and click **New project**.
2. Name: `mahuva-crm-demo`. Region: **Mumbai (ap-south-1)**. Choose a strong database
   password and keep it: it is part of `DATABASE_URL` below.
3. Wait until the project status is "Healthy" (about 2 minutes).

## 2. Copy the 4 values into `.env.local`

First make the file: `cp .env.example .env.local`. Then in the dashboard open
**Project Settings > API** and **Connect** (top bar).

| `.env.local` key | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings > API > Project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings > API Keys > **Legacy API keys** tab > `anon` `public` key (a long `eyJ...` value) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings > API Keys > **Legacy API keys** tab > `service_role` key (server only, never in the browser) |
| `DATABASE_URL` | Connect (top bar) > **Direct** tab > Type **URI** > Method **Session pooler** (port 5432). Replace `[YOUR-PASSWORD]` with the database password, without the brackets. Do not use **Transaction pooler** (port 6543): the seed and checks need one session. |

Then set the two demo lines (contracts A11; both are server-only, never `NEXT_PUBLIC_`):

| `.env.local` key | Value |
|---|---|
| `DEMO_MODE` | `true`: the login page shows the **Try as** buttons |
| `DEMO_PASSWORD` | a password you choose for the 4 demo logins (at least 8 characters). `npm run db:seed` gives it to the 4 users; the **Try as** buttons sign in with it on the server. It never reaches the browser and the seed never prints it. |

Also keep `NEXT_PUBLIC_APP_URL=http://localhost:3000`.

Paste the values exactly as shown in the dashboard; never retype a key by hand.
`.env.local` is git-ignored (check with `git ls-files | grep env`).

## 3. Create schema, demo logins and demo data

```bash
npm run db:seed
```

What it does, in order:

1. `scripts/seed-users.ts` creates the 4 demo logins in Supabase Auth with fixed ids
   (`auth.admin.createUser`, email confirmed, password = your `DEMO_PASSWORD`). Existing
   users are kept and their password is set to `DEMO_PASSWORD` again. It prints
   `Demo users ready. Password for all four: the DEMO_PASSWORD you set (not printed).`
   If `DEMO_PASSWORD` is empty it falls back to the local demo default and says so: set it
   and run `npm run db:seed` again.
2. `scripts/seed.ts` applies `supabase/migrations/*.sql` in order (0000 is a no-op on
   Supabase, 0001 skips `auth.uid()` because it already exists) and then
   `supabase/seed/*.sql`.

Expected output ends with `Seed completed.`

## 4. Run and log in

```bash
npm run build
npm start
```

(`npm run dev` also works while you change code; it is slower on the first page.)

Open http://localhost:3000 and tap one of the **Try as** buttons, or type an email and the
`DEMO_PASSWORD` you set:

| Job | Email |
|---|---|
| Owner | admin@mahuvacrm.com |
| Accounts | accountant@mahuvacrm.com |
| Sales | sales@mahuvacrm.com |
| Plant | ops@mahuvacrm.com |

After changing `.env.local`, stop the app (Ctrl+C) and run `npm run build` and `npm start` again.

Then run the checks against the hosted database:

```bash
npm test
npm run ci:tenant-check
```

## 5. Re-seed (reset the demo story)

```bash
npm run db:seed
```

Safe to repeat, and it resets the demo story to day one. Migrations use `IF NOT EXISTS` /
`CREATE OR REPLACE`. The first seed file, `supabase/seed/00_demo_reset.sql`, deletes every
row a demo added to the demo company MDPL (inquiries, samples, quotes, orders, dispatches,
receipts, reminders, new buyers) and its number counters; the other seed files then put the
seeded rows back with fixed ids (`ON CONFLICT ... DO UPDATE`) and set the counters again, so
the next numbers are INQ-0011, SMP-0004, QTN-2627-0005, ORD-0004 and REC-2627-0005 every time.
Only MDPL is touched: logins, products, prices and the audit trail stay. Do not run it on a
project with real client data in MDPL.

## 6. Before giving this to a real client

1. Rotate the demo passwords: dashboard > **Authentication > Users** > open each
   `@mahuvacrm.com` user > **Reset password** and set a strong one. Do not run
   `npm run db:seed` after that on the client project: it would set the password back
   to `DEMO_PASSWORD`. For a real client, better: delete the four demo users and create
   the client's staff from **Authentication > Users > Invite user**, then insert their
   `profiles` rows (same id as the auth user) with the right `role` and `modules`.
2. Set `DEMO_MODE=false` and remove the `DEMO_PASSWORD` line, so the **Try as** buttons
   disappear and the server holds no shared password. Then `npm run build` and `npm start` again.
3. Replace the demo organisation data: edit `supabase/seed/01_core.sql` or change
   company details on the **My Company** screen; delete seed inquiries/orders.
4. Rotate the `service_role` key if it was ever shared (Project Settings > API).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot reach Supabase Auth` | URL or service role key wrong; copy again from Project Settings > API. |
| `already exists in Supabase Auth with id ...` | A demo email was created by hand with a random id. Delete that user in Authentication > Users, run `npm run db:seed` again. |
| `password authentication failed` from `scripts/seed.ts` | `DATABASE_URL` password is the database password, not an API key. |
| `ENETUNREACH` / IPv6 error from `scripts/seed.ts` | Use the Session pooler connection string (port 5432) instead of the direct one. |
| Login says the email or password is wrong | Check that `DEMO_PASSWORD` in `.env.local` is the one you seeded with, run `npm run db:seed` once more (it sets the demo password again), then `npm run build` and `npm start` again. |
| No **Try as** buttons on the login page | `DEMO_MODE=true` is missing in `.env.local`; add it, then `npm run build` and `npm start` again. |
