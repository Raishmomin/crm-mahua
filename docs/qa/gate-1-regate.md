# QA Gate 1 re-gate — Sprint A fix round

Date: 2026-11-13 (12:10–12:20). QA engineer persona: prove it works, then try to break it; usability for users with basic schooling on a phone.
Scope (as assigned): re-verify the QA-owned finding F1 plus the general checks (typecheck, lint, test, ci:tenant-check, `npx next build`, fresh bootstrap of `mahua_qa2`, `/login` phone render at 390x844). SEC1-01 / SEC1-02 belong to the security reviewer and were not re-gated; two incidental observations are listed in section 5.
Environment: local Postgres on 127.0.0.1:5432 (`onion_crm`), auth shim from 0000. No hosted Supabase, so web login is still **blocked**, not failed.
Browser: the Playwright MCP server still cannot start (`Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome`), so the phone pass used Playwright-core 1.62.1 driving the cached Chromium 1208 at 390x844, DPR 2, touch on. Scripts and raw logs are in the session scratchpad; screenshots in `docs/qa/screenshots/gate-1/`.

**Verdict: FAIL** (gate stays closed). F1 is only half fixed: the server action now returns `messageKey`, but `src/app/(dashboard)/users/user-table.tsx:82` still reads `result.message`, so `npm run typecheck` and `npx next build` both fail. One one-line change by Dev-3 reopens the gate; everything else is green.

## 1. Checks table

