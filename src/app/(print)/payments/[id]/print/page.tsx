import React from 'react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { formatDate, formatMoney } from '@/lib/utils';
import type { BusinessSettings } from '@/types/database';
import { PrintLayout } from '@/components/print/print-layout';
import { amountInWords } from '@/components/print/amount-words';
import { isExportBuyer, receiptText, waLang } from '@/app/(dashboard)/orders/helpers';
import { loadReceipt } from '@/app/(dashboard)/payments/data';

const money = (n: number, cur: string) => formatMoney(n, cur, { decimals: 2 });

/** Receipt print (contracts 6.1, A12; components.md 16): A4, English, amount in words. */
export default async function ReceiptPrintPage({ params }: { params: { id: string } }) {
  const profile = await requireModule('payments'); // Wall 2 (print pages too)
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const supabase = createClient();
  const [receipt, settingsRes] = await Promise.all([
    loadReceipt(supabase, params.id),
    supabase.from('business_settings').select('*').eq('org_id', profile.org_id).maybeSingle(),
  ]);
  if (!receipt) notFound();
  const company = (settingsRes.data as BusinessSettings | null) ?? null;
  const companyShort = company?.trade_name || company?.company_name || '';
  const p = receipt.payment;
  const lang = getLang();

  const whatsapp = {
    phone: receipt.phone,
    message: receiptText(waLang(lang, isExportBuyer({ buyer_type: receipt.buyer_type, country: receipt.country })), {
      buyer: receipt.contact_name ?? receipt.buyer_name,
      amount: p.amount,
      currency: p.currency,
      orderCode: receipt.order_code,
      receiptNo: p.receipt_no,
      due: receipt.due_now ?? 0,
      company: companyShort,
    }),
  };
  const buyerLines = [receipt.address, [receipt.city, receipt.state].filter(Boolean).join(', '), receipt.country].filter(Boolean) as string[];

  return (
    <PrintLayout
      company={company}
      title="RECEIPT"
      docNo={p.receipt_no}
      date={p.received_on}
      currency={p.currency}
      showBank={false}
      backHref={`/payments/${p.id}`}
      whatsapp={whatsapp}
    >
      <section>
        <p className="font-bold">Received with thanks from:</p>
        <p className="font-semibold">{receipt.buyer_name}</p>
        {buyerLines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </section>

      <section className="space-y-0.5 border-y border-slate-400 py-3">
        <Line label="Amount" value={money(p.amount, p.currency)} bold />
        {p.currency !== 'INR' && p.amount_inr != null && (
          <Line label={p.fx_rate ? `Rupee value (at ₹${p.fx_rate} per 1 ${p.currency})` : 'Rupee value'} value={money(p.amount_inr, 'INR')} />
        )}
        <Line label="Received on" value={formatDate(p.received_on)} />
        <Line label="Mode" value={t('en', `pay_mode.${p.mode}`)} />
        {p.reference && <Line label="Reference" value={p.reference} />}
        <Line label="Against order" value={[receipt.order_code, receipt.pi_no ? `PI ${receipt.pi_no}` : null].filter(Boolean).join(' · ')} />
        {receipt.due_now != null && <Line label="Balance due on the order" value={money(receipt.due_now, p.currency)} />}
      </section>

      <p>
        <span className="font-semibold">Amount in words:</span> {amountInWords(p.amount, p.currency)}
      </p>
      {p.note && (
        <p>
          <span className="font-semibold">Note:</span> {p.note}
        </p>
      )}
    </PrintLayout>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${bold ? 'text-[13pt] font-bold' : ''}`}>
      <span>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

export const dynamic = 'force-dynamic';
