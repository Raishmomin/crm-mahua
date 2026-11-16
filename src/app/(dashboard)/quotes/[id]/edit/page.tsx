import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/back-button';
import { QuoteForm, type QuoteFormInitial } from '@/components/quotes/quote-form';
import { loadQuoteDetail, loadQuoteFormData } from '../../data';

/** Draft only; anything else goes back to the detail page. */
export default async function EditQuotePage({ params }: { params: { id: string } }) {
  const profile = await requireModule('quotes'); // Wall 2
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const lang = getLang();
  const supabase = createClient();

  const [quote, data] = await Promise.all([loadQuoteDetail(supabase, params.id), loadQuoteFormData(supabase, profile.org_id)]);
  if (!quote) notFound();
  if (quote.status !== 'draft') redirect(`/quotes/${quote.id}`);

  const initial: QuoteFormInitial = {
    inquiry_id: quote.inquiry_id,
    inquiry_code: quote.inquiry_code,
    buyer_id: quote.buyer_id,
    currency: quote.currency,
    incoterm: quote.incoterm,
    payment_terms: quote.payment_terms,
    valid_till: quote.valid_till,
    notes: quote.notes,
    items: quote.items.map((it) => ({ product_id: it.product_id, packaging_type_id: it.packaging_type_id, qty_kg: it.qty_kg, unit: it.unit, rate: it.rate, spec_text: it.spec_text })),
  };

  return (
    <div className="space-y-4">
      <PageHeader title={`${t(lang, 'title.quote_edit')} · ${quote.quote_no}`} backHref={`/quotes/${quote.id}`} />
      <QuoteForm mode="edit" quoteId={quote.id} initial={initial} buyerLocked={Boolean(quote.inquiry_id)} data={data} isOwner={profile.role === 'owner'} backHref={`/quotes/${quote.id}`} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
