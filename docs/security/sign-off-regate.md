# Security sign-off — re-gate after the Sprint C fix round (Mahuva CRM)

Reviewer: security agent. Date: 2026-11-16. Repo `/home/raish/raish/mahua-crm`, branch `master`, working tree as left by dev1 and dev3 after the Sprint C fix round. No source file was edited. Written: this file, `docs/qa/sprint-c/security-regate.json`, and evidence under `docs/qa/sprint-c/security-regate-evidence/`. No git command that changes state was run. `.env.local` was not read or printed.

**Scope.** Only the security finding routed to this round is re-checked: **SEC3-03** (dev1). The same code and SQL checks were re-run, plus `npm run ci:tenant-check` and `npm test`. A new finding is reported only if it is blocker or high.

**Database.** Local Postgres `127.0.0.1:5432/onion_crm` (migrations 0000-0007 and seeds 00-04 as applied by the devs). No hosted Supabase.

**Impersonation.** Each role in its own `BEGIN … ROLLBACK`: `set_config('request.jwt.claim.sub' / 'request.jwt.claims', …, true)` then `SET LOCAL ROLE authenticated`, with the seeded MDPL users `22222222-…-22{1 owner, 2 accountant, 3 sales, 4 operations}`. `fn_user_role()` was checked for each.

## Verdict

**PASS. SEC3-03 is FIXED. No new blocker or high finding.**

| ID | Sev | Owner | Status | Proof in one line |
|---|---|---|---|---|
| SEC3-03 | major | dev1 | **fixed** | `buyers/page.tsx:40` `isPlant = profile.role === 'operations'`; `:43` `loadBuyerList(supabase, { withMoney: !isPlant })`; `:58` Plant sort is name only; `:128-141` fact2, red class and money pill are `undefined` for Plant. `queries.ts:42` reads `v_money_due` only when `withMoney`. SQL replay as Plant: 4 buyers, 0 `v_money_due` rows, page does not query it, every card has no amount and no pill. Owner/accountant/sales still see `Al-Barakah … $18,900 overdue` and `Haldiram … ₹5,11,875 due`. |

## How SEC3-03 was proved

1. **Code (static, in `sec3-03-recheck.cjs`).** Every line of `BuyersPage` that mentions money is either the `isPlant` line, the `withMoney: !isPlant` call, the sort branch after `if (isPlant) return …localeCompare`, or the guarded card block (`const due = isPlant ? undefined : …`, `fact2ClassName={!isPlant && …}`, `badge={isPlant ? undefined : <Status …/>}`). All 3 `formatMoney(` / `<Status ` uses sit inside that block. `ListCard` (`src/components/ui/list-card.tsx`) renders nothing for an undefined `fact2` or `badge`, so Plant gets title, place and Call/WhatsApp only.
2. **SQL as each role.** The script runs exactly what `loadBuyerList` runs (`buyers`, `v_money_due`) with the flag the page passes, and builds each card's fact2/pill the way the page does:

```
owner / accountant / sales: buyers=4, v_money_due rows=2, page reads v_money_due=true
   Al-Barakah Spice & Grain LLC | $18,900 | overdue
   Haldiram Snacks Private Limited | ₹5,11,875 | due
plant (operations): buyers=4, v_money_due rows (raw)=0, page reads v_money_due=false
   Al-Barakah Spice & Grain LLC | - | -     (all 4 cards: no amount, no pill)
SEC3-03 RECHECK OK
```

3. **Typecheck** `tsc --noEmit` exit 0.

Limit: there is still no working web login for a live Plant browser session, so the rendered HTML was not captured. The proof is code + SQL replay + typecheck (dev1 also reports `next build` exit 0 with `/buyers` built).

## Checks run

| # | Check | Result | Output tail |
|---|---|---|---|
| 1 | `node docs/qa/sprint-c/security-regate-evidence/sec3-03-recheck.cjs` (static + SQL as 4 roles) | pass | `PASS plant cards: no amount, no pill (no '₹0 · Paid')` / `PASS owner still sees the late buyer: Al-Barakah Spice & Grain LLC $18,900 overdue` / `SEC3-03 RECHECK OK` |
| 2 | `npm run ci:tenant-check` | pass | `✅ CI Tenant Check PASSED: every public table has org_id … new functions are granted to nobody by default.` exit 0 |
| 3 | `npm test` | pass | `Test Files 5 passed (5)  Tests 112 passed (112)` exit 0 |
| 4 | `npx tsc --noEmit` | pass | exit 0, no output |
| 5 | `node docs/qa/sprint-c/dev1-plant-money.cjs` (A6 on reminders, context for SEC3-06) | pass | `plant: payment follow_ups=0, to-do rows=4, money to-do rows=none, kpi followups_today=4, tick balance reminder: 42501 not_found` / `PLANT MONEY CHECK OK` |
| 6 | `node docs/qa/sprint-c/security-regate-evidence/plant-blind-update.cjs` (can Plant blind-UPDATE the hidden 'payment' reminder?) | pass | `plant UPDATE with WHERE id: 0 rows` / `plant UPDATE without WHERE: 5 rows` / `balance reminder due_on before=2026-11-09 after=2026-11-09` — the hidden money reminder is untouched; the 5 rows are Plant's own visible reminders (the open SEC3-01 behaviour, minor). |

## Other Sprint C security items (not routed to this round, status for the record)

These were not assigned for re-check; a quick read shows where they stand. None is blocker or high.

| ID | Sev | Owner | Status |
|---|---|---|---|
| SEC3-01 | minor | dev1 | still open: `0004_inquiries_followups.sql:187-193` `follow_ups_update` still checks org + module only (probe 6: Plant updated 5 visible reminders in a no-WHERE UPDATE). |
| SEC3-02 | minor | dev2 | still open: no `rolbypassrls` / `rolsuper` guard in `0007_hardening.sql` or `scripts/ci-tenant-check.ts`. |
| SEC3-04 | minor | dev1 | still open: `scripts/seed-users.ts:15` still falls back to `DemoPass123!` when `DEMO_PASSWORD` is empty. Must be fixed before hosted Supabase users are created. |
| SEC3-05 | info | dev3 | unchanged (past `received_on` accepted). |
| SEC3-06 | info | dev3/dev2 | partly addressed by G3-03: Plant no longer reads 'payment' reminders ('Balance $18,900 due') through the table, `v_followups_today` or KPI. `orders.total` and quotes are still readable by Plant through the API — lead decision. |
| SEC3-07 | info | dev2 | unchanged (test harness assumes superuser). |

## What remains (security side)

- Nothing blocks sign-off. SEC3-03 is closed.
- 3 minor items (SEC3-01, SEC3-02, SEC3-04) and 3 info items stay open. SEC3-04 should be fixed before credentials day, since hosted accounts would otherwise get the public demo password.
