'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { NumberInput } from '@/components/ui/number-input';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { MoreFields } from '@/components/ui/more-fields';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Button, buttonVariants } from '@/components/ui/button';
import { useT } from '@/components/shell/lang-provider';
import { COURIERS, GRAM_CHOICES, SAMPLE_LABELS } from '@/app/(dashboard)/samples/labels';
import { createSampleAction } from '@/app/(dashboard)/samples/actions';

export interface SampleFormInquiry {
  id: string;
  code: string;
  buyer_id: string;
  buyer_name: string;
  product_id: string | null;
}

export interface SampleFormProps {
  inquiry: SampleFormInquiry | null;
  buyers: { id: string; company_name: string }[];
  products: { id: string; name: string }[];
}

const OTHER = '__other__';
const BY_HAND = 'by_hand';

/** Send sample (screens.md 10): For / Buyer, Product, How much, Courier, Tracking, More (note, lot no). */
export function SampleForm({ inquiry, buyers, products }: SampleFormProps) {
  const tt = useT(SAMPLE_LABELS);
  const router = useRouter();

  const [buyerId, setBuyerId] = React.useState(inquiry?.buyer_id ?? '');
  const [productId, setProductId] = React.useState(inquiry?.product_id ?? '');
  const [gramChoice, setGramChoice] = React.useState<string>('500');
  const [gramOther, setGramOther] = React.useState('');
  const [courier, setCourier] = React.useState<string>('');
  const [courierOther, setCourierOther] = React.useState('');
  const [tracking, setTracking] = React.useState('');
  const [note, setNote] = React.useState('');
  const [lotNo, setLotNo] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const grams = gramChoice === OTHER ? Math.round(Number(gramOther.replace(/,/g, '')) || 0) : Number(gramChoice);
  const courierText = courier === OTHER ? courierOther.trim() : courier === BY_HAND ? tt('samples.courier_by_hand') : courier;
  const willMarkSent = Boolean(courierText);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!inquiry && !buyerId) next.buyer = tt('samples.pick_buyer');
    if (!productId) next.product = tt('samples.pick_product');
    if (!grams || grams <= 0) next.grams = tt('samples.pick_grams');
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const result = await createSampleAction({
      inquiry_id: inquiry?.id ?? null,
      buyer_id: inquiry?.buyer_id ?? buyerId,
      product_id: productId,
      qty_grams: grams,
      courier: courierText || null,
      tracking_no: tracking.trim() || null,
      lot_no: lotNo.trim() || null,
      note: note.trim() || null,
      mark_sent: willMarkSent,
    });
    setSaving(false);
    if (!result.ok) {
      setBanner(tt(result.messageKey, result.detail ? { floor: result.detail } : undefined));
      return;
    }
    const code = result.code ?? '';
    router.push(inquiry ? `/inquiries/${inquiry.id}` : `/samples?saved=${encodeURIComponent(code)}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 pb-28 md:pb-0">
      {inquiry ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-700">{tt('field.sample.inquiry')}</p>
          <p className="text-base text-slate-900">
            {inquiry.code} · {inquiry.buyer_name}
          </p>
        </div>
      ) : (
        <FormField htmlFor="buyer" label={tt('field.sample.buyer')} error={errors.buyer}>
          <Select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
            <option value="">{tt('common.not_set')}</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.company_name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <FormField htmlFor="product" label={tt('field.sample.product')} error={errors.product}>
        <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">{tt('common.not_set')}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>

      <div>
        <p className="mb-1.5 block text-sm font-semibold text-slate-700">{tt('samples.how_much')}</p>
        <ChoiceChips
          ariaLabel={tt('field.sample.qty_grams')}
          value={gramChoice}
          onChange={setGramChoice}
          options={[
            ...GRAM_CHOICES.map((g) => ({ value: String(g), label: g >= 1000 ? `${g / 1000} ${tt('unit.kg')}` : `${g} ${tt('unit.g')}` })),
            { value: OTHER, label: tt('samples.grams_other') },
          ]}
        />
        {gramChoice === OTHER && (
          <div className="mt-2">
            <NumberInput aria-label={tt('field.sample.qty_grams')} value={gramOther} onChange={setGramOther} suffix={tt('unit.g')} />
          </div>
        )}
        {errors.grams && (
          <p role="alert" className="mt-1 flex items-center gap-1 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {errors.grams}
          </p>
        )}
      </div>

      <div>
        <p className="mb-1.5 block text-sm font-semibold text-slate-700">{tt('field.sample.courier')}</p>
        <ChoiceChips
          ariaLabel={tt('field.sample.courier')}
          value={courier || null}
          onChange={(v) => setCourier(v === courier ? '' : v)}
          options={[
            ...COURIERS.map((c) => ({ value: c, label: c })),
            { value: BY_HAND, label: tt('samples.courier_by_hand') },
            { value: OTHER, label: tt('samples.courier_other') },
          ]}
        />
        {courier === OTHER && (
          <div className="mt-2">
            <Input aria-label={tt('field.sample.courier')} value={courierOther} onChange={(e) => setCourierOther(e.target.value)} />
          </div>
        )}
      </div>

      <FormField htmlFor="tracking" label={tt('field.sample.tracking_no')}>
        <Input value={tracking} onChange={(e) => setTracking(e.target.value)} autoComplete="off" />
      </FormField>

      <MoreFields>
        <FormField htmlFor="note" label={tt('samples.note')} hint={tt('common.optional')}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <FormField htmlFor="lot" label={tt('field.sample.lot_no')} hint={tt('common.optional')}>
          <Input value={lotNo} onChange={(e) => setLotNo(e.target.value)} autoComplete="off" />
        </FormField>
      </MoreFields>

      {banner && (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-base text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          {banner}
        </p>
      )}

      <StickyBar>
        <Link href={inquiry ? `/inquiries/${inquiry.id}` : '/samples'} className={buttonVariants({ variant: 'outline', className: 'hidden md:inline-flex' })}>
          {tt('btn.cancel')}
        </Link>
        <Button type="submit" fullWidth loading={saving} loadingLabel={tt('btn.saving')} className="md:w-auto">
          {willMarkSent ? tt('btn.save_mark_sent') : tt('btn.save')}
        </Button>
      </StickyBar>
    </form>
  );
}
