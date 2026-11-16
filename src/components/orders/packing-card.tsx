'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Check, Ship, Truck } from 'lucide-react';
import { cn, formatDate, formatQty } from '@/lib/utils';
import type { OrderStatus, OrderStepDates } from '@/types/orders';
import { Status } from '@/components/ui/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Toast, useToast } from '@/components/ui/toast';
import { useLang, useT } from '@/components/shell/lang-provider';
import { ORDER_LABELS } from '@/app/(dashboard)/orders/labels';
import { setOrderStatusAction, setPackedAction, type ActionResult } from '@/app/(dashboard)/orders/actions';
import { BagsSheet } from './bags-sheet';

export interface PackingCardProps {
  orderId: string;
  status: OrderStatus;
  statusChangedAt: string;
  /** orders.step_dates (A7): every done line keeps its own date */
  stepDates: OrderStepDates;
  buyerName: string;
  city: string | null;
  productLines: string[];
  plannedBags: number;
  bagKg: number;
  qtyKg: number;
  packedBags: number | null;
  packagingName: string | null;
  labelLines: string[];
  moisturePct: number | null;
  shipBy: string | null;
  mode: 'truck' | 'container';
  advanceWaiting: boolean;
  dispatchedOn: string | null;
}

const STEP_ORDER: OrderStatus[] = ['confirmed', 'in_production', 'ready', 'dispatched', 'delivered'];

/** Supervisor packing card (screens.md 16B, components.md 13): big text, no money, three step buttons. */
export function PackingCard(p: PackingCardProps) {
  const lang = useLang();
  const tt = useT(ORDER_LABELS);
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [bagsOpen, setBagsOpen] = React.useState(false);

  const at = STEP_ORDER.indexOf(p.status);
  const bags = p.packedBags ?? p.plannedBags;
  const progress = p.plannedBags > 0 && p.packedBags != null ? Math.min(100, Math.round((p.packedBags / p.plannedBags) * 100)) : 0;
  const ModeIcon = p.mode === 'container' ? Ship : Truck;
  // Rows made before step_dates existed fall back to the old rule (date of the current step only).
  const stepDate = (step: 'in_production' | 'ready', index: number) => p.stepDates[step] ?? (at === index ? p.statusChangedAt : null);

  async function run(action: () => Promise<ActionResult>, successKey: string, vars?: Record<string, string | number>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      show('error', tt(result.messageKey));
      return;
    }
    setBagsOpen(false);
    show('success', tt(successKey, vars));
    router.refresh();
  }

  return (
    <div className="space-y-4 pb-6">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-2xl font-bold text-slate-900">{p.city ? `${p.buyerName} — ${p.city}` : p.buyerName}</h2>
        {p.productLines.map((line, i) => (
          <p key={i} className="text-xl text-slate-900">
            {line}
          </p>
        ))}
        <div>
          <p className="text-3xl font-bold tabular-nums text-slate-900">
            {p.packedBags != null ? `${p.packedBags} / ${p.plannedBags}` : bags} {tt('unit.bags')} x {p.bagKg} {tt('unit.kg')}
          </p>
          <p className="text-xl tabular-nums text-slate-700">= {formatQty(p.qtyKg, lang)}</p>
          {p.packedBags != null && (
            <div className="mt-2 h-3 rounded-full bg-slate-200" aria-hidden="true">
              <div className="h-3 rounded-full bg-emerald-700" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        {p.packagingName && (
          <p className="text-lg text-slate-800">
            <span className="font-semibold">{tt('orders.bag')}:</span> {p.packagingName}
          </p>
        )}
        <div className="text-lg text-slate-800">
          <span className="font-semibold">{tt('orders.label')}:</span>
          {p.labelLines.map((l, i) => (
            <p key={i} className="pl-4">
              {l}
            </p>
          ))}
        </div>
        {p.moisturePct != null && <p className="text-lg text-slate-800">{tt('orders.moisture_max', { pct: p.moisturePct })}</p>}
        {p.shipBy && (
          <p className="flex items-center gap-2 text-xl text-slate-900">
            <Calendar className="h-6 w-6 text-slate-500" aria-hidden="true" />
            {tt('orders.ship_by', { date: formatDate(p.shipBy) })}
            <ModeIcon className="h-6 w-6 text-slate-500" aria-label={tt(`dispatch_mode.${p.mode}`)} />
          </p>
        )}
        <Status domain="order" code={p.status} size="lg" dispatchMode={p.mode} />
      </section>

      {p.status !== 'cancelled' && (
        <div className="space-y-3">
          {/* 1. Packing started */}
          {at === 0 ? (
            <Button size="lg" fullWidth disabled={p.advanceWaiting} loading={busy} onClick={() => run(() => setOrderStatusAction({ id: p.orderId, status: 'in_production' }), 'orders.status_saved')}>
              {p.advanceWaiting ? tt('btn.wait_for_advance') : tt('btn.packing_started')}
            </Button>
          ) : (
            <DoneLine word={tt('btn.packing_started')} date={stepDate('in_production', 1)} />
          )}
          {at === 0 && p.advanceWaiting && <p className="text-base text-amber-800">{tt('orders.wait_advance_hint')}</p>}

          {/* 2. Packed */}
          {at === 1 ? (
            <Button size="lg" fullWidth onClick={() => setBagsOpen(true)}>
              {tt('orders.how_many_bags')}
            </Button>
          ) : at > 1 ? (
            <DoneLine word={tt('orders.packed_n', { n: p.packedBags ?? bags })} date={stepDate('ready', 2)} />
          ) : (
            <Button size="lg" fullWidth variant="secondary" disabled>
              {tt('btn.packed')}
            </Button>
          )}

          {/* 3. Loaded */}
          {at === 2 ? (
            <Link href={`/orders/${p.orderId}/dispatch`} className={buttonVariants({ size: 'lg', fullWidth: true })}>
              {tt('btn.loaded')}
            </Link>
          ) : at > 2 ? (
            <DoneLine word={tt('btn.loaded')} date={p.stepDates.dispatched ?? p.dispatchedOn} />
          ) : (
            <Button size="lg" fullWidth variant="secondary" disabled>
              {tt('btn.loaded')} · {tt('orders.grey_until_packed')}
            </Button>
          )}
        </div>
      )}

      <BagsSheet
        open={bagsOpen}
        planned={p.plannedBags}
        loading={busy}
        onClose={() => setBagsOpen(false)}
        onSave={(n) => run(() => setPackedAction({ id: p.orderId, bags: n }), 'orders.saved_bags', { n })}
      />
      <Toast toast={toast} onClose={clear} />
    </div>
  );
}

function DoneLine({ word, date }: { word: string; date: string | null }) {
  return (
    <p className={cn('flex min-h-[56px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg text-slate-600')}>
      <Check className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden="true" />
      <span className="flex-1">{word}</span>
      {date && <span className="text-base tabular-nums">{formatDate(date)}</span>}
    </p>
  );
}