| # | Check | Result | Evidence (output tail) |
|---|---|---|---|
| 1a | `npm run typecheck` | **fail** | `src/app/(dashboard)/users/user-table.tsx(82,28): error TS2339: Property 'message' does not exist on type '{ ok: false; messageKey: string; detail?: string \| undefined; }'.` exit 1 |
| 1b | `npm run lint` (stdin closed, 180 s timeout) | pass | `✔ No ESLint warnings or errors`, exit 0 |
| 1c | `npm test` | pass | `✓ tests/security-fixes.test.ts (18 tests) 403ms`, `✓ tests/rls-tenant-isolation.test.ts (5 tests) 206ms`, `Test Files 2 passed (2)`, `Tests 23 passed (23)`, exit 0 (one run; `fileParallelism: false` is in vitest.config.ts) |
| 1d | `npm run ci:tenant-check` (onion_crm) | pass | `✅ CI Tenant Check PASSED: every public table has org_id, an index, ENABLE + FORCE RLS and an org policy; every view is security_invoker; web roles hold no TRUNCATE / REFERENCES / TRIGGER; all SECURITY DEFINER functions are allowlisted; number generators are locked.` exit 0 |
| 1e | `npx next build` | **fail** | `✓ Compiled successfully` then `Linting and checking validity of types ... Failed to compile. ./src/app/(dashboard)/users/user-table.tsx:82:28 Type error: Property 'message' does not exist on type '{ ok: false; messageKey: string; detail?: string \| undefined; }'.` exit 1. Dev-3's "next build OK" in the fix report predates Dev-2's 12:08 change to `actions.ts` (user-table.tsx mtime 11:26, actions.ts 12:08, page.tsx 12:07). |
| 2 | Fresh bootstrap `mahua_qa2` (psql CREATE DATABASE → `DATABASE_URL=…/mahua_qa2 npm run db:seed` ×2 → counts → hashes → policy → tenant-check → DROP) | pass | Run 1 and run 2 both: `Skipping auth users (no Supabase keys): local shim will insert them in SQL`, `ok 0000_auth_shim.sql / 0001_core_system.sql / 0002_catalog_and_buyers.sql / 0003_security_fixes.sql`, `ok supabase/seed/01_core.sql`, `Seed completed.` EXIT=0. Counts identical after both runs: `{"products":6,"price_list_items":12,"product_costs":6,"buyers":4,"buyer_contacts":5,"profiles":4,"auth_users":4,"organizations":1}`. Hashes: accountant/admin/ops/sales each `len=60`, `$2a$`, `crypt('DemoPass123!')` match = t. `profiles_select` qual in the fresh db: `((org_id = fn_current_org()) OR (id = auth.uid()))` (0003 8c lands on a clean bootstrap). `ci:tenant-check` against mahua_qa2: PASSED. `DROP DATABASE` → `remaining: 0`. |
| 3 | F1 server side (`users/actions.ts`) static re-check | pass (half of F1) | `grep -cE "Could not save\|At least one owner\|Not for you\|message:"` → `hits=0`. `ActionResult = { ok: true; id?: string } \| { ok: false; messageKey: string; detail?: string }`; Zod failure → `msg.err.bad_payload`, Wall 2 → `msg.access_denied_title`, own id → `msg.err.self_change`, RPC errors → `mapDbError` (`msg.err.*`, 42501 → `msg.access_denied_title`, else `msg.error.save`). Every key the action or `mapDbError` can return exists in both `en` and `gu` blocks of `src/lib/labels.ts` (`msg.err.self_change` 612/1129, `msg.err.last_owner` 611/1128, `msg.err.role_not_allowed` 615/1132, `msg.err.bad_payload` 610/1127, `msg.err.not_found` 607/1124, `msg.access_denied_title` 631/1148, `msg.error.save` 597/1114). |
| 4 | F1 consumer side (`users/user-table.tsx`) | **fail (F1 still open)** | Line 82 is still `show('error', result.message);` — the only consumer of `./actions` that reads `.message`. `settings-form.tsx:133` already shows the correct pattern (`tt(result.messageKey, …)`). Until this line becomes `show('error', tt(result.messageKey))` the app does not build, and a Gujarati owner would see an empty toast (`result.message` is `undefined` at runtime) instead of an English one. |
| 5a | `/login` phone render at 390x844 (en), dev server on :3100 | pass | status 200; `html lang=en`; `html` font-size **17px**; no horizontal scroll (`scrollWidth=390 clientWidth=390`); Email/Password inputs **51px**; Show-password **51x51**; Sign in **303x51**; Try-as **Owner/Accounts/Sales/Plant 147x72**; language segments 146x41 (F3, unchanged); no visible text under 12px (`small: []`); no raw label keys (`rawKeys: []`); body text `Mahuva CRM Your whole business on one screen Enter your email and password Email Password Sign in Try as: Owner Accounts Sales Plant English ગુજરાતી`. Screenshot `docs/qa/screenshots/gate-1/login-after-fix.png`. |
| 5b | Language toggle → Gujarati on the same screen | pass | Segment is `BUTTON role=radio aria-checked=false` (my first locator used role=button and missed it; the app is fine). After one click: `html lang=gu`; every label Gujarati (`Mahuva CRM આખો ધંધો એક સ્ક્રીન પર ઈમેલ અને પાસવર્ડ લખો ઈમેલ પાસવર્ડ લોગિન આ તરીકે ખોલો: માલિક હિસાબ સેલ્સ પ્લાન્ટ English ગુજરાતી`); `english words left: []`; cookie `lang=gu; path=/; sameSite=Lax; expires=365d`; after reload still `lang=gu`. Server render with `Cookie: lang=gu` also gives `<html lang="gu" …>`. Screenshot `login-after-fix-gu.png`. |
| 5c | Console / dev log | pass (noise only) | Browser: React DevTools info line + one `Failed to load resource: 404` = `GET /favicon.ico 404` (no favicon shipped; same as gate 1). No page errors, no 4xx/5xx for app resources. Dev log: 22 lines, `GET /login 200` only, no `⨯`/Error/warn lines on the clean start. |
| 5d | Dev server on :3100 stopped | pass | `next-server pid=35117` (started by QA) killed; `listeners on 3100 after kill: 0`; `curl :3100 -> 000`. |

Note on 1e/5c: my `next build` wrote a partial production `.next` under the running dev server on first start; the first `/login` request logged `ENOENT .next/server/edge-runtime-webpack.js` and a 500, then recovered to 200. I restarted the dev server; the clean start had no errors. This is build-folder sharing, not an app defect.

## 2. Findings (same ids as gate 1)

