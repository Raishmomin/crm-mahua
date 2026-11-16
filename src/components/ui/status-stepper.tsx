'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn, formatDate, formatShortDate } from '@/lib/utils';
import { t, type Lang } from '@/lib/i18n';
import { ORDER_STEPS, statusInfo } from '@/lib/status';
import { useLang } from '@/components/shell/lang-provider';
import { Status } from './status-badge';

export interface StatusStepperProps {
  status: string;
  lang?: Lang;
  dispatchMode?: 'truck' | 'container' | null;
  /** shown next to the Cancelled badge */
  cancelledAt?: string | null;
  /** optional: ISO date each step was reached (orders.step_dates); shown under every reached step */
  stepDates?: Partial<Record<string, string | null>> | null;
  className?: string;
}

/** Five equal steps confirmed -> delivered; cancelled shows one grey badge instead. */
export function StatusStepper({ status, lang, dispatchMode, cancelledAt, stepDates, className }: StatusStepperProps) {
  const ctxLang = useLang();
  const l = lang ?? ctxLang;

  if (status === 'cancelled') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <Status domain="order" code="cancelled" size="lg" lang={l} />
        {cancelledAt && <span className="text-base text-slate-500">{formatDate(cancelledAt)}</span>}
      </div>
    );
  }

  const currentIndex = Math.max(0, ORDER_STEPS.indexOf(status as (typeof ORDER_STEPS)[number]));
  const allDone = status === 'delivered';

  return (
    <ol className={cn('grid grid-cols-5 gap-0', className)} aria-label={t(l, 'section.dispatch')}>
      {ORDER_STEPS.map((step, i) => {
        const info = statusInfo('order', step, { dispatchMode });
        const Icon = info.icon;
        const done = allDone || i < currentIndex;
        const current = !allDone && i === currentIndex;
        const reachedOn = done || current ? stepDates?.[step] ?? null : null;
        return (
          <li key={step} className="relative flex flex-col items-center">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-0 right-1/2 top-[18px] h-[3px] -translate-x-1/2 w-full',
                  done || current ? 'bg-emerald-700' : 'bg-slate-200'
                )}
                style={{ left: '-50%', width: '100%' }}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-9 w-9 items-center justify-center rounded-full',
                done && 'bg-emerald-700 text-white',
                current && 'border-[3px] border-emerald-700 bg-white text-emerald-800',
                !done && !current && 'border border-slate-300 bg-slate-100 text-slate-400'
              )}
            >
              {done ? <Check className="h-5 w-5" aria-hidden="true" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
            </span>
            <span
              className={cn(
                'mt-1.5 line-clamp-2 text-center text-sm leading-tight',
                done && 'text-slate-700',
                current && 'font-bold text-emerald-800',
                !done && !current && 'text-slate-400'
              )}
              aria-current={current ? 'step' : undefined}
            >
              {t(l, info.labelKey)}
            </span>
            {reachedOn && <span className="mt-0.5 text-center text-sm tabular-nums leading-tight text-slate-500">{formatShortDate(reachedOn)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
