'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Ship, Truck } from 'lucide-react';
import { formatQty, todayISO } from '@/lib/utils';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { DateInput } from '@/components/ui/date-input';
import { Textarea } from '@/components/ui/textarea';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { MoreFields } from '@/components/ui/more-fields';
import { Button } from '@/components/ui/button';
import { StickyBar } from '@/components/ui/sticky-bar';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Toast, useToast } from '@/components/ui/toast';
import { useLang, useT } from '@/components/shell/lang-provider';
import { ORDER_LABELS } from '@/app/(dashboard)/orders/labels';
import { dispatchOrderAction } from '@/app/(dashboard)/orders/actions';

export interface DispatchFormProps {
  orderId: string;
  defaultMode: 'truck' | 'container';
  defaultBags: number;
  bagKg: number;
  /** kg still to send */
  remainingKg: number;
  defaultPort: 'Pipavav' | 'Mundra';
  nextInvoiceNo: string;
  nextSdnNo: string;
  /** Plant: mode, number, bags (+ port); everything else under More */
  short: boolean;
}

type Errors = Partial<Record<'vehicle_no' | 'container_no' | 'port' | 'bags' | 'qty' | 'date', string>>;

const num = (v: string) => Number(v.replace(/,/g, '')) || 0;

/** Dispatch form (screens.md 17): Truck / Container toggle, look-before-you-leap sheet, fn_order_dispatch. */
export function DispatchForm(p: DispatchFormProps) {
  const lang = useLang();
  const tt = useT(ORDER_LABELS);
  const router = useRouter();
  const { toast, show, clear } = useToast();

  const [mode, setMode] = React.useState<'truck' | 'container'>(p.defaultMode);
  const [date, setDate] = React.useState(todayISO());
  const [bags, setBags] = React.useState(String(p.defaultBags || ''));
  const [qty, setQty] = React.useState(String(Math.min(p.defaultBags * p.bagKg, p.remainingKg) || p.remainingKg));
  const [qtyTouched, setQtyTouched] = React.useState(false);
  const [vehicle, setVehicle] = React.useState('');
  const [lr, setLr] = React.useState('');
  const [transporter, setTransporter] = React.useState('');
  const [container, setContainer] = React.useState('');
  const [port, setPort] = React.useState<'Pipavav' | 'Mundra' | null>(p.defaultPort);
  const [vessel, setVessel] = React.useState('');
  const [stuffing, setStuffing] = React.useState('');
  const [eta, setEta] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [errors, setErrors] = React.useState<Errors>({});
  const [confirm, setConfirm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);

  // Qty follows bags x bag size until the user types a qty (the Plant never sees it).
  function onBags(v: string) {
    const clean = v.replace(/[^\d]/g, '');
    setBags(clean);
    if (!qtyTouched) setQty(String(Math.min(num(clean) * p.bagKg, p.remainingKg)));
  }

  function validate(): boolean {
    const e: Errors = {};
    if (mode === 'truck' && !vehicle.trim()) e.vehicle_no = tt('orders.err.vehicle');
    if (mode === 'container' && !container.trim()) e.container_no = tt('orders.err.container');
    if (mode === 'container' && !port) e.port = tt('orders.err.port');
    if (num(bags) <= 0) e.bags = tt('orders.err.bags');
    const q = num(qty);
    if (q <= 0) e.qty = tt('msg.error.number');
    else if (q > p.remainingKg) e.qty = tt('orders.err.qty', { qty: formatQty(p.remainingKg, lang) });
    if (!date) e.date = tt('msg.error.date');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    setSaving(true);
    setBanner(null);
    const result = await dispatchOrderAction({
      order_id: p.orderId,
      mode,
      dispatched_on: date,
      bags: num(bags),
      qty_kg: num(qty),
      vehicle_no: mode === 'truck' ? vehicle.trim().toUpperCase() : null,
      lr_no: lr,
      transporter,
      container_no: mode === 'container' ? container.trim().toUpperCase() : null,
      port: mode === 'container' ? port : null,
      vessel: mode === 'container' ? vessel : null,
      stuffing_date: mode === 'container' && stuffing ? stuffing : null,
      eta: mode === 'container' && eta ? eta : null,
      notes,
    });
    setSaving(false);
    if (!result.ok) {
      setConfirm(false);
      const text = tt(result.messageKey);
      setBanner(text);
      show('error', text);
      return;
    }
    router.push(`/orders/${p.orderId}?msg=dispatched&doc=${encodeURIComponent(result.code ?? '')}`);
    router.refresh();
  }

  const qtyText = formatQty(num(qty), lang);
  const summary = tt(mode === 'truck' ? 'orders.dispatch_confirm_truck' : 'orders.dispatch_confirm_container', {
    bags: num(bags),
    qty: qtyText,
    number: mode === 'truck' ? vehicle.trim().toUpperCase() : container.trim().toUpperCase(),
    invoice_no: p.nextInvoiceNo,
    sdn_no: p.nextSdnNo,
  });

  const modeChips = (
    <FormField htmlFor="dispatch-mode" label={tt('field.dispatch.mode')}>
      <ChoiceChips
        ariaLabel={tt('field.dispatch.mode')}
        value={mode}
        onChange={(v) => setMode(v)}
        grid
        size="lg"
        options={[
          { value: 'truck', label: tt('dispatch_mode.truck'), icon: Truck },
          { value: 'container', label: tt('dispatch_mode.container'), icon: Ship },
        ]}
      />
    </FormField>
  );

  const dateField = (
    <FormField htmlFor="dispatch-date" label={tt('field.dispatch.dispatched_on')} error={errors.date}>
      <DateInput id="dispatch-date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
    </FormField>
  );

  const bagsField = (
    <FormField htmlFor="dispatch-bags" label={tt('field.dispatch.bags_count')} error={errors.bags}>
      <NumberInput id="dispatch-bags" value={bags} onChange={onBags} inputMode="numeric" suffix={tt('unit.bags')} />
    </FormField>
  );

  const qtyField = (
    <FormField htmlFor="dispatch-qty" label={tt('field.dispatch.qty_kg')} error={errors.qty} hint={tt('orders.left_to_send', { qty: formatQty(p.remainingKg, lang) })}>
      <NumberInput
        id="dispatch-qty"
        value={qty}
        onChange={(v) => {
          setQty(v);
          setQtyTouched(true);
        }}
        suffix={tt('unit.kg')}
      />
    </FormField>
  );

  const truckNumber = (
    <FormField htmlFor="dispatch-vehicle" label={tt('field.dispatch.vehicle_no')} error={errors.vehicle_no}>
      <Input id="dispatch-vehicle" value={vehicle} autoCapitalize="characters" onChange={(e) => setVehicle(e.target.value)} placeholder="GJ-04-AX-7712" className="uppercase" />
    </FormField>
  );
  const lrField = (
    <FormField htmlFor="dispatch-lr" label={tt('field.dispatch.lr_no')}>
      <Input id="dispatch-lr" value={lr} onChange={(e) => setLr(e.target.value)} />
    </FormField>
  );
  const transporterField = (
    <FormField htmlFor="dispatch-transporter" label={tt('field.dispatch.transporter')}>
      <Input id="dispatch-transporter" value={transporter} onChange={(e) => setTransporter(e.target.value)} />
    </FormField>
  );
  const containerNumber = (
    <FormField htmlFor="dispatch-container" label={tt('field.dispatch.container_no')} error={errors.container_no}>
      <Input id="dispatch-container" value={container} autoCapitalize="characters" onChange={(e) => setContainer(e.target.value)} placeholder="MSKU 482913-7" className="uppercase" />
    </FormField>
  );
  const portField = (
    <FormField htmlFor="dispatch-port" label={tt('field.dispatch.port')} error={errors.port}>
      <ChoiceChips
        ariaLabel={tt('field.dispatch.port')}
        value={port}
        onChange={(v) => setPort(v)}
        options={[
          { value: 'Pipavav', label: 'Pipavav' },
          { value: 'Mundra', label: 'Mundra' },
        ]}
      />
    </FormField>
  );
  const notesField = (
    <FormField htmlFor="dispatch-notes" label={tt('field.dispatch.notes')}>
      <Textarea id="dispatch-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
    </FormField>
  );
  const containerMore = (
    <>
      <FormField htmlFor="dispatch-vessel" label={tt('field.dispatch.vessel')}>
        <Input id="dispatch-vessel" value={vessel} onChange={(e) => setVessel(e.target.value)} />
      </FormField>
      <FormField htmlFor="dispatch-stuffing" label={tt('field.dispatch.stuffing_date')}>
        <DateInput id="dispatch-stuffing" value={stuffing || date} onChange={(e) => setStuffing(e.target.value)} />
      </FormField>
      <FormField htmlFor="dispatch-eta" label={tt('field.dispatch.eta')}>
        <DateInput id="dispatch-eta" value={eta} min={date} onChange={(e) => setEta(e.target.value)} />
      </FormField>
    </>
  );

  const hiddenHasError = p.short ? !!(errors.qty || errors.date) : false;

  return (
    <form
      className="space-y-4 pb-24 md:pb-0"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (validate()) setConfirm(true);
      }}
    >
      {banner && (
        <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-base text-rose-800">
          {banner}
        </p>
      )}
      {modeChips}
      {p.short ? (
        <>
          {mode === 'truck' ? truckNumber : containerNumber}
          {mode === 'container' && portField}
          {bagsField}
          <MoreFields forceOpen={hiddenHasError}>
            {dateField}
            {qtyField}
            {mode === 'truck' ? (
              <>
                {lrField}
                {transporterField}
              </>
            ) : (
              <>
                {containerMore}
                {transporterField}
                {lrField}
              </>
            )}
            {notesField}
          </MoreFields>
        </>
      ) : (
        <>
          {dateField}
          <div className="grid grid-cols-2 gap-3">
            {bagsField}
            {qtyField}
          </div>
          {mode === 'truck' ? (
            <>
              {truckNumber}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {lrField}
                {transporterField}
              </div>
              <MoreFields>{notesField}</MoreFields>
            </>
          ) : (
            <>
              {containerNumber}
              {portField}
              <MoreFields>
                {containerMore}
                {transporterField}
                {lrField}
                {notesField}
              </MoreFields>
            </>
          )}
        </>
      )}

      <StickyBar>
        <Button type="submit" size="lg" fullWidth>
          {tt('btn.save_make_papers')}
        </Button>
      </StickyBar>

      <ConfirmSheet
        open={confirm}
        title={tt('orders.dispatch_confirm_title')}
        message={summary}
        confirmLabel={tt('orders.looks_right')}
        cancelLabel={tt('btn.change')}
        loading={saving}
        onConfirm={save}
        onClose={() => setConfirm(false)}
      />
      <Toast toast={toast} onClose={clear} />
    </form>
  );
}
