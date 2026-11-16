'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import type { BankDetail, BusinessSettings } from '@/types/database';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { MoreFields } from '@/components/ui/more-fields';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Button } from '@/components/ui/button';
import { Toast, useToast } from '@/components/ui/toast';
import { useT } from '@/components/shell/lang-provider';
import { updateBusinessSettingsAction } from './actions';
import { SETTINGS_MAX } from './limits';

type CompanyFields = {
  company_name: string;
  trade_name: string;
  address: string;
  city: string;
  pincode: string;
  gstin: string;
  contact_phone: string;
  iec_code: string;
  pan: string;
  fssai_no: string;
  authorized_signatory: string;
};
type BankFields = { bank_name: string; account_no: string; ifsc: string; swift: string };

const GSTIN_SHAPE = /^[0-9A-Z]{15}$/;
const IFSC_SHAPE = /^[A-Z0-9]{11}$/;
const MORE_FIELDS = new Set(['iec_code', 'pan', 'fssai_no', 'authorized_signatory', 'usd_bank_name', 'usd_account_no', 'usd_ifsc', 'usd_swift']);

function bankFor(list: BankDetail[] | null | undefined, currency: string): BankDetail | undefined {
  return (Array.isArray(list) ? list : []).find((b) => (b.currency || 'INR').toUpperCase() === currency);
}

function toBankFields(b: BankDetail | undefined): BankFields {
  return { bank_name: b?.bank_name ?? '', account_no: b?.account_no ?? '', ifsc: b?.ifsc ?? '', swift: b?.swift ?? '' };
}

function anyFilled(b: BankFields): boolean {
  return Boolean(b.bank_name || b.account_no || b.ifsc || b.swift);
}

