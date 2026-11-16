import React from 'react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatMoney, formatRate, firstName } from '@/lib/utils';
import type { BusinessSettings } from '@/types/database';
import { PrintLayout } from '@/components/print/print-layout';
import { amountInWords } from '@/components/print/amount-words';
import { loadQuoteDetail } from '@/app/(dashboard)/quotes/data';
import { isExportBuyer, quoteWhatsappText } from '@/app/(dashboard)/quotes/helpers';

const money = (n: number, cur: string) => formatMoney(n, cur, { decimals: 2 });

/** A4 QUOTATION (screens.md 14, components.md 15). Always English. */
export default async function QuotePrintPage({ params }: { params: { id: string } }) {
  const profile = await requireModule('quotes'); // Wall 2 (print pages too)
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const supabase = createClient();

  const [quote, settingsRes] = await Promise.all([
    loadQuoteDetail(supabase, params.id),
    supabase.from('business_settings').select('*').eq('org_id', profile.org_id).maybeSingle(),
  ]);
  if (!quote) notFound();
  const company = (settingsRes.data as BusinessSettings | null) ?? null;
  const isExport = isExportBuyer(quote.buyer);
  const isInr = quote.currency === 'INR';
  const first = quote.items[0];
  const gstRate = first?.gst_rate ?? 5;
  const date = quote.sent_at ?? quote.created_at;

  const whatsapp = first
    ? {
        phone: quote.buyer.phone,
        message: quoteWhatsappText('en', {
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
          company: company?.trade_name || company?.company_name || '',
        }),
      }
    : undefined;

  const buyerLines = [
    quote.buyer.address,
    [quote.buyer.city, quote.buyer.state].filter(Boolean).join(', '),
    quote.buyer.country,
    quote.buyer.gstin && isInr ? `GSTIN ${quote.buyer.gstin}` : null,
    quote.buyer.contact_name ? `Attn: ${quote.buyer.contact_name}` : null,
  ].filter(Boolean) as string[];

  return (
    <PrintLayout company={company} title="QUOTATION" docNo={quote.quote_no} date={date} currency={quote.currency} backHref={`/quotes/${quote.id}`} whatsapp={whatsapp}>
      <p>Valid till {formatDate(quote.valid_till)}</p>

      <section>
        <p className="font-bold">To:</p>
        <p className="font-semibold">{quote.buyer.company_name}</p>
        {buyerLines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </section>

      <table className="w-full border-collapse text-[11pt]">
        <thead>
          <tr className="border-y border-slate-400 text-left">
            <th className="py-1 pr-2">Sr</th>
            <th className="py-1 pr-2">Product</th>
            <th className="py-1 pr-2">Packing</th>
            <th className="py-1 pr-2 text-right">Qty</th>
            <th className="py-1 pr-2 text-right">Rate</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((it, i) => {
            const mt = it.qty_kg >= 1000 && it.qty_kg % 1000 === 0;
            return (
              <tr key={it.id} className="border-b border-slate-300 align-top">
                <td className="py-1 pr-2">{i + 1}</td>
                <td className="py-1 pr-2">
                  <p className="font-semibold">{it.product_name}</p>
                  {it.spec_text && <p className="text-[10pt]">{it.spec_text}</p>}
                  {it.product_hsn && <p className="text-[10pt]">HSN {it.product_hsn}</p>}
                </td>
                <td className="py-1 pr-2">{it.packaging_name ?? '-'}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{mt ? `${it.qty_kg / 1000} MT` : `${it.qty_kg.toLocaleString('en-IN')} kg`}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatRate(it.rate, quote.currency, it.unit)}</td>
                <td className="py-1 text-right tabular-nums">{money(it.amount, quote.currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="ml-auto w-[80mm] space-y-0.5">
        {isInr ? (
          <>
            <Line label="Subtotal" value={money(quote.subtotal, 'INR')} />
            <Line label={`GST ${gstRate}%`} value={money(quote.gst_amount, 'INR')} />
          </>
        ) : (
          <Line label="GST 0% - export under LUT" value={money(0, quote.currency)} />
        )}
        <Line label="Total" value={money(quote.total, quote.currency)} bold />
      </section>
      <p>
        <span className="font-semibold">Amount in words:</span> {amountInWords(quote.total, quote.currency)}
      </p>

      <section className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-slate-400 pt-3">
        <p>
          <span className="font-semibold">Price basis:</span> {quote.incoterm}
        </p>
        <p>
          <span className="font-semibold">Payment terms:</span> {quote.payment_terms}
        </p>
        <p>
          <span className="font-semibold">Valid till:</span> {formatDate(quote.valid_till)}
        </p>
        <p>
          <span className="font-semibold">Delivery:</span> {isExport ? '3-4 weeks from order' : '1 week from order'}
        </p>
        <p>
          <span className="font-semibold">Origin:</span> India
        </p>
        {quote.notes && (
          <p className="col-span-2">
            <span className="font-semibold">Notes:</span> {quote.notes}
          </p>
        )}
      </section>
      <p className="text-[9pt] text-slate-500">This is a computer-made quotation.</p>
    </PrintLayout>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${bold ? 'border-t border-slate-800 pt-1 font-bold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export const dynamic = 'force-dynamic';
