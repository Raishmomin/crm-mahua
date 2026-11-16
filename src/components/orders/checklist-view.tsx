'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, ScrollText } from 'lucide-react';
import { cn, formatDate, todayISO } from '@/lib/utils';
import { CHECKLIST_KEYS } from '@/lib/status';
import { whatsappHref } from '@/lib/phone';
import type { ChecklistKey, ExportChecklist } from '@/types/orders';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { FormField } from '@/components/ui/form-field';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { StickyBar } from '@/components/ui/sticky-bar';
import { buttonVariants } from '@/components/ui/button';
import { Toast, useToast } from '@/components/ui/toast';
import { useT } from '@/components/shell/lang-provider';
import { ORDER_LABELS } from '@/app/(dashboard)/orders/labels';
import { tickChecklistAction } from '@/app/(dashboard)/orders/actions';
import { checklistDoneCount } from '@/app/(dashboard)/orders/helpers';
import { ChecklistItem } from './checklist-item';

export interface ChecklistViewProps {
  orderId: string;
  dispatchId: string;
  checklist: ExportChecklist;
  facts: { containerNo: string | null; port: string | null; vessel: string | null; stuffingDate: string | null; eta: string | null; blNo: string | null };
  /** 'operations' may tick only stuffing_done and coa; owner / accountant may untick */
  role: string;
  phone: string | null;
  shareText: string;
}

const PLANT_KEYS: ChecklistKey[] = ['stuffing_done', 'coa'];

/** Export checklist (screens.md 18): 8 rows, Tick sheet with date (+ BL no), Untick for owner / accounts. */
export function ChecklistView({ orderId, dispatchId, checklist, facts, role, phone, shareText }: ChecklistViewProps) {
  const tt = useT(ORDER_LABELS);
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [ticking, setTicking] = React.useState<ChecklistKey | null>(null);
  const [unticking, setUnticking] = React.useState<ChecklistKey | null>(null);
  const [onDate, setOnDate] = React.useState(todayISO());
  const [blNo, setBlNo] = React.useState('');
  const [blError, setBlError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const done = checklistDoneCount(checklist);
  const canUntick = role === 'owner' || role === 'accountant';
  const wa = whatsappHref(phone, shareText);

  function openTick(key: ChecklistKey) {
    setOnDate(todayISO());
    setBlNo('');
    setBlError(null);
    setTicking(key);
  }

  async function save(key: ChecklistKey, isDone: boolean) {
    if (isDone && key === 'bl_received' && !blNo.trim()) {
      setBlError(tt('msg.err.bl_required'));
      return;
    }
    setBusy(true);
    const result = await tickChecklistAction({
      order_id: orderId,
      dispatch_id: dispatchId,
      key,
      done: isDone,
      on_date: isDone ? onDate : null,
      bl_no: isDone && key === 'bl_received' ? blNo.trim() : null,
    });
    setBusy(false);
    if (!result.ok) {
      show('error', tt(result.messageKey));
      return;
    }
    setTicking(null);
    setUnticking(null);
    show('success', tt('msg.saved'));
    router.refresh();
  }

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <section className="space-y-1 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-semibold text-slate-900">{[facts.containerNo, facts.port].filter(Boolean).join(' · ')}</p>
          <StatusBadge role={done >= 8 ? 'green' : 'amber'} icon={ScrollText} word={tt('checklist.progress', { done })} />
        </div>
        {facts.vessel && <p className="text-base text-slate-700">{tt('orders.vessel_line', { vessel: facts.vessel })}</p>}
        <p className="text-base text-slate-700">
          {[
            facts.stuffingDate ? tt('orders.stuffed', { date: formatDate(facts.stuffingDate) }) : null,
            facts.eta ? tt('orders.eta', { date: formatDate(facts.eta) }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="text-base text-slate-700">{facts.blNo ? tt('orders.bl_line', { bl: facts.blNo }) : tt('msg.bl_not_yet')}</p>
      </section>

      <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {CHECKLIST_KEYS.map((key) => (
          <ChecklistItem
            key={key}
            label={tt(`checklist.${key}`)}
            entry={checklist[key]}
            extra={key === 'bl_received' ? facts.blNo : null}
            canTick={role !== 'operations' || PLANT_KEYS.includes(key)}
            canUntick={canUntick}
            busy={busy}
            onTick={() => openTick(key)}
            onUntick={() => setUnticking(key)}
          />
        ))}
      </ul>
      {role === 'operations' && <p className="text-sm text-slate-500">{tt('orders.only_plant_items')}</p>}

      <StickyBar>
        <a
          href={wa ?? undefined}
          target={wa ? '_blank' : undefined}
          rel={wa ? 'noopener noreferrer' : undefined}
          aria-disabled={!wa || undefined}
          className={cn(buttonVariants({ variant: 'whatsapp', size: 'lg', fullWidth: true }), !wa && 'bg-slate-300 text-slate-500')}
        >
          <MessageCircle aria-hidden="true" />
          {tt('btn.share_status_whatsapp')}
        </a>
      </StickyBar>

      <ConfirmSheet
        open={ticking !== null}
        title={ticking ? tt(`checklist.${ticking}`) : ''}
        confirmLabel={tt('btn.save')}
        cancelLabel={tt('btn.cancel')}
        loading={busy}
        confirmDisabled={!onDate}
        onConfirm={() => ticking && save(ticking, true)}
        onClose={() => setTicking(null)}
      >
        <FormField htmlFor="tick-date" label={tt('orders.done_on')}>
          <DateInput id="tick-date" value={onDate} max={todayISO()} onChange={(e) => setOnDate(e.target.value)} />
        </FormField>
        {ticking === 'bl_received' && (
          <FormField htmlFor="tick-bl" label={tt('field.dispatch.bl_no')} error={blError}>
            <Input
              id="tick-bl"
              value={blNo}
              autoCapitalize="characters"
              className="uppercase"
              maxLength={60}
              onChange={(e) => {
                setBlNo(e.target.value.toUpperCase());
                setBlError(null);
              }}
            />
          </FormField>
        )}
      </ConfirmSheet>

      <ConfirmSheet
        open={unticking !== null}
        title={unticking ? tt('orders.untick_title', { item: tt(`checklist.${unticking}`) }) : ''}
        confirmLabel={tt('btn.untick')}
        cancelLabel={tt('btn.no')}
        destructive
        loading={busy}
        onConfirm={() => unticking && save(unticking, false)}
        onClose={() => setUnticking(null)}
      />
      <Toast toast={toast} onClose={clear} />
    </div>
  );
}
