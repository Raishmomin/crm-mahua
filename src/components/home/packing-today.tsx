import React from 'react';
import type { Lang } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { formatBags, formatDate } from '@/lib/utils';
import type { OrderInProductionRow } from '@/types/home';
import { ListCard, ListStack } from '@/components/ui/list-card';
import { Status } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/state-views';

/** Plant Home: orders to pack today from v_orders_in_production, each opening /orders/[id]. */
export function PackingToday({ rows, lang }: { rows: OrderInProductionRow[]; lang: Lang }) {
  if (rows.length === 0) {
    return <EmptyState message="msg.empty.packing_today" lang={lang} />;
  }
  return (
    <ListStack>
      {rows.map((o) => {
        const where = o.city || o.country;
        const shipBy = o.expected_dispatch
          ? `${t(lang, 'field.order.expected_dispatch')}: ${formatDate(o.expected_dispatch)}`
          : '';
        return (
          <ListCard
            key={o.id}
            href={`/orders/${o.id}`}
            title={where ? `${o.buyer_name} — ${where}` : o.buyer_name}
            fact1={o.product_summary ?? o.order_code}
            fact2={[formatBags(o.planned_bags, o.bag_kg, lang), shipBy].filter(Boolean).join(' · ')}
            badge={<Status domain="order" code={o.status} lang={lang} />}
          />
        );
      })}
    </ListStack>
  );
}
