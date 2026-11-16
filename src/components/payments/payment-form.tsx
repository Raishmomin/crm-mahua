'use client';

import * as React from 'react';
import Link from 'next/link';
import { Banknote, CheckCircle2, CreditCard, FileCheck2, Landmark, MessageCircle, ReceiptText, Search, Smartphone } from 'lucide-react';
import { cn, formatMoney, todayISO } from '@/lib/utils';
import { whatsappHref } from '@/lib/phone';
import type { PayMode, PaymentOrderOption } from '@/types/payments';
import { PAY_MODES } from '@/types/payments';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { DateInput } from '@/components/ui/date-input';
import { Textarea } from '@/components/ui/textarea';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { MoreFields } from '@/components/ui/more-fields';
import { ListCard, ListStack } from '@/components/ui/list-card';
import { Status } from '@/components/ui/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { StickyBar } from '@/components/ui/sticky-bar';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { EmptyState } from '@/components/ui/state-views';
import { Toast, useToast } from '@/components/ui/toast';
import { useLang, useT } from '@/components/shell/lang-provider';
import { PAYMENT_LABELS } from '@/app/(dashboard)/payments/labels';
import { recordPaymentAction } from '@/app/(dashboard)/payments/actions';
import { prefillAmount, receiptText, waLang } from '@/app/(dashboard)/orders/helpers';

export interface PaymentFormProps {
  options: PaymentOrderOption[];
  initialOrderId: string | null;
  /** ₹ per 1 unit (INR = 1) */
  rates: Record<string, number>;
  company: string;
  /** where Done goes: the order (opened from it) or the Money list */
  backTo: 'order' | 'list';
}

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
const MODE_ICONS = { cash: Banknote, bank: Landmark, upi: Smartphone, cheque: FileCheck2, lc: CreditCard } as const;
const num = (v: string) => Number(String(v).replace(/,/g, '')) || 0;
const plain = (n: number) => (Number.isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : '');

type Errors = Partial<Record<'order' | 'amount' | 'inr' | 'mode' | 'date', string>>;
interface Success {
  paymentId: string | null;
  receiptNo: string;
  amount: number;
  currency: string;
  dueAfter: number;
  option: PaymentOrderOption;
}

