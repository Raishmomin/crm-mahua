import React from 'react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { ORDER_STATUSES, type OrderStatus } from '@/types/orders';
import { PageHeader } from '@/components/ui/back-button';
import { OrderList, type OrderFilter } from '@/components/orders/order-list';
import { loadOrderList } from './data';

/** Orders list (screens.md 15). `?status=open` (default, from the Home tile), `all` or a status code. */
export default async function OrdersPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  await requireModule('orders'); // Wall 2
  const lang = getLang();
  const raw = typeof searchParams?.status === 'string' ? searchParams.status : 'open';
  const filter: OrderFilter =
    raw === 'all' || raw === 'open' ? raw : (ORDER_STATUSES as string[]).includes(raw) ? (raw as OrderStatus) : 'open';

  const rows = await loadOrderList(createClient());

  return (
    <div className="space-y-4">
      <PageHeader title={t(lang, 'title.orders')} />
      <OrderList rows={rows} filter={filter} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
