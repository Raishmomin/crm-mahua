'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Search } from 'lucide-react';
import { formatPhoneDisplay, isValidPhone } from '@/lib/phone';
import type { Inquiry, InquirySource } from '@/types/inquiries';
import { INQUIRY_SOURCES } from '@/types/inquiries';
import { isExportType } from '@/types/buyers';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { NumberInput } from '@/components/ui/number-input';
import { DateInput } from '@/components/ui/date-input';
import { MoreFields } from '@/components/ui/more-fields';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Button } from '@/components/ui/button';
import { ListCard, ListStack } from '@/components/ui/list-card';
import { useLang, useT } from '@/components/shell/lang-provider';
import { createInquiryAction, updateInquiryAction } from '@/app/(dashboard)/inquiries/actions';
import { INQUIRY_LABELS } from '@/app/(dashboard)/inquiries/labels';
import { matchesSearch, productShortName, SOURCE_KEYS, type BuyerLite, type ProductLite } from './helpers';

const OTHER = '__other__';
const MAX_RESULTS = 6;

export interface InquiryFormProps {
  buyers: BuyerLite[];
  products: ProductLite[];
  /** edit mode */
  initial?: Inquiry | null;
  /** /inquiries/new?buyer=<id> */
  preselectBuyerId?: string | null;
}

type Errors = Partial<Record<'buyer' | 'phone' | 'product' | 'qty', string>>;

function qtyFromKg(kg: number | null | undefined): { text: string; unit: 'kg' | 'MT' } {
  const n = Number(kg ?? 0);
  if (n >= 1000 && n % 1000 === 0) return { text: String(n / 1000), unit: 'MT' };
  return { text: n ? String(n) : '', unit: 'kg' };
}

