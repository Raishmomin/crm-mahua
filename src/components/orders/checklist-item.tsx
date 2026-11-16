'use client';

import * as React from 'react';
import { Camera, CheckCircle2, Circle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { ChecklistEntry } from '@/types/orders';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/shell/lang-provider';
import { ORDER_LABELS } from '@/app/(dashboard)/orders/labels';

export interface ChecklistItemProps {
  label: string;
  entry: ChecklistEntry | undefined;
  /** extra fact on the done line (BL number) */
  extra?: string | null;
  canTick: boolean;
  canUntick: boolean;
  busy?: boolean;
  onTick: () => void;
  onUntick: () => void;
}

/** One export paper row (components.md 13): tick icon, label, done date or Pending, Tick / Untick. */
export function ChecklistItem({ label, entry, extra, canTick, canUntick, busy, onTick, onUntick }: ChecklistItemProps) {
  const tt = useT(ORDER_LABELS);
  const done = entry?.done === true;
  return (
    <li className="flex min-h-[64px] items-center gap-3 border-b border-slate-200 px-4 py-2 last:border-b-0">
      {done ? (
        <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-700" aria-hidden="true" />
      ) : (
        <Circle className="h-7 w-7 shrink-0 text-amber-600" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-slate-900">{label}</p>
        <p className="text-sm text-slate-500">
          {done
            ? [entry?.date ? tt('orders.done_date', { date: formatDate(entry.date) }) : tt('status.checklist.done'), extra].filter(Boolean).join(' · ')
            : tt('status.checklist.pending')}
        </p>
      </div>
      {!done && canTick && (
        <Button variant="outline" size="sm" onClick={onTick} disabled={busy}>
          {tt('btn.tick')}
        </Button>
      )}
      {done && canUntick && (
        <Button variant="ghost" size="sm" onClick={onUntick} disabled={busy}>
          {tt('btn.untick')}
        </Button>
      )}
      <Button variant="ghost" size="icon" disabled aria-label={tt('btn.take_photo')} title={tt('common.optional')} className="hidden sm:inline-flex">
        <Camera aria-hidden="true" />
      </Button>
    </li>
  );
}