/** Money received (screens.md 22): order picker, amount (+ rupee value and rate for USD), date, mode chips. */
export function PaymentForm({ options, initialOrderId, rates, company, backTo }: PaymentFormProps) {
  const lang = useLang();
  const tt = useT(PAYMENT_LABELS);
  const { toast, show, clear } = useToast();

  const initial = options.find((o) => o.order_id === initialOrderId) ?? null;
  // G2-10: while the advance is waiting, prefill the rest of the advance, not the whole due.
  const initialAmount = initial ? prefillAmount(initial).amount : 0;
  const [selected, setSelected] = React.useState<PaymentOrderOption | null>(initial);
  const [picking, setPicking] = React.useState(!initial);
  const [q, setQ] = React.useState('');
  const [amount, setAmount] = React.useState(initial ? plain(initialAmount) : '');
  const [rate, setRate] = React.useState(initial ? plain(rateFor(initial)) : '');
  const [inr, setInr] = React.useState(initial && initial.currency !== 'INR' ? plain(initialAmount * rateFor(initial)) : '');
  const [date, setDate] = React.useState(todayISO());
  const [mode, setMode] = React.useState<PayMode | null>('bank');
  const [reference, setReference] = React.useState('');
  const [note, setNote] = React.useState('');
  const [errors, setErrors] = React.useState<Errors>({});
  const [overOpen, setOverOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<Success | null>(null);

  function rateFor(o: PaymentOrderOption): number {
    return rates[o.currency] ?? o.fx_rate ?? 0;
  }

  function pick(o: PaymentOrderOption) {
    setSelected(o);
    setPicking(false);
    const pre = prefillAmount(o).amount;
    setAmount(plain(pre));
    const r = rateFor(o);
    setRate(plain(r));
    setInr(o.currency !== 'INR' ? plain(pre * r) : '');
    setErrors({});
  }

  const foreign = !!selected && selected.currency !== 'INR';
  const advanceHint = selected && prefillAmount(selected).advance ? tt('payments.full_due_hint', { due: formatMoney(selected.due, selected.currency) }) : undefined;

  function onAmount(v: string) {
    setAmount(v);
    if (foreign && num(rate) > 0) setInr(plain(num(v) * num(rate)));
  }
  function onRate(v: string) {
    setRate(v);
    if (foreign) setInr(plain(num(amount) * num(v)));
  }

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.buyer_name.toLowerCase().includes(term) || o.order_code.toLowerCase().includes(term));
  }, [options, q]);

  function validate(): boolean {
    const e: Errors = {};
    if (!selected) e.order = tt('payments.pick_order');
    if (num(amount) <= 0) e.amount = tt('payments.type_amount');
    if (foreign && num(inr) <= 0) e.inr = tt('payments.type_inr');
    if (!mode) e.mode = tt('msg.error.required');
    if (!date) e.date = tt('msg.error.date');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate() || !selected) return;
    if (selected.due > 0 && num(amount) > selected.due) {
      setOverOpen(true);
      return;
    }
    void save();
  }

  async function save() {
    if (!selected || !mode) return;
    setSaving(true);
    setBanner(null);
    const result = await recordPaymentAction({
      order_id: selected.order_id,
      amount: num(amount),
      received_on: date,
      mode,
      reference,
      amount_inr: foreign ? num(inr) : null,
      fx_rate: foreign && num(rate) > 0 ? num(rate) : null,
      note,
    });
    setSaving(false);
    setOverOpen(false);
    if (!result.ok) {
      const text = tt(result.messageKey, { due: formatMoney(selected.due, selected.currency) });
      setBanner(text);
      show('error', text);
      return;
    }
    const receiptNo = result.code ?? '';
    const paid = num(amount);
    setSuccess({ paymentId: result.id ?? null, receiptNo, amount: paid, currency: selected.currency, dueAfter: Math.max(0, selected.due - paid), option: selected });
    show('success', tt('msg.payment_saved', { amount: formatMoney(paid, selected.currency), receipt_no: receiptNo }));
  }

  if (success) {
    const o = success.option;
    const share = whatsappHref(
      o.phone,
      receiptText(waLang(lang, o.is_export), {
        buyer: o.buyer_name,
        amount: success.amount,
        currency: success.currency,
        orderCode: o.order_code,
        receiptNo: success.receiptNo,
        due: success.dueAfter,
        company,
      })
    );
    return (
      <div className="space-y-4 pb-24 md:pb-0">
        <section className="flex flex-col items-center gap-2 rounded-xl border border-emerald-300 bg-white p-6 text-center">
          <CheckCircle2 className="h-16 w-16 text-emerald-700" aria-hidden="true" />
          <p className="text-2xl font-bold text-slate-900">{tt('payments.received_big', { amount: formatMoney(success.amount, success.currency) })}</p>
          <p className="text-xl font-semibold tabular-nums text-slate-800">{success.receiptNo}</p>
          <p className="text-base text-slate-600">
            {o.buyer_name} · {o.order_code}
          </p>
          <p className="flex items-center gap-2 text-base text-slate-800">
            {tt('payments.now_due', { amount: formatMoney(success.dueAfter, success.currency) })}
            <Status domain="money" code={success.dueAfter > 0 ? 'due' : 'paid'} />
          </p>
        </section>
        <a
          href={share ?? undefined}
          target={share ? '_blank' : undefined}
          rel={share ? 'noopener noreferrer' : undefined}
          aria-disabled={!share || undefined}
          className={cn(buttonVariants({ variant: 'whatsapp', fullWidth: true }), !share && 'bg-slate-300 text-slate-500')}
        >
          <MessageCircle aria-hidden="true" />
          {tt('btn.share_receipt_whatsapp')}
        </a>
        {success.paymentId && (
          <Link href={`/payments/${success.paymentId}`} className={buttonVariants({ variant: 'outline', fullWidth: true })}>
            <ReceiptText aria-hidden="true" />
            {tt('payments.see_receipt')}
          </Link>
        )}
        <StickyBar>
          <Link href={backTo === 'order' ? `/orders/${o.order_id}` : '/payments'} className={buttonVariants({ size: 'lg', fullWidth: true })}>
            {tt('btn.done')}
          </Link>
        </StickyBar>
        <Toast toast={toast} onClose={clear} />
      </div>
    );
  }

  return (
    <form
      className="space-y-4 pb-24 md:pb-0"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {banner && (
        <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-base text-rose-800">
          {banner}
        </p>
      )}

      <FormField htmlFor="pay-order" label={tt('field.payment.order')} error={errors.order}>
        {selected && !picking ? (
          <div id="pay-order" className="flex items-center gap-3 rounded-lg border border-slate-300 bg-white p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-slate-900">{selected.buyer_name}</p>
              <p className="truncate text-base text-slate-700">
                {selected.due > 0
                  ? tt('payments.order_due', { code: selected.order_code, due: formatMoney(selected.due, selected.currency) })
                  : tt('payments.order_paid', { code: selected.order_code })}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
              {tt('btn.change')}
            </Button>
          </div>
        ) : (
          <div id="pay-order" className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                type="search"
                autoComplete="off"
                aria-label={tt('payments.search_order')}
                placeholder={tt('payments.search_order')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-12"
              />
            </div>
            {filtered.length === 0 ? (
              <EmptyState message={options.length === 0 ? tt('payments.no_orders') : 'msg.empty.search'} className="p-6" />
            ) : (
              <ListStack className="max-h-[360px] overflow-y-auto">
                {filtered.map((o) => (
                  <ListCard
                    key={o.order_id}
                    onClick={() => pick(o)}
                    title={o.buyer_name}
                    fact1={
                      o.due > 0
                        ? tt('payments.order_due', { code: o.order_code, due: formatMoney(o.due, o.currency) })
                        : tt('payments.order_paid', { code: o.order_code })
                    }
                    trailing="none"
                  />
                ))}
              </ListStack>
            )}
          </div>
        )}
      </FormField>

      {selected && (
        <>
          <FormField htmlFor="pay-amount" label={tt('field.payment.amount')} hint={advanceHint} error={errors.amount}>
            <NumberInput
              id="pay-amount"
              value={amount}
              onChange={onAmount}
              prefix={SYMBOLS[selected.currency]}
              suffix={SYMBOLS[selected.currency] ? undefined : selected.currency}
            />
          </FormField>

          {foreign && (
            <div className="grid grid-cols-2 gap-3">
              <FormField htmlFor="pay-inr" label={tt('field.payment.amount_inr')} error={errors.inr}>
                <NumberInput id="pay-inr" value={inr} onChange={setInr} prefix="₹" />
              </FormField>
              <FormField htmlFor="pay-rate" label={tt('field.payment.fx_rate')}>
                <NumberInput id="pay-rate" value={rate} onChange={onRate} prefix="₹" />
              </FormField>
            </div>
          )}

          <FormField htmlFor="pay-date" label={tt('field.payment.received_on')} error={errors.date}>
            <DateInput id="pay-date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </FormField>

          <FormField htmlFor="pay-mode" label={tt('field.payment.mode')} error={errors.mode}>
            <ChoiceChips
              ariaLabel={tt('field.payment.mode')}
              value={mode}
              onChange={(v) => setMode(v)}
              options={PAY_MODES.map((m) => ({ value: m, label: tt(`pay_mode.${m}`), icon: MODE_ICONS[m] }))}
            />
          </FormField>

          <MoreFields moreLabel={tt('payments.more_ref')}>
            <FormField htmlFor="pay-ref" label={tt('field.payment.reference')}>
              <Input id="pay-ref" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
            </FormField>
            <FormField htmlFor="pay-note" label={tt('field.payment.note')}>
              <Textarea id="pay-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </FormField>
          </MoreFields>
        </>
      )}

      <StickyBar>
        <Button type="submit" size="lg" fullWidth loading={saving} loadingLabel={tt('btn.saving')}>
          {tt('btn.save')}
        </Button>
      </StickyBar>

      <ConfirmSheet
        open={overOpen}
        title={tt('payments.over_title')}
        message={selected ? tt('msg.over_payment', { due: formatMoney(selected.due, selected.currency) }) : ''}
        confirmLabel={tt('btn.save')}
        cancelLabel={tt('btn.change')}
        loading={saving}
        onConfirm={() => void save()}
        onClose={() => setOverOpen(false)}
      />
      <Toast toast={toast} onClose={clear} />
    </form>
  );
}
