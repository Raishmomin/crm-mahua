import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ChevronRight, FileText, IndianRupee, MessageCircle, Printer, ReceiptText, ScrollText, Ship, Truck } from 'lucide-react';
import { hasModule, requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t, type Lang } from '@/lib/i18n';
import { whatsappHref } from '@/lib/phone';
import { cn, formatDate, formatDays, formatMoney, formatQty } from '@/lib/utils';
import type { FollowUp } from '@/types/inquiries';
import type { OrderDetail } from '@/types/orders';
import { PageHeader } from '@/components/ui/back-button';
import { Status, StatusBadge } from '@/components/ui/status-badge';
import { StatusStepper } from '@/components/ui/status-stepper';
import { PhoneActions } from '@/components/ui/phone-actions';
import { buttonVariants } from '@/components/ui/button';
import { NotesSection } from '@/components/followups/notes-section';
import { OrderActions } from '@/components/orders/order-actions';
import { PackingCard } from '@/components/orders/packing-card';
import { FlashToast } from '@/components/orders/flash-toast';
import { ORDER_LABELS } from '../labels';
import { loadAdvanceWaiting, loadCompanyName, loadOrderDetail } from '../data';
import { addOrderNoteAction, orderFollowUpDoneAction } from '../actions';
import {
  checklistDoneCount,
  composeLabel,
  dispatchedText,
  isExportBuyer,
  piShareText,
  productShort,
  reminderText,
  waLang,
} from '../helpers';

