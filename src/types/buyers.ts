/**
 * Row shapes for buyers and buyer contacts (migration 0002) plus the money view rows the
 * buyer screens read defensively (docs/design/contracts.md 5.4, 5.5; they arrive in 0006).
 */
import type { Buyer } from './database';

export type { Buyer } from './database';
export type BuyerType = Buyer['buyer_type'];
export type BuyerIncoterm = Buyer['incoterm'];
export type BuyerStatus = Buyer['status'];

export const BUYER_TYPES: BuyerType[] = ['domestic_masala', 'domestic_food_mfr', 'export_importer', 'export_agent'];
export const BUYER_INCOTERMS: BuyerIncoterm[] = ['EXW', 'FOB', 'CIF'];

/**
 * Who may add / edit buyers (flows.md 11, screens.md 0.1). Plant (operations) holds the buyers
 * module for the read-only list and detail, so the module alone is not enough.
 */
export const BUYER_WRITE_ROLES: readonly string[] = ['owner', 'accountant', 'sales'];
export function canWriteBuyers(role: string | null | undefined): boolean {
  return typeof role === 'string' && BUYER_WRITE_ROLES.includes(role);
}

/** India vs export is derived from buyer_type (contracts 10: codes stay in the database). */
export function isExportType(type: BuyerType | string | null | undefined): boolean {
  return typeof type === 'string' && type.startsWith('export_');
}

export interface BuyerContact {
  id: string;
  org_id: string;
  buyer_id: string;
  name: string;
  designation: string | null;
  phone: string;
  email: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export type MoneyStatus = 'paid' | 'due' | 'overdue';

/** v_money_due (0006, Dev-3): one row per buyer + currency with money outstanding. */
export interface MoneyDueRow {
  org_id: string;
  buyer_id: string;
  buyer_name: string;
  phone: string | null;
  currency: string;
  total_due: number;
  orders_due: number;
  max_days_overdue: number;
  oldest_due_date: string | null;
  money_status: MoneyStatus;
}

/** v_order_balances (0006, Dev-3): the columns the buyer page uses. */
export interface OrderBalanceRow {
  order_id: string;
  org_id: string;
  order_code: string;
  pi_no: string | null;
  buyer_id: string;
  buyer_name: string;
  order_status: string;
  currency: string;
  total: number;
  received: number;
  due: number;
  due_date: string | null;
  days_overdue: number;
  money_status: MoneyStatus;
}
