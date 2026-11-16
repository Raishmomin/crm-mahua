# Status colours, icons and the StatusBadge / KpiTile / Stepper rules

Designer 2, 2026-11-12. Binding for Dev-3 (`src/components/ui/status-badge.tsx`, `kpi-tile.tsx`) and every module developer. Words come from `labels.md`; this file adds colour role, Tailwind classes and lucide-react icon per code.

## 1. The five colour roles

Only these five. Nothing else gets a colour. All classes are Tailwind 3.4 defaults and sit next to the existing emerald primary and slate neutrals.

| Role | Meaning (what the user feels) | bg | text | border | icon colour | Contrast (text on bg) |
|---|---|---|---|---|---|---|
| green | done, paid, approved, OK | `bg-emerald-100` | `text-emerald-800` | `border-emerald-300` | `text-emerald-700` | 7.6:1 |
| amber | waiting for someone (buyer, courier, money within time) | `bg-amber-100` | `text-amber-900` | `border-amber-300` | `text-amber-700` | 8.6:1 |
| red | late, rejected, overdue, below floor | `bg-rose-100` | `text-rose-800` | `border-rose-300` | `text-rose-700` | 7.5:1 |
| blue | new, our work in progress | `bg-sky-100` | `text-sky-900` | `border-sky-300` | `text-sky-700` | 9.0:1 |
| grey | closed, draft, cancelled, lost, off | `bg-slate-100` | `text-slate-700` | `border-slate-300` | `text-slate-500` | 9.0:1 |

Solid variants (KPI tiles and the done steps of the stepper only):

| Role | solid bg | solid text |
|---|---|---|
| green | `bg-emerald-700` | `text-white` |
| amber | `bg-amber-500` | `text-slate-900` |
| red | `bg-rose-600` | `text-white` |
| blue | `bg-sky-700` | `text-white` |
| grey | `bg-slate-500` | `text-white` |

Implementation: one map in `status-badge.tsx`:

```ts
export type ColourRole = 'green' | 'amber' | 'red' | 'blue' | 'grey';
export const ROLE_CLASSES: Record<ColourRole, { soft: string; solid: string; icon: string }> = {
  green: { soft: 'bg-emerald-100 text-emerald-800 border-emerald-300', solid: 'bg-emerald-700 text-white', icon: 'text-emerald-700' },
  amber: { soft: 'bg-amber-100 text-amber-900 border-amber-300',       solid: 'bg-amber-500 text-slate-900', icon: 'text-amber-700' },
  red:   { soft: 'bg-rose-100 text-rose-800 border-rose-300',          solid: 'bg-rose-600 text-white', icon: 'text-rose-700' },
  blue:  { soft: 'bg-sky-100 text-sky-900 border-sky-300',             solid: 'bg-sky-700 text-white', icon: 'text-sky-700' },
  grey:  { soft: 'bg-slate-100 text-slate-700 border-slate-300',       solid: 'bg-slate-500 text-white', icon: 'text-slate-500' },
};
```

Semantics used below: blue = the ball is in our court; amber = the ball is in the buyer's / courier's / bank's court; green = finished well; red = finished badly or late; grey = not live.

## 2. Status map (code -> word -> colour -> icon)

`STATUS_MAP[domain][code] = { role, icon }` lives in `src/lib/status.ts` (Dev-3, Sprint A). Words are looked up with `t(lang, 'status.<domain>.<code>')`.

### Inquiry (`inquiries.status`)

| code | English | Gujarati | role | icon (lucide-react) |
|---|---|---|---|---|
| new | New | નવી | blue | `Inbox` |
| talking | Talking | વાત ચાલુ | blue | `MessageCircle` |
| sample_sent | Sample sent | સેમ્પલ મોકલ્યું | amber | `FlaskConical` |
| quoted | Quoted | ભાવ આપ્યો | amber | `FileText` |
| won | Won | ઓર્ડર મળ્યો | green | `Trophy` |
| lost | Lost | ગુમાવ્યો | grey | `XCircle` |

