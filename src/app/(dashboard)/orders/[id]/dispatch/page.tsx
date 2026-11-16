import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { formatQty } from '@/lib/utils';
import { PageHeader } from '@/components/ui/back-button';
import { buttonVariants } from '@/components/ui/button';
import { DispatchForm } from '@/components/orders/dispatch-form';
import { ORDER_LABELS } from '../../labels';
import { loadDocCounters, loadOrderDetail } from '../../data';
import { defaultPort, fyOf, isExportBuyer, nextDocNo } from '../../helpers';

/** Dispatch form (screens.md 17). Plant gets the short variant (mode, number, bags). */
export default async function DispatchPage({ params }: { params: { id: string } }) {
  const profile = await requireModule('orders'); // Wall 2
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const lang = getLang();
  const supabase = createClient();
  const fy = fyOf();
  const [detail, counters] = await Promise.all([loadOrderDetail(supabase, params.id), loadDocCounters(supabase, fy)]);
  if (!detail) notFound();
  const { order, buyer } = detail;

  const title = `${t(lang, 'title.dispatch')} ${order.order_code}`;
  const subtitle = `${buyer.company_name} · ${formatQty(detail.qty_kg, lang)}`;

  if (order.status !== 'ready') {
    return (
      <div className="space-y-4">
        <PageHeader title={title} subtitle={subtitle} backHref={`/orders/${order.id}`} />
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-900">
          {order.status === 'dispatched' || order.status === 'delivered'
            ? t(lang, 'msg.dispatched', { invoice_no: detail.dispatches[0]?.invoice_no ?? '' })
            : t(lang, 'orders.not_ready', undefined, ORDER_LABELS)}
        </p>
        <Link href={`/orders/${order.id}`} className={buttonVariants({ variant: 'outline', fullWidth: true })}>
          {t(lang, 'btn.back')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} backHref={`/orders/${order.id}`} />
      <DispatchForm
        orderId={order.id}
        defaultMode={isExportBuyer(buyer) ? 'container' : 'truck'}
        defaultBags={order.packed_bags ?? detail.planned_bags}
        bagKg={detail.bag_kg}
        remainingKg={Math.max(0, detail.qty_kg - detail.dispatched_kg)}
        defaultPort={defaultPort(order.incoterm)}
        nextInvoiceNo={nextDocNo('INV', fy, counters.INV)}
        nextSdnNo={nextDocNo('SDN', fy, counters.SDN)}
        short={profile.role === 'operations'}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
