import React from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { cn, formatMoney } from '@/lib/utils';
import { canWriteBuyers, isExportType } from '@/types/buyers';
import { PageHeader } from '@/components/ui/back-button';
import { ListCard, ListStack } from '@/components/ui/list-card';
import { Status } from '@/components/ui/status-badge';
import { PhoneActions } from '@/components/ui/phone-actions';
import { EmptyState, ErrorState } from '@/components/ui/state-views';
import { StickyBar } from '@/components/ui/sticky-bar';
import { buttonVariants } from '@/components/ui/button';
import { inputClasses } from '@/components/ui/input';
import { matchesSearch } from '@/components/inquiries/helpers';
import { loadBuyerList } from './queries';
import { BUYER_LABELS } from './labels';

export const dynamic = 'force-dynamic';

type Search = Record<string, string | string[] | undefined>;
type TypeChip = 'india' | 'export';

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}

/** Buyers list (screens.md 6): search, All / India / Export chips, money-due pill, Call / WhatsApp.
 *  Plant (A6, G3-02 / SEC3-03): no money fact, pill or money sort; v_money_due is not read. */
export default async function BuyersPage({ searchParams }: { searchParams?: Search }) {
  const profile = await requireModule('buyers'); // Wall 2
  const lang = getLang();
  const typeParam = first(searchParams?.type);
  const type: TypeChip | null = typeParam === 'india' || typeParam === 'export' ? typeParam : null;
  const q = first(searchParams?.q).trim();
  const canWrite = canWriteBuyers(profile.role); // Plant: read only
  const isPlant = profile.role === 'operations'; // A6: Plant does not see money

  const supabase = createClient();
  const { rows, error } = await loadBuyerList(supabase, { withMoney: !isPlant });
  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title={t(lang, 'title.buyers')} />
        <ErrorState retryHref="/buyers" lang={lang} />
      </div>
    );
  }

  const counts = { all: rows.length, india: rows.filter((r) => !isExportType(r.buyer_type)).length, export: rows.filter((r) => isExportType(r.buyer_type)).length };
  const filtered = rows
    .filter((r) => (type === 'india' ? !isExportType(r.buyer_type) : type === 'export' ? isExportType(r.buyer_type) : true))
    .filter((r) => matchesSearch(q, [r.company_name, r.phone, r.contact_name, r.city, r.buyer_code]))
    .sort((a, b) => {
      if (isPlant) return a.company_name.localeCompare(b.company_name);
      const ra = a.money?.money_status === 'overdue' ? 0 : a.money ? 1 : 2;
      const rb = b.money?.money_status === 'overdue' ? 0 : b.money ? 1 : 2;
      if (ra !== rb) return ra - rb;
      return a.company_name.localeCompare(b.company_name);
    });

  const chipHref = (value: TypeChip | null) => {
    const p = new URLSearchParams();
    if (value) p.set('type', value);
    if (q) p.set('q', q);
    const s = p.toString();
    return s ? `/buyers?${s}` : '/buyers';
  };
  const chips: { value: TypeChip | null; label: string; count: number }[] = [
    { value: null, label: t(lang, 'btn.all'), count: counts.all },
    { value: 'india', label: t(lang, 'field.buyer.india'), count: counts.india },
    { value: 'export', label: t(lang, 'field.buyer.export'), count: counts.export },
  ];

  return (
    <div className={cn('space-y-4', canWrite && 'pb-28 md:pb-0')}>
      <PageHeader title={t(lang, 'title.buyers')} subtitle={String(filtered.length)} />

      <form action="/buyers" method="get" role="search" className="relative">
        {type && <input type="hidden" name="type" value={type} />}
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t(lang, 'common.search_placeholder')}
          aria-label={t(lang, 'btn.search')}
          autoComplete="off"
          className={cn(inputClasses, 'pl-12')}
        />
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="tablist">
        {chips.map((c) => {
          const active = c.value === type;
          return (
            <Link
              key={c.value ?? 'all'}
              href={chipHref(c.value)}
              role="tab"
              aria-selected={active}
              className={cn(
                'inline-flex h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-base font-medium',
                active ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              )}
            >
              {c.label}
              <span className={cn('text-sm', active ? 'text-emerald-100' : 'text-slate-500')}>{c.count}</span>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          message={q ? t(lang, 'buyers.no_match', undefined, BUYER_LABELS) : t(lang, 'msg.empty.buyers')}
          lang={lang}
          actionLabel={rows.length === 0 && canWrite ? t(lang, 'btn.new_buyer') : undefined}
          actionHref={rows.length === 0 && canWrite ? '/buyers/new' : undefined}
        />
      ) : (
        <ListStack>
          {filtered.map((r) => {
            const place = [r.city, isExportType(r.buyer_type) || r.country !== 'India' ? r.country : null].filter(Boolean).join(', ');
            const due = isPlant
              ? undefined
              : r.money
                ? formatMoney(r.money.total_due, r.money.currency)
                : formatMoney(0, r.preferred_currency === 'USD' ? 'USD' : 'INR');
            return (
              <ListCard
                key={r.id}
                href={`/buyers/${r.id}`}
                title={r.company_name}
                fact1={place || undefined}
                fact2={due}
                fact2ClassName={!isPlant && r.money?.money_status === 'overdue' ? 'text-rose-700 font-semibold' : undefined}
                badge={isPlant ? undefined : <Status domain="money" code={r.money?.money_status ?? 'paid'} lang={lang} />}
                trailing={<PhoneActions phone={r.phone} size="icon" lang={lang} />}
              />
            );
          })}
        </ListStack>
      )}

      {canWrite && (
        <StickyBar>
          <Link href="/buyers/new" className={buttonVariants({ fullWidth: true })}>
            <Plus aria-hidden="true" />
            {t(lang, 'btn.new_buyer')}
          </Link>
        </StickyBar>
      )}
    </div>
  );
}