| ID | Status | Severity now | Owner | File | Problem | Fix |
|---|---|---|---|---|---|---|
| F1 | **still open** (server half fixed) | blocker (build broken) | dev3 | `src/app/(dashboard)/users/user-table.tsx:82` | Dev-2 completed its half (`actions.ts` returns `{ ok:false, messageKey }`, English sentences gone). Dev-3's half, the consumer switch named in the original finding and in Dev-2's notes_for_other_devs, was not done in the fix round (Dev-3 only fixed SEC1-02). Result: `tsc` TS2339 at line 82, `next build` fails, and at runtime the error toast text would be `undefined`. | Change line 82 to `show('error', tt(result.messageKey));` (`tt` is already in scope at line 30). Then re-run `npm run typecheck` and `npx next build`. |

No new blocker or high findings. Gate-1 minors F2 (password input has 0 labels; two `id="password"`), F3 (language segments 41px), F4 (body line-height 25.5px with `lang=gu`) were re-observed unchanged during the phone pass; they remain Sprint C items, not re-gated here.

## 3. Blocked (waiting for hosted Supabase credentials)

- Web login as the demo users: Sign in / Try-as still hit `127.0.0.1:54321` (no GoTrue). Unchanged from gate 1.
- The F1 behaviour check Dev-2 asked for ("re-check in Gujarati that no English sentence appears on the Staff screen") needs a logged-in owner on `/users`; verified statically only (keys exist in both languages, no English sentence in the action). Re-run in a browser once credentials exist and Dev-3's line is in.
- SEC1-01 "Login Off" demo step (switched-off user → `/account-inactive`, no loop) and SEC1-02 (user without `dashboard` → Access denied on `/`): need a real session; SQL and code evidence only (section 5).

## 4. Usability notes (plant supervisor with basic schooling, on a phone)

- Login screen unchanged and still good: one green Sign in, four 72px Try-as tiles with icon + one word, 51px fields, instant language switch that sticks for a year.
- In headless Chromium the Accounts tile shows "Accou…" (label `scrollWidth 98 > clientWidth 86`, `text-overflow: ellipsis`). The page's Latin font is `system-ui` and this box falls back to DejaVu Sans, which is wider than Roboto on a real Android phone, so the word probably fits there; still, a one-word label that can be cut in half is a risk for a reader who recognises whole words. Dev-3 (Sprint C): allow wrapping on the Try-as tiles or use `px-2`, and re-check on a real phone. The Gujarati word "હિસાબ" fits.
- Once Dev-3's line is in, every Staff error toast will be a short translated sentence from labels.ts ("ઓછામાં ઓછો એક માલિક જોઈએ.", "તમે તમારું પોતાનું કામ બદલી ન શકો.", "આ તમારા માટે નથી", "સેવ થયું નહીં. ફરી કરો."). Good for a Gujarati owner; nothing technical leaks.
- The favicon 404 is invisible to users but a blank tab icon makes the app harder to find among open tabs on a phone; add one when convenient.

## 5. Incidental observations (not QA-owned, not re-gated)

- SEC1-01: a clean `mahua_qa2` bootstrap ends with `profiles_select` = `org_id = fn_current_org() OR id = auth.uid()`; the new Vitest case is in the 23 passing tests.
- SEC1-02: `src/app/(dashboard)/page.tsx` line 40 is `const profile = await requireModule('dashboard')`, `requireAuth` no longer appears in that file.
- A `next-server` from Dev-3's smoke test is still listening on :3101 (pid 33271) although the fix report says "server stopped". I left it alone (not mine). It now serves a `.next` folder that `next dev` and my failed `next build` have overwritten, so it should be stopped before anyone trusts it.

## 6. Files written by QA

- `docs/qa/gate-1-regate.md` (this report)
- `docs/qa/screenshots/gate-1/login-after-fix.png` (en, 390x844 @2x), `docs/qa/screenshots/gate-1/login-after-fix-gu.png` (after the toggle)

No source files were edited; no git state-changing command was run; scratch database `mahua_qa2` was created, seeded twice, checked and dropped (`remaining: 0`).
