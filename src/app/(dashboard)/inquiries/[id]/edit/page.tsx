import React from 'react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import type { Inquiry } from '@/types/inquiries';
import { PageHeader } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/state-views';
import { InquiryForm } from '@/components/inquiries/inquiry-form';
import { loadBuyersLite, loadProductsLite } from '../../queries';
import { INQUIRY_LABELS } from '../../labels';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Change inquiry: the same form as New (status stays with the buttons on the detail page). */
export default async function EditInquiryPage({ params }: { params: { id: string } }) {
  await requireModule('leads'); // Wall 2
  const lang = getLang();

  const supabase = createClient();
  const [{ data: inquiry }, buyers, products] = await Promise.all([
    UUID.test(params.id) ? supabase.from('inquiries').select('*').eq('id', params.id).maybeSingle() : Promise.resolve({ data: null }),
    loadBuyersLite(supabase),
    loadProductsLite(supabase),
  ]);

  if (!inquiry) {
    return (
      <div className="space-y-4">
        <PageHeader title={t(lang, 'title.inquiry_edit')} backHref="/inquiries" />
        <EmptyState message={t(lang, 'inquiries.not_found', undefined, INQUIRY_LABELS)} lang={lang} actionLabel={t(lang, 'btn.go_home')} actionHref="/" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t(lang, 'title.inquiry_edit')} subtitle={(inquiry as Inquiry).code} backHref={`/inquiries/${params.id}`} />
      <InquiryForm buyers={buyers} products={products} initial={inquiry as Inquiry} />
    </div>
  );
}
