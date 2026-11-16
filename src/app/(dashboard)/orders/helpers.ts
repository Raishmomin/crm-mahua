/**
 * Pure helpers shared by the order pages, the packing card, the papers and the Money screens.
 * No server imports: safe in client components and in Vitest.
 */
import { t, type Lang } from '@/lib/i18n';
import { CHECKLIST_KEYS } from '@/lib/status';
import { formatDate, formatMoney, formatQty } from '@/lib/utils';
import { isExportType } from '@/types/buyers';
import type { ExportChecklist } from '@/types/orders';
import { ORDER_LABELS } from './labels';

/** "White Minced 1-3 mm": colour + form words (translated) + mesh. */
export function productShort(lang: Lang, p: { form?: string | null; color?: string | null; mesh?: string | null }): string {
  const parts = [
    p.color ? t(lang, `product.color.${p.color}`) : '',
    p.form ? t(lang, `product.form.${p.form}`) : '',
    p.mesh ?? '',
  ].filter(Boolean);
  return parts.join(' ');
}

/**
 * Export or India (G2-04). The buyer type decides (export_importer / export_agent), the same code
 * the buyer screens use, so a buyer saved without a country still gets Container, English WhatsApp
 * text and the export papers. Without a type: the contract rule `country <> 'India'` (contracts 6.3,
 * as quotes/helpers.ts and fn_quote_accept read it): an empty country is export, a missing one India.
 */
export function isExportBuyer(b: { buyer_type?: string | null; country?: string | null }): boolean {
  if (b.buyer_type) return isExportType(b.buyer_type);
  return (b.country ?? 'India').trim().toLowerCase() !== 'india';
}

/** Number of the 8 export checklist items that are done. */
export function checklistDoneCount(list: ExportChecklist | null | undefined): number {
  if (!list || typeof list !== 'object') return 0;
  return CHECKLIST_KEYS.filter((k) => list[k]?.done === true).length;
}

/** Indian financial year code of a date: 2026-11-16 -> '2627'. Same rule as fn_current_fy. */
export function fyOf(d: Date = new Date()): string {
  const y = d.getFullYear();
  const start = d.getMonth() >= 3 ? y : y - 1;
  const two = (n: number) => String(n % 100).padStart(2, '0');
  return `${two(start)}${two(start + 1)}`;
}

/** The number the next fn_next_doc_no call will most likely return (for the look-before-you-leap sheet). */
export function nextDocNo(docType: string, fy: string, currentVal: number | null | undefined): string {
  return `${docType}-${fy}-${String((Number(currentVal) || 0) + 1).padStart(4, '0')}`;
}

/** Bags planned for a quantity: ceil(kg / bag kg), 25 kg default. */
export function plannedBags(qtyKg: number, bagKg: number | null | undefined): number {
  const cap = Number(bagKg) > 0 ? Number(bagKg) : 25;
  return Math.ceil((Number(qtyKg) || 0) / cap);
}

/** Label text rule (screens.md 16B): buyer + product + "Net 25 kg" + our company, India. */
export function composeLabel(opts: { packingNote?: string | null; buyer: string; product: string; bagKg: number; company: string }): string[] {
  if (opts.packingNote && opts.packingNote.trim()) return opts.packingNote.split('\n').map((l) => l.trim()).filter(Boolean);
  return [opts.buyer, `${opts.product} · Net ${opts.bagKg} kg`, [opts.company, 'India'].filter(Boolean).join(', ')];
}

/** Port chip default from the price basis: FOB Pipavav -> Pipavav, else Mundra (default_incoterm). */
export function defaultPort(incoterm: string | null | undefined): 'Pipavav' | 'Mundra' {
  return incoterm === 'FOB Pipavav' ? 'Pipavav' : 'Mundra';
}

/** Export buyers always get the English WhatsApp text (contracts 6.3). */
export function waLang(lang: Lang, isExport: boolean): Lang {
  return isExport ? 'en' : lang;
}

/** T4 wa.pi_share: order made. */
export function piShareText(lang: Lang, o: { buyer: string; orderCode: string; piNo: string; total: number; advance: number; currency: string; company: string }): string {
  return t(lang, 'wa.pi_share', {
    buyer: o.buyer,
    order_code: o.orderCode,
    pi_no: o.piNo,
    amount: formatMoney(o.total, o.currency),
    advance: formatMoney(o.advance, o.currency),
    company: o.company,
  });
}

