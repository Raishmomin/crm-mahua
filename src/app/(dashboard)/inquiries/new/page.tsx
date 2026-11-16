import React from 'react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/back-button';
import { InquiryForm } from '@/components/inquiries/inquiry-form';
import { loadBuyersLite, loadProductsLite } from '../queries';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** New inquiry (screens.md 5); /inquiries/new?buyer=<id> preselects the buyer. */
export default async function NewInquiryPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  await requireModule('leads'); // Wall 2
  const lang = getLang();
  const buyerParam = Array.isArray(searchParams?.buyer) ? searchParams?.buyer[0] : searchParams?.buyer;

  const supabase = createClient();
  const [buyers, products] = await Promise.all([loadBuyersLite(supabase), loadProductsLite(supabase)]);

  return (
    <div className="space-y-4">
      <PageHeader title={t(lang, 'title.inquiry_new')} backHref="/inquiries" />
      <InquiryForm
        buyers={buyers}
        products={products}
        preselectBuyerId={buyerParam && UUID.test(buyerParam) ? buyerParam : null}
      />
    </div>
  );
}
