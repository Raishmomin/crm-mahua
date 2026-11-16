/**
 * Row shapes for payments and v_money_due (docs/design/contracts.md 3.9 / 5.5).
 * Payments are append-only and written only by fn_payment_record.
 */

export type PayMode = 'cash' | 'bank' | 'upi' | 'cheque' | 'lc';

export const PAY_MODES: PayMode[] = ['cash', 'bank', 'upi', 'cheque', 'lc'];

export interface Payment {
  id: string;
  org_id: string;
  receipt_no: string;
  order_id: string;
  buyer_id: string;
  amount: number;
  currency: string;
  /** rupee value for non-INR receipts; NULL for INR */
  amount_inr: number | null;
  /** ₹ per 1 unit of currency; NULL for INR */
  fx_rate: number | null;
  received_on: string;
  mode: PayMode;
  reference: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

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
  money_status: 'due' | 'overdue';
}

/** Money list filters (?filter=): due = Late + Waiting (the Home tile). */
export type MoneyFilter = 'all' | 'due' | 'late' | 'waiting' | 'paid';

export const MONEY_FILTERS: MoneyFilter[] = ['all', 'due', 'late', 'waiting', 'paid'];

/** An order the Money received form can pick. */
export interface PaymentOrderOption {
  order_id: string;
  order_code: string;
  buyer_name: string;
  currency: string;
  total: number;
  due: number;
  /** advance asked on the order, received so far, received >= advance (G2-10 prefill) */
  advance_expected: number;
  received: number;
  advance_ok: boolean;
  fx_rate: number | null;
  phone: string | null;
  is_export: boolean;
}

/** The receipt view and receipt print (A12): one payment with its order, buyer and contact. */
export interface ReceiptView {
  payment: Payment;
  order_code: string;
  pi_no: string;
  buyer_name: string;
  buyer_type: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  contact_name: string | null;
  phone: string | null;
  /** what is still due on the order now (order currency); null when not readable */
  due_now: number | null;
}
