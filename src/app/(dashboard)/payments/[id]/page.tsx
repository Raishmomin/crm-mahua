import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ChevronRight, MessageCircle, Printer } from 'lucide-react';
import { hasModule, requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { whatsappHref } from '@/lib/phone';
import { cn, formatDate, formatMoney } from '@/lib/utils';
import { PageHeader } from '@/components/ui/back-button';
import { buttonVariants } from '@/components/ui/button';
import { loadCompanyName } from '@/app/(dashboard)/orders/data';
import { isExportBuyer, receiptText, waLang } from '@/app/(dashboard)/orders/helpers';
import { PAYMENT_LABELS } from '../labels';
import { loadReceipt } from '../data';

/**
 * Receipt view (contracts 6.1, A12): REC number, order, buyer, amount (+ rupee value), mode,
 * reference, date; Share on WhatsApp (T8) and Print. `?from=order` makes Back go to the order.
 */
export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const profile = await requireModule('payments'); // Wall 2
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const lang = getLang();
  const tt = (key: string, vars?: Record<string, string | number>) => t(lang, key, vars, PAYMENT_LABELS);
  const supabase = createClient();
  const [receipt, company] = await Promise.all([loadReceipt(supabase, params.id), loadCompanyName(supabase, profile.org_id)]);
  if (!receipt) notFound();

  const p = receipt.payment;
  const foreign = p.currency !== 'INR';
  const backHref = searchParams?.from === 'order' ? `/orders/${p.order_id}` : '/payments';
  const share = whatsappHref(
    receipt.phone,
    receiptText(waLang(lang, isExportBuyer({ buyer_type: receipt.buyer_type, country: receipt.country })), {
      buyer: receipt.contact_name ?? receipt.buyer_name,
      amount: p.amount,
      currency: p.currency,
      orderCode: receipt.order_code,
      receiptNo: p.receipt_no,
      due: receipt.due_now ?? 0,
      company,
    })
  );

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: tt('field.payment.receipt_no'), value: p.receipt_no },
    { label: tt('field.payment.received_on'), value: formatDate(p.received_on) },
    { label: tt('field.payment.buyer'), value: [receipt.buyer_name, receipt.city].filter(Boolean).join(' · ') },
    { label: tt('field.payment.mode'), value: tt(`pay_mode.${p.mode}`) },
  ];
  if (p.reference) rows.push({ label: tt('field.payment.reference'), value: p.reference });
  if (p.note) rows.push({ label: tt('field.payment.note'), value: p.note });
  if (receipt.due_now != null) rows.push({ label: tt('field.payment.due_now'), value: formatMoney(receipt.due_now, p.currency) });

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <PageHeader title={tt('payments.receipt_title', { receipt_no: p.receipt_no })} backHref={backHref} />

      <section className="space-y-1 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-600">{tt('field.payment.amount')}</p>
        <p className="text-3xl font-bold tabular-nums text-slate-900">{formatMoney(p.amount, p.currency, { decimals: 2 })}</p>
        {foreign && p.amount_inr != null && (
          <p className="text-base tabular-nums text-slate-700">
            {p.fx_rate
              ? tt('payments.inr_value', { inr: formatMoney(p.amount_inr, 'INR', { decimals: 2 }), rate: p.fx_rate, currency: p.currency })
              : formatMoney(p.amount_inr, 'INR', { decimals: 2 })}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        {hasModule(profile, 'orders') ? (
          <Link href={`/orders/${p.order_id}`} className="flex min-h-[48px] items-center gap-2 text-lg font-semibold text-slate-900 hover:underline">
            <span className="min-w-0 flex-1 truncate">{[tt('payments.against_order', { order_code: receipt.order_code }), receipt.pi_no].filter(Boolean).join(' · ')}</span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          </Link>
        ) : (
          <p className="text-lg font-semibold text-slate-900">{[tt('payments.against_order', { order_code: receipt.order_code }), receipt.pi_no].filter(Boolean).join(' · ')}</p>
        )}
        <dl className="mt-2 divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.label} className="flex min-h-[44px] items-center justify-between gap-3 py-2">
              <dt className="text-base text-slate-600">{r.label}</dt>
              <dd className="text-right text-base font-medium text-slate-900">{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {share ? (
          <a href={share} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'whatsapp', fullWidth: true })}>
            <MessageCircle aria-hidden="true" />
            {tt('btn.share_whatsapp')}
          </a>
        ) : (
          <span aria-disabled="true" className={cn(buttonVariants({ variant: 'whatsapp', fullWidth: true }), 'bg-slate-300 text-slate-500 hover:bg-slate-300')}>
            <MessageCircle aria-hidden="true" />
            {tt('btn.share_whatsapp')}
          </span>
        )}
        <Link href={`/payments/${p.id}/print`} className={buttonVariants({ variant: 'outline', fullWidth: true })}>
          <Printer aria-hidden="true" />
          {tt('btn.print')}
        </Link>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
