# Components, sizes, formats and language rules

Designer 2, 2026-11-12. Dev-3 builds everything in `src/components/ui`, `src/components/shell` and `src/components/print` in Sprint A; module developers use them unchanged and may add new files under `src/components/<module>/`.

## 1. Typography scale

`src/app/globals.css` (Dev-3, Sprint A): `html { font-size: 17px; }` and `html[lang="gu"] { line-height: 1.6; }`. Every Tailwind rem size scales from 17px.

| Use | Class | Rendered px | Rule |
|---|---|---|---|
| Body, facts, form values, buttons | `text-base` | 17 | Default for everything; never go below `text-sm` |
| Field labels, badge words, meta lines, nav labels on sidebar | `text-sm` | 14.9 | Minimum size anywhere in the app |
| Bottom-nav labels only | `text-xs` | 12.75 | Allowed only under 24px icons in the bottom bar |
| List row titles, page section headers | `text-lg font-semibold` | 19 | |
| Page title (h1), packing card secondary lines | `text-xl font-bold` | 21 | |
| Packing card primary lines, confirmation summary | `text-2xl font-bold` | 25.5 | |
| KPI numbers, packing card bag count | `text-3xl font-bold` | 31.9 | tabular numbers: `tabular-nums` |
| Print body | 11pt | — | print only, see section 15 |

Font stack in `body`: `system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Gujarati', 'Nirmala UI', Shruti, sans-serif`. Dev-3 loads `Noto_Sans_Gujarati` with `next/font/google` (subset `gujarati`, weights 400/600/700) and adds its variable to the stack so Gujarati renders the same on every phone. Never use `uppercase` or `tracking-wider` (Gujarati has no case; uppercase English reads slower).

## 2. Spacing, radius, touch targets

| Token | Value |
|---|---|
| Page padding | `p-4` (17px); `md:p-6` |
| Gap between cards / fields | `space-y-4` |
| Card | `rounded-xl border border-slate-200 bg-white p-4` (`shadow-sm` optional) |
| Sheet (bottom) | `rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]` |
| Content max width | `max-w-3xl mx-auto` on md+; full width on phones |
| Minimum tap target | 48 x 48 css px for every button, link, chip, nav item, checkbox row. `h-12` = 51px. |
| List row | `min-h-[72px]` |
| Space between adjacent tap targets | >= 8px (`gap-2`) |
| Phone layout bottom padding | `pb-28` on pages with a sticky primary button, `pb-20` otherwise (clears the 64px bottom nav + safe area) |

## 3. Button

`src/components/ui/button.tsx` (replace the existing sizes; keep variant names for compatibility and add `whatsapp`).

```ts
variant: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'whatsapp'   // default = primary emerald
size: 'default' | 'sm' | 'lg' | 'icon'
loading?: boolean   // shows Loader2 spinning + keeps width; label becomes t('btn.saving') if provided via `loadingLabel`
```

| size | classes | px (17px root) | Use |
|---|---|---|---|
| default | `h-12 px-5 text-base rounded-lg font-semibold gap-2` | 51 | Every normal button |
| sm | `h-10 px-4 text-sm rounded-lg font-semibold gap-1.5` | 42.5 | Only inside a row that is itself >= 64px tall (list row "Done", checklist "Done"); never the only control on a screen |
| lg | `h-14 px-6 text-lg rounded-xl font-bold gap-2` | 59.5 | Packing card, Next step, confirmation "Looks right" |
| icon | `h-12 w-12 rounded-full p-0` | 51 | Call, WhatsApp, Back, Sign out |

Icons inside buttons: `h-5 w-5` (`lg`: `h-6 w-6`). Disabled: `opacity-50 pointer-events-none`. Focus: `focus-visible:ring-2 ring-emerald-600 ring-offset-2`.

Primary action per screen: exactly one `variant="default"` button, full width, inside `<StickyBar>`:

```tsx
// src/components/ui/sticky-bar.tsx
// phone: fixed above the bottom nav; md+: static at the end of the form
<div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:static md:border-0 md:bg-transparent md:p-0">
  {children /* one primary button w-full, optional secondary outline to its left on md+ */}
</div>
```

