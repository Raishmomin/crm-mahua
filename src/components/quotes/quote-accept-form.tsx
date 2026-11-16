'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import type { QuoteDetail } from '@/types/quotes';
import { formatBags, formatMoney, formatQty } from '@/lib/utils';
import { FormField } from '@/components/ui/form-field';
import { DateInput } from '@/components/ui/date-input';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Button, buttonVariants } from '@/components/ui/button';
import { useLang, useT } from '@/components/shell/lang-provider';
import { ADVANCE_PCT_CHOICES, QUOTE_LABELS } from '@/app/(dashboard)/quotes/labels';
import { bagsFor } from '@/app/(dashboard)/quotes/helpers';
import { acceptQuoteAction } from '@/app/(dashboard)/quotes/actions';

export interface QuoteAcceptFormProps {
  quote: QuoteDetail;
  defaultShipBy: string;
  defaultAdvancePct: number;
  /** capacity of the first item's packaging (25 when unknown) */
  bagKg: number;
}

/** "Look before you leap" (screens.md 12 sheet / components.md 17 ConfirmPage): Ship by + advance %, then fn_quote_accept. */
export function QuoteAcceptForm({ quote, defaultShipBy, defaultAdvancePct, bagKg }: QuoteAcceptFormProps) {
  const lang = useLang();
  const tt = useT(QUOTE_LABELS);
  const router = useRouter();
  const [shipBy, setShipBy] = React.useState(defaultShipBy);
  const [advancePct, setAdvancePct] = React.useState<number>(defaultAdvancePct);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const qtyKg = quote.items.reduce((s, it) => s + it.qty_kg, 0);
  const advance = Math.round(quote.total * advancePct) / 100;
  const first = quote.items[0];

  async function submit() {
    setError(null);
    if (!shipBy) {
      setError(tt('msg.error.date'));
      return;
    }
    setSaving(true);
    const result = await acceptQuoteAction({ id: quote.id, ship_by: shipBy, advance_pct: advancePct });
    setSaving(false);
    if (!result.ok) {
      setError(tt(result.messageKey, result.detail ? { floor: result.detail } : undefined));
      return;
    }
    router.push(`/orders/${result.id}?from_quote=${quote.id}`);
  }

  return (
    <div className="space-y-4 pb-28 md:pb-0">
      <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-2xl font-bold text-slate-900">{quote.buyer.company_name}</p>
        {quote.items.map((it) => (
          <p key={it.id} className="text-xl text-slate-800">
            {it.product_name}
          </p>
        ))}
        <p className="text-xl text-slate-800">
          {formatQty(qtyKg, lang)} = {formatBags(quote.items.reduce((s, it) => s + bagsFor(it.qty_kg, bagKg), 0), bagKg, lang)}
        </p>
        <p className="text-2xl font-bold tabular-nums text-slate-900">
          {tt('common.total')} {formatMoney(quote.total, quote.currency)}
        </p>
        <p className="text-xl text-slate-800">
          {advancePct > 0 ? tt('quotes.advance_due', { amount: formatMoney(advance, quote.currency) }) : `${tt('quotes.no_advance')} (${quote.payment_terms})`}
        </p>
        {first && <p className="text-base text-slate-500">{quote.quote_no} · {tt(`incoterm.${quote.incoterm.replace(' ', '_')}`)} · {quote.payment_terms}</p>}
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700">{tt('field.order.advance_pct')}</p>
        <ChoiceChips
          ariaLabel={tt('field.order.advance_pct')}
          value={String(advancePct)}
          onChange={(v) => setAdvancePct(Number(v))}
          options={ADVANCE_PCT_CHOICES.map((n) => ({ value: String(n), label: `${n}%` }))}
        />
      </div>

      <FormField htmlFor="ship-by" label={tt('field.order.expected_dispatch')}>
        <DateInput value={shipBy} onChange={(e) => setShipBy(e.target.value)} />
      </FormField>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-base text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <StickyBar>
        <Link href={`/quotes/${quote.id}`} className={buttonVariants({ variant: 'outline', className: 'hidden md:inline-flex' })}>
          {tt('btn.change')}
        </Link>
        <Button size="lg" fullWidth onClick={submit} loading={saving} loadingLabel={tt('btn.saving')} className="md:w-auto">
          {tt('btn.looks_right')}
        </Button>
      </StickyBar>
    </div>
  );
}
