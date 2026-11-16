'use client';

import * as React from 'react';
import Link from 'next/link';
import { IndianRupee, Search } from 'lucide-react';
import { formatDate, formatDays, formatMoney } from '@/lib/utils';
import type { OrderBalanceRow } from '@/types/orders';
import type { MoneyFilter } from '@/types/payments';
import { ListCard, ListStack } from '@/components/ui/list-card';
import { Status } from '@/components/ui/status-badge';
import { Input } from '@/components/ui/input';
import { PhoneActions } from '@/components/ui/phone-actions';
import { EmptyState } from '@/components/ui/state-views';
import { StickyBar } from '@/components/ui/sticky-bar';
import { buttonVariants } from '@/components/ui/button';
import { useLang, useT } from '@/components/shell/lang-provider';
import { FilterChips } from '@/components/orders/filter-chips';
import { PAYMENT_LABELS } from '@/app/(dashboard)/payments/labels';
import { reminderText, waLang } from '@/app/(dashboard)/orders/helpers';

export interface MoneyListProps {
  rows: OrderBalanceRow[];
  filter: MoneyFilter;
  /** ₹ per 1 unit (INR = 1) for the "about ₹" footer */
  rates: Record<string, number>;
  company: string;
}

const STATUS_RANK: Record<string, number> = { overdue: 0, due: 1, paid: 2 };