Extra rule: in the inquiry list, the "{n} days old" fact turns `text-rose-700 font-semibold` when `days_old > 7` and status is `new` or `talking` (unanswered too long). No pill change.

### Sample (`samples.status`)

| code | English | Gujarati | role | icon |
|---|---|---|---|---|
| to_send | To send | મોકલવાનું | amber | `Clock` |
| sent | Sent | મોકલ્યું | blue | `Send` |
| approved | Approved | પાસ | green | `CheckCircle2` |
| rejected | Rejected | નાપાસ | red | `XCircle` |

### Quote (`quotations.status`; `expired` is derived in the UI/view when `status = 'sent' AND valid_till < today`)

| code | English | Gujarati | role | icon |
|---|---|---|---|---|
| draft | Draft | કાચું | grey | `Pencil` |
| sent | Sent | મોકલ્યું | amber | `Send` |
| accepted | Accepted | મંજૂર | green | `CheckCircle2` |
| rejected | Rejected | નામંજૂર | red | `XCircle` |
| expired | Expired | મુદત પૂરી | grey | `CalendarX` |

Extra rule: "Valid till" fact shows `common.days_left`; when `days_left <= 2` the fact is `text-amber-700 font-semibold`.

### Order (`orders.status`)

| code | English | Gujarati | role | icon |
|---|---|---|---|---|
| confirmed | Confirmed | પાક્કો | blue | `ClipboardCheck` |
| in_production | In production | બની રહ્યો | blue | `Factory` |
| ready | Ready | તૈયાર | amber | `PackageCheck` |
| dispatched | Dispatched | રવાના | blue | `Truck` (use `Ship` when the latest dispatch mode is `container`) |
| delivered | Delivered | પહોંચ્યો | green | `CheckCircle2` |
| cancelled | Cancelled | રદ | grey | `Ban` |

### Dispatch (`dispatches.status`)

| code | English | Gujarati | role | icon |
|---|---|---|---|---|
| dispatched | Dispatched | રવાના | blue | `Truck` / `Ship` by mode |
| delivered | Delivered | પહોંચ્યું | green | `PackageCheck` |

### Money (`v_order_balances.money_status`, `v_money_due.money_status`)

| code | English | Gujarati | role | icon |
|---|---|---|---|---|
| paid | Paid | ચૂકતે | green | `CheckCircle2` |
| due | Waiting | બાકી | amber | `Clock` |
| overdue | Late | મોડું | red | `AlertCircle` |