Secondary actions are `outline` buttons in a wrapping row above the sticky bar, or under a "More" toggle when there are more than two.

## 4. Form fields

Files: `input.tsx` (update), `select.tsx`, `textarea.tsx`, `form-field.tsx`, `choice-chips.tsx`, `number-input.tsx`, `date-input.tsx`, `more-fields.tsx`.

| Component | Spec |
|---|---|
| FormField | Label above: `<label class="block text-sm font-semibold text-slate-700 mb-1.5">`; optional hint `text-sm text-slate-500 mt-1`; error below: `text-sm text-rose-700 mt-1 flex items-center gap-1` with `AlertCircle h-4 w-4`; sets `aria-describedby` and `aria-invalid`. No asterisks; missing required values show `msg.error.required` on submit. |
| Input | `h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base placeholder:text-slate-400 focus-visible:ring-2 ring-emerald-600`; `type="tel"` + `inputMode="tel"` for phones; `autoComplete` off on search. |
| NumberInput | Input with `inputMode="decimal"`, right-aligned `tabular-nums`, optional prefix (`₹`, `$`) and suffix unit toggle (`kg | MT`) rendered as two 48px chips; stores kg. |
| DateInput | Native `<input type="date">` at `h-12` (phones open the system picker); shows the formatted value `06 Nov 2026` as the hint line. |
| Select | Native `<select>` at `h-12 text-base pr-10` with a `ChevronDown` icon; used only when there are more than 6 options (buyer, product, order pickers use a search sheet instead, see below). |
| ChoiceChips | For 2-6 options (source, buyer type, mode, lost reason, pay mode, unit): `flex flex-wrap gap-2`; chip `h-12 min-w-[88px] px-4 rounded-full border text-base font-medium`; selected `bg-emerald-700 text-white border-emerald-700`; unselected `bg-white border-slate-300 text-slate-800`; optional 20px icon. Single select; keyboard: radio group semantics. |
| Textarea | `min-h-[96px] rounded-lg border px-4 py-3 text-base`, auto-grow. |
| MoreFields | Ghost full-width button `btn.more` with `ChevronDown` (becomes `btn.less` / `ChevronUp`); children hidden until tapped. Max 5 fields visible before it. If a hidden field has a validation error on submit, the section opens automatically and scrolls to it. |
| PickerSheet (buyer / product / order) | Opens a bottom sheet (phone) or dialog (md+) with a 48px search box (`common.search_placeholder`) and a `ListCard` list; a `btn.new_buyer` primary at the bottom when nothing matches. Selected value renders as a card (name + one fact) with a `btn.change` link. |

Form rules: one task per screen; the first field is auto-focused on md+ only (phones keep the keyboard closed until tapped); Enter in the last field submits; the form stays filled on error and shows the error banner (`msg.error.save` or the mapped DB message) above the sticky bar.

## 5. StatusBadge

See `status-colours.md` section 5. Wrapper `<Status domain code size? />` resolves everything from `STATUS_MAP` and `t()`.

## 6. KpiTile

`src/components/ui/kpi-tile.tsx`

```ts
interface KpiTileProps {
  href: string;            // whole tile is a <Link>
  word: string;            // t(lang, 'kpi.money_due')
  value: string;           // already formatted: "3", "₹18,40,000"
  secondary?: string;      // "$16,380" or "2 late"
  role: ColourRole;        // from the rules in status-colours.md section 4
  icon: LucideIcon;
}
```

| Property | Spec |
|---|---|
| Box | `block rounded-xl border p-4 min-h-[112px]` + `ROLE_CLASSES[role].soft`; `active:scale-[0.98]` |
| Number | `text-3xl font-bold tabular-nums leading-none` |
| Word | `text-base font-medium mt-2` |
| Secondary | `text-sm mt-1` (same text colour, 80% opacity) |
| Icon | `h-7 w-7` absolute top-right, `ROLE_CLASSES[role].icon` |
| Grid | `grid grid-cols-2 gap-3 md:grid-cols-4` |
| aria | `aria-label="{word}: {value}"` |

