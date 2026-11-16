'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import type { Incoterm, RateUnit } from '@/types/quotes';
import { INCOTERMS } from '@/types/quotes';
import { cn, formatMoney } from '@/lib/utils';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { NumberInput } from '@/components/ui/number-input';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { MoreFields } from '@/components/ui/more-fields';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Button, buttonVariants } from '@/components/ui/button';
import { useLang, useT } from '@/components/shell/lang-provider';
import { shortProductName, defaultSpecText } from '@/components/samples/product-short';
import { PAYMENT_TERM_PRESETS, QUOTE_LABELS, VALID_DAY_CHOICES } from '@/app/(dashboard)/quotes/labels';
import {
  aboutInrLine,
  currencySymbol,
  daysUntil,
  defaultCurrency,
  defaultIncoterm,
  findPrice,
  floorFor,
  isExportBuyer,
  isoDate,
  itemAmount,
  matchPaymentTerms,
  pricedCurrencies,
  quoteErrorText,
} from '@/app/(dashboard)/quotes/helpers';
import type { QuoteFormData } from '@/app/(dashboard)/quotes/data';
import { createQuoteAction, updateQuoteAction, type QuoteInput } from '@/app/(dashboard)/quotes/actions';

export interface QuoteFormInitial {
  inquiry_id: string | null;
  inquiry_code: string | null;
  buyer_id: string | null;
  currency: string | null;
  incoterm: Incoterm | null;
  payment_terms: string | null;
  valid_till: string | null;
  notes: string | null;
  items: { product_id: string; packaging_type_id: string | null; qty_kg: number; unit: RateUnit; rate: number | null; spec_text: string | null }[];
}

export interface QuoteFormProps {
  mode: 'new' | 'edit';
  quoteId?: string;
  initial: QuoteFormInitial;
  /** true when the form came from an inquiry (buyer cannot change) */
  buyerLocked: boolean;
  data: QuoteFormData;
  isOwner: boolean;
  backHref: string;
}

interface ItemState {
  key: number;
  product_id: string;
  qtyText: string;
  qtyUnit: RateUnit;
  unit: RateUnit;
  rateText: string;
  spec_text: string;
}

const OTHER_TERMS = '__other__';
const UNIT_OPTIONS = (tt: (k: string) => string) => [
  { value: 'kg', label: tt('unit.kg') },
  { value: 'MT', label: tt('unit.mt') },
];

