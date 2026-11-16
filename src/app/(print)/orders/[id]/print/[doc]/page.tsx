import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { formatDate, formatMoney, formatRate } from '@/lib/utils';
import type { BusinessSettings } from '@/types/database';
import type { Dispatch, OrderDetail, OrderItemView } from '@/types/orders';
import { PrintLayout } from '@/components/print/print-layout';
import { amountInWords } from '@/components/print/amount-words';
import { loadOrderDetail } from '@/app/(dashboard)/orders/data';
import { defaultPort, dispatchedText, isExportBuyer, piShareText, waLang } from '@/app/(dashboard)/orders/helpers';

type Doc = 'pi' | 'invoice' | 'slip';
const DOCS: Doc[] = ['pi', 'invoice', 'slip'];

const money = (n: number, cur: string) => formatMoney(n, cur, { decimals: 2 });
const kg = (n: number) => `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)} kg`;

/**
 * Order papers (screens.md 19 / 20, components.md 15): /orders/[id]/print/pi | invoice | slip.
 * Always English. Invoice and slip use the latest dispatch, or ?dispatch=<id>. Plant may print the slip only.
 */
export default async function OrderPrintPage({
  params,
  searchParams,
}: {
  params: { id: string; doc: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const profile = await requireModule('orders'); // Wall 2 (print pages too)
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const doc = params.doc as Doc;
  if (!DOCS.includes(doc)) notFound();
  if (profile.role === 'operations' && doc !== 'slip') redirect('/access-denied'); // screens.md 0.1 rows 19 / 20

  const supabase = createClient();
  const [detail, settingsRes] = await Promise.all([
    loadOrderDetail(supabase, params.id),
    supabase.from('business_settings').select('*').eq('org_id', profile.org_id).maybeSingle(),
  ]);
  if (!detail) notFound();
  const company = (settingsRes.data as BusinessSettings | null) ?? null;
  const companyShort = company?.trade_name || company?.company_name || '';
  const lang = getLang();
  const isExport = isExportBuyer(detail.buyer);
  const backHref = `/orders/${detail.order.id}`;

  if (doc === 'pi') {
    const whatsapp = {
      phone: detail.buyer.phone,
      message: piShareText(waLang(lang, isExport), {
        buyer: detail.buyer.contact_name ?? detail.buyer.company_name,
        orderCode: detail.order.order_code,
        piNo: detail.order.pi_no,
        total: detail.order.total,
        advance: detail.order.advance_expected,
        currency: detail.order.currency,
        company: companyShort,
      }),
    };
    return (
      <PrintLayout company={company} title="PROFORMA INVOICE" docNo={detail.order.pi_no} date={detail.order.created_at} currency={detail.order.currency} backHref={backHref} whatsapp={whatsapp}>
        <ProformaBody detail={detail} isExport={isExport} />
      </PrintLayout>
    );
  }

  const wanted = typeof searchParams?.dispatch === 'string' ? searchParams.dispatch : null;
  const dispatch = (wanted ? detail.dispatches.find((d) => d.id === wanted) : null) ?? detail.dispatches[0] ?? null;
  if (!dispatch) {
    return (
      <div className="mx-auto max-w-[190mm] p-6 text-[12pt]">
        <p className="mb-4">Not dispatched yet. Dispatch first.</p>
        <a href={backHref} className="underline">
          Back
        </a>
      </div>
    );
  }

  const whatsapp = {
    phone: detail.buyer.phone,
    message: dispatchedText(waLang(lang, isExport), {
      buyer: detail.buyer.contact_name ?? detail.buyer.company_name,
      orderCode: detail.order.order_code,
      invoiceNo: dispatch.invoice_no,
      dispatchedOn: dispatch.dispatched_on,
      mode: dispatch.mode,
      vehicleNo: dispatch.vehicle_no,
      containerNo: dispatch.container_no,
      vessel: dispatch.vessel,
      eta: dispatch.eta,
      qtyKg: dispatch.qty_kg,
      bags: dispatch.bags_count,
      company: companyShort,
    }),
  };

  if (doc === 'slip') {
    return (
      <PrintLayout company={company} title="DISPATCH SLIP" docNo={dispatch.sdn_no} date={dispatch.dispatched_on} currency={detail.order.currency} showBank={false} backHref={backHref} whatsapp={whatsapp}>
        <SlipBody detail={detail} dispatch={dispatch} />
      </PrintLayout>
    );
  }

  const title = isExport || detail.order.currency !== 'INR' ? 'COMMERCIAL INVOICE + PACKING LIST' : 'TAX INVOICE';
  return (
    <PrintLayout company={company} title={title} docNo={dispatch.invoice_no} date={dispatch.dispatched_on} currency={detail.order.currency} backHref={backHref} whatsapp={whatsapp}>
      <InvoiceBody detail={detail} dispatch={dispatch} isExport={isExport || detail.order.currency !== 'INR'} company={company} />
    </PrintLayout>
  );
}

function BuyerBlock({ detail, withGst }: { detail: OrderDetail; withGst: boolean }) {
  const b = detail.buyer;
  const lines = [
    b.address,
    [b.city, b.state].filter(Boolean).join(', '),
    b.country,
    withGst && b.gstin ? `GSTIN ${b.gstin}` : null,
    withGst && b.state ? `State: ${b.state} · Place of supply: ${b.state}` : null,
    [b.contact_name ? `Attn: ${b.contact_name}` : null, b.phone].filter(Boolean).join(' · ') || null,
  ].filter(Boolean) as string[];
  return (
    <section>
      <p className="font-bold">Buyer:</p>
      <p className="font-semibold">{b.company_name}</p>
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </section>
  );
}

function productCell(it: OrderItemView) {
  return (
    <>
      <p className="font-semibold">{it.product_name}</p>
      {(it.spec_text || it.product_mesh) && <p className="text-[10pt]">{it.spec_text || it.product_mesh}</p>}
      {it.product_hsn && <p className="text-[10pt]">HSN {it.product_hsn}</p>}
    </>
  );
}

/** GST lines for a rupee document: CGST + SGST inside Gujarat, IGST outside. */
function gstLines(detail: OrderDetail, gstAmount: number) {
  const rate = detail.items[0]?.gst_rate ?? 5;
  if ((detail.buyer.state ?? '').trim().toLowerCase() === 'gujarat') {
    const half = Math.round((gstAmount / 2) * 100) / 100;
    return [
      { label: `CGST ${rate / 2}%`, value: half },
      { label: `SGST ${rate / 2}%`, value: Math.round((gstAmount - half) * 100) / 100 },
    ];
  }
  return [{ label: `IGST ${rate}%`, value: gstAmount }];
}

function ProformaBody({ detail, isExport }: { detail: OrderDetail; isExport: boolean }) {
  const { order, items } = detail;
  const cur = order.currency;
  const isInr = cur === 'INR';
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const gst = isInr ? Math.max(0, Math.round((order.total - subtotal) * 100) / 100) : 0;
  const advancePct = order.total > 0 ? Math.round((order.advance_expected / order.total) * 100) : 0;

  return (
    <>
      <p>
        Order {order.order_code}
        {detail.quote_no ? ` · Against quotation ${detail.quote_no}` : ''}
      </p>
      <BuyerBlock detail={detail} withGst={isInr} />

      <table className="w-full border-collapse text-[11pt]">
        <thead>
          <tr className="border-y border-slate-400 text-left">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Product (spec)</th>
            <th className="py-1 pr-2">Packing</th>
            <th className="py-1 pr-2 text-right">Qty</th>
            <th className="py-1 pr-2 text-right">Rate</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id} className="border-b border-slate-300 align-top">
              <td className="py-1 pr-2">{i + 1}</td>
              <td className="py-1 pr-2">{productCell(it)}</td>
              <td className="py-1 pr-2">
                {it.planned_bags} bags x {it.bag_kg} kg{it.packaging_name ? ` ${it.packaging_name}` : ''}
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{kg(it.qty_kg)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{formatRate(it.rate, cur, it.unit)}</td>
              <td className="py-1 text-right tabular-nums">{money(it.amount, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="ml-auto w-[85mm] space-y-0.5">
        {isInr ? (
          <>
            <Line label="Subtotal" value={money(subtotal, cur)} />
            {gstLines(detail, gst).map((g) => (
              <Line key={g.label} label={g.label} value={money(g.value, cur)} />
            ))}
          </>
        ) : (
          <Line label="GST 0% - export under LUT" value={money(0, cur)} />
        )}
        <Line label="Total" value={money(order.total, cur)} bold />
        {order.advance_expected > 0 && (
          <>
            <Line label={`Advance ${advancePct}%`} value={money(order.advance_expected, cur)} />
            <Line label="Balance" value={money(order.total - order.advance_expected, cur)} />
          </>
        )}
      </section>
      <p>
        <span className="font-semibold">In words:</span> {amountInWords(order.total, cur)}
      </p>

      <section className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-slate-400 pt-3">
        <p>
          <span className="font-semibold">Price basis:</span> {order.incoterm}
        </p>
        <p>
          <span className="font-semibold">Payment:</span> {order.payment_terms}
        </p>
        <p>
          <span className="font-semibold">Shipment:</span> {order.expected_dispatch ? `by ${formatDate(order.expected_dispatch)}` : '-'}
        </p>
        <p>
          <span className="font-semibold">Origin:</span> India
          {isExport ? ` · Port of loading: ${order.incoterm.startsWith('FOB') ? defaultPort(order.incoterm) : 'Mundra'}` : ''}
        </p>
      </section>
    </>
  );
}

function InvoiceBody({ detail, dispatch, isExport, company }: { detail: OrderDetail; dispatch: Dispatch; isExport: boolean; company: BusinessSettings | null }) {
  const { order, items } = detail;
  const cur = order.currency;
  const ratio = detail.qty_kg > 0 ? dispatch.qty_kg / detail.qty_kg : 1;
  const lines = items.map((it) => {
    const qty = Math.round(it.qty_kg * ratio * 100) / 100;
    const bags = detail.items.length === 1 ? dispatch.bags_count : Math.round(it.planned_bags * ratio);
    return { it, qty, bags, amount: Math.round(it.amount * ratio * 100) / 100, gross: qty + bags * it.tare_kg };
  });
  const taxable = lines.reduce((s, l) => s + l.amount, 0);
  const total = dispatch.invoice_total;
  const gst = isExport ? 0 : Math.max(0, Math.round((total - taxable) * 100) / 100);
  const totalBags = lines.reduce((s, l) => s + l.bags, 0);
  const totalNet = lines.reduce((s, l) => s + l.qty, 0);
  const totalGross = lines.reduce((s, l) => s + l.gross, 0);

  return (
    <>
      <p>
        Order {order.order_code} · PI {order.pi_no} · Dispatch slip {dispatch.sdn_no}
      </p>
      <BuyerBlock detail={detail} withGst={!isExport} />
      {isExport && <p>Consignee: same as buyer</p>}

      <table className="w-full border-collapse text-[11pt]">
        <thead>
          <tr className="border-y border-slate-400 text-left">
            <th className="py-1 pr-2">Product</th>
            {isExport ? (
              <>
                <th className="py-1 pr-2 text-right">Bags</th>
                <th className="py-1 pr-2 text-right">Net</th>
                <th className="py-1 pr-2 text-right">Gross</th>
              </>
            ) : (
              <th className="py-1 pr-2 text-right">Qty</th>
            )}
            <th className="py-1 pr-2 text-right">Rate</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(({ it, qty, bags, amount, gross }) => (
            <tr key={it.id} className="border-b border-slate-300 align-top">
              <td className="py-1 pr-2">{productCell(it)}</td>
              {isExport ? (
                <>
                  <td className="py-1 pr-2 text-right tabular-nums">{bags}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{kg(qty)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{kg(gross)}</td>
                </>
              ) : (
                <td className="py-1 pr-2 text-right tabular-nums">{kg(qty)}</td>
              )}
              <td className="py-1 pr-2 text-right tabular-nums">{formatRate(it.rate, cur, it.unit)}</td>
              <td className="py-1 text-right tabular-nums">{money(amount, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="ml-auto w-[85mm] space-y-0.5">
        {isExport ? (
          <Line label="Total" value={money(total, cur)} bold />
        ) : (
          <>
            <Line label="Subtotal" value={money(taxable, cur)} />
            {gstLines(detail, gst).map((g) => (
              <Line key={g.label} label={g.label} value={money(g.value, cur)} />
            ))}
            <Line label="Grand total" value={money(total, cur)} bold />
          </>
        )}
      </section>
      <p>
        <span className="font-semibold">In words:</span> {amountInWords(total, cur)}
      </p>

      <section className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-slate-400 pt-3">
        {dispatch.mode === 'container' ? (
          <>
            <p>
              <span className="font-semibold">Container:</span> {dispatch.container_no ?? '-'}
            </p>
            <p>
              <span className="font-semibold">Port of loading:</span> {dispatch.port ?? '-'}
            </p>
            <p>
              <span className="font-semibold">Port of discharge:</span> {detail.buyer.city ?? '-'}
            </p>
            <p>
              <span className="font-semibold">Vessel:</span> {dispatch.vessel ?? '-'}
            </p>
            <p>
              <span className="font-semibold">Stuffing date:</span> {formatDate(dispatch.stuffing_date) || '-'}
            </p>
            <p>
              <span className="font-semibold">ETA:</span> {formatDate(dispatch.eta) || '-'}
            </p>
            <p className="col-span-2">
              <span className="font-semibold">Marks:</span> {detail.buyer.company_name} · {order.order_code}
            </p>
          </>
        ) : (
          <>
            <p>
              <span className="font-semibold">Vehicle no:</span> {dispatch.vehicle_no ?? '-'}
            </p>
            <p>
              <span className="font-semibold">LR no:</span> {dispatch.lr_no ?? '-'}
            </p>
            <p>
              <span className="font-semibold">Transporter:</span> {dispatch.transporter ?? '-'}
            </p>
            <p>
              <span className="font-semibold">Dispatch date:</span> {formatDate(dispatch.dispatched_on)}
            </p>
          </>
        )}
        <p>
          <span className="font-semibold">Price basis:</span> {order.incoterm}
        </p>
        <p>
          <span className="font-semibold">Payment:</span> {order.payment_terms}
        </p>
      </section>

      {isExport ? (
        <>
          <p className="text-[10pt]">
            Supply meant for export under LUT without payment of IGST.{company?.iec_code ? ` IEC ${company.iec_code}.` : ''}
            {company?.fssai_no ? ` FSSAI ${company.fssai_no}.` : ''}
          </p>
          <section className="border-t border-slate-400 pt-3">
            <h3 className="font-bold">Packing list</h3>
            <p>
              Bags {totalBags} · Net per bag {(detail.bag_kg).toFixed(2)} kg · Tare {(detail.items[0]?.tare_kg ?? 0).toFixed(2)} kg
            </p>
            <p>
              Total net {kg(totalNet)} · Total gross {kg(Math.round(totalGross * 100) / 100)}
            </p>
          </section>
        </>
      ) : (
        <p className="text-[10pt]">E-way bill / e-invoice as per Tally.</p>
      )}
    </>
  );
}

function SlipBody({ detail, dispatch }: { detail: OrderDetail; dispatch: Dispatch }) {
  const { order, buyer, items } = detail;
  return (
    <section className="max-w-[140mm] space-y-1 border border-slate-800 p-4 text-[12pt]">
      <p>
        Order {order.order_code} · Invoice {dispatch.invoice_no}
      </p>
      <p>
        To: {buyer.company_name}
        {buyer.city ? `, ${buyer.city}` : ''}
      </p>
      {items.map((it) => (
        <p key={it.id} className="font-semibold">
          {it.product_name}
          {it.product_mesh ? ` ${it.product_mesh}` : ''}
        </p>
      ))}
      <p className="text-[14pt] font-bold">
        {dispatch.bags_count} bags x {detail.bag_kg} kg = {kg(dispatch.qty_kg)}
      </p>
      <p>
        {dispatch.mode === 'container'
          ? `Container ${dispatch.container_no ?? ''} · ${dispatch.port ?? ''}`
          : `Truck ${dispatch.vehicle_no ?? ''}${dispatch.lr_no ? ` · LR ${dispatch.lr_no}` : ''}${dispatch.transporter ? ` · ${dispatch.transporter}` : ''}`}
      </p>
      <p className="pt-6">Loaded by: ____________________ Checked: ____________________</p>
    </section>
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