/** Company card, Bank card, More (export), one sticky Save. */
export function SettingsForm({ initialData }: { initialData?: Partial<BusinessSettings> | null }) {
  const tt = useT();
  const router = useRouter();
  const { toast, show, clear } = useToast();

  const [company, setCompany] = React.useState<CompanyFields>({
    company_name: initialData?.company_name ?? '',
    trade_name: initialData?.trade_name ?? '',
    address: initialData?.address ?? '',
    city: initialData?.city ?? '',
    pincode: initialData?.pincode ?? '',
    gstin: initialData?.gstin ?? '',
    contact_phone: initialData?.contact_phone ?? '',
    iec_code: initialData?.iec_code ?? '',
    pan: initialData?.pan ?? '',
    fssai_no: initialData?.fssai_no ?? '',
    authorized_signatory: initialData?.authorized_signatory ?? '',
  });
  const inrInitial = bankFor(initialData?.bank_details, 'INR');
  const usdInitial = bankFor(initialData?.bank_details, 'USD');
  const [inr, setInr] = React.useState<BankFields>(toBankFields(inrInitial));
  const [usd, setUsd] = React.useState<BankFields>(toBankFields(usdInitial));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [forceOpen, setForceOpen] = React.useState(false);

  const setC = (key: keyof CompanyFields, upper = false) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCompany((c) => ({ ...c, [key]: upper ? e.target.value.toUpperCase() : e.target.value }));
  const setBank =
    (which: 'inr' | 'usd', key: keyof BankFields, upper = false) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = upper ? e.target.value.toUpperCase() : e.target.value;
      (which === 'inr' ? setInr : setUsd)((b) => ({ ...b, [key]: value }));
    };

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    const required = tt('msg.error.required');
    if (!company.company_name.trim()) next.company_name = required;
    if (!company.address.trim()) next.address = required;
    if (!company.city.trim()) next.city = required;
    if (company.pincode.trim().length < 6) next.pincode = required;
    if (company.gstin && !GSTIN_SHAPE.test(company.gstin)) next.gstin = tt('msg.error.gstin');
    if (anyFilled(inr)) {
      if (!inr.bank_name.trim()) next.inr_bank_name = required;
      if (inr.account_no.trim().length < 4) next.inr_account_no = required;
      if (!IFSC_SHAPE.test(inr.ifsc)) next.inr_ifsc = tt('msg.error.ifsc');
    }
    if (anyFilled(usd)) {
      if (!usd.bank_name.trim()) next.usd_bank_name = required;
      if (usd.account_no.trim().length < 4) next.usd_account_no = required;
      if (!IFSC_SHAPE.test(usd.ifsc)) next.usd_ifsc = tt('msg.error.ifsc');
    }
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setForceOpen(Object.keys(next).some((k) => MORE_FIELDS.has(k)));
      return;
    }

    const bank_details: BankDetail[] = [];
    if (anyFilled(inr)) {
      bank_details.push({ bank_name: inr.bank_name.trim(), account_no: inr.account_no.trim(), ifsc: inr.ifsc, branch: inrInitial?.branch ?? '', currency: 'INR', is_primary: true });
    }
    if (anyFilled(usd)) {
      bank_details.push({ bank_name: usd.bank_name.trim(), account_no: usd.account_no.trim(), ifsc: usd.ifsc, swift: usd.swift, branch: usdInitial?.branch ?? '', currency: 'USD', is_primary: bank_details.length === 0 });
    }

    setSaving(true);
    const result = await updateBusinessSettingsAction({
      ...company,
      state: initialData?.state || 'Gujarat',
      country: initialData?.country || 'India',
      contact_email: initialData?.contact_email ?? '',
      bank_details,
    });
    setSaving(false);

    if (!result.ok) {
      setBanner(tt(result.messageKey, result.detail ? { floor: result.detail } : undefined));
      return;
    }
    show('success', tt('msg.saved'));
    router.refresh();
  }

  const card = 'space-y-4 rounded-xl border border-slate-200 bg-white p-4';
  const heading = 'text-lg font-semibold text-slate-900';

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <section className={card}>
        <h2 className={heading}>{tt('section.company_card')}</h2>
        <FormField htmlFor="company_name" label={tt('field.company.company_name')} error={errors.company_name}>
          <Input value={company.company_name} onChange={setC('company_name')} maxLength={SETTINGS_MAX.name} autoComplete="organization" />
        </FormField>
        <FormField htmlFor="trade_name" label={tt('field.company.trade_name')}>
          <Input value={company.trade_name} onChange={setC('trade_name')} maxLength={SETTINGS_MAX.name} />
        </FormField>
        <FormField htmlFor="address" label={tt('field.company.address')} error={errors.address}>
          <Input value={company.address} onChange={setC('address')} maxLength={SETTINGS_MAX.address} autoComplete="street-address" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="city" label={tt('field.company.city')} error={errors.city}>
            <Input value={company.city} onChange={setC('city')} maxLength={SETTINGS_MAX.name} />
          </FormField>
          <FormField htmlFor="pincode" label={tt('field.company.pincode')} error={errors.pincode}>
            <Input value={company.pincode} onChange={setC('pincode')} maxLength={SETTINGS_MAX.short} inputMode="numeric" autoComplete="postal-code" />
          </FormField>
        </div>
        <FormField htmlFor="gstin" label={tt('field.company.gstin')} error={errors.gstin}>
          <Input value={company.gstin} onChange={setC('gstin', true)} maxLength={SETTINGS_MAX.short} autoCapitalize="characters" />
        </FormField>
        <FormField htmlFor="contact_phone" label={tt('field.company.phone')}>
          <Input type="tel" value={company.contact_phone} onChange={setC('contact_phone')} maxLength={SETTINGS_MAX.short} />
        </FormField>
      </section>

      <section className={card}>
        <h2 className={heading}>{tt('section.bank_card')}</h2>
        <FormField htmlFor="inr_bank_name" label={tt('field.company.bank_name')} error={errors.inr_bank_name}>
          <Input value={inr.bank_name} onChange={setBank('inr', 'bank_name')} maxLength={SETTINGS_MAX.name} />
        </FormField>
        <FormField htmlFor="inr_account_no" label={tt('field.company.account_no')} error={errors.inr_account_no}>
          <Input value={inr.account_no} onChange={setBank('inr', 'account_no')} maxLength={SETTINGS_MAX.short} inputMode="numeric" />
        </FormField>
        <FormField htmlFor="inr_ifsc" label={tt('field.company.ifsc')} error={errors.inr_ifsc}>
          <Input value={inr.ifsc} onChange={setBank('inr', 'ifsc', true)} maxLength={SETTINGS_MAX.short} autoCapitalize="characters" />
        </FormField>
      </section>

      <section className={card}>
        <MoreFields moreLabel={tt('section.more_export')} lessLabel={tt('btn.less')} forceOpen={forceOpen}>
          <FormField htmlFor="iec_code" label={tt('field.company.iec')}>
            <Input value={company.iec_code} onChange={setC('iec_code', true)} maxLength={SETTINGS_MAX.short} />
          </FormField>
          <FormField htmlFor="pan" label={tt('field.company.pan')}>
            <Input value={company.pan} onChange={setC('pan', true)} maxLength={SETTINGS_MAX.short} />
          </FormField>
          <FormField htmlFor="fssai_no" label={tt('field.company.fssai')}>
            <Input value={company.fssai_no} onChange={setC('fssai_no')} maxLength={SETTINGS_MAX.short} inputMode="numeric" />
          </FormField>
          <FormField htmlFor="authorized_signatory" label={tt('field.company.signatory')}>
            <Input value={company.authorized_signatory} onChange={setC('authorized_signatory')} maxLength={SETTINGS_MAX.name} />
          </FormField>
          <h3 className="pt-2 text-base font-semibold text-slate-900">{tt('section.export_bank')}</h3>
          <FormField htmlFor="usd_bank_name" label={tt('field.company.bank_name')} error={errors.usd_bank_name}>
            <Input value={usd.bank_name} onChange={setBank('usd', 'bank_name')} maxLength={SETTINGS_MAX.name} />
          </FormField>
          <FormField htmlFor="usd_account_no" label={tt('field.company.account_no')} error={errors.usd_account_no}>
            <Input value={usd.account_no} onChange={setBank('usd', 'account_no')} maxLength={SETTINGS_MAX.short} inputMode="numeric" />
          </FormField>
          <FormField htmlFor="usd_ifsc" label={tt('field.company.ifsc')} error={errors.usd_ifsc}>
            <Input value={usd.ifsc} onChange={setBank('usd', 'ifsc', true)} maxLength={SETTINGS_MAX.short} autoCapitalize="characters" />
          </FormField>
          <FormField htmlFor="usd_swift" label={tt('field.company.swift')}>
            <Input value={usd.swift} onChange={setBank('usd', 'swift', true)} maxLength={SETTINGS_MAX.short} autoCapitalize="characters" />
          </FormField>
        </MoreFields>
      </section>

      {banner && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-base text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{banner}</span>
        </div>
      )}

      <StickyBar>
        <Button type="submit" fullWidth loading={saving} loadingLabel={tt('btn.saving')} className="md:w-auto">
          {tt('btn.save')}
        </Button>
      </StickyBar>

      <Toast toast={toast} onClose={clear} />
    </form>
  );
}
