import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { isMissingObjectError } from '@/lib/db-errors';
import type { Buyer, BuyerContact, MoneyDueRow, OrderBalanceRow } from '@/types/buyers';
import type { FollowUp, InquiryOpenRow } from '@/types/inquiries';

type Supabase = ReturnType<typeof createClient>;

function logUnlessMissing(where: string, error: { code?: string; message?: string } | null) {
  if (error && !isMissingObjectError(error)) console.error(`[buyers] ${where}:`, error.code, error.message);
}

/** A read of a view / table that may not be migrated yet (0005 / 0006): empty instead of an error. */
async function guardedList<T>(where: string, run: () => PromiseLike<{ data: T[] | null; error: { code?: string; message?: string } | null }>): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) {
      logUnlessMissing(where, error);
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}

export interface BuyerListRow extends Buyer {
  phone: string | null;
  contact_name: string | null;
  /** worst money row of the buyer (v_money_due) or null = nothing due */
  money: MoneyDueRow | null;
}

/** withMoney false (Plant, A6): v_money_due is not read and every row has money = null. */
export async function loadBuyerList(
  supabase: Supabase,
  { withMoney }: { withMoney: boolean }
): Promise<{ rows: BuyerListRow[]; error: boolean }> {
  const [{ data: buyers, error: bErr }, { data: contacts, error: cErr }, money] = await Promise.all([
    supabase.from('buyers').select('*').order('company_name').limit(500),
    supabase.from('buyer_contacts').select('buyer_id, name, phone, is_primary, created_at').order('is_primary', { ascending: false }).order('created_at'),
    withMoney ? guardedList<MoneyDueRow>('v_money_due', () => supabase.from('v_money_due').select('*')) : Promise.resolve([] as MoneyDueRow[]),
  ]);
  if (bErr) console.error('[buyers] list:', bErr.code, bErr.message);
  if (cErr) console.error('[buyers] contacts:', cErr.code, cErr.message);

  const primary = new Map<string, { phone: string; name: string }>();
  for (const c of contacts ?? []) if (!primary.has(c.buyer_id)) primary.set(c.buyer_id, { phone: c.phone, name: c.name });

  const worst = new Map<string, MoneyDueRow>();
  for (const m of money) {
    const cur = worst.get(m.buyer_id);
    if (!cur || rank(m) > rank(cur)) worst.set(m.buyer_id, m);
  }

  return {
    rows: ((buyers ?? []) as Buyer[]).map((b) => ({
      ...b,
      phone: primary.get(b.id)?.phone ?? null,
      contact_name: primary.get(b.id)?.name ?? null,
      money: worst.get(b.id) ?? null,
    })),
    error: Boolean(bErr),
  };
}

function rank(m: MoneyDueRow): number {
  return m.money_status === 'overdue' ? 2 + Number(m.max_days_overdue ?? 0) / 100000 : m.money_status === 'due' ? 1 : 0;
}

export interface BuyerQuoteRow {
  id: string;
  quote_no: string;
  status: string;
  total: number;
  currency: string;
  valid_till: string | null;
}
export interface BuyerOrderRow {
  id: string;
  order_code: string;
  status: string;
  total: number;
  currency: string;
}

export interface BuyerDetailData {
  buyer: Buyer;
  contacts: BuyerContact[];
  money: MoneyDueRow[];
  worstOrder: OrderBalanceRow | null;
  worstInvoiceNo: string | null;
  openInquiries: InquiryOpenRow[];
  openInquiryCount: number;
  quotes: BuyerQuoteRow[];
  orders: BuyerOrderRow[];
  followUps: FollowUp[];
  companyShort: string;
}

export async function loadBuyerDetail(supabase: Supabase, id: string): Promise<BuyerDetailData | null> {
  const { data: buyer, error } = await supabase.from('buyers').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[buyers] detail:', error.code, error.message);
    throw new Error('load failed');
  }
  if (!buyer) return null;

  const [contactsRes, money, balances, openInq, quotes, orders, followRes, companyRes] = await Promise.all([
    supabase.from('buyer_contacts').select('*').eq('buyer_id', id).order('is_primary', { ascending: false }).order('created_at'),
    guardedList<MoneyDueRow>('v_money_due', () => supabase.from('v_money_due').select('*').eq('buyer_id', id)),
    guardedList<OrderBalanceRow>('v_order_balances', () =>
      supabase.from('v_order_balances').select('*').eq('buyer_id', id).gt('due', 0).order('days_overdue', { ascending: false }).limit(1)
    ),
    guardedList<InquiryOpenRow>('v_inquiries_open', () => supabase.from('v_inquiries_open').select('*').eq('buyer_id', id).order('created_at', { ascending: false })),
    guardedList<BuyerQuoteRow>('quotations', () =>
      supabase.from('quotations').select('id, quote_no, status, total, currency, valid_till').eq('buyer_id', id).order('created_at', { ascending: false }).limit(3)
    ),
    guardedList<BuyerOrderRow>('orders', () =>
      supabase.from('orders').select('id, order_code, status, total, currency').eq('buyer_id', id).order('created_at', { ascending: false }).limit(3)
    ),
    supabase.from('follow_ups').select('*').eq('entity_type', 'buyer').eq('entity_id', id).order('created_at', { ascending: false }),
    supabase.from('business_settings').select('trade_name, company_name').maybeSingle(),
  ]);
  if (followRes.error) console.error('[buyers] follow_ups:', followRes.error.code, followRes.error.message);

  const worstOrder = balances[0] ?? null;
  const dispatches = worstOrder
    ? await guardedList<{ invoice_no: string }>('dispatches', () =>
        supabase.from('dispatches').select('invoice_no').eq('order_id', worstOrder.order_id).order('dispatched_on', { ascending: false }).limit(1)
      )
    : [];

  return {
    buyer: buyer as Buyer,
    contacts: (contactsRes.data ?? []) as BuyerContact[],
    money,
    worstOrder,
    worstInvoiceNo: dispatches[0]?.invoice_no ?? null,
    openInquiries: openInq.slice(0, 3),
    openInquiryCount: openInq.length,
    quotes,
    orders,
    followUps: (followRes.data ?? []) as FollowUp[],
    companyShort: companyRes.data?.trade_name || companyRes.data?.company_name || '',
  };
}

/** Name + phone of an inquiry for /buyers/new?from_inquiry=<id>. */
export async function loadInquiryPrefill(supabase: Supabase, inquiryId: string): Promise<{ id: string; buyer_name: string; phone: string | null; buyer_id: string | null } | null> {
  const { data, error } = await supabase.from('inquiries').select('id, buyer_name, phone, buyer_id').eq('id', inquiryId).maybeSingle();
  if (error) logUnlessMissing('inquiries', error);
  return data ?? null;
}
