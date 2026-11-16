import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/back-button';
import { QuoteAcceptForm } from '@/components/quotes/quote-accept-form';
import { loadQuoteDetail } from '../../data';
import { advancePctFromTerms, isExportBuyer, isoDate } from '../../helpers';

/** ConfirmPage (components.md 17): only for a sent, still valid quote. */
export default async function AcceptQuotePage({ params }: { params: { id: string } }) {
  await requireModule('quotes'); // Wall 2
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const lang = getLang();
  const supabase = createClient();

  const quote = await loadQuoteDetail(supabase, params.id);
  if (!quote) notFound();
  if (quote.display_status !== 'sent') redirect(`/quotes/${quote.id}`);

  const isExport = isExportBuyer(quote.buyer);
  const defaultShipBy = isoDate(new Date(), isExport ? 21 : 7);
  const defaultAdvancePct = advancePctFromTerms(quote.payment_terms);

  let bagKg = 25;
  const packagingId = quote.items[0]?.packaging_type_id;
  if (packagingId) {
    const { data } = await supabase.from('packaging_types').select('capacity_kg').eq('id', packagingId).maybeSingle();
    const cap = Number((data as { capacity_kg?: number | string } | null)?.capacity_kg ?? 0);
    if (cap > 0) bagKg = cap;
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`${t(lang, 'title.quote_accept')} · ${quote.quote_no}`} backHref={`/quotes/${quote.id}`} />
      <QuoteAcceptForm quote={quote} defaultShipBy={defaultShipBy} defaultAdvancePct={defaultAdvancePct} bagKg={bagKg} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