/** Order detail (screens.md 16A) and, for the Plant role, the supervisor packing card (16B). */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const profile = await requireModule('orders'); // Wall 2
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const lang = getLang();
  const tt = (key: string, vars?: Record<string, string | number>) => t(lang, key, vars, ORDER_LABELS);
  const supabase = createClient();

  const [detail, company, followRes] = await Promise.all([
    loadOrderDetail(supabase, params.id),
    loadCompanyName(supabase, profile.org_id),
    supabase
      .from('follow_ups')
      .select('*')
      .in('entity_type', ['order', 'payment'])
      .eq('entity_id', params.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  if (!detail) notFound();
  const { order, buyer, items, dispatches, balance } = detail;
  const latest = dispatches[0] ?? null;
  const isExport = isExportBuyer(buyer);
  const mode = latest?.mode ?? (isExport ? 'container' : 'truck');
  const isPlant = profile.role === 'operations';
  // Plant reads no money rows (A6): its guard comes from fn_order_advance_waiting (yes / no only).
  const advanceWaiting = isPlant
    ? await loadAdvanceWaiting(supabase, order)
    : order.advance_expected > 0 && !(balance?.advance_ok ?? false);
  const flash = flashMessage(lang, searchParams, order);

  const productLines = items.map((i) => [i.product_name, i.product_mesh].filter(Boolean).join(' '));
  const firstItem = items[0];
  const labelLines = composeLabel({
    packingNote: order.packing_note,
    buyer: buyer.company_name,
    product: firstItem ? productShort('en', { form: firstItem.product_form, color: firstItem.product_color }) : '',
    bagKg: detail.bag_kg,
    company,
  });

  // Plant: packing card only (no money, no papers, no timeline).
  if (isPlant) {
    return (
      <div>
        <PageHeader title={order.order_code} backHref="/orders" />
        <PackingCard
          orderId={order.id}
          status={order.status}
          statusChangedAt={order.status_changed_at}
          stepDates={order.step_dates}
          buyerName={buyer.company_name}
          city={buyer.city}
          productLines={productLines}
          plannedBags={detail.planned_bags}
          bagKg={detail.bag_kg}
          qtyKg={detail.qty_kg}
          packedBags={order.packed_bags}
          packagingName={firstItem?.packaging_name ?? null}
          labelLines={labelLines}
          moisturePct={firstItem?.moisture_max_pct ?? null}
          shipBy={order.expected_dispatch}
          mode={mode}
          advanceWaiting={advanceWaiting}
          dispatchedOn={latest?.dispatched_on ?? null}
        />
        <FlashToast message={flash} />
      </div>
    );
  }

  const canPay = hasModule(profile, 'payments');
  const canSeeBuyer = hasModule(profile, 'buyers');
  const textLang = waLang(lang, isExport);
  const shareText = latest
    ? dispatchedText(textLang, {
        buyer: buyer.contact_name ?? buyer.company_name,
        orderCode: order.order_code,
        invoiceNo: latest.invoice_no,
        dispatchedOn: latest.dispatched_on,
        mode: latest.mode,
        vehicleNo: latest.vehicle_no,
        containerNo: latest.container_no,
        vessel: latest.vessel,
        eta: latest.eta,
        qtyKg: latest.qty_kg,
        bags: latest.bags_count,
        company,
      })
    : piShareText(textLang, {
        buyer: buyer.contact_name ?? buyer.company_name,
        orderCode: order.order_code,
        piNo: order.pi_no,
        total: order.total,
        advance: order.advance_expected,
        currency: order.currency,
        company,
      });
  // Money reminders are entity 'payment': shown only with the payments module, never to Plant (A6 / G3-03).
  const followUps = ((followRes.data ?? []) as FollowUp[]).filter(
    (f) => f.entity_type === 'order' || (f.entity_type === 'payment' && canPay),
  );

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <PageHeader title={order.order_code} backHref="/orders" right={<Status domain="order" code={order.status} size="lg" lang={lang} dispatchMode={latest?.mode ?? null} />} />

      {/* Buyer */}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        {canSeeBuyer ? (
          <Link href={`/buyers/${buyer.id}`} className="flex min-h-[48px] items-center gap-2 text-lg font-semibold text-slate-900 hover:underline">
            <span className="min-w-0 flex-1 truncate">{[buyer.company_name, buyer.city].filter(Boolean).join(' · ')}</span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          </Link>
        ) : (
          <p className="text-lg font-semibold text-slate-900">{[buyer.company_name, buyer.city].filter(Boolean).join(' · ')}</p>
        )}
        <PhoneActions phone={buyer.phone} size="full" lang={lang} />
      </section>

      {/* Stepper */}
      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <StatusStepper
          status={order.status}
          lang={lang}
          dispatchMode={latest?.mode ?? null}
          cancelledAt={order.status === 'cancelled' ? order.status_changed_at : null}
          stepDates={order.step_dates}
        />
        <p className="text-sm text-slate-500">
          {[
            // The stepper shows the date of each step reached (A7); "since" only for older rows without it.
            order.status === 'cancelled' || order.step_dates[order.status] ? null : t(lang, 'common.since', { date: formatDate(order.status_changed_at) }),
            `${t(lang, 'field.order.pi_no')} ${order.pi_no}`,
            detail.quote_no ? tt('orders.from_quote', { quote_no: detail.quote_no }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </section>

      {/* Money */}
      {balance && (
        <MoneySection detail={detail} lang={lang} canPay={canPay} isExport={isExport} company={company} />
      )}

      {/* Packing card */}
      <section className="space-y-1 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{t(lang, 'title.packing_card')}</h2>
          <span className="flex items-center gap-1.5 text-base text-slate-600">
            {mode === 'container' ? <Ship className="h-5 w-5" aria-hidden="true" /> : <Truck className="h-5 w-5" aria-hidden="true" />}
            {t(lang, `dispatch_mode.${mode}`)}
          </span>
        </div>
        {productLines.map((l, i) => (
          <p key={i} className="text-base font-medium text-slate-900">
            {l}
          </p>
        ))}
        <p className="text-base tabular-nums text-slate-800">
          {detail.planned_bags} {t(lang, 'unit.bags')} x {detail.bag_kg} {t(lang, 'unit.kg')} = {formatQty(detail.qty_kg, lang)}
        </p>
        {firstItem?.packaging_name && <p className="text-base text-slate-600">{firstItem.packaging_name}</p>}
        <p className="text-base text-slate-600">
          {tt('orders.label')}: {labelLines.join(' / ')}
        </p>
        {firstItem?.moisture_max_pct != null && <p className="text-base text-slate-600">{tt('orders.moisture_max', { pct: firstItem.moisture_max_pct })}</p>}
        <p className="text-base text-slate-800">
          {[
            order.packed_bags != null ? `${tt('orders.packed_n', { n: order.packed_bags })} ✓` : null,
            order.expected_dispatch ? tt('orders.ship_by', { date: formatDate(order.expected_dispatch) }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </section>

      {/* Dispatch */}
      <section className="space-y-1 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{t(lang, 'section.dispatch')}</h2>
          {latest && <Status domain="dispatch" code={latest.status} lang={lang} dispatchMode={latest.mode} />}
        </div>
        {!latest ? (
          <p className="text-base text-slate-600">{t(lang, 'msg.not_dispatched')}</p>
        ) : latest.mode === 'container' ? (
          <>
            <p className="text-base text-slate-900">{[tt('orders.container_line', { no: latest.container_no ?? '' }), latest.port].filter(Boolean).join(' · ')}</p>
            {latest.vessel && <p className="text-base text-slate-700">{tt('orders.vessel_line', { vessel: latest.vessel })}</p>}
            <p className="text-base text-slate-700">
              {[
                latest.stuffing_date ? tt('orders.stuffed', { date: formatDate(latest.stuffing_date) }) : null,
                latest.eta ? tt('orders.eta', { date: formatDate(latest.eta) }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="text-base text-slate-700">{latest.bl_no ? tt('orders.bl_line', { bl: latest.bl_no }) : t(lang, 'msg.bl_not_yet')}</p>
            <p className="text-base text-slate-700">
              {latest.invoice_no} · {latest.sdn_no}
            </p>
            <Link
              href={`/orders/${order.id}/checklist`}
              className="mt-2 flex min-h-[56px] items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <ScrollText className="h-5 w-5 text-slate-500" aria-hidden="true" />
                {t(lang, 'title.export_papers')}
              </span>
              <ChecklistPill done={checklistDoneCount(latest.export_checklist)} lang={lang} />
            </Link>
          </>
        ) : (
          <>
            <p className="text-base text-slate-900">{[tt('orders.vehicle_line', { vehicle: latest.vehicle_no ?? '' }), latest.lr_no ? tt('orders.lr_line', { lr: latest.lr_no }) : null].filter(Boolean).join(' · ')}</p>
            {latest.transporter && <p className="text-base text-slate-700">{latest.transporter}</p>}
            <p className="text-base text-slate-700">
              {[tt('orders.n_bags', { n: latest.bags_count }), formatQty(latest.qty_kg, lang), tt('orders.dispatched_on', { date: formatDate(latest.dispatched_on) })].join(' · ')}
            </p>
            {latest.delivered_on && <p className="text-base text-slate-700">{tt('orders.delivered_on', { date: formatDate(latest.delivered_on) })}</p>}
            <p className="text-base text-slate-700">
              {latest.invoice_no} · {latest.sdn_no}
            </p>
          </>
        )}
      </section>

      {/* Papers */}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">{t(lang, 'section.papers')}</h2>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/orders/${order.id}/print/pi`} className={buttonVariants({ variant: 'outline', className: 'px-3' })}>
            <Printer aria-hidden="true" />
            {tt('orders.print_pi')}
          </Link>
          {latest && (
            <Link href={`/orders/${order.id}/print/invoice`} className={buttonVariants({ variant: 'outline', className: 'px-3' })}>
              <FileText aria-hidden="true" />
              {tt('orders.print_invoice')}
            </Link>
          )}
          {latest && (
            <Link href={`/orders/${order.id}/print/slip`} className={buttonVariants({ variant: 'outline', className: 'px-3' })}>
              <Truck aria-hidden="true" />
              {t(lang, 'btn.view_sdn')}
            </Link>
          )}
          <WhatsAppLink phone={buyer.phone} message={shareText} label={t(lang, 'btn.share_whatsapp')} />
        </div>
      </section>

      <NotesSection
        entityType="order"
        entityId={order.id}
        buyerId={order.buyer_id}
        items={followUps}
        canWrite
        onAdd={addOrderNoteAction}
        onDone={orderFollowUpDoneAction}
      />

      <OrderActions
        orderId={order.id}
        orderCode={order.order_code}
        status={order.status}
        advanceWaiting={advanceWaiting}
        plannedBags={detail.planned_bags}
        latestDispatchId={latest?.id ?? null}
        canCancel={profile.role === 'owner' && ['confirmed', 'in_production', 'ready'].includes(order.status)}
      />
      <FlashToast message={flash} />
    </div>
  );
}

function flashMessage(lang: Lang, sp: Record<string, string | string[] | undefined> | undefined, order: { order_code: string; pi_no: string }): string | null {
  // Quote "Looks right" (Dev-2's /quotes/[id]/accept) lands here with ?from_quote=<quote id>.
  if (typeof sp?.from_quote === 'string') return t(lang, 'msg.order_created', { order_code: order.order_code, pi_no: order.pi_no });
  const msg = typeof sp?.msg === 'string' ? sp.msg : null;
  const doc = typeof sp?.doc === 'string' ? sp.doc.replace(/[^A-Za-z0-9-]/g, '').slice(0, 30) : '';
  if (msg === 'dispatched') return t(lang, 'msg.dispatched', { invoice_no: doc });
  if (msg === 'no_papers') return t(lang, 'orders.no_papers_truck', undefined, ORDER_LABELS);
  if (msg === 'created') return t(lang, 'msg.saved');
  return null;
}

function ChecklistPill({ done, lang }: { done: number; lang: Lang }) {
  const all = done >= 8;
  return (
    <StatusBadge
      role={all ? 'green' : 'amber'}
      icon={ScrollText}
      word={t(lang, 'checklist.progress', { done })}
    />
  );
}

function WhatsAppLink({ phone, message, label }: { phone: string | null; message: string; label: string }) {
  const href = whatsappHref(phone, message);
  const classes = buttonVariants({ variant: 'whatsapp', className: 'px-3' });
  if (!href) {
    return (
      <span aria-disabled="true" className={cn(classes, 'bg-slate-300 text-slate-500 hover:bg-slate-300')}>
        <MessageCircle aria-hidden="true" />
        {label}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
      <MessageCircle aria-hidden="true" />
      {label}
    </a>
  );
}

function MoneySection({ detail, lang, canPay, isExport, company }: { detail: OrderDetail; lang: Lang; canPay: boolean; isExport: boolean; company: string }) {
  const { order, buyer, balance } = detail;
  if (!balance) return null;
  const tt = (key: string, vars?: Record<string, string | number>) => t(lang, key, vars, ORDER_LABELS);
  const cur = order.currency;
  const when =
    balance.due <= 0
      ? null
      : balance.money_status === 'overdue'
        ? formatDays(balance.days_overdue, lang, 'late')
        : balance.due_date
          ? t(lang, 'common.due_on', { date: formatDate(balance.due_date) })
          : t(lang, 'common.after_dispatch');
  const remind =
    balance.due > 0
      ? reminderText(waLang(lang, isExport), {
          buyer: buyer.contact_name ?? buyer.company_name,
          due: balance.due,
          currency: cur,
          orderCode: order.order_code,
          invoiceNo: balance.latest_invoice_no,
          piNo: order.pi_no,
          dueDate: balance.due_date,
          company,
        })
      : null;

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{t(lang, 'section.money')}</h2>
        <Status domain="money" code={balance.money_status} lang={lang} />
      </div>
      <p className="text-base text-slate-800">
        {tt('orders.money_total', { total: formatMoney(order.total, cur) })} · {tt('orders.money_received', { amount: formatMoney(balance.received, cur) })}
      </p>
      {cur !== 'INR' && order.fx_rate ? (
        <p className="text-sm text-slate-500">≈ {formatMoney(order.total * order.fx_rate, 'INR')}</p>
      ) : null}
      <p className={cn('text-lg font-semibold', balance.money_status === 'overdue' ? 'text-rose-700' : 'text-slate-900')}>
        {tt('orders.money_due', { amount: formatMoney(balance.due, cur) })}
        {when ? <span className="ml-2 text-base font-medium">{when}</span> : null}
      </p>
      {order.advance_expected > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Status domain="advance" code={balance.advance_ok ? 'ok' : 'due'} lang={lang} />
          <span className="text-sm text-slate-500">{tt('orders.advance_line', { amount: formatMoney(order.advance_expected, cur) })}</span>
        </div>
      )}
      {canPay && detail.payments.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {detail.payments.map((p) => (
            <li key={p.id}>
              <Link href={`/payments/${p.id}?from=order`} className="flex min-h-[48px] items-center gap-3 px-3 hover:bg-slate-50">
                <ReceiptText className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-base text-slate-800">
                  {p.receipt_no} · {formatDate(p.received_on)}
                </span>
                <span className="text-base font-semibold tabular-nums text-slate-900">{formatMoney(p.amount, p.currency)}</span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
        {canPay && balance.due > 0 && (
          <Link href={`/payments/new?order=${order.id}&from=order`} className={buttonVariants({ variant: 'outline' })}>
            <IndianRupee aria-hidden="true" />
            {t(lang, 'btn.money_received')}
          </Link>
        )}
        {remind && <WhatsAppLink phone={buyer.phone} message={remind} label={t(lang, 'btn.remind_whatsapp')} />}
      </div>
    </section>
  );
}

export const dynamic = 'force-dynamic';
