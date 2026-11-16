/**
 * Row shapes for orders, order_items, dispatches and v_order_balances
 * (docs/design/contracts.md 3.6 / 3.7 / 3.8 / 5.4). Column names mirror the tables exactly.
 */
import type { CHECKLIST_KEYS, OrderStep } from '@/lib/status';

export type OrderStatus = 'confirmed' | 'in_production' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';

export const ORDER_STATUSES: OrderStatus[] = ['confirmed', 'in_production', 'ready', 'dispatched', 'delivered', 'cancelled'];

/** The Orders "Open" chip and the Home tile: not yet dispatched, not cancelled. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = ['confirmed', 'in_production', 'ready'];

export type OrderIncoterm = 'EXW' | 'FOB Pipavav' | 'FOB Mundra' | 'CIF';

export type DispatchMode = 'truck' | 'container';

export type DispatchStatus = 'dispatched' | 'delivered';

export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

export interface ChecklistEntry {
  done: boolean;
  /** YYYY-MM-DD or null */
  date: string | null;
}

/** dispatches.export_checklist: all 8 keys for containers, {} for trucks. */
export type ExportChecklist = Partial<Record<ChecklistKey, ChecklistEntry>>;

export type MoneyStatus = 'paid' | 'due' | 'overdue';

/** orders.step_dates (contracts A7): the ISO date each step was reached; '{}' before Sprint C rows. */
export type OrderStepDates = Partial<Record<OrderStep, string>>;

export interface Order {
  id: string;
  org_id: string;
  order_code: string;
  pi_no: string;
  quotation_id: string | null;
  inquiry_id: string | null;
  buyer_id: string;
  currency: string;
  fx_rate: number | null;
  incoterm: OrderIncoterm;
  payment_terms: string;
  total: number;
  advance_expected: number;
  expected_dispatch: string | null;
  status: OrderStatus;
  status_changed_at: string;
  step_dates: OrderStepDates;
  packed_bags: number | null;
  packing_note: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  org_id: string;
  order_id: string;
  product_id: string;
  packaging_type_id: string | null;
  qty_kg: number;
  unit: 'kg' | 'MT';
  rate: number;
  amount: number;
  gst_rate: number;
  dispatched_kg: number;
  spec_text: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Dispatch {
  id: string;
  org_id: string;
  order_id: string;
  sdn_no: string;
  invoice_no: string;
  dispatched_on: string;
  mode: DispatchMode;
  vehicle_no: string | null;
  lr_no: string | null;
  transporter: string | null;
  bags_count: number;
  qty_kg: number;
  invoice_total: number;
  delivered_on: string | null;
  status: DispatchStatus;
  container_no: string | null;
  port: string | null;
  vessel: string | null;
  stuffing_date: string | null;
  eta: string | null;
  bl_no: string | null;
  export_checklist: ExportChecklist;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** v_order_balances (contracts 5.4) plus the Money-list columns appended in 0006. */
export interface OrderBalanceRow {
  order_id: string;
  org_id: string;
  order_code: string;
  pi_no: string;
  buyer_id: string;
  buyer_name: string;
  order_status: OrderStatus;
  currency: string;
  fx_rate: number | null;
  total: number;
  advance_expected: number;
  received: number;
  received_inr: number | null;
  last_received_on: string | null;
  due: number;
  advance_ok: boolean;
  latest_dispatch_on: string | null;
  credit_days: number;
  due_date: string | null;
  days_overdue: number;
  money_status: MoneyStatus;
  payment_terms: string;
  phone: string | null;
  latest_invoice_no: string | null;
  created_at: string;
}

/** An order item with the product and packaging facts the screens and papers need. */
export interface OrderItemView extends OrderItem {
  product_name: string;
  product_code: string;
  product_form: string;
  product_color: string;
  product_mesh: string | null;
  product_grade: string | null;
  product_hsn: string | null;
  moisture_max_pct: number | null;
  packaging_name: string | null;
  bag_kg: number;
  tare_kg: number;
  planned_bags: number;
}

export interface OrderBuyerView {
  id: string;
  company_name: string;
  /** buyers.buyer_type: export_* decides export vs India (orders/helpers.ts isExportBuyer). */
  buyer_type: string | null;
  country: string;
  city: string | null;
  state: string | null;
  address: string | null;
  gstin: string | null;
  credit_period_days: number;
  contact_name: string | null;
  phone: string | null;
}

/** One receipt line in the order's Money block (links to /payments/[id]). */
export interface OrderPaymentRow {
  id: string;
  receipt_no: string;
  amount: number;
  currency: string;
  received_on: string;
}

/** Everything the order detail, packing card, dispatch form, checklist and papers read. */
export interface OrderDetail {
  order: Order;
  buyer: OrderBuyerView;
  items: OrderItemView[];
  /** newest first */
  dispatches: Dispatch[];
  balance: OrderBalanceRow | null;
  /** receipts of the order, oldest first (empty for Plant: A6) */
  payments: OrderPaymentRow[];
  quote_no: string | null;
  qty_kg: number;
  dispatched_kg: number;
  planned_bags: number;
  bag_kg: number;
}

/** One row of the Orders list. */
export interface OrderListRow {
  id: string;
  order_code: string;
  status: OrderStatus;
  buyer_name: string;
  phone_digits: string;
  /** first item's product (form / colour / mesh are translated on screen) */
  product: { name: string; form: string; color: string; mesh: string | null } | null;
  /** items after the first */
  more_items: number;
  qty_kg: number;
  bags: number;
  expected_dispatch: string | null;
  created_at: string;
  latest_dispatch: Pick<Dispatch, 'mode' | 'eta' | 'vehicle_no' | 'container_no' | 'dispatched_on' | 'delivered_on'> | null;
}