/** Money list (screens.md 21): per order Paid / Waiting / Late, reminders, total due + about ₹. */
export function MoneyList({ rows, filter, rates, company }: MoneyListProps) {
  const lang = useLang();
  const tt = useT(PAYMENT_LABELS);
  const [q, setQ] = React.useState('');

  const counts = React.useMemo(() => {
    const c = { all: rows.length, due: 0, late: 0, waiting: 0, paid: 0 };
    for (const r of rows) {
      if (r.money_status === 'overdue') c.late += 1;
      if (r.money_status === 'due') c.waiting += 1;
      if (r.money_status === 'paid') c.paid += 1;
    }
    c.due = c.late + c.waiting;
    return c;
  }, [rows]);

  const visible = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    const list = rows.filter((r) => {
      if (filter === 'due' && r.money_status === 'paid') return false;
      if (filter === 'late' && r.money_status !== 'overdue') return false;
      if (filter === 'waiting' && r.money_status !== 'due') return false;
      if (filter === 'paid' && r.money_status !== 'paid') return false;
      if (!term) return true;
      return (
        r.buyer_name.toLowerCase().includes(term) ||
        r.order_code.toLowerCase().includes(term) ||
        (digits.length >= 3 && (r.phone ?? '').replace(/\D/g, '').includes(digits))
      );
    });
    // Late (most days first), Waiting (soonest due first), Paid (newest receipt first)
    return list.sort((a, b) => {
      const s = STATUS_RANK[a.money_status] - STATUS_RANK[b.money_status];
      if (s !== 0) return s;
      if (a.money_status === 'overdue') return b.days_overdue - a.days_overdue;
      if (a.money_status === 'due') return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
      return (b.last_received_on ?? '').localeCompare(a.last_received_on ?? '');
    });
  }, [rows, q, filter]);

  const totals = React.useMemo(() => {
    const byCur: Record<string, number> = {};
    for (const r of rows) if (r.due > 0) byCur[r.currency] = (byCur[r.currency] ?? 0) + r.due;
    const about = Object.entries(byCur).reduce((s, [cur, v]) => s + v * (rates[cur] ?? 0), 0);
    const hasForeign = Object.keys(byCur).some((c) => c !== 'INR');
    return { byCur, about, hasForeign };
  }, [rows, rates]);

  const chips = [
    { key: 'all', href: '/payments', label: tt('btn.all'), count: counts.all, active: filter === 'all' },
    { key: 'due', href: '/payments?filter=due', label: tt('payments.chip_due'), count: counts.due, active: filter === 'due' },
    { key: 'late', href: '/payments?filter=late', label: tt('status.money.overdue'), count: counts.late, active: filter === 'late' },
    { key: 'waiting', href: '/payments?filter=waiting', label: tt('status.money.due'), count: counts.waiting, active: filter === 'waiting' },
    { key: 'paid', href: '/payments?filter=paid', label: tt('status.money.paid'), count: counts.paid, active: filter === 'paid' },
  ];

  function fact1(r: OrderBalanceRow): string {
    if (r.money_status === 'paid') {
      return r.last_received_on
        ? tt('payments.received_last', { amount: formatMoney(r.received, r.currency), date: formatDate(r.last_received_on) })
        : tt('payments.received_only', { amount: formatMoney(r.received, r.currency) });
    }
    return tt('payments.due_of_total', { due: formatMoney(r.due, r.currency), total: formatMoney(r.total, r.currency) });
  }

  function fact2(r: OrderBalanceRow): string {
    let why: string | null = null;
    if (r.money_status === 'overdue') why = formatDays(r.days_overdue, lang, 'late');
    else if (r.money_status === 'due') why = r.due_date ? tt('common.due_on', { date: formatDate(r.due_date) }) : tt('common.after_dispatch');
    return [r.order_code, why].filter(Boolean).join(' · ');
  }

  function emptyKey(): string {
    if (q.trim()) return 'msg.empty.search';
    if (rows.length === 0) return 'msg.empty.money';
    if (filter === 'late') return 'msg.empty.money_late';
    if (filter === 'paid') return 'msg.empty.money_paid';
    return tt('payments.nothing_here');
  }

  const totalLine = Object.entries(totals.byCur)
    .sort(([a], [b]) => (a === 'INR' ? -1 : b === 'INR' ? 1 : a.localeCompare(b)))
    .map(([cur, v]) => formatMoney(v, cur))
    .join(' + ');

  return (
    <div className="space-y-4 pb-24 md:pb-0">
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
      <FilterChips chips={chips} ariaLabel={tt('title.money')} />

      {visible.length === 0 ? (
        <EmptyState message={emptyKey()} icon={rows.length > 0 && (filter === 'late' || filter === 'due') ? 'check' : 'inbox'} />
      ) : (
        <ListStack>
          {visible.map((r) => {
            const message =
              r.due > 0
                ? reminderText(waLang(lang, r.currency !== 'INR'), {
                    buyer: r.buyer_name,
                    due: r.due,
                    currency: r.currency,
                    orderCode: r.order_code,
                    invoiceNo: r.latest_invoice_no,
                    piNo: r.pi_no,
                    dueDate: r.due_date,
                    company,
                  })
                : null;
            return (
              <ListCard
                key={r.order_id}
                href={`/orders/${r.order_id}`}
                title={r.buyer_name}
                fact1={fact1(r)}
                fact2={fact2(r)}
                fact2ClassName={r.money_status === 'overdue' ? 'font-semibold text-rose-700' : undefined}
                badge={<Status domain="money" code={r.money_status} />}
                trailing={message ? <PhoneActions phone={r.phone} message={message} size="icon" /> : 'chevron'}
              />
            );
          })}
        </ListStack>
      )}

      {totalLine && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-base text-slate-600">{tt('payments.total_due')}</p>
          <p className="text-xl font-bold tabular-nums text-slate-900">{totalLine}</p>
          {totals.hasForeign && totals.about > 0 && (
            <p className="text-base tabular-nums text-slate-600">
              {tt('kpi.about_inr', { amount: new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(totals.about)) })}
            </p>
          )}
        </section>
      )}

      <StickyBar>
        <Link href="/payments/new" className={buttonVariants({ size: 'lg', fullWidth: true })}>
          <IndianRupee aria-hidden="true" />
          {tt('btn.money_received')}
        </Link>
      </StickyBar>
    </div>
  );
}