Words are Paid / Waiting / Late (Designer 1's screens); the codes stay `paid` / `due` / `overdue`.

### Advance (derived on the order card: `advance_expected > 0`)

| condition | key | English | Gujarati | role | icon |
|---|---|---|---|---|---|
| received < advance_expected | status.advance.due | Advance waiting | એડવાન્સ બાકી | amber | `Clock` |
| received >= advance_expected | status.advance.ok | Advance OK | એડવાન્સ આવ્યો | green | `CheckCircle2` |

### Follow-up (`follow_ups.done`)

| code | English | Gujarati | role | icon |
|---|---|---|---|---|
| pending | To do | કરવાનું | amber | `Bell` |
| done | Done | થઈ ગયું | green | `Check` |

Extra rule: a pending follow-up with `days_late > 0` shows the fact `common.days_late` in `text-rose-700`.

### Staff (`profiles.is_active`)

| code | English | Gujarati | role | icon |
|---|---|---|---|---|
| true | On | ચાલુ | green | `UserCheck` |
| false | Off | બંધ | grey | `UserX` |

### Floor price check (quote item helper line, derived)

| condition | key | English | Gujarati | role | icon |
|---|---|---|---|---|---|
| rate >= floor | status.floor.ok | Above floor | ભાવ બરાબર | green | `ShieldCheck` |
| rate < floor | status.floor.below | Below floor | ભાવ ઓછો | red | `ShieldAlert` |

### Export checklist item (`dispatches.export_checklist.<key>.done`)

| condition | English | Gujarati | role | icon |
|---|---|---|---|---|
| done = true | Done | થઈ ગયું | green | `CheckCircle2` |
| done = false | Pending | બાકી | amber | `Circle` |

Progress pill `checklist.progress` ("{done} of 8 done"): green when 8 of 8, else amber. Ticks go through `fn_dispatch_tick`; Plant may tick only `stuffing_done` and `coa`.

### Lost reasons (chips, not statuses)

Chips are neutral (grey outline); the selected chip is `bg-slate-800 text-white`. Icons: price `IndianRupee`, quality `FlaskConical`, timing `Clock`, no_reply `MessageCircle`.

## 3. Money due thresholds

Computed in SQL (`v_order_balances`, see contracts.md) so every screen agrees:

| money_status | Rule | Colour | Where it shows |
|---|---|---|---|
| paid | `due = 0` | green | Order money section, Money list chip Paid, Buyer detail |
| due (word: Waiting) | `due > 0` and not late, including not yet dispatched (`due_date IS NULL`): row fact shows `common.due_on` or `common.after_dispatch` | amber | Money list, Order card, Buyer row |
| overdue (word: Late) | `due > 0` and `latest dispatched_on + buyers.credit_period_days < CURRENT_DATE` | red | same, sorted first with `common.days_late` |

`due_date = latest dispatch date + buyers.credit_period_days`. Before dispatch `due_date` is NULL, so an undispatched order with balance is "Due" (amber), never "Late". Advance is tracked separately by the advance chip above.

Per buyer (`v_money_due`): the worst status among the buyer's orders wins (overdue > due > paid).

## 4. KPI tile colour rules (Home)

| Tile | Source column (v_home_kpis) | Colour rule | Icon |
|---|---|---|---|
| New inquiries | new_inquiries | blue when > 0; grey when 0 | `Inbox` |
| Quotes waiting | quotes_waiting | amber when > 0; grey when 0 | `FileText` |
| Orders in production | orders_in_production | blue when > 0; grey when 0 | `Factory` |
| Money due | money_due_inr, money_due_usd, money_overdue_count | green when both due amounts are 0 (shows ₹0 and `CheckCircle2`); amber when due > 0 and money_overdue_count = 0; red when money_overdue_count > 0 (second line "{n} late") | `IndianRupee` |
| To do today (list header, not a tile) | followups_today | amber count badge when > 0; green `msg.empty.todo` row when 0 | `Bell` |

KPI tiles use the **soft** classes (bg-100) with a 28px icon in the role's icon colour and the number in the role's text colour, so the four tiles never shout; red is reserved for money.

## 5. StatusBadge spec

File: `src/components/ui/status-badge.tsx` (Dev-3, Sprint A). Props:

```ts
interface StatusBadgeProps {
  role: ColourRole;           // from STATUS_MAP
  icon: LucideIcon;           // from STATUS_MAP
  word: string;               // already translated: t(lang, 'status.order.ready')
  size?: 'default' | 'lg';    // lg only on detail page headers
  solid?: boolean;            // KPI/stepper use only
}
```

| Property | default | lg |
|---|---|---|
| Container | `inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap font-semibold` | same |
| Height | `h-8` (34px at 17px root) | `h-10` (42.5px) |
| Padding | `px-3` | `px-4` |
| Text | `text-sm` (14.9px) | `text-base` (17px) |
| Icon | `h-4 w-4` (17px) `shrink-0` | `h-5 w-5` |
| Colours | `ROLE_CLASSES[role].soft`, icon `ROLE_CLASSES[role].icon` | same |
| aria | `role="status"`, text content is the word | same |

A badge is never a tap target on its own; the row or button around it is. Convenience wrapper `<Status domain="order" code={order.status} />` resolves role, icon and word from `STATUS_MAP` and `t()` so module code never hard-codes colours.

## 6. Status stepper spec (orders)

File: `src/components/ui/status-stepper.tsx` (Dev-3, Sprint A; used by Dev-3 orders pages).

Steps, in order: `confirmed` -> `in_production` -> `ready` -> `dispatched` -> `delivered`. `cancelled` hides the stepper and shows one grey `lg` badge "Cancelled" plus the cancel date.

| Element | Spec |
|---|---|
| Layout | Horizontal, 5 equal columns, fits 358px (390px viewport minus 16px padding each side); no scroll. `grid grid-cols-5 gap-0`. |
| Circle | `h-9 w-9 rounded-full flex items-center justify-center` (38px). Icon `h-5 w-5` from the order status map. |
| Connector | `h-[3px]` line between circles, `bg-emerald-700` when the left step is done, else `bg-slate-200`. |
| Label | Under the circle, `text-sm leading-tight text-center mt-1.5`, max 2 lines (`line-clamp-2`), word from `status.order.*`. |
| Done step | circle `bg-emerald-700 text-white`, label `text-slate-700`. Icon replaced by `Check`. |
| Current step | circle `bg-white border-[3px] border-emerald-700 text-emerald-800`, label `text-emerald-800 font-bold`. |
| Future step | circle `bg-slate-100 border border-slate-300 text-slate-400`, label `text-slate-400`. |
| Delivered | all five done; last circle `Check`. |

Next-step button (directly under the stepper, full width, `h-14 text-lg` primary):

| Current status | Button label | Action |
|---|---|---|
| confirmed | `btn.start_packing` (office) / `btn.packing_started` (packing card) | `fn_order_set_status(id, 'in_production')` — always allowed in the DB (soft guard). UI: when advance is waiting, Plant's button is disabled with `btn.wait_for_advance`; owner / accounts / sales get the confirm sheet `msg.advance_not_received` with `btn.wait` / `btn.start_anyway` |
| in_production | `btn.packed` | Opens "How many bags?" sheet -> `fn_order_set_packed(order_id, packed_bags)` which stores the bags and sets status `ready` |
| ready | `btn.dispatch` (office) / `btn.loaded` (packing card) | Routes to `/orders/[id]/dispatch` (Plant gets the short form); `btn.save_make_papers` calls `fn_order_dispatch` |
| dispatched | `btn.delivered` (not shown to Plant) | Opens date sheet -> `fn_dispatch_delivered(dispatch_id, date)` |
| delivered, cancelled | (no button) | — |

The button is rendered only when the user holds the `orders` module. `btn.cancel_order` lives under "More" (outline, danger) and is hidden from `dispatched` onwards.

## 7. Other colour rules (so nobody invents new ones)

| Element | Colour |
|---|---|
| Primary button | `bg-emerald-700 text-white hover:bg-emerald-800` |
| Danger button (Mark lost, Cancel order, Delete draft, Buyer rejected) | `bg-rose-600 text-white hover:bg-rose-700` |
| WhatsApp button | `bg-green-600 text-white hover:bg-green-700` (icon `MessageCircle`) |
| Call button | `border-emerald-700 text-emerald-800 bg-white` outline (icon `Phone`) |
| Active nav item | `bg-emerald-700 text-white` (sidebar row) / `bg-emerald-100 text-emerald-800` pill (bottom nav) |
| Selected chip | `bg-emerald-700 text-white border-emerald-700`; lost-reason chips use `bg-slate-800` |
| Locked cost column hint | `text-slate-500` with `Lock` icon |
| Form error text | `text-rose-700` |
| Success toast | `bg-emerald-700 text-white` |
| Error toast | `bg-rose-600 text-white` |
| Focus ring | `ring-2 ring-emerald-600 ring-offset-2` |
| Page background | `bg-slate-50`; cards `bg-white border-slate-200` |