Tile links: New inquiries -> `/inquiries?status=new`; Quotes waiting -> `/quotes?status=sent`; Orders in production -> `/orders?status=open`; Money due -> `/payments?filter=due`.

Home variants: a user holding none of `leads` / `quotes` / `payments` (the Plant preset) sees only the Orders in production tile, and instead of the three big buttons a **Packing today** list (`kpi.packing_today`) of cards from `v_orders_in_production` (buyer, product + cut, `formatBags`, ship by, status) each opening `/orders/[id]`; empty text `msg.empty.packing_today`. Every Home shows To do today rows only for entity types whose module the user holds. `btn.see_all` opens the full list at `/?todo=all`.

## 7. ListCard

`src/components/ui/list-card.tsx`. Every list in the app is a vertical stack of these; never a table on phones.

```ts
interface ListCardProps {
  href: string;
  title: string;                 // 1 line, truncate
  fact1?: string;                // 1 line
  fact2?: string;                // 1 line
  badge?: React.ReactNode;       // <Status .../>
  trailing?: 'chevron' | React.ReactNode;   // default chevron; or <PhoneActions size="icon"/>
}
```

| Property | Spec |
|---|---|
| Row | `flex items-center gap-3 min-h-[72px] px-4 py-3 bg-white border-b border-slate-200` (last row no border); on md+ cards get `rounded-xl border` with `space-y-2` |
| Title | `text-lg font-semibold text-slate-900 truncate` |
| fact1 | `text-base text-slate-700 truncate` |
| fact2 | `text-base text-slate-500 truncate` |
| Right | badge above/beside a `ChevronRight h-5 w-5 text-slate-400`; or `trailing` node |
| Max facts | title + fact1 + fact2 = 3. Nothing else. Numbers go in facts, not in the badge. |
| Trailing tap targets | at most two 48px icon buttons (Call, WhatsApp); the rest of the row is the link |

