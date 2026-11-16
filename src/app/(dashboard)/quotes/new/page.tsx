import React from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/back-button';
import { buttonVariants } from '@/components/ui/button';
import { QuoteForm, type QuoteFormInitial } from '@/components/quotes/quote-form';
import { loadInquiryLite, loadQuoteDetail, loadQuoteFormData } from '../data';

const uuid = z.string().uuid();

function param(searchParams: Record<string, string | string[] | undefined> | undefined, key: string): string | null {
  const v = searchParams?.[key];
  return typeof v === 'string' && uuid.safeParse(v).success ? v : null;
}

/** /quotes/new?inquiry=&buyer=&from=<quote id> (copy). */
export default async function NewQuotePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const profile = await requireModule('quotes'); // Wall 2
  const lang = getLang();
  const supabase = createClient();

  const inquiryId = param(searchParams, 'inquiry');
  const buyerParam = param(searchParams, 'buyer');
  const fromId = param(searchParams, 'from');

  const [data, inquiry, from] = await Promise.all([
    loadQuoteFormData(supabase, profile.org_id),
    inquiryId ? loadInquiryLite(supabase, inquiryId) : Promise.resolve(null),
    fromId ? loadQuoteDetail(supabase, fromId) : Promise.resolve(null),
  ]);

  // contracts 6.3: a quote needs a buyer row; make the buyer first, then come back with ?inquiry=&buyer=.
  if (inquiry && !inquiry.buyer_id && !buyerParam) {
    return (
      <div className="space-y-4">
        <PageHeader title={t(lang, 'title.quote_new')} backHref={`/inquiries/${inquiry.id}`} />
        <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-base text-amber-900">{t(lang, 'msg.buyer_needed')}</p>
          <Link href={`/buyers/new?from_inquiry=${inquiry.id}`} className={buttonVariants({ fullWidth: true })}>
            {t(lang, 'btn.new_buyer')}
          </Link>
        </div>
      </div>
    );
  }

  const initial: QuoteFormInitial = from
    ? {
        inquiry_id: from.inquiry_id,
        inquiry_code: from.inquiry_code,
        buyer_id: from.buyer_id,
        currency: from.currency,
        incoterm: from.incoterm,
        payment_terms: from.payment_terms,
        valid_till: null,
        notes: from.notes,
        items: from.items.map((it) => ({ product_id: it.product_id, packaging_type_id: it.packaging_type_id, qty_kg: it.qty_kg, unit: it.unit, rate: it.rate, spec_text: it.spec_text })),
      }
    : {
        inquiry_id: inquiry?.id ?? null,
        inquiry_code: inquiry?.code ?? null,
        buyer_id: inquiry?.buyer_id ?? buyerParam,
        currency: null,
        incoterm: null,
        payment_terms: null,
        valid_till: null,
        notes: null,
        items: inquiry?.product_id ? [{ product_id: inquiry.product_id, packaging_type_id: null, qty_kg: inquiry.qty_kg ?? 0, unit: 'kg', rate: null, spec_text: null }] : [],
      };

  const backHref = inquiry ? `/inquiries/${inquiry.id}` : from ? `/quotes/${from.id}` : '/quotes';

  return (
    <div className="space-y-4">
      <PageHeader title={t(lang, 'title.quote_new')} backHref={backHref} />
      <QuoteForm mode="new" initial={initial} buyerLocked={Boolean(inquiry?.buyer_id)} data={data} isOwner={profile.role === 'owner'} backHref={backHref} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
