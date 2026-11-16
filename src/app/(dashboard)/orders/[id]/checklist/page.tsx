import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { firstName } from '@/lib/utils';
import { PageHeader } from '@/components/ui/back-button';
import { ChecklistView } from '@/components/orders/checklist-view';
import { loadCompanyName, loadOrderDetail } from '../../data';
import { checklistDoneCount, checklistStatusText } from '../../helpers';

/** Export checklist (screens.md 18) for the latest container dispatch of the order. */
export default async function ChecklistPage({ params }: { params: { id: string } }) {
  const profile = await requireModule('orders'); // Wall 2
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const lang = getLang();
  const supabase = createClient();
  const [detail, company] = await Promise.all([loadOrderDetail(supabase, params.id), loadCompanyName(supabase, profile.org_id)]);
  if (!detail) notFound();
  const latest = detail.dispatches[0];
  if (!latest || latest.mode !== 'container') redirect(`/orders/${params.id}?msg=no_papers`);

  const done = checklistDoneCount(latest.export_checklist);
  // T7 is always English (export buyers).
  const shareText = checklistStatusText('en', {
    orderCode: detail.order.order_code,
    containerNo: latest.container_no,
    eta: latest.eta,
    list: latest.export_checklist,
    sender: firstName(profile.full_name),
    company,
  });

  return (
    <div>
      <PageHeader
        title={`${t(lang, 'title.export_papers')} ${detail.order.order_code}`}
        subtitle={`${detail.buyer.company_name} · ${t(lang, 'checklist.progress', { done })}`}
        backHref={`/orders/${params.id}`}
      />
      <ChecklistView
        orderId={detail.order.id}
        dispatchId={latest.id}
        checklist={latest.export_checklist}
        facts={{
          containerNo: latest.container_no,
          port: latest.port,
          vessel: latest.vessel,
          stuffingDate: latest.stuffing_date,
          eta: latest.eta,
          blNo: latest.bl_no,
        }}
        role={profile.role}
        phone={detail.buyer.phone}
        shareText={shareText}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
