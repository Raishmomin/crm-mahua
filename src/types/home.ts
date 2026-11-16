/**
 * Row shapes of the Home views (docs/design/contracts.md section 5).
 * The views arrive in Sprint B (0004 / 0006); Home renders zeros until then.
 */

export interface HomeKpis {
  org_id: string;
  new_inquiries: number;
  quotes_waiting: number;
  orders_in_production: number;
  money_due_inr: number;
  money_due_usd: number;
  money_due_about_inr: number;
  money_overdue_count: number;
  followups_today: number;
  papers_pending: number;
}

export const EMPTY_KPIS: Omit<HomeKpis, 'org_id'> = {
  new_inquiries: 0,
  quotes_waiting: 0,
  orders_in_production: 0,
  money_due_inr: 0,
  money_due_usd: 0,
  money_due_about_inr: 0,
  money_overdue_count: 0,
  followups_today: 0,
  papers_pending: 0,
};

export type FollowupEntityType = 'inquiry' | 'buyer' | 'quote' | 'order' | 'payment';

export interface FollowupTodayRow {
  id: string;
  org_id: string;
  entity_type: FollowupEntityType;
  entity_id: string;
  note: string;
  due_on: string;
  days_late: number;
  buyer_id: string | null;
  buyer_name: string | null;
  phone: string | null;
  inquiry_code: string | null;
}

export interface OrderInProductionRow {
  id: string;
  org_id: string;
  order_code: string;
  pi_no: string | null;
  buyer_id: string;
  buyer_name: string;
  city: string | null;
  country: string | null;
  status: 'confirmed' | 'in_production' | 'ready';
  status_changed_at: string | null;
  currency: string;
  total: number;
  advance_expected: number;
  planned_bags: number;
  bag_kg: number;
  packed_bags: number;
  expected_dispatch: string | null;
  packing_note: string | null;
  product_summary: string | null;
  qty_kg: number;
  days_since_confirmed: number;
}
