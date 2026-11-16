import React from 'react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { isMissingObjectError } from '@/lib/db-errors';
import { PageHeader } from '@/components/ui/back-button';
import { ProductList, type ProductPrice, type ProductRow } from '@/components/catalog/product-list';

interface PriceRow extends ProductPrice {
  product_id: string;
  effective_from: string;
}

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/**
 * Products (screens.md 23): read-only. Cost per kg (v_product_costs, security_invoker; RLS lets only
 * owner / accountant read product_costs) is queried and shown only for those two roles.
 */
export default async function CatalogPage() {
  const profile = await requireModule('catalog'); // Wall 2
  const lang = getLang();
  const supabase = createClient();
  const showCost = profile.role === 'owner' || profile.role === 'accountant';

  const [productsRes, pricesRes, costsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, code, name, form, color, mesh, grade, moisture_max_pct, hsn_code, gst_rate')
      .eq('is_active', true)
      .order('code', { ascending: true }),
    supabase
      .from('price_list_items')
      .select('product_id, currency, unit, rate, floor_price, effective_from')
      .eq('is_active', true)
      .order('effective_from', { ascending: false }),
    showCost
      ? supabase.from('v_product_costs').select('product_id, total_cost_per_kg, effective_date').order('effective_date', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [name, res] of [['products', productsRes], ['price_list_items', pricesRes], ['v_product_costs', costsRes]] as const) {
    if (res.error && !isMissingObjectError(res.error)) console.error(`[catalog] ${name}:`, res.error.code, res.error.message);
  }

  // Latest active row per product and currency (rows come newest first).
  const prices = new Map<string, PriceRow>();
  for (const p of (pricesRes.data ?? []) as PriceRow[]) {
    const key = `${p.product_id}:${p.currency}`;
    if (!prices.has(key)) prices.set(key, p);
  }
  const costs = new Map<string, number>();
  for (const c of (costsRes.data ?? []) as { product_id: string; total_cost_per_kg: number }[]) {
    if (!costs.has(c.product_id)) costs.set(c.product_id, n(c.total_cost_per_kg));
  }
  const price = (productId: string, cur: string): ProductPrice | null => {
    const p = prices.get(`${productId}:${cur}`);
    return p ? { currency: cur, unit: p.unit, rate: n(p.rate), floor_price: n(p.floor_price) } : null;
  };

  const rows: ProductRow[] = ((productsRes.data ?? []) as Omit<ProductRow, 'inr' | 'usd' | 'cost'>[]).map((p) => ({
    ...p,
    moisture_max_pct: n(p.moisture_max_pct),
    gst_rate: n(p.gst_rate),
    inr: price(p.id, 'INR'),
    usd: price(p.id, 'USD'),
    cost: showCost ? costs.get(p.id) ?? null : null,
  }));

  return (
    <div className="space-y-4">
      <PageHeader title={t(lang, 'title.products')} />
      <ProductList rows={rows} showCost={showCost} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
