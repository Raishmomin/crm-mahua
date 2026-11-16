/**
 * Status code -> colour role, lucide icon and label key (docs/design/status-colours.md).
 * Words come from t(lang, labelKey); nothing here is shown raw.
 */
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Ban,
  Bell,
  CalendarX,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock,
  Factory,
  FileText,
  FlaskConical,
  Inbox,
  MessageCircle,
  PackageCheck,
  Pencil,
  Send,
  Ship,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Truck,
  UserCheck,
  UserX,
  XCircle,
} from 'lucide-react';

export type ColourRole = 'green' | 'amber' | 'red' | 'blue' | 'grey';

export type StatusDomain =
  | 'inquiry'
  | 'sample'
  | 'quote'
  | 'order'
  | 'dispatch'
  | 'money'
  | 'advance'
  | 'followup'
  | 'staff'
  | 'floor'
  | 'checklist';

export interface StatusInfo {
  role: ColourRole;
  icon: LucideIcon;
  /** status.<domain>.<code> */
  labelKey: string;
}

function s(domain: StatusDomain, code: string, role: ColourRole, icon: LucideIcon): [string, StatusInfo] {
  return [code, { role, icon, labelKey: `status.${domain}.${code}` }];
}

export const STATUS_MAP: Record<StatusDomain, Record<string, StatusInfo>> = {
  inquiry: Object.fromEntries([
    s('inquiry', 'new', 'blue', Inbox),
    s('inquiry', 'talking', 'blue', MessageCircle),
    s('inquiry', 'sample_sent', 'amber', FlaskConical),
    s('inquiry', 'quoted', 'amber', FileText),
    s('inquiry', 'won', 'green', Trophy),
    s('inquiry', 'lost', 'grey', XCircle),
  ]),
  sample: Object.fromEntries([
    s('sample', 'to_send', 'amber', Clock),
    s('sample', 'sent', 'blue', Send),
    s('sample', 'approved', 'green', CheckCircle2),
    s('sample', 'rejected', 'red', XCircle),
  ]),
  quote: Object.fromEntries([
    s('quote', 'draft', 'grey', Pencil),
    s('quote', 'sent', 'amber', Send),
    s('quote', 'accepted', 'green', CheckCircle2),
    s('quote', 'rejected', 'red', XCircle),
    s('quote', 'expired', 'grey', CalendarX),
  ]),
  order: Object.fromEntries([
    s('order', 'confirmed', 'blue', ClipboardCheck),
    s('order', 'in_production', 'blue', Factory),
    s('order', 'ready', 'amber', PackageCheck),
    s('order', 'dispatched', 'blue', Truck),
    s('order', 'delivered', 'green', CheckCircle2),
    s('order', 'cancelled', 'grey', Ban),
  ]),
  dispatch: Object.fromEntries([
    s('dispatch', 'dispatched', 'blue', Truck),
    s('dispatch', 'delivered', 'green', PackageCheck),
  ]),
  money: Object.fromEntries([
    s('money', 'paid', 'green', CheckCircle2),
    s('money', 'due', 'amber', Clock),
    s('money', 'overdue', 'red', AlertCircle),
  ]),
  advance: Object.fromEntries([
    s('advance', 'due', 'amber', Clock),
    s('advance', 'ok', 'green', CheckCircle2),
  ]),
  followup: Object.fromEntries([
    s('followup', 'pending', 'amber', Bell),
    s('followup', 'done', 'green', Check),
  ]),
  staff: Object.fromEntries([
    s('staff', 'active', 'green', UserCheck),
    s('staff', 'inactive', 'grey', UserX),
    s('staff', 'true', 'green', UserCheck),
    s('staff', 'false', 'grey', UserX),
  ]),
  floor: Object.fromEntries([
    s('floor', 'ok', 'green', ShieldCheck),
    s('floor', 'below', 'red', ShieldAlert),
  ]),
  checklist: Object.fromEntries([
    s('checklist', 'done', 'green', CheckCircle2),
    s('checklist', 'pending', 'amber', Circle),
  ]),
};

const UNKNOWN: StatusInfo = { role: 'grey', icon: Circle, labelKey: '' };

/**
 * Resolve a status. Unknown codes fall back to grey + the raw key so QA can spot them.
 * `dispatchMode = 'container'` swaps Truck for Ship on dispatched orders / dispatches.
 */
export function statusInfo(
  domain: StatusDomain,
  code: string | boolean | null | undefined,
  opts?: { dispatchMode?: 'truck' | 'container' | null }
): StatusInfo {
  const key = String(code ?? '');
  const found = STATUS_MAP[domain]?.[key];
  if (!found) return { ...UNKNOWN, labelKey: `status.${domain}.${key}` };
  if (opts?.dispatchMode === 'container' && found.icon === Truck) {
    return { ...found, icon: Ship };
  }
  return found;
}

/** Order status codes in stepper order (cancelled is outside the stepper). */
export const ORDER_STEPS = ['confirmed', 'in_production', 'ready', 'dispatched', 'delivered'] as const;
export type OrderStep = (typeof ORDER_STEPS)[number];

/** Export checklist keys in the fixed display order (contracts.md 3.8, screens.md 18). */
export const CHECKLIST_KEYS = [
  'container_booked',
  'stuffing_done',
  'coa',
  'phyto',
  'coo',
  'fumigation',
  'invoice_packing_list',
  'bl_received',
] as const;

/** KPI tile colour rules (status-colours.md section 4). */
export function kpiRole(kind: 'count_blue' | 'count_amber', value: number): ColourRole {
  if (value <= 0) return 'grey';
  return kind === 'count_blue' ? 'blue' : 'amber';
}

export function moneyKpiRole(dueInr: number, dueUsd: number, overdueCount: number): ColourRole {
  if (overdueCount > 0) return 'red';
  if (dueInr > 0 || dueUsd > 0) return 'amber';
  return 'green';
}

/** Follow-up row chip: late (red) / today (amber) / future (grey). */
export function followupRole(daysLate: number): ColourRole {
  if (daysLate > 0) return 'red';
  if (daysLate === 0) return 'amber';
  return 'grey';
}
