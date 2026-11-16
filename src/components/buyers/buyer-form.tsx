'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { isValidPhone } from '@/lib/phone';
import type { Buyer, BuyerContact, BuyerIncoterm, BuyerType } from '@/types/buyers';
import { BUYER_INCOTERMS, BUYER_TYPES, isExportType } from '@/types/buyers';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { NumberInput } from '@/components/ui/number-input';
import { MoreFields } from '@/components/ui/more-fields';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/shell/lang-provider';
import { createBuyerAction, updateBuyerAction } from '@/app/(dashboard)/buyers/actions';
import { BUYER_LABELS } from '@/app/(dashboard)/buyers/labels';
import { safeInternalPath, whereFromPhone } from './helpers';

export interface BuyerFormProps {
  /** edit mode */
  initial?: { buyer: Buyer; contact: BuyerContact | null } | null;
  /** /buyers/new?from_inquiry=<id>: prefilled name + phone; the inquiry gets buyer_id after save */
  fromInquiry?: { id: string; buyer_name: string; phone: string | null } | null;
  /** where to go after save (relative path); default = the buyer page */
  next?: string | null;
}

type Where = 'india' | 'export';
type Errors = Partial<Record<'company_name' | 'phone' | 'gstin' | 'country', string>>;

const GSTIN_SHAPE = /^[0-9A-Z]{15}$/;

