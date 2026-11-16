import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { firstName, formatDate, formatDays, formatMoney, formatQty, formatRate } from '@/lib/utils';
import { PageHeader } from '@/components/ui/back-button';
import { Status } from '@/components/ui/status-badge';
import { PhoneActions } from '@/components/ui/phone-actions';
import { QuoteActions } from '@/components/quotes/quote-actions';
import { QuoteFollowups } from '@/components/quotes/quote-followups';
import { loadCompanyShort } from '../../samples/company';
import { loadOrderForQuote, loadQuoteDetail, loadQuoteFollowups } from '../data';
import { QUOTE_LABELS } from '../labels';
import { aboutInrLine, isExportBuyer, quoteWhatsappText } from '../helpers';

export default async function QuoteDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: Record<string, string | string[] | undefined> }) {
  const profile = await requireModule('quotes'); // Wall 2
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const lang = getLang();
  const supabase = createClient();
  const saved = typeof searchParams?.saved === 'string' ? searchParams.saved : null;

  const quote = await loadQuoteDetail(supabase, params.id);
  if (!quote) notFound();
  const [order, followups, company] = await Promise.all([
    quote.status === 'accepted' ? loadOrderForQuote(supabase, quote.id) : Promise.resolve(null),
    loadQuoteFollowups(supabase, quote.id),
    loadCompanyShort(supabase, profile.org_id, lang),
  ]);

  const first = quote.items[0];
  const isExport = isExportBuyer(quote.buyer);
  const whatsappText = first
    ? quoteWhatsappText(lang, {
        buyerName: quote.buyer.company_name,
        contactName: quote.buyer.contact_name,
        isExport,
        quoteNo: quote.quote_no,
        productName: first.product_name,
        qtyKg: first.qty_kg,
        rate: first.rate,
        unit: first.unit,
        currency: quote.currency,
        incoterm: quote.incoterm,
        paymentTerms: quote.payment_terms,
        validTill: quote.valid_till,
        total: quote.total,
        senderName: firstName(profile.full_name),
        company,
      })
    : '';

  const belowFloor = quote.items.some((it) => it.floor_price_at_time !== null && it.rate < it.floor_price_at_time);
  const where = [quote.buyer.city, quote.buyer.country].filter(Boolean).join(', ');
  const validLine = `${t(lang, 'field.quote.valid_till')} ${formatDate(quote.valid_till)} (${quote.days_left >= 0 ? formatDays(quote.days_left, lang, 'left') : formatDays(-quote.days_left, lang, 'late')})`;
  const gstRate = first?.gst_rate ?? 5;

  return (
    <div className="space-y-4 pb-28 md:pb-0">
      <PageHeader title={quote.quote_no} backHref="/quotes" right={<Status domain="quote" code={quote.display_status} size="lg" lang={lang} />} />

      {/* Buyer card */}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <Link href={`/buyers/${quote.buyer.id}`} className="block text-lg font-semibold text-slate-900 hover:underline">
            {quote.buyer.company_name}
          </Link>
          <p className="text-base text-slate-600">{[where, quote.buyer.contact_name].filter(Boolean).join(' · ')}</p>
          {quote.inquiry_code && (
            <p className="text-base text-slate-500">
              {t(lang, 'field.quote.inquiry')}{' '}
              <Link href={`/inquiries/${quote.inquiry_id}`} className="underline">
                {quote.inquiry_code}
              </Link>
            </p>
          )}
        </div>
        <PhoneActions phone={quote.buyer.phone} message={whatsappText} size="full" lang={lang} />
      </section>

      {/* Items */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">{t(lang, 'section.items')}</h2>
        <ul className="divide-y divide-slate-200">
          {quote.items.map((it) => (
            <li key={it.id} className="py-2">
              <p className="text-base font-semibold text-slate-900">{it.product_name}</p>
              <p className="text-base text-slate-700">
                {formatQty(it.qty_kg, lang)} x {formatRate(it.rate, quote.currency, it.unit)} <span className="float-right font-semibold tabular-nums">{formatMoney(it.amount, quote.currency)}</span>
              </p>
              {(it.packaging_name || it.spec_text) && <p className="text-sm text-slate-500">{[it.spec_text, it.packaging_name].filter(Boolean).join(' · ')}</p>}
            </li>
          ))}
        </ul>
      </section>

      {/* Totals */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        {quote.currency === 'INR' && (
          <>
            <div className="flex justify-between py-1 text-base text-slate-700">
              <span>{t(lang, 'field.quote.subtotal')}</span>
              <span className="tabular-nums">{formatMoney(quote.subtotal, 'INR')}</span>
            </div>
            <div className="flex justify-between py-1 text-base text-slate-700">
              <span>
                {t(lang, 'field.quote.gst')} {gstRate}%
              </span>
              <span className="tabular-nums">{formatMoney(quote.gst_amount, 'INR')}</span>
            </div>
          </>
        )}
        <div className="flex justify-between py-1 text-lg font-bold text-slate-900">
          <span>{t(lang, 'field.quote.total')}</span>
          <span className="tabular-nums">{formatMoney(quote.total, quote.currency)}</span>
        </div>
        {quote.fx_rate && <p className="text-sm text-slate-500">{aboutInrLine(lang, quote.total, quote.currency, quote.fx_rate, QUOTE_LABELS)}</p>}
        <p className={`mt-2 flex items-center gap-1.5 text-base font-medium ${belowFloor ? 'text-rose-700' : 'text-emerald-800'}`}>
          {belowFloor ? <ShieldAlert className="h-5 w-5" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          {t(lang, belowFloor ? 'quotes.floor_below_line' : 'quotes.floor_ok_line', undefined, QUOTE_LABELS)}
        </p>
      </section>

      {/* Terms */}
      <section className="space-y-1 rounded-xl border border-slate-200 bg-white p-4 text-base text-slate-700">
        <p>
          {t(lang, `incoterm.${quote.incoterm.replace(' ', '_')}`)} · {quote.payment_terms}
        </p>
        <p className={quote.display_status === 'sent' && quote.days_left <= 2 ? 'font-semibold text-amber-700' : undefined}>{validLine}</p>
        {quote.sent_at && (
          <p>
            {t(lang, 'quotes.sent_line', { date: formatDate(quote.sent_at) }, QUOTE_LABELS)}
            {quote.sent_by_name ? ` ${t(lang, 'common.by', { name: firstName(quote.sent_by_name) })}` : ''}
          </p>
        )}
        {quote.status === 'rejected' && quote.reject_reason && <p className="text-rose-700">{t(lang, 'msg.lost_with_reason', { reason: t(lang, `lost_reason.${quote.reject_reason}`) })}</p>}
        {quote.notes && <p className="text-slate-500">{quote.notes}</p>}
      </section>

      {/* Notes and follow-ups */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">{t(lang, 'section.notes_followups')}</h2>
        <QuoteFollowups rows={followups} />
      </section>

      <QuoteActions quote={quote} whatsappText={whatsappText} order={order} savedCode={saved} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