/** T5 wa.dispatched: after dispatch, with the dispatch date (G2-06: shared on any later day too). */
export function dispatchedText(
  lang: Lang,
  d: { buyer: string; orderCode: string; invoiceNo: string; dispatchedOn: string; mode: string; vehicleNo?: string | null; containerNo?: string | null; vessel?: string | null; eta?: string | null; qtyKg: number; bags: number; company: string }
): string {
  const how =
    d.mode === 'container'
      ? [
          t(lang, 'orders.container_line', { no: d.containerNo ?? '' }, ORDER_LABELS),
          d.vessel ? t(lang, 'orders.vessel_line', { vessel: d.vessel }, ORDER_LABELS) : null,
          d.eta ? t(lang, 'orders.eta', { date: formatDate(d.eta) }, ORDER_LABELS) : null,
        ]
          .filter(Boolean)
          .join(', ')
      : t(lang, 'orders.vehicle_line', { vehicle: d.vehicleNo ?? '' }, ORDER_LABELS);
  return t(lang, 'wa.dispatched', {
    buyer: d.buyer,
    order_code: d.orderCode,
    date: formatDate(d.dispatchedOn),
    invoice_no: d.invoiceNo,
    vehicle_or_container: how,
    qty: `${t(lang, 'orders.n_bags', { n: d.bags }, ORDER_LABELS)}, ${formatQty(d.qtyKg, lang)}`,
    company: d.company,
  });
}

/** T6 wa.payment_reminder. */
export function reminderText(
  lang: Lang,
  r: { buyer: string; due: number; currency: string; orderCode: string; invoiceNo: string | null; piNo: string; dueDate: string | null; company: string }
): string {
  return t(lang, 'wa.payment_reminder', {
    buyer: r.buyer,
    amount: formatMoney(r.due, r.currency),
    order_code: r.orderCode,
    invoice_no: r.invoiceNo ?? r.piNo,
    due_date: formatDate(r.dueDate ?? new Date()),
    company: r.company,
  });
}

/** T7 wa.checklist_status. */
export function checklistStatusText(
  lang: Lang,
  c: { orderCode: string; containerNo: string | null; eta: string | null; list: ExportChecklist; sender: string; company: string }
): string {
  const done = CHECKLIST_KEYS.filter((k) => c.list[k]?.done).map((k) => t(lang, `checklist.${k}`));
  const pending = CHECKLIST_KEYS.filter((k) => !c.list[k]?.done).map((k) => t(lang, `checklist.${k}`));
  return t(lang, 'wa.checklist_status', {
    order_code: c.orderCode,
    container_no: c.containerNo ?? '',
    done_list: done.join(', ') || '-',
    pending_list: pending.join(', ') || '-',
    eta: c.eta ? formatDate(c.eta) : '-',
    sender: c.sender,
    company: c.company,
  });
}

/** T8 wa.receipt. */
export function receiptText(lang: Lang, r: { buyer: string; amount: number; currency: string; orderCode: string; receiptNo: string; due: number; company: string }): string {
  return t(lang, 'wa.receipt', {
    buyer: r.buyer,
    amount: formatMoney(r.amount, r.currency),
    order_code: r.orderCode,
    receipt_no: r.receiptNo,
    due: formatMoney(r.due, r.currency),
    company: r.company,
  });
}

/**
 * Money received amount to prefill (G2-10): while the advance is still waiting, only the rest of
 * the advance (the form then shows the full due as a hint); otherwise the whole due.
 */
export function prefillAmount(o: { due: number; advance_expected: number; received: number; advance_ok: boolean }): { amount: number; advance: boolean } {
  const advanceLeft = Math.round((o.advance_expected - o.received) * 100) / 100;
  if (!o.advance_ok && advanceLeft > 0 && advanceLeft < o.due) return { amount: advanceLeft, advance: true };
  return { amount: o.due, advance: false };
}

/** Days between today and an ISO date (positive = past). */
export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const today = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((b - a) / 86400000);
}
