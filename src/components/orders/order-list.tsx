'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { formatDate, formatQty } from '@/lib/utils';
import type { OrderListRow, OrderStatus } from '@/types/orders';
import { OPEN_ORDER_STATUSES, ORDER_STATUSES } from '@/types/orders';
import { ListCard, ListStack } from '@/components/ui/list-card';
import { Status } from '@/components/ui/status-badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/state-views';
import { useLang, useT } from '@/components/shell/lang-provider';
import { ORDER_LABELS } from '@/app/(dashboard)/orders/labels';
import { productShort } from '@/app/(dashboard)/orders/helpers';
import { FilterChips } from './filter-chips';
import { OrderDots } from './order-dots';

export type OrderFilter = 'open' | 'all' | OrderStatus;

/** Orders list (screens.md 15): search, Open / All / status chips, rows with a tiny stepper. */
export function OrderList({ rows, filter }: { rows: OrderListRow[]; filter: OrderFilter }) {
  const lang = useLang();
  const tt = useT(ORDER_LABELS);
  const [q, setQ] = React.useState('');

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: rows.length, open: 0 };
    for (const s of ORDER_STATUSES) c[s] = 0;
    for (const r of rows) {
      c[r.status] = (c[r.status] ?? 0) + 1;
      if (OPEN_ORDER_STATUSES.includes(r.status)) c.open += 1;
    }
    return c;
  }, [rows]);

  const visible = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    const list = rows.filter((r) => {
      if (filter === 'open' && !OPEN_ORDER_STATUSES.includes(r.status)) return false;
      if (filter !== 'open' && filter !== 'all' && r.status !== filter) return false;
      if (!term) return true;
      return (
        r.buyer_name.toLowerCase().includes(term) ||
        r.order_code.toLowerCase().includes(term) ||
        (digits.length >= 3 && r.phone_digits.includes(digits))
      );
    });
    if (filter === 'open') {
      // open: ship-by soonest first
      list.sort((a, b) => (a.expected_dispatch ?? '9999').localeCompare(b.expected_dispatch ?? '9999'));
    }
    return list;
  }, [rows, q, filter]);

  const chipStatuses = ORDER_STATUSES.filter((s) => s !== 'cancelled' || counts.cancelled > 0);
  const chips = [
    { key: 'open', href: '/orders?status=open', label: tt('btn.open'), count: counts.open, active: filter === 'open' },
    { key: 'all', href: '/orders?status=all', label: tt('btn.all'), count: counts.all, active: filter === 'all' },
    ...chipStatuses.map((s) => ({ key: s, href: `/orders?status=${s}`, label: tt(`status.order.${s}`), count: counts[s], active: filter === s })),
  ];

  function fact1(r: OrderListRow): string {
    const product = r.product ? productShort(lang, r.product) : '';
    const more = r.more_items > 0 ? ` +${r.more_items}` : '';
    return [product + more, formatQty(r.qty_kg, lang), tt('orders.n_bags', { n: r.bags })].filter(Boolean).join(' · ');
  }

  function fact2(r: OrderListRow): string {
    const d = r.latest_dispatch;
    let when = '';
    if (OPEN_ORDER_STATUSES.includes(r.status)) {
      when = r.expected_dispatch ? tt('orders.ship_by', { date: formatDate(r.expected_dispatch) }) : '';
    } else if (r.status === 'dispatched' && d) {
      when =
        d.mode === 'container'
          ? [tt('dispatch_mode.container'), d.eta ? tt('orders.eta', { date: formatDate(d.eta) }) : null].filter(Boolean).join(' · ')
          : tt('orders.vehicle_line', { vehicle: d.vehicle_no ?? '' });
    } else if (r.status === 'delivered') {
      when = d?.delivered_on ? tt('orders.delivered_on', { date: formatDate(d.delivered_on) }) : tt('status.order.delivered');
    } else if (r.status === 'cancelled') {
      when = tt('status.order.cancelled');
    }
    return [when, r.order_code].filter(Boolean).join(' · ');
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
      <FilterChips chips={chips} ariaLabel={tt('title.orders')} />

      {visible.length === 0 ? (
        <EmptyState message={q.trim() ? 'msg.empty.search' : rows.length === 0 ? tt('orders.empty') : tt('orders.nothing_here')} />
      ) : (
        <ListStack>
          {visible.map((r) => (
            <ListCard
              key={r.id}
              href={`/orders/${r.id}`}
              title={r.buyer_name}
              fact1={fact1(r)}
              fact2={fact2(r)}
              badge={
                <div className="flex flex-col items-end gap-1.5">
                  <Status domain="order" code={r.status} dispatchMode={r.latest_dispatch?.mode ?? null} />
                  <OrderDots status={r.status} />
                </div>
              }
            />
          ))}
        </ListStack>
      )}
    </div>
  );
}
