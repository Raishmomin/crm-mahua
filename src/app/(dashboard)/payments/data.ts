import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { isMissingObjectError } from '@/lib/db-errors';
import type { OrderBalanceRow } from '@/types/orders';
import type { Payment, ReceiptView } from '@/types/payments';
import { toBalance } from '@/app/(dashboard)/orders/data';

type Supabase = ReturnType<typeof createClient>;

/** v_order_balances: one row per order that is not cancelled (RLS: own org). Empty before 0006. */
export async function loadBalances(supabase: Supabase): Promise<OrderBalanceRow[]> {
  const { data, error } = await supabase.from('v_order_balances').select('*').order('created_at', { ascending: false }).limit(1000);
  if (error) {
    if (!isMissingObjectError(error)) console.error('[payments] v_order_balances:', error.code, error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(toBalance);
}

/** app_settings.settings.currency_rates (₹ per 1 unit), e.g. { USD: 84.25 }. */
export async function loadRates(supabase: Supabase, orgId: string): Promise<Record<string, number>> {
  const { data } = await supabase.from('app_settings').select('settings').eq('org_id', orgId).maybeSingle();
  const raw = ((data as { settings?: { currency_rates?: Record<string, unknown> } } | null)?.settings?.currency_rates ?? {}) as Record<string, unknown>;
  const out: Record<string, number> = { INR: 1 };
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k.toUpperCase()] = n;
  }
  return out;
}

const num = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/**
 * One receipt for /payments/[id] and its print (A12): the payment, its order, buyer, primary
 * contact and the order's due now. Plain one-table RLS reads; null when not visible (other org,
 * Plant per A6) or missing.
 */
export async function loadReceipt(supabase: Supabase, id: string): Promise<ReceiptView | null> {
  const { data, error } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
  if (error && !isMissingObjectError(error)) console.error('[payments] payments:', error.code, error.message);
  if (error || !data) return null;
  const p = data as Payment;
  const payment: Payment = {
    ...p,
    amount: num(p.amount),
    amount_inr: p.amount_inr == null ? null : num(p.amount_inr),
    fx_rate: p.fx_rate == null ? null : num(p.fx_rate),
  };

  const [orderRes, buyerRes, contactRes, balanceRes] = await Promise.all([
    supabase.from('orders').select('order_code, pi_no').eq('id', payment.order_id).maybeSingle(),
    supabase.from('buyers').select('company_name, buyer_type, country, city, state, address').eq('id', payment.buyer_id).maybeSingle(),
    supabase
      .from('buyer_contacts')
      .select('name, phone')
      .eq('buyer_id', payment.buyer_id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1),
    supabase.from('v_order_balances').select('due').eq('order_id', payment.order_id).maybeSingle(),
  ]);
  const order = orderRes.data as { order_code: string; pi_no: string } | null;
  const buyer = buyerRes.data as Pick<ReceiptView, 'buyer_type' | 'country' | 'city' | 'state' | 'address'> & { company_name: string } | null;
  const contact = ((contactRes.data ?? []) as { name: string | null; phone: string | null }[])[0];

  return {
    payment,
    order_code: order?.order_code ?? '',
    pi_no: order?.pi_no ?? '',
    buyer_name: buyer?.company_name ?? '',
    buyer_type: buyer?.buyer_type ?? null,
    country: buyer?.country ?? null,
    city: buyer?.city ?? null,
    state: buyer?.state ?? null,
    address: buyer?.address ?? null,
    contact_name: contact?.name ?? null,
    phone: contact?.phone ?? null,
    due_now: balanceRes.data ? num((balanceRes.data as { due: unknown }).due) : null,
  };
}
