# Mahuva CRM

A simple phone-friendly book for an onion drying plant in Mahuva: inquiries, buyers, samples,
quotes, orders, dispatch and money in one place. This copy is a demo with made-up data and 4 demo logins.

## Run the demo in 5 commands

You need: a computer with Node 18 or newer (`node -v`) and a free hosted Supabase project.
Making the Supabase project takes 5 minutes, once: follow
[docs/setup/hosted-supabase.md](docs/setup/hosted-supabase.md) steps 1 and 2.

Run these in the project folder, one by one:

```bash
npm install
cp .env.example .env.local
npm run db:seed
npm run build
npm start
```

Between `cp` and `npm run db:seed`, open `.env.local` in a text editor and fill in:

| Line in `.env.local` | What to put |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase `anon` (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` key (secret, never share it) |
| `DATABASE_URL` | Supabase database connection string |
| `DEMO_MODE` | `true` (shows the **Try as** buttons on the login page) |
| `DEMO_PASSWORD` | a password you choose for the 4 demo logins (at least 8 characters) |

The setup guide shows where each Supabase value is in the dashboard. Copy and paste them; do
not type keys by hand.

- `npm run db:seed` makes the 4 demo logins and loads the demo data. It ends with `Seed completed.`
  Safe to run again: it resets the demo story to day one. Everything added to the demo company
  (MDPL) during a demo is deleted and the numbers start again at INQ-0011, QTN-2627-0005, ORD-0004.
- `npm start` keeps running. Leave that window open; press Ctrl+C to stop the app.

Then open **http://localhost:3000** on the same computer and tap one of the **Try as** buttons.

## Demo logins

The password for all four is the `DEMO_PASSWORD` you set. With `DEMO_MODE=true` you do not
need to type it: tap **Try as** on the login page.

| Job | Email | What they see |
|---|---|---|
| Owner (Hareshbhai) | `admin@mahuvacrm.com` | Everything: inquiries, buyers, samples, quotes, orders, money, products with cost, staff, company settings |
| Accounts (Nileshbhai) | `accountant@mahuvacrm.com` | Money received and due, orders, quotes, buyers, products with cost |
| Sales (Pooja) | `sales@mahuvacrm.com` | Inquiries, buyers, samples, quotes, orders; no costs, no money screen |
| Plant (Dineshbhai) | `ops@mahuvacrm.com` | Orders to pack and dispatch, samples, buyers to read; no money |

What to show, minute by minute: [docs/design/demo-script.md](docs/design/demo-script.md).
Before a real client uses it: section 6 of [docs/setup/hosted-supabase.md](docs/setup/hosted-supabase.md)
(`DEMO_MODE=false`, change the passwords).

## Local database only (tests)

For developers and checks. There is no web login in this mode (no Supabase), only the database,
the tests and the tenant check. Needs Node 18+ and Docker.

```bash
docker compose up -d
npm run db:seed:sql
npm test
npm run ci:tenant-check
```

- `docker compose up -d` starts Postgres 17 from `docker-compose.yml` (container `mahua-crm-postgres`,
  port 5432). On machines with the older tool, type `docker-compose up -d`. If a Postgres is
  already running on port 5432 (for example the sibling project's `onion-crm-postgres`), skip
  this command and use that one.
- `.env.local` (no file yet? `cp .env.example .env.local`) needs only `DATABASE_URL`; the value in `.env.example`
  (`postgresql://postgres:postgres@127.0.0.1:5432/onion_crm`) fits both containers. Leave the
  Supabase lines as placeholders: `npm run db:seed:sql` does not need them.
- To run a second Postgres next to the sibling one: `PG_PORT=5433 docker compose up -d` and
  `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/onion_crm`.
- Migration `0000_auth_shim.sql` makes a small `auth.users` table so the schema, seed and tests
  run on plain Postgres. On Supabase it does nothing.

Other developer commands: `npm run dev` (app with live reload on http://localhost:3000),
`npm run typecheck`, `npm run lint`, `npm run build`.

---

## Tech Stack & Architecture

- **Framework**: Next.js 14 (App Router, strict TypeScript)
- **Database & Auth**: PostgreSQL with Row Level Security (RLS) & `@supabase/ssr` cookie sessions
- **Validation**: Zod (strict server action input schemas)
- **Styling**: Tailwind CSS & Lucide Icons
- **Testing**: Vitest for multi-tenant SQL isolation & unit tests
- **Pattern**: Database does the heavy lifting via Views, Functions, and Triggers; Web app is a thin, role-aware client.

---

## 3-Wall Security Architecture

1. **Database Wall**:
   - Every business table enforces `org_id NOT NULL` and `FORCE ROW LEVEL SECURITY`.
   - Tenant isolation policy: `org_id = fn_current_org()`.
   - Money-moving and state-changing SQL functions invoke `fn_require_module('module_key')`.
   - Product cost data (`product_costs`, `v_product_costs`) is restricted by RLS to `owner` and `accountant` only (Rule 5).
2. **Server Wall**:
   - React Server Components invoke `await requireModule('module_key')`.
   - Server Actions validate session and evaluate `hasModule(profile, 'module_key')`.
3. **Menu Wall**:
   - Navigation sidebar dynamically renders strictly the modules assigned to the user profile (`lib/labels.ts`).

---

## Project layout (database side)

| Path | Purpose |
|---|---|
| `supabase/migrations/` | numbered SQL files (`0000_auth_shim.sql` ...), applied in filename order; every file is safe to re-run |
| `supabase/migrations/0000_auth_shim.sql` | `auth.users` / `auth.identities` on plain Postgres; no-op on Supabase |
| `supabase/migrations/0001_core_system.sql` | organizations, profiles, settings, counters, audit, RLS helpers |
| `supabase/seed/` | demo data (`00_demo_reset.sql` deletes what a demo added to MDPL and its number counters; `01_core.sql` organisation, users, catalog, buyers; `02`-`04` inquiries, samples, quotes, orders, money); fixed ids, idempotent |
| `scripts/seed.ts` | `npm run db:seed:sql`: applies all migrations, then all seed files, in filename order |
| `scripts/seed-users.ts` | first half of `npm run db:seed`: creates the demo logins in Supabase Auth with `DEMO_PASSWORD` (never printed); skipped without Supabase keys |
| `scripts/db-url.ts` | the single `DATABASE_URL` resolver used by scripts and tests (an exported `DATABASE_URL` wins over `.env.local`) |
