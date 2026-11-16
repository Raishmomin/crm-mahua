import * as React from 'react';
import { cn } from '@/lib/utils';
import { ORDER_STEPS } from '@/lib/status';

/** Tiny 5-dot stepper for list rows (filled = reached). Decorative: the Status pill carries the word. */
export function OrderDots({ status, className }: { status: string; className?: string }) {
  if (status === 'cancelled') return null;
  const idx = ORDER_STEPS.indexOf(status as (typeof ORDER_STEPS)[number]);
  return (
    <span className={cn('flex items-center justify-end gap-1', className)} aria-hidden="true">
      {ORDER_STEPS.map((step, i) => (
        <span key={step} className={cn('h-2 w-2 rounded-full', i <= idx ? 'bg-emerald-700' : 'bg-slate-300')} />
      ))}
    </span>
  );
}
