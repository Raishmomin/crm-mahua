import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { isMissingObjectError } from '@/lib/db-errors';
import type {
  Dispatch,
  Order,
  OrderBalanceRow,
  OrderBuyerView,
  OrderDetail,
  OrderItem,
  OrderItemView,
  OrderListRow,
  OrderPaymentRow,
  OrderStepDates,
} from '@/types/orders';
import { ORDER_STEPS } from '@/lib/status';
import { plannedBags } from './helpers';

type Supabase = ReturnType<typeof createClient>;

/**
 * Reads use plain one-table queries joined here (no PostgREST embedding), so every query is a
 * simple RLS-checked SELECT. Missing tables / views (lower sprint state) read as empty.
 */

function logUnlessMissing(where: string, error: { code?: string; message?: string } | null) {
  if (error && !isMissingObjectError(error)) console.error(`[orders] ${where}:`, error.code, error.message);
}

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

interface ProductFacts {
  id: string;
  name: string;
  code: string;
  form: string;
  color: string;
  mesh: string | null;
  grade: string | null;
  hsn_code: string | null;
  moisture_max_pct: number | null;
}

interface PackagingFacts {
  id: string;
  name: string;
  capacity_kg: number;
  tare_weight_kg: number;
}

/** orders.step_dates (A7): keeps only the five step keys with a YYYY-MM-DD value. */
export function toStepDates(raw: unknown): OrderStepDates {
  const out: OrderStepDates = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const step of ORDER_STEPS) {
    const v = (raw as Record<string, unknown>)[step];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) out[step] = v.slice(0, 10);
  }
  return out;
}

export function toOrder(row: Record<string, unknown>): Order {
  const r = row as unknown as Order;
  return {
    ...r,
    total: n(r.total),
    advance_expected: n(r.advance_expected),
    fx_rate: r.fx_rate == null ? null : n(r.fx_rate),
    step_dates: toStepDates(r.step_dates),
  };
}

export function toDispatch(row: Record<string, unknown>): Dispatch {
  const r = row as unknown as Dispatch;
  return {
    ...r,
    qty_kg: n(r.qty_kg),
    invoice_total: n(r.invoice_total),
    bags_count: n(r.bags_count),
    export_checklist: r.export_checklist && typeof r.export_checklist === 'object' ? r.export_checklist : {},
  };
}

export function toBalance(row: Record<string, unknown>): OrderBalanceRow {
  const r = row as unknown as OrderBalanceRow;
  return {
    ...r,
    total: n(r.total),
    advance_expected: n(r.advance_expected),
    received: n(r.received),
    received_inr: r.received_inr == null ? null : n(r.received_inr),
    due: n(r.due),
    credit_days: n(r.credit_days),
    days_overdue: n(r.days_overdue),
    fx_rate: r.fx_rate == null ? null : n(r.fx_rate),
  };
}