/** New / edit inquiry (screens.md 5): buyer picker, product chips, how much, needed by, source, More (note). */
export function InquiryForm({ buyers, products, initial, preselectBuyerId }: InquiryFormProps) {
  const lang = useLang();
  const tt = useT(INQUIRY_LABELS);
  const router = useRouter();
  const isEdit = Boolean(initial);

  const initialBuyer = React.useMemo(
    () => buyers.find((b) => b.id === (initial?.buyer_id ?? preselectBuyerId ?? '')) ?? null,
    [buyers, initial?.buyer_id, preselectBuyerId]
  );
  const initialQty = qtyFromKg(initial?.qty_kg);

  const [buyer, setBuyer] = React.useState<BuyerLite | null>(initialBuyer);
  const [search, setSearch] = React.useState('');
  const [newBuyer, setNewBuyer] = React.useState(Boolean(initial && !initial.buyer_id));
  const [newName, setNewName] = React.useState(initial && !initial.buyer_id ? initial.buyer_name : '');
  const [newPhone, setNewPhone] = React.useState(initial && !initial.buyer_id ? initial.phone ?? '' : '+91 ');
  const [productId, setProductId] = React.useState<string | null>(initial ? initial.product_id ?? (initial.product_text ? OTHER : null) : null);
  const [productText, setProductText] = React.useState(initial?.product_text ?? '');
  const [qty, setQty] = React.useState(initialQty.text);
  const [unit, setUnit] = React.useState<'kg' | 'MT'>(initial ? initialQty.unit : initialBuyer && isExportType(initialBuyer.buyer_type) ? 'MT' : 'kg');
  const [neededBy, setNeededBy] = React.useState(initial?.needed_by ?? '');
  const [source, setSource] = React.useState<InquirySource>(initial?.source ?? 'whatsapp');
  const [notes, setNotes] = React.useState(initial?.notes ?? '');
  const [errors, setErrors] = React.useState<Errors>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const results = React.useMemo(() => {
    if (!search.trim()) return buyers.slice(0, MAX_RESULTS);
    return buyers.filter((b) => matchesSearch(search, [b.company_name, b.city, b.phone, b.contact_name])).slice(0, MAX_RESULTS);
  }, [buyers, search]);

  function pickBuyer(b: BuyerLite) {
    setBuyer(b);
    setNewBuyer(false);
    setSearch('');
    setErrors((e) => ({ ...e, buyer: undefined, phone: undefined }));
    if (!isEdit && !qty) setUnit(isExportType(b.buyer_type) ? 'MT' : 'kg');
  }

  function startNewBuyer() {
    setBuyer(null);
    setNewBuyer(true);
    if (!newName && search.trim()) setNewName(search.trim());
    setErrors((e) => ({ ...e, buyer: undefined }));
  }

  async function save() {
    const next: Errors = {};
    if (!buyer && !(newBuyer && newName.trim())) next.buyer = tt('inquiries.pick_buyer');
    if (!buyer && newBuyer && newName.trim() && !isValidPhone(newPhone)) next.phone = tt('msg.error.phone');
    if (!productId || (productId === OTHER && !productText.trim())) next.product = tt('inquiries.pick_product');
    const qtyNum = Number(qty.replace(/,/g, ''));
    if (!qty || !Number.isFinite(qtyNum) || qtyNum <= 0) next.qty = tt('inquiries.type_qty');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const qtyKg = unit === 'MT' ? qtyNum * 1000 : qtyNum;
    const base = {
      buyer_id: buyer?.id ?? null,
      buyer_name: buyer ? buyer.company_name : newName.trim(),
      phone: buyer ? buyer.phone : newPhone.trim(),
      product_id: productId === OTHER ? null : productId,
      product_text: productId === OTHER ? productText.trim() : null,
      qty_kg: qtyKg,
      needed_by: neededBy || null,
      source,
      notes: notes.trim() || null,
    };

    setSaving(true);
    setBanner(null);
    const result = isEdit
      ? await updateInquiryAction({ ...base, id: initial!.id })
      : await createInquiryAction({ ...base, new_buyer: !buyer && newBuyer ? { name: newName.trim(), phone: newPhone.trim() } : null });
    setSaving(false);

    if (!result.ok) {
      setBanner(tt(result.messageKey, result.detail ? { floor: result.detail } : undefined));
      return;
    }
    router.push(isEdit ? `/inquiries/${initial!.id}` : `/inquiries/${result.id}?saved=1`);
    router.refresh();
  }

  const productOptions = [
    ...products.map((p) => ({ value: p.id, label: productShortName(lang, p) })),
    { value: OTHER, label: tt('inquiries.other_product') },
  ];

  return (
    <div className="space-y-5 pb-28 md:pb-0">
      {banner && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-base text-rose-800">
          {banner}
        </p>
      )}

      {/* 1. Buyer */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">{tt('field.inquiry.buyer')}</h2>
        {buyer ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
            <Building2 className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-slate-900">{buyer.company_name}</div>
              <div className="truncate text-base text-slate-600">
                {[buyer.city, buyer.phone ? formatPhoneDisplay(buyer.phone) : null].filter(Boolean).join(' · ')}
              </div>
            </div>
            <Button variant="ghost" onClick={() => setBuyer(null)} disabled={saving}>
              {tt('btn.change')}
            </Button>
          </div>
        ) : newBuyer ? (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <FormField htmlFor="inq-new-name" label={tt('field.inquiry.buyer_name')} error={errors.buyer} hint={tt('inquiries.new_buyer_hint')}>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={200} disabled={saving} />
            </FormField>
            <FormField htmlFor="inq-new-phone" label={tt('field.inquiry.phone')} error={errors.phone}>
              <Input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} maxLength={40} disabled={saving} />
            </FormField>
            {buyers.length > 0 && (
              <Button variant="ghost" onClick={() => setNewBuyer(false)} disabled={saving}>
                {tt('inquiries.change_buyer')}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <FormField htmlFor="inq-buyer-search" label={tt('btn.search')} error={errors.buyer}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  id="inq-buyer-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tt('common.search_placeholder')}
                  autoComplete="off"
                  className="pl-12"
                  disabled={saving}
                />
              </div>
            </FormField>
            {results.length > 0 ? (
              <ListStack>
                {results.map((b) => (
                  <ListCard
                    key={b.id}
                    onClick={() => pickBuyer(b)}
                    title={b.company_name}
                    fact1={[b.city, b.country !== 'India' ? b.country : null].filter(Boolean).join(', ') || undefined}
                    fact2={b.phone ? formatPhoneDisplay(b.phone) : undefined}
                  />
                ))}
              </ListStack>
            ) : (
              <p className="px-1 text-base text-slate-500">{tt('msg.empty.search')}</p>
            )}
            <Button variant="outline" fullWidth onClick={startNewBuyer} disabled={saving}>
              <Plus aria-hidden="true" />
              {tt('btn.new_buyer')}
            </Button>
          </div>
        )}
      </section>

      {/* 2. What do they want */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">{tt('section.what_they_want')}</h2>
        <ChoiceChips
          ariaLabel={tt('field.inquiry.product')}
          value={productId}
          onChange={(v) => {
            setProductId(v);
            setErrors((e) => ({ ...e, product: undefined }));
          }}
          options={productOptions}
          disabled={saving}
        />
        {productId === OTHER && (
          <FormField htmlFor="inq-product-text" label={tt('field.inquiry.product_text')} error={errors.product}>
            <Input value={productText} onChange={(e) => setProductText(e.target.value)} maxLength={200} disabled={saving} />
          </FormField>
        )}
        {productId !== OTHER && errors.product && (
          <p role="alert" className="text-sm text-rose-700">
            {errors.product}
          </p>
        )}
      </section>

      {/* 3. How much */}
      <FormField htmlFor="inq-qty" label={tt('field.inquiry.qty_kg')} error={errors.qty} hint={tt('inquiries.unit_hint')}>
        <NumberInput
          value={qty}
          onChange={(v) => {
            setQty(v);
            setErrors((e) => ({ ...e, qty: undefined }));
          }}
          unit={unit}
          onUnitChange={(u) => setUnit(u as 'kg' | 'MT')}
          units={[
            { value: 'kg', label: tt('unit.kg') },
            { value: 'MT', label: tt('unit.mt') },
          ]}
          disabled={saving}
        />
      </FormField>

      {/* 4. Needed by */}
      <FormField htmlFor="inq-needed" label={tt('field.inquiry.needed_by')} hint={tt('common.optional')}>
        <DateInput value={neededBy} onChange={(e) => setNeededBy(e.target.value)} disabled={saving} />
      </FormField>

      {/* 5. Source */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">{tt('field.inquiry.source')}</h2>
        <ChoiceChips<InquirySource>
          ariaLabel={tt('field.inquiry.source')}
          value={source}
          onChange={setSource}
          options={INQUIRY_SOURCES.map((s) => ({ value: s, label: tt(SOURCE_KEYS[s]) }))}
          disabled={saving}
        />
      </section>

      <MoreFields>
        <FormField htmlFor="inq-notes" label={tt('field.inquiry.notes')}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} disabled={saving} />
        </FormField>
      </MoreFields>

      <StickyBar>
        <Button fullWidth onClick={save} loading={saving} loadingLabel={tt('btn.saving')}>
          {tt('btn.save')}
        </Button>
      </StickyBar>
    </div>
  );
}