function toNumber(text: string): number {
  const n = Number(String(text).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function qtyKgOf(it: ItemState): number {
  const n = toNumber(it.qtyText);
  return it.qtyUnit === 'MT' ? n * 1000 : n;
}

let keySeq = 1;

/** New / edit quote (screens.md 13): buyer, item cards, price basis, payment, valid for, More. */
export function QuoteForm({ mode, quoteId, initial, buyerLocked, data, isOwner, backHref }: QuoteFormProps) {
  const lang = useLang();
  const tt = useT(QUOTE_LABELS);
  const router = useRouter();
  const today = isoDate();

  const buyerById = React.useCallback((id: string) => data.buyers.find((b) => b.id === id) ?? null, [data.buyers]);
  const productById = React.useCallback((id: string) => data.products.find((p) => p.id === id) ?? null, [data.products]);

  const initialBuyer = initial.buyer_id ? buyerById(initial.buyer_id) : null;
  const initialProduct = initial.items[0]?.product_id ?? null;
  const [buyerId, setBuyerId] = React.useState(initial.buyer_id ?? '');
  const [currency, setCurrency] = React.useState(initial.currency ?? defaultCurrency(initialBuyer, data.prices, initialProduct));
  const [incoterm, setIncoterm] = React.useState<Incoterm>(initial.incoterm ?? defaultIncoterm(initialBuyer, data.defaultIncoterm));
  const initialTerms = initial.payment_terms ?? matchPaymentTerms(initialBuyer?.payment_terms);
  const [termsChoice, setTermsChoice] = React.useState<string>(
    (PAYMENT_TERM_PRESETS as readonly string[]).includes(initialTerms) ? initialTerms : OTHER_TERMS
  );
  const [termsOther, setTermsOther] = React.useState((PAYMENT_TERM_PRESETS as readonly string[]).includes(initialTerms) ? '' : initialTerms);
  const [validDays, setValidDays] = React.useState<number>(initial.valid_till ? Math.max(1, daysUntil(initial.valid_till, today)) : 10);
  const [packagingId, setPackagingId] = React.useState(initial.items[0]?.packaging_type_id ?? data.packaging[0]?.id ?? '');
  const [notes, setNotes] = React.useState(initial.notes ?? '');
  const [items, setItems] = React.useState<ItemState[]>(() => {
    const cur = initial.currency ?? defaultCurrency(initialBuyer, data.prices, initialProduct);
    const list = initial.items.length > 0 ? initial.items : [{ product_id: '', packaging_type_id: null, qty_kg: 0, unit: 'kg' as RateUnit, rate: null, spec_text: null }];
    return list.map((it) => {
      const price = it.product_id ? findPrice(data.prices, it.product_id, cur, it.unit) : null;
      const unit: RateUnit = it.rate !== null ? it.unit : ((price?.unit as RateUnit) ?? it.unit);
      const rate = it.rate !== null ? it.rate : price ? Number(price.rate) : 0;
      const useMt = it.qty_kg >= 1000 && it.qty_kg % 1000 === 0;
      return {
        key: keySeq++,
        product_id: it.product_id,
        qtyText: it.qty_kg ? String(useMt ? it.qty_kg / 1000 : it.qty_kg) : '',
        qtyUnit: useMt ? 'MT' : 'kg',
        unit,
        rateText: rate ? String(rate) : '',
        spec_text: it.spec_text ?? defaultSpecText(productById(it.product_id)),
      };
    });
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const buyer = buyerId ? buyerById(buyerId) : null;
  const symbol = currencySymbol(currency);
  const fxRate = currency === 'INR' ? null : data.currencyRates[currency] ?? null;

  /** Re-price every item from the list for a currency (when the buyer or currency changes). */
  function repriceItems(cur: string) {
    setItems((prev) =>
      prev.map((it) => {
        if (!it.product_id) return it;
        const price = findPrice(data.prices, it.product_id, cur, it.unit);
        if (!price) return it;
        return { ...it, unit: price.unit as RateUnit, rateText: String(Number(price.rate)) };
      })
    );
  }

  function pickBuyer(id: string) {
    setBuyerId(id);
    const b = buyerById(id);
    const cur = defaultCurrency(b, data.prices, items[0]?.product_id || null);
    setCurrency(cur);
    setIncoterm(defaultIncoterm(b, data.defaultIncoterm));
    const terms = matchPaymentTerms(b?.payment_terms);
    if ((PAYMENT_TERM_PRESETS as readonly string[]).includes(terms)) {
      setTermsChoice(terms);
      setTermsOther('');
    } else {
      setTermsChoice(OTHER_TERMS);
      setTermsOther(terms);
    }
    repriceItems(cur);
  }

  function pickCurrency(cur: string) {
    setCurrency(cur);
    repriceItems(cur);
  }

  function updateItem(key: number, patch: Partial<ItemState>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function pickProduct(key: number, productId: string) {
    const price = findPrice(data.prices, productId, currency);
    const product = productById(productId);
    updateItem(key, {
      product_id: productId,
      unit: (price?.unit as RateUnit) ?? 'kg',
      rateText: price ? String(Number(price.rate)) : '',
      spec_text: defaultSpecText(product),
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { key: keySeq++, product_id: '', qtyText: '', qtyUnit: 'kg', unit: 'kg', rateText: '', spec_text: '' }]);
  }

  function removeItem(key: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }

  // Totals (same arithmetic as the triggers)
  const computed = items.map((it) => {
    const qtyKg = qtyKgOf(it);
    const rate = toNumber(it.rateText);
    const amount = qtyKg > 0 && rate > 0 ? itemAmount(qtyKg, rate, it.unit) : 0;
    const floor = it.product_id ? floorFor(data.prices, it.product_id, currency, it.unit) : null;
    const below = floor !== null && rate > 0 && rate < floor;
    // No price-list rate for this product in the quote currency: no floor, owner only (item guard).
    const noPrice = !!it.product_id && floor === null;
    const gstRate = currency === 'INR' ? Number(productById(it.product_id)?.gst_rate ?? 5) : 0;
    return { qtyKg, rate, amount, floor, below, noPrice, gstRate };
  });
  const subtotal = computed.reduce((s, c) => s + c.amount, 0);
  const gst = currency === 'INR' ? Math.round(computed.reduce((s, c) => s + (c.amount * c.gstRate) / 100, 0) * 100) / 100 : 0;
  const total = subtotal + gst;
  const anyBelow = computed.some((c) => c.below);
  const firstBelowFloor = computed.find((c) => c.below)?.floor ?? null;
  const anyNoPrice = computed.some((c) => c.noPrice);

  // Only currencies the price list prices the picked products in (an unpriced one has no floor).
  const priced = pricedCurrencies(data.prices, items.map((it) => it.product_id), today);
  const currencyChoices = priced.length > 0 ? priced : [currency];
  const paymentTerms = termsChoice === OTHER_TERMS ? termsOther.trim() : termsChoice;

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!buyerId) next.buyer = tt('quotes.pick_buyer');
    items.forEach((it, i) => {
      if (!it.product_id) next[`item_${it.key}`] = tt('quotes.pick_product');
      else if (computed[i].qtyKg <= 0) next[`item_${it.key}`] = tt('quotes.type_qty');
      else if (computed[i].rate <= 0) next[`item_${it.key}`] = tt('quotes.type_rate');
    });
    if (!paymentTerms) next.terms = tt('msg.error.required');
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (anyNoPrice && !isOwner) {
      setBanner(tt('quotes.no_price', { currency }));
      return;
    }
    if (anyBelow && !isOwner) {
      setBanner(tt('msg.below_floor', { floor: formatMoney(firstBelowFloor ?? 0, currency, { decimals: 0 }) }));
      return;
    }

    const payload: QuoteInput = {
      inquiry_id: initial.inquiry_id,
      buyer_id: buyerId,
      currency,
      fx_rate: fxRate,
      incoterm,
      valid_till: isoDate(new Date(), validDays),
      payment_terms: paymentTerms,
      notes: notes.trim() || null,
      items: items.map((it, i) => ({
        product_id: it.product_id,
        packaging_type_id: packagingId || null,
        qty_kg: computed[i].qtyKg,
        unit: it.unit,
        rate: computed[i].rate,
        spec_text: it.spec_text.trim() || null,
      })),
    };

    setSaving(true);
    const result = mode === 'edit' && quoteId ? await updateQuoteAction({ ...payload, id: quoteId }) : await createQuoteAction(payload);
    setSaving(false);
    if (!result.ok) {
      setBanner(quoteErrorText(tt, result.messageKey, result.detail, currency));
      return;
    }
    router.push(`/quotes/${result.id}?saved=${encodeURIComponent(result.code ?? '')}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 pb-28 md:pb-0">
      {/* Buyer */}
      {buyerLocked && buyer ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-700">{tt('field.quote.buyer')}</p>
          <p className="text-lg font-semibold text-slate-900">{buyer.company_name}</p>
          <p className="text-base text-slate-500">
            {initial.inquiry_code ? `${tt('field.quote.inquiry')} ${initial.inquiry_code} · ` : ''}
            {isExportBuyer(buyer) ? tt('quotes.export') : tt('quotes.india')} · {currency}
          </p>
        </div>
      ) : (
        <FormField htmlFor="buyer" label={tt('field.quote.buyer')} error={errors.buyer} hint={buyer ? `${isExportBuyer(buyer) ? tt('quotes.export') : tt('quotes.india')} · ${currency}` : undefined}>
          <Select value={buyerId} onChange={(e) => pickBuyer(e.target.value)}>
            <option value="">{tt('common.not_set')}</option>
            {data.buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.company_name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {(currencyChoices.length > 1 || !currencyChoices.includes(currency)) && (
        <div>
          <p className="mb-1.5 text-sm font-semibold text-slate-700">{tt('field.quote.currency')}</p>
          <ChoiceChips ariaLabel={tt('field.quote.currency')} value={currency} onChange={pickCurrency} options={currencyChoices.map((c) => ({ value: c, label: `${currencySymbol(c)} ${c}` }))} />
        </div>
      )}

      {/* Items */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">{tt('section.items')}</h2>
        {items.map((it, i) => {
          const c = computed[i];
          const err = errors[`item_${it.key}`];
          return (
            <div key={it.key} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700">{tt('field.quote_item.product')}</p>
                {items.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" aria-label={tt('btn.remove')} onClick={() => removeItem(it.key)}>
                    <X aria-hidden="true" />
                  </Button>
                )}
              </div>
              <ChoiceChips
                ariaLabel={tt('field.quote_item.product')}
                value={it.product_id || null}
                onChange={(v) => pickProduct(it.key, v)}
                options={data.products.map((p) => ({ value: p.id, label: shortProductName(p, lang) }))}
              />
              <div>
                <p className="mb-1.5 text-sm font-semibold text-slate-700">{tt('field.quote_item.qty')}</p>
                <NumberInput
                  aria-label={tt('field.quote_item.qty')}
                  value={it.qtyText}
                  onChange={(v) => updateItem(it.key, { qtyText: v })}
                  units={UNIT_OPTIONS(tt)}
                  unit={it.qtyUnit}
                  onUnitChange={(u) => updateItem(it.key, { qtyUnit: u as RateUnit })}
                />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-slate-700">
                  {tt('field.quote_item.rate')} <span className="font-normal text-slate-500">({tt('field.quote_item.unit')})</span>
                </p>
                <NumberInput
                  aria-label={tt('field.quote_item.rate')}
                  value={it.rateText}
                  onChange={(v) => updateItem(it.key, { rateText: v })}
                  prefix={symbol}
                  units={UNIT_OPTIONS(tt)}
                  unit={it.unit}
                  onUnitChange={(u) => {
                    const price = it.product_id ? findPrice(data.prices, it.product_id, currency, u as RateUnit) : null;
                    updateItem(it.key, { unit: u as RateUnit, rateText: price && price.unit === u ? String(Number(price.rate)) : it.rateText });
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                {c.floor !== null ? (
                  <p className={cn('flex items-center gap-1.5 text-base font-medium', c.below ? 'text-rose-700' : 'text-emerald-800')}>
                    {c.below ? <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />}
                    {tt(c.below ? 'quotes.floor_below' : 'quotes.floor_ok', { floor: formatMoney(c.floor, currency, { decimals: 0 }) })}
                  </p>
                ) : c.noPrice ? (
                  <p className="flex items-center gap-1.5 text-base font-medium text-rose-700">
                    <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {tt('quotes.no_price_line', { currency })}
                  </p>
                ) : (
                  <span />
                )}
                <p className="text-lg font-semibold tabular-nums text-slate-900">{formatMoney(c.amount, currency)}</p>
              </div>
              {err && (
                <p role="alert" className="flex items-center gap-1 text-sm text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {err}
                </p>
              )}
            </div>
          );
        })}
        <Button type="button" variant="outline" fullWidth onClick={addItem}>
          <Plus aria-hidden="true" />
          {tt('btn.add_item')}
        </Button>
      </section>

      {/* Price basis */}
      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700">{tt('field.quote.incoterm')}</p>
        <ChoiceChips<Incoterm>
          ariaLabel={tt('field.quote.incoterm')}
          value={incoterm}
          onChange={setIncoterm}
          options={INCOTERMS.map((i) => ({ value: i, label: tt(`incoterm.${i.replace(' ', '_')}`) }))}
        />
      </div>

      {/* Payment */}
      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700">{tt('field.quote.payment_terms')}</p>
        <ChoiceChips
          ariaLabel={tt('field.quote.payment_terms')}
          value={termsChoice}
          onChange={setTermsChoice}
          options={[...PAYMENT_TERM_PRESETS.map((p) => ({ value: p, label: p })), { value: OTHER_TERMS, label: tt('quotes.pay_other') }]}
        />
        {termsChoice === OTHER_TERMS && (
          <div className="mt-2">
            <Input aria-label={tt('field.quote.payment_terms')} value={termsOther} onChange={(e) => setTermsOther(e.target.value)} />
          </div>
        )}
        {errors.terms && (
          <p role="alert" className="mt-1 flex items-center gap-1 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {errors.terms}
          </p>
        )}
      </div>

      {/* Valid for */}
      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700">{tt('field.quote.valid_days')}</p>
        <ChoiceChips
          ariaLabel={tt('field.quote.valid_days')}
          value={String(validDays)}
          onChange={(v) => setValidDays(Number(v))}
          options={Array.from(new Set([...VALID_DAY_CHOICES, validDays])).sort((a, b) => a - b).map((n) => ({ value: String(n), label: tt('quotes.valid_days_chip', { n }) }))}
        />
      </div>

      <MoreFields>
        <FormField htmlFor="packaging" label={tt('field.quote_item.packaging')}>
          <Select value={packagingId} onChange={(e) => setPackagingId(e.target.value)}>
            <option value="">{tt('common.not_set')}</option>
            {data.packaging.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>
        {items.map((it) => (
          <FormField key={it.key} htmlFor={`spec-${it.key}`} label={`${tt('field.quote_item.spec')} · ${shortProductName(productById(it.product_id), lang) || it.key}`}>
            <Input value={it.spec_text} onChange={(e) => updateItem(it.key, { spec_text: e.target.value })} />
          </FormField>
        ))}
        <FormField htmlFor="notes" label={tt('field.quote.notes')} hint={tt('common.optional')}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </MoreFields>

      {/* Totals */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {currency === 'INR' && (
          <>
            <Row label={tt('field.quote.subtotal')} value={formatMoney(subtotal, currency)} />
            <Row label={`${tt('field.quote.gst')} ${computed[0]?.gstRate ?? 5}%`} value={formatMoney(gst, currency)} />
          </>
        )}
        <Row label={tt('field.quote.total')} value={formatMoney(total, currency)} bold />
        {fxRate && <p className="mt-1 text-sm text-slate-500">{aboutInrLine(lang, total, currency, fxRate, QUOTE_LABELS)}</p>}
      </div>

      {banner && (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-base text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          {banner}
        </p>
      )}
      {anyBelow && isOwner && (
        <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-base text-amber-900">
          {tt('msg.below_floor_owner', { floor: formatMoney(firstBelowFloor ?? 0, currency, { decimals: 0 }) })}
        </p>
      )}
      {anyNoPrice && isOwner && (
        <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-base text-amber-900">
          {tt('quotes.no_price_owner', { currency })}
        </p>
      )}

      <StickyBar>
        <Link href={backHref} className={buttonVariants({ variant: 'outline', className: 'hidden md:inline-flex' })}>
          {tt('btn.cancel')}
        </Link>
        <Button type="submit" fullWidth loading={saving} loadingLabel={tt('btn.saving')} className="md:w-auto">
          {tt('btn.save')}
        </Button>
      </StickyBar>
    </form>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1', bold && 'text-lg font-bold')}>
      <span className={bold ? 'text-slate-900' : 'text-slate-700'}>{label}</span>
      <span className="tabular-nums text-slate-900">{value}</span>
    </div>
  );
}
