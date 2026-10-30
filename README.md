# Mahuva CRM - B2B Dehydrated Onion Management System

Production multi-tenant B2B CRM designed specifically for dehydrated onion manufacturers, processors, and exporters in Mahuva, Gujarat, India.

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

## Quickstart & Local Setup

### 1. Prerequisites
- Node.js 18+ (tested on Node 20 / 24)
- PostgreSQL 15+ (local or Supabase)

### 2. Environment Configuration
Copy `.env.example` to `.env.local` and configure your database connection:

```bash
cp .env.example .env.local
```

Example `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/onion_crm
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run Database Migrations & Demo Seed
Applies schema migrations `0001` (Core multi-tenant) and `0002` (Catalog & Buyers), then seeds Mahuva Dehydration Pvt Ltd demo organization:

```bash
npm run db:seed
```

### 4. CI Tenant Check
Enforces that every table in the public schema has RLS enabled, `FORCE ROW LEVEL SECURITY`, `org_id NOT NULL`, an index on `(org_id)`, and policies referencing `fn_current_org()`:

```bash
npm run ci:tenant-check
```

### 5. Automated Tests
Runs the Vitest suite proving multi-tenant isolation, module permission walls, atomic entity codes, and FY document numbering:

```bash
npm test
```

### 6. Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Demo Users (Pre-seeded)

| Role | Email | Module Entitlements | Access Scope |
|------|-------|---------------------|--------------|
| **Owner (Admin)** | `admin@mahuvacrm.com` | All 13 modules | Full administrative, pricing, costs, users, settings |
| **Accountant** | `accountant@mahuvacrm.com` | Financial modules | Quotes, orders, receivables, payments, costs, reports |
| **Sales** | `sales@mahuvacrm.com` | Commercial pipeline | Leads, buyers, quotes, orders (Cost data locked) |
| **Operations** | `ops@mahuvacrm.com` | Fulfillment | Buyers, samples, orders, catalog, dispatches |
