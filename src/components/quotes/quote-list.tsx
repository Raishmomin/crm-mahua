'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { QuoteListRow } from '@/types/quotes';
import { QUOTE_STATUSES } from '@/types/quotes';
import { cn, formatDate, formatDays, formatMoney } from '@/lib/utils';
import { ListCard, ListStack } from '@/components/ui/list-card';
import { Status } from '@/components/ui/status-badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/state-views';
import { Toast, useToast } from '@/components/ui/toast';
import { useLang, useT } from '@/components/shell/lang-provider';
import { QUOTE_LABELS } from '@/app/(dashboard)/quotes/labels';

export interface QuoteListProps {
  rows: QuoteListRow[];
  statusFilter: string | null;
  savedCode?: string | null;
  /** quote id -> order code for accepted rows (empty before 0006) */
  orderCodes: Record<string, string>;
}

/** Quotes list (screens.md 11): search, status chips incl. derived Expired, ListCard rows. */
export function QuoteList({ rows, statusFilter, savedCode, orderCodes }: QuoteListProps) {
  const lang = useLang();
  const tt = useT(QUOTE_LABELS);
  const { toast, show, clear } = useToast();
  const [q, setQ] = React.useState('');

  React.useEffect(() => {
    if (savedCode) show('success', tt('msg.saved_code', { code: savedCode }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCode]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const s of QUOTE_STATUSES) c[s] = rows.filter((r) => r.display_status === s).length;
    return c;
  }, [rows]);

  const visible = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && r.display_status !== statusFilter) return false;
      if (!term) return true;
      return r.buyer_name.toLowerCase().includes(term) || r.quote_no.toLowerCase().includes(term);
    });
  }, [rows, q, statusFilter]);

  const chips: { value: string | null; label: string; count: number }[] = [
    { value: null, label: tt('btn.all'), count: counts.all },
    ...QUOTE_STATUSES.map((s) => ({ value: s, label: tt(`status.quote.${s}`), count: counts[s] })),
  ];

  function fact1(r: QuoteListRow): string {
    const total = formatMoney(r.total, r.currency);
    if (r.display_status === 'accepted') {
      const code = orderCodes[r.id];
      return code ? `${total} · ${tt('quotes.order_line', { code })}` : total;
    }
    if (r.display_status === 'rejected') {
      return `${total} · ${tt('msg.lost_with_reason', { reason: r.reject_reason ? tt(`lost_reason.${r.reject_reason}`) : '' }).trim()}`;
    }
    return `${total} · ${tt('quotes.expires_in', { date: formatDate(r.valid_till) })}`;
  }

  function fact2(r: QuoteListRow): string {
    if (r.display_status === 'sent' || r.display_status === 'draft') {
      return `${r.quote_no} · ${r.days_left >= 0 ? formatDays(r.days_left, lang, 'left') : formatDays(-r.days_left, lang, 'late')}`;
    }
    return r.quote_no;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input
          type="search"
          autoComplete="off"
          aria-label={tt('btn.search')}
          placeholder={tt('common.search_placeholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-12"
        />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={tt('title.quotes')}>
        {chips.map((c) => {
          const active = (statusFilter ?? null) === c.value;
          return (
            <Link
              key={c.value ?? 'all'}
              role="tab"
              aria-selected={active}
              href={c.value ? `/quotes?status=${c.value}` : '/quotes'}
              className={cn(
                'inline-flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-base font-medium',
                active ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white text-slate-800'
              )}
            >
              {c.label}
              <span className={cn('text-sm', active ? 'text-emerald-100' : 'text-slate-500')}>{c.count}</span>
            </Link>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState message={q.trim() ? 'msg.empty.search' : 'msg.empty.quotes'} />
      ) : (
        <ListStack>
          {visible.map((r) => (
            <ListCard
              key={r.id}
              href={`/quotes/${r.id}`}
              title={r.buyer_name}
              fact1={fact1(r)}
              fact2={fact2(r)}
              fact2ClassName={r.display_status === 'sent' && r.days_left <= 2 ? 'font-semibold text-amber-700' : undefined}
              badge={<Status domain="quote" code={r.display_status} />}
            />
          ))}
        </ListStack>
      )}
      <Toast toast={toast} onClose={clear} />
    </div>
  );
}