Standard fact choices (Designer 1's screens.md may tighten):

| List | title | fact1 | fact2 | badge |
|---|---|---|---|---|
| Inquiries | buyer_name | product + qty ("White flakes · 12 MT") | `common.days_old` | inquiry status |
| Buyers | company_name | city / country | money due amount or `common.not_set` | money status |
| Samples | buyer_name | product + grams | sent date or courier | sample status |
| Quotes | buyer_name | quote_no + total | valid till / days left | quote status |
| Orders | buyer_name | order_code + qty | ship by / since date | order status |
| Money | buyer_name | due amount (big) | `common.days_late` or due date | money status |
| Products | name | ₹/kg and $/MT | floor (and cost for owner/accounts) | — |
| Staff | full_name | role word | `field.staff.can_see` | staff status |
| To do today | buyer_name | note | entity code + due | follow-up status |

Search: every list has a 48px search box at the top (`Search` icon, `common.search_placeholder`); filters by name or phone (digits-only compare) on the server via `ilike`. Filter chips (`btn.all`, status words) sit under it as a horizontal scroll row of 48px chips.

## 8. PhoneActions

`src/components/ui/phone-actions.tsx`

```ts
interface PhoneActionsProps {
  phone: string | null | undefined;
  message?: string;                 // prefilled WhatsApp text, already in the right language
  size?: 'icon' | 'full';           // icon = two 48px round buttons; full = two h-12 buttons with words
  lang: Lang;
}
```

| Element | Spec |
|---|---|
| Call | `<a href={`tel:+${digits}`}>` styled `variant="outline"` emerald, icon `Phone`; aria-label `btn.call` |
| WhatsApp | `<a href={`https://wa.me/${digits}?text=${encodeURIComponent(message ?? '')}`} target="_blank" rel="noopener noreferrer">` styled `variant="whatsapp"`, icon `MessageCircle`; aria-label `btn.whatsapp`; omit `?text=` when message is empty |
| No phone | both rendered disabled (`aria-disabled`, grey) with title `msg.whatsapp_no_phone` |
| Placement | List rows: `size="icon"` trailing; detail header card: `size="full"` side by side |

Number normalisation (`normalisePhone(raw): { digits: string; display: string } | null` in `src/lib/phone.ts`, Dev-3):

1. Keep digits; remember whether the raw string started with `+`.
2. Started with `+` -> digits as given (8-15 digits) -> international.
3. Starts with `00` -> drop `00` -> international.
4. 10 digits starting 6-9 -> prefix `91` (Indian mobile).
5. 11 digits starting `0` followed by 6-9 -> drop `0`, prefix `91`.
6. 12 digits starting `91` -> as is.
7. Anything else -> `null` (buttons disabled, form shows `msg.error.phone`).

Display: Indian -> `+91 98250 12345`; others -> `+<digits>` grouped as entered (`+971 50 123 4567` when spaces were typed, else `+97150 1234567` is acceptable). Stored value: the raw text as typed (`buyer_contacts.phone`, `inquiries.phone`); normalisation happens at render and at search time.

## 9. BottomNav and MoreSheet

`src/components/shell/bottom-nav.tsx`, `more-sheet.tsx`. Rendered by `(dashboard)/layout.tsx`; `md:hidden`.

| Property | Spec |
|---|---|
| Bar | `fixed inset-x-0 bottom-0 z-30 h-16 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)] grid grid-cols-5` |
| Item | `<Link>` `flex flex-col items-center justify-center gap-0.5 min-w-0` (full cell = 78 x 64px target) |
| Icon | `h-6 w-6` |
| Label | `text-xs font-medium truncate max-w-full` (`nav.*`) |
| Active | icon wrapped in `rounded-full bg-emerald-100 px-4 py-0.5`, icon + label `text-emerald-800 font-semibold` |
| Inactive | `text-slate-500` |
| Active test | `href === '/' ? pathname === '/' : pathname.startsWith(href)` |

Data-driven, always 5 slots, the 5th is always More (`LayoutGrid`, `nav.more`). Slots 1-4 are filled in this fixed order from the user's held modules: `BAR_ORDER = ['dashboard','leads','quotes','orders','payments','buyers','samples','catalog']` -> `held = BAR_ORDER.filter(k => profile.modules.includes(k))`; bar = `held.slice(0, 4)`; the More sheet lists `held.slice(4)` plus `users` and `settings` when held, then Language, then Sign out. More is active when the current path belongs to a sheet item.

| Role (preset) | Slots 1-4 | More sheet |
|---|---|---|
| Owner | Home, Inquiries, Quotes, Orders | Money, Buyers, Samples, Products, Staff, My Company, Language, Sign out |
| Accounts | Home, Quotes, Orders, Money | Buyers, Products, My Company, Language, Sign out |
| Sales | Home, Inquiries, Quotes, Orders | Buyers, Samples, Products, Language, Sign out |
| Plant | Home, Orders, Buyers, Samples | Products, Language, Sign out |

MoreSheet: slides up, full height on phones (overlay `bg-slate-900/40`, panel `rounded-t-2xl bg-white`); header row = full name + role word (`Hareshbhai Mehta - Owner`); rows `h-14 px-4 flex items-center gap-3 text-base` with 24px icons and a chevron; then a divider, the LanguageToggle (full words `English` / `ગુજરાતી`), and a full-width outline `btn.sign_out`. Closes on overlay tap / Escape / route change.

## 10. Sidebar (md+ only)

`src/components/shell/sidebar.tsx` changes:

| Element | Spec |
|---|---|
| Visibility | `hidden md:flex` fixed `w-64`; main content `md:ml-64` (no offset on phones) |
| Brand | `Wheat` in a 36px emerald square; `app.name` `text-base font-bold`; second line `app.company_short` `text-sm text-slate-500` (replaces "DEHYDRATION CRM") |
| Heading | none (delete "Modules") |
| Row | `h-12 px-3 rounded-lg flex items-center gap-3 text-base font-medium`; icon `h-6 w-6` |
| Active | `bg-emerald-700 text-white` (icon white) |
| Inactive | `text-slate-700 hover:bg-slate-100` |
| Items | MAIN_NAV filtered by `profile.modules` (10 shown modules only; documents/reports/audit are never in MAIN_NAV) |
| Footer | avatar initials 40px, full_name `text-base`, role word `text-sm text-slate-500` (via `role.*`, never the raw value) |

## 11. Header

`src/components/shell/header.tsx`: `sticky top-0 z-20 h-14 bg-white border-b px-4 flex items-center justify-between gap-2`.

| Slot | Phone | md+ |
|---|---|---|
| Left | Back icon button (`ArrowLeft`, `btn.back`, 48px) when the route is not a top-level nav route; on top-level routes nothing | `app.company_short` `text-base font-semibold` |
| Centre | Screen title `text-xl font-bold truncate` (passed by the page via `<PageTitle>`; Home shows `app.company_short`) | (page renders its own `<h1>`) |
| Right | Help speaker icon button (`Volume2`, `btn.help`; plays the Gujarati help clip, same spot on every screen; disabled stub in the demo) | Help + LanguageToggle (compact) + first name (`text-base`) + role word (`text-sm text-slate-500`) + Sign out button with word |

On phones Language and Sign out live in the More sheet (section 9), not in the header. No badges, no "Multi-tenant", no UUIDs.

## 12. LanguageToggle and label lookup

`src/components/shell/language-toggle.tsx`, `src/lib/i18n.ts` (Dev-3, Sprint A).

| Item | Spec |
|---|---|
| Cookie | `lang=en` or `lang=gu`; `Path=/; Max-Age=31536000; SameSite=Lax`; default `en` when missing or invalid |
| Set | Server action `setLangAction(lang)` writes the cookie, then the client calls `router.refresh()` |
| Read (server) | `getLang(): Lang` reads `cookies().get('lang')`; root layout sets `<html lang={lang}>` |
| Read (client) | `<LangProvider lang>` in `(dashboard)/layout.tsx` and `login/page.tsx`; `useLang()` hook |
| Control | Segmented control, 48px tall: compact in header shows `EN` and `ગુ`; full form (login, More sheet) shows `English` and `ગુજરાતી` (`btn.lang_en`, `btn.lang_gu`, each always in its own language). Selected segment `bg-emerald-700 text-white`. `aria-label` = `btn.language`. |
| Shown | Login page (above the form), header on md+ (every page), More sheet on phones |

Lookup:

```ts
export type Lang = 'en' | 'gu';
export type LabelDict = { en: Record<string, string>; gu: Partial<Record<string, string>> };
export function t(lang: Lang, key: string, vars?: Record<string, string | number>, local?: LabelDict): string;
```

Order: `local?.[lang]?.[key]` -> `local?.en?.[key]` -> `LABELS[lang]?.[key]` -> `LABELS.en[key]` -> `key` (so a missing key is visible in QA). `{name}` placeholders are replaced from `vars`; values are inserted as-is (never translated, never re-formatted). Helpers: `statusWord(lang, domain, code)` = `t(lang, 'status.' + domain + '.' + code)`; `roleWord(lang, role)`; `navWord(lang, moduleKey)`.

What is in toggle scope: menu labels, status words, buttons, KPI tile names, role names, field labels, section headers, short messages, WhatsApp templates for Indian buyers. Out of scope (always English): buyer and product names, numbers, dates, document numbers, codes, printed papers, email addresses.

## 13. StatusStepper, PackingCard, ChecklistItem

StatusStepper and the Next-step button: see `status-colours.md` section 6.

### PackingCard (`src/components/orders/packing-card.tsx`, Dev-3)

Shown at `/orders/[id]/packing`, and as the default view of `/orders/[id]` when `profile.role === 'operations'`. Shows no money, no rates, no totals.

| Line | Content | Class |
|---|---|---|
| 1 | Buyer short name + city ("Al-Barakah — Dubai") | `text-2xl font-bold` |
| 2 | Product name + spec ("White onion kibbled 3-5 mm") per item; one line per item | `text-xl` |
| 3 | `{packed_bags} / {planned_bags} bags x {bag_kg} kg` (planned_bags and bag_kg from `v_orders_in_production`) + progress bar `h-3 rounded-full bg-slate-200` with `bg-emerald-700` fill | `text-3xl font-bold tabular-nums` |
| 4 | Label / packing note ("Label: Al-Barakah Spice LLC, Lot WK-0215") | `text-lg` |
| 5 | Ship by date with `Calendar` icon | `text-xl` |
| 6 | `<Status domain="order" size="lg" />` | |

Buttons (stacked, `size="lg"`, full width):

| Order status | Primary | Note |
|---|---|---|
| confirmed | `btn.packing_started` | while `received < advance_expected` the button is disabled and reads `btn.wait_for_advance` (Plant cannot override; office roles use the confirm sheet on the order detail instead) |
| in_production | `btn.packed` -> "How many bags?" sheet (big `NumberInput` prefilled with `planned_bags`, `-10 / +10` 48px buttons, `btn.save`; bags > 0) | `fn_order_set_packed(order_id, packed_bags)` stores the bags and sets `ready` |
| ready | `btn.loaded` -> `/orders/[id]/dispatch` short form (mode, truck / container number, port for container, bags, qty, date) | `btn.save_make_papers` -> the same `fn_order_dispatch` the office form calls |
| dispatched / delivered | none | badge only |

`btn.take_photo` (COA) is rendered as a disabled outline button with `common.optional` hint in the demo (photo upload is a later step).

### ChecklistItem (`src/components/orders/checklist-item.tsx`, Dev-3)

Used on `/orders/[id]/checklist` for container dispatches only; eight rows in the fixed order of `labels.md` section 9 (export checklist).

| Element | Spec |
|---|---|
| Row | `flex items-center gap-3 min-h-[64px] px-4 border-b` |
| Icon | `CheckCircle2 h-7 w-7 text-emerald-700` when done; `Circle h-7 w-7 text-amber-600` when pending |
| Text | label `text-base font-medium`; second line `text-sm text-slate-500`: `Done 26 Feb 2026` or `status.checklist.pending` |
| Action | pending: `btn.tick` (`size="sm" variant="outline"`, 42px tall inside the 64px row) opens a sheet "Done on [DateInput = today]" (+ a required BL number input for `bl_received`) with `btn.save` -> `fn_dispatch_tick(dispatch_id, key, true, on_date, bl_no)`; done: tapping the row shows `btn.untick` (owner / accounts only) -> `fn_dispatch_tick(dispatch_id, key, false, null, null)`. Plant sees `btn.tick` only on `stuffing_done` and `coa`. |
| Photo | `Camera` ghost icon button, disabled in the demo (upload later) |
| Header | `checklist.progress` pill (green at 8/8, else amber) + the dispatch facts (container no, port, vessel, stuffing date, ETA, BL no or `msg.bl_not_yet`); primary sticky button `btn.share_status_whatsapp` (template `wa.checklist_status`) |

Auto-done items are visually the same as manual ones.

## 14. EmptyState, ErrorState, LoadingSkeleton, Toast, ConfirmSheet

| Component | Spec |
|---|---|
| EmptyState | `flex flex-col items-center text-center p-10 gap-3`; domain icon `h-10 w-10 text-slate-300` (Inbox default, `CheckCircle2 text-emerald-600` for `msg.empty.money` / `msg.empty.todo`); text `text-base text-slate-600` from `msg.empty.*`; optional primary button (e.g. `btn.new_inquiry`). Text is one sentence, never two paragraphs. |
| ErrorState | same layout; `AlertCircle h-10 w-10 text-rose-500`; `msg.error.load`; `btn.retry` outline. Never show the raw error message to the user; log it on the server. |
| LoadingSkeleton | three `h-[72px] rounded-xl bg-slate-100 animate-pulse` rows; `aria-busy`, `aria-label` = `common.loading` |
| Toast | bottom-centred above the nav (`bottom-20`), `rounded-full px-5 h-12 flex items-center gap-2 text-base`; success `bg-emerald-700 text-white` with `Check`, auto-hide 2 s; error `bg-rose-600 text-white` with `AlertCircle`, 5 s; one at a time |
| ConfirmSheet | bottom sheet: title `text-lg font-semibold`, message `text-base`, optional `ChoiceChips` (lost reason), buttons row: primary (or `destructive`) `btn.yes` / specific verb, outline `btn.no`; both `h-12`; Escape / overlay closes |

Copy rules for empty and error states: one short sentence, plain words, says what to do next ("Tap + to add", "Tap to try again"). No "records", "entries", "filters", "support", "unexpected", "failed to fetch".

## 15. PrintLayout

Files: `src/app/(print)/layout.tsx` (Dev-3, Sprint A: `requireAuth`, no shell, white page, `PrintToolbar`), `src/components/print/print-layout.tsx`, `src/components/print/amount-words.ts`. Print pages: `src/app/(print)/quotes/[id]/print/page.tsx` (Dev-2) and `src/app/(print)/orders/[id]/print/page.tsx?doc=pi|invoice|sdn` (Dev-3), `src/app/(print)/payments/[id]/print/page.tsx` (Dev-3, receipt). Each page starts with `requireModule('quotes' | 'orders' | 'payments')`.

| Element | Spec |
|---|---|
| Page | `@page { size: A4; margin: 14mm }`; container `max-w-[190mm] mx-auto text-[11pt] text-slate-900 font-sans`; `@media print { .no-print { display: none } body { background: white } }` |
| Toolbar (`no-print`) | sticky top: `btn.back` (outline), `btn.print` (primary, `window.print()`), `btn.share_whatsapp` (whatsapp variant, uses `wa.*` text; the PDF itself is attached by the user from the phone share sheet) |
| Header | company_name 20pt bold; trade_name 12pt; address, city state pincode; phone, email; one line of registrations shown only when non-null: `GSTIN ... · IEC ... · FSSAI ... · PAN ...` |
| Title block | doc title (QUOTATION / PROFORMA INVOICE / TAX INVOICE or COMMERCIAL INVOICE / DISPATCH NOTE / RECEIPT) 16pt bold, doc number and date (`06 Nov 2026`) right-aligned |
| Parties | "To:" buyer company_name, address, city, country, GSTIN (India); for export also "Consignee" = same unless noted |
| Items table | columns Sr, Product (name + spec_text), Packing, Qty (kg, or MT when whole), Rate (currency/unit), Amount; 12pt, borders `border-slate-400` |
| Totals | Subtotal; GST 5% (India only; export prints "GST 0% - export under LUT"); Total bold; "Amount in words" (Indian system: Rupees Nineteen Lakh ... only; for USD: US Dollars ... only) |
| Terms | Payment terms, Price basis (`incoterm` text as stored: EXW / FOB Pipavav / FOB Mundra / CIF), Valid till (quotes), Ship by (PI), Vehicle / LR / Transporter or Container / Port of loading / Vessel / Stuffing date / ETA (invoice, dispatch note) |
| Bank | bank_name, A/c no, IFSC, branch; SWIFT when currency is not INR; the primary bank account for the document currency if available |
| Footer | "For {company_name}" + 40mm signature line + authorized_signatory name + "Authorised signatory"; small `app.name` line |
| Language | always English; numbers `en-IN` for INR, `en-US` for others |

Tax invoice (domestic): HSN 07122000, GST split CGST/SGST at 2.5% each when buyer state = Gujarat, IGST 5% otherwise; rate taken from `order_items.gst_rate`. Commercial invoice (export): no GST line, adds IEC and "Supply meant for export under LUT without payment of IGST".

## 16. Number, date and phone formats

`src/lib/utils.ts` (Dev-3 edits in Sprint A only; adds the helpers below next to the existing `formatCurrency` / `formatDate`).

| Helper | Output | Rule |
|---|---|---|
| `formatMoney(amount, currency = 'INR', opts?: { decimals?: 0 \| 2 })` | `₹1,25,000`, `₹1,25,000.50`, `$23,400`, `€1,430`, `AED 12,000` | INR: `en-IN` grouping (lakh, crore), `₹` symbol; USD/EUR/GBP: `en-US` grouping with symbol; other codes: `CODE 12,000`. Lists and KPIs use 0 decimals; forms and print use 2. Negative never shown; due amounts are clamped at 0 in views. |
| `formatQty(kg)` | `12,000 kg` or `12 MT` | MT only when `kg >= 1000 && kg % 1000 === 0`; forms always edit kg |
| `formatRate(rate, currency, unit)` | `₹185/kg`, `$2,250/MT` | symbol as above, no decimals unless non-integer |
| `formatBags(bags, bagKg)` | `480 bags x 25 kg` | words from `unit.bags`; Gujarati `480 બેગ x 25 કિલો` |
| `formatDate(iso)` (existing) | `06 Nov 2026` | `en-IN`, `day: 2-digit, month: short, year: numeric`; never `11/06/2026`; relative words (`common.today` etc.) only in lists |
| `formatDays(n, lang, kind)` | `3 days left`, `12 days late`, `5 days old` | via `common.days_*` |
| `formatPhoneDisplay(raw)` | `+91 98250 12345` | see section 8 |
| `amountInWords(amount, currency)` | `Rupees Nineteen Lakh Sixty-Five Thousand Six Hundred only` | print only |

Foreign currency with INR equivalent: wherever a USD/EUR amount is shown on screen and an FX rate is recorded (`quotations.fx_rate`, `orders.fx_rate`, `payments.fx_rate`), show `≈ ₹19,65,600` as a `text-sm` second line (`field.quote.total_inr`). If no rate is recorded, show the foreign amount alone; never guess a rate in the UI. The Money KPI tile shows INR and USD sums as two separate values, never added together.

Dates in the database are `date` for business dates (received_on, dispatched_on, valid_till) and `timestamptz` for events; the UI formats both with `formatDate`.

## 17. Page templates (one task per screen)

| Template | Structure top to bottom | Primary (sticky) |
|---|---|---|
| ListPage | h1 + count; search box; filter chips (horizontal scroll); `ListCard` stack or EmptyState | `btn.new_*` (hidden for Products, Money list shows `btn.money_received`) |
| FormPage | h1; <= 5 `FormField`s; `MoreFields`; error banner | `btn.save` (`btn.cancel` = header Back) |
| DetailPage | header card: code + `<Status size="lg">`; 3 facts; `PhoneActions size="full"`; section cards (`section.*`), each <= 5 facts; outline secondary actions row | the next step in the flow (per screens.md) |
| ConfirmPage (`/quotes/[id]/accept`) | h1 `title.quote_accept`; summary card `text-2xl` lines (buyer, product, qty, total, advance); `field.order.advance_pct` (chips 30 / 50 / 100 from the payment-terms words; 0 for credit and LC) and `field.order.expected_dispatch` (default today + 21 export, today + 7 India) | `btn.looks_right` -> `fn_quote_accept(quote_id, ship_by, advance_pct)` (`btn.change` outline beside it on md+) |
| PackingPage | PackingCard only | lg buttons inside the card |

## 18. Accessibility and QA checklist (per screen)

- Every interactive element >= 48 x 48 css px; checked at 390 x 844 (Playwright) with no horizontal scroll.
- Body text >= 17px, labels >= 14.9px (`text-sm`), nothing smaller except bottom-nav labels (12.75px).
- Colour is never the only signal: badge = colour + icon + word; KPI = colour + icon + word + number.
- Every `<a>`/`<button>` with only an icon has an `aria-label` from `labels.md`.
- Focus ring visible on keyboard navigation (munim uses a desktop with Enter-key habits; Enter submits forms).
- No raw codes (`sample_sent`), no raw roles (`operations`), no UUIDs, no English jargon from product-gap-analysis section 3 anywhere on screen; grep the rendered HTML for them in QA gate 2.
- Switching the language cookie changes every label in scope on the same screen without a 404 or an untranslated key appearing.
