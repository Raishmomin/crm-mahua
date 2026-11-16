import React from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { cn, formatDays, formatQty } from '@/lib/utils';
import { INQUIRY_STATUSES, OPEN_STATUSES, type InquiryStatus } from '@/types/inquiries';
import { PageHeader } from '@/components/ui/back-button';
import { ListCard, ListStack } from '@/components/ui/list-card';
import { Status } from '@/components/ui/status-badge';
import { PhoneActions } from '@/components/ui/phone-actions';
import { EmptyState, ErrorState } from '@/components/ui/state-views';
import { StickyBar } from '@/components/ui/sticky-bar';
import { buttonVariants } from '@/components/ui/button';
import { inputClasses } from '@/components/ui/input';
import { matchesSearch, productShortName, STATUS_ORDER } from '@/components/inquiries/helpers';
import { loadInquiryList } from './queries';
import { INQUIRY_LABELS } from './labels';

export const dynamic = 'force-dynamic';

type Search = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}

/** Inquiries list (screens.md 3): search, status chips, ListCards with Call / WhatsApp. */
export default async function InquiriesPage({ searchParams }: { searchParams?: Search }) {
  await requireModule('leads'); // Wall 2
  const lang = getLang();
  const tl = (key: string, vars?: Record<string, string | number>) => t(lang, key, vars, INQUIRY_LABELS);

  const statusParam = first(searchParams?.status);
  const status = (INQUIRY_STATUSES as string[]).includes(statusParam) ? (statusParam as InquiryStatus) : null;
  const q = first(searchParams?.q).trim();

  const supabase = createClient();
  const data = await loadInquiryList(supabase);
  if (data.error) {
    return (
      <div className="space-y-4">
        <PageHeader title={t(lang, 'title.inquiries')} />
        <ErrorState retryHref="/inquiries" lang={lang} />
      </div>
    );
  }

  const buyerById = new Map(data.buyers.map((b) => [b.id, b]));
  const productById = new Map(data.products.map((p) => [p.id, p]));
  const openById = new Map(data.open.map((o) => [o.id, o]));

  const rows = data.all.map((i) => {
    const buyer = i.buyer_id ? buyerById.get(i.buyer_id) : undefined;
    const product = i.product_id ? productById.get(i.product_id) : undefined;
    const open = openById.get(i.id);
    const createdDays = open ? Number(open.days_old) : Math.max(0, Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86400000));
    return {
      id: i.id,
      code: i.code,
      status: i.status,
      created_at: i.created_at,
      title: buyer?.company_name ?? i.buyer_name,
      product: productShortName(lang, product, i.product_text || open?.product_name),
      qty: i.qty_kg,
      phone: buyer?.phone ?? i.phone,
      days: createdDays,
      lateColour: createdDays > 7 && (i.status === 'new' || i.status === 'talking'),
    };
  });

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const openCount = rows.filter((r) => (OPEN_STATUSES as string[]).includes(r.status)).length;

  const filtered = rows
    .filter((r) => (status ? r.status === status : (OPEN_STATUSES as string[]).includes(r.status)))
    .filter((r) => matchesSearch(q, [r.title, r.phone, r.code, r.product]))
    .sort((a, b) => {
      const d = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (d !== 0) return d;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const chips: { value: string | null; label: string; count: number }[] = [
    { value: null, label: t(lang, 'btn.all'), count: openCount },
    ...INQUIRY_STATUSES.map((s) => ({ value: s, label: t(lang, `status.inquiry.${s}`), count: counts[s] ?? 0 })),
  ];

  const chipHref = (value: string | null) => {
    const p = new URLSearchParams();
    if (value) p.set('status', value);
    if (q) p.set('q', q);
    const s = p.toString();
    return s ? `/inquiries?${s}` : '/inquiries';
  };

  const emptyMessage = q ? 'inquiries.no_match' : rows.length === 0 ? 'msg.empty.inquiries' : 'inquiries.empty_chip';

  return (
    <div className="space-y-4 pb-28 md:pb-0">
      <PageHeader title={t(lang, 'title.inquiries')} subtitle={String(filtered.length)} />

      <form action="/inquiries" method="get" role="search" className="relative">
        {status && <input type="hidden" name="status" value={status} />}
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
          const active = c.value === status;
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
          message={tl(emptyMessage)}
          lang={lang}
          actionLabel={rows.length === 0 ? t(lang, 'btn.new_inquiry') : undefined}
          actionHref={rows.length === 0 ? '/inquiries/new' : undefined}
        />
      ) : (
        <ListStack>
          {filtered.map((r) => (
            <ListCard
              key={r.id}
              href={`/inquiries/${r.id}`}
              title={r.title}
              fact1={[r.product, r.qty ? formatQty(r.qty, lang) : null].filter(Boolean).join(' · ')}
              fact2={r.days === 0 ? t(lang, 'common.today') : formatDays(r.days, lang, 'old')}
              fact2ClassName={r.lateColour ? 'text-rose-700 font-semibold' : undefined}
              badge={<Status domain="inquiry" code={r.status} lang={lang} />}
              trailing={<PhoneActions phone={r.phone} size="icon" lang={lang} />}
            />
          ))}
        </ListStack>
      )}

      <StickyBar>
        <Link href="/inquiries/new" className={buttonVariants({ fullWidth: true })}>
          <Plus aria-hidden="true" />
          {t(lang, 'btn.new_inquiry')}
        </Link>
      </StickyBar>
    </div>
  );
}
