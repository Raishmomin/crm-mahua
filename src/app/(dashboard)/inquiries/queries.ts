import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { isMissingObjectError } from '@/lib/db-errors';
import type { FollowUp, Inquiry, InquiryOpenRow } from '@/types/inquiries';
import type { BuyerContact } from '@/types/buyers';
import type { BuyerLite, ProductLite } from '@/components/inquiries/helpers';

type Supabase = ReturnType<typeof createClient>;

function logUnlessMissing(where: string, error: { code?: string; message?: string } | null) {
  if (error && !isMissingObjectError(error)) console.error(`[inquiries] ${where}:`, error.code, error.message);
}

/** Buyers with their primary phone, for pickers and list rows. */
export async function loadBuyersLite(supabase: Supabase): Promise<BuyerLite[]> {
  const [{ data: buyers, error: bErr }, { data: contacts, error: cErr }] = await Promise.all([
    supabase.from('buyers').select('id, company_name, city, country, buyer_type, status').order('company_name'),
    supabase.from('buyer_contacts').select('buyer_id, name, phone, is_primary, created_at').order('is_primary', { ascending: false }).order('created_at'),
  ]);
  if (bErr) console.error('[inquiries] buyers:', bErr.code, bErr.message);
  if (cErr) console.error('[inquiries] buyer_contacts:', cErr.code, cErr.message);
  const primary = new Map<string, { phone: string; name: string }>();
  for (const c of contacts ?? []) {
    if (!primary.has(c.buyer_id)) primary.set(c.buyer_id, { phone: c.phone, name: c.name });
  }
  return (buyers ?? [])
    .filter((b) => b.status !== 'blacklisted')
    .map((b) => ({
      id: b.id,
      company_name: b.company_name,
      city: b.city,
      country: b.country,
      buyer_type: b.buyer_type,
      phone: primary.get(b.id)?.phone ?? null,
      contact_name: primary.get(b.id)?.name ?? null,
    }));
}

export async function loadProductsLite(supabase: Supabase): Promise<ProductLite[]> {
  const { data, error } = await supabase.from('products').select('id, name, form, color, is_active').eq('is_active', true).order('code');
  if (error) console.error('[inquiries] products:', error.code, error.message);
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, form: p.form, color: p.color }));
}

export interface InquiryListData {
  all: Inquiry[];
  open: InquiryOpenRow[];
  buyers: BuyerLite[];
  products: ProductLite[];
  error: boolean;
}

export async function loadInquiryList(supabase: Supabase): Promise<InquiryListData> {
  const [{ data: all, error: aErr }, { data: open, error: oErr }, buyers, products] = await Promise.all([
    supabase.from('inquiries').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('v_inquiries_open').select('*').limit(500),
    loadBuyersLite(supabase),
    loadProductsLite(supabase),
  ]);
  if (aErr) console.error('[inquiries] list:', aErr.code, aErr.message);
  logUnlessMissing('v_inquiries_open', oErr);
  return {
    all: (all ?? []) as Inquiry[],
    open: (open ?? []) as InquiryOpenRow[],
    buyers,
    products,
    error: Boolean(aErr),
  };
}

export interface LinkedSample {
  id: string;
  code: string;
  status: string;
  sent_on: string | null;
  courier: string | null;
}
export interface LinkedQuote {
  id: string;
  quote_no: string;
  status: string;
  total: number;
  currency: string;
  valid_till: string | null;
}
export interface LinkedOrder {
  id: string;
  order_code: string;
  status: string;
}

export interface InquiryDetailData {
  inquiry: Inquiry;
  buyer: BuyerLite | null;
  contacts: BuyerContact[];
  product: ProductLite | null;
  assignedName: string | null;
  followUps: FollowUp[];
  sample: LinkedSample | null;
  quote: LinkedQuote | null;
  order: LinkedOrder | null;
  companyShort: string;
}

/** Everything the detail page shows. Samples / quotes / orders tables arrive in 0005 / 0006: read defensively. */
export async function loadInquiryDetail(supabase: Supabase, id: string): Promise<InquiryDetailData | null> {
  const { data: inquiry, error } = await supabase.from('inquiries').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[inquiries] detail:', error.code, error.message);
    throw new Error('load failed');
  }
  if (!inquiry) return null;
  const inq = inquiry as Inquiry;

  const [buyerRes, contactsRes, productRes, assignedRes, followRes, sampleRes, quoteRes, orderRes, companyRes] = await Promise.all([
    inq.buyer_id
      ? supabase.from('buyers').select('id, company_name, city, country, buyer_type').eq('id', inq.buyer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    inq.buyer_id
      ? supabase.from('buyer_contacts').select('*').eq('buyer_id', inq.buyer_id).order('is_primary', { ascending: false }).order('created_at')
      : Promise.resolve({ data: [], error: null }),
    inq.product_id
      ? supabase.from('products').select('id, name, form, color').eq('id', inq.product_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    inq.assigned_to
      ? supabase.from('profiles').select('full_name').eq('id', inq.assigned_to).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('follow_ups').select('*').eq('entity_type', 'inquiry').eq('entity_id', inq.id).order('created_at', { ascending: false }),
    guarded(() =>
      supabase.from('samples').select('id, code, status, sent_on, courier').eq('inquiry_id', inq.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    ),
    guarded(() =>
      supabase
        .from('quotations')
        .select('id, quote_no, status, total, currency, valid_till')
        .eq('inquiry_id', inq.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    guarded(() => supabase.from('orders').select('id, order_code, status').eq('inquiry_id', inq.id).order('created_at', { ascending: false }).limit(1).maybeSingle()),
    supabase.from('business_settings').select('trade_name, company_name').maybeSingle(),
  ]);
  if (followRes.error) console.error('[inquiries] follow_ups:', followRes.error.code, followRes.error.message);

  const contacts = (contactsRes.data ?? []) as BuyerContact[];
  const primary = contacts[0] ?? null;
  const b = buyerRes.data;
  return {
    inquiry: inq,
    buyer: b
      ? { id: b.id, company_name: b.company_name, city: b.city, country: b.country, buyer_type: b.buyer_type, phone: primary?.phone ?? null, contact_name: primary?.name ?? null }
      : null,
    contacts,
    product: (productRes.data as ProductLite | null) ?? null,
    assignedName: assignedRes.data?.full_name ?? null,
    followUps: (followRes.data ?? []) as FollowUp[],
    sample: (sampleRes as LinkedSample | null) ?? null,
    quote: (quoteRes as LinkedQuote | null) ?? null,
    order: (orderRes as LinkedOrder | null) ?? null,
    companyShort: companyRes.data?.trade_name || companyRes.data?.company_name || '',
  };
}

/** A read of a table that may not be migrated yet: null instead of an error. */
async function guarded<T>(run: () => PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>): Promise<T | null> {
  try {
    const { data, error } = await run();
    if (error) {
      logUnlessMissing('later table', error);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