/** One order with buyer, items (+ product / packaging facts), dispatches, money and quote number. */
export async function loadOrderDetail(supabase: Supabase, id: string): Promise<OrderDetail | null> {
  const { data: orderRow, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
  logUnlessMissing('orders', error);
  if (error || !orderRow) return null;
  const order = toOrder(orderRow);

  const [buyerRes, contactRes, itemsRes, dispatchRes, balanceRes, quoteRes, paymentsRes] = await Promise.all([
    supabase
      .from('buyers')
      .select('id, company_name, buyer_type, country, city, state, address, gstin, credit_period_days')
      .eq('id', order.buyer_id)
      .maybeSingle(),
    supabase
      .from('buyer_contacts')
      .select('name, phone, is_primary, created_at')
      .eq('buyer_id', order.buyer_id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1),
    supabase.from('order_items').select('*').eq('order_id', id).order('sort_order', { ascending: true }),
    supabase
      .from('dispatches')
      .select('*')
      .eq('order_id', id)
      .order('dispatched_on', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('v_order_balances').select('*').eq('order_id', id).maybeSingle(),
    order.quotation_id
      ? supabase.from('quotations').select('quote_no').eq('id', order.quotation_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    // RLS: Plant gets no rows (A6)
    supabase
      .from('payments')
      .select('id, receipt_no, amount, currency, received_on')
      .eq('order_id', id)
      .order('received_on', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);
  logUnlessMissing('buyers', buyerRes.error);
  logUnlessMissing('order_items', itemsRes.error);
  logUnlessMissing('dispatches', dispatchRes.error);
  logUnlessMissing('v_order_balances', balanceRes.error);
  logUnlessMissing('payments', paymentsRes.error);

  const items = ((itemsRes.data ?? []) as OrderItem[]).map((i) => ({
    ...i,
    qty_kg: n(i.qty_kg),
    rate: n(i.rate),
    amount: n(i.amount),
    gst_rate: n(i.gst_rate),
    dispatched_kg: n(i.dispatched_kg),
  }));
  const productIds = Array.from(new Set(items.map((i) => i.product_id)));
  const packagingIds = Array.from(new Set(items.map((i) => i.packaging_type_id).filter((x): x is string => !!x)));

  const [productRes, packagingRes] = await Promise.all([
    productIds.length
      ? supabase.from('products').select('id, name, code, form, color, mesh, grade, hsn_code, moisture_max_pct').in('id', productIds)
      : Promise.resolve({ data: [], error: null }),
    packagingIds.length
      ? supabase.from('packaging_types').select('id, name, capacity_kg, tare_weight_kg').in('id', packagingIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const products = new Map(((productRes.data ?? []) as ProductFacts[]).map((p) => [p.id, p]));
  const packaging = new Map(((packagingRes.data ?? []) as PackagingFacts[]).map((p) => [p.id, p]));

  const itemViews: OrderItemView[] = items.map((i) => {
    const p = products.get(i.product_id);
    const pk = i.packaging_type_id ? packaging.get(i.packaging_type_id) : undefined;
    const bagKg = pk && n(pk.capacity_kg) > 0 ? n(pk.capacity_kg) : 25;
    return {
      ...i,
      product_name: p?.name ?? '',
      product_code: p?.code ?? '',
      product_form: p?.form ?? '',
      product_color: p?.color ?? '',
      product_mesh: p?.mesh ?? null,
      product_grade: p?.grade ?? null,
      product_hsn: p?.hsn_code ?? null,
      moisture_max_pct: p?.moisture_max_pct == null ? null : n(p.moisture_max_pct),
      packaging_name: pk?.name ?? null,
      bag_kg: bagKg,
      tare_kg: pk ? n(pk.tare_weight_kg) : 0,
      planned_bags: plannedBags(i.qty_kg, bagKg),
    };
  });

  const b = (buyerRes.data ?? null) as Omit<OrderBuyerView, 'contact_name' | 'phone'> | null;
  const contact = ((contactRes.data ?? []) as { name: string | null; phone: string | null }[])[0];
  const buyer: OrderBuyerView = {
    id: order.buyer_id,
    company_name: b?.company_name ?? '',
    buyer_type: b?.buyer_type ?? null,
    country: b?.country ?? 'India',
    city: b?.city ?? null,
    state: b?.state ?? null,
    address: b?.address ?? null,
    gstin: b?.gstin ?? null,
    credit_period_days: n(b?.credit_period_days),
    contact_name: contact?.name ?? null,
    phone: contact?.phone ?? null,
  };

  return {
    order,
    buyer,
    items: itemViews,
    dispatches: ((dispatchRes.data ?? []) as Record<string, unknown>[]).map(toDispatch),
    balance: balanceRes.data ? toBalance(balanceRes.data as Record<string, unknown>) : null,
    payments: ((paymentsRes.data ?? []) as OrderPaymentRow[]).map((p) => ({ ...p, amount: n(p.amount) })),
    quote_no: (quoteRes.data as { quote_no?: string } | null)?.quote_no ?? null,
    qty_kg: itemViews.reduce((s, i) => s + i.qty_kg, 0),
    dispatched_kg: itemViews.reduce((s, i) => s + i.dispatched_kg, 0),
    planned_bags: itemViews.reduce((s, i) => s + i.planned_bags, 0),
    bag_kg: itemViews[0]?.bag_kg ?? 25,
  };
}

/**
 * Packing-card guard for Plant (screens.md 16B): Plant reads no payments (A6), so the yes / no
 * comes from fn_order_advance_waiting. On any error an order that asks for an advance stays
 * "waiting" (the office can still start packing from the full view).
 */
export async function loadAdvanceWaiting(supabase: Supabase, order: Pick<Order, 'id' | 'advance_expected'>): Promise<boolean> {
  if (order.advance_expected <= 0) return false;
  const { data, error } = await supabase.rpc('fn_order_advance_waiting', { p_order_id: order.id });
  logUnlessMissing('fn_order_advance_waiting', error);
  return error || typeof data !== 'boolean' ? true : data;
}

/** Every order of the org for the Orders list (filtered and counted on the page). */
export async function loadOrderList(supabase: Supabase): Promise<OrderListRow[]> {
  const ordersRes = await supabase
    .from('orders')
    .select('id, order_code, status, buyer_id, expected_dispatch, packed_bags, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  logUnlessMissing('orders', ordersRes.error);
  if (ordersRes.error || !ordersRes.data || ordersRes.data.length === 0) return [];

  const [itemsRes, productsRes, packagingRes, buyersRes, contactsRes, dispatchRes] = await Promise.all([
    supabase.from('order_items').select('order_id, product_id, packaging_type_id, qty_kg, sort_order').limit(5000),
    supabase.from('products').select('id, name, form, color, mesh'),
    supabase.from('packaging_types').select('id, capacity_kg'),
    supabase.from('buyers').select('id, company_name'),
    supabase.from('buyer_contacts').select('buyer_id, phone'),
    supabase
      .from('dispatches')
      .select('order_id, mode, eta, vehicle_no, container_no, dispatched_on, delivered_on, created_at')
      .order('dispatched_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5000),
  ]);

  const products = new Map(((productsRes.data ?? []) as { id: string; name: string; form: string; color: string; mesh: string | null }[]).map((p) => [p.id, p]));
  const capacity = new Map(((packagingRes.data ?? []) as { id: string; capacity_kg: number }[]).map((p) => [p.id, n(p.capacity_kg)]));
  const buyers = new Map(((buyersRes.data ?? []) as { id: string; company_name: string }[]).map((b) => [b.id, b.company_name]));
  const phones = new Map<string, string>();
  for (const c of (contactsRes.data ?? []) as { buyer_id: string; phone: string | null }[]) {
    phones.set(c.buyer_id, `${phones.get(c.buyer_id) ?? ''} ${(c.phone ?? '').replace(/\D/g, '')}`.trim());
  }
  const itemsByOrder = new Map<string, { product_id: string; packaging_type_id: string | null; qty_kg: number; sort_order: number }[]>();
  for (const i of (itemsRes.data ?? []) as { order_id: string; product_id: string; packaging_type_id: string | null; qty_kg: number; sort_order: number }[]) {
    const list = itemsByOrder.get(i.order_id) ?? [];
    list.push({ ...i, qty_kg: n(i.qty_kg) });
    itemsByOrder.set(i.order_id, list);
  }
  const latestDispatch = new Map<string, OrderListRow['latest_dispatch']>();
  for (const d of (dispatchRes.data ?? []) as (NonNullable<OrderListRow['latest_dispatch']> & { order_id: string })[]) {
    if (!latestDispatch.has(d.order_id)) {
      latestDispatch.set(d.order_id, {
        mode: d.mode,
        eta: d.eta,
        vehicle_no: d.vehicle_no,
        container_no: d.container_no,
        dispatched_on: d.dispatched_on,
        delivered_on: d.delivered_on,
      });
    }
  }

  return (ordersRes.data as { id: string; order_code: string; status: OrderListRow['status']; buyer_id: string; expected_dispatch: string | null; packed_bags: number | null; created_at: string }[]).map((o) => {
    const items = (itemsByOrder.get(o.id) ?? []).sort((a, b) => a.sort_order - b.sort_order);
    const qty = items.reduce((s, i) => s + i.qty_kg, 0);
    const planned = items.reduce((s, i) => s + plannedBags(i.qty_kg, i.packaging_type_id ? capacity.get(i.packaging_type_id) : 25), 0);
    const first = items[0] ? products.get(items[0].product_id) : undefined;
    return {
      id: o.id,
      order_code: o.order_code,
      status: o.status,
      buyer_name: buyers.get(o.buyer_id) ?? '',
      phone_digits: phones.get(o.buyer_id) ?? '',
      product: first ? { name: first.name, form: first.form, color: first.color, mesh: first.mesh } : null,
      more_items: Math.max(0, items.length - 1),
      qty_kg: qty,
      bags: o.packed_bags != null ? n(o.packed_bags) : planned,
      expected_dispatch: o.expected_dispatch,
      created_at: o.created_at,
      latest_dispatch: latestDispatch.get(o.id) ?? null,
    };
  });
}

/** Next document numbers for the dispatch confirm sheet (display only; the function assigns the real ones). */
export async function loadDocCounters(supabase: Supabase, fy: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('doc_counters').select('doc_type, current_val').eq('fy', fy).in('doc_type', ['INV', 'SDN']);
  logUnlessMissing('doc_counters', error);
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { doc_type: string; current_val: number }[]) out[r.doc_type] = n(r.current_val);
  return out;
}

/** business_settings.trade_name (or company name) for WhatsApp texts. */
export async function loadCompanyName(supabase: Supabase, orgId: string): Promise<string> {
  const { data } = await supabase.from('business_settings').select('trade_name, company_name').eq('org_id', orgId).maybeSingle();
  const d = data as { trade_name?: string | null; company_name?: string | null } | null;
  return d?.trade_name || d?.company_name || '';
}
