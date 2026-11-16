'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2, Factory, PackageCheck, Truck } from 'lucide-react';
import { todayISO } from '@/lib/utils';
import type { OrderStatus } from '@/types/orders';
import { Button, buttonVariants } from '@/components/ui/button';
import { StickyBar } from '@/components/ui/sticky-bar';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { DateInput } from '@/components/ui/date-input';
import { FormField } from '@/components/ui/form-field';
import { MoreFields } from '@/components/ui/more-fields';
import { Toast, useToast } from '@/components/ui/toast';
import { useT } from '@/components/shell/lang-provider';
import { ORDER_LABELS } from '@/app/(dashboard)/orders/labels';
import { deliveredAction, setOrderStatusAction, setPackedAction, type ActionResult } from '@/app/(dashboard)/orders/actions';
import { BagsSheet } from './bags-sheet';

export interface OrderActionsProps {
  orderId: string;
  orderCode: string;
  status: OrderStatus;
  /** received < advance_expected (soft guard: office roles may start anyway) */
  advanceWaiting: boolean;
  plannedBags: number;
  latestDispatchId: string | null;
  /** owner, before dispatch */
  canCancel: boolean;
}

/** Order detail (screens.md 16A): one big Next step button + Cancel order under More. */
export function OrderActions({ orderId, orderCode, status, advanceWaiting, plannedBags, latestDispatchId, canCancel }: OrderActionsProps) {
  const tt = useT(ORDER_LABELS);
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [sheet, setSheet] = React.useState<null | 'advance' | 'bags' | 'delivered' | 'cancel'>(null);
  const [deliveredOn, setDeliveredOn] = React.useState(todayISO());

  async function run(action: () => Promise<ActionResult>, successKey: string, vars?: Record<string, string | number>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      show('error', tt(result.messageKey, { floor: result.detail ?? '' }));
      return;
    }
    setSheet(null);
    show('success', tt(successKey, vars));
    router.refresh();
  }

  const startPacking = () => run(() => setOrderStatusAction({ id: orderId, status: 'in_production' }), 'orders.status_saved');

  let primary: React.ReactNode = null;
  if (status === 'confirmed') {
    primary = (
      <Button size="lg" fullWidth loading={busy} onClick={() => (advanceWaiting ? setSheet('advance') : startPacking())}>
        <Factory aria-hidden="true" />
        {tt('btn.start_packing')}
      </Button>
    );
  } else if (status === 'in_production') {
    primary = (
      <Button size="lg" fullWidth onClick={() => setSheet('bags')}>
        <PackageCheck aria-hidden="true" />
        {tt('btn.packed')}
      </Button>
    );
  } else if (status === 'ready') {
    primary = (
      <Link href={`/orders/${orderId}/dispatch`} className={buttonVariants({ size: 'lg', fullWidth: true })}>
        <Truck aria-hidden="true" />
        {tt('btn.dispatch')}
      </Link>
    );
  } else if (status === 'dispatched' && latestDispatchId) {
    primary = (
      <Button size="lg" fullWidth onClick={() => setSheet('delivered')}>
        <CheckCircle2 aria-hidden="true" />
        {tt('btn.delivered')}
      </Button>
    );
  }

  return (
    <>
      {status === 'delivered' && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-base font-semibold text-emerald-800">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          {tt('orders.all_done')}
        </p>
      )}
      {status === 'cancelled' && (
        <p className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 p-4 text-base font-semibold text-slate-700">
          <Ban className="h-6 w-6" aria-hidden="true" />
          {tt('orders.cancelled_line')}
        </p>
      )}

      {canCancel && (
        <MoreFields>
          <Button variant="destructive" fullWidth onClick={() => setSheet('cancel')}>
            <Ban aria-hidden="true" />
            {tt('btn.cancel_order')}
          </Button>
        </MoreFields>
      )}

      {primary && <StickyBar>{primary}</StickyBar>}

      <ConfirmSheet
        open={sheet === 'advance'}
        title={tt('btn.start_packing')}
        message={tt('msg.advance_not_received')}
        confirmLabel={tt('btn.start_anyway')}
        cancelLabel={tt('btn.wait')}
        loading={busy}
        onConfirm={startPacking}
        onClose={() => setSheet(null)}
      />

      <BagsSheet
        open={sheet === 'bags'}
        planned={plannedBags}
        loading={busy}
        onClose={() => setSheet(null)}
        onSave={(bags) => run(() => setPackedAction({ id: orderId, bags }), 'orders.saved_bags', { n: bags })}
      />

      <ConfirmSheet
        open={sheet === 'delivered'}
        title={tt('orders.delivered_title')}
        confirmLabel={tt('btn.save')}
        cancelLabel={tt('btn.cancel')}
        loading={busy}
        confirmDisabled={!deliveredOn}
        onConfirm={() =>
          latestDispatchId &&
          run(() => deliveredAction({ order_id: orderId, dispatch_id: latestDispatchId, delivered_on: deliveredOn }), 'orders.status_saved')
        }
        onClose={() => setSheet(null)}
      >
        <FormField htmlFor="delivered-on" label={tt('field.dispatch.delivered_on')}>
          <DateInput id="delivered-on" value={deliveredOn} max={todayISO()} onChange={(e) => setDeliveredOn(e.target.value)} />
        </FormField>
      </ConfirmSheet>

      <ConfirmSheet
        open={sheet === 'cancel'}
        title={tt('btn.cancel_order')}
        message={tt('orders.cancel_title', { code: orderCode })}
        confirmLabel={tt('btn.cancel_order')}
        cancelLabel={tt('btn.no')}
        destructive
        loading={busy}
        onConfirm={() => run(() => setOrderStatusAction({ id: orderId, status: 'cancelled' }), 'orders.status_saved')}
        onClose={() => setSheet(null)}
      />

      <Toast toast={toast} onClose={clear} />
    </>
  );
}
