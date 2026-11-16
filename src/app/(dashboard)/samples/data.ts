import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lang } from '@/lib/i18n';
import type { Sample, SampleRow } from '@/types/samples';
import { shortProductName } from '@/components/samples/product-short';

type Supabase = SupabaseClient;

interface RawSampleRow extends Sample {
  buyers: { company_name: string } | null;
  products: { name: string; color: string | null; form: string | null; mesh: string | null } | null;
  inquiries: { code: string } | null;
}

const SELECT = '*, buyers(company_name), products(name, color, form, mesh), inquiries(code)';

/** Primary phone per buyer (first contact when none is primary). */
export async function loadBuyerPhones(supabase: Supabase, buyerIds: string[]): Promise<Map<string, string>> {
  const phones = new Map<string, string>();
  const ids = Array.from(new Set(buyerIds.filter(Boolean)));
  if (ids.length === 0) return phones;
  const { data, error } = await supabase
    .from('buyer_contacts')
    .select('buyer_id, phone, is_primary')
    .in('buyer_id', ids)
    .order('is_primary', { ascending: false });
  if (error || !data) return phones;
  for (const c of data as { buyer_id: string; phone: string; is_primary: boolean }[]) {
    if (!phones.has(c.buyer_id) && c.phone) phones.set(c.buyer_id, c.phone);
  }
  return phones;
}

function toRow(r: RawSampleRow, lang: Lang, phones: Map<string, string>): SampleRow {
  const { buyers, products, inquiries, ...sample } = r;
  return {
    ...sample,
    qty_grams: Number(sample.qty_grams),
    buyer_name: buyers?.company_name ?? '',
    product_name: products?.name ?? '',
    product_short: shortProductName(products, lang),
    inquiry_code: inquiries?.code ?? null,
    phone: phones.get(sample.buyer_id) ?? null,
  };
}

/** Every sample of the org (RLS), newest first; the page sorts and filters. */
export async function loadSampleRows(supabase: Supabase, lang: Lang): Promise<{ rows: SampleRow[]; error: boolean }> {
  const { data, error } = await supabase.from('samples').select(SELECT).order('created_at', { ascending: false }).limit(300);
  if (error) {
    console.error('[samples] list failed:', error.code, error.message);
    return { rows: [], error: true };
  }
  const raw = (data ?? []) as RawSampleRow[];
  const phones = await loadBuyerPhones(supabase, raw.map((r) => r.buyer_id));
  return { rows: raw.map((r) => toRow(r, lang, phones)), error: false };
}

export async function loadSampleRow(supabase: Supabase, id: string, lang: Lang): Promise<SampleRow | null> {
  const { data, error } = await supabase.from('samples').select(SELECT).eq('id', id).maybeSingle();
  if (error) {
    console.error('[samples] load failed:', error.code, error.message);
    return null;
  }
  if (!data) return null;
  const raw = data as RawSampleRow;
  const phones = await loadBuyerPhones(supabase, [raw.buyer_id]);
  return toRow(raw, lang, phones);
}

/** Sort for the list (screens.md 9): To send first, then Sent oldest first, then the rest newest first. */
export function sortSamples(rows: SampleRow[]): SampleRow[] {
  const rank: Record<string, number> = { to_send: 0, sent: 1, approved: 2, rejected: 2 };
  return [...rows].sort((a, b) => {
    const ra = rank[a.status] ?? 3;
    const rb = rank[b.status] ?? 3;
    if (ra !== rb) return ra - rb;
    if (a.status === 'sent' && b.status === 'sent') return (a.sent_on ?? '').localeCompare(b.sent_on ?? '');
    return b.created_at.localeCompare(a.created_at);
  });
}