/** New / edit buyer (screens.md 8): 5 fields, India / Export toggle, the rest under More. */
export function BuyerForm({ initial, fromInquiry, next }: BuyerFormProps) {
  const tt = useT(BUYER_LABELS);
  const router = useRouter();
  const isEdit = Boolean(initial);
  const b = initial?.buyer;
  const c = initial?.contact;
  // From an inquiry: a +971 / +49 ... number starts as Export with its country filled (G2-04)
  const fromPhone = !b && fromInquiry ? whereFromPhone(fromInquiry.phone) : null;

  const [companyName, setCompanyName] = React.useState(b?.company_name ?? fromInquiry?.buyer_name ?? '');
  const [phone, setPhone] = React.useState(c?.phone ?? fromInquiry?.phone ?? '+91 ');
  const [city, setCity] = React.useState(b?.city ?? '');
  const [where, setWhere] = React.useState<Where>(b ? (isExportType(b.buyer_type) ? 'export' : 'india') : fromPhone?.isExport ? 'export' : 'india');
  const [gstin, setGstin] = React.useState(b?.gstin ?? '');
  const [country, setCountry] = React.useState(b && isExportType(b.buyer_type) ? b.country : fromPhone?.isExport ? fromPhone.country : '');
  const [contactName, setContactName] = React.useState(c?.name && c.name !== b?.company_name ? c.name : '');
  const [designation, setDesignation] = React.useState(c?.designation ?? '');
  const [email, setEmail] = React.useState(c?.email ?? '');
  const [buyerType, setBuyerType] = React.useState<BuyerType | null>(b?.buyer_type ?? null);
  const [address, setAddress] = React.useState(b?.address ?? '');
  const [state, setState] = React.useState(b?.state ?? '');
  const [paymentTerms, setPaymentTerms] = React.useState(b?.payment_terms ?? '');
  const [creditDays, setCreditDays] = React.useState(b ? String(b.credit_period_days) : '');
  const [incoterm, setIncoterm] = React.useState<BuyerIncoterm | null>(b?.incoterm ?? null);
  const [currency, setCurrency] = React.useState<string | null>(b?.preferred_currency ?? null);
  const [pan, setPan] = React.useState(b?.pan ?? '');
  const [active, setActive] = React.useState<'active' | 'inactive'>(b?.status === 'inactive' ? 'inactive' : 'active');
  const [errors, setErrors] = React.useState<Errors>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  function pickWhere(w: Where) {
    setWhere(w);
    setErrors((e) => ({ ...e, gstin: undefined, country: undefined }));
    // the toggle resets the "from toggle" defaults; explicit More values are kept only in edit mode
    if (!isEdit) {
      setBuyerType(null);
      setIncoterm(null);
      setCurrency(null);
      setCreditDays('');
      setPaymentTerms('');
    }
    if (w === 'india' && phone.trim() === '') setPhone('+91 ');
  }

  async function save() {
    const nextErrors: Errors = {};
    if (!companyName.trim()) nextErrors.company_name = tt('buyers.type_name');
    if (!isValidPhone(phone)) nextErrors.phone = tt('msg.error.phone');
    if (where === 'india' && gstin.trim() && !GSTIN_SHAPE.test(gstin.trim().toUpperCase())) nextErrors.gstin = tt('msg.error.gstin');
    if (where === 'export' && !country.trim()) nextErrors.country = tt('msg.error.required');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const credit = creditDays.trim() === '' ? null : Number(creditDays.replace(/,/g, ''));
    const payload = {
      company_name: companyName.trim(),
      phone: phone.trim(),
      contact_name: contactName.trim() || null,
      designation: designation.trim() || null,
      email: email.trim() || null,
      city: city.trim() || null,
      is_export: where === 'export',
      country: where === 'export' ? country.trim() : null,
      gstin: where === 'india' ? gstin.trim().toUpperCase() || null : null,
      pan: pan.trim().toUpperCase() || null,
      buyer_type: buyerType,
      address: address.trim() || null,
      state: state.trim() || null,
      payment_terms: paymentTerms.trim() || null,
      credit_period_days: credit !== null && Number.isFinite(credit) ? Math.round(credit) : null,
      incoterm,
      preferred_currency: currency,
    };

    setSaving(true);
    setBanner(null);
    const result = isEdit
      ? await updateBuyerAction({ ...payload, id: b!.id, status: active })
      : await createBuyerAction({ ...payload, from_inquiry: fromInquiry?.id ?? null });
    setSaving(false);

    if (!result.ok) {
      setBanner(tt(result.messageKey, result.detail ? { floor: result.detail } : undefined));
      return;
    }
    const id = result.id ?? b?.id ?? '';
    // SEC2-04: checked again here, after {id} is filled in, right before router.push
    const target =
      safeInternalPath(next ? next.replace(/\{id\}|%7Bid%7D/gi, id) : null) ?? (fromInquiry ? `/inquiries/${fromInquiry.id}` : `/buyers/${id}`);
    router.push(target);
    router.refresh();
  }

  const typeOptions = BUYER_TYPES.filter((ty) => (where === 'export' ? isExportType(ty) : !isExportType(ty))).map((ty) => ({
    value: ty,
    label: tt(`buyer_type.${ty}`),
  }));

  return (
    <div className="space-y-5 pb-28 md:pb-0">
      {banner && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-base text-rose-800">
          {banner}
        </p>
      )}

      <FormField htmlFor="buyer-name" label={tt('field.buyer.company_name')} error={errors.company_name}>
        <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} maxLength={200} disabled={saving} />
      </FormField>

      <FormField htmlFor="buyer-phone" label={tt('field.buyer.phone')} error={errors.phone}>
        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} disabled={saving} />
      </FormField>

      <FormField htmlFor="buyer-city" label={tt('field.buyer.city')} hint={tt('common.optional')}>
        <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} disabled={saving} />
      </FormField>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">{tt('field.buyer.is_export')}</h2>
        <ChoiceChips<Where>
          grid
          ariaLabel={tt('field.buyer.is_export')}
          value={where}
          onChange={pickWhere}
          disabled={saving}
          options={[
            { value: 'india', label: tt('field.buyer.india') },
            { value: 'export', label: tt('field.buyer.export') },
          ]}
        />
      </section>

      {where === 'india' ? (
        <FormField htmlFor="buyer-gstin" label={tt('field.buyer.gstin')} hint={tt('common.optional')} error={errors.gstin}>
          <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} autoCapitalize="characters" disabled={saving} />
        </FormField>
      ) : (
        <FormField htmlFor="buyer-country" label={tt('field.buyer.country')} hint={tt('buyers.country_hint')} error={errors.country}>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={120} disabled={saving} />
        </FormField>
      )}

      <MoreFields>
        <FormField htmlFor="buyer-contact" label={tt('field.buyer.contact_name')}>
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={120} disabled={saving} />
        </FormField>
        <FormField htmlFor="buyer-designation" label={tt('buyers.designation')}>
          <Input value={designation} onChange={(e) => setDesignation(e.target.value)} maxLength={120} disabled={saving} />
        </FormField>
        <FormField htmlFor="buyer-email" label={tt('field.buyer.email')}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} disabled={saving} />
        </FormField>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">{tt('field.buyer.buyer_type')}</h3>
          <ChoiceChips<BuyerType> ariaLabel={tt('field.buyer.buyer_type')} value={buyerType} onChange={setBuyerType} options={typeOptions} disabled={saving} />
        </section>
        <FormField htmlFor="buyer-address" label={tt('field.buyer.address')}>
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} disabled={saving} />
        </FormField>
        <FormField htmlFor="buyer-state" label={tt('field.buyer.state')}>
          <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={120} disabled={saving} />
        </FormField>
        <FormField htmlFor="buyer-terms" label={tt('field.buyer.payment_terms')}>
          <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} maxLength={200} disabled={saving} />
        </FormField>
        <FormField htmlFor="buyer-credit" label={tt('field.buyer.credit_days')}>
          <NumberInput value={creditDays} onChange={setCreditDays} suffix={tt('unit.days')} disabled={saving} />
        </FormField>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">{tt('field.buyer.incoterm')}</h3>
          <ChoiceChips<BuyerIncoterm>
            ariaLabel={tt('field.buyer.incoterm')}
            value={incoterm}
            onChange={setIncoterm}
            options={BUYER_INCOTERMS.map((i) => ({ value: i, label: tt(`incoterm.${i}`) }))}
            disabled={saving}
          />
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">{tt('field.buyer.currency')}</h3>
          <ChoiceChips
            ariaLabel={tt('field.buyer.currency')}
            value={currency}
            onChange={setCurrency}
            options={[
              { value: 'INR', label: '₹ INR' },
              { value: 'USD', label: '$ USD' },
            ]}
            disabled={saving}
          />
        </section>
        <FormField htmlFor="buyer-pan" label={tt('field.buyer.pan')}>
          <Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={20} autoCapitalize="characters" disabled={saving} />
        </FormField>
        {isEdit && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">{tt('buyers.active')}</h3>
            <ChoiceChips<'active' | 'inactive'>
              ariaLabel={tt('buyers.active')}
              value={active}
              onChange={setActive}
              options={[
                { value: 'active', label: tt('buyers.on') },
                { value: 'inactive', label: tt('buyers.off') },
              ]}
              disabled={saving}
            />
          </section>
        )}
      </MoreFields>

      <StickyBar>
        <Button fullWidth onClick={save} loading={saving} loadingLabel={tt('btn.saving')}>
          {tt('btn.save')}
        </Button>
      </StickyBar>
    </div>
  );
}
