'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, Layers, Lock, Search, Sparkles } from 'lucide-react';
import { cn, formatMoney, formatRate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/state-views';
import { useLang, useT } from '@/components/shell/lang-provider';
import { CATALOG_LABELS } from '@/app/(dashboard)/catalog/labels';
import { productShort } from '@/app/(dashboard)/orders/helpers';

export interface ProductPrice {
  currency: string;
  unit: string;
  rate: number;
  floor_price: number;
}

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  form: string;
  color: string;
  mesh: string | null;
  grade: string;
  moisture_max_pct: number;
  hsn_code: string;
  gst_rate: number;
  inr: ProductPrice | null;
  usd: ProductPrice | null;
  /** total cost per kg; present only for owner / accounts (v_product_costs) */
  cost: number | null;
}

/** Products (screens.md 23): read-only rows, tap to expand; cost with a lock only for owner / accounts. */
export function ProductList({ rows, showCost }: { rows: ProductRow[]; showCost: boolean }) {
  const lang = useLang();
  const tt = useT(CATALOG_LABELS);
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState<string | null>(null);

  const visible = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => `${r.name} ${r.code} ${productShort(lang, r)}`.toLowerCase().includes(term));
  }, [rows, q, lang]);

  if (rows.length === 0) return <EmptyState message={tt('catalog.empty')} />;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input type="search" autoComplete="off" aria-label={tt('catalog.search')} placeholder={tt('catalog.search')} value={q} onChange={(e) => setQ(e.target.value)} className="pl-12" />
      </div>

      {visible.length === 0 ? (
        <EmptyState message="msg.empty.search" />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white md:space-y-2 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent">
          {visible.map((r) => {
            const expanded = open === r.id;
            const Icon = r.form === 'powder' ? Sparkles : Layers;
            const rates = [r.inr ? formatRate(r.inr.rate, 'INR', r.inr.unit) : null, r.usd ? formatRate(r.usd.rate, 'USD', r.usd.unit) : null].filter(Boolean).join(' · ');
            const floors = [r.inr ? formatMoney(r.inr.floor_price, 'INR') : null, r.usd ? formatMoney(r.usd.floor_price, 'USD') : null].filter(Boolean).join(' · ');
            return (
              <li key={r.id} className="border-b border-slate-200 bg-white last:border-b-0 md:rounded-xl md:border">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : r.id)}
                  className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                >
                  <Icon className="h-6 w-6 shrink-0 text-slate-500" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-semibold text-slate-900">{productShort(lang, r)}</div>
                    {rates && <div className="truncate text-base text-slate-700">{rates}</div>}
                    <div className="flex flex-wrap items-center gap-x-3 text-base text-slate-500">
                      {floors && (
                        <span>
                          {tt('product.floor')} {floors}
                        </span>
                      )}
                      {showCost && r.cost != null && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Lock className="h-4 w-4" aria-label={tt('product.cost')} />
                          {formatMoney(r.cost, 'INR', { decimals: Number.isInteger(r.cost) ? 0 : 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                  {expanded ? <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" /> : <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />}
                </button>
                {expanded && (
                  <div className={cn('space-y-1 border-t border-slate-100 px-4 pb-4 pt-3 text-base text-slate-700')}>
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p>{tt('catalog.grade', { grade: r.grade })}</p>
                    <p>{tt('catalog.moisture', { pct: r.moisture_max_pct })}</p>
                    <p>{tt('catalog.hsn_gst', { hsn: r.hsn_code, gst: r.gst_rate })}</p>
                    {showCost && (
                      <p className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Lock className="h-4 w-4" aria-hidden="true" />
                        {r.cost != null ? `${tt('catalog.cost_line', { cost: formatMoney(r.cost, 'INR', { decimals: 2 }) })} · ` : ''}
                        {tt('common.locked_cost')}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
