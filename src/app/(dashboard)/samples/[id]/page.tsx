import React from 'react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { firstName, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/ui/back-button';
import { Status } from '@/components/ui/status-badge';
import { SampleList } from '@/components/samples/sample-list';
import { loadSampleRow } from '../data';
import { loadCompanyShort } from '../company';

export default async function SampleDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireModule('samples'); // Wall 2
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const lang = getLang();
  const supabase = createClient();

  const [row, company] = await Promise.all([loadSampleRow(supabase, params.id, lang), loadCompanyShort(supabase, profile.org_id, lang)]);
  if (!row) notFound();

  const facts: [string, string][] = [
    [t(lang, 'field.sample.product'), row.product_name],
    [t(lang, 'field.sample.qty_grams'), `${row.qty_grams} ${t(lang, 'unit.g')}`],
    [t(lang, 'field.sample.inquiry'), row.inquiry_code ?? t(lang, 'common.not_set')],
    [t(lang, 'field.sample.courier'), row.courier ?? t(lang, 'common.not_set')],
    [t(lang, 'field.sample.tracking_no'), row.tracking_no ?? t(lang, 'common.not_set')],
    [t(lang, 'field.sample.sent_on'), row.sent_on ? formatDate(row.sent_on) : t(lang, 'common.not_set')],
    [t(lang, 'field.sample.lot_no'), row.lot_no ?? t(lang, 'common.not_set')],
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={row.code} backHref="/samples" right={<Status domain="sample" code={row.status} size="lg" lang={lang} />} />
      <SampleList rows={[row]} statusFilter={null} company={company} senderName={firstName(profile.full_name)} compact />
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-sm font-semibold text-slate-700">{k}</dt>
            <dd className="text-base text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export const dynamic = 'force-dynamic';
